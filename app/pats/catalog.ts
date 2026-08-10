import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import {
	buildOffsetPage,
	parseOffsetPagination,
	parseSort,
	type SortField,
} from "../canonical/collection";
import { ObjectStorageNotFoundError, type ObjectStorage } from "../storage/object-storage";

type PatsProductClient = Pick<PatsPrismaClient, "product">;

const PRODUCT_SORT_FIELDS = [
	"product_code",
	"product_name",
	"created_at",
	"updated_at",
] as const;

const PRODUCT_SORT_COLUMNS: Record<string, string> = {
	product_code: "productCode",
	product_name: "productName",
	created_at: "createdAt",
	updated_at: "updatedAt",
	id: "id",
};

export interface PatsCatalogControllerOptions {
	/** A value means the transitional route is workspace-scoped; omitted means deployment-scoped. */
	workspaceId?: string;
	canonical?: boolean;
}

export class PatsCatalogStorageUnavailableError extends Error {
	public readonly code = "PATS_IMAGE_STORAGE_UNAVAILABLE";

	public constructor() {
		super("PATS image storage is unavailable");
		this.name = "PatsCatalogStorageUnavailableError";
	}
}

/**
 * Canonical deployment-scoped product summaries. This deliberately exposes
 * only normalized catalog fields; models and private evidence references are
 * read through the product detail resource.
 */
export function catalogProductCollectionController(patsPrisma: PatsProductClient) {
	return async (req: Request, res: Response): Promise<void> => {
		res.setHeader("Cache-Control", "no-store");
		const query = req.query as Record<string, string | string[] | undefined>;
		const unsupportedQueryKey = Object.keys(query).find(
			(key) => !["page", "limit", "sort"].includes(key),
		);
		const sortQuery = query.sort;
		const pagination = parseOffsetPagination({ page: query.page, limit: query.limit });
		const sorting = Array.isArray(sortQuery)
			? { ok: false as const, problemType: "urn:bandai:pats:problem:malformed-request", status: 400 as const }
			: parseSort(sortQuery, PRODUCT_SORT_FIELDS);

		if (
			unsupportedQueryKey ||
			"ok" in pagination ||
			"ok" in sorting
		) {
			res.type("application/problem+json").status(400).json({
				type: "urn:bandai:pats:problem:malformed-request",
				title: "Bad Request",
				status: 400,
				detail: "The catalog collection query is invalid.",
				instance: req.originalUrl.split("?", 1)[0],
			});
			return;
		}

		const orderBy = (sorting as SortField[]).map(({ field, direction }) => ({
			[PRODUCT_SORT_COLUMNS[field]]: direction,
		}));

		try {
			const [totalItems, products] = await Promise.all([
				patsPrisma.product.count(),
				patsPrisma.product.findMany({
					skip: (pagination.page - 1) * pagination.limit,
					take: pagination.limit,
					orderBy: orderBy as never,
					select: {
						id: true,
						productCode: true,
						productName: true,
						lifecycleStatus: true,
						evidenceStatus: true,
						createdAt: true,
						updatedAt: true,
					},
				}),
			]);

			const data = products.map((product) => ({
				productId: product.id,
				productCode: product.productCode,
				productName: product.productName,
				lifecycleStatus: product.lifecycleStatus,
				evidenceStatus: product.evidenceStatus,
				createdAt: product.createdAt.toISOString(),
				updatedAt: product.updatedAt.toISOString(),
			}));

			res.type("application/json").status(200).json(buildOffsetPage(data, pagination, totalItems));
		} catch {
			res.type("application/problem+json").status(503).json({
				type: "urn:bandai:pats:problem:dependency-unavailable",
				title: "Dependency Unavailable",
				status: 503,
				detail: "PATS catalog data is unavailable.",
				instance: req.originalUrl.split("?", 1)[0],
			});
		}
	};
}

export function catalogController(
	patsPrisma: PatsProductClient,
	objectStorage: ObjectStorage,
	options: PatsCatalogControllerOptions = {},
) {
	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		res.setHeader("Cache-Control", "no-store");
		const productId = req.params.productId;

		try {
			const workspaceId = options.workspaceId ?? (req as Request & { workspaceId?: string }).workspaceId;
			const product = await patsPrisma.product.findFirst({
				where: workspaceId
					? { id: productId, projects: { some: { workspaceId } } }
					: { id: productId },
				include: {
					models: {
						orderBy: { modelNumber: "asc" },
						include: { modelParts: true },
					},
				},
			});

			if (!product) {
				if (options.canonical) {
					res.type("application/problem+json").status(404).json({
						type: "urn:bandai:pats:problem:not-found",
						title: "Not Found",
						status: 404,
						detail: "The requested PATS catalog product was not found.",
						instance: req.originalUrl.split("?", 1)[0],
					});
					return;
				}

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
					...(options.canonical
						? {
								lifecycleStatus: model.lifecycleStatus,
								evidenceStatus: model.evidenceStatus,
								rowVersion: model.rowVersion,
							}
						: {}),
					imageUrl,
					pinned: model.pinned,
					updatedAt: model.updatedAt.toISOString(),
					modelParts: model.modelParts.map((part) => ({
						modelPartId: part.id,
						modelId: part.modelId,
						partCode: part.partCode,
						partName: part.partName,
						...(options.canonical
							? {
									lifecycleStatus: part.lifecycleStatus,
									evidenceStatus: part.evidenceStatus,
									rowVersion: part.rowVersion,
								}
							: {}),
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
					...(options.canonical
						? {
								lifecycleStatus: product.lifecycleStatus,
								evidenceStatus: product.evidenceStatus,
								rowVersion: product.rowVersion,
							}
						: {}),
					createdAt: product.createdAt.toISOString(),
					updatedAt: product.updatedAt.toISOString(),
					models,
				},
			});
		} catch (error) {
			if (error instanceof PatsCatalogStorageUnavailableError) {
				if (options.canonical) {
					res.type("application/problem+json").status(503).json({
						type: "urn:bandai:pats:problem:dependency-unavailable",
						title: "Dependency Unavailable",
						status: 503,
						detail: error.message,
						instance: req.originalUrl.split("?", 1)[0],
					});
					return;
				}

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
