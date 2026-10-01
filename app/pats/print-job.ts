import { clampGloryLWidthMm, GLORY_L_DEFAULTS, renderLabel, type LabelIr } from "./label-ir";
import { selectPrintPort, type PrintPort, type PrintPortResult } from "./print-ports";

export type PrintJobCreateInput = {
	batchId: string;
	sectionId: string;
	reprintOf?: string | null;
	/**
	 * Actual pcs in the completed pack (label truth). Defaults to the planned
	 * pack quantity when omitted; ISSUANCE posts expected=planned / actual=this
	 * so short/over packs surface as variance (RECORDED) instead of silently
	 * rounding to plan.
	 */
	actualQuantity?: number | null;
	/**
	 * Operator + machine snapshot for the Injection label face. Optional —
	 * when omitted the label omits the row instead of inventing a name.
	 * The preview resolves these from the session user + the line's
	 * admin-configured machines; the print call carries the resolved values.
	 */
	operatorName?: string | null;
	machineName?: string | null;
};

export type PrintJobRecord = {
	id: string;
	batchId: string;
	sectionId: string;
	barcodeValue: string;
	quantity: number;
	sequence: number;
	reprintOf: string | null;
	language: string;
	status: "SENT" | "SIMULATED" | "FAILED";
	failureReason: string | null;
	/**
	 * Origin-hop stage event recorded by this print, if any. Set only when a
	 * pre-route batch's first successful, route-aligned print advances it
	 * through its origin hop (print is handoff); null otherwise.
	 */
	originStageEventId: string | null;
};

/** Pre-floor marker for freshly minted Series batches (no Stage row). */
const PRE_ROUTE_STAGE_ID = "STG-PROJECTS";

