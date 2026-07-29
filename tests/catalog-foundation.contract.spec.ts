import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter } from "../app/canonical/router";
import { catalogFoundationRouter } from "../app/pats/catalog-foundation";
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
				providerSubject: "catalog-foundation-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-catalog-foundation",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "catalog-foundation-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

function database() {
	const product = {
		id: "product-b243",
		productCode: "B243",
		productName: "Sanrio Characters Fruits Mejirushi Accessory",
		lifecycleStatus: "DRAFT",
		evidenceStatus: "PROVISIONAL",
		rowVersion: 1,
		createdAt: date,
		updatedAt: date,
	};
	const model = {
		id: "model-b243-01",
		productId: product.id,
		modelNumber: "01",
		modelName: "Fruit Model",
		skuCode: null,
		sourceStatus: "NEEDS_CONFIRMATION",
		lifecycleStatus: "DRAFT",
		evidenceStatus: "PROVISIONAL",
		rowVersion: 1,
		createdAt: date,
		updatedAt: date,
	};
	const modelPart = {
		id: "model-part-b243-01-01",
		modelId: model.id,
		partCode: "B243-01-01",
		partName: "Upper Body",
		lifecycleStatus: "DRAFT",
		evidenceStatus: "PROVISIONAL",
		rowVersion: 1,
		createdAt: date,
		updatedAt: date,
	};
	const links: Array<Record<string, unknown>> = [];

	const db = {
		product: {
			create: async ({ data }: { data: Record<string, unknown> }) => ({
				...product,
				...data,
			}),
			findUnique: async ({ where }: { where: { id: string } }) =>
				where.id === product.id ? product : null,
			update: async ({ data }: { data: Record<string, unknown> }) => ({
				...product,
				...data,
				rowVersion: product.rowVersion + 1,
				updatedAt: new Date(date.getTime() + 1000),
			}),
		},
		model: {
			create: async ({ data }: { data: Record<string, unknown> }) => ({ ...model, ...data }),
			findUnique: async ({ where }: { where: { id: string } }) =>
				where.id === model.id || where.id === product.id ? model : null,
			update: async ({ data }: { data: Record<string, unknown> }) => ({
				...model,
				...data,
				rowVersion: model.rowVersion + 1,
				updatedAt: new Date(date.getTime() + 1000),
			}),
		},
		modelPart: {
			create: async ({ data }: { data: Record<string, unknown> }) => ({
				...modelPart,
				...data,
			}),
			findUnique: async ({ where }: { where: { id: string } }) =>
				where.id === modelPart.id ? modelPart : null,
			update: async ({ data }: { data: Record<string, unknown> }) => ({
				...modelPart,
				...data,
				rowVersion: modelPart.rowVersion + 1,
				updatedAt: new Date(date.getTime() + 1000),
			}),
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

	return { db, links, product };
}

function appWith(
	assignments: Array<{ kind: "ROLE_BUNDLE" | "CAPABILITY"; key: string; status: "ACTIVE" }>,
) {
	const { db, links, product } = database();
	const app = express();
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: identity(assignments),
			catalogMutations: {
				requiredCapability: "catalog.manage",
				router: catalogFoundationRouter(db as never),
			},
		}),
	);
	return { app, links, product };
}

describe("canonical catalog foundation writes", () => {
	it("creates a draft Product and records source evidence links", async () => {
		const { app, links } = appWith([
			{ kind: "CAPABILITY", key: "catalog.manage", status: "ACTIVE" },
		]);

		const response = await request(app)
			.post("/api/v1/catalog/products")
			.set("Authorization", "Bearer foundation-test-token")
			.set("Idempotency-Key", "product-create-b243")
			.send({
				productCode: "B243",
				productName: "Sanrio Characters Fruits Mejirushi Accessory",
				evidenceStatus: "PROVISIONAL",
				sourceEvidenceIds: ["evidence-b243-title"],
			});

		expect(response.status).to.equal(201);
		expect(response.headers.location).to.equal("/api/v1/catalog/products/product-b243");
		expect(response.headers.etag).to.equal('"1"');
		expect(response.body).to.include({
			id: "product-b243",
			productCode: "B243",
			lifecycleStatus: "DRAFT",
		});
		expect(response.body.provenance).to.deep.equal({ sourceEvidenceCount: 1 });
		expect(links).to.have.length(1);

		const replay = await request(app)
			.post("/api/v1/catalog/products")
			.set("Authorization", "Bearer foundation-test-token")
			.set("Idempotency-Key", "product-create-b243")
			.send({
				productCode: "B243",
				productName: "Sanrio Characters Fruits Mejirushi Accessory",
				evidenceStatus: "PROVISIONAL",
				sourceEvidenceIds: ["evidence-b243-title"],
			});
		expect(replay.status).to.equal(201);
		expect(replay.body).to.deep.equal(response.body);
		expect(links).to.have.length(1);
	});

	it("rejects a model when its Product is not present", async () => {
		const { app } = appWith([{ kind: "CAPABILITY", key: "catalog.manage", status: "ACTIVE" }]);

		const response = await request(app)
			.post("/api/v1/catalog/models")
			.set("Authorization", "Bearer foundation-test-token")
			.set("Idempotency-Key", "model-create-missing-product")
			.send({ productId: "missing-product", modelNumber: "01" });

		expect(response.status).to.equal(404);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-found");
	});

	it("requires catalog.manage and does not trust a workspace header", async () => {
		const { app } = appWith([{ kind: "CAPABILITY", key: "catalog.read", status: "ACTIVE" }]);

		const response = await request(app)
			.post("/api/v1/catalog/products")
			.set("Authorization", "Bearer foundation-test-token")
			.set("x-workspace-id", "client-selected-workspace")
			.send({ productCode: "B243", productName: "Attempt" });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("uses If-Match for mutable Product updates", async () => {
		const { app } = appWith([{ kind: "CAPABILITY", key: "catalog.manage", status: "ACTIVE" }]);

		const missingPrecondition = await request(app)
			.patch("/api/v1/catalog/products/product-b243")
			.set("Authorization", "Bearer foundation-test-token")
			.send({ productName: "Updated name" });
		expect(missingPrecondition.status).to.equal(412);

		const updated = await request(app)
			.patch("/api/v1/catalog/products/product-b243")
			.set("Authorization", "Bearer foundation-test-token")
			.set("If-Match", '"1"')
			.send({ productName: "Updated name" });
		expect(updated.status).to.equal(200);
		expect(updated.headers.etag).to.equal('"2"');
	});

	it("does not mutate a published Product through the draft API", async () => {
		const { app, product } = appWith([
			{ kind: "CAPABILITY", key: "catalog.manage", status: "ACTIVE" },
		]);
		product.lifecycleStatus = "PUBLISHED";

		const response = await request(app)
			.patch("/api/v1/catalog/products/product-b243")
			.set("Authorization", "Bearer foundation-test-token")
			.set("If-Match", '"1"')
			.send({ productName: "Attempted publication edit" });

		expect(response.status).to.equal(409);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:conflict");
	});
});
