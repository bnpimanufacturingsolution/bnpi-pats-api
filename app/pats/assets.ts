import { createHash, randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma, type PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import {
	ObjectStorageNotFoundError,
	assertApprovedObjectKey,
	type ObjectStorage,
} from "../storage/object-storage";
import {
	executeIdempotently,
	type IdempotencyResponse,
	type IdempotencyResult,
	type IdempotencyStore,
} from "../canonical/idempotency";

type AssetsDatabase = Pick<PatsPrismaClient, "asset" | "model">;

type AssetStatus = "REQUESTED" | "UPLOAD_REQUESTED" | "AVAILABLE" | "QUARANTINED" | "RETIRED";

interface AssetRow {
	id: string;
	ownerType: "MODEL";
	ownerId: string;
	objectKey: string;
	contentType: string;
	size: number;
	checksumSha256: string;
	status: AssetStatus;
	rowVersion: number;
	createdAt: Date;
	updatedAt: Date;
}

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const UPLOAD_URL_EXPIRY_SECONDS = 300;

const assetCreateSchema = z
	.object({
		ownerType: z.literal("model"),
		ownerId: z.string().trim().min(1).max(100),
		contentType: z
			.string()
			.trim()
			.refine(
				(value) => value in ALLOWED_CONTENT_TYPES,
				"contentType must be one of image/png, image/jpeg, image/webp.",
			),
		size: z.number().int().min(1).max(MAX_IMAGE_BYTES),
		checksumSha256: z
			.string()
			.trim()
			.regex(/^[0-9a-f]{64}$/i, "checksumSha256 must be a lowercase hex sha256 digest."),
	})
	.strict();

const assetFinalizeSchema = z
	.object({ finalize: z.literal(true) })
	.strict();

class AssetProblem extends Error {
	public constructor(
		public readonly status: number,
		public readonly type: string,
		public readonly title: string,
		detail: string,
		public readonly errors?: Array<{ field: string; message: string }>,
	) {
		super(detail);
		this.name = "AssetProblem";
	}

	public get detail(): string {
		return this.message;
	}
}

function requestInstance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function sendProblem(req: Request, res: Response, problem: AssetProblem): void {
	res.type("application/problem+json")
		.status(problem.status)
		.json({
			type: problem.type,
			title: problem.title,
			status: problem.status,
			detail: problem.detail,
			instance: requestInstance(req),
			...(problem.errors ? { errors: problem.errors } : {}),
		});
}

function storageUnavailable(): AssetProblem {
	return new AssetProblem(
		503,
		"urn:bandai:pats:problem:dependency-unavailable",
		"Dependency Unavailable",
		"The asset service is temporarily unavailable. Please try again later.",
	);
}

function parseBody<T>(req: Request, schema: z.ZodSchema<T>): T {
	const result = schema.safeParse(req.body);
	if (result.success) return result.data;

	throw new AssetProblem(
		422,
		"urn:bandai:pats:problem:validation-error",
		"Validation Failed",
		"The request body contains invalid asset data.",
		result.error.issues.map((issue) => ({
			field: issue.path.join(".") || "body",
			message: issue.message,
		})),
	);
}

function requireIfMatch(req: Request): number {
	const value = req.header("If-Match");
	const match = value?.match(/^"(\d+)"$/);
	if (!match) {
		throw new AssetProblem(
			412,
			"urn:bandai:pats:problem:precondition-failed",
			"Precondition Failed",
			"If-Match must contain the current asset row version.",
		);
	}

	return Number(match[1]);
}

function setVersionHeaders(res: Response, rowVersion: number): void {
	res.setHeader("ETag", `"${rowVersion}"`);
}

function toApiStatus(status: AssetStatus): string {
	return status.toLowerCase().replace(/_/g, "-");
}

function serializeAsset(asset: AssetRow): Record<string, unknown> {
	return {
		assetId: asset.id,
		ownerType: asset.ownerType.toLowerCase(),
		ownerId: asset.ownerId,
		contentType: asset.contentType,
		size: asset.size,
		checksumSha256: asset.checksumSha256,
		status: toApiStatus(asset.status),
		rowVersion: asset.rowVersion,
		createdAt: asset.createdAt.toISOString(),
		updatedAt: asset.updatedAt.toISOString(),
	};
}

function objectKeyFor(ownerId: string, assetId: string, contentType: string): string {
	const extension = ALLOWED_CONTENT_TYPES[contentType] ?? "bin";
	const key = `pats/models/${ownerId}/${assetId}.${extension}`;
	assertApprovedObjectKey(key);
	return key;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function inTransaction<T>(
	database: AssetsDatabase,
	work: (transaction: AssetsDatabase) => Promise<T>,
): Promise<T> {
	const candidate = database as unknown as {
		$transaction?: (callback: (transaction: AssetsDatabase) => Promise<T>) => Promise<T>;
	};

	return candidate.$transaction ? candidate.$transaction(work) : work(database);
}

async function readAsset(database: AssetsDatabase, assetId: string): Promise<AssetRow | null> {
	const asset = await database.asset.findUnique({ where: { id: assetId } });
	if (!asset || asset.status === "RETIRED") return null;
	return asset as AssetRow;
}

function isIdempotencyFailure(
	result: IdempotencyResult,
): result is Extract<IdempotencyResult, { ok: false }> {
	return "ok" in result && result.ok === false;
}

function handleRouteError(error: unknown, req: Request, res: Response, next: NextFunction): void {
	if (error instanceof z.ZodError) {
		sendProblem(
			req,
			res,
			new AssetProblem(
				422,
				"urn:bandai:pats:problem:validation-error",
				"Validation Failed",
				"The request body contains invalid asset data.",
				error.issues.map((issue) => ({
					field: issue.path.join(".") || "body",
					message: issue.message,
				})),
			),
		);
		return;
	}
	if (error instanceof AssetProblem) {
		if (error.status === 503) console.error("PATS asset storage unavailable:", error);
		sendProblem(req, res, error);
		return;
	}
	if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
		sendProblem(
			req,
			res,
			new AssetProblem(
				409,
				"urn:bandai:pats:problem:conflict",
				"Conflict",
				"The asset business identifier is already in use.",
			),
		);
		return;
	}
	next(error);
}

export interface AssetsRouterOptions {
	idempotencyStore?: IdempotencyStore;
}

class InMemoryAssetIdempotencyStore implements IdempotencyStore {
	private readonly records = new Map<string, import("../canonical/idempotency").IdempotencyRecord>();

	public async reserve(
		scope: import("../canonical/idempotency").IdempotencyScope & { key: string },
	): Promise<
		| { kind: "reserved"; reservation: string }
		| { kind: "existing"; record: import("../canonical/idempotency").IdempotencyRecord }
	> {
		const reservation = `${scope.actorId}:${scope.operation}:${scope.key}`;
		const existing = this.records.get(reservation);
		return existing
			? { kind: "existing", record: existing }
			: { kind: "reserved", reservation };
	}

	public async persist(
		reservation: unknown,
		record: import("../canonical/idempotency").IdempotencyRecord,
	): Promise<void> {
		this.records.set(String(reservation), record);
	}
}

export function assetsRouter(
	database: AssetsDatabase,
	objectStorage: ObjectStorage,
	options: AssetsRouterOptions = {},
): Router {
	const router = Router();
	const idempotencyStore = options.idempotencyStore ?? new InMemoryAssetIdempotencyStore();

	/**
	 * @openapi
	 * /api/v1/assets:
	 *   post:
	 *     operationId: assetCreate
	 *     summary: Register a model image asset for direct upload
	 *     tags: [PATS Assets]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201:
	 *         description: Asset metadata registered; no bytes stored yet
	 *       401:
	 *         description: Authentication required
	 *       403:
	 *         description: catalog.manage capability required
	 *       404:
	 *         description: Owning model not found
	 *       409:
	 *         description: Idempotency payload conflict
	 *       422:
	 *         description: Invalid asset declaration
	 */
	router.post("/", async (req, res, next) => {
		try {
			const body = parseBody(req, assetCreateSchema);
			const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
			const actorId =
				(req as Request & { canonicalSubject?: { id?: string } }).canonicalSubject?.id ??
				"canonical-subject";
			const result: IdempotencyResult = await executeIdempotently(
				idempotencyStore,
				{ actorId, operation: "assets.create", key: req.header("Idempotency-Key"), requestHash },
				async (): Promise<IdempotencyResponse> => {
					const owner = await database.model.findUnique({
						where: { id: body.ownerId },
						select: { id: true },
					});
					if (!owner) {
						throw new AssetProblem(
							404,
							"urn:bandai:pats:problem:not-found",
							"Not Found",
							"The owning model was not found.",
						);
					}

					const assetId = randomUUID();
					const created = (await database.asset.create({
						data: {
							id: assetId,
							ownerType: "MODEL",
							ownerId: body.ownerId,
							objectKey: objectKeyFor(body.ownerId, assetId, body.contentType),
							contentType: body.contentType,
							size: body.size,
							checksumSha256: body.checksumSha256.toLowerCase(),
							status: "REQUESTED",
						},
					})) as AssetRow;

					return {
						status: 201,
						body: serializeAsset(created),
						headers: {
							Location: `/api/v1/assets/${created.id}`,
							ETag: `"${created.rowVersion}"`,
						},
					};
				},
			);

			if (isIdempotencyFailure(result)) {
				sendProblem(
					req,
					res,
					new AssetProblem(
						result.status,
						result.problemType,
						result.status === 409 ? "Conflict" : "Bad Request",
						result.status === 409
							? "The Idempotency-Key was already used with a different request payload."
							: "A valid Idempotency-Key header is required for asset creation.",
					),
				);
				return;
			}

			for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
			res.status(result.status).json(result.body);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/assets/{assetId}/upload-requests:
	 *   post:
	 *     operationId: assetUploadRequestCreate
	 *     summary: Issue a short-lived direct-upload URL for an asset
	 *     tags: [PATS Assets]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: assetId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Short-lived upload URL issued; safe to retry
	 *       401:
	 *         description: Authentication required
	 *       403:
	 *         description: catalog.manage capability required
	 *       404:
	 *         description: Asset not found
	 *       409:
	 *         description: Asset already finalized, quarantined, or retired
	 *       503:
	 *         description: Object storage unavailable
	 */
	router.post("/:assetId/upload-requests", async (req, res, next) => {
		try {
			const asset = await readAsset(database, req.params.assetId);
			if (!asset) {
				throw new AssetProblem(
					404,
					"urn:bandai:pats:problem:not-found",
					"Not Found",
					"The requested asset was not found.",
				);
			}
			if (asset.status !== "REQUESTED" && asset.status !== "UPLOAD_REQUESTED") {
				throw new AssetProblem(
					409,
					"urn:bandai:pats:problem:conflict",
					"Conflict",
					`The asset is ${toApiStatus(asset.status)} and no longer accepts uploads.`,
				);
			}

			let upload: { url: string; expiresAt: string };
			try {
				upload = await objectStorage.createUploadUrl(asset.objectKey, {
					contentType: asset.contentType,
					expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
				});
			} catch (error) {
				throw storageUnavailable();
			}

			const updated = (await database.asset.update({
				where: { id: asset.id },
				data: { status: "UPLOAD_REQUESTED" },
			})) as AssetRow;

			setVersionHeaders(res, updated.rowVersion);
			res.type("application/json").status(200).json({
				assetId: updated.id,
				uploadUrl: upload.url,
				uploadHeaders: { "Content-Type": updated.contentType },
				expiresAt: upload.expiresAt,
				rowVersion: updated.rowVersion,
			});
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/assets/{assetId}:
	 *   patch:
	 *     operationId: assetFinalize
	 *     summary: Verify uploaded bytes and link the asset to its model
	 *     tags: [PATS Assets]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: assetId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Bytes verified; model image linked
	 *       401:
	 *         description: Authentication required
	 *       403:
	 *         description: catalog.manage capability required
	 *       404:
	 *         description: Asset not found
	 *       409:
	 *         description: Asset already finalized, quarantined, or retired
	 *       412:
	 *         description: Stale or missing If-Match
	 *       422:
	 *         description: Bytes missing or failed verification
	 *       503:
	 *         description: Object storage unavailable
	 */
	router.patch("/:assetId", async (req, res, next) => {
		try {
			const body = parseBody(req, assetFinalizeSchema);
			void body;
			const expectedVersion = requireIfMatch(req);
			const asset = await readAsset(database, req.params.assetId);
			if (!asset) {
				throw new AssetProblem(
					404,
					"urn:bandai:pats:problem:not-found",
					"Not Found",
					"The requested asset was not found.",
				);
			}
			if (asset.rowVersion !== expectedVersion) {
				throw new AssetProblem(
					412,
					"urn:bandai:pats:problem:precondition-failed",
					"Precondition Failed",
					"The asset changed since the supplied If-Match version.",
				);
			}
			if (asset.status !== "REQUESTED" && asset.status !== "UPLOAD_REQUESTED") {
				throw new AssetProblem(
					409,
					"urn:bandai:pats:problem:conflict",
					"Conflict",
					`The asset is ${toApiStatus(asset.status)} and cannot be finalized.`,
				);
			}

			let stored: { body: Uint8Array; contentType: string; size: number; checksumSha256: string };
			try {
				stored = await objectStorage.getObject(asset.objectKey);
			} catch (error) {
				if (error instanceof ObjectStorageNotFoundError) {
					throw new AssetProblem(
						422,
						"urn:bandai:pats:problem:validation-error",
						"Validation Failed",
						"No bytes were uploaded for this asset yet.",
						[{ field: "upload", message: "Upload the declared bytes, then finalize again." }],
					);
				}
				throw storageUnavailable();
			}

			const mismatch =
				stored.size !== asset.size ||
				stored.contentType !== asset.contentType ||
				stored.checksumSha256.toLowerCase() !== asset.checksumSha256.toLowerCase();
			if (mismatch) {
				const quarantined = (await database.asset.update({
					where: { id: asset.id },
					data: { status: "QUARANTINED", rowVersion: { increment: 1 } },
				})) as AssetRow;
				setVersionHeaders(res, quarantined.rowVersion);
				throw new AssetProblem(
					422,
					"urn:bandai:pats:problem:validation-error",
					"Validation Failed",
					"The uploaded bytes do not match the declared asset. The asset is quarantined.",
					[{ field: "upload", message: "Re-upload matching bytes for a new asset." }],
				);
			}

			const finalized = await inTransaction(database, async (tx) => {
				const available = (await tx.asset.update({
					where: { id: asset.id },
					data: { status: "AVAILABLE", rowVersion: { increment: 1 } },
				})) as AssetRow;

				const model = await tx.model.findUnique({
					where: { id: asset.ownerId },
					select: { id: true, rowVersion: true, sourceReference: true },
				});
				if (!model) {
					throw new AssetProblem(
						404,
						"urn:bandai:pats:problem:not-found",
						"Not Found",
						"The owning model was not found.",
					);
				}
				const currentReference = isRecord(model.sourceReference) ? model.sourceReference : {};
				const previousKey =
					typeof currentReference.imageObjectKey === "string"
						? currentReference.imageObjectKey
						: null;
				const linked = await tx.model.update({
					where: { id: model.id },
					data: {
						sourceReference: {
							...currentReference,
							imageObjectKey: asset.objectKey,
						} as Prisma.InputJsonValue,
						rowVersion: { increment: 1 },
					},
					select: { rowVersion: true },
				});

				const superseded = await tx.asset.findMany({
					where: {
						ownerType: "MODEL",
						ownerId: asset.ownerId,
						status: "AVAILABLE",
						id: { not: asset.id },
					},
					select: { id: true, objectKey: true },
				});
				if (superseded.length > 0) {
					await tx.asset.updateMany({
						where: { id: { in: superseded.map((row) => row.id) } },
						data: { status: "RETIRED", rowVersion: { increment: 1 } },
					});
				}

				return {
					available,
					modelRowVersion: linked.rowVersion,
					supersededKeys: [
						...superseded.map((row) => row.objectKey),
						...(previousKey && previousKey !== asset.objectKey ? [previousKey] : []),
					],
				};
			});

			for (const key of finalized.supersededKeys) {
				try {
					await objectStorage.deleteObject(key);
				} catch (error) {
					console.error("PATS asset superseded-byte cleanup failed:", { key });
				}
			}

			let readUrl: string;
			try {
				readUrl = await objectStorage.createReadUrl(asset.objectKey);
			} catch (error) {
				throw storageUnavailable();
			}

			setVersionHeaders(res, finalized.available.rowVersion);
			res.type("application/json").status(200).json({
				...serializeAsset(finalized.available),
				readUrl,
				modelRowVersion: finalized.modelRowVersion,
			});
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/assets/{assetId}:
	 *   get:
	 *     operationId: assetGet
	 *     summary: Read asset metadata with a short-lived read URL
	 *     tags: [PATS Assets]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: assetId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Asset metadata; readUrl is null until available
	 *       401:
	 *         description: Authentication required
	 *       403:
	 *         description: catalog.read capability required
	 *       404:
	 *         description: Asset not found
	 *       503:
	 *         description: Object storage unavailable
	 */
	router.get("/:assetId", async (req, res, next) => {
		try {
			res.setHeader("Cache-Control", "no-store");
			const asset = await readAsset(database, req.params.assetId);
			if (!asset) {
				throw new AssetProblem(
					404,
					"urn:bandai:pats:problem:not-found",
					"Not Found",
					"The requested asset was not found.",
				);
			}

			let readUrl: string | null = null;
			if (asset.status === "AVAILABLE") {
				try {
					readUrl = await objectStorage.createReadUrl(asset.objectKey);
				} catch (error) {
					if (error instanceof ObjectStorageNotFoundError) {
						readUrl = null;
					} else {
						throw storageUnavailable();
					}
				}
			}

			setVersionHeaders(res, asset.rowVersion);
			res.type("application/json").status(200).json({ data: { ...serializeAsset(asset), readUrl } });
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/assets/{assetId}:
	 *   delete:
	 *     operationId: assetDelete
	 *     summary: Retire an asset and unlink it from its model
	 *     tags: [PATS Assets]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: assetId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       204:
	 *         description: Asset retired; bytes retained under review
	 *       401:
	 *         description: Authentication required
	 *       403:
	 *         description: catalog.manage capability required
	 *       404:
	 *         description: Asset not found
	 *       412:
	 *         description: Stale or missing If-Match
	 */
	router.delete("/:assetId", async (req, res, next) => {
		try {
			const expectedVersion = requireIfMatch(req);
			const asset = await readAsset(database, req.params.assetId);
			if (!asset) {
				throw new AssetProblem(
					404,
					"urn:bandai:pats:problem:not-found",
					"Not Found",
					"The requested asset was not found.",
				);
			}
			if (asset.rowVersion !== expectedVersion) {
				throw new AssetProblem(
					412,
					"urn:bandai:pats:problem:precondition-failed",
					"Precondition Failed",
					"The asset changed since the supplied If-Match version.",
				);
			}

			await inTransaction(database, async (tx) => {
				await tx.asset.update({
					where: { id: asset.id },
					data: { status: "RETIRED", rowVersion: { increment: 1 } },
				});

				const model = await tx.model.findUnique({
					where: { id: asset.ownerId },
					select: { id: true, sourceReference: true },
				});
				if (model && isRecord(model.sourceReference)) {
					const { imageObjectKey, ...rest } = model.sourceReference as Record<string, unknown> & {
						imageObjectKey?: unknown;
					};
					if (imageObjectKey === asset.objectKey) {
						await tx.model.update({
							where: { id: model.id },
							data: {
								sourceReference:
									Object.keys(rest).length > 0 ? (rest as Prisma.InputJsonValue) : Prisma.DbNull,
								rowVersion: { increment: 1 },
							},
						});
					}
				}
			});

			res.status(204).send();
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	router.use(handleRouteError);

	// Express falls through to these only when no method route above matched.
	router.all("/", (req, res) => methodNotAllowed(req, res, "POST"));
	router.all("/:assetId/upload-requests", (req, res) => methodNotAllowed(req, res, "POST"));
	router.all("/:assetId", (req, res) => methodNotAllowed(req, res, "GET, PATCH, DELETE"));

	return router;
}

function methodNotAllowed(req: Request, res: Response, allow: string): void {
	res.setHeader("Allow", allow);
	sendProblem(
		req,
		res,
		new AssetProblem(
			405,
			"urn:bandai:pats:problem:method-not-allowed",
			"Method Not Allowed",
			"The requested method is not supported for this asset route.",
		),
	);
}
