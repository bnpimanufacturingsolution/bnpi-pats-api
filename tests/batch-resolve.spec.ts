import { expect } from "chai";
import { CommandProblem } from "../app/pats/command-support";
import {
	nextExpectedRouteStep,
	parseBatchResolveCode,
	resolveBatchByCode,
	type BatchResolveBatch,
	type BatchResolveRouteStep,
	type BatchResolveStore,
} from "../app/pats/batch-resolve";

function batch(overrides: Partial<BatchResolveBatch> = {}): BatchResolveBatch {
	return {
		id: "batch-1",
		batchCode: "BNI-2606-001",
		barcodeValue: "BC-BATCH-000001",
		plannedQuantity: 240,
		labelPackSize: 240,
		currentStageId: "STG-INJECTION",
		currentSubStageId: null,
		positionProjection: {
			stageId: "STG-INJECTION",
			subStageId: null,
			routeStepId: "step-1",
			quantityMagnitude: "240",
		},
		lot: {
			id: "lot-1",
			lotCode: "MLT-001",
			partsListId: "pl-1",
			partName: "Body",
			project: { product: { productName: "Machibouke" } },
		},
		projectModelAllocation: { model: { modelName: "Model 01", modelNumber: "01" } },
		parts: [{ partId: "part-1", quantity: 240, part: { partName: "Body", partCode: "P-BODY" } }],
		...overrides,
	};
}

const STEPS: BatchResolveRouteStep[] = [
	{ id: "step-1", stageId: "STG-INJECTION", subStageId: null, stepOrder: 1, partId: "part-1" },
	{ id: "step-2", stageId: "STG-DECORATION", subStageId: "SUB-FULL-SPRAY", stepOrder: 2, partId: "part-1" },
	{ id: "step-3", stageId: "STG-ASSEMBLY", subStageId: "SUB-SUB-ASSEMBLY", stepOrder: 3, partId: "part-1" },
];

function store(options: {
	batch?: BatchResolveBatch | null;
	steps?: BatchResolveRouteStep[];
} = {}): BatchResolveStore {
	return {
		batch: {
			findFirst: async () => (options.batch === undefined ? batch() : options.batch),
		},
		routingStep: {
			findMany: async () => options.steps ?? STEPS,
		},
	};
}

describe("parseBatchResolveCode", () => {
	it("requires a non-empty code", () => {
		try {
			parseBatchResolveCode("");
			expect.fail("expected CommandProblem");
		} catch (error) {
			expect(error).to.be.instanceOf(CommandProblem);
			expect((error as CommandProblem).status).to.equal(400);
		}
	});

	it("trims the first query value", () => {
		expect(parseBatchResolveCode(["  BC-1  "])).to.equal("BC-1");
	});
});

describe("nextExpectedRouteStep", () => {
	it("returns the first step when the batch has no current route step", () => {
		const next = nextExpectedRouteStep(STEPS, null);
		expect(next?.routeStepId).to.equal("step-1");
	});

	it("returns the following step after the current route step", () => {
		const next = nextExpectedRouteStep(STEPS, "step-1");
		expect(next).to.deep.equal({
			routeStepId: "step-2",
			stageId: "STG-DECORATION",
			subStageId: "SUB-FULL-SPRAY",
			stepOrder: 2,
		});
	});

	it("returns null when the route is complete", () => {
		expect(nextExpectedRouteStep(STEPS, "step-3")).to.equal(null);
	});
});

describe("resolveBatchByCode", () => {
	it("resolves a barcodeValue to identity, carried qty, and next step", async () => {
		const result = await resolveBatchByCode(store(), "BC-BATCH-000001");
		expect(result.batchId).to.equal("batch-1");
		expect(result.batchCode).to.equal("BNI-2606-001");
		expect(result.barcodeValue).to.equal("BC-BATCH-000001");
		expect(result.lotCode).to.equal("MLT-001");
		expect(result.partCode).to.equal("P-BODY");
		expect(result.productName).to.equal("Machibouke");
		expect(result.modelName).to.equal("Model 01");
		expect(result.carriedQuantity).to.equal(240);
		expect(result.labelPackSize).to.equal(240);
		expect(result.currentStageId).to.equal("STG-INJECTION");
		expect(result.nextExpectedStep?.stageId).to.equal("STG-DECORATION");
		expect(result.routeComplete).to.equal(false);
	});

	it("resolves a batchCode alias the same way", async () => {
		const result = await resolveBatchByCode(store(), "BNI-2606-001");
		expect(result.batchId).to.equal("batch-1");
	});

	it("does not write and reports routeComplete at the last step", async () => {
		const result = await resolveBatchByCode(
			store({
				batch: batch({
					positionProjection: {
						stageId: "STG-ASSEMBLY",
						subStageId: "SUB-SUB-ASSEMBLY",
						routeStepId: "step-3",
						quantityMagnitude: "200",
					},
				}),
			}),
			"BC-BATCH-000001",
		);
		expect(result.carriedQuantity).to.equal(200);
		expect(result.nextExpectedStep).to.equal(null);
		expect(result.routeComplete).to.equal(true);
	});

	it("rejects a code that matches no batch", async () => {
		try {
			await resolveBatchByCode(store({ batch: null }), "UNKNOWN");
			expect.fail("expected CommandProblem");
		} catch (error) {
			expect(error).to.be.instanceOf(CommandProblem);
			expect((error as CommandProblem).status).to.equal(404);
		}
	});
});
