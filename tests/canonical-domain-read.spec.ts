import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import {
	__setDomainReadLoggerForTests,
	domainReadRouter,
} from "../app/pats/domain-read";
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
	assignments: SubjectAssignmentRecord[] = [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }],
) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainReads: { router: domainReadRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

describe("canonical PATS domain read contract", () => {
	it("lists defect analyses with batch/inspection filters in the standard envelope", async () => {
		let receivedWhere: Record<string, unknown> | undefined;
		const app = appFor({
			defectAnalysis: {
				count: async () => 1,
				findMany: async (args: { where: Record<string, unknown> }) => {
					receivedWhere = args.where;
					return [{
						id: "analysis-1",
						inspectionId: "inspection-1",
						batchId: "batch-1",
						reasonCode: "PAINT_DEFECT",
						reasonNote: null,
						disposition: "REWORK",
						decidedBySubjectId: "subject-1",
						decidedAt: new Date("2026-10-01T08:00:00.000Z"),
						rowVersion: 1,
						createdAt: new Date("2026-10-01T08:00:00.000Z"),
						updatedAt: new Date("2026-10-01T08:00:00.000Z"),
						decidedBySubject: { id: "subject-1", displayNameSnapshot: "Operator" },
						batch: { id: "batch-1", batchCode: "B-001" },
						inspection: { id: "inspection-1", stageId: "stage-1", subStageId: null },
					}];
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/defect-analyses")
			.query({ batch_id: "batch-1", page: 1, limit: 10 })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({ batchId: "batch-1" });
		expect(response.body.pagination).to.deep.equal({ page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
		expect(response.body.data).to.have.length(1);
		expect(response.body.data[0]).to.include({
			id: "analysis-1",
			reasonCode: "PAINT_DEFECT",
			disposition: "REWORK",
		});
	});

	it("returns a single defect analysis and 404s unknown ids", async () => {
		const app = appFor({
			defectAnalysis: {
				findUnique: async ({ where }: { where: { id: string } }) =>
					where.id === "analysis-1"
						? {
								id: "analysis-1",
								inspectionId: "inspection-1",
								batchId: "batch-1",
								reasonCode: "PAINT_DEFECT",
								reasonNote: null,
								disposition: "REWORK",
								decidedBySubjectId: "subject-1",
								decidedAt: new Date("2026-10-01T08:00:00.000Z"),
								rowVersion: 1,
								createdAt: new Date("2026-10-01T08:00:00.000Z"),
								updatedAt: new Date("2026-10-01T08:00:00.000Z"),
								decidedBySubject: { id: "subject-1", displayNameSnapshot: "Operator" },
								batch: { id: "batch-1", batchCode: "B-001" },
								inspection: { id: "inspection-1", stageId: "stage-1", subStageId: null },
							}
						: null,
			},
		});

		const found = await request(app)
			.get("/api/v1/defect-analyses/analysis-1")
			.set("Authorization", "Bearer read-contract-token");
		expect(found.status).to.equal(200);
		expect(found.body.id).to.equal("analysis-1");

		const missing = await request(app)
			.get("/api/v1/defect-analyses/analysis-9")
			.set("Authorization", "Bearer read-contract-token");
		expect(missing.status).to.equal(404);
	});

	it("keeps defect analysis reads behind quality.read (operator denied)", async () => {
		const app = appFor({}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);
		const response = await request(app)
			.get("/api/v1/defect-analyses")
			.set("Authorization", "Bearer read-contract-token");
		expect(response.status).to.equal(403);
	});

	it("returns a paginated project summary from server persistence", async () => {
		let receivedArgs: Record<string, unknown> | undefined;
		const app = appFor({
			project: {
				count: async () => 3,
				findMany: async (args: Record<string, unknown>) => {
					receivedArgs = args;
					return [{
						id: "project-1",
						projectCode: "PLAN-001",
						name: "July production",
						status: "RELEASED",
						productId: "product-1",
						rowVersion: 4,
						createdAt: new Date("2026-07-01T00:00:00.000Z"),
						releasedAt: new Date("2026-07-02T00:00:00.000Z"),
						completedAt: new Date("2026-07-31T00:00:00.000Z"),
						plannedStartDate: new Date("2026-07-05T00:00:00.000Z"),
						plannedEndDate: new Date("2026-07-25T00:00:00.000Z"),
												product: { productName: "Sample product" },
						lot: { id: "lot-1", requiredProductionQuantity: 100 },
					}];
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/projects")
			.query({ page: 2, limit: 1 })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({
			data: [{
				projectId: "project-1",
				projectCode: "PLAN-001",
				name: "July production",
				status: "RELEASED",
				requiredProductionQuantity: 100,
				productId: "product-1",
				productName: "Sample product",
				lotCount: 1,
				rowVersion: 4,
				createdAt: "2026-07-01T00:00:00.000Z",
				releasedAt: "2026-07-02T00:00:00.000Z",
				completedAt: "2026-07-31T00:00:00.000Z",
				plannedStartDate: "2026-07-05T00:00:00.000Z",
				plannedEndDate: "2026-07-25T00:00:00.000Z",
			}],
			pagination: { page: 2, pageSize: 1, totalItems: 3, totalPages: 3 },
		});
		expect(receivedArgs).to.deep.include({ skip: 1, take: 1 });
		// The planned window must be NAMED in the explicit list select, not just
		// mapped. `GET /projects` selects field by field, so omitting it here would
		// leave the list reading without the window while the detail read - which
		// uses `include` - carried it. That asymmetry is silent: nothing errors, the
		// field is simply always null in the list.
		//
		// Asserted key by key rather than via `deep.include`, which would require
		// restating the entire select and break every time an unrelated column is
		// added.
		const select = (receivedArgs as { select: Record<string, unknown> }).select;
		expect(select.plannedStartDate, "plannedStartDate must be selected").to.equal(true);
		expect(select.plannedEndDate, "plannedEndDate must be selected").to.equal(true);
	});

	it("reports a null planned window rather than omitting the keys", async () => {
		// An unplanned project is a normal state, and a client that reads
		// `plannedStartDate` must get `null` — not `undefined` from a missing key —
		// so "no window recorded" and "the API forgot to send it" stay
		// distinguishable. Mirrors how completedAt is handled.
		const app = appFor({
			project: {
				count: async () => 1,
				findMany: async () => [{
					id: "project-1",
					projectCode: "PLAN-001",
					name: "Unplanned",
					status: "DRAFT",
					productId: null,
					rowVersion: 1,
					createdAt: new Date("2026-07-01T00:00:00.000Z"),
					releasedAt: null,
					completedAt: null,
					plannedStartDate: null,
					plannedEndDate: null,
					product: null,
					lot: null,
				}],
			},
		});

		const response = await request(app)
			.get("/api/v1/projects")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		const row = response.body.data[0];
		expect(row).to.have.property("plannedStartDate", null);
		expect(row).to.have.property("plannedEndDate", null);
	});

	it("carries completedAt on the list so a client can show a real end date", async () => {
		// `Project` has no startDate/endDate; completedAt is the only end-of-life
		// date the model has. The list used to omit it (the detail route returned
		// it), so any list-level date could only ever be a fabricated start.
		let selected: Record<string, unknown> | undefined;
		const app = appFor({
			project: {
				count: async () => 2,
				findMany: async (args: Record<string, unknown>) => {
					selected = args.select as Record<string, unknown>;
					return [
						{
							id: "project-1",
							projectCode: "PLAN-001",
							name: "Done",
							status: "COMPLETED",
							productId: null,
							rowVersion: 4,
							createdAt: new Date("2026-07-01T00:00:00.000Z"),
							releasedAt: new Date("2026-07-02T00:00:00.000Z"),
							completedAt: new Date("2026-07-31T00:00:00.000Z"),
							product: null,
							lot: null,
						},
						{
							id: "project-2",
							projectCode: "PLAN-002",
							name: "Still running",
							status: "RELEASED",
							productId: null,
							rowVersion: 1,
							createdAt: new Date("2026-08-01T00:00:00.000Z"),
							releasedAt: new Date("2026-08-02T00:00:00.000Z"),
							completedAt: null,
							product: null,
							lot: null,
						},
					];
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/projects")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		// The column must be selected, not just mapped, or Prisma drops it.
		expect(selected).to.include({ completedAt: true });
		expect(response.body.data[0].completedAt).to.equal("2026-07-31T00:00:00.000Z");
		// An unfinished project reports null — never a fabricated end.
		expect(response.body.data[1].completedAt).to.equal(null);
	});

	it("preserves lot execution bindings in project detail reads", async () => {
		const app = appFor({
			project: {
				findUnique: async () => ({
					id: "project-1",
					projectCode: "PLAN-001",
					name: "July production",
					status: "DRAFT",
					rowVersion: 2,
					createdAt: new Date("2026-07-01T00:00:00.000Z"),
					releasedAt: null,
					product: null,
					productSpecification: null,
					modelRequirements: [],
					parts: [{ id: "part-1", partCode: "PART-001", partName: "Main part" }],
					partsLists: [{ id: "route-1", version: 3, status: "PUBLISHED", publishedAt: new Date("2026-07-02T00:00:00.000Z"), steps: [{ id: "route-step-1", partId: "part-1", part: { partCode: "PART-001", partName: "Main part" }, stageId: "stage-1", subStageId: null, stepOrder: 1 }] }],
				lot: {
						id: "lot-1",
						lotCode: "LOT-001",
						lotName: "July lot",
						partsListId: "route-1",
						partsListVersion: 3,
						status: "PLANNED",
						requiredProductionQuantity: 100,
						labelPackSize: 10,
						batches: [],
					},
				}),
			},
		});

		const response = await request(app)
			.get("/api/v1/projects/plan-1")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.headers.etag).to.equal('"2"');
		expect(response.headers["cache-control"]).to.equal("no-store");
		expect(response.body).not.to.have.property("allocations");
		expect(response.body).not.to.have.property("materialRequirements");
		expect(response.body).not.to.have.property("pmrsReference");
		expect(response.body).not.to.have.property("requiredProductionQuantity");
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

	it("filters batches by lot and project and derives the QC disposition", async () => {
		let receivedWhere: unknown;
		let receivedOrder: unknown;
		const database = {
			batch: {
				count: async () => 2,
				findMany: async ({ where, orderBy }: { where: unknown; orderBy: unknown }) => {
					receivedWhere = where;
					receivedOrder = orderBy;
					return [
						{
							id: "batch-1",
							batchCode: "LOT-001-B001",
							status: "ACTIVE",
							plannedQuantity: 200,
							seriesNumber: 1,
							seriesCount: 2,
							part: { id: "part-1", partCode: "PART-1", partName: "Casing" },
							positionProjection: null,
							qualityInspections: [{ decisions: [{ decision: "PASSED" }] }],
							defectAnalyses: [],
						},
						{
							id: "batch-2",
							batchCode: "LOT-001-B002",
							status: "ACTIVE",
							plannedQuantity: 200,
							seriesNumber: 2,
							seriesCount: 2,
							part: { id: "part-1", partCode: "PART-1", partName: "Casing" },
							positionProjection: null,
							qualityInspections: [],
							defectAnalyses: [],
						},
					];
				},
			},
		};
		const scopedApp = appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(scopedApp)
			.get("/api/v1/batches")
			.query({ lot_id: "lot-1", project_id: "proj-1", limit: 50 })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({ lotId: "lot-1", lot: { projectId: "proj-1" } });
		expect(receivedOrder).to.deep.equal([
			{ part: { partCode: "asc" } },
			{ seriesNumber: "asc" },
			{ id: "asc" },
		]);
		expect(response.body.pagination).to.include({ totalItems: 2 });
		expect(response.body.data.map((row: { qcDisposition: string | null }) => row.qcDisposition)).to.deep.equal([
			"PASSED",
			null,
		]);
	});

	it("reads a project summary with batch counts instead of batch rows", async () => {
		let batchQueried = false;
		const database = {
			project: {
				findUnique: async () => ({
					id: "project-1",
					projectCode: "PLAN-001",
					name: "Big order",
					status: "RELEASED",
					rowVersion: 2,
					createdAt: new Date("2026-07-01T00:00:00.000Z"),
					releasedAt: new Date("2026-07-02T00:00:00.000Z"),
					product: null,
					productSpecification: null,
					modelRequirements: [],
					parts: [],
					partsLists: [],
					lot: {
						id: "lot-1",
						lotCode: "LOT-001",
						lotName: "Lot 01",
						partsListId: "route-1",
						partsListVersion: 1,
						status: "ACTIVE",
						requiredProductionQuantity: 400,
						labelPackSize: 200,
					},
				}),
			},
			batch: {
				findMany: async () => {
					batchQueried = true;
					return [
						{ id: "batch-1", status: "CLOSED", qualityInspections: [], defectAnalyses: [] },
						{
							id: "batch-2",
							status: "ACTIVE",
							qualityInspections: [],
							defectAnalyses: [],
						},
					];
				},
			},
		};
		const summaryApp = appFor(database);

		const response = await request(summaryApp)
			.get("/api/v1/projects/project-1")
			.query({ batches: "summary" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(batchQueried).to.equal(true);
		expect(response.body.lots[0]).to.include({ lotId: "lot-1", batchCount: 2 });
		expect(response.body.lots[0].batches).to.deep.equal([]);
		expect(response.body.completionReady).to.equal(false);

		const invalid = await request(summaryApp)
			.get("/api/v1/projects/project-1")
			.query({ batches: "everything" })
			.set("Authorization", "Bearer read-contract-token");

		expect(invalid.status).to.equal(400);
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

	it("carries a nullable server-authored code on stages, never a fabricated one", async () => {
		// Stage.code is how the drill-down shows a human-meaningful code
		// (display-human-readable-codes: prefer a server business code over a
		// client-fabricated scheme). It stays NULL until ops authors one, and
		// the read must not substitute the id or an abbreviation.
		const app = appFor({
			stage: {
				findMany: async () => [
					{ id: "stage-inj", name: "Injection", code: "INJ", workflowGroup: { id: "g1", name: "Main" }, subStageLinks: [] },
					{ id: "stage-whs", name: "Warehouse", code: null, workflowGroup: { id: "g1", name: "Main" }, subStageLinks: [] },
				],
			},
			subStage: {
				findMany: async () => [{ id: "sub-1", name: "Molding", code: "MOLD", eligibleStages: [] }],
			},
		});

		const stages = await request(app).get("/api/v1/stages").set("Authorization", "Bearer t");
		const subStages = await request(app).get("/api/v1/sub-stages").set("Authorization", "Bearer t");

		expect(stages.status).to.equal(200);
		expect(stages.body.data[0].code).to.equal("INJ");
		expect(stages.body.data[1].code).to.equal(null);
		expect(subStages.status).to.equal(200);
		expect(subStages.body.data[0].code).to.equal("MOLD");
	});

	it("returns quality inspections with server-owned batch and part evidence", async () => {
		const startedAt = new Date("2026-07-31T00:00:00.000Z");
		const app = appFor(
			{
				qualityStageAssignment: {
					findMany: async () => [{ stageId: "stage-assembly" }],
				},
				qualityInspection: {
					count: async () => 1,
					findMany: async () => [
						{
							id: "inspection-1",
							batchId: "batch-1",
							stageId: "stage-assembly",
							subStageId: null,
							sectionId: "station-qc",
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
								seriesNumber: 1,
								seriesCount: 1,
								part: { id: "part-1", partCode: "PART-1", partName: "Casing Upper" },
								lot: { lotCode: "LOT-1" },
								projectModelRequirement: null,
								status: "ACTIVE",
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
		expect(response.body.data[0].batch.part).to.deep.equal({ partId: "part-1", partCode: "PART-1", partName: "Casing Upper" });
	});

	it("returns a server-owned station snapshot with batch identity and route steps", async () => {
		const app = appFor({
			batchPositionProjection: {
				count: async () => 1,
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
						projectModelRequirementId: "requirement-1",
						seriesNumber: 1,
						seriesCount: 1,
						status: "ACTIVE",
						rowVersion: 2,
						createdAt: new Date("2026-07-30T01:00:00.000Z"),
						lot: {
							id: "lot-1",
							lotCode: "LOT-001",
							lotName: "July lot",
							projectId: "project-1",
							partsListId: "parts-list-1",
							project: { id: "project-1", name: "July project", projectCode: "PRJ-JUL", status: "RELEASED" },
						},
						part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
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
			qualityInspection: {
				findMany: async () => [],
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/batch-positions")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.pagination).to.deep.equal({
			page: 1,
			pageSize: 50,
			totalItems: 1,
			totalPages: 1,
		});
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
			// Single-step route at its only step: route complete.
			qcGate: "COMPLETE",
			batch: {
				id: "batch-1",
				batchCode: "BATCH-001",
				barcodeValue: "BATCH-001-QR",
				lotId: "lot-1",
					plannedQuantity: 12,
					labelPackSize: 12,
					projectModelRequirementId: "requirement-1",
					seriesNumber: 1,
					seriesCount: 1,
					status: "ACTIVE",
				rowVersion: 2,
				createdAt: "2026-07-30T01:00:00.000Z",
				lot: {
					id: "lot-1",
					lotCode: "LOT-001",
					lotName: "July lot",
					projectId: "project-1",
					partsListId: "parts-list-1",
					projectStatus: "RELEASED",
					projectName: "July project",
					projectCode: "PRJ-JUL",
				},
				part: { partId: "part-1", partCode: "PART-001", partName: "Main part" },
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

	it("reports the per-pack QC gate for the next hop", async () => {
		const position = (batchId: string, stageId: string, routeStepId: string | null, status = "ACTIVE") => ({
			batchId,
			stageId,
			subStageId: null,
			routeStepId,
			positionStatus: "ACCEPTED",
			quantityMagnitude: "12",
			quantityUom: "EA",
			projectionVersion: 1,
			updatedAt: new Date("2026-07-31T01:00:00.000Z"),
			batch: {
				id: batchId,
				batchCode: batchId,
				barcodeValue: `${batchId}-QR`,
				lotId: "lot-1",
				plannedQuantity: 12,
				labelPackSize: 12,
				projectModelRequirementId: "requirement-1",
				seriesNumber: 1,
				seriesCount: 1,
				status,
				rowVersion: 2,
				createdAt: new Date("2026-07-30T01:00:00.000Z"),
				lot: {
					id: "lot-1",
					lotCode: "LOT-001",
					lotName: "July lot",
					projectId: "project-1",
					partsListId: "parts-list-1",
					project: { id: "project-1", name: "July project", projectCode: "PRJ-JUL", status: "RELEASED" },
				},
				part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
			},
		});
		const app = appFor({
			batchPositionProjection: {
				count: async () => 5,
				findMany: async () => [
					// Pre-route: needs scan-out release, not QC.
					{ ...position("batch-release", "STG-PROJECTS", null), stageId: "STG-PROJECTS" },
					// Mid-route, no verdict yet.
					position("batch-pending", "stage-injection", "route-step-1"),
					// Mid-route, covering PASSED.
					position("batch-passed", "stage-injection", "route-step-1"),
					// Mid-route, covering FAILED.
					position("batch-held", "stage-injection", "route-step-1"),
					// Held batch: blocked regardless of verdicts.
					position("batch-blocked", "stage-injection", "route-step-1", "HELD"),
				],
			},
			routingStep: {
				findMany: async () => [
					{
						id: "route-step-1",
						partsListId: "parts-list-1",
						partId: "part-1",
						stageId: "stage-injection",
						subStageId: null,
						stepOrder: 1,
						part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
					},
					{
						id: "route-step-2",
						partsListId: "parts-list-1",
						partId: "part-1",
						stageId: "stage-decoration",
						subStageId: null,
						stepOrder: 2,
						part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
					},
				],
			},
			qualityInspection: {
				findMany: async () => [
					{
						id: "inspection-passed",
						batchId: "batch-passed",
						stageId: "stage-injection",
						subStageId: null,
						createdAt: new Date("2026-07-31T02:00:00.000Z"),
						decisions: [{ decision: "PASSED", decidedAt: new Date("2026-07-31T03:00:00.000Z") }],
					},
					{
						id: "inspection-held",
						batchId: "batch-held",
						stageId: "stage-injection",
						subStageId: null,
						createdAt: new Date("2026-07-31T02:00:00.000Z"),
						decisions: [{ decision: "FAILED", decidedAt: new Date("2026-07-31T03:00:00.000Z") }],
					},
				],
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/batch-positions")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		const gates = Object.fromEntries(
			(response.body.data as Array<{ batch: { id: string }; qcGate: string }>).map((row) => [row.batch.id, row.qcGate]),
		);
		expect(gates).to.deep.equal({
			"batch-release": "RELEASE",
			"batch-pending": "PENDING",
			"batch-passed": "PASSED",
			"batch-held": "HELD",
			"batch-blocked": "BLOCKED",
		});
	});

	it("scopes per-row route steps to the pack's own part", async () => {
		const app = appFor({
			batchPositionProjection: {
				count: async () => 1,
				findMany: async () => [{
					batchId: "batch-2",
					stageId: "stage-injection",
					subStageId: null,
					routeStepId: null,
					positionStatus: "ACCEPTED",
					quantityMagnitude: "12",
					quantityUom: "EA",
					projectionVersion: 1,
					updatedAt: new Date("2026-07-31T01:00:00.000Z"),
					batch: {
						id: "batch-2",
						batchCode: "BATCH-002",
						barcodeValue: "BATCH-002-QR",
						lotId: "lot-1",
						plannedQuantity: 12,
						labelPackSize: 12,
						projectModelRequirementId: "requirement-1",
						seriesNumber: 1,
						seriesCount: 1,
						status: "ACTIVE",
						rowVersion: 2,
						createdAt: new Date("2026-07-30T01:00:00.000Z"),
						lot: {
							id: "lot-1",
							lotCode: "LOT-001",
							lotName: "July lot",
							projectId: "project-1",
							partsListId: "parts-list-1",
							project: { id: "project-1", name: "July project", projectCode: "PRJ-JUL", status: "RELEASED" },
						},
						part: { id: "part-2", partCode: "PART-002", partName: "Second part" },
					},
				}],
			},
			routingStep: {
				findMany: async () => [
					{
						id: "route-step-1",
						partsListId: "parts-list-1",
						partId: "part-1",
						stageId: "stage-injection",
						subStageId: null,
						stepOrder: 1,
						part: { id: "part-1", partCode: "PART-001", partName: "Main part" },
					},
					{
						id: "route-step-2",
						partsListId: "parts-list-1",
						partId: "part-2",
						stageId: "stage-injection",
						subStageId: null,
						stepOrder: 1,
						part: { id: "part-2", partCode: "PART-002", partName: "Second part" },
					},
				],
			},
			qualityInspection: {
				findMany: async () => [],
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/batch-positions")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(
			(response.body.data as Array<{ routeSteps: Array<{ routeStepId: string }> }>)[0]?.routeSteps.map(
				(step) => step.routeStepId,
			),
		).to.deep.equal(["route-step-2"]);
	});

	it("returns server-owned station history from execution evidence", async () => {
		const occurredAt = new Date("2026-07-31T02:00:00.000Z");
		const app = appFor({
			section: {
				findUnique: async () => ({
					id: "station-injection",
					sectionCode: "ST-INJ-01",
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
			.get("/api/v1/sections/section-injection/history")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.section).to.deep.include({ id: "station-injection", sectionCode: "ST-INJ-01", stageId: "stage-injection" });
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
			section: {
				findUnique: async () => ({
					id: "station-deco-fs",
					sectionCode: "ST-DECO-FS",
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
								barcodeValue: "BNI-2607-01",
								plannedQuantity: 200,
								status: "IN_PROGRESS",
								seriesNumber: 1,
								seriesCount: 2,
								lot: {
									id: "lot-1",
									lotCode: "LOT-B251-01",
									requiredProductionQuantity: 4800,
									labelPackSize: 240,
								},
								part: { id: "part-1", partCode: "PART-001", partName: "Ice L" },
							},
						},
						{
							stageId: "stage-decoration",
							subStageId: "sub-full-spray",
							quantityMagnitude: "80",
							batch: {
								id: "batch-2",
								batchCode: "BNI-2607-02",
								barcodeValue: "BNI-2607-02",
								plannedQuantity: 80,
								status: "IN_PROGRESS",
								seriesNumber: 1,
								seriesCount: 1,
								lot: {
									id: "lot-1",
									lotCode: "LOT-B251-01",
									requiredProductionQuantity: 4800,
									labelPackSize: 240,
								},
								part: { id: "part-2", partCode: "PART-002", partName: "Takoyaki Shell" },
							},
						},
					];
				},
			},
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/sections/section-deco-fs/support")
			.query({ date: day })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.sectionId).to.equal("station-deco-fs");
		expect(response.body.date).to.equal(day);
		expect(response.body.todayOutput).to.deep.equal({
			quantity: 80,
			eventCount: 1,
			targetQuantity: null,
		});
		expect(response.body.materials).to.deep.equal([
			{
				batchId: "batch-1",
				barcodeValue: "BNI-2607-01",
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
		expect(printWhere).to.include({ sectionId: "station-deco-fs", sequence: 1 });
		expect(printSelect).to.deep.equal({ batchId: true, quantity: true });
		expect(printSelect).to.not.have.property("batch");
		expect(positionWhere).to.deep.equal({
			OR: [{ stageId: "stage-decoration", subStageId: "sub-full-spray" }],
		});
		expect(inWindow.toISOString().startsWith(day)).to.equal(true);
	});

	it("does not count reprint print jobs as today's output", async () => {
		const app = appFor({
			section: {
				findUnique: async () => ({
					id: "station-deco-fs",
					sectionCode: "ST-DECO-FS",
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
			.get("/api/v1/sections/section-deco-fs/support")
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
			section: { findUnique: async () => null },
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/sections/section-x/support")
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
			projects: 4,
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

	it("hides pre-floor STG-PROJECTS batches so progress rows show stage data", async () => {
		const app = appFor({
			project: { count: async () => 2 },
			batch: {
				findMany: async () => [
					{ id: "batch-floor", plannedQuantity: 240, lot: { id: "lot-1", projectId: "project-1", requiredProductionQuantity: 480, project: { name: "July production", product: { productName: "Product 1" } } }, positionProjection: { stageId: "stage-1", quantityMagnitude: "240" } },
					{ id: "batch-prefloor", plannedQuantity: 1, lot: { id: "lot-2", projectId: "project-2", requiredProductionQuantity: 1, project: { name: "E2E release", product: { productName: "Product 1" } } }, positionProjection: { stageId: "STG-PROJECTS", quantityMagnitude: "1" } },
				],
			},
			stage: { findMany: async () => [{ id: "stage-1", name: "Injection", displayOrder: 1 }] },
			routingViolation: { findMany: async () => [] },
			qualityDecision: { count: async () => 0 },
			inventoryTransaction: { count: async () => 0 },
		}, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/dashboard-summaries")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		// Pre-floor project is still counted as active, but carries no stage
		// segments so it must not occupy a progress row ahead of floor data.
		expect(response.body.activeProjects).to.equal(2);
		expect(response.body.productionProgress).to.have.length(1);
		expect(response.body.productionProgress[0].projectId).to.equal("project-1");
		expect(response.body.productionProgress[0].segments[0]).to.include({ kind: "stage", stageName: "Injection" });
	});

	it("returns server-owned line activity, throughput evidence, closed batches, and traceability rows", async () => {
		const occurredAt = new Date();
		const app = appFor({
			project: {
				count: async () => 2,
				findMany: async () => [
					{ lot: { requiredProductionQuantity: 700 } },
					{ lot: { requiredProductionQuantity: 700 } },
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

	it("allows dashboard.read without execution.read (capability-scoped subject)", async () => {
		// Regression: dashboard summary must open with dashboard.read alone even though
		// the subject deliberately lacks execution.read for the full floor-directory ops surface.
		const app = appFor({
			project: { count: async () => 4 },
			batch: {
				findMany: async () => [
					{ id: "batch-1", plannedQuantity: 40, lot: { id: "lot-1", projectId: "project-1", requiredProductionQuantity: 100, project: { name: "Plan 1", product: { productName: "Product 1" } } }, positionProjection: { stageId: "stage-1", quantityMagnitude: "40" } },
				],
			},
			stage: { findMany: async () => [{ id: "stage-1", name: "Injection", displayOrder: 1 }] },
			routingViolation: { findMany: async () => [] },
			qualityDecision: { count: async () => 0 },
			inventoryTransaction: { count: async () => 0 },
		}, [{ kind: "CAPABILITY", key: "dashboard.read", status: "ACTIVE" }]);

		const response = await request(app)
			.get("/api/v1/dashboard-summaries")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.projects).to.equal(4);
	});

	it("fails dashboard reads closed when the subject lacks dashboard.read", async () => {
		// qi bundle has quality + monitoring, but NOT dashboard.read (or execution.read).
		const app = appFor({ project: { count: async () => 0 } }, [
			{ kind: "ROLE_BUNDLE", key: "qi", status: "ACTIVE" },
		]);

		const response = await request(app)
			.get("/api/v1/dashboard-summaries")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("fails planning reads closed when the subject lacks planning.read", async () => {
		const app = appFor({ project: { count: async () => 0, findMany: async () => [] } }, [
			{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" },
		]);

		const response = await request(app)
			.get("/api/v1/projects")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(403);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
	});

	it("serves print jobs to admin (execution.read) after canonical identity resolves the path", async () => {
		const app = appFor(
			{
				printJob: {
					count: async () => 1,
					findMany: async (args: { where: Record<string, unknown> }) => {
						expect(args.where).to.deep.equal({});
						return [
							{
								id: "pj-1",
								batchId: "batch-1",
								sectionId: "station-inj-01",
								sequence: 1,
								occurredAt: new Date("2026-08-10T12:00:00.000Z"),
							},
						];
					},
				},
			},
			[{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/print-jobs")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.have.length(1);
		expect(response.body.data[0]).to.include({ id: "pj-1", batchId: "batch-1", sequence: 1 });
		expect(response.body.data[0].occurredAt).to.equal("2026-08-10T12:00:00.000Z");
	});

	it("serves print jobs to operator (execution.read) when filtered by batchId", async () => {
		let receivedWhere: Record<string, unknown> | undefined;
		const app = appFor(
			{
				printJob: {
					count: async () => 1,
					findMany: async (args: { where: Record<string, unknown> }) => {
						receivedWhere = args.where;
						return [
							{
								id: "pj-2",
								batchId: "batch-1",
								sectionId: "station-inj-01",
								sequence: 1,
								occurredAt: new Date("2026-08-10T13:00:00.000Z"),
							},
						];
					},
				},
			},
			[{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/print-jobs")
			.query({ batchId: "batch-1" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({ batchId: "batch-1" });
		expect(response.body.data).to.have.length(1);
	});

	it("fails print-job reads closed when the subject lacks execution.read", async () => {
		const app = appFor({ printJob: { findMany: async () => [] } }, [
			{ kind: "ROLE_BUNDLE", key: "qi", status: "ACTIVE" },
		]);

		const response = await request(app)
			.get("/api/v1/print-jobs")
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
			.get("/api/v1/projects")
			.query({ bogus: "1" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(400);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:malformed-request");
		expect(called).to.equal(false);
	});

	it("filters projects by status and shares the predicate for count and page", async () => {
		let countWhere: unknown;
		let findWhere: unknown;
		const app = appFor({
			project: {
				count: async (args: Record<string, unknown>) => { countWhere = args.where; return 2; },
				findMany: async (args: Record<string, unknown>) => {
					findWhere = args.where;
					return [];
				},
			},
		});

		const response = await request(app)
			.get("/api/v1/projects")
			.query({ status: "released", limit: 1 })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.pagination.totalItems).to.equal(2);
		expect(countWhere).to.deep.equal({ AND: [{ status: "RELEASED" }] });
		expect(findWhere).to.deep.equal({ AND: [{ status: "RELEASED" }] });
	});

	it("maps ongoing to released and all to no status filter", async () => {
		let receivedWhere: unknown;
		const app = appFor({
			project: {
				count: async (args: Record<string, unknown>) => { receivedWhere = args.where; return 0; },
				findMany: async () => [],
			},
		});

		const ongoing = await request(app)
			.get("/api/v1/projects")
			.query({ status: "ongoing" })
			.set("Authorization", "Bearer read-contract-token");
		expect(ongoing.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({ AND: [{ status: "RELEASED" }] });

		const all = await request(app)
			.get("/api/v1/projects")
			.query({ status: "all" })
			.set("Authorization", "Bearer read-contract-token");
		expect(all.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({});
	});

	it("filters projects by partial search across code, name, and product", async () => {
		let receivedWhere: unknown;
		const app = appFor({
			project: {
				count: async (args: Record<string, unknown>) => { receivedWhere = args.where; return 1; },
				findMany: async () => [],
			},
		});

		const response = await request(app)
			.get("/api/v1/projects")
			.query({ search: "E2E" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({
			AND: [{
				OR: [
					{ projectCode: { contains: "E2E", mode: "insensitive" } },
					{ name: { contains: "E2E", mode: "insensitive" } },
					{ product: { productName: { contains: "E2E", mode: "insensitive" } } },
					{ product: { productCode: { contains: "E2E", mode: "insensitive" } } },
				],
			}],
		});
	});

	it("filters projects by exact lot selector on projectCode or name", async () => {
		let receivedWhere: unknown;
		const app = appFor({
			project: {
				count: async (args: Record<string, unknown>) => { receivedWhere = args.where; return 1; },
				findMany: async () => [],
			},
		});

		const response = await request(app)
			.get("/api/v1/projects")
			.query({ lot: "E2E DBG 60353491" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedWhere).to.deep.equal({
			AND: [{ OR: [{ projectCode: "E2E DBG 60353491" }, { name: "E2E DBG 60353491" }] }],
		});
	});

	it("rejects invalid project filter values with field errors", async () => {
		let called = false;
		const app = appFor({
			project: {
				count: async () => { called = true; return 0; },
				findMany: async () => [],
			},
		});

		const response = await request(app)
			.get("/api/v1/projects")
			.query({ status: "archived" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(400);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:malformed-request");
		expect(response.body.errors).to.deep.equal([
			{ field: "status", message: "Must be one of all, draft, released, completed." },
		]);
		expect(called).to.equal(false);
	});

	it("returns a station directory from server persistence", async () => {
		const app = appFor(
			{ section: { findMany: async () => [{ id: "station-1", name: "Station 1", stageId: "stage-1", displayOrder: 0, sectionCode: "ST-01" }], count: async () => 1 } },
			[{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/sections")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.have.length(1);
		expect(response.body.data[0]).to.deep.include({ id: "station-1", name: "Station 1", sectionCode: "ST-01" });
	});

	it("lists production lines as the Section tree umbrella", async () => {
		const app = appFor(
			{
				productionLine: {
					count: async () => 1,
					findMany: async () => [{ id: "pline-1", lineCode: "PL-MAIN", name: "Main Production Line", displayOrder: 0, isEnabled: true }],
				},
			},
			[{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/production-lines")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(response.body.data).to.deep.equal([{
			productionLineId: "pline-1",
			lineCode: "PL-MAIN",
			name: "Main Production Line",
			displayOrder: 0,
			isEnabled: true,
		}]);
	});

	it("filters sections by search across name and code", async () => {
		let receivedQuery: { sql: string; values: unknown[] } | undefined;
		const app = appFor(
			{
				section: {
					findMany: async (args: Record<string, unknown>) => {
						receivedQuery = args;
						return [];
					},
				},
				$queryRaw: async function(_sql: unknown, ..._values: unknown[]): Promise<unknown[]> {
					receivedQuery = { sql: String(_sql), values: _values };
					return [];
				},
			},
			[{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/sections")
			.query({ search: "deco" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedQuery).to.not.be.undefined;
	});

	it("lists work processes with section links and filters them by search", async () => {
		let receivedQuery: { sql: string; values: unknown[] } | undefined;
		const app = appFor(
			{
				workProcess: {
					findMany: async () => [],
				},
				$queryRaw: async function(_sql: unknown, ..._values: unknown[]): Promise<unknown[]> {
					receivedQuery = { sql: String(_sql), values: _values };
					return [{
						id: "proc-1",
						subStageId: "sub-1",
						subStageName: "Full Spray",
						name: "Manual Spray",
						displayOrder: 1,
						isEnabled: true,
						sectionId: "section-1",
						parentProcessId: null,
					}];
				},
			},
			[{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/work-processes")
			.query({ search: "spray" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedQuery).to.not.be.undefined;
		expect(response.body.data).to.deep.equal([{
			id: "proc-1",
			subStageId: "sub-1",
			subStageName: "Full Spray",
			name: "Manual Spray",
			displayOrder: 1,
			isEnabled: true,
			sectionId: "section-1",
			parentProcessId: null,
		}]);
	});

	it("rejects unknown work-process query keys", async () => {
		let called = false;
		const app = appFor(
			{
				workProcess: {
					findMany: async () => {
						called = true;
						return [];
					},
				},
			},
			[{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }],
		);

		const response = await request(app)
			.get("/api/v1/work-processes")
			.query({ bogus: "1" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(400);
		expect(called).to.equal(false);
	});

	it("searches the subject directory by display name, email, and login username", async () => {
		let receivedWhere: Record<string, unknown> | undefined;
		const receivedCredentialWheres: Array<Record<string, unknown>> = [];
		const app = appFor({
			subject: {
				count: async () => 1,
				findMany: async (args: { where: Record<string, unknown> }) => {
					receivedWhere = args.where;
					return [{
						id: "subject-1",
						displayNameSnapshot: "E2E User",
						emailSnapshot: "e2e.user@pats.local",
						status: "ACTIVE",
					}];
				},
			},
			subjectCredential: {
				findMany: async (args: { where: Record<string, unknown> }) => {
					receivedCredentialWheres.push(args.where);
					return [{ subjectId: "subject-1", username: "e2euser1" }];
				},
			},
			subjectAssignment: {
				findMany: async () => [{ subjectId: "subject-1", key: "operator" }],
			},
		});

		const response = await request(app)
			.get("/api/v1/subjects")
			.query({ search: "e2euser1" })
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(200);
		expect(receivedCredentialWheres[0]).to.deep.equal({
			username: { contains: "e2euser1", mode: "insensitive" },
		});
		expect(receivedWhere).to.have.property("OR").with.lengthOf(3);
		expect(response.body.data).to.deep.equal([{
			id: "subject-1",
			displayNameSnapshot: "E2E User",
			emailSnapshot: "e2e.user@pats.local",
			status: "ACTIVE",
			username: "e2euser1",
			roleBundle: "operator",
		}]);
	});

	// Regression: a read whose backing store throws answers 503 with a generic
	// "Dependency Unavailable" problem, which is indistinguishable on the wire
	// from Postgres being down. A stale generated Prisma client that does not
	// know a queried field fails exactly this way — inside the query builder,
	// before any SQL is sent — so the 503s reached the browser with no cause
	// anywhere except a 5-30ms access row. These pin the wire contract and the
	// server-side cause together, so the next drift is diagnosable from logs.
	it("answers 503 with the client-safe problem when a project read throws", async () => {
		const failure = Object.assign(new Error("Unknown field `defectAnalyses` for include statement on model `Batch`."), {
			name: "PrismaClientValidationError",
		});
		const app = appFor({
			project: { findUnique: async () => { throw failure; } },
		});

		const response = await request(app)
			.get("/api/v1/projects/project-1")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(503);
		// No Prisma text may reach the client; the detail stays the human sentence.
		expect(response.body.detail).to.equal("PATS project data is unavailable.");
		expect(response.body.type).to.equal("urn:bandai:pats:problem:dependency-unavailable");
		expect(JSON.stringify(response.body)).to.not.contain("defectAnalyses");
		expect(JSON.stringify(response.body)).to.not.contain("Prisma");
	});

	// The wire contract above is only half the obligation. The 503 exists so the
	// client never sees a Prisma message, which means the cause has to reach the
	// SERVER log or the failure is undiagnosable in production. That is not
	// hypothetical: passing the Error as a winston meta field serialized to
	// `"error":{}` in logs/error.log, so the log line named the failed read and
	// omitted the only part worth reading. This pins the serialized shape.
	it("logs the cause of a failed read in a serializable form", async () => {
		const failure = Object.assign(
			new Error("Unknown field `defectAnalyses` for include statement on model `Batch`."),
			{ name: "PrismaClientValidationError" },
		);
		const app = appFor({
			project: { findUnique: async () => { throw failure; } },
		});

		const logged: Array<{ message: unknown; meta: Record<string, unknown> }> = [];
		const restore = __setDomainReadLoggerForTests({
			error: (message: unknown, meta?: Record<string, unknown>) => {
				logged.push({ message, meta: meta ?? {} });
			},
		} as unknown as Parameters<typeof __setDomainReadLoggerForTests>[0]);
		try {
			const response = await request(app)
				.get("/api/v1/projects/project-1")
				.set("Authorization", "Bearer read-contract-token");
			expect(response.status).to.equal(503);
		} finally {
			restore();
		}

		expect(logged.length, "the failed read must be logged").to.be.greaterThan(0);
		const { message, meta } = logged[logged.length - 1];
		expect(message).to.equal("PATS domain read failed");
		// The cause must survive JSON serialization — that is the whole point.
		expect(meta.errorName).to.equal("PrismaClientValidationError");
		expect(meta.errorMessage).to.contain("defectAnalyses");
		expect(meta.errorStack).to.be.a("string").and.to.contain("PrismaClientValidationError");
		expect(meta.path).to.equal("/api/v1/projects/project-1");
		// Round-tripped, because a field that only looks right in memory is exactly
		// the `"error":{}` bug again: winston drops an Error-valued meta field.
		expect(JSON.parse(JSON.stringify(meta)).errorMessage).to.contain("defectAnalyses");
	});

	it("answers 503 with the client-safe problem when a batch collection read throws", async () => {
		const app = appFor({
			batch: {
				count: async () => 0,
				findMany: async () => { throw new Error("relation \"DefectAnalysis\" does not exist"); },
			},
		});

		const response = await request(app)
			.get("/api/v1/batches")
			.set("Authorization", "Bearer read-contract-token");

		expect(response.status).to.equal(503);
		expect(response.body.detail).to.equal("PATS batch data is unavailable.");
		expect(JSON.stringify(response.body)).to.not.contain("DefectAnalysis");
	});
});