export type PrintJobStore = {
	section: {
		findUnique: (args: { where: { id: string } }) => Promise<PrintJobStation | null>;
	};
	stageEvent: {
		create: (args: {
			data: {
				stageId: string;
				subStageId: string | null;
				eventType: "STAGE_SCAN_RECORDED";
				batchId: string;
				lotId: string;
				partId: string;
				quantity: number;
				occurredAt: Date;
				actor: string;
				isRoutingViolation: boolean;
				status: "ACCEPTED";
				routeStepId: string;
				actorSubjectId: string;
				quantityMagnitude: string;
				quantityUom: string;
				usageBasis: null;
				sourceRepresentation: string;
			};
		}) => Promise<{ id: string }>;
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
						project?: { select: { id: true; name: true; projectCode: true } };
					};
				};
				part: {
					select: { id: true; partName: true; partCode: true };
				};
			};
		}) => Promise<PrintJobBatch | null>;
		update: (args: {
			where: { id: string };
			data: { currentStageId: string; currentSubStageId: string | null; rowVersion: { increment: number } };
		}) => Promise<unknown>;
	};
	batchPositionProjection: {
		update: (args: {
			where: { batchId: string };
			data: {
				stageId: string;
				subStageId: string | null;
				routeStepId: string;
				lastEventId: string;
				positionStatus: "ACCEPTED";
				quantityMagnitude: string;
				quantityUom: string;
			};
		}) => Promise<unknown>;
	};
	printJob: {
		count: (args: {
			where: { batchId: string; sectionId: string; status?: { not: string } };
		}) => Promise<number>;
		findFirst: (args: {
			where: { id: string; batchId: string };
		}) => Promise<{ id: string } | null>;
		create: (args: {
			data: {
				batchId: string;
				sectionId: string;
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
				recordedAt: Date;
				recordedBy: string;
				recordedBySubjectId: string;
				status: string;
			};
		}) => Promise<{ id: string }>;
	};
	routingStep: {
		findMany: (args: {
			where: { partsListId: string; partId: string };
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
		project?: { id: string; name: string; projectCode: string } | null;
	};
	part: { id: string; partName: string; partCode: string };
	seriesNumber: number | null;
	seriesCount: number | null;
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
	return batch.plannedQuantity;
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
	/** Operator snapshot; omit/blank = the row is omitted, never invented. */
	operatorName?: string | null;
	/** Admin-configured machine name; omit/blank = the row is omitted. */
	machineName?: string | null;
	sequence: number;
	widthMm: number;
	heightMm: number;
	dpi: number;
	printedAt: string;
}): LabelIr {
	const part = input.batch.part;
	const operatorName = input.operatorName?.trim() ? input.operatorName.trim() : undefined;
	const machineName = input.machineName?.trim() ? input.machineName.trim() : undefined;
	return {
		barcodeValue: input.batch.barcodeValue,
		batchCode: input.batch.batchCode,
		lotCode: input.batch.lot.lotCode,
		serialNumber: input.batch.barcodeValue,
		seriesNumber: input.batch.seriesNumber,
		seriesCount: input.batch.seriesCount,
		partName: part.partName,
		partCode: part.partCode,
		projectName: input.batch.lot.project?.name,
		codename: input.batch.lot.project?.projectCode || part.partCode,
		quantity: input.quantity ?? quantityOf(input.batch),
		fromStepLabel: input.fromStepLabel,
		toStepLabel: input.toStepLabel,
		operatorName,
		machineName,
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
	const station = await store.section.findUnique({ where: { id: input.sectionId } });
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
					project: { select: { id: true, name: true, projectCode: true } },
				},
			},
			part: {
				select: { id: true, partName: true, partCode: true },
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

	const steps = await store.routingStep.findMany({
		where: {
			partsListId: batch.lot.partsListId,
			partId: batch.part.id,
		},
		orderBy: [{ stepOrder: "asc" }, { id: "asc" }],
	});
	const currentRouteStepId = batch.positionProjection?.routeStepId ?? null;
	const currentIndex = currentRouteStepId ? steps.findIndex((step) => step.id === currentRouteStepId) : -1;
	const threshold = currentIndex < 0 ? -1 : steps[currentIndex].stepOrder;
	const nextStep = steps.find((step) => step.stepOrder > threshold) ?? null;

	const fromStageId = batch.positionProjection?.stageId ?? batch.currentStageId;
	const fromSubStageId = batch.positionProjection?.subStageId ?? batch.currentSubStageId;
	const sequence = (await store.printJob.count({ where: { batchId: batch.id, sectionId: station.id } })) + 1;
	// Counted BEFORE this print is recorded: first SUCCESSFUL print issues (one
	// ISSUANCE per pack, ever). A FAILED attempt consumes a sequence but never
	// blocks the pack's issuance — its retry is a fresh print (seq 2+) and posts
	// the move then. Reprints (reprintOf set) never issue again.
	const priorSuccessfulPrints = await store.printJob.count({
		where: {
			batchId: batch.id,
			sectionId: station.id,
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
		operatorName: input.operatorName ?? undefined,
		machineName: input.machineName ?? undefined,
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
			sectionId: station.id,
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
		Boolean(batch.part.id) &&
		priorSuccessfulPrints === 0;
	if (shouldIssue && nextStep) {
		// Plan vs reality on the ledger: expected = planned pack quantity,
		// actual = the pcs the LL counted into the tray. Equal → ACCEPTED;
		// different → RECORDED (variance surfaces in Reports via the part's
		// varianceRule) — release is never blocked.
		const hasVariance = labelQuantity !== plannedQuantity;
		await store.inventoryTransaction.create({
			data: {
				transactionType: "ISSUANCE",
				batchId: batch.id,
				partId: batch.part.id,
				lotId: batch.lot.id,
				fromStageId,
				fromSubStageId,
				toStageId: nextStep.stageId,
				toSubStageId: nextStep.subStageId,
				expectedQuantity: plannedQuantity,
				actualQuantity: labelQuantity,
				recordedAt: new Date(),
				recordedBy: input.actor,
				recordedBySubjectId: input.actorSubjectId,
				status: hasVariance ? "RECORDED" : "ACCEPTED",
			},
		});
	}

	// Origin handoff: a pre-route batch's first successful, route-aligned print
	// also records its origin route hop. Freshly minted Series batches sit at
	// the STG-PROJECTS pre-floor marker with next = step 1, and the origin desk
	// has no scan loop (Injection has no Receiving), so no other writer can
	// advance them — without this, downstream arrival queues would never see
	// the work. The hop is always the expected next step, so it is ACCEPTED,
	// never a violation; misaligned sections and mid-route batches print
	// labels only. Atomic with the print job and issuance above.
	let originStageEventId: string | null = null;
	const preRouteStageId = batch.positionProjection?.stageId ?? batch.currentStageId;
	if (shouldIssue && nextStep && preRouteStageId === PRE_ROUTE_STAGE_ID && station.stageId === nextStep.stageId) {
		const originEvent = await store.stageEvent.create({
			data: {
				stageId: nextStep.stageId,
				subStageId: nextStep.subStageId,
				eventType: "STAGE_SCAN_RECORDED",
				batchId: batch.id,
				lotId: batch.lot.id,
				partId: batch.part.id,
				quantity: labelQuantity,
				occurredAt: new Date(),
				actor: input.actor,
				isRoutingViolation: false,
				status: "ACCEPTED",
				routeStepId: nextStep.id,
				actorSubjectId: input.actorSubjectId,
				quantityMagnitude: String(labelQuantity),
				quantityUom: "EA",
				usageBasis: null,
				sourceRepresentation: batch.barcodeValue,
			},
		});
		originStageEventId = originEvent.id;
		await store.batch.update({
			where: { id: batch.id },
			data: {
				currentStageId: nextStep.stageId,
				currentSubStageId: nextStep.subStageId,
				rowVersion: { increment: 1 },
			},
		});
		await store.batchPositionProjection.update({
			where: { batchId: batch.id },
			data: {
				stageId: nextStep.stageId,
				subStageId: nextStep.subStageId,
				routeStepId: nextStep.id,
				lastEventId: originEvent.id,
				positionStatus: "ACCEPTED",
				quantityMagnitude: String(labelQuantity),
				quantityUom: "EA",
			},
		});
	}

	return {
		id: created.id,
		batchId: batch.id,
		sectionId: station.id,
		barcodeValue: batch.barcodeValue,
		quantity: ir.quantity,
		sequence,
		reprintOf: input.reprintOf ?? null,
		language,
		status: delivered.status,
		failureReason: delivered.failureReason,
		originStageEventId,
	};
}
