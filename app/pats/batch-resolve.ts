import { CommandProblem } from "./command-support";

export const BATCH_RESOLVE_NOT_FOUND = "urn:bandai:pats:problem:not-found";
export const BATCH_RESOLVE_MALFORMED = "urn:bandai:pats:problem:malformed-request";

export type RouteStepRef = {
	routeStepId: string;
	stageId: string;
	subStageId: string | null;
	stepOrder: number;
};

export type BatchResolveBody = {
	batchId: string;
	batchCode: string;
	barcodeValue: string;
	lotId: string;
	lotCode: string;
	partId: string | null;
	partCode: string | null;
	partName: string | null;
	productName: string | null;
	modelName: string | null;
	plannedQuantity: number;
	carriedQuantity: number;
	labelPackSize: number;
	currentStageId: string;
	currentSubStageId: string | null;
	nextExpectedStep: RouteStepRef | null;
	routeComplete: boolean;
};

export type BatchResolveStore = {
	batch: {
		findFirst: (args: {
			where: { OR: Array<{ barcodeValue: string } | { batchCode: string }> };
			include: {
				positionProjection: true;
				lot: {
					select: {
						id: true;
						lotCode: true;
						partsListId: true;
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
			};
		}) => Promise<BatchResolveBatch | null>;
	};
	routingStep: {
		findMany: (args: {
			where: { partsListId: string; partId?: { in: string[] } };
			orderBy: Array<{ stepOrder: "asc" } | { id: "asc" }>;
			select: { id: true; stageId: true; subStageId: true; stepOrder: true; partId: true };
		}) => Promise<Array<BatchResolveRouteStep>>;
	};
};

export type BatchResolveBatch = {
	id: string;
	batchCode: string;
	barcodeValue: string;
	plannedQuantity: number;
	labelPackSize: number;
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
		project: { product: { productName: string } | null };
	};
	projectModelAllocation: { model: { modelName: string | null; modelNumber: string } } | null;
	parts: Array<{
		partId: string;
		quantity: number;
		part: { partName: string; partCode: string };
	}>;
};

export type BatchResolveRouteStep = {
	id: string;
	stageId: string;
	subStageId: string | null;
	stepOrder: number;
	partId: string;
};

export function parseBatchResolveCode(raw: unknown): string {
	const value = Array.isArray(raw) ? raw[0] : raw;
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new CommandProblem(400, BATCH_RESOLVE_MALFORMED, "Bad Request", "Query parameter code is required.");
	}
	return value.trim();
}

export function nextExpectedRouteStep(
	steps: readonly BatchResolveRouteStep[],
	currentRouteStepId: string | null,
): RouteStepRef | null {
	if (steps.length === 0) return null;
	const currentIndex = currentRouteStepId
		? steps.findIndex((step) => step.id === currentRouteStepId)
		: -1;
	const threshold = currentIndex < 0 ? -1 : steps[currentIndex].stepOrder;
	const expected = steps.find((step) => step.stepOrder > threshold);
	if (!expected) return null;
	return {
		routeStepId: expected.id,
		stageId: expected.stageId,
		subStageId: expected.subStageId,
		stepOrder: expected.stepOrder,
	};
}

function carriedQuantity(batch: BatchResolveBatch): number {
	const magnitude = batch.positionProjection?.quantityMagnitude;
	if (magnitude !== null && magnitude !== undefined) {
		const parsed = Number(typeof magnitude === "object" ? magnitude.toString() : magnitude);
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	const partQty = batch.parts[0]?.quantity;
	if (typeof partQty === "number" && partQty > 0) return partQty;
	return batch.plannedQuantity;
}

export async function resolveBatchByCode(
	database: BatchResolveStore,
	code: string,
): Promise<BatchResolveBody> {
	const batch = await database.batch.findFirst({
		where: { OR: [{ barcodeValue: code }, { batchCode: code }] },
		include: {
			positionProjection: true,
			lot: {
				select: {
					id: true,
					lotCode: true,
					partsListId: true,
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
		},
	});

	if (!batch) {
		throw new CommandProblem(404, BATCH_RESOLVE_NOT_FOUND, "Not Found", "No batch matches the scanned code.");
	}

	const partIds = batch.parts.map((part) => part.partId);
	const steps = await database.routingStep.findMany({
		where: {
			partsListId: batch.lot.partsListId,
			...(partIds.length > 0 ? { partId: { in: partIds } } : {}),
		},
		orderBy: [{ stepOrder: "asc" }, { id: "asc" }],
		select: { id: true, stageId: true, subStageId: true, stepOrder: true, partId: true },
	});

	const currentStageId = batch.positionProjection?.stageId ?? batch.currentStageId;
	const currentSubStageId = batch.positionProjection?.subStageId ?? batch.currentSubStageId;
	const nextExpectedStep = nextExpectedRouteStep(steps, batch.positionProjection?.routeStepId ?? null);
	const primaryPart = batch.parts[0];

	return {
		batchId: batch.id,
		batchCode: batch.batchCode,
		barcodeValue: batch.barcodeValue,
		lotId: batch.lot.id,
		lotCode: batch.lot.lotCode,
		partId: primaryPart?.partId ?? null,
		partCode: primaryPart?.part.partCode ?? null,
		partName: primaryPart?.part.partName ?? batch.lot.partName ?? null,
		productName: batch.lot.project.product?.productName ?? null,
		modelName:
			batch.projectModelAllocation?.model.modelName ??
			batch.projectModelAllocation?.model.modelNumber ??
			null,
		plannedQuantity: batch.plannedQuantity,
		carriedQuantity: carriedQuantity(batch),
		labelPackSize: batch.labelPackSize,
		currentStageId,
		currentSubStageId,
		nextExpectedStep,
		routeComplete: nextExpectedStep === null && steps.length > 0,
	};
}
