import { clampGloryLWidthMm, GLORY_L_DEFAULTS, renderLabel, type LabelIr } from "./label-ir";
import { selectPrintPort, type PrintPort, type PrintPortResult } from "./print-ports";

export type PrintJobCreateInput = {
	batchId: string;
	stationId: string;
	reprintOf?: string | null;
	/**
	 * Actual pcs in the completed pack (label truth). Defaults to the planned
	 * pack quantity when omitted; ISSUANCE posts expected=planned / actual=this
	 * so short/over packs surface as variance (RECORDED) instead of silently
	 * rounding to plan.
	 */
	actualQuantity?: number | null;
};

export type PrintJobRecord = {
	id: string;
	batchId: string;
	stationId: string;
	barcodeValue: string;
	quantity: number;
	sequence: number;
	reprintOf: string | null;
	language: string;
	status: "SENT" | "SIMULATED" | "FAILED";
	failureReason: string | null;
};

export type PrintJobStore = {
	section: {
		findUnique: (args: { where: { id: string } }) => Promise<PrintJobStation | null>;
	};
	batch: {
		findUnique: (args: {
			where: { id: string };
			include: {
				positionProjection: true;
				lot: {
					select: {
						id: true;
						lotCode: true;
						partsListId: true;
						partName: true;
						project?: { select: { id: true; name: true; projectCode: true } };
					};
				};
				parts: {
					orderBy: { partId: "asc" };
					take: 1;
					select: { partId: true; quantity: true; part: { select: { partName: true; partCode: true } } };
				};
			};
		}) => Promise<PrintJobBatch | null>;
	};
	printJob: {
		count: (args: {
			where: { batchId: string; stationId: string; status?: { not: string } };
		}) => Promise<number>;
		findFirst: (args: {
			where: { id: string; batchId: string };
		}) => Promise<{ id: string } | null>;
		create: (args: {
			data: {
				batchId: string;
				stationId: string;
				fromStageId: string;
				fromSubStageId: string | null;
				toStageId: string | null;
				toSubStageId: string | null;
				barcodeValue: string;
				quantity: number;
				sequence: number;
				reprintOf: string | null;
				language: string;
				renderedPayload: string;
				status: "QUEUED" | "SENT" | "FAILED" | "SIMULATED";
				failureReason: string | null;
				actor: string;
				actorSubjectId: string;
			};
		}) => Promise<{ id: string }>;
	};
	stage: {
		findUnique: (args: { where: { id: string }; select: { name: true } }) => Promise<{ name: string } | null>;
	};
	subStage: {
		findUnique: (args: { where: { id: string }; select: { name: true } }) => Promise<{ name: string } | null>;
	};
	inventoryTransaction: {
		create: (args: {
			data: {
				transactionType: "RECEIVING" | "ISSUANCE";
				batchId: string;
				partId: string;
				lotId: string;
				fromStageId: string;
				fromSubStageId: string | null;
				toStageId: string;
				toSubStageId: string | null;
				expectedQuantity: number;
				actualQuantity: number;
				recordedBy: string;
				recordedBySubjectId: string;
				status: string;
			};
		}) => Promise<{ id: string }>;
	};
	routingStep: {
		findMany: (args: {
			where: { partsListId: string; partId?: { in: string[] } };
			orderBy: Array<{ stepOrder: "asc" } | { id: "asc" }>;
		}) => Promise<Array<{ id: string; stageId: string; subStageId: string | null; stepOrder: number }>>;
	};
};

export type PrintJobStation = {
	id: string;
	name: string;
	stageId: string;
	printerConnection: string | null;
	printerAddress: string | null;
	printerLanguage: string | null;
	printerDpi: number | null;
	labelWidthMm: number | null;
	labelHeightMm: number | null;
};

export type PrintJobBatch = {
	id: string;
	batchCode: string;
	barcodeValue: string;
	plannedQuantity: number;
	currentStageId: string;
	currentSubStageId: string | null;
	positionProjection: {
		stageId: string;
		subStageId: string | null;
		routeStepId: string | null;
		quantityMagnitude: { toString(): string } | string | number | null;
	} | null;
	lot: {
		id: string;
		lotCode: string;
		partsListId: string;
		partName: string;
		project?: { id: string; name: string; projectCode: string } | null;
	};
	parts: Array<{ partId: string; quantity: number; part: { partName: string; partCode: string } }>;
};

async function stepLabel(
	store: PrintJobStore,
	stageId: string | null,
	subStageId: string | null,
): Promise<string> {
	if (!stageId) return "—";
	const stage = await store.stage.findUnique({ where: { id: stageId }, select: { name: true } });
	if (!subStageId) return stage?.name ?? stageId;
	const sub = await store.subStage.findUnique({ where: { id: subStageId }, select: { name: true } });
	return [stage?.name ?? stageId, sub?.name].filter(Boolean).join(" · ");
}

