import { createHash } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
	CanonicalEvidenceStatus,
	CatalogLifecycleStatus,
	PrismaClient as PatsPrismaClient,
	ProductSourceStatus,
} from "../../generated/pats-client";
import {
	executeIdempotently,
	type IdempotencyRecord,
	type IdempotencyResponse,
	type IdempotencyResult,
	type IdempotencyScope,
	type IdempotencyStore,
} from "../canonical/idempotency";

type CatalogDatabase = Pick<
	PatsPrismaClient,
	"product" | "model" | "modelPart" | "sourceEvidence" | "canonicalEvidenceLink"
>;

const evidenceStatuses = [
	"CONFIRMED",
	"INFERRED",
	"PROVISIONAL",
	"SOURCE_ANOMALY",
	"UNAVAILABLE_DEPENDENCY",
	"NEEDS_CONFIRMATION",
	"CONFLICTING",
	"STALE",
] as const;

const evidenceStatusSchema = z.enum(evidenceStatuses);
const sourceEvidenceIdsSchema = z
	.array(z.string().trim().min(1).max(100))
	.max(100)
	.refine((ids) => new Set(ids).size === ids.length, "Source evidence IDs must be unique.");

const productCreateSchema = z
	.object({
		productCode: z.string().trim().min(1).max(120),
		productName: z.string().trim().min(1).max(240),
		evidenceStatus: evidenceStatusSchema.optional(),
		sourceEvidenceIds: sourceEvidenceIdsSchema.optional(),
	})
	.strict();

