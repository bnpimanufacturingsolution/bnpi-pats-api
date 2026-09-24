import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import { domainReadRouter } from "../app/pats/domain-read";
import { PrismaClient } from "../generated/pats-client";
import type { CommandTransaction } from "../app/pats/command-support";
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

function appFor(database: Record<string, unknown>, assignments: SubjectAssignmentRecord[] = [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

describe("section identity mounting regression", () => {
	function boundary(mount: "read-only" | "command-only" | "combined", role: string) {
		const calls = { authenticate: 0, resolve: 0, assignments: 0, persistence: [] as string[] };
		const section = { id: "section-1", sectionCode: "SEC-01", name: "Section 1", displayOrder: 0, boundSteps: [] };
		const database = new Proxy(new PrismaClient(), {
			get(_target, property) {
				calls.persistence.push(String(property));
				switch (property) {
					case "section": return {
						findMany: async () => [section],
						count: async () => 1,
						update: async ({ where, data }: { where: { id: string }; data: { displayOrder: number } }) => {
							expect(where.id).to.equal(section.id);
							section.displayOrder = data.displayOrder;
							calls.persistence.push("section.update");
							return section;
						},
					};
					case "idempotencyRecord": return {
						findUnique: async () => null,
						create: async () => ({ id: "section-idempotency" }),
						update: async () => ({ id: "section-idempotency" }),
					};
					case "$transaction": return async (work: (transaction: CommandTransaction) => Promise<unknown>) => work(database);
					case "auditRecord": return {
						create: async ({ data }: { data: { actorSubjectId: string; action: string } }) => {
							expect(data.actorSubjectId).to.equal("section-subject");
							expect(data.action).to.equal("SECTIONS_REORDERED");
							return data;
						},
					};
					case "outboxMessage": return { create: async () => ({ id: "section-outbox" }) };
					default: throw new Error(`Unexpected persistence access: ${String(property)}`);
				}
			},
		});
		const identity: IdentityDependencies = {
			authenticator: {
				authenticate: async (req) => {
					calls.authenticate += 1;
					return req.header("Authorization") === "Bearer section-token"
						? { provider: "local", issuer: "pats-local", providerSubject: "section-user" }
						: null;
				},
			},
			subjects: {
				resolve: async () => {
					calls.resolve += 1;
					return { id: "section-subject", provider: "local", issuer: "pats-local", providerSubject: "section-user", status: "ACTIVE" };
				},
				findById: async () => null,
				listAssignments: async () => {
					calls.assignments += 1;
					return [{ kind: "ROLE_BUNDLE", key: role, status: "ACTIVE" }];
				},
			},
		};
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity,
			...(mount !== "command-only" ? { domainReads: { router: domainReadRouter(database, requireCanonicalCapability) } } : {}),
			...(mount !== "read-only" ? { domainCommands: { router: commandRouter(database, requireCanonicalCapability) } } : {}),
		}));
		return { app, calls };
	}

	const endpoints = [
		{ method: "get", path: "/sections", kind: "read" },
		{ method: "post", path: "/sections", kind: "command" },
		{ method: "patch", path: "/sections/section-1", kind: "command" },
		{ method: "delete", path: "/sections/section-1", kind: "command" },
		{ method: "put", path: "/sections/section-1/processes", kind: "command" },
		{ method: "put", path: "/sections/order", kind: "command" },
		{ method: "get", path: "/sections/section-1/history", kind: "read" },
		{ method: "get", path: "/sections/section-1/support", kind: "read" },
		{ method: "get", path: "/work-processes", kind: "read" },
		{ method: "post", path: "/work-processes", kind: "command" },
		{ method: "patch", path: "/work-processes/process-1", kind: "command" },
		{ method: "delete", path: "/work-processes/process-1", kind: "command" },
	] as const;

	for (const mount of ["read-only", "command-only", "combined"] as const) {
		for (const endpoint of endpoints.filter(({ kind }) => mount === "combined" || mount === `${kind}-only`)) {
			for (const authorization of [undefined, "Bearer rejected-token"]) {
				it(`${mount}: ${endpoint.method} ${endpoint.path} requires accepted credentials (${authorization ? "rejected" : "missing"})`, async () => {
					const { app, calls } = boundary(mount, "admin");
					const pending = request(app)[endpoint.method](`/api/v1${endpoint.path}`);
					if (authorization) pending.set("Authorization", authorization);
					const response = await pending.expect(401).expect("Content-Type", /application\/problem\+json/);
					expect(response.body.type).to.equal("urn:bandai:pats:problem:authentication-required");
					expect(response.body.instance).to.equal(`/api/v1${endpoint.path}`);
					expect(response.headers["www-authenticate"]).to.equal("Bearer");
					expect(calls).to.deep.equal({ authenticate: 1, resolve: 0, assignments: 0, persistence: [] });
				});
			}
			it(`${mount}: ${endpoint.method} ${endpoint.path} denies a verified subject without the capability`, async () => {
				const { app, calls } = boundary(mount, endpoint.kind === "read" ? "qi" : "operator");
				const response = await request(app)[endpoint.method](`/api/v1${endpoint.path}`)
					.set("Authorization", "Bearer section-token")
					.expect(403).expect("Content-Type", /application\/problem\+json/);
				expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
				expect(calls.authenticate).to.be.greaterThan(0);
				expect(calls.resolve).to.equal(calls.authenticate);
				expect(calls.assignments).to.equal(calls.authenticate);
				expect(calls.persistence).to.deep.equal([]);
			});
		}

		if (mount !== "command-only") {
			it(`${mount}: allows an operator to read sections through identity and capability middleware`, async () => {
				const { app, calls } = boundary(mount, "operator");
				const response = await request(app).get("/api/v1/sections")
					.set("Authorization", "Bearer section-token").expect(200);
				expect(response.body.data).to.have.length(1);
				expect(response.body.data[0]).to.include({ id: "section-1", sectionCode: "SEC-01" });
			expect(calls.assignments).to.equal(1);
			expect(calls.persistence).to.deep.equal(["section", "section"]);
		});
		}
		if (mount !== "read-only") {
			it(`${mount}: allows an admin to reorder sections with the resolved audit actor`, async () => {
				const { app, calls } = boundary(mount, "admin");
				const response = await request(app).put("/api/v1/sections/order")
					.set("Authorization", "Bearer section-token")
					.set("Idempotency-Key", "section-order-auth")
					.send({ sectionIds: ["section-1"] }).expect(200);
				expect(response.body).to.deep.equal({ sectionIds: ["section-1"] });
				expect(calls.assignments).to.equal(mount === "combined" ? 2 : 1);
				expect(calls.persistence).to.include.members(["section.update", "auditRecord", "outboxMessage", "idempotencyRecord"]);
			});
		}
	}
});

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

	it("upserts a model allocation and materializes plan parts and the initial route snapshot", async () => {
		const idempotencyRecord = {
			findUnique: async () => null,
			create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-allocation", ...data }),
			update: async () => undefined,
			delete: async () => undefined,
		};
		const database = {
			idempotencyRecord,
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				findUnique: async () => ({ id: "plan-1", productId: "product-1", status: "DRAFT", rowVersion: 1 }),
				update: async () => ({ id: "plan-1", rowVersion: 2 }),
			},
			model: {
				findUnique: async () => ({ id: "model-1", productId: "product-1", modelParts: [{ id: "model-part-1", partCode: "PART-001", partName: "Main part", routingSteps: [{ stageId: "stage-1", subStageId: null }] }] }),
			},
			projectModelAllocation: {
				upsert: async () => ({ id: "allocation-1", modelId: "model-1", plannedQuantity: 100 }),
			},
			part: {
				findMany: async () => [],
				create: async () => ({ id: "part-1" }),
			},
			partsList: {
				findFirst: async () => null,
				create: async () => ({ id: "parts-list-1" }),
			},
			stage: { findMany: async () => [{ id: "stage-1" }] },
			subStage: { findMany: async () => [] },
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database);
		const response = await request(app)
			.post("/api/v1/production-plans/plan-1/model-allocations")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "allocation-1")
			.set("If-Match", '"1"')
			.send({ modelId: "model-1", plannedQuantity: 100 });

		expect(response.status).to.equal(200);
		expect(response.headers.etag).to.equal('"2"');
		expect(response.body).to.deep.include({ allocationId: "allocation-1", modelId: "model-1", partsListVersionId: "parts-list-1", planRowVersion: 2 });
	});

	it("creates a new draft route version and validates server-owned route identity", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-route", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				findUnique: async () => ({ id: "plan-1", status: "DRAFT", rowVersion: 1 }),
				update: async () => ({ id: "plan-1", rowVersion: 2 }),
			},
			part: { findMany: async () => [{ id: "part-1" }] },
			stage: { findMany: async () => [{ id: "stage-1" }] },
			subStage: { findMany: async () => [] },
			partsList: {
				findFirst: async () => ({ version: 1 }),
				create: async () => ({ id: "parts-list-2", version: 2 }),
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database);
		const response = await request(app)
			.post("/api/v1/production-plans/plan-1/parts-list-versions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "route-version-1")
			.set("If-Match", '"1"')
			.send({ steps: [{ partId: "part-1", stageId: "stage-1", stepOrder: 1 }] });

		expect(response.status).to.equal(201);
		expect(response.headers.etag).to.equal('"2"');
		expect(response.body).to.deep.include({ partsListVersionId: "parts-list-2", version: 2, planRowVersion: 2 });
	});

	it("fails command access closed without planning.manage", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/production-plans")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "plan-create-2")
			.send({ planCode: "PLAN-002", name: "Blocked", requiredProductionQuantity: 1 });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("deletes a draft project and logs audit event", async () => {
		let deletedId: string | undefined;
		let loggedEvent: string | undefined;
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idemp-del", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				findUnique: async () => ({ id: "proj-1", projectCode: "PRJ-B251-2609-01", name: "Draft run", status: "DRAFT", lots: [], rowVersion: 1 }),
				delete: async ({ where }: { where: { id: string } }) => {
					deletedId = where.id;
					return { id: where.id };
				},
			},
			partsList: { findMany: async () => [], deleteMany: async () => undefined },
			routingStep: { deleteMany: async () => undefined },
			part: { deleteMany: async () => undefined },
			projectModelAllocation: { deleteMany: async () => undefined },
			planDemandAllocation: { deleteMany: async () => undefined },
			materialRequirement: { deleteMany: async () => undefined },
			productSpecification: { deleteMany: async () => undefined },
			pmrs: { deleteMany: async () => undefined },
			workflowGroup: { deleteMany: async () => undefined },
			processChangeLog: { deleteMany: async () => undefined },
			auditRecord: {
				create: async ({ data }: { data: { action: string } }) => {
					loggedEvent = data.action;
				},
			},
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database);
		const response = await request(app)
			.delete("/api/v1/projects/proj-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "proj-delete-1");

		expect(response.status).to.equal(204);
		expect(deletedId).to.equal("proj-1");
		expect(loggedEvent).to.equal("PROJECT_DRAFT_DELETED");
	});

	it("rejects deletion of a released project with 409 conflict", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idemp-del-rel", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				findUnique: async () => ({ id: "proj-1", projectCode: "PRJ-B251-2609-01", name: "Released run", status: "RELEASED", lots: [], rowVersion: 2 }),
			},
		};
		const app = appFor(database);
		const response = await request(app)
			.delete("/api/v1/projects/proj-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "proj-delete-rel");

		expect(response.status).to.equal(409);
		expect(response.body.detail).to.include("Released or completed projects cannot be deleted");
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
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.post("/api/v1/stage-events")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "stage-event-1")
			.send({ batchId: "batch-1", stageId: "stage-1", eventType: "STAGE_SCAN_RECORDED" });

		expect(response.status).to.equal(201);
		expect(response.body).to.deep.equal({ stageEventId: "event-1", status: "ACCEPTED", routingViolationId: null });
	});

	it("keeps quality commands behind the quality resolver capability", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/quality-inspections")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "quality-1")
			.send({ batchId: "batch-1", stageId: "stage-1" });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("keeps monitoring daily-sheet encode behind daily-metrics.encode (operator denied without it)", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.put("/api/v1/monitoring/daily-sheets/sheet-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "monitoring-daily-1")
			.send({ payload: { date: "2026-08-28", processName: "Daily sheet" } });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("grants daily-sheet encode to a Line Leader (operator + daily-metrics.encode capability)", async () => {
		const storedRecord: Record<string, unknown> | null = null;
		const database = {
			idempotencyRecord: {
				findUnique: async () => storedRecord,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-daily", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			monitoringDailySheet: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "sheet-1", rowVersion: 1, ...data }),
				update: async () => undefined,
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [
			{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" },
			{ kind: "CAPABILITY", key: "daily-metrics.encode", status: "ACTIVE" },
		]);

		const response = await request(app)
			.put("/api/v1/monitoring/daily-sheets/sheet-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "monitoring-daily-2")
			.send({ payload: { date: "2026-08-28", processName: "Daily sheet" } });

		expect(response.status).to.equal(201);
		expect(response.headers.location).to.equal("/api/v1/monitoring/daily-sheets/sheet-1");
		expect(response.headers.etag).to.equal('"1"');
	});

	it("keeps operations structure commands behind operations.manage (operator denied)", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/stages")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "operations-1")
			.send({ name: "Blocked stage" });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("keeps inventory issue behind inventory.issue (read-only subject denied)", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "qi", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/inventory-transactions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "inventory-1")
			.send({ type: "ISSUE", partId: "part-1", quantity: 5 });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	const receivingBody = {
		transactionType: "RECEIVING",
		batchId: "batch-1",
		partId: "part-1",
		toStageId: "STG-INJECTION",
		expectedQuantity: 120,
		actualQuantity: 120,
	};

	const issuanceBody = {
		transactionType: "ISSUANCE",
		batchId: "batch-1",
		partId: "part-1",
		toStageId: "STG-INJECTION",
		expectedQuantity: 120,
		actualQuantity: 120,
	};

	function inventoryDatabase(): Record<string, unknown> {
		const database: Record<string, unknown> = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-itx", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			batch: {
				findUnique: async () => ({ id: "batch-1", lotId: "lot-1", lot: { projectId: "proj-1" } }),
			},
			part: { findFirst: async () => ({ id: "part-1" }) },
			materialRequirement: { findFirst: async () => null },
			inventoryTransaction: {
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "itx-1", rowVersion: 1, ...data }),
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		return database;
	}

	it("routes RECEIVING behind inventory.receive (operator granted, 201)", async () => {
		const app = appFor(inventoryDatabase(), [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/inventory-transactions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "inventory-receive-1")
			.send(receivingBody);

		expect(response.status).to.equal(201);
		expect(response.headers.location).to.equal("/api/v1/inventory-transactions/itx-1");
		expect(response.body.status).to.equal("ACCEPTED");
	});

	it("routes RECEIVING behind inventory.receive (read-only subject denied, 403)", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "qi", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/inventory-transactions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "inventory-receive-2")
			.send(receivingBody);

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("routes ISSUANCE behind inventory.issue (inventory.issue holder granted, 201)", async () => {
		const app = appFor(inventoryDatabase(), [{ kind: "CAPABILITY", key: "inventory.issue", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/inventory-transactions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "inventory-issue-1")
			.send(issuanceBody);

		expect(response.status).to.equal(201);
		expect(response.headers.location).to.equal("/api/v1/inventory-transactions/itx-1");
	});

	it("keeps ISSUANCE behind inventory.issue even for inventory.receive holders", async () => {
		// Direct CAPABILITY grant of inventory.receive only — no role bundle.
		const app = appFor({}, [{ kind: "CAPABILITY", key: "inventory.receive", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/inventory-transactions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "inventory-receive-3")
			.send(issuanceBody);

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("replaces station processes and reassigns booth work processes", async () => {
		let clearedBooths: Record<string, unknown>[] = [];
		let assignedBooth: Record<string, unknown> | null = null;
		const ownershipWrites: Array<{ where: unknown; data: unknown }> = [];
		const orderWrites: Array<{ where: unknown; data: unknown }> = [];
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-station-proc", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			section: {
				findUnique: async () => ({ id: "station-1", name: "Station 1" }),
			},
			workProcess: {
				findMany: async () => [{ id: "proc-1", name: "Process 1" }, { id: "proc-2", name: "Process 2" }],
				updateMany: async ({ where, data }: { where: unknown; data: unknown }) => { ownershipWrites.push({ where, data }); return { count: 1 }; },
				update: async ({ where, data }: { where: unknown; data: unknown }) => { orderWrites.push({ where, data }); return { id: "proc-1", ...(data as Record<string, unknown>) }; },
			},
			booth: {
				updateMany: async ({ data }: { data: Record<string, unknown> }) => { clearedBooths.push(data); return { count: 1 }; },
				findFirst: async () => ({ id: "booth-1", stationId: "station-1", workProcessId: null }),
				update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { assignedBooth = { ...where, ...data }; return { id: "booth-1", ...data }; },
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }, { kind: "CAPABILITY", key: "operations.manage", status: "ACTIVE" }]);
		const response = await request(app)
			.put("/api/v1/sections/station-1/processes")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "station-proc-1")
			.send({ processIds: ["proc-1"] });

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({ sectionId: "station-1", processIds: ["proc-1"] });
		expect(clearedBooths[0]).to.deep.equal({ workProcessId: null });
		expect(assignedBooth).to.include({ id: "booth-1", workProcessId: "proc-1" });
		// Board membership truth: listed processes are claimed, previously
		// owned-but-unlisted ones are released, other owners untouched.
		expect(ownershipWrites).to.deep.equal([
			{ where: { id: { in: ["proc-1"] } }, data: { sectionId: "station-1" } },
			{ where: { id: { notIn: ["proc-1"] }, sectionId: "station-1" }, data: { sectionId: null } },
		]);
		// Board order truth: listed processes take their board position as displayOrder.
		expect(orderWrites).to.deep.equal([
			{ where: { id: "proc-1" }, data: { displayOrder: 0 } },
		]);
	});

	it("creates a section from a bare name with server defaults", async () => {
		let createdData: Record<string, unknown> | null = null;
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-section-create", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			stage: {
				findFirst: async () => ({ id: "stage-injection" }),
			},
			subStage: {
				findMany: async () => [{ id: "sub-1" }],
			},
			stationStep: {
				createMany: async () => ({ count: 1 }),
			},
			section: {
				findUnique: async () => null,
				count: async () => 4,
				create: async ({ data }: { data: Record<string, unknown> }) => { createdData = data; return { id: "section-9", ...data }; },
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }, { kind: "CAPABILITY", key: "operations.manage", status: "ACTIVE" }]);
		// The board's create flow sends a bare name: stage, code, and order
		// are server defaults. This is the contract the app relies on.
		const response = await request(app)
			.post("/api/v1/sections")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "section-create-minimal")
			.send({ name: "Pad Print" });

		expect(response.status).to.equal(201);
		expect(response.body).to.deep.equal({ sectionId: "section-9", sectionCode: "SEC-PAD-PRINT", name: "Pad Print" });
		expect(createdData).to.include({
			name: "Pad Print",
			sectionCode: "SEC-PAD-PRINT",
			stageId: "stage-injection",
			displayOrder: 4,
			screenType: "COMPUTER",
			scannerAttached: true,
			printerAttached: true,
		});
		expect(response.headers["location"]).to.equal("/api/v1/sections/section-9");
	});

	it("rejects a duplicate section code with 409 conflict", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-section-dup", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			stage: {
				findUnique: async () => ({ id: "stage-1" }),
			},
			section: {
				findUnique: async () => ({ id: "section-1", sectionCode: "SEC-DUP" }),
				count: async () => 1,
				create: async () => { throw new Error("must not create on conflict"); },
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }, { kind: "CAPABILITY", key: "operations.manage", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/sections")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "section-create-dup")
			.send({ name: "Other", sectionCode: "SEC-DUP", stageId: "stage-1", displayOrder: 0 });

		expect(response.status).to.equal(409);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:conflict");
	});

	it("fails station processes replace when station is not found", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-station-missing", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			section: { findUnique: async () => null },
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }, { kind: "CAPABILITY", key: "operations.manage", status: "ACTIVE" }]);
		const response = await request(app)
			.put("/api/v1/sections/missing-station/processes")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "station-proc-missing")
			.send({ processIds: ["proc-1"] });

		expect(response.status).to.equal(404);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-found");
	});

	it("keeps station processes replace behind operations.manage (operator denied)", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.put("/api/v1/sections/station-1/processes")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "station-proc-denied")
			.send({ processIds: ["proc-1"] });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("reorders stations by updating displayOrder", async () => {
		let updatedStations: { id: string; displayOrder: number }[] = [];
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-order", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			section: {
				findMany: async () => [
					{ id: "station-1", name: "Station 1" },
					{ id: "station-2", name: "Station 2" },
				],
				update: async ({ where, data }: { where: { id: string }; data: { displayOrder: number } }) => {
					updatedStations.push({ id: where.id, ...data });
					return { id: where.id, ...data };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }, { kind: "CAPABILITY", key: "operations.manage", status: "ACTIVE" }]);
		const response = await request(app)
			.put("/api/v1/sections/order")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "station-order-1")
			.send({ sectionIds: ["station-2", "station-1"] });

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({ sectionIds: ["station-2", "station-1"] });
		expect(updatedStations).to.deep.equal([
			{ id: "station-2", displayOrder: 0 },
			{ id: "station-1", displayOrder: 1 },
		]);
	});

	it("fails station order when a station is not found", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-order-missing", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			section: {
				findMany: async () => [{ id: "station-1", name: "Station 1" }],
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }, { kind: "CAPABILITY", key: "operations.manage", status: "ACTIVE" }]);
		const response = await request(app)
			.put("/api/v1/sections/order")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "station-order-missing")
			.send({ sectionIds: ["station-1", "station-missing"] });

		expect(response.status).to.equal(404);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-found");
	});

	it("keeps station order behind operations.manage (operator denied)", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.put("/api/v1/sections/order")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "station-order-denied")
			.send({ sectionIds: ["station-1"] });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("creates a batch with idempotency and audit evidence", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-batch", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			lot: { findUnique: async () => ({ id: "lot-1", projectId: "proj-1" }) },
			part: { findMany: async () => [] },
			batch: {
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "batch-1", rowVersion: 1, batchCode: data.batchCode, ...data }),
			},
			batchPositionProjection: { create: async () => undefined },
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/batches")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "batch-create-1")
			.send({ batchCode: "B-1001", barcodeValue: "BAR-1001", lotId: "lot-1", plannedQuantity: 100, labelPackSize: 10, currentStageId: "stage-1" });

		expect(response.status).to.equal(201);
		expect(response.body).to.include({ batchId: "batch-1", batchCode: "B-1001" });
		expect(response.headers.location).to.equal("/api/v1/batches/batch-1");
		expect(response.headers.etag).to.equal('"1"');
	});

	it("activates PLANNED batches when the production plan is released", async () => {
		const batchUpdates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async () => ({ id: "idempotency-release" }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				findUnique: async () => ({
					id: "proj-1",
					status: "READY",
					rowVersion: 1,
					releasedBySubjectId: null,
					releasedAt: null,
				}),
				update: async ({ data }: { data: Record<string, unknown> }) => ({
					id: "proj-1",
					projectCode: "PRJ-B251-2609-01",
					name: "July run",
					status: "RELEASED",
					requiredProductionQuantity: 100,
					productId: null,
					rowVersion: 2,
					...data,
				}),
			},
			lot: {
				findMany: async () => [],
			},
			batch: {
				updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
					batchUpdates.push({ where, data });
					return { count: 2 };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/production-plans/proj-1/release")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "plan-release-1")
			.set("If-Match", '"1"');

		expect(response.status).to.equal(200);
		expect(response.body).to.include({ planId: "proj-1", status: "RELEASED" });
		expect(batchUpdates).to.have.lengthOf(1);
		expect(batchUpdates[0].data).to.deep.equal({ status: "ACTIVE" });
		expect(batchUpdates[0].where).to.deep.equal({
			lot: { projectId: "proj-1" },
			status: "PLANNED",
		});
	});

	it("mints missing tray batches on release so the floor queue is non-empty", async () => {
		const createdBatches: Array<Record<string, unknown>> = [];
		const createdParts: Array<Record<string, unknown>> = [];
		const createdPositions: Array<Record<string, unknown>> = [];
		const batchUpdates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
		let nextBatchSeq = 0;
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async () => ({ id: "idempotency-release-mint" }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			project: {
				findUnique: async () => ({
					id: "proj-1",
					status: "READY",
					rowVersion: 1,
					releasedBySubjectId: null,
					releasedAt: null,
				}),
				update: async ({ data }: { data: Record<string, unknown> }) => ({
					id: "proj-1",
					projectCode: "PRJ-B251-2609-01",
					name: "July run",
					status: "RELEASED",
					requiredProductionQuantity: 480,
					productId: null,
					rowVersion: 2,
					...data,
				}),
			},
			lot: {
				findMany: async () => [
					{
						id: "lot-1",
						lotCode: "MLT-001",
						requiredProductionQuantity: 480,
						labelPackSize: 240,
						partId: "part-1",
						batches: [],
					},
				],
			},
			batch: {
				create: async ({ data }: { data: Record<string, unknown> }) => {
					nextBatchSeq += 1;
					const row = { id: `batch-mint-${nextBatchSeq}`, ...data };
					createdBatches.push(row);
					return { id: row.id };
				},
				updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
					batchUpdates.push({ where, data });
					return { count: createdBatches.length };
				},
			},
			batchPartLine: {
				create: async ({ data }: { data: Record<string, unknown> }) => {
					createdParts.push(data);
					return data;
				},
			},
			batchPositionProjection: {
				create: async ({ data }: { data: Record<string, unknown> }) => {
					createdPositions.push(data);
					return data;
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/production-plans/proj-1/release")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "plan-release-mint")
			.set("If-Match", '"1"');

		expect(response.status).to.equal(200);
		expect(response.body).to.include({ planId: "proj-1", status: "RELEASED" });
		expect(createdBatches).to.have.lengthOf(2);
		expect(createdBatches[0]).to.include({
			batchCode: "MLT-001-B001",
			barcodeValue: "MLT-001-B001",
			lotId: "lot-1",
			plannedQuantity: 240,
			labelPackSize: 240,
			currentStageId: "STG-PROJECTS",
			status: "PLANNED",
			lineId: null,
		});
		expect(createdBatches[1]).to.include({
			batchCode: "MLT-001-B002",
			plannedQuantity: 240,
		});
		expect(createdParts).to.have.lengthOf(2);
		expect(createdParts[0]).to.deep.include({ partId: "part-1", quantity: 240 });
		expect(createdPositions).to.have.lengthOf(2);
		expect(createdPositions[0]).to.deep.include({
			stageId: "STG-PROJECTS",
			quantityMagnitude: "240",
			quantityUom: "EA",
		});
		expect(batchUpdates).to.have.lengthOf(1);
		expect(batchUpdates[0].data).to.deep.equal({ status: "ACTIVE" });
	});

	it("creates a sub-stage", async () => {
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-sub", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			subStage: {
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "substage-1", rowVersion: 1, name: data.name, displayOrder: data.displayOrder, ...data }),
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/sub-stages")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "substage-create-1")
			.send({ name: "New SubStage", displayOrder: 0 });

		expect(response.status).to.equal(201);
		expect(response.body).to.include({ subStageId: "substage-1", name: "New SubStage" });
	});
});

