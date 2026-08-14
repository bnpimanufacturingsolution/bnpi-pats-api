import { expect } from "chai";
import { CommandProblem } from "../app/pats/command-support";
import { resolveQualityInspectionByCode } from "../app/pats/quality-resolve";
import type { QcResolveBatch, QcResolveStore } from "../app/pats/quality-resolve";

function batch(overrides: Partial<QcResolveBatch> = {}): QcResolveBatch {
	return {
		id: "batch-1",
		batchCode: "B-1001",
		barcodeValue: "B-1001-QR",
		plannedQuantity: 50,
		currentStageId: "stage-decoration",
		positionProjection: { stageId: "stage-decoration", subStageId: "sub-full-spray" },
		lot: {
			id: "lot-1",
			lotCode: "LOT-01",
			partName: "Body",
			project: { product: { productName: "Fruits" } },
		},
		projectModelAllocation: { model: { modelName: "M03", modelNumber: "M03" } },
		parts: [{ partId: "part-1", quantity: 50, part: { partName: "Body", partCode: "P-BODY" } }],
		qualityInspections: [],
		...overrides,
	};
}

function store(options: {
	batch?: QcResolveBatch | null;
	allowed?: string[];
	onCreate?: () => void;
}): QcResolveStore {
	return {
		qualityStageAssignment: {
			findMany: async () => (options.allowed ?? ["stage-decoration"]).map((stageId) => ({ stageId })),
		},
		batch: {
			findFirst: async () => options.batch === undefined ? batch() : options.batch,
		},
		qualityInspection: {
			create: async () => {
				options.onCreate?.();
				return { id: "inspection-new", status: "OPEN", rowVersion: 1 };
			},
		},
	};
}

describe("resolveQualityInspectionByCode", () => {
	it("creates an open inspection when the batch has none and the gate is allowed", async () => {
		let created = 0;
		const result = await resolveQualityInspectionByCode(store({ onCreate: () => { created += 1; } }), {
			subjectId: "subject-quality",
			code: "B-1001-QR",
		});
		expect(created).to.equal(1);
		expect(result.created).to.equal(true);
		expect(result.canDecide).to.equal(true);
		expect(result.gateStageId).to.equal("stage-decoration");
		expect(result.inspectionId).to.equal("inspection-new");
		expect(result.lotCode).to.equal("LOT-01");
		expect(result.productName).to.equal("Fruits");
		expect(result.modelName).to.equal("M03");
	});

	it("resumes an open inspection instead of creating another", async () => {
		let created = 0;
		const result = await resolveQualityInspectionByCode(
			store({
				onCreate: () => { created += 1; },
				batch: batch({
					qualityInspections: [{
						id: "inspection-open",
						stageId: "stage-decoration",
						status: "OPEN",
						rowVersion: 2,
						decisions: [],
					}],
				}),
			}),
			{ subjectId: "subject-quality", code: "B-1001" },
		);
		expect(created).to.equal(0);
		expect(result.created).to.equal(false);
		expect(result.canDecide).to.equal(true);
		expect(result.inspectionId).to.equal("inspection-open");
		expect(result.rowVersion).to.equal(2);
	});

	it("returns already-closed without creating when the gate inspection is complete", async () => {
		let created = 0;
		const result = await resolveQualityInspectionByCode(
			store({
				onCreate: () => { created += 1; },
				batch: batch({
					qualityInspections: [{
						id: "inspection-done",
						stageId: "stage-decoration",
						status: "COMPLETED",
						rowVersion: 3,
						decisions: [{ decision: "PASSED", reasonCode: null, reasonNote: null }],
					}],
				}),
			}),
			{ subjectId: "subject-quality", code: "B-1001-QR" },
		);
		expect(created).to.equal(0);
		expect(result.canDecide).to.equal(false);
		expect(result.blockReason).to.equal("ALREADY_CLOSED");
		expect(result.latestDecision?.decision).to.equal("PASSED");
	});

	it("rejects a code that matches no batch", async () => {
		try {
			await resolveQualityInspectionByCode(store({ batch: null }), {
				subjectId: "subject-quality",
				code: "UNKNOWN",
			});
			expect.fail("expected CommandProblem");
		} catch (error) {
			expect(error).to.be.instanceOf(CommandProblem);
			expect((error as CommandProblem).status).to.equal(404);
		}
	});

	it("rejects a gate stage outside the allow-list", async () => {
		try {
			await resolveQualityInspectionByCode(store({ allowed: ["stage-injection"] }), {
				subjectId: "subject-quality",
				code: "B-1001-QR",
			});
			expect.fail("expected CommandProblem");
		} catch (error) {
			expect(error).to.be.instanceOf(CommandProblem);
			expect((error as CommandProblem).status).to.equal(403);
			expect((error as CommandProblem).type).to.equal("urn:bandai:pats:problem:not-allowed-stage");
		}
	});
});
