import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter } from "../app/canonical/router";
import { catalogProductCollectionController } from "../app/pats/catalog";
import type { IdentityDependencies } from "../app/identity/types";

function identity(assignments: Array<{ kind: "ROLE_BUNDLE" | "CAPABILITY"; key: string; status: "ACTIVE" }>): IdentityDependencies {
	return {
		authenticator: { authenticate: async () => ({ provider: "local", issuer: "pats-local", providerSubject: "catalog-user" }) },
		subjects: {
			resolve: async () => ({
				id: "subject-catalog",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "catalog-user",
				displayNameSnapshot: "Catalog User",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

const product = {
	id: "product-b251",
	productCode: "B251",
	productName: "Machibouke Hamburger Shop",
	lifecycleStatus: "DRAFT",
	evidenceStatus: "NEEDS_CONFIRMATION",
	createdAt: new Date("2026-07-15T00:00:00.000Z"),
	updatedAt: new Date("2026-07-16T00:00:00.000Z"),
};

function appFor(
	productClient: { count: () => Promise<number>; findMany: (args: Record<string, unknown>) => Promise<unknown[]> },
	assignments: Array<{ kind: "ROLE_BUNDLE" | "CAPABILITY"; key: string; status: "ACTIVE" }> = [
		{ kind: "ROLE_BUNDLE", key: "catalog-manager", status: "ACTIVE" },
	],
) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		catalogCollection: {
			requiredCapability: "catalog.read",
			handler: catalogProductCollectionController({ product: productClient } as never),
		},
		catalogMutations: { requiredCapability: "catalog.manage", router: express.Router() },
	}));
	return app;
}

describe("canonical catalog product collection", () => {
	it("returns normalized summaries with offset pagination and stable sorting", async () => {
		let receivedArgs: Record<string, unknown> | undefined;
		const app = appFor({
			count: async () => 3,
			findMany: async (args) => {
				receivedArgs = args;
				return [product];
			},
		});

		const response = await request(app)
			.get("/api/v1/catalog/products")
			.query({ page: 2, limit: 1, sort: "-updated_at" })
			.set("Authorization", "Bearer foundation-test-token");

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({
			data: [{
				productId: "product-b251",
				productCode: "B251",
				productName: "Machibouke Hamburger Shop",
				lifecycleStatus: "DRAFT",
				evidenceStatus: "NEEDS_CONFIRMATION",
				createdAt: "2026-07-15T00:00:00.000Z",
				updatedAt: "2026-07-16T00:00:00.000Z",
			}],
			pagination: { page: 2, pageSize: 1, totalItems: 3, totalPages: 3 },
		});
		expect(receivedArgs).to.deep.include({ skip: 1, take: 1 });
		expect(receivedArgs?.orderBy).to.deep.equal([{ updatedAt: "desc" }, { id: "asc" }]);
		expect(receivedArgs?.select).to.deep.equal({
			id: true,
			productCode: true,
			productName: true,
			lifecycleStatus: true,
			evidenceStatus: true,
			createdAt: true,
			updatedAt: true,
		});
	});

	it("rejects unsupported collection query parameters", async () => {
		const app = appFor({ count: async () => 0, findMany: async () => [] });

		const response = await request(app)
			.get("/api/v1/catalog/products")
			.query({ status: "DRAFT" })
			.set("Authorization", "Bearer foundation-test-token");

		expect(response.status).to.equal(400);
		expect(response.headers["content-type"]).to.match(/application\/problem\+json/);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:malformed-request");
	});

	it("fails closed without catalog.read", async () => {
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }]),
			catalogCollection: {
				requiredCapability: "catalog.read",
				handler: (_req, res) => res.json({ data: [] }),
			},
		}));

		const response = await request(app)
			.get("/api/v1/catalog/products")
			.set("Authorization", "Bearer foundation-test-token");

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("allows a read-only capability through the adjacent mutation boundary", async () => {
		const app = appFor(
			{ count: async () => 0, findMany: async () => [] },
			[{ kind: "CAPABILITY", key: "catalog.read", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/catalog/products")
			.set("Authorization", "Bearer foundation-test-token");

		expect(response.status).to.equal(200);
	});

	it("returns a dependency problem when catalog persistence is unavailable", async () => {
		const app = appFor({
			count: async () => { throw new Error("database unavailable"); },
			findMany: async () => [],
		});

		const response = await request(app)
			.get("/api/v1/catalog/products")
			.set("Authorization", "Bearer foundation-test-token");

		expect(response.status).to.equal(503);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:dependency-unavailable");
	});
});