const productPatchSchema = z
	.object({
		productCode: z.string().trim().min(1).max(120).optional(),
		productName: z.string().trim().min(1).max(240).optional(),
		evidenceStatus: evidenceStatusSchema.optional(),
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

const modelCreateSchema = z
	.object({
		productId: z.string().trim().min(1).max(100),
		modelNumber: z.string().trim().min(1).max(120),
		modelName: z.string().trim().max(240).nullable().optional(),
		skuCode: z.string().trim().max(120).nullable().optional(),
		evidenceStatus: evidenceStatusSchema.optional(),
		sourceEvidenceIds: sourceEvidenceIdsSchema.optional(),
	})
	.strict();

const modelPatchSchema = z
	.object({
		modelNumber: z.string().trim().min(1).max(120).optional(),
		modelName: z.string().trim().max(240).nullable().optional(),
		skuCode: z.string().trim().max(120).nullable().optional(),
		pinned: z.boolean().optional(),
		evidenceStatus: evidenceStatusSchema.optional(),
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

const modelPartCreateSchema = z
	.object({
		modelId: z.string().trim().min(1).max(100),
		partCode: z.string().trim().min(1).max(120),
		partName: z.string().trim().min(1).max(240),
		evidenceStatus: evidenceStatusSchema.optional(),
		sourceEvidenceIds: sourceEvidenceIdsSchema.optional(),
	})
	.strict();

const modelPartPatchSchema = z
	.object({
		partCode: z.string().trim().min(1).max(120).optional(),
		partName: z.string().trim().min(1).max(240).optional(),
		evidenceStatus: evidenceStatusSchema.optional(),
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

type EvidenceStatusValue = (typeof evidenceStatuses)[number];
type EvidenceSubjectType = "PRODUCT" | "MODEL" | "MODEL_PART";

class InMemoryCatalogIdempotencyStore implements IdempotencyStore {
	private readonly records = new Map<string, IdempotencyRecord>();

	public async reserve(
		scope: Required<IdempotencyScope>,
	): Promise<
		{ kind: "reserved"; reservation: string } | { kind: "existing"; record: IdempotencyRecord }
	> {
		const reservation = this.key(scope);
		const existing = this.records.get(reservation);
		return existing
			? { kind: "existing", record: existing }
			: { kind: "reserved", reservation };
	}

	public async persist(reservation: unknown, record: IdempotencyRecord): Promise<void> {
		this.records.set(String(reservation), record);
	}

	private key(scope: Required<IdempotencyScope>): string {
		return `${scope.actorId}:${scope.operation}:${scope.key}`;
	}
}

export interface CatalogFoundationRouterOptions {
	/** The durable Prisma-backed store is a later platform boundary; this default protects retries within one process. */
	idempotencyStore?: IdempotencyStore;
}

class CatalogProblem extends Error {
	public constructor(
		public readonly status: number,
		public readonly type: string,
		public readonly title: string,
		detail: string,
		public readonly errors?: Array<{ field: string; message: string }>,
	) {
		super(detail);
		this.name = "CatalogProblem";
	}

	public get detail(): string {
		return this.message;
	}
}

function requestInstance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function sendProblem(req: Request, res: Response, problem: CatalogProblem): void {
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

function parseBody<T>(req: Request, schema: z.ZodSchema<T>): T {
	const result = schema.safeParse(req.body);
	if (result.success) return result.data;

	throw new CatalogProblem(
		422,
		"urn:bandai:pats:problem:validation-error",
		"Validation Failed",
		"The request body contains invalid catalog data.",
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
		throw new CatalogProblem(
			412,
			"urn:bandai:pats:problem:precondition-failed",
			"Precondition Failed",
			"If-Match must contain the current catalog row version.",
		);
	}

	return Number(match[1]);
}

function setVersionHeaders(res: Response, rowVersion: number): void {
	res.setHeader("ETag", `"${rowVersion}"`);
}

function isEvidenceStatus(value: EvidenceStatusValue): value is CanonicalEvidenceStatus {
	return Object.values(CanonicalEvidenceStatus).includes(value as CanonicalEvidenceStatus);
}

function evidenceStatus(value?: EvidenceStatusValue): CanonicalEvidenceStatus {
	if (value && isEvidenceStatus(value)) return value;
	return CanonicalEvidenceStatus.NEEDS_CONFIRMATION;
}

function problemFromZod(error: unknown): CatalogProblem | null {
	if (!(error instanceof z.ZodError)) return null;
	return new CatalogProblem(
		422,
		"urn:bandai:pats:problem:validation-error",
		"Validation Failed",
		"The request body contains invalid catalog data.",
		error.issues.map((issue) => ({
			field: issue.path.join(".") || "body",
			message: issue.message,
		})),
	);
}

async function inTransaction<T>(
	database: CatalogDatabase,
	work: (transaction: CatalogDatabase) => Promise<T>,
): Promise<T> {
	const candidate = database as unknown as {
		$transaction?: (callback: (transaction: CatalogDatabase) => Promise<T>) => Promise<T>;
	};

	return candidate.$transaction ? candidate.$transaction(work) : work(database);
}

async function linkEvidence(
	transaction: CatalogDatabase,
	sourceEvidenceIds: string[] | undefined,
	subjectType: EvidenceSubjectType,
	subjectId: string,
): Promise<void> {
	if (!sourceEvidenceIds || sourceEvidenceIds.length === 0) return;

	const evidence = await transaction.sourceEvidence.findMany({
		where: { id: { in: sourceEvidenceIds } },
		select: { id: true },
	});
	if (evidence.length !== sourceEvidenceIds.length) {
		throw new CatalogProblem(
			422,
			"urn:bandai:pats:problem:validation-error",
			"Validation Failed",
			"Every sourceEvidenceId must refer to evidence retained by the API.",
			[
				{
					field: "sourceEvidenceIds",
					message: "One or more source evidence records were not found.",
				},
			],
		);
	}

	await transaction.canonicalEvidenceLink.createMany({
		data: sourceEvidenceIds.map((sourceEvidenceId) => ({
			sourceEvidenceId,
			subjectType,
			subjectId,
			relation: "primary-source",
		})),
	});
}

async function executeCatalogCreate(
	req: Request,
	store: IdempotencyStore,
	operation: string,
	body: unknown,
	execute: () => Promise<IdempotencyResponse>,
) {
	const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
	const actorId =
		(req as Request & { canonicalSubject?: { id?: string } }).canonicalSubject?.id ??
		"canonical-subject";
	return executeIdempotently(
		store,
		{
			actorId,
			operation,
			key: req.header("Idempotency-Key"),
			requestHash,
		},
		execute,
	);
}

function sendIdempotencyProblem(
	req: Request,
	res: Response,
	result: { problemType: string; status: number },
): void {
	const detail = result.problemType.endsWith("conflict")
		? "The Idempotency-Key was already used with a different request payload."
		: "A valid Idempotency-Key header is required for catalog creation.";
	sendProblem(
		req,
		res,
		new CatalogProblem(
			result.status,
			result.problemType,
			result.status === 409 ? "Conflict" : "Bad Request",
			detail,
		),
	);
}

function isIdempotencyFailure(
	result: IdempotencyResult,
): result is Extract<IdempotencyResult, { ok: false }> {
	return "ok" in result && result.ok === false;
}

function handleRouteError(error: unknown, req: Request, res: Response, next: NextFunction): void {
	const zodProblem = problemFromZod(error);
	if (zodProblem) {
		sendProblem(req, res, zodProblem);
		return;
	}
	if (error instanceof CatalogProblem) {
		sendProblem(req, res, error);
		return;
	}
	if (isPrismaUniqueConstraint(error)) {
		sendProblem(
			req,
			res,
			new CatalogProblem(
				409,
				"urn:bandai:pats:problem:conflict",
				"Conflict",
				"The catalog business identifier is already in use.",
			),
		);
		return;
	}
	next(error);
}

function isPrismaUniqueConstraint(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export function catalogFoundationRouter(
	database: CatalogDatabase,
	options: CatalogFoundationRouterOptions = {},
): Router {
	const router = Router();
	const idempotencyStore = options.idempotencyStore ?? new InMemoryCatalogIdempotencyStore();

	/**
	 * @openapi
	 * /api/v1/catalog/products:
	 *   post:
	 *     operationId: catalogProductCreate
	 *     summary: Create a draft catalog product
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201:
	 *         description: Draft product created
	 *       409:
	 *         description: Duplicate product or idempotency payload conflict
	 *       422:
	 *         description: Invalid product or source evidence
	 */
	router.post("/products", async (req, res, next) => {
		try {
			const body = parseBody(req, productCreateSchema);
			const result = await executeCatalogCreate(
				req,
				idempotencyStore,
				"catalogProductCreate",
				body,
				async () => {
					const product = await inTransaction(database, async (transaction) => {
						const created = await transaction.product.create({
							data: {
								productCode: body.productCode,
								productName: body.productName,
								lifecycleStatus: CatalogLifecycleStatus.DRAFT,
								evidenceStatus: evidenceStatus(body.evidenceStatus),
								rowVersion: 1,
							},
						});
						await linkEvidence(
							transaction,
							body.sourceEvidenceIds,
							"PRODUCT",
							created.id,
						);
						return created;
					});

					return {
						status: 201,
						body: toProductResource(product, body.sourceEvidenceIds?.length ?? 0),
						headers: {
							Location: `/api/v1/catalog/products/${product.id}`,
							ETag: `"${product.rowVersion}"`,
						},
					};
				},
			);
			if (isIdempotencyFailure(result)) {
				sendIdempotencyProblem(req, res, result);
				return;
			}
			Object.entries(result.headers).forEach(([name, value]) => res.setHeader(name, value));
			res.status(result.status).json(result.body);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/catalog/models:
	 *   post:
	 *     operationId: catalogModelCreate
	 *     summary: Create a draft catalog model
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201:
	 *         description: Draft model created
	 *       404:
	 *         description: Parent product not found
	 *       422:
	 *         description: Invalid model or source evidence
	 */
	router.post("/models", async (req, res, next) => {
		try {
			const body = parseBody(req, modelCreateSchema);
			const result = await executeCatalogCreate(
				req,
				idempotencyStore,
				"catalogModelCreate",
				body,
				async () => {
					const model = await inTransaction(database, async (transaction) => {
						const product = await transaction.product.findUnique({
							where: { id: body.productId },
							select: { id: true },
						});
						if (!product)
							throw notFound("The requested catalog product was not found.");

						const created = await transaction.model.create({
							data: {
								productId: body.productId,
								modelNumber: body.modelNumber,
								modelName: body.modelName ?? null,
								skuCode: body.skuCode ?? null,
								sourceStatus: ProductSourceStatus.NEEDS_CONFIRMATION,
								lifecycleStatus: CatalogLifecycleStatus.DRAFT,
								evidenceStatus: evidenceStatus(body.evidenceStatus),
								rowVersion: 1,
							},
						});
						await linkEvidence(
							transaction,
							body.sourceEvidenceIds,
							"MODEL",
							created.id,
						);
						return created;
					});

					return {
						status: 201,
						body: toModelResource(model, body.sourceEvidenceIds?.length ?? 0),
						headers: {
							Location: `/api/v1/catalog/models/${model.id}`,
							ETag: `"${model.rowVersion}"`,
						},
					};
				},
			);
			if (isIdempotencyFailure(result)) {
				sendIdempotencyProblem(req, res, result);
				return;
			}
			Object.entries(result.headers).forEach(([name, value]) => res.setHeader(name, value));
			res.status(result.status).json(result.body);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/catalog/model-parts:
	 *   post:
	 *     operationId: catalogModelPartCreate
	 *     summary: Create a draft catalog model part
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201:
	 *         description: Draft model part created
	 *       404:
	 *         description: Parent model not found
	 *       422:
	 *         description: Invalid model part or source evidence
	 */
	router.post("/model-parts", async (req, res, next) => {
		try {
			const body = parseBody(req, modelPartCreateSchema);
			const result = await executeCatalogCreate(
				req,
				idempotencyStore,
				"catalogModelPartCreate",
				body,
				async () => {
					const modelPart = await inTransaction(database, async (transaction) => {
						const model = await transaction.model.findUnique({
							where: { id: body.modelId },
							select: { id: true },
						});
						if (!model) throw notFound("The requested catalog model was not found.");

						const created = await transaction.modelPart.create({
							data: {
								modelId: body.modelId,
								partCode: body.partCode,
								partName: body.partName,
								routingSteps: [],
								lifecycleStatus: CatalogLifecycleStatus.DRAFT,
								evidenceStatus: evidenceStatus(body.evidenceStatus),
								rowVersion: 1,
							},
						});
						await linkEvidence(
							transaction,
							body.sourceEvidenceIds,
							"MODEL_PART",
							created.id,
						);
						return created;
					});

					return {
						status: 201,
						body: toModelPartResource(modelPart, body.sourceEvidenceIds?.length ?? 0),
						headers: {
							Location: `/api/v1/catalog/model-parts/${modelPart.id}`,
							ETag: `"${modelPart.rowVersion}"`,
						},
					};
				},
			);
			if (isIdempotencyFailure(result)) {
				sendIdempotencyProblem(req, res, result);
				return;
			}
			Object.entries(result.headers).forEach(([name, value]) => res.setHeader(name, value));
			res.status(result.status).json(result.body);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/catalog/products/{productId}:
	 *   patch:
	 *     operationId: catalogProductPatch
	 *     summary: Update a draft catalog product
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: productId
	 *         required: true
	 *         schema: { type: string }
	 *       - $ref: '#/components/parameters/IfMatch'
	 *     responses:
	 *       200:
	 *         description: Updated draft product
	 *       412:
	 *         description: Stale or missing If-Match
	 */
	router.patch("/products/:productId", async (req, res, next) => {
		try {
			const body = parseBody(req, productPatchSchema);
			const expectedVersion = requireIfMatch(req);
			const current = await database.product.findUnique({
				where: { id: req.params.productId },
			});
			if (!current) throw notFound("The requested catalog product was not found.");
			if (current.lifecycleStatus !== CatalogLifecycleStatus.DRAFT) throw publishedResource();
			if (current.rowVersion !== expectedVersion) throw staleVersion();

			const product = await database.product.update({
				where: { id: current.id },
				data: {
					...(body.productCode === undefined ? {} : { productCode: body.productCode }),
					...(body.productName === undefined ? {} : { productName: body.productName }),
					...(body.evidenceStatus === undefined
						? {}
						: { evidenceStatus: evidenceStatus(body.evidenceStatus) }),
					rowVersion: { increment: 1 },
				},
			});
			setVersionHeaders(res, product.rowVersion);
			res.status(200).json(
				toProductResource(product, await evidenceCount(database, "PRODUCT", product.id)),
			);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/catalog/models/{modelId}:
	 *   patch:
	 *     operationId: catalogModelPatch
	 *     summary: Update a draft catalog model
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: modelId
	 *         required: true
	 *         schema: { type: string }
	 *       - $ref: '#/components/parameters/IfMatch'
	 *     responses:
	 *       200:
	 *         description: Updated draft model
	 *       412:
	 *         description: Stale or missing If-Match
	 */
	router.patch("/models/:modelId", async (req, res, next) => {
		try {
			const body = parseBody(req, modelPatchSchema);
			const expectedVersion = requireIfMatch(req);
			const current = await database.model.findUnique({ where: { id: req.params.modelId } });
			if (!current) throw notFound("The requested catalog model was not found.");
			if (current.lifecycleStatus !== CatalogLifecycleStatus.DRAFT) throw publishedResource();
			if (current.rowVersion !== expectedVersion) throw staleVersion();

			const model = await database.model.update({
				where: { id: current.id },
				data: {
					...(body.modelNumber === undefined ? {} : { modelNumber: body.modelNumber }),
					...(body.modelName === undefined ? {} : { modelName: body.modelName }),
					...(body.skuCode === undefined ? {} : { skuCode: body.skuCode }),
					...(body.pinned === undefined ? {} : { pinned: body.pinned }),
					...(body.evidenceStatus === undefined
						? {}
						: { evidenceStatus: evidenceStatus(body.evidenceStatus) }),
					rowVersion: { increment: 1 },
				},
			});
			setVersionHeaders(res, model.rowVersion);
			res.status(200).json(
				toModelResource(model, await evidenceCount(database, "MODEL", model.id)),
			);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/**
	 * @openapi
	 * /api/v1/catalog/model-parts/{modelPartId}:
	 *   patch:
	 *     operationId: catalogModelPartPatch
	 *     summary: Update a draft catalog model part
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: modelPartId
	 *         required: true
	 *         schema: { type: string }
	 *       - $ref: '#/components/parameters/IfMatch'
	 *     responses:
	 *       200:
	 *         description: Updated draft model part
	 *       412:
	 *         description: Stale or missing If-Match
	 */
	router.patch("/model-parts/:modelPartId", async (req, res, next) => {
		try {
			const body = parseBody(req, modelPartPatchSchema);
			const expectedVersion = requireIfMatch(req);
			const current = await database.modelPart.findUnique({
				where: { id: req.params.modelPartId },
			});
			if (!current) throw notFound("The requested catalog model part was not found.");
			if (current.lifecycleStatus !== CatalogLifecycleStatus.DRAFT) throw publishedResource();
			if (current.rowVersion !== expectedVersion) throw staleVersion();

			const modelPart = await database.modelPart.update({
				where: { id: current.id },
				data: {
					...(body.partCode === undefined ? {} : { partCode: body.partCode }),
					...(body.partName === undefined ? {} : { partName: body.partName }),
					...(body.evidenceStatus === undefined
						? {}
						: { evidenceStatus: evidenceStatus(body.evidenceStatus) }),
					rowVersion: { increment: 1 },
				},
			});
			setVersionHeaders(res, modelPart.rowVersion);
			res.status(200).json(
				toModelPartResource(
					modelPart,
					await evidenceCount(database, "MODEL_PART", modelPart.id),
				),
			);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	return router;
}

function notFound(detail: string): CatalogProblem {
	return new CatalogProblem(404, "urn:bandai:pats:problem:not-found", "Not Found", detail);
}

function staleVersion(): CatalogProblem {
	return new CatalogProblem(
		412,
		"urn:bandai:pats:problem:precondition-failed",
		"Precondition Failed",
		"The catalog resource changed since the supplied If-Match version.",
	);
}

function publishedResource(): CatalogProblem {
	return new CatalogProblem(
		409,
		"urn:bandai:pats:problem:conflict",
		"Conflict",
		"Published or retired catalog records are immutable in the draft API.",
	);
}

async function evidenceCount(
	database: CatalogDatabase,
	subjectType: EvidenceSubjectType,
	subjectId: string,
): Promise<number> {
	return database.canonicalEvidenceLink.count({ where: { subjectType, subjectId } });
}

function toProductResource(
	product: {
		id: string;
		productCode: string;
		productName: string;
		lifecycleStatus: CatalogLifecycleStatus;
		evidenceStatus: CanonicalEvidenceStatus;
		rowVersion: number;
		createdAt: Date;
		updatedAt: Date;
	},
	sourceEvidenceCount: number,
) {
	return {
		id: product.id,
		productCode: product.productCode,
		productName: product.productName,
		lifecycleStatus: product.lifecycleStatus,
		evidenceStatus: product.evidenceStatus,
		provenance: { sourceEvidenceCount },
		rowVersion: product.rowVersion,
		createdAt: product.createdAt.toISOString(),
		updatedAt: product.updatedAt.toISOString(),
	};
}

function toModelResource(
	model: {
		id: string;
		productId: string;
		modelNumber: string;
		modelName: string | null;
		skuCode: string | null;
		pinned: boolean;
		sourceStatus: ProductSourceStatus;
		lifecycleStatus: CatalogLifecycleStatus;
		evidenceStatus: CanonicalEvidenceStatus;
		rowVersion: number;
		createdAt: Date;
		updatedAt: Date;
	},
	sourceEvidenceCount: number,
) {
	return {
		id: model.id,
		productId: model.productId,
		modelNumber: model.modelNumber,
		modelName: model.modelName,
		skuCode: model.skuCode,
		pinned: model.pinned,
		sourceStatus: model.sourceStatus,
		lifecycleStatus: model.lifecycleStatus,
		evidenceStatus: model.evidenceStatus,
		provenance: { sourceEvidenceCount },
		rowVersion: model.rowVersion,
		createdAt: model.createdAt.toISOString(),
		updatedAt: model.updatedAt.toISOString(),
	};
}

function toModelPartResource(
	modelPart: {
		id: string;
		modelId: string;
		partCode: string;
		partName: string;
		lifecycleStatus: CatalogLifecycleStatus;
		evidenceStatus: CanonicalEvidenceStatus;
		rowVersion: number;
		createdAt: Date;
	},
	sourceEvidenceCount: number,
) {
	return {
		id: modelPart.id,
		modelId: modelPart.modelId,
		partCode: modelPart.partCode,
		partName: modelPart.partName,
		lifecycleStatus: modelPart.lifecycleStatus,
		evidenceStatus: modelPart.evidenceStatus,
		provenance: { sourceEvidenceCount },
		rowVersion: modelPart.rowVersion,
		createdAt: modelPart.createdAt.toISOString(),
	};
}
