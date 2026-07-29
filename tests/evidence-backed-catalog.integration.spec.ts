import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter } from "../app/canonical/router";
import { bomFoundationRouter } from "../app/pats/bom-foundation";
import { catalogFoundationRouter } from "../app/pats/catalog-foundation";
import { processRouteFoundationRouter } from "../app/pats/process-route-foundation";
import type { IdentityDependencies } from "../app/identity/types";

const date = new Date("2026-07-29T00:00:00.000Z");

function identity(): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({
				provider: "local",
				issuer: "pats-local",
				providerSubject: "evidence-integration-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-evidence-integration",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "evidence-integration-user",
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
	const products: Array<Record<string, any>> = [];
	const models: Array<Record<string, any>> = [];
	const modelParts: Array<Record<string, any>> = [];
	const bomDefinitions: Array<Record<string, any>> = [];
	const bomLines: Array<Record<string, any>> = [];
	const processRoutes: Array<Record<string, any>> = [];
	const routeStages: Array<Record<string, any>> = [];
	const links: Array<Record<string, unknown>> = [];
	let nextId = 1;
	const createRecord = (prefix: string, data: Record<string, any>) => ({
		id: `${prefix}-${nextId++}`,
		...data,
		createdAt: date,
		updatedAt: date,
	});
	const findById = (records: Array<Record<string, any>>, id: string) =>
		records.find((record) => record.id === id) ?? null;
	const db = {
		product: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const record = createRecord("product", data);
				products.push(record);
				return record;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				findById(products, where.id),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = findById(products, where.id);
				if (!record) throw new Error("missing product");
				Object.assign(record, data, { rowVersion: record.rowVersion + 1 });
				return record;
			},
		},
		model: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const record = createRecord("model", data);
				models.push(record);
				return record;
			},
			findUnique: async ({ where }: { where: { id: string } }) => findById(models, where.id),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = findById(models, where.id);
				if (!record) throw new Error("missing model");
				Object.assign(record, data, { rowVersion: record.rowVersion + 1 });
				return record;
			},
		},
		modelPart: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const record = createRecord("model-part", data);
				modelParts.push(record);
				return record;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				findById(modelParts, where.id),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = findById(modelParts, where.id);
				if (!record) throw new Error("missing model part");
				Object.assign(record, data, { rowVersion: record.rowVersion + 1 });
				return record;
			},
		},
		bomDefinition: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const record = createRecord("bom", data);
				bomDefinitions.push(record);
				return record;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				findById(bomDefinitions, where.id),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = findById(bomDefinitions, where.id);
				if (!record) throw new Error("missing BOM");
				Object.assign(record, data, { rowVersion: record.rowVersion + 1 });
				return record;
			},
		},
		bomLine: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const record = createRecord("bom-line", data);
				bomLines.push(record);
				return record;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				findById(bomLines, where.id),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = findById(bomLines, where.id);
				if (!record) throw new Error("missing BOM line");
				Object.assign(record, data, { rowVersion: record.rowVersion + 1 });
				return record;
			},
		},
		processRoute: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const record = createRecord("route", data);
				processRoutes.push(record);
				return record;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				findById(processRoutes, where.id),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = findById(processRoutes, where.id);
				if (!record) throw new Error("missing route");
				Object.assign(record, data, { rowVersion: record.rowVersion + 1 });
				return record;
			},
		},
		processRouteStage: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const record = createRecord("route-stage", data);
				routeStages.push(record);
				return record;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				findById(routeStages, where.id),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = findById(routeStages, where.id);
				if (!record) throw new Error("missing route stage");
				Object.assign(record, data, { rowVersion: record.rowVersion + 1 });
				return record;
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
	return {
		db,
		products,
		models,
		modelParts,
		bomDefinitions,
		bomLines,
		processRoutes,
		routeStages,
		links,
	};
}

function appWithDatabase() {
	const state = database();
	const app = express();
	const mutations = express
		.Router()
		.use(catalogFoundationRouter(state.db as never))
		.use(bomFoundationRouter(state.db as never))
		.use(processRouteFoundationRouter(state.db as never));
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: identity(),
			catalogMutations: { requiredCapability: "catalog.manage", router: mutations },
		}),
	);
	return { app, ...state };
}