describe("plan part cycle-time override (REQ-CT-1 S3)", () => {
	function partApp(partRow: Record<string, unknown>, planStatus = "DRAFT") {
		let stored = { ...partRow };
		const database = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async () => ({ id: "idempotency-part-ct" }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
			part: {
				findUnique: async () => ({ ...stored }),
				update: async ({ data }: { data: Record<string, unknown> }) => {
					stored = { ...stored, ...data, rowVersion: 2 };
					return stored;
				},
			},
			project: {
				findUnique: async () => ({ id: "plan-1", status: planStatus }),
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		return appFor(database);
	}

	const basePart = { id: "part-1", projectId: "plan-1", plannedCycleTimes: { "STG-INJECTION::": 30 }, plannedCycleTimesOverride: null, rowVersion: 1 };

	it("sets the finalization override with If-Match and bumps the version", async () => {
		const app = partApp(basePart);
		const response = await request(app)
			.patch("/api/v1/projects/plan-1/parts/part-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "part-ct-set-1")
			.set("If-Match", '"1"')
			.send({ plannedCycleTimesOverride: { "STG-INJECTION::": 25 } });

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.include({ partId: "part-1" });
		expect(response.body.plannedCycleTimes).to.deep.equal({ "STG-INJECTION::": 30 });
		expect(response.body.plannedCycleTimesOverride).to.deep.equal({ "STG-INJECTION::": 25 });
		expect(response.headers.etag).to.equal('"2"');
	});

	it("clears the override back to null (master fallback)", async () => {
		const app = partApp({ ...basePart, plannedCycleTimesOverride: { "STG-INJECTION::": 25 } });
		const response = await request(app)
			.patch("/api/v1/projects/plan-1/parts/part-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "part-ct-clear-1")
			.set("If-Match", '"1"')
			.send({ plannedCycleTimesOverride: null });

		expect(response.status).to.equal(200);
		expect(response.body.plannedCycleTimesOverride).to.equal(null);
	});

	it("refuses overrides on released plans", async () => {
		const app = partApp(basePart, "RELEASED");
		const response = await request(app)
			.patch("/api/v1/projects/plan-1/parts/part-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "part-ct-released-1")
			.set("If-Match", '"1"')
			.send({ plannedCycleTimesOverride: { "STG-INJECTION::": 25 } });

		expect(response.status).to.equal(409);
	});

	it("rejects stale versions and invalid values", async () => {
		const app = partApp(basePart);
		const stale = await request(app)
			.patch("/api/v1/projects/plan-1/parts/part-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "part-ct-stale-1")
			.set("If-Match", '"9"')
			.send({ plannedCycleTimesOverride: { "STG-INJECTION::": 25 } });
		expect(stale.status).to.equal(412);

		for (const [key, bad] of [["zero", 0], ["negative", -3], ["fraction", 7.5]] as const) {
			const response = await request(app)
				.patch("/api/v1/projects/plan-1/parts/part-1")
				.set("Authorization", "Bearer command-token")
				.set("Idempotency-Key", `part-ct-bad-${key}`)
				.set("If-Match", '"1"')
				.send({ plannedCycleTimesOverride: { "STG-INJECTION::": bad } });
			expect(response.status).to.equal(422);
		}
	});
});
