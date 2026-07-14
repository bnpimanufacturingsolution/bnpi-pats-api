import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import { ObjectStorageNotFoundError, type ObjectStorage } from "../storage/object-storage";

type PatsProductClient = Pick<PatsPrismaClient, "product">;

export class PatsCatalogStorageUnavailableError extends Error {
	public readonly code = "PATS_IMAGE_STORAGE_UNAVAILABLE";

	public constructor() {
		super("PATS image storage is unavailable");
		this.name = "PatsCatalogStorageUnavailableError";
	}
}

export function catalogController(
	patsPrisma: PatsProductClient,
	objectStorage: ObjectStorage,
) {
	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;
		const productId = req.params.productId;

		try {
			const product = await patsPrisma.product.findFirst({
				where: {
					id: productId,
					projects: { some: { workspaceId } },
				},
				include: {
					models: {
						orderBy: { modelNumber: "asc" },
						include: { modelParts: true },
					},
				},
			});

			if (!product) {
				res.status(404).json({
					success: false,
					message: "PATS product not found in this workspace",
					code: 404,
				});
				return;
			}

			const models = await Promise.all(product.models.map(async (model) => {
				const sourceReference = toPublicSourceReference(model.sourceReference);
				const imageObjectKey = getImageObjectKey(model.sourceReference);
				let imageUrl: string | null = null;

				if (imageObjectKey) {
					try {
						imageUrl = await objectStorage.createReadUrl(imageObjectKey);
					} catch (error) {
						if (!(error instanceof ObjectStorageNotFoundError)) {
							throw new PatsCatalogStorageUnavailableError();
						}
					}
				}

				return {
					modelId: model.id,
					productId: model.productId,
					modelNumber: model.modelNumber,
					modelName: model.modelName,
					sourceStatus: toApiSourceStatus(model.sourceStatus),
					sourceReference,
					skuCode: model.skuCode,
					imageUrl,
					pinned: model.pinned,
					updatedAt: model.updatedAt.toISOString(),
					modelParts: model.modelParts.map((part) => ({
						modelPartId: part.id,
						modelId: part.modelId,
						partCode: part.partCode,
						partName: part.partName,
						routingSteps: normalizeRoutingSteps(part.routingSteps),
					})),
				};
			}));

			res.status(200).json({
				success: true,
				data: {
					productId: product.id,
					productCode: product.productCode,
					productName: product.productName,
					createdAt: product.createdAt.toISOString(),
					updatedAt: product.updatedAt.toISOString(),
					models,
				},
			});
		} catch (error) {
			if (error instanceof PatsCatalogStorageUnavailableError) {
				res.status(503).json({
					success: false,
					message: error.message,
					code: 503,
					errorCode: error.code,
				});
				return;
			}

			next(error);
		}
	};
}

function getImageObjectKey(sourceReference: unknown): string | null {
	if (!isRecord(sourceReference) || typeof sourceReference.imageObjectKey !== "string") return null;
	return sourceReference.imageObjectKey;
}

function toPublicSourceReference(sourceReference: unknown): Record<string, unknown> | null {
	if (!isRecord(sourceReference)) return null;
	const { imageObjectKey: _imageObjectKey, ...publicReference } = sourceReference;
	return Object.keys(publicReference).length > 0 ? publicReference : null;
}

function toApiSourceStatus(sourceStatus: unknown): string {
	const statuses: Record<string, string> = {
		SOURCE_ALIGNED: "source-aligned",
		NEEDS_CONFIRMATION: "needs-confirmation",
		MANUAL: "manual",
	};
	return statuses[String(sourceStatus)] ?? String(sourceStatus);
}

function normalizeRoutingSteps(value: unknown): Array<{ stageId: string; subStageId: string | null }> {
	if (!Array.isArray(value)) return [];

	return value.flatMap((step) => {
		if (!isRecord(step) || typeof step.stageId !== "string") return [];
		return [{
			stageId: step.stageId,
			subStageId: typeof step.subStageId === "string" ? step.subStageId : null,
		}];
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