describe("evidence-backed catalog integration slice", () => {
	it("represents B243, B250, B308, and warehouse evidence without requiring complete client data", async () => {
		const { app, products, models, modelParts, bomLines, routeStages, links } =
			appWithDatabase();
		const fixtures = [
			{
				code: "B243",
				evidenceStatus: "PROVISIONAL",
				evidenceId: "ev-b243-prefix",
				partCode: "B243-01-02A",
				partStatus: "PROVISIONAL",
			},
			{
				code: "B250",
				evidenceStatus: "CONFIRMED",
				evidenceId: "ev-b250-decoration",
				partCode: "B250-01-01",
				partStatus: "CONFIRMED",
			},
			{
				code: "B308",
				evidenceStatus: "NEEDS_CONFIRMATION",
				evidenceId: "ev-b308-injection",
				partCode: "B308-01-01",
				partStatus: "NEEDS_CONFIRMATION",
			},
		];

		for (const fixture of fixtures) {
			const product = await request(app)
				.post("/api/v1/catalog/products")
				.set("Authorization", "Bearer evidence-integration-token")
				.set("Idempotency-Key", `product-${fixture.code}`)
				.send({
					productCode: fixture.code,
					productName: `${fixture.code} analyzed source`,
					evidenceStatus: fixture.evidenceStatus,
					sourceEvidenceIds: [fixture.evidenceId],
				});
			expect(product.status).to.equal(201);

			const model = await request(app)
				.post("/api/v1/catalog/models")
				.set("Authorization", "Bearer evidence-integration-token")
				.set("Idempotency-Key", `model-${fixture.code}`)
				.send({
					productId: product.body.id,
					modelNumber: "01",
					modelName: null,
					evidenceStatus: fixture.evidenceStatus,
					sourceEvidenceIds: [fixture.evidenceId],
				});
			expect(model.status).to.equal(201);

			const part = await request(app)
				.post("/api/v1/catalog/model-parts")
				.set("Authorization", "Bearer evidence-integration-token")
				.set("Idempotency-Key", `part-${fixture.code}`)
				.send({
					modelId: model.body.id,
					partCode: fixture.partCode,
					partName: "Source-derived part",
					evidenceStatus: fixture.partStatus,
					sourceEvidenceIds: [fixture.evidenceId],
				});
			expect(part.status).to.equal(201);

			const bom = await request(app)
				.post("/api/v1/catalog/bom-definitions")
				.set("Authorization", "Bearer evidence-integration-token")
				.set("Idempotency-Key", `bom-${fixture.code}`)
				.send({
					modelId: model.body.id,
					revision: 1,
					evidenceStatus: fixture.evidenceStatus,
					sourceEvidenceIds: [fixture.evidenceId],
				});
			expect(bom.status).to.equal(201);

			const line = await request(app)
				.post("/api/v1/catalog/bom-lines")
				.set("Authorization", "Bearer evidence-integration-token")
				.set("Idempotency-Key", `bom-line-${fixture.code}`)
				.send({
					bomDefinitionId: bom.body.id,
					modelPartId: part.body.id,
					lineNumber: 1,
					relationshipKind: "COMPONENT",
					sourceRepresentation:
						fixture.code === "B250"
							? "decoration source row"
							: "quantity basis unavailable",
					evidenceStatus: fixture.evidenceStatus,
					sourceEvidenceIds: [fixture.evidenceId],
				});
			expect(line.status).to.equal(201);

			const route = await request(app)
				.post("/api/v1/catalog/process-routes")
				.set("Authorization", "Bearer evidence-integration-token")
				.set("Idempotency-Key", `route-${fixture.code}`)
				.send({
					modelId: model.body.id,
					revision: 1,
					evidenceStatus: fixture.evidenceStatus,
					sourceEvidenceIds: [fixture.evidenceId],
				});
			expect(route.status).to.equal(201);

			const stage = await request(app)
				.post("/api/v1/catalog/route-stages")
				.set("Authorization", "Bearer evidence-integration-token")
				.set("Idempotency-Key", `stage-${fixture.code}`)
				.send({
					processRouteId: route.body.id,
					sequence: 1,
					stageName:
						fixture.code === "B250"
							? "Fullspray"
							: fixture.code === "B308"
								? "Injection output"
								: "Warehouse / source dependency",
					sourceRepresentation:
						fixture.code === "B243"
							? "OBS depends on unavailable Barcode Read history.xlsm"
							: undefined,
					evidenceStatus: fixture.evidenceStatus,
					sourceEvidenceIds: [fixture.evidenceId],
				});
			expect(stage.status).to.equal(201);
		}

		expect(products).to.have.length(3);
		expect(models).to.have.length(3);
		expect(modelParts).to.have.length(3);
		expect(bomLines).to.have.length(3);
		expect(routeStages).to.have.length(3);
		expect(bomLines.every((line) => line.quantityMagnitude === null)).to.equal(true);
		expect(links).to.have.length(21);
	});
});
