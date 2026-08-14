import { CommandProblem } from "./command-support";
import { listAllowedQualityStageIds, type QualityStageScopeStore } from "./quality-stage-scope";

export const QC_RESOLVE_NOT_FOUND = "urn:bandai:pats:problem:not-found";
export const QC_RESOLVE_MALFORMED = "urn:bandai:pats:problem:malformed-request";

const OPEN_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);
const CLOSED_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

export type QcResolveBlockReason = "NOT_FOUND" | "NOT_ALLOWED_STAGE" | "ALREADY_CLOSED" | "NO_CAPABILITY";

export type QcResolveBody = {
	batchId: string;
	batchCode: string;
	barcodeValue: string;
	lotId: string;
	lotCode: string;
	partId: string | null;
	partName: string | null;
	quantity: number;
	productName: string | null;
	modelName: string | null;
	gateStageId: string;
	inspectionId: string;
	inspectionStatus: string;
	rowVersion: number;
	created: boolean;
	canDecide: boolean;
	blockReason: QcResolveBlockReason | null;
	latestDecision: {
		decision: string;
		reasonCode: string | null;
		reasonNote: string | null;
	} | null;
};

export type QcResolveStore = QualityStageScopeStore & {
	batch: {
		findFirst: (args: {
			where: { OR: Array<{ barcodeValue: string } | { batchCode: string }> };
			include: {
				positionProjection: { select: { stageId: true; subStageId: true } };
				lot: {
					select: {
						id: true;
						lotCode: true;
						partName: true;
						project: { select: { product: { select: { productName: true } } } };
					};
				};
				projectModelAllocation: {
					select: { model: { select: { modelName: true; modelNumber: true } } };
				};
				parts: {
					orderBy: { partId: "asc" };
					take: 1;
					select: {
						partId: true;
						quantity: true;
						part: { select: { partName: true; partCode: true } };
					};
				};
				qualityInspections: {
					orderBy: Array<{ createdAt: "desc" } | { id: "desc" }>;
					include: {
						decisions: { orderBy: Array<{ decidedAt: "desc" } | { id: "desc" }>; take: 1 };
					};
				};
			};
		}) => Promise<QcResolveBatch | null>;
	};
	qualityInspection: {
		create: (args: {
			data: {
				batchId: string;
				stageId: string;
				subStageId: string | null;
				inspectedQuantity: number;
				inspectedBySubjectId: string;
				status: "OPEN";
			};
		}) => Promise<{ id: string; status: string; rowVersion: number }>;
	};
};

export type QcResolveBatch = {
	id: string;
	batchCode: string;
	barcodeValue: string;
	plannedQuantity: number;
	currentStageId: string;
	positionProjection: { stageId: string; subStageId: string | null } | null;
	lot: {
		id: string;
		lotCode: string;
		partName: string;
		project: { product: { productName: string } | null };
	};
	projectModelAllocation: { model: { modelName: string | null; modelNumber: string } } | null;
	parts: Array<{
		partId: string;
		quantity: number;
		part: { partName: string; partCode: string };
	}>;
	qualityInspections: Array<{
		id: string;
		stageId: string;
		status: string;
		rowVersion: number;
		decisions: Array<{
			decision: string;
			reasonCode: string | null;
			reasonNote: string | null;
		}>;
	}>;
};

function latestDecision(inspection: QcResolveBatch["qualityInspections"][number] | undefined) {
	const decision = inspection?.decisions[0];
	if (!decision) return null;
	return {
		decision: decision.decision,
		reasonCode: decision.reasonCode,
		reasonNote: decision.reasonNote,
	};
}

function identityFromBatch(batch: QcResolveBatch) {
	const primaryPart = batch.parts[0];
	return {
		batchId: batch.id,
		batchCode: batch.batchCode,
		barcodeValue: batch.barcodeValue,
		lotId: batch.lot.id,
		lotCode: batch.lot.lotCode,
		partId: primaryPart?.partId ?? null,
		partName: primaryPart?.part.partName ?? batch.lot.partName ?? null,
		quantity: primaryPart?.quantity ?? batch.plannedQuantity,
		productName: batch.lot.project.product?.productName ?? null,
		modelName:
			batch.projectModelAllocation?.model.modelName ??
			batch.projectModelAllocation?.model.modelNumber ??
			null,
	};
}

export function parseResolveCode(raw: unknown): string {
	const value = Array.isArray(raw) ? raw[0] : raw;
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new CommandProblem(400, QC_RESOLVE_MALFORMED, "Bad Request", "Query parameter code is required.");
	}
	return value.trim();
}

export async function resolveQualityInspectionByCode(
	database: QcResolveStore,
	input: { subjectId: string; code: string },
): Promise<QcResolveBody> {
	const code = input.code;
	const batch = await database.batch.findFirst({
		where: { OR: [{ barcodeValue: code }, { batchCode: code }] },
		include: {
			positionProjection: { select: { stageId: true, subStageId: true } },
			lot: {
				select: {
					id: true,
					lotCode: true,
					partName: true,
					project: { select: { product: { select: { productName: true } } } },
				},
			},
			projectModelAllocation: {
				select: { model: { select: { modelName: true, modelNumber: true } } },
			},
			parts: {
				orderBy: { partId: "asc" },
				take: 1,
				select: {
					partId: true,
					quantity: true,
					part: { select: { partName: true, partCode: true } },
				},
			},
			qualityInspections: {
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				include: { decisions: { orderBy: [{ decidedAt: "desc" }, { id: "desc" }], take: 1 } },
			},
		},
	});

	if (!batch) {
		throw new CommandProblem(404, QC_RESOLVE_NOT_FOUND, "Not Found", "No batch matches the scanned code.");
	}

	const allowed = await listAllowedQualityStageIds(database, input.subjectId);
	const open = batch.qualityInspections.find((inspection) => OPEN_STATUSES.has(inspection.status));
	const gateStageId = open?.stageId ?? batch.positionProjection?.stageId ?? batch.currentStageId;

	if (!allowed.includes(gateStageId)) {
		throw new CommandProblem(
			403,
			"urn:bandai:pats:problem:not-allowed-stage",
			"Forbidden",
			"The gate stage is not in this subject's allowedStages.",
		);
	}

	const identity = identityFromBatch(batch);

	if (open) {
		return {
			...identity,
			gateStageId,
			inspectionId: open.id,
			inspectionStatus: open.status,
			rowVersion: open.rowVersion,
			created: false,
			canDecide: true,
			blockReason: null,
			latestDecision: latestDecision(open),
		};
	}

	const closedAtGate = batch.qualityInspections.find(
		(inspection) => inspection.stageId === gateStageId && CLOSED_STATUSES.has(inspection.status),
	);
	if (closedAtGate) {
		return {
			...identity,
			gateStageId,
			inspectionId: closedAtGate.id,
			inspectionStatus: closedAtGate.status,
			rowVersion: closedAtGate.rowVersion,
			created: false,
			canDecide: false,
			blockReason: "ALREADY_CLOSED",
			latestDecision: latestDecision(closedAtGate),
		};
	}

	const created = await database.qualityInspection.create({
		data: {
			batchId: batch.id,
			stageId: gateStageId,
			subStageId: batch.positionProjection?.subStageId ?? null,
			inspectedQuantity: identity.quantity,
			inspectedBySubjectId: input.subjectId,
			status: "OPEN",
		},
	});

	return {
		...identity,
		gateStageId,
		inspectionId: created.id,
		inspectionStatus: created.status,
		rowVersion: created.rowVersion,
		created: true,
		canDecide: true,
		blockReason: null,
		latestDecision: null,
	};
}