function quantityOf(batch: PrintJobBatch): number {
	const magnitude = batch.positionProjection?.quantityMagnitude;
	if (magnitude !== null && magnitude !== undefined) {
		const parsed = Number(typeof magnitude === "object" ? magnitude.toString() : magnitude);
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	return batch.parts[0]?.quantity || batch.plannedQuantity;
}

export function resolvePrinterBinding(station: PrintJobStation): {
	connection: string | null;
	address: string | null;
	widthMm: number;
	heightMm: number;
	dpi: number;
} {
	const envWin = process.env.PATS_PRINTER_WINDOWS_NAME?.trim() || null;
	const envAddress = process.env.PATS_PRINTER_ADDRESS?.trim() || null;
	const stationAddr = station.printerAddress?.trim() || null;
	const usbRequested =
		station.printerConnection === "USB_AGENT" ||
		Boolean(envWin) ||
		Boolean(stationAddr?.toLowerCase().startsWith("winspool:"));
	const address = usbRequested
		? stationAddr?.toLowerCase().startsWith("winspool:")
			? stationAddr
			: envWin
				? `winspool:${envWin}`
				: stationAddr
		: stationAddr || envAddress;
	const connection = usbRequested
		? "USB_AGENT"
		: station.printerConnection === "NETWORK" || address
			? "NETWORK"
			: station.printerConnection;
	const envWidth = Number(process.env.PATS_LABEL_WIDTH_MM);
	const envHeight = Number(process.env.PATS_LABEL_HEIGHT_MM);
	return {
		connection,
		address,
		widthMm: clampGloryLWidthMm(station.labelWidthMm ?? (Number.isFinite(envWidth) ? envWidth : GLORY_L_DEFAULTS.widthMm)),
		heightMm: station.labelHeightMm ?? (Number.isFinite(envHeight) && envHeight > 0 ? Math.round(envHeight) : GLORY_L_DEFAULTS.heightMm),
		dpi: station.printerDpi ?? GLORY_L_DEFAULTS.dpi,
	};
}

export function buildLabelIr(input: {
	batch: PrintJobBatch;
	/** Actual pcs for the label face; defaults to the planned pack quantity. */
	quantity?: number;
	fromStepLabel: string;
	toStepLabel: string;
	sequence: number;
	widthMm: number;
	heightMm: number;
	dpi: number;
	printedAt: string;
}): LabelIr {
	const part = input.batch.parts[0];
	return {
		barcodeValue: input.batch.barcodeValue,
		batchCode: input.batch.batchCode,
		lotCode: input.batch.lot.lotCode,
		serialNumber: input.batch.barcodeValue,
		partName: part?.part.partName ?? input.batch.lot.partName,
		partCode: part?.part.partCode ?? "",
		projectName: input.batch.lot.project?.name,
		codename: input.batch.lot.project?.projectCode || part?.part.partCode,
		quantity: input.quantity ?? quantityOf(input.batch),
		fromStepLabel: input.fromStepLabel,
		toStepLabel: input.toStepLabel,
		printedAt: input.printedAt,
		sequence: input.sequence,
		widthMm: input.widthMm,
		heightMm: input.heightMm,
		dpi: input.dpi,
	};
}

export async function recordPrintJob(
	store: PrintJobStore,
	input: PrintJobCreateInput & { actor: string; actorSubjectId: string },
	port?: PrintPort,
): Promise<PrintJobRecord> {
	const station = await store.section.findUnique({ where: { id: input.stationId } });
	if (!station) throw new Error("NOT_FOUND_STATION");
	const batch = await store.batch.findUnique({
		where: { id: input.batchId },
		include: {
			positionProjection: true,
			lot: {
				select: {
					id: true,
					lotCode: true,
					partsListId: true,
					partName: true,
					project: { select: { id: true, name: true, projectCode: true } },
				},
			},
			parts: {
				orderBy: { partId: "asc" },
				take: 1,
				select: { partId: true, quantity: true, part: { select: { partName: true, partCode: true } } },
			},
		},
	});
	if (!batch) throw new Error("NOT_FOUND_BATCH");

	if (input.reprintOf) {
		const original = await store.printJob.findFirst({
			where: { id: input.reprintOf, batchId: batch.id },
		});
		if (!original) throw new Error("NOT_FOUND_REPRINT");
	}

	// Label truth: the completed pack's actual pcs. Defaults to the planned
	// pack quantity; reprints inherit the original row's quantity so the label
	// face never drifts from what physically shipped.
	const plannedQuantity = quantityOf(batch);
	const labelQuantity =
		input.reprintOf || input.actualQuantity === null || input.actualQuantity === undefined
			? plannedQuantity
			: input.actualQuantity;

	const partIds = batch.parts.map((part) => part.partId);
	const steps = await store.routingStep.findMany({
		where: {
			partsListId: batch.lot.partsListId,
			...(partIds.length > 0 ? { partId: { in: partIds } } : {}),
		},
		orderBy: [{ stepOrder: "asc" }, { id: "asc" }],
	});
	const currentRouteStepId = batch.positionProjection?.routeStepId ?? null;
	const currentIndex = currentRouteStepId ? steps.findIndex((step) => step.id === currentRouteStepId) : -1;
	const threshold = currentIndex < 0 ? -1 : steps[currentIndex].stepOrder;
	const nextStep = steps.find((step) => step.stepOrder > threshold) ?? null;

	const fromStageId = batch.positionProjection?.stageId ?? batch.currentStageId;
	const fromSubStageId = batch.positionProjection?.subStageId ?? batch.currentSubStageId;
	const sequence = (await store.printJob.count({ where: { batchId: batch.id, stationId: station.id } })) + 1;
	// Counted BEFORE this print is recorded: first SUCCESSFUL print issues (one
	// ISSUANCE per pack, ever). A FAILED attempt consumes a sequence but never
	// blocks the pack's issuance — its retry is a fresh print (seq 2+) and posts
	// the move then. Reprints (reprintOf set) never issue again.
	const priorSuccessfulPrints = await store.printJob.count({
		where: {
			batchId: batch.id,
			stationId: station.id,
			status: { not: "FAILED" },
		},
	});
	const language = (station.printerLanguage ?? "ZPL").toUpperCase();
	const binding = resolvePrinterBinding(station);
	const ir = buildLabelIr({
		batch,
		quantity: labelQuantity,
		fromStepLabel: await stepLabel(store, fromStageId, fromSubStageId),
		toStepLabel: await stepLabel(store, nextStep?.stageId ?? null, nextStep?.subStageId ?? null),
		sequence,
		widthMm: binding.widthMm,
		heightMm: binding.heightMm,
		dpi: binding.dpi,
		printedAt: new Date().toISOString(),
	});
	const payload = renderLabel(language, ir);
	const selected = port ?? selectPrintPort(binding.connection);
	const delivered: PrintPortResult = await selected.deliver({
		address: binding.address,
		payload,
	});

	const created = await store.printJob.create({
		data: {
			batchId: batch.id,
			stationId: station.id,
			fromStageId,
			fromSubStageId,
			toStageId: nextStep?.stageId ?? null,
			toSubStageId: nextStep?.subStageId ?? null,
			barcodeValue: batch.barcodeValue,
			quantity: ir.quantity,
			sequence,
			reprintOf: input.reprintOf ?? null,
			language,
			renderedPayload: payload,
			status: delivered.status,
			failureReason: delivered.failureReason,
			actor: input.actor,
			actorSubjectId: input.actorSubjectId,
		},
	});

	// First SUCCESSFUL print issues (see priorSuccessfulPrints above).
	const shouldIssue =
		!input.reprintOf &&
		delivered.status !== "FAILED" &&
		nextStep &&
		Boolean(batch.parts[0]?.partId) &&
		priorSuccessfulPrints === 0;
	if (shouldIssue && nextStep && batch.parts[0]?.partId) {
		// Plan vs reality on the ledger: expected = planned pack quantity,
		// actual = the pcs the LL counted into the tray. Equal → ACCEPTED;
		// different → RECORDED (variance surfaces in Reports via the part's
		// varianceRule) — release is never blocked.
		const hasVariance = labelQuantity !== plannedQuantity;
		await store.inventoryTransaction.create({
			data: {
				transactionType: "ISSUANCE",
				batchId: batch.id,
				partId: batch.parts[0].partId,
				lotId: batch.lot.id,
				fromStageId,
				fromSubStageId,
				toStageId: nextStep.stageId,
				toSubStageId: nextStep.subStageId,
				expectedQuantity: plannedQuantity,
				actualQuantity: labelQuantity,
				recordedBy: input.actor,
				recordedBySubjectId: input.actorSubjectId,
				status: hasVariance ? "RECORDED" : "ACCEPTED",
			},
		});
	}

	return {
		id: created.id,
		batchId: batch.id,
		stationId: station.id,
		barcodeValue: batch.barcodeValue,
		quantity: ir.quantity,
		sequence,
		reprintOf: input.reprintOf ?? null,
		language,
		status: delivered.status,
		failureReason: delivered.failureReason,
	};
}
