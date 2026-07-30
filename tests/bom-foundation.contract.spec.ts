import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter } from "../app/canonical/router";
import { bomFoundationRouter } from "../app/pats/bom-foundation";
import type { IdentityDependencies } from "../app/identity/types";

const date = new Date("2026-07-29T00:00:00.000Z");

function identity(): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({
				provider: "local",
				issuer: "pats-local",
				providerSubject: "bom-test-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-bom-test",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "bom-test-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => [
				{ kind: "CAPABILITY" as const, key: "catalog.manage", status: "ACTIVE" as const },
			],
		},
	};
}

function database() {
	const modelA = { id: "model-a", productId: "product-a" };
	const modelB = { id: "model-b", productId: "product-a" };
	const modelPartA = { id: "model-part-a", modelId: modelA.id };
	const modelPartB = { id: "model-part-b", modelId: modelB.id };
	const definitions: Array<Record<string, any>> = [];
	const lines: Array<Record<string, any>> = [];
	const links: Array<Record<string, unknown>> = [];

	const db = {
		model: {
			findUnique: async ({ where }: { where: { id: string } }) => {
				if (where.id === modelA.id) return modelA;
				if (where.id === modelB.id) return modelB;
				return null;
			},
		},
		modelPart: {
			findUnique: async ({ where }: { where: { id: string } }) => {
				if (where.id === modelPartA.id) return modelPartA;
				if (where.id === modelPartB.id) return modelPartB;
				return null;
			},
		},
		bomDefinition: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const created = {
					id: `bom-${definitions.length + 1}`,
					...data,
					createdAt: date,
					updatedAt: date,
				};
				definitions.push(created);
				return created;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				definitions.find((definition) => definition.id === where.id) ?? null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const current = definitions.find((definition) => definition.id === where.id);
				if (!current) throw new Error("missing definition");
				const updated = {
					...current,
					...data,
					rowVersion: current.rowVersion + 1,
					updatedAt: new Date(date.getTime() + 1000),
				};
				definitions[definitions.indexOf(current)] = updated;
				return updated;
			},
		},
		bomLine: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const created = {
					id: `bom-line-${lines.length + 1}`,
					...data,
					createdAt: date,
					updatedAt: date,
				};
				lines.push(created);
				return created;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				lines.find((line) => line.id === where.id) ?? null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const current = lines.find((line) => line.id === where.id);
				if (!current) throw new Error("missing line");
				const updated = {
					...current,
					...data,
					rowVersion: current.rowVersion + 1,
					updatedAt: new Date(date.getTime() + 1000),
				};
				lines[lines.indexOf(current)] = updated;
				return updated;
			},
		},
		sourceEvidence: {
			findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
				where.id.in.map((id) => ({ id })),
		},
		canonicalEvidenceLink: {
			createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
				links.push(...data);
				return { count: data.length };
			},
			count: async ({ where }: { where: { subjectId: string } }) =>
				links.filter((link) => link.subjectId === where.subjectId).length,
		},
		$transaction: async <T>(callback: (transaction: typeof db) => Promise<T>) => callback(db),
	};

	return { db, definitions, lines, links };
}

function appWithDatabase() {
	const state = database();
	const app = express();
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: identity(),
			catalogMutations: {
				requiredCapability: "catalog.manage",
				router: bomFoundationRouter(state.db as never),
			},
		}),
	);
	return { app, ...state };
}

describe("canonical BOM relationship writes", () => {
	it("creates a draft revision and ordered line while preserving sparse quantity evidence", async () => {
		const { app, definitions, lines, links } = appWithDatabase();

		const definitionResponse = await request(app)
			.post("/api/v1/catalog/bom-definitions")
			.set("Authorization", "Bearer bom-test-token")
			.set("Idempotency-Key", "bom-definition-create")
			.send({
				modelId: "model-a",
				revision: 1,
				evidenceStatus: "PROVISIONAL",
				sourceEvidenceIds: ["evidence-bom"],
			});

		expect(definitionResponse.status).to.equal(201);
		expect(definitionResponse.body).to.include({
			modelId: "model-a",
			revision: 1,
			lifecycleStatus: "DRAFT",
		});
		expect(definitions).to.have.length(1);

		const lineResponse = await request(app)
			.post("/api/v1/catalog/bom-lines")
			.set("Authorization", "Bearer bom-test-token")
			.set("Idempotency-Key", "bom-line-create")
			.send({
				bomDefinitionId: definitionResponse.body.id,
				modelPartId: "model-part-a",
				lineNumber: 1,
				relationshipKind: "COMPONENT",
				sourceRepresentation: "1 pc / completed model",
				sourceEvidenceIds: ["evidence-line"],
			});

		expect(lineResponse.status).to.equal(201);
		expect(lineResponse.body).to.include({
			modelPartId: "model-part-a",
			lineNumber: 1,
			quantityMagnitude: null,
		});
		expect(lineResponse.body.sourceRepresentation).to.equal("1 pc / completed model");
		expect(lineResponse.body.provenance).to.deep.equal({ sourceEvidenceCount: 1 });
		expect(lines).to.have.length(1);
		expect(links).to.have.length(2);
	});

	it("rejects a model part belonging to another model", async () => {
		const { app } = appWithDatabase();
		const definitionResponse = await request(app)
			.post("/api/v1/catalog/bom-definitions")
			.set("Authorization", "Bearer bom-test-token")
			.set("Idempotency-Key", "cross-model-definition")
			.send({ modelId: "model-a", revision: 1 });

		const response = await request(app)
			.post("/api/v1/catalog/bom-lines")
			.set("Authorization", "Bearer bom-test-token")
			.set("Idempotency-Key", "cross-model-line")
			.send({
				bomDefinitionId: definitionResponse.body.id,
				modelPartId: "model-part-b",
				lineNumber: 1,
				relationshipKind: "COMPONENT",
			});

		expect(response.status).to.equal(422);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:validation-error");
	});

	it("uses If-Match when correcting a draft BOM line", async () => {
		const { app } = appWithDatabase();
		const definitionResponse = await request(app)
			.post("/api/v1/catalog/bom-definitions")
			.set("Authorization", "Bearer bom-test-token")
			.set("Idempotency-Key", "patch-definition")
			.send({ modelId: "model-a", revision: 1 });
		const lineResponse = await request(app)
			.post("/api/v1/catalog/bom-lines")
			.set("Authorization", "Bearer bom-test-token")
			.set("Idempotency-Key", "patch-line")
			.send({
				bomDefinitionId: definitionResponse.body.id,
				modelPartId: "model-part-a",
				lineNumber: 1,
				relationshipKind: "COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "pc",
			});

		const missingPrecondition = await request(app)
			.patch(`/api/v1/catalog/bom-lines/${lineResponse.body.id}`)
			.set("Authorization", "Bearer bom-test-token")
			.send({ quantityMagnitude: 2 });
		expect(missingPrecondition.status).to.equal(412);

		const updated = await request(app)
			.patch(`/api/v1/catalog/bom-lines/${lineResponse.body.id}`)
			.set("Authorization", "Bearer bom-test-token")
			.set("If-Match", '"1"')
			.send({ quantityMagnitude: 2, quantityUom: "pc" });
		expect(updated.status).to.equal(200);
		expect(updated.headers.etag).to.equal('"2"');
		expect(updated.body.quantityMagnitude).to.equal(2);
	});
});
