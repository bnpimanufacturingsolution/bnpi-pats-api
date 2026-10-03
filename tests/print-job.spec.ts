import { expect } from "chai";
import { recordPrintJob, type PrintJobStore } from "../app/pats/print-job";
import type { PrintPort } from "../app/pats/print-ports";

function store(options?: { preRoute?: boolean; sectionStageId?: string }) {
	const jobs: Array<Record<string, unknown>> = [];
	const transactions: Array<Record<string, unknown>> = [];
	const events: Array<Record<string, unknown>> = [];
	const findArgs: Array<Record<string, unknown>> = [];
	let issued = 0;
	const preRoute = options?.preRoute ?? false;
	const sectionStageId = options?.sectionStageId ?? "STG-INJECTION";
	const projection = {
		stageId: preRoute ? "STG-PROJECTS" : "STG-INJECTION",
		subStageId: null,
		routeStepId: preRoute ? null : "step-1",
		quantityMagnitude: "240",
	};
	const api: PrintJobStore & { issued: number; jobs: Array<Record<string, unknown>>; transactions: Array<Record<string, unknown>>; events: Array<Record<string, unknown>>; findArgs: Array<Record<string, unknown>> } = {
		jobs,
		transactions,
		events,
		findArgs,
		get issued() {
			return issued;
		},
		section: {
			findUnique: async () => ({
				id: "station-1",
				name: "Injection",
				stageId: sectionStageId,
				printerConnection: "NONE",
				printerAddress: null,
				printerLanguage: "ZPL",
				printerDpi: 300,
				labelWidthMm: 100,
				labelHeightMm: 50,
			}),
		},
		batch: {
			findUnique: async (args) => {
				findArgs.push(args as unknown as Record<string, unknown>);
				return {
				id: "batch-1",
				batchCode: "BNI-2606-001",
				barcodeValue: "BC-BATCH-000001",
				plannedQuantity: 240,
				seriesNumber: 1,
				seriesCount: 2,
				currentStageId: preRoute ? "STG-PROJECTS" : "STG-INJECTION",
				currentSubStageId: null,
				positionProjection: { ...projection },
				lot: { id: "lot-1", lotCode: "MLT-001", partsListId: "pl-1" },
				part: { id: "part-1", partName: "Body", partCode: "P-BODY" },
			};
		},
			update: async ({ data }) => {
				if (data.currentStageId) projection.stageId = data.currentStageId;
				if (data.currentSubStageId !== undefined) projection.subStageId = data.currentSubStageId;
				return { id: "batch-1" };
			},
		},
		batchPositionProjection: {
			update: async ({ data }) => {
				projection.stageId = data.stageId;
				projection.subStageId = data.subStageId;
				projection.routeStepId = data.routeStepId;
				return { batchId: "batch-1" };
			},
		},
		stageEvent: {
			create: async ({ data }) => {
				const created = { id: `se-${events.length + 1}`, ...data };
				events.push(created);
				return { id: created.id };
			},
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
	it("records a simulated first print as a PENDING label (no issuance)", async () => {
		const db = store();
		const job = await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(job.status).to.equal("SIMULATED");
		expect(job.barcodeValue).to.equal("BC-BATCH-000001");
		expect(job.sequence).to.equal(1);
		// D-045: printing is label-only. Release happens exclusively
		// through the scan-out path, so no ledger row is ever written here.
		expect(db.issued).to.equal(0);
		expect(db.transactions).to.have.length(0);
		expect(db.events).to.have.length(0);
		expect(job.originStageEventId).to.equal(null);
		expect(String(db.jobs[0]?.renderedPayload)).to.include("BC-BATCH-000001");
		expect(String(db.jobs[0]?.renderedPayload)).to.include("SERIES: 1/2");
	});

	it("records reprints as labels only", async () => {
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
		expect(db.issued).to.equal(0);
		expect(db.transactions).to.have.length(0);
	});

	it("records no ledger row when the port fails", async () => {
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

	it("never issues on retry: release lives on the scan-out path, not the label", async () => {
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

		// The operator retries from the desk (fresh idempotency key, no reprintOf).
		const retry = await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(retry.sequence).to.equal(2);
		expect(retry.reprintOf).to.equal(null);
		expect(retry.status).to.equal("SIMULATED");
		expect(db.issued).to.equal(0);
		expect(db.transactions).to.have.length(0);

		// And it stays ledger-free: further fresh prints never issue either.
		await recordPrintJob(
			db,
			{ batchId: "batch-1", stationId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(db.issued).to.equal(0);
	});

	it("labels the ACTUAL pcs when provided (label face only, no ledger)", async () => {
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
		expect(db.transactions).to.have.length(0);
	});

	it("labels the planned pcs when actuals match the plan", async () => {
		const db = store();
		const job = await recordPrintJob(
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
		expect(job.quantity).to.equal(240);
		expect(db.transactions).to.have.length(0);
	});

	it("records no origin hop for a mid-route batch (labels only)", async () => {
		const db = store();
		const job = await recordPrintJob(
			db,
			{ batchId: "batch-1", sectionId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(job.originStageEventId).to.equal(null);
		expect(db.events).to.have.length(0);
		expect(db.issued).to.equal(0);
	});

	it("queries batch relations only (Prisma rejects scalars in include)", async () => {
		const db = store();
		await recordPrintJob(
			db,
			{ batchId: "batch-1", sectionId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		const include = (db.findArgs[0] as { include: Record<string, unknown> }).include;
		expect(include).to.not.have.property("seriesNumber");
		expect(include).to.not.have.property("seriesCount");
	});

	it("never advances a pre-route batch: the origin hop lives on scan-out", async () => {
		const db = store({ preRoute: true });
		const job = await recordPrintJob(
			db,
			{ batchId: "batch-1", sectionId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		// Label only: no issuance, no origin hop, position untouched.
		expect(db.issued).to.equal(0);
		expect(job.originStageEventId).to.equal(null);
		expect(db.events).to.have.length(0);
	});

	it("prints without advancing when the section is not the batch's next step", async () => {
		const db = store({ preRoute: true, sectionStageId: "STG-DECORATION" });
		const job = await recordPrintJob(
			db,
			{ batchId: "batch-1", sectionId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(job.status).to.equal("SIMULATED");
		expect(db.issued).to.equal(0);
		expect(job.originStageEventId).to.equal(null);
		expect(db.events).to.have.length(0);
	});

	it("reprints stay labels-only after any earlier print", async () => {
		const db = store({ preRoute: true });
		await recordPrintJob(
			db,
			{ batchId: "batch-1", sectionId: "station-1", actor: "Station", actorSubjectId: "sub-1" },
			simulated,
		);
		expect(db.events).to.have.length(0);
		const reprint = await recordPrintJob(
			db,
			{
				batchId: "batch-1",
				sectionId: "station-1",
				reprintOf: "pj-1",
				actor: "Station",
				actorSubjectId: "sub-1",
			},
			simulated,
		);
		expect(reprint.originStageEventId).to.equal(null);
		expect(db.events).to.have.length(0);
		expect(db.issued).to.equal(0);
	});
});
