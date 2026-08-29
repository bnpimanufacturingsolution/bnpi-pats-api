import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import { domainReadRouter } from "../app/pats/domain-read";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

const qualityAssignments: SubjectAssignmentRecord[] = [
	{ kind: "ROLE_BUNDLE", key: "qi", status: "ACTIVE" },
];

function identity(assignments: SubjectAssignmentRecord[]): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({ provider: "local", issuer: "pats-local", providerSubject: "command-user" }),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-command",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "command-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

function commandApp(database: Record<string, unknown>, assignments = qualityAssignments) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function readApp(database: Record<string, unknown>, assignments = qualityAssignments) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainReads: { router: domainReadRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function idempotentDatabase(extra: Record<string, unknown>) {
	return {
		idempotencyRecord: {
			findUnique: async () => null,
			create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-q", ...data }),
			update: async () => undefined,
			delete: async () => undefined,
		},
		$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work({
			...idempotentDatabase(extra),
			...extra,
		}),
		...extra,
	};
}

describe("Journey D quality stage allow-list", () => {
	it("creates an inspection when the gate stage is assigned", async () => {
		let created = 0;
		const database = idempotentDatabase({
			qualityStageAssignment: {
				findMany: async () => [{ stageId: "stage-decoration" }],
			},
			batch: { findUnique: async () => ({ id: "batch-1" }) },
			qualityInspection: {
				create: async () => {
					created += 1;
					return { id: "inspection-1", status: "OPEN", rowVersion: 1, batchId: "batch-1", stageId: "stage-decoration" };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		});
		const app = commandApp(database);

		const response = await request(app)
			.post("/api/v1/quality-inspections")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-create-allowed")
			.send({ batchId: "batch-1", stageId: "stage-decoration" });

		expect(response.status).to.equal(201);
		expect(created).to.equal(1);
		expect(response.body.qualityInspectionId).to.equal("inspection-1");
	});

	it("rejects create when the gate stage is not assigned", async () => {
		let created = 0;
		const database = idempotentDatabase({
			qualityStageAssignment: {
				findMany: async () => [{ stageId: "stage-decoration" }],
			},
			batch: { findUnique: async () => ({ id: "batch-1" }) },
			qualityInspection: {
				create: async () => {
					created += 1;
					return { id: "inspection-1", status: "OPEN", rowVersion: 1 };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		});
		const app = commandApp(database);

		const response = await request(app)
			.post("/api/v1/quality-inspections")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-create-denied")
			.send({ batchId: "batch-1", stageId: "stage-assembly" });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-allowed-stage");
		expect(created).to.equal(0);
	});

	it("fail-closes create when quality.resolve has no stage rows", async () => {
		let created = 0;
		const database = idempotentDatabase({
			qualityStageAssignment: { findMany: async () => [] },
			batch: { findUnique: async () => ({ id: "batch-1" }) },
			qualityInspection: {
				create: async () => {
					created += 1;
					return { id: "inspection-1", status: "OPEN", rowVersion: 1 };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		});
		const app = commandApp(database);

		const response = await request(app)
			.post("/api/v1/quality-inspections")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-create-closed")
			.send({ batchId: "batch-1", stageId: "stage-decoration" });

		expect(response.status).to.equal(403);
		expect(created).to.equal(0);
	});

	it("records a decision when the inspection stage is assigned", async () => {
		let decided = 0;
		const database = idempotentDatabase({
			qualityStageAssignment: {
				findMany: async () => [{ stageId: "stage-decoration" }],
			},
			qualityInspection: {
				findUnique: async () => ({
					id: "inspection-1",
					stageId: "stage-decoration",
					status: "OPEN",
					rowVersion: 1,
				}),
				update: async () => ({ id: "inspection-1", status: "COMPLETED", rowVersion: 2 }),
			},
			qualityDecision: {
				create: async () => {
					decided += 1;
					return { id: "decision-1", decision: "PASSED" };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		});
		const app = commandApp(database);

		const response = await request(app)
			.post("/api/v1/quality-inspections/inspection-1/decisions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-decide-allowed")
			.set("If-Match", '"1"')
			.send({ decision: "PASSED" });

		expect(response.status).to.equal(201);
		expect(decided).to.equal(1);
		expect(response.body.decision).to.equal("PASSED");
	});

	it("rejects decide when the inspection stage is not assigned", async () => {
		let decided = 0;
		const database = idempotentDatabase({
			qualityStageAssignment: {
				findMany: async () => [{ stageId: "stage-decoration" }],
			},
			qualityInspection: {
				findUnique: async () => ({
					id: "inspection-1",
					stageId: "stage-assembly",
					status: "OPEN",
					rowVersion: 1,
				}),
				update: async () => ({ id: "inspection-1", status: "COMPLETED", rowVersion: 2 }),
			},
			qualityDecision: {
				create: async () => {
					decided += 1;
					return { id: "decision-1", decision: "PASSED" };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		});
		const app = commandApp(database);

		const response = await request(app)
			.post("/api/v1/quality-inspections/inspection-1/decisions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-decide-denied")
			.set("If-Match", '"1"')
			.send({ decision: "PASSED" });

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-allowed-stage");
		expect(decided).to.equal(0);
	});

	it("lists only inspections in the subject's allowed stages", async () => {
		let listWhere: Record<string, unknown> | undefined;
		const app = readApp({
			qualityStageAssignment: {
				findMany: async () => [{ stageId: "stage-decoration" }],
			},
			qualityInspection: {
				findMany: async (args: { where?: Record<string, unknown> }) => {
					listWhere = args.where;
					return [];
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/quality-inspections")
			.set("Authorization", "Bearer read-token");

		expect(response.status).to.equal(200);
		expect(listWhere).to.deep.equal({ stageId: { in: ["stage-decoration"] } });
	});

	it("resolves a scanned batch code and creates an open inspection", async () => {
		let created = 0;
		const app = readApp({
			qualityStageAssignment: {
				findMany: async () => [{ stageId: "stage-decoration" }],
			},
			batch: {
				findFirst: async () => ({
					id: "batch-1",
					batchCode: "B-1001",
					barcodeValue: "B-1001-QR",
					plannedQuantity: 50,
					currentStageId: "stage-decoration",
					positionProjection: { stageId: "stage-decoration", subStageId: null },
					lot: {
						id: "lot-1",
						lotCode: "LOT-01",
						partName: "Body",
						project: { product: { productName: "Fruits" } },
					},
					projectModelAllocation: { model: { modelName: "M03", modelNumber: "M03" } },
					parts: [{ partId: "part-1", quantity: 50, part: { partName: "Body", partCode: "P-BODY" } }],
					qualityInspections: [],
				}),
			},
			qualityInspection: {
				create: async () => {
					created += 1;
					return { id: "inspection-new", status: "OPEN", rowVersion: 1 };
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/quality-inspections/resolve")
			.query({ code: "B-1001-QR" })
			.set("Authorization", "Bearer read-token");

		expect(response.status).to.equal(200);
		expect(created).to.equal(1);
		expect(response.body).to.include({
			batchCode: "B-1001",
			gateStageId: "stage-decoration",
			inspectionId: "inspection-new",
			canDecide: true,
			created: true,
		});
	});

	it("requires quality.resolve for scan resolve", async () => {
		const app = readApp({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.get("/api/v1/quality-inspections/resolve")
			.query({ code: "B-1001-QR" })
			.set("Authorization", "Bearer read-token");
		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("returns not-found when the scanned code matches no batch", async () => {
		const app = readApp({
			qualityStageAssignment: { findMany: async () => [{ stageId: "stage-decoration" }] },
			batch: { findFirst: async () => null },
		});

		const response = await request(app)
			.get("/api/v1/quality-inspections/resolve")
			.query({ code: "MISSING" })
			.set("Authorization", "Bearer read-token");

		expect(response.status).to.equal(404);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-found");
	});

	it("returns an empty list when the subject has no stage rows", async () => {
		let listed = 0;
		const app = readApp({
			qualityStageAssignment: { findMany: async () => [] },
			qualityInspection: {
				findMany: async () => {
					listed += 1;
					return [{ id: "should-not-load" }];
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/quality-inspections")
			.set("Authorization", "Bearer read-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.deep.equal([]);
		expect(listed).to.equal(0);
	});

	it("requires quality.read for the inspection list", async () => {
		const app = readApp({}, [{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }]);
		const response = await request(app)
			.get("/api/v1/quality-inspections")
			.set("Authorization", "Bearer read-token");
		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("requires quality.resolve for decide", async () => {
		const app = commandApp({}, [{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }]);
		const response = await request(app)
			.post("/api/v1/quality-inspections/inspection-1/decisions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-decide-planner")
			.set("If-Match", '"1"')
			.send({ decision: "PASSED" });
		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("lets quality.read list but not resolve or decide", async () => {
		const readOnly: SubjectAssignmentRecord[] = [{ kind: "CAPABILITY", key: "quality.read", status: "ACTIVE" }];
		const listApp = readApp(
			{
				qualityStageAssignment: { findMany: async () => [{ stageId: "stage-decoration" }] },
				qualityInspection: { findMany: async () => [] },
			},
			readOnly,
		);
		const list = await request(listApp)
			.get("/api/v1/quality-inspections")
			.set("Authorization", "Bearer read-token");
		expect(list.status).to.equal(200);

		const resolveApp = readApp({}, readOnly);
		const resolve = await request(resolveApp)
			.get("/api/v1/quality-inspections/resolve")
			.query({ code: "B-1001-QR" })
			.set("Authorization", "Bearer read-token");
		expect(resolve.status).to.equal(403);

		const decideApp = commandApp({}, readOnly);
		const decide = await request(decideApp)
			.post("/api/v1/quality-inspections/inspection-1/decisions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-decide-read-only")
			.set("If-Match", '"1"')
			.send({ decision: "PASSED" });
		expect(decide.status).to.equal(403);
	});

	it("lets admin list and decide inside assigned stages", async () => {
		const adminAssignments: SubjectAssignmentRecord[] = [
			{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" },
		];
		const listApp = readApp(
			{
				qualityStageAssignment: { findMany: async () => [{ stageId: "stage-decoration" }] },
				qualityInspection: { findMany: async () => [] },
			},
			adminAssignments,
		);
		const list = await request(listApp)
			.get("/api/v1/quality-inspections")
			.set("Authorization", "Bearer read-token");
		expect(list.status).to.equal(200);

		let decided = 0;
		const decideApp = commandApp(
			idempotentDatabase({
				qualityStageAssignment: { findMany: async () => [{ stageId: "stage-decoration" }] },
				qualityInspection: {
					findUnique: async () => ({
						id: "inspection-1",
						stageId: "stage-decoration",
						status: "OPEN",
						rowVersion: 1,
					}),
					update: async () => ({ id: "inspection-1", status: "COMPLETED", rowVersion: 2 }),
				},
				qualityDecision: {
					create: async () => {
						decided += 1;
						return { id: "decision-1", decision: "PASSED" };
					},
				},
				auditRecord: { create: async () => undefined },
				outboxMessage: { create: async () => undefined },
			}),
			adminAssignments,
		);
		const decide = await request(decideApp)
			.post("/api/v1/quality-inspections/inspection-1/decisions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-decide-admin")
			.set("If-Match", '"1"')
			.send({ decision: "PASSED" });
		expect(decide.status).to.equal(201);
		expect(decided).to.equal(1);
	});

	it("fail-closes resolve when quality.resolve has no stage rows", async () => {
		const app = readApp({
			qualityStageAssignment: { findMany: async () => [] },
			batch: {
				findFirst: async () => ({
					id: "batch-1",
					batchCode: "B-1001",
					barcodeValue: "B-1001-QR",
					plannedQuantity: 50,
					currentStageId: "stage-decoration",
					positionProjection: { stageId: "stage-decoration", subStageId: null },
					lot: {
						id: "lot-1",
						lotCode: "LOT-01",
						partName: "Body",
						project: { product: { productName: "Fruits" } },
					},
					projectModelAllocation: { model: { modelName: "M03", modelNumber: "M03" } },
					parts: [{ partId: "part-1", quantity: 50, part: { partName: "Body", partCode: "P-BODY" } }],
					qualityInspections: [],
				}),
			},
			qualityInspection: { create: async () => ({ id: "should-not-create", status: "OPEN", rowVersion: 1 }) },
		});
		const response = await request(app)
			.get("/api/v1/quality-inspections/resolve")
			.query({ code: "B-1001-QR" })
			.set("Authorization", "Bearer read-token");
		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-allowed-stage");
	});

	it("fail-closes decide when quality.resolve has no stage rows", async () => {
		let decided = 0;
		const database = idempotentDatabase({
			qualityStageAssignment: { findMany: async () => [] },
			qualityInspection: {
				findUnique: async () => ({
					id: "inspection-1",
					stageId: "stage-decoration",
					status: "OPEN",
					rowVersion: 1,
				}),
				update: async () => ({ id: "inspection-1", status: "COMPLETED", rowVersion: 2 }),
			},
			qualityDecision: {
				create: async () => {
					decided += 1;
					return { id: "decision-1", decision: "PASSED" };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		});
		const app = commandApp(database);
		const response = await request(app)
			.post("/api/v1/quality-inspections/inspection-1/decisions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "qc-decide-closed")
			.set("If-Match", '"1"')
			.send({ decision: "PASSED" });
		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:not-allowed-stage");
		expect(decided).to.equal(0);
	});
});
