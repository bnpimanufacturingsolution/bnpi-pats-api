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

	it("preserves lot execution bindings in production-plan detail reads", async () => {
		const app = appFor({
			project: {
				findUnique: async () => ({
					id: "plan-1",
					projectCode: "PLAN-001",
					name: "July production",
					status: "DRAFT",
					requiredProductionQuantity: 100,
					rowVersion: 2,
					createdAt: new Date("2026-07-01T00:00:00.000Z"),
					releasedAt: null,
					product: null,
					productSpecification: null,
					modelAllocations: [],
					demandAllocations: [],
					materialRequirements: [],
					parts: [{ id: "part-1", partCode: "PART-001", partName: "Main part" }],
					partsLists: [{ id: "route-1", version: 3, status: "PUBLISHED", publishedAt: new Date("2026-07-02T00:00:00.000Z"), steps: [{ id: "route-step-1", partId: "part-1", part: { partCode: "PART-001", partName: "Main part" }, stageId: "stage-1", subStageId: null, stepOrder: 1 }] }],
					pmrs: [],
					lots: [{
						id: "lot-1",
						lotCode: "LOT-001",
						lotName: "July lot",
						partsListId: "route-1",
						partsListVersion: 3,
						status: "PLANNED",
						requiredProductionQuantity: 100,
						labelPackSize: 10,
						quantityMagnitude: "100",
						quantityUom: "EA",
						partAllocations: [{ lotPartAllocationId: "allocation-1", partId: "part-1", part: { partCode: "PART-001" }, quantityMagnitude: "100", quantityUom: "EA" }],
						batches: [],
					}],
				}),
			},
		});

		const response = await request(app)
			.get("/api/v1/production-plans/plan-1")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.headers.etag).to.equal('"2"');
		expect(response.headers["cache-control"]).to.equal("no-store");
		expect(response.body.lots[0]).to.include({
			lotId: "lot-1",
			partsListId: "route-1",
			partsListVersion: 3,
			requiredProductionQuantity: 100,
			labelPackSize: 10,
		});
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
		const filteredApp = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

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
		const configuredApp = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(configuredApp)
			.get("/api/v1/stages")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.deep.equal([{ id: "stage-1", name: "Injection", workflowGroup: { id: "group-1", name: "Factory" }, subStageLinks: [] }]);
	});

	it("returns quality inspections with server-owned batch and part evidence", async () => {
		const startedAt = new Date("2026-07-31T00:00:00.000Z");
		const app = appFor(
			{
				qualityStageAssignment: {
					findMany: async () => [{ stageId: "stage-assembly" }],
				},
				qualityInspection: {
					findMany: async () => [
						{
							id: "inspection-1",
							batchId: "batch-1",
							stageId: "stage-assembly",
							subStageId: null,
							stationId: "station-qc",
							inspectedQuantity: "25",
							quantityUom: "PCS",
							status: "OPEN",
							evidence: null,
							startedAt,
							completedAt: null,
							rowVersion: 1,
							createdAt: startedAt,
							updatedAt: startedAt,
							decisions: [],
							batch: {
								id: "batch-1",
								batchCode: "B-1001",
								lotId: "lot-1",
								plannedQuantity: 30,
								parts: [{
									partId: "part-1",
									quantity: 30,
									quantityMagnitude: "30",
									quantityUom: "PCS",
									part: { id: "part-1", partCode: "PART-1", partName: "Casing Upper" },
								}],
							},
						},
					],
				},
			},
			[{ kind: "ROLE_BUNDLE", key: "qi", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/quality-inspections")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.data[0]).to.include({ id: "inspection-1", status: "OPEN" });
		expect(response.body.data[0].batch.parts[0].part.partName).to.equal("Casing Upper");
	});

	it("returns a server-owned station snapshot with batch identity and route steps", async () => {
		const app = appFor({
			batchPositionProjection: {
				findMany: async () => [{
					batchId: "batch-1",
					stageId: "stage-injection",
					subStageId: null,
					routeStepId: "route-step-1",
					positionStatus: "ACCEPTED",
					quantityMagnitude: "12",
					quantityUom: "EA",
					projectionVersion: 3,
					updatedAt: new Date("2026-07-31T01:00:00.000Z"),
					batch: {
						id: "batch-1",
						batchCode: "BATCH-001",
						barcodeValue: "BATCH-001-QR",
						lotId: "lot-1",
						plannedQuantity: 12,
						labelPackSize: 12,
						status: "ACTIVE",
						rowVersion: 2,
						createdAt: new Date("2026-07-30T01:00:00.000Z"),
						lot: {
							id: "lot-1",
							lotCode: "LOT-001",
							lotName: "July lot",
							projectId: "project-1",
							partsListId: "parts-list-1",
						},
						parts: [{
							partId: "part-1",
							quantity: 12,
							quantityMagnitude: "12",
							quantityUom: "EA",
							part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
						}],
					},
				}],
			},
			routingStep: {
				findMany: async () => [{
					id: "route-step-1",
					partsListId: "parts-list-1",
					partId: "part-1",
					stageId: "stage-injection",
					subStageId: null,
					stepOrder: 1,
					part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
				}],
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/batch-positions")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.deep.equal([{
			batchId: "batch-1",
			stageId: "stage-injection",
			subStageId: null,
			routeStepId: "route-step-1",
			positionStatus: "ACCEPTED",
			quantityMagnitude: "12",
			quantityUom: "EA",
			projectionVersion: 3,
			updatedAt: "2026-07-31T01:00:00.000Z",
			batch: {
				id: "batch-1",
				batchCode: "BATCH-001",
				barcodeValue: "BATCH-001-QR",
				lotId: "lot-1",
				plannedQuantity: 12,
				labelPackSize: 12,
				status: "ACTIVE",
				rowVersion: 2,
				createdAt: "2026-07-30T01:00:00.000Z",
				lot: {
					id: "lot-1",
					lotCode: "LOT-001",
					lotName: "July lot",
					projectId: "project-1",
					partsListId: "parts-list-1",
				},
				parts: [{
					partId: "part-1",
					quantity: 12,
					quantityMagnitude: "12",
					quantityUom: "EA",
					part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
				}],
			},
			routeSteps: [{
				routeStepId: "route-step-1",
				partId: "part-1",
				part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
				stageId: "stage-injection",
				subStageId: null,
				stepOrder: 1,
			}],
		}]);
	});

	it("returns server-owned station history from execution evidence", async () => {
		const occurredAt = new Date("2026-07-31T02:00:00.000Z");
		const app = appFor({
			station: {
				findUnique: async () => ({
					id: "station-injection",
					stationCode: "ST-INJ-01",
					name: "Injection Station 01",
					stageId: "stage-injection",
					boundSteps: [{ stageId: "stage-injection", subStageId: null }],
				}),
			},
			stage: {
				findMany: async () => [{ id: "stage-injection", name: "Injection" }],
			},
			stageEvent: {
				findMany: async () => [{
					id: "event-1",
					occurredAt,
					batchId: "batch-1",
					stageId: "stage-injection",
					subStageId: null,
					eventType: "STAGE_COMPLETED",
					actor: "operator-id",
					isRoutingViolation: false,
					status: "ACCEPTED",
					actorSubject: { displayNameSnapshot: "Operator One" },
				}],
			},
			routingViolation: {
				findMany: async () => [{
					id: "violation-1",
					batchId: "batch-1",
					lotId: "lot-1",
					partId: "part-1",
					attemptedStageId: "stage-injection",
					attemptedSubStageId: null,
					detectedAt: occurredAt,
					resolved: false,
					status: "OPEN",
				}],
			},
			batch: {
				findMany: async () => [{ id: "batch-1", batchCode: "BATCH-001" }],
			},
			lot: {
				findMany: async () => [{ id: "lot-1", lotCode: "LOT-001" }],
			},
			part: {
				findMany: async () => [{ id: "part-1", partCode: "PART-001", partName: "Main part" }],
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/stations/station-injection/history")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.station).to.deep.include({ id: "station-injection", stationCode: "ST-INJ-01", stageId: "stage-injection" });
		expect(response.body.events[0]).to.deep.include({ batchId: "batch-1", batchCode: "BATCH-001", stepName: "Injection", actor: "Operator One" });
		expect(response.body.openViolations[0]).to.deep.include({ batchCode: "BATCH-001", lotCode: "LOT-001", partCode: "PART-001", partName: "Main part", resolved: false });
		expect(response.body.openViolations[0].attemptedStep).to.deep.equal({ stageId: "stage-injection", subStageId: null, stepName: "Injection" });
	});

	it("returns station support as hop inventory and today's first-success prints", async () => {
		const day = "2026-08-10";
		const inWindow = new Date("2026-08-10T12:00:00.000Z");
		let printWhere: Record<string, unknown> | undefined;
		let printSelect: Record<string, unknown> | undefined;
		let positionWhere: Record<string, unknown> | undefined;
		const app = appFor({
			station: {
				findUnique: async () => ({
					id: "station-deco-fs",
					stationCode: "ST-DECO-FS",
					name: "Full Spray PC",
					stageId: "stage-decoration",
					boundSteps: [{ stageId: "stage-decoration", subStageId: "sub-full-spray" }],
				}),
			},
			printJob: {
				findMany: async (args: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
					printWhere = args.where;
					if (args.where.occurredAt) {
						return [{ id: "pj-1", batchId: "batch-2", quantity: 80 }];
					}
					printSelect = args.select;
					return [{ batchId: "batch-2", quantity: 80 }];
				},
			},
			batchPositionProjection: {
				findMany: async (args: { where: Record<string, unknown> }) => {
					positionWhere = args.where;
					return [
						{
							stageId: "stage-decoration",
							subStageId: "sub-full-spray",
							quantityMagnitude: "100",
							batch: {
								id: "batch-1",
								batchCode: "BNI-2607-01",
								barcodeValue: "DEMO-BNI-2607-01",
								plannedQuantity: 200,
								status: "IN_PROGRESS",
								lot: {
									id: "lot-1",
									lotCode: "LOT-B251-01",
									requiredProductionQuantity: 4800,
									labelPackSize: 240,
								},
								parts: [{ part: { partName: "Ice L" } }],
							},
						},
						{
							stageId: "stage-decoration",
							subStageId: "sub-full-spray",
							quantityMagnitude: "80",
							batch: {
								id: "batch-2",
								batchCode: "BNI-2607-02",
								barcodeValue: "DEMO-BNI-2607-02",
								plannedQuantity: 80,
								status: "IN_PROGRESS",
								lot: {
									id: "lot-1",
									lotCode: "LOT-B251-01",
									requiredProductionQuantity: 4800,
									labelPackSize: 240,
								},
								parts: [{ part: { partName: "Takoyaki Shell" } }],
							},
						},
					];
				},
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/stations/station-deco-fs/support")
			.query({ date: day })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.stationId).to.equal("station-deco-fs");
		expect(response.body.date).to.equal(day);
		expect(response.body.todayOutput).to.deep.equal({
			quantity: 80,
			eventCount: 1,
			targetQuantity: null,
		});
		expect(response.body.materials).to.deep.equal([
			{
				batchId: "batch-1",
				barcodeValue: "DEMO-BNI-2607-01",
				partName: "Ice L",
				quantity: 100,
			},
		]);
		expect(response.body.lotPlans).to.deep.equal([
			{
				lotId: "lot-1",
				lotCode: "LOT-B251-01",
				requiredQuantity: 4800,
				batchSize: 240,
				plannedBatchCount: 20,
				completedBatchCount: 1,
				completedQuantity: 80,
			},
		]);
		expect(response.body.staff).to.equal(null);
		expect(response.body.expectedOutput).to.equal(null);
		expect(printWhere).to.include({ stationId: "station-deco-fs", sequence: 1 });
		expect(printSelect).to.deep.equal({ batchId: true, quantity: true });
		expect(printSelect).to.not.have.property("batch");
		expect(positionWhere).to.deep.equal({
			OR: [{ stageId: "stage-decoration", subStageId: "sub-full-spray" }],
		});
		expect(inWindow.toISOString().startsWith(day)).to.equal(true);
	});

	it("does not count reprint print jobs as today's output", async () => {
		const app = appFor({
			station: {
				findUnique: async () => ({
					id: "station-deco-fs",
					stationCode: "ST-DECO-FS",
					name: "Full Spray PC",
					stageId: "stage-decoration",
					boundSteps: [{ stageId: "stage-decoration", subStageId: "sub-full-spray" }],
				}),
			},
			printJob: {
				findMany: async (args: { where: Record<string, unknown> }) => {
					if (args.where.occurredAt) {
						return [];
					}
					return [{ batchId: "batch-1" }];
				},
			},
			batchPositionProjection: {
				findMany: async () => [],
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/stations/station-deco-fs/support")
			.query({ date: "2026-08-10" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.todayOutput).to.deep.equal({
			quantity: 0,
			eventCount: 0,
			targetQuantity: null,
		});
		expect(response.body.materials).to.deep.equal([]);
	});

	it("rejects invalid station support date query", async () => {
		const app = appFor({
			station: { findUnique: async () => null },
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/stations/station-x/support")
			.query({ date: "10-08-2026" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(400);
	});

	it("returns dashboard counts from active server batches and their lot ownership", async () => {
		const app = appFor({
			project: { count: async () => 4 },
			batch: {
				findMany: async () => [
					{ id: "batch-1", plannedQuantity: 40, lot: { id: "lot-1", projectId: "project-1", requiredProductionQuantity: 100, project: { name: "Plan 1", product: { productName: "Product 1" } } }, positionProjection: { stageId: "stage-1", quantityMagnitude: "40" } },
					{ id: "batch-2", plannedQuantity: 20, lot: { id: "lot-1", projectId: "project-1", requiredProductionQuantity: 100, project: { name: "Plan 1", product: { productName: "Product 1" } } }, positionProjection: { stageId: "stage-1", quantityMagnitude: "20" } },
					{ id: "batch-3", plannedQuantity: 30, lot: { id: "lot-2", projectId: "project-2", requiredProductionQuantity: 60, project: { name: "Plan 2", product: null } }, positionProjection: { stageId: "stage-2", quantityMagnitude: "30" } },
				],
			},
			stage: { findMany: async () => [{ id: "stage-1", name: "Injection", displayOrder: 1 }, { id: "stage-2", name: "Decoration", displayOrder: 2 }] },
			routingViolation: { findMany: async () => [{ batchId: "batch-2", attemptedStageId: "stage-2" }, { batchId: "batch-3", attemptedStageId: "stage-1" }] },
			qualityDecision: { count: async () => 1 },
			inventoryTransaction: { count: async () => 7 },
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

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
		expect(response.body.productionProgress).to.deep.equal([
			{
				projectId: "project-1",
				projectName: "Plan 1",
				productName: "Product 1",
				plannedQuantity: 100,
				activeQuantity: 60,
				activeBatchCount: 2,
				segments: [
					{ kind: "stage", stageId: "stage-1", stageName: "Injection", quantity: 40 },
					{ kind: "blocked", stageId: "stage-1", stageName: "Injection", quantity: 20 },
					{ kind: "remaining", stageId: "remaining", stageName: "Not started", quantity: 40 },
				],
			},
			{
				projectId: "project-2",
				projectName: "Plan 2",
				productName: "Plan 2",
				plannedQuantity: 60,
				activeQuantity: 30,
				activeBatchCount: 1,
				segments: [
					{ kind: "blocked", stageId: "stage-2", stageName: "Decoration", quantity: 30 },
					{ kind: "remaining", stageId: "remaining", stageName: "Not started", quantity: 30 },
				],
			},
		]);
	});

	it("returns server-owned line activity, throughput evidence, closed batches, and traceability rows", async () => {
		const occurredAt = new Date();
		const app = appFor({
			project: {
				count: async () => 2,
				findMany: async () => [
					{ requiredProductionQuantity: 700 },
					{ requiredProductionQuantity: 700 },
				],
			},
			batch: {
				count: async () => 4,
				findMany: async (args: { where?: { status?: unknown } }) =>
					args.where?.status
						? [{ id: "batch-closed", batchCode: "BATCH-CLOSED", plannedQuantity: 40, currentStageId: "stage-1", status: "CLOSED" }]
						: [{ id: "batch-1", batchCode: "BATCH-001" }],
			},
			lot: { findMany: async () => [{ id: "lot-1", lotCode: "LOT-001" }] },
			part: { findMany: async () => [{ id: "part-1", partCode: "PART-001", partName: "Main part", variancePercentThreshold: 0.05 }] },
			stage: { findMany: async () => [{ id: "stage-1", name: "Injection", displayOrder: 1 }] },
			stageEvent: {
				count: async () => 1,
				findMany: async (args: { select?: unknown }) =>
					args.select
						? [{ quantity: 40, quantityMagnitude: "40", occurredAt }]
						: [{ id: "event-1", stageId: "stage-1", batchId: "batch-1", lotId: "lot-1", partId: "part-1", eventType: "STAGE_COMPLETED", actor: "Operator", isRoutingViolation: false, occurredAt, actorSubject: { displayNameSnapshot: "Operator One" } }],
			},
			routingViolation: {
				count: async () => 1,
				findMany: async () => [{ id: "violation-1", partId: "part-1", batchId: "batch-1", lotId: "lot-1", attemptedStageId: "stage-1", expectedSteps: [{ stageId: "stage-1" }], detectedAt: occurredAt, resolved: false }],
			},
			qualityDecision: { count: async () => 1 },
			inventoryTransaction: {
				count: async () => 1,
				findMany: async () => [{ id: "inventory-1", transactionType: "ISSUANCE", partId: "part-1", lotId: "lot-1", batchId: "batch-1", fromStageId: null, toStageId: "stage-1", expectedQuantity: 40, actualQuantity: 35, withdrawalFormRef: "WF-001", recordedAt: occurredAt, recordedBy: "Operator", recordedBySubject: { displayNameSnapshot: "Operator One" } }],
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/reports/line")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.activity[0]).to.include({ batchId: "BATCH-001", stepName: "Injection", actor: "Operator One" });
		expect(response.body.closedLots[0]).to.include({ id: "BATCH-CLOSED", finalStage: "Injection", result: "Closed" });
		expect(response.body.routingViolations[0]).to.include({ partCode: "PART-001", lotCode: "LOT-001", attemptedStageName: "Injection", resolved: false });
		expect(response.body.inventoryTransactions[0]).to.include({ partCode: "PART-001", lotCode: "LOT-001", exceedsVarianceThreshold: true });
		expect(response.body.dailyThroughput).to.have.length(7);
		// 1400 plan qty / 7 days = 200 provisional pace
		expect(response.body.dailyThroughput[0].expected).to.equal(200);
	});

	it("fails planning reads closed when the subject lacks planning.read", async () => {
		const app = appFor({ project: { count: async () => 0, findMany: async () => [] } }, [
			{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" },
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
