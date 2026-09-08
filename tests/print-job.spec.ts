import { expect } from "chai";
import { recordPrintJob, type PrintJobStore } from "../app/pats/print-job";
import type { PrintPort } from "../app/pats/print-ports";

function store(): PrintJobStore & { issued: number; jobs: Array<Record<string, unknown>>; transactions: Array<Record<string, unknown>> } {
	const jobs: Array<Record<string, unknown>> = [];
	const transactions: Array<Record<string, unknown>> = [];
	let issued = 0;
	const api: PrintJobStore & { issued: number; jobs: Array<Record<string, unknown>>; transactions: Array<Record<string, unknown>> } = {
		jobs,
		transactions,
		get issued() {
			return issued;
		},
		station: {
			findUnique: async () => ({
				id: "station-1",
				name: "Injection",
				stageId: "STG-INJECTION",
				printerConnection: "NONE",
				printerAddress: null,
				printerLanguage: "ZPL",
				printerDpi: 300,
				labelWidthMm: 100,
				labelHeightMm: 50,
			}),
		},
		batch: {
			findUnique: async () => ({
				id: "batch-1",
				batchCode: "BNI-2606-001",
				barcodeValue: "BC-BATCH-000001",
				plannedQuantity: 240,
				currentStageId: "STG-INJECTION",
				currentSubStageId: null,
				positionProjection: {
					stageId: "STG-INJECTION",
					subStageId: null,
					routeStepId: "step-1",
					quantityMagnitude: "240",
				},
				lot: { id: "lot-1", lotCode: "MLT-001", partsListId: "pl-1", partName: "Body" },
				parts: [{ partId: "part-1", quantity: 240, part: { partName: "Body", partCode: "P-BODY" } }],
			}),
		},
		printJob: {
			count: async ({ where }: { where?: { status?: { not?: string } } }) =>
				jobs.filter(
					(job) => (where?.status?.not ? job.status !== where.status.not : true),
				).length,
			findFirst: async ({ where }) =>
				jobs.find((job) => job.id === where.id && job.batchId === where.batchId)
					? { id: String(where.id) }
					: null,
			create: async ({ data }) => {
				const created = { id: `pj-${jobs.length + 1}`, ...data };
				jobs.push(created);
				return { id: created.id };
			},
		},
		stage: {
			findUnique: async ({ where }) =>
				where.id === "STG-INJECTION" ? { name: "Injection (Molding)" } : { name: "Decoration" },
		},
		subStage: {
			findUnique: async () => ({ name: "Full Spray" }),
		},
		inventoryTransaction: {
			create: async ({ data }) => {
				issued += 1;
				transactions.push(data);
				return { id: `iss-${issued}` };
			},
		},
		routingStep: {
			findMany: async () => [
				{ id: "step-1", stageId: "STG-INJECTION", subStageId: null, stepOrder: 1 },
				{ id: "step-2", stageId: "STG-DECORATION", subStageId: "SUB-FULL-SPRAY", stepOrder: 2 },
			],
		},
	};
	return api;
}

const simulated: PrintPort = {
	async deliver() {
		return { status: "SIMULATED", failureReason: null };
	},
};

describe("recordPrintJob", () => {
	it("records a simulated first print and one issuance", async () => {
		const db = store();
		const job = await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(job.status).to.equal("SIMULATED");
		expect(job.barcodeValue).to.equal("BC-BATCH-000001");
		expect(job.sequence).to.equal(1);
		expect(db.issued).to.equal(1);
		expect(String(db.jobs[0]?.renderedPayload)).to.include("BC-BATCH-000001");
	});

	it("does not issue a second inventory move on reprint", async () => {
		const db = store();
		await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		const reprint = await recordPrintJob(
			db,
			{
				batchId: "batch-1",
				stationId: "station-1",
				reprintOf: "pj-1",
				actor: "Station",
				actorSubjectId: "sub-1",
			},
			simulated,
		);
		expect(reprint.sequence).to.equal(2);
		expect(reprint.reprintOf).to.equal("pj-1");
		expect(db.issued).to.equal(1);
	});

	it("does not issue when the port fails", async () => {
		const db = store();
		const job = await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			{
				async deliver() {
					return { status: "FAILED", failureReason: "Printer timed out." };
				},
			},
		);
		expect(job.status).to.equal("FAILED");
		expect(db.issued).to.equal(0);
	});

	it("issues on the fresh retry after a failed first print (first successful print wins)", async () => {
		const db = store();
		const failed = await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			{
				async deliver() {
					return { status: "FAILED", failureReason: "Printer timed out." };
				},
			},
		);
		expect(failed.sequence).to.equal(1);
		expect(db.issued).to.equal(0);

		// The operator retries from the desk (fresh idempotency key, no reprintOf):
		// this successful print IS the pack's first — it must post the ISSUANCE.
		const retry = await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(retry.sequence).to.equal(2);
		expect(retry.reprintOf).to.equal(null);
		expect(retry.status).to.equal("SIMULATED");
		expect(db.issued).to.equal(1);

		// And it stays one-per-pack: further fresh prints never re-issue.
		await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(db.issued).to.equal(1);
	});

	it("labels and issues the ACTUAL pcs when provided (variance → RECORDED)", async () => {
		const db = store();
		const job = await recordPrintJob(
			db,
			{
				batchId: "batch-1",
				stationId: "station-1",
				actualQuantity: 235,
				actor: "Station",
				actorSubjectId: "sub-1",
			},
			simulated,
		);
		// The label face carries what physically shipped, not the plan.
		expect(job.quantity).to.equal(235);
		expect(String(db.jobs[0]?.renderedPayload)).to.include("235 PCS");
		// Ledger honesty: expected = planned (240), actual = counted (235) → variance.
		expect(db.transactions[0]).to.include({
			expectedQuantity: 240,
			actualQuantity: 235,
			status: "RECORDED",
		});
	});

	it("issues ACCEPTED when the actual pcs match the plan", async () => {
		const db = store();
		await recordPrintJob(
			db,
			{
				batchId: "batch-1",
				stationId: "station-1",
				actualQuantity: 240,
				actor: "Station",
				actorSubjectId: "sub-1",
			},
			simulated,
		);
		expect(db.transactions[0]).to.include({
			expectedQuantity: 240,
			actualQuantity: 240,
			status: "ACCEPTED",
		});
	});
});
