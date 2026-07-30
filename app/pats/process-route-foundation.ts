import { createHash } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
	CanonicalEvidenceStatus,
	CanonicalEvidenceSubjectType,
	CatalogLifecycleStatus,
	PrismaClient as PatsPrismaClient,
} from "../../generated/pats-client";
import {
	executeIdempotently,
	type IdempotencyRecord,
	type IdempotencyResponse,
	type IdempotencyResult,
	type IdempotencyScope,
	type IdempotencyStore,
} from "../canonical/idempotency";

type ProcessRouteDatabase = Pick<
	PatsPrismaClient,
	"processRoute" | "processRouteStage" | "model" | "sourceEvidence" | "canonicalEvidenceLink"
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

const processRouteCreateSchema = z
	.object({
		modelId: z.string().trim().min(1).max(100),
		revision: z.number().int().positive(),
		evidenceStatus: evidenceStatusSchema.optional(),
		sourceEvidenceIds: sourceEvidenceIdsSchema.optional(),
	})
	.strict();

const processRoutePatchSchema = z
	.object({
		evidenceStatus: evidenceStatusSchema.optional(),
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

const routeStageFields = {
	stageKey: z.string().trim().min(1).max(80).nullable().optional(),
	stageName: z.string().trim().min(1).max(240).nullable().optional(),
	stageDefinitionId: z.string().trim().min(1).max(100).nullable().optional(),
	subStageKey: z.string().trim().min(1).max(80).nullable().optional(),
	subStageName: z.string().trim().min(1).max(240).nullable().optional(),
	operationCode: z.string().trim().min(1).max(80).nullable().optional(),
	operationName: z.string().trim().min(1).max(240).nullable().optional(),
	sourceRepresentation: z.string().trim().min(1).max(500).nullable().optional(),
	evidenceStatus: evidenceStatusSchema.optional(),
};

const processRouteStageCreateSchema = z
	.object({
		processRouteId: z.string().trim().min(1).max(100),
		sequence: z.number().int().positive(),
		...routeStageFields,
		sourceEvidenceIds: sourceEvidenceIdsSchema.optional(),
	})
	.strict()
	.refine(hasStageIdentity, {
		message: "At least one of stageKey, stageName, or stageDefinitionId is required.",
		path: ["stageKey"],
	});

const processRouteStagePatchSchema = z
	.object({
		sequence: z.number().int().positive().optional(),
		...routeStageFields,
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

type EvidenceStatusValue = (typeof evidenceStatuses)[number];

class ProcessRouteProblem extends Error {
	public constructor(
		public readonly status: number,
		public readonly type: string,
		public readonly title: string,
		detail: string,
		public readonly errors?: Array<{ field: string; message: string }>,
	) {
		super(detail);
		this.name = "ProcessRouteProblem";
	}

	public get detail(): string {
		return this.message;
	}
}

class InMemoryProcessRouteIdempotencyStore implements IdempotencyStore {
	private readonly records = new Map<string, IdempotencyRecord>();

	public async reserve(
		scope: Required<IdempotencyScope>,
	): Promise<
		{ kind: "reserved"; reservation: string } | { kind: "existing"; record: IdempotencyRecord }
	> {
		const reservation = `${scope.actorId}:${scope.operation}:${scope.key}`;
		const existing = this.records.get(reservation);
		return existing
			? { kind: "existing", record: existing }
			: { kind: "reserved", reservation };
	}

	public async persist(reservation: unknown, record: IdempotencyRecord): Promise<void> {
		this.records.set(String(reservation), record);
	}
}

function requestInstance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function sendProblem(req: Request, res: Response, problem: ProcessRouteProblem): void {
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

	throw new ProcessRouteProblem(
		422,
		"urn:bandai:pats:problem:validation-error",
		"Validation Failed",
		"The request body contains invalid process route data.",
		result.error.issues.map((issue) => ({
			field: issue.path.join(".") || "body",
			message: issue.message,
		})),
	);
}

function requireIfMatch(req: Request): number {
	const match = req.header("If-Match")?.match(/^"(\d+)"$/);
	if (!match) {
		throw new ProcessRouteProblem(
			412,
			"urn:bandai:pats:problem:precondition-failed",
			"Precondition Failed",
			"If-Match must contain the current process route resource row version.",
		);
	}
	return Number(match[1]);
}

function evidenceStatus(value?: EvidenceStatusValue): CanonicalEvidenceStatus {
	return value &&
		Object.values(CanonicalEvidenceStatus).includes(value as CanonicalEvidenceStatus)
		? (value as CanonicalEvidenceStatus)
		: CanonicalEvidenceStatus.NEEDS_CONFIRMATION;
}

function hasStageIdentity(value: {
	stageKey?: string | null;
	stageName?: string | null;
	stageDefinitionId?: string | null;
}): boolean {
	return Boolean(value.stageKey || value.stageName || value.stageDefinitionId);
}

function problemFromZod(error: unknown): ProcessRouteProblem | null {
	if (!(error instanceof z.ZodError)) return null;
	return new ProcessRouteProblem(
		422,
		"urn:bandai:pats:problem:validation-error",
		"Validation Failed",
		"The request body contains invalid process route data.",
		error.issues.map((issue) => ({
			field: issue.path.join(".") || "body",
			message: issue.message,
		})),
	);
}

async function inTransaction<T>(
	database: ProcessRouteDatabase,
	work: (transaction: ProcessRouteDatabase) => Promise<T>,
): Promise<T> {
	const candidate = database as unknown as {
		$transaction?: (callback: (transaction: ProcessRouteDatabase) => Promise<T>) => Promise<T>;
	};
	return candidate.$transaction ? candidate.$transaction(work) : work(database);
}

async function linkEvidence(
	transaction: ProcessRouteDatabase,
	sourceEvidenceIds: string[] | undefined,
	subjectType: CanonicalEvidenceSubjectType,
	subjectId: string,
): Promise<void> {
	if (!sourceEvidenceIds || sourceEvidenceIds.length === 0) return;
	const evidence = await transaction.sourceEvidence.findMany({
		where: { id: { in: sourceEvidenceIds } },
		select: { id: true },
	});
	if (evidence.length !== sourceEvidenceIds.length) {
		throw new ProcessRouteProblem(
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

async function executeCreate(
	req: Request,
	store: IdempotencyStore,
	operation: string,
	body: unknown,
	execute: () => Promise<IdempotencyResponse>,
): Promise<IdempotencyResult> {
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
		: "A valid Idempotency-Key header is required for process route creation.";
	sendProblem(
		req,
		res,
		new ProcessRouteProblem(
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

function isPrismaUniqueConstraint(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function handleRouteError(error: unknown, req: Request, res: Response, next: NextFunction): void {
	const zodProblem = problemFromZod(error);
	if (zodProblem) {
		sendProblem(req, res, zodProblem);
		return;
	}
	if (error instanceof ProcessRouteProblem) {
		sendProblem(req, res, error);
		return;
	}
	if (isPrismaUniqueConstraint(error)) {
		sendProblem(
			req,
			res,
			new ProcessRouteProblem(
				409,
				"urn:bandai:pats:problem:conflict",
				"Conflict",
				"The process route revision or stage sequence is already in use.",
			),
		);
		return;
	}
	next(error);
}

function notFound(detail: string): ProcessRouteProblem {
	return new ProcessRouteProblem(404, "urn:bandai:pats:problem:not-found", "Not Found", detail);
}

function staleVersion(): ProcessRouteProblem {
	return new ProcessRouteProblem(
		412,
		"urn:bandai:pats:problem:precondition-failed",
		"Precondition Failed",
		"The process route resource changed since the supplied If-Match version.",
	);
}

function publishedResource(): ProcessRouteProblem {
	return new ProcessRouteProblem(
		409,
		"urn:bandai:pats:problem:conflict",
		"Conflict",
		"Published or retired process-route records are immutable in the draft API.",
	);
}

async function evidenceCount(
	database: ProcessRouteDatabase,
	subjectType: CanonicalEvidenceSubjectType,
	subjectId: string,
): Promise<number> {
	return database.canonicalEvidenceLink.count({ where: { subjectType, subjectId } });
}

function toRouteResource(
	route: {
		id: string;
		modelId: string;
		revision: number;
		lifecycleStatus: CatalogLifecycleStatus;
		evidenceStatus: CanonicalEvidenceStatus;
		rowVersion: number;
		createdAt: Date;
		updatedAt: Date;
	},
	sourceEvidenceCount: number,
) {
	return {
		id: route.id,
		modelId: route.modelId,
		revision: route.revision,
		lifecycleStatus: route.lifecycleStatus,
		evidenceStatus: route.evidenceStatus,
		provenance: { sourceEvidenceCount },
		rowVersion: route.rowVersion,
		createdAt: route.createdAt.toISOString(),
		updatedAt: route.updatedAt.toISOString(),
	};
}

function toStageResource(
	stage: {
		id: string;
		processRouteId: string;
		sequence: number;
		stageKey: string | null;
		stageName: string | null;
		stageDefinitionId: string | null;
		subStageKey: string | null;
		subStageName: string | null;
		operationCode: string | null;
		operationName: string | null;
		sourceRepresentation: string | null;
		lifecycleStatus: CatalogLifecycleStatus;
		evidenceStatus: CanonicalEvidenceStatus;
		rowVersion: number;
		createdAt: Date;
		updatedAt: Date;
	},
	sourceEvidenceCount: number,
) {
	return {
		id: stage.id,
		processRouteId: stage.processRouteId,
		sequence: stage.sequence,
		stageKey: stage.stageKey,
		stageName: stage.stageName,
		stageDefinitionId: stage.stageDefinitionId,
		subStageKey: stage.subStageKey,
		subStageName: stage.subStageName,
		operationCode: stage.operationCode,
		operationName: stage.operationName,
		sourceRepresentation: stage.sourceRepresentation,
		lifecycleStatus: stage.lifecycleStatus,
		evidenceStatus: stage.evidenceStatus,
		provenance: { sourceEvidenceCount },
		rowVersion: stage.rowVersion,
		createdAt: stage.createdAt.toISOString(),
		updatedAt: stage.updatedAt.toISOString(),
	};
}

export interface ProcessRouteFoundationRouterOptions {
	idempotencyStore?: IdempotencyStore;
}

export function processRouteFoundationRouter(
	database: ProcessRouteDatabase,
	options: ProcessRouteFoundationRouterOptions = {},
): Router {
	const router = Router();
	const idempotencyStore = options.idempotencyStore ?? new InMemoryProcessRouteIdempotencyStore();

	/**
	 * @openapi
	 * /api/v1/catalog/process-routes:
	 *   post:
	 *     operationId: catalogProcessRouteCreate
	 *     summary: Create a draft process route revision
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201: { description: Draft process route created }
	 *       404: { description: Parent model not found }
	 *       409: { description: Duplicate route revision or idempotency conflict }
	 *       422: { description: Invalid route or source evidence }
	 */
	router.post("/process-routes", async (req, res, next) => {
		try {
			const body = parseBody(req, processRouteCreateSchema);
			const result = await executeCreate(
				req,
				idempotencyStore,
				"catalogProcessRouteCreate",
				body,
				async () => {
					const route = await inTransaction(database, async (transaction) => {
						const model = await transaction.model.findUnique({
							where: { id: body.modelId },
							select: { id: true },
						});
						if (!model) throw notFound("The requested catalog model was not found.");
						const created = await transaction.processRoute.create({
							data: {
								modelId: body.modelId,
								revision: body.revision,
								lifecycleStatus: CatalogLifecycleStatus.DRAFT,
								evidenceStatus: evidenceStatus(body.evidenceStatus),
								rowVersion: 1,
							},
						});
						await linkEvidence(
							transaction,
							body.sourceEvidenceIds,
							CanonicalEvidenceSubjectType.PROCESS_ROUTE,
							created.id,
						);
						return created;
					});
					return {
						status: 201,
						body: toRouteResource(route, body.sourceEvidenceIds?.length ?? 0),
						headers: {
							Location: `/api/v1/catalog/process-routes/${route.id}`,
							ETag: `"${route.rowVersion}"`,
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
	 * /api/v1/catalog/route-stages:
	 *   post:
	 *     operationId: catalogRouteStageCreate
	 *     summary: Add an ordered stage to a draft process route
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201: { description: Draft route stage created }
	 *       404: { description: Parent route not found }
	 *       409: { description: Duplicate stage sequence or idempotency conflict }
	 *       422: { description: Missing stage identity or invalid route stage }
	 */
	router.post("/route-stages", async (req, res, next) => {
		try {
			const body = parseBody(req, processRouteStageCreateSchema);
			const result = await executeCreate(
				req,
				idempotencyStore,
				"catalogRouteStageCreate",
				body,
				async () => {
					const stage = await inTransaction(database, async (transaction) => {
						const route = await transaction.processRoute.findUnique({
							where: { id: body.processRouteId },
							select: { id: true },
						});
						if (!route) throw notFound("The requested process route was not found.");
						const created = await transaction.processRouteStage.create({
							data: {
								processRouteId: body.processRouteId,
								sequence: body.sequence,
								stageKey: body.stageKey ?? null,
								stageName: body.stageName ?? null,
								stageDefinitionId: body.stageDefinitionId ?? null,
								subStageKey: body.subStageKey ?? null,
								subStageName: body.subStageName ?? null,
								operationCode: body.operationCode ?? null,
								operationName: body.operationName ?? null,
								sourceRepresentation: body.sourceRepresentation ?? null,
								lifecycleStatus: CatalogLifecycleStatus.DRAFT,
								evidenceStatus: evidenceStatus(body.evidenceStatus),
								rowVersion: 1,
							},
						});
						await linkEvidence(
							transaction,
							body.sourceEvidenceIds,
							CanonicalEvidenceSubjectType.ROUTE_STAGE,
							created.id,
						);
						return created;
					});
					return {
						status: 201,
						body: toStageResource(stage, body.sourceEvidenceIds?.length ?? 0),
						headers: {
							Location: `/api/v1/catalog/route-stages/${stage.id}`,
							ETag: `"${stage.rowVersion}"`,
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

	/** @openapi
	 * /api/v1/catalog/process-routes/{processRouteId}:
	 *   patch:
	 *     operationId: catalogProcessRoutePatch
	 *     summary: Update draft process route evidence status
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: processRouteId
	 *         required: true
	 *         schema: { type: string }
	 *       - $ref: '#/components/parameters/IfMatch'
	 *     responses:
	 *       200: { description: Updated draft process route }
	 *       412: { description: Stale or missing If-Match }
	 */
	router.patch("/process-routes/:processRouteId", async (req, res, next) => {
		try {
			const body = parseBody(req, processRoutePatchSchema);
			const expectedVersion = requireIfMatch(req);
			const current = await database.processRoute.findUnique({
				where: { id: req.params.processRouteId },
			});
			if (!current) throw notFound("The requested process route was not found.");
			if (current.lifecycleStatus !== CatalogLifecycleStatus.DRAFT) throw publishedResource();
			if (current.rowVersion !== expectedVersion) throw staleVersion();
			const route = await database.processRoute.update({
				where: { id: current.id },
				data: {
					evidenceStatus: evidenceStatus(body.evidenceStatus),
					rowVersion: { increment: 1 },
				},
			});
			res.setHeader("ETag", `"${route.rowVersion}"`);
			res.status(200).json(
				toRouteResource(
					route,
					await evidenceCount(
						database,
						CanonicalEvidenceSubjectType.PROCESS_ROUTE,
						route.id,
					),
				),
			);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/** @openapi
	 * /api/v1/catalog/route-stages/{routeStageId}:
	 *   patch:
	 *     operationId: catalogRouteStagePatch
	 *     summary: Correct draft route stage order or metadata
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: routeStageId
	 *         required: true
	 *         schema: { type: string }
	 *       - $ref: '#/components/parameters/IfMatch'
	 *     responses:
	 *       200: { description: Updated draft route stage }
	 *       412: { description: Stale or missing If-Match }
	 */
	router.patch("/route-stages/:routeStageId", async (req, res, next) => {
		try {
			const body = parseBody(req, processRouteStagePatchSchema);
			const expectedVersion = requireIfMatch(req);
			const current = await database.processRouteStage.findUnique({
				where: { id: req.params.routeStageId },
			});
			if (!current) throw notFound("The requested route stage was not found.");
			if (current.lifecycleStatus !== CatalogLifecycleStatus.DRAFT) throw publishedResource();
			if (current.rowVersion !== expectedVersion) throw staleVersion();
			const mergedIdentity = {
				stageKey: body.stageKey === undefined ? current.stageKey : body.stageKey,
				stageName: body.stageName === undefined ? current.stageName : body.stageName,
				stageDefinitionId:
					body.stageDefinitionId === undefined
						? current.stageDefinitionId
						: body.stageDefinitionId,
			};
			if (!hasStageIdentity(mergedIdentity)) {
				throw new ProcessRouteProblem(
					422,
					"urn:bandai:pats:problem:validation-error",
					"Validation Failed",
					"A route stage must retain at least one stage identity.",
					[
						{
							field: "stageKey",
							message: "stageKey, stageName, or stageDefinitionId is required.",
						},
					],
				);
			}

			const stage = await database.processRouteStage.update({
				where: { id: current.id },
				data: {
					...(body.sequence === undefined ? {} : { sequence: body.sequence }),
					...(body.stageKey === undefined ? {} : { stageKey: body.stageKey }),
					...(body.stageName === undefined ? {} : { stageName: body.stageName }),
					...(body.stageDefinitionId === undefined
						? {}
						: { stageDefinitionId: body.stageDefinitionId }),
					...(body.subStageKey === undefined ? {} : { subStageKey: body.subStageKey }),
					...(body.subStageName === undefined ? {} : { subStageName: body.subStageName }),
					...(body.operationCode === undefined
						? {}
						: { operationCode: body.operationCode }),
					...(body.operationName === undefined
						? {}
						: { operationName: body.operationName }),
					...(body.sourceRepresentation === undefined
						? {}
						: { sourceRepresentation: body.sourceRepresentation }),
					...(body.evidenceStatus === undefined
						? {}
						: { evidenceStatus: evidenceStatus(body.evidenceStatus) }),
					rowVersion: { increment: 1 },
				},
			});
			res.setHeader("ETag", `"${stage.rowVersion}"`);
			res.status(200).json(
				toStageResource(
					stage,
					await evidenceCount(
						database,
						CanonicalEvidenceSubjectType.ROUTE_STAGE,
						stage.id,
					),
				),
			);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	return router;
}
