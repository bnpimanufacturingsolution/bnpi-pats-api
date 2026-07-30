import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

function identity(assignments: SubjectAssignmentRecord[]): IdentityDependencies {
	return {
		authenticator: { authenticate: async () => ({ provider: "local", issuer: "pats-local", providerSubject: "command-user" }) },
		subjects: {
			resolve: async () => ({ id: "subject-command", provider: "local", issuer: "pats-local", providerSubject: "command-user", status: "ACTIVE" as const }),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

function appFor(database: Record<string, unknown>, assignments: SubjectAssignmentRecord[] = [{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }]) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

describe("canonical PATS command contract", () => {
	it("creates a production plan, records audit/outbox evidence, and replays the response", async () => {
		let storedRecord: Record<string, unknown> | null = null;
		let createdPlans = 0;
		const database = {
			idempotencyRecord: {
				findUnique: async () => storedRecord,
				create: async ({ data }: { data: Record<string, unknown> }) => {
					storedRecord = { id: "idempotency-1", ...data, status: "PENDING", responseStatus: null, responseBody: null, responseHeaders: null };
					return storedRecord;
				},
				update: async ({ data }: { data: Record<string, unknown> }) => {
					storedRecord = { ...(storedRecord ?? {}), ...data };
				},
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				create: async () => {
					createdPlans += 1;
					return { id: "plan-1", projectCode: "PLAN-001", name: "July run", status: "DRAFT", requiredProductionQuantity: 100, productId: null, rowVersion: 1 };
				},
			},
			product: { findUnique: async () => null },
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database);
		const first = await request(app)
			.post("/api/v1/production-plans")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "plan-create-1")
			.send({ planCode: "PLAN-001", name: "July run", requiredProductionQuantity: 100 });

		expect(first.status).to.equal(201);
		expect(first.headers.location).to.equal("/api/v1/production-plans/plan-1");
		expect(first.headers.etag).to.equal('"1"');
		expect(createdPlans).to.equal(1);

		const replay = await request(app)
			.post("/api/v1/production-plans")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "plan-create-1")
			.send({ planCode: "PLAN-001", name: "July run", requiredProductionQuantity: 100 });

		expect(replay.status).to.equal(201);
		expect(replay.headers.location).to.equal("/api/v1/production-plans/plan-1");
		expect(createdPlans).to.equal(1);
	});

	it("requires a matching If-Match value for a plan edit", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async () => ({ id: "idempotency-2" }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				findUnique: async () => ({ id: "plan-1", projectCode: "PLAN-001", name: "Old", status: "DRAFT", requiredProductionQuantity: 100, productId: null, rowVersion: 3 }),
				update: async () => ({ id: "plan-1", projectCode: "PLAN-001", name: "New", status: "DRAFT", requiredProductionQuantity: 100, productId: null, rowVersion: 4 }),
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database);

		const response = await request(app)
			.patch("/api/v1/production-plans/plan-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "plan-patch-1")
			.set("If-Match", '"2"')
			.send({ name: "New" });

		expect(response.status).to.equal(412);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:precondition-failed");
	});

	it("fails command access closed without planning.manage", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/production-plans")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "plan-create-2")
			.send({ planCode: "PLAN-002", name: "Blocked", requiredProductionQuantity: 1 });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("accepts only the next forward route step for a stage event", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-stage", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			batch: {
				findUnique: async () => ({ id: "batch-1", lotId: "lot-1", lot: { id: "lot-1", partsListId: "route-1" }, parts: [{ partId: "part-1" }], positionProjection: null }),
				update: async () => undefined,
			},
			partsList: {
				findUnique: async () => ({ steps: [{ id: "step-1", partId: "part-1", stageId: "stage-1", subStageId: null, stepOrder: 1 }] }),
			},
			stageEvent: {
				create: async () => ({ id: "event-1", batchId: "batch-1", status: "ACCEPTED" }),
			},
			batchPositionProjection: { update: async () => undefined },
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]);

		const response = await request(app)
			.post("/api/v1/stage-events")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "stage-event-1")
			.send({ batchId: "batch-1", stageId: "stage-1", eventType: "STAGE_SCAN_RECORDED" });

		expect(response.status).to.equal(201);
		expect(response.body).to.deep.equal({ stageEventId: "event-1", status: "ACCEPTED", routingViolationId: null });
	});

	it("keeps quality commands behind the quality resolver capability", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/quality-inspections")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "quality-1")
			.send({ batchId: "batch-1", stageId: "stage-1" });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});
});
