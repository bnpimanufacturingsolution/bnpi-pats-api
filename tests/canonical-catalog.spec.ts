import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter } from "../app/canonical/router";
import { catalogController } from "../app/pats/catalog";
import type { ObjectStorage } from "../app/storage/object-storage";
import type { IdentityDependencies } from "../app/identity/types";

const productId = "product-b251";

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

function storage(): ObjectStorage {
	return {
		putObject: async () => { throw new Error("not used"); },
		getObject: async () => { throw new Error("not used"); },
		deleteObject: async () => undefined,
		createReadUrl: async () => "https://minio.invalid/read-url",
	};
}

describe("canonical deployment-scoped catalog", () => {
	it("reads the catalog without a client-selected workspace header", async () => {
		const product = {
			id: productId,
			productCode: "B251",
			productName: "Machibouke Hamburger Shop",
			lifecycleStatus: "DRAFT",
			evidenceStatus: "NEEDS_CONFIRMATION",
			rowVersion: 1,
			createdAt: new Date("2026-07-15T00:00:00.000Z"),
			updatedAt: new Date("2026-07-15T00:00:00.000Z"),
			models: [],
		};
		const findFirst = async (args: { where?: unknown }) => {
			expect(args.where).to.deep.equal({ id: productId });
			return product;
		};
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "catalog-manager", status: "ACTIVE" }]),
			catalog: {
				requiredCapability: "catalog.read",
				handler: catalogController(
					{ product: { findFirst } } as never,
					storage(),
					{ canonical: true },
				),
			},
		}));

		const response = await request(app)
			.get(`/api/v1/catalog/products/${productId}`)
			.set("Authorization", "Bearer foundation-test-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.include({
			productId,
			productCode: "B251",
			lifecycleStatus: "DRAFT",
			evidenceStatus: "NEEDS_CONFIRMATION",
			rowVersion: 1,
		});
	});

	it("denies catalog access without the read capability", async () => {
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }]),
			catalog: { requiredCapability: "catalog.read", handler: (_req, res) => res.json({}) },
		}));

		const response = await request(app)
			.get(`/api/v1/catalog/products/${productId}`)
			.set("Authorization", "Bearer foundation-test-token");

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});
});
