import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { domainReadRouter } from "../app/pats/domain-read";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

function identity(assignments: SubjectAssignmentRecord[]): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({ provider: "local", issuer: "pats-local", providerSubject: "read-user" }),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-read",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "read-user",
				displayNameSnapshot: "Read User",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

function appFor(
	database: Record<string, unknown>,
	assignments: SubjectAssignmentRecord[] = [{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }],
) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainReads: { router: domainReadRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

describe("canonical PATS domain read contract", () => {
	it("returns a paginated production-plan summary from server persistence", async () => {
		let receivedArgs: Record<string, unknown> | undefined;
		const app = appFor({
			project: {
				count: async () => 3,
				findMany: async (args: Record<string, unknown>) => {
					receivedArgs = args;
					return [{
						id: "plan-1",
						projectCode: "PLAN-001",
						name: "July production",
						status: "RELEASED",
						requiredProductionQuantity: 100,
						productId: "product-1",
						rowVersion: 4,
						createdAt: new Date("2026-07-01T00:00:00.000Z"),
						releasedAt: new Date("2026-07-02T00:00:00.000Z"),
						product: { productName: "Sample product" },
						lots: [{ id: "lot-1" }],
					}];
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/production-plans")
			.query({ page: 2, limit: 1 })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({
			data: [{
				planId: "plan-1",
				planCode: "PLAN-001",
				name: "July production",
				status: "RELEASED",
				requiredProductionQuantity: 100,
				productId: "product-1",
				productName: "Sample product",
				lotCount: 1,
				rowVersion: 4,
				createdAt: "2026-07-01T00:00:00.000Z",
				releasedAt: "2026-07-02T00:00:00.000Z",
			}],
			pagination: { page: 2, pageSize: 1, totalItems: 3, totalPages: 3 },
		});
		expect(receivedArgs).to.deep.include({ skip: 1, take: 1 });
	});

	it("allows batch-filtered reads without treating the filter as an unsupported query", async () => {
		let receivedWhere: unknown;
		const database = {
			batch: {
				count: async ({ where }: { where: unknown }) => {
					receivedWhere = where;
					return 1;
				},
				findMany: async () => [],
			},
		};
		const filteredApp = appFor(database, [{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]);

		const response = await request(filteredApp)
			.get("/api/v1/batches")
			.query({ batch_id: "batch-1", limit: 10 })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({ id: "batch-1" });
	});

	it("exposes configuration reads as server-owned resources", async () => {
		const database = {
			stage: {
				findMany: async () => [{ id: "stage-1", name: "Injection", workflowGroup: { id: "group-1", name: "Factory" }, subStageLinks: [] }],
			},
		};
		const configuredApp = appFor(database, [{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]);

		const response = await request(configuredApp)
			.get("/api/v1/stages")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.deep.equal([{ id: "stage-1", name: "Injection", workflowGroup: { id: "group-1", name: "Factory" }, subStageLinks: [] }]);
	});

	it("returns dashboard counts from active server batches and their lot ownership", async () => {
		const app = appFor({
			project: { count: async () => 4 },
			batch: {
				findMany: async () => [
					{ lot: { id: "lot-1", projectId: "project-1" } },
					{ lot: { id: "lot-1", projectId: "project-1" } },
					{ lot: { id: "lot-2", projectId: "project-2" } },
				],
			},
			routingViolation: { count: async () => 2 },
			qualityDecision: { count: async () => 1 },
			inventoryTransaction: { count: async () => 7 },
		}, [{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/dashboard-summaries")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body).to.include({
			plans: 4,
			activeProjects: 2,
			activeLots: 2,
			activeBatches: 3,
			openViolations: 2,
			qualityHolds: 1,
			inventoryTransactions: 7,
		});
		expect(response.body.generatedAt).to.be.a("string");
	});

	it("fails planning reads closed when the subject lacks planning.read", async () => {
		const app = appFor({ project: { count: async () => 0, findMany: async () => [] } }, [
			{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" },
		]);

		const response = await request(app)
			.get("/api/v1/production-plans")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("rejects unknown collection filters before touching persistence", async () => {
		let called = false;
		const app = appFor({
			project: {
				count: async () => { called = true; return 0; },
				findMany: async () => [],
			},
		});

		const response = await request(app)
			.get("/api/v1/production-plans")
			.query({ status: "RELEASED" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(400);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:malformed-request");
		expect(called).to.equal(false);
	});
});
