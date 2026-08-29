import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter } from "../app/canonical/router";
import {
	catalogBomDefinitionCollectionController,
	catalogBomDefinitionController,
} from "../app/pats/bom";
import type { IdentityDependencies } from "../app/identity/types";

const date = new Date("2026-07-29T00:00:00.000Z");

function identity(
	assignments: Array<{ kind: "ROLE_BUNDLE" | "CAPABILITY"; key: string; status: "ACTIVE" }>,
): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({
				provider: "local",
				issuer: "pats-local",
				providerSubject: "bom-read-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-bom-read",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "bom-read-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

const definitionA = {
	id: "bom-a-2",
	modelId: "model-a",
	revision: 2,
	lifecycleStatus: "DRAFT",
	evidenceStatus: "PROVISIONAL",
	rowVersion: 1,
	createdAt: date,
	updatedAt: date,
};

const definitionB = {
	id: "bom-b-1",
	modelId: "model-b",
	revision: 1,
	lifecycleStatus: "DRAFT",
	evidenceStatus: "NEEDS_CONFIRMATION",
	rowVersion: 1,
	createdAt: date,
	updatedAt: date,
};

const detailDefinition = {
	...definitionA,
	lines: [
		{
			id: "bom-line-1",
			bomDefinitionId: definitionA.id,
			modelPartId: "model-part-a-1",
			lineNumber: 1,
			relationshipKind: "COMPONENT",
			quantityMagnitude: null,
			quantityUom: null,
			usageBasis: "per completed model",
			sourceRepresentation: "1 pc / completed model",
			lifecycleStatus: "DRAFT",
			evidenceStatus: "SOURCE_ANOMALY",
			rowVersion: 1,
			createdAt: date,
			updatedAt: date,
		},
		{
			id: "bom-line-2",
			bomDefinitionId: definitionA.id,
			modelPartId: "model-part-a-2",
			lineNumber: 2,
			relationshipKind: "DECORATION_INPUT",
			quantityMagnitude: 2,
			quantityUom: "pc",
			usageBasis: null,
			sourceRepresentation: null,
			lifecycleStatus: "DRAFT",
			evidenceStatus: "PROVISIONAL",
			rowVersion: 1,
			createdAt: date,
			updatedAt: date,
		},
	],
};

function appFor(
	options: {
		definitions?: Array<Record<string, unknown>>;
		detail?: Record<string, unknown> | null;
		failReads?: boolean;
	} = {},
	assignments: Array<{ kind: "ROLE_BUNDLE" | "CAPABILITY"; key: string; status: "ACTIVE" }> = [
		{ kind: "CAPABILITY", key: "catalog.read", status: "ACTIVE" },
	],
) {
	const definitions = options.definitions ?? [definitionA];
	const database = {
		bomDefinition: {
			count: async () => {
				if (options.failReads) throw new Error("database unavailable");
				return definitions.length;
			},
			findMany: async () => {
				if (options.failReads) throw new Error("database unavailable");
				return definitions;
			},
			findUnique: async () => {
				if (options.failReads) throw new Error("database unavailable");
				return options.detail ?? detailDefinition;
			},
		},
		canonicalEvidenceLink: {
			count: async ({ where }: { where: { subjectId: string } }) =>
				where.subjectId === definitionA.id
					? 1
					: where.subjectId === "bom-line-1"
						? 1
						: 0,
		},
	};

	const app = express();
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: identity(assignments),
			bomDefinitionCollection: {
				requiredCapability: "catalog.read",
				handler: catalogBomDefinitionCollectionController(database as never),
			},
			bomDefinition: {
				requiredCapability: "catalog.read",
				handler: catalogBomDefinitionController(database as never),
			},
			catalogMutations: { requiredCapability: "catalog.manage", router: express.Router() },
		}),
	);
	return { app, database };
}

describe("canonical BOM definition reads", () => {
	it("filters definitions by model and returns the standard paginated envelope", async () => {
		const { app } = appFor({ definitions: [definitionA] });

		const response = await request(app)
			.get("/api/v1/catalog/bom-definitions")
			.query({ model_id: "model-a", page: 1, limit: 10, sort: "-revision" })
			.set("Authorization", "Bearer bom-read-token");

		expect(response.status).to.equal(200);
		expect(response.headers["cache-control"]).to.equal("no-store");
		expect(response.body).to.deep.equal({
			data: [
				{
					id: definitionA.id,
					modelId: "model-a",
					revision: 2,
					lifecycleStatus: "DRAFT",
					evidenceStatus: "PROVISIONAL",
					provenance: { sourceEvidenceCount: 1 },
					rowVersion: 1,
					createdAt: date.toISOString(),
					updatedAt: date.toISOString(),
				},
			],
			pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
		});
	});

	it("returns ordered lines without converting unknown quantities", async () => {
		const { app } = appFor();

		const response = await request(app)
			.get(`/api/v1/catalog/bom-definitions/${definitionA.id}`)
			.set("Authorization", "Bearer bom-read-token");

		expect(response.status).to.equal(200);
		expect(response.headers["cache-control"]).to.equal("no-store");
		expect(response.body.id).to.equal(definitionA.id);
		expect(response.body.lines.map((line: { lineNumber: number }) => line.lineNumber)).to.deep.equal([
			1,
			2,
		]);
		expect(response.body.lines[0]).to.include({
			modelPartId: "model-part-a-1",
			quantityMagnitude: null,
			quantityUom: null,
			sourceRepresentation: "1 pc / completed model",
		});
		expect(response.body.lines[0].provenance).to.deep.equal({ sourceEvidenceCount: 1 });
	});

	it("requires model_id for bounded collection reads", async () => {
		const { app } = appFor();

		const response = await request(app)
			.get("/api/v1/catalog/bom-definitions")
			.set("Authorization", "Bearer bom-read-token");

		expect(response.status).to.equal(400);
		expect(response.headers["content-type"]).to.match(/application\/problem\+json/);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:malformed-request");
	});

	it("fails closed without catalog.read", async () => {
		const { app } = 		appFor({}, [
			{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" },
		]);

		const response = await request(app)
			.get("/api/v1/catalog/bom-definitions/model-a")
			.set("Authorization", "Bearer bom-read-token");

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("returns a dependency problem when BOM persistence is unavailable", async () => {
		const { app } = appFor({ failReads: true });

		const response = await request(app)
			.get("/api/v1/catalog/bom-definitions/model-a")
			.set("Authorization", "Bearer bom-read-token");

		expect(response.status).to.equal(503);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:dependency-unavailable");
		expect(response.body.detail).to.equal("PATS BOM definition data is unavailable.");
		expect(JSON.stringify(response.body)).to.not.contain("database unavailable");
	});
});
