import { createHash } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
	BomRelationshipKind,
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

type BomDatabase = Pick<
	PatsPrismaClient,
	"bomDefinition" | "bomLine" | "model" | "modelPart" | "sourceEvidence" | "canonicalEvidenceLink"
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

const relationshipKinds = [
	"COMPONENT",
	"ASSEMBLY_COMPONENT",
	"DECORATION_INPUT",
	"PACKAGING_COMPONENT",
	"OTHER",
] as const;

const sourceEvidenceIdsSchema = z
	.array(z.string().trim().min(1).max(100))
	.max(100)
	.refine((ids) => new Set(ids).size === ids.length, "Source evidence IDs must be unique.");
const evidenceStatusSchema = z.enum(evidenceStatuses);

const bomDefinitionCreateSchema = z
	.object({
		modelId: z.string().trim().min(1).max(100),
		revision: z.number().int().positive(),
		evidenceStatus: evidenceStatusSchema.optional(),
		sourceEvidenceIds: sourceEvidenceIdsSchema.optional(),
	})
	.strict();

const bomDefinitionPatchSchema = z
	.object({
		evidenceStatus: evidenceStatusSchema.optional(),
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

const bomLineCreateSchema = z
	.object({
		bomDefinitionId: z.string().trim().min(1).max(100),
		modelPartId: z.string().trim().min(1).max(100),
		lineNumber: z.number().int().positive(),
		relationshipKind: z.enum(relationshipKinds),
		quantityMagnitude: z.number().finite().positive().nullable().optional(),
		quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
		usageBasis: z.string().trim().min(1).max(120).nullable().optional(),
		sourceRepresentation: z.string().trim().min(1).max(500).nullable().optional(),
		evidenceStatus: evidenceStatusSchema.optional(),
		sourceEvidenceIds: sourceEvidenceIdsSchema.optional(),
	})
	.strict();

const bomLinePatchSchema = z
	.object({
		lineNumber: z.number().int().positive().optional(),
		relationshipKind: z.enum(relationshipKinds).optional(),
		quantityMagnitude: z.number().finite().positive().nullable().optional(),
		quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
		usageBasis: z.string().trim().min(1).max(120).nullable().optional(),
		sourceRepresentation: z.string().trim().min(1).max(500).nullable().optional(),
		evidenceStatus: evidenceStatusSchema.optional(),
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

type EvidenceStatusValue = (typeof evidenceStatuses)[number];
type RelationshipKindValue = (typeof relationshipKinds)[number];

class BomProblem extends Error {
	public constructor(
		public readonly status: number,
		public readonly type: string,
		public readonly title: string,
		detail: string,
		public readonly errors?: Array<{ field: string; message: string }>,
	) {
		super(detail);
		this.name = "BomProblem";
	}

	public get detail(): string {
		return this.message;
	}
}

class InMemoryBomIdempotencyStore implements IdempotencyStore {
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

function sendProblem(req: Request, res: Response, problem: BomProblem): void {
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

	throw new BomProblem(
		422,
		"urn:bandai:pats:problem:validation-error",
		"Validation Failed",
		"The request body contains invalid BOM relationship data.",
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
		throw new BomProblem(
			412,
			"urn:bandai:pats:problem:precondition-failed",
			"Precondition Failed",
			"If-Match must contain the current BOM resource row version.",
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

function relationshipKind(value: RelationshipKindValue): BomRelationshipKind {
	return value as BomRelationshipKind;
}

function problemFromZod(error: unknown): BomProblem | null {
	if (!(error instanceof z.ZodError)) return null;
	return new BomProblem(
		422,
		"urn:bandai:pats:problem:validation-error",
		"Validation Failed",
		"The request body contains invalid BOM relationship data.",
		error.issues.map((issue) => ({
			field: issue.path.join(".") || "body",
			message: issue.message,
		})),
	);
}

async function inTransaction<T>(
	database: BomDatabase,
	work: (transaction: BomDatabase) => Promise<T>,
): Promise<T> {
	const candidate = database as unknown as {
		$transaction?: (callback: (transaction: BomDatabase) => Promise<T>) => Promise<T>;
	};
	return candidate.$transaction ? candidate.$transaction(work) : work(database);
}

async function linkEvidence(
	transaction: BomDatabase,
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
		throw new BomProblem(
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
		: "A valid Idempotency-Key header is required for BOM creation.";
	sendProblem(
		req,
		res,
		new BomProblem(
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
	if (error instanceof BomProblem) {
		sendProblem(req, res, error);
		return;
	}
	if (isPrismaUniqueConstraint(error)) {
		sendProblem(
			req,
			res,
			new BomProblem(
				409,
				"urn:bandai:pats:problem:conflict",
				"Conflict",
				"The BOM revision or line number is already in use.",
			),
		);
		return;
	}
	next(error);
}

function notFound(detail: string): BomProblem {
	return new BomProblem(404, "urn:bandai:pats:problem:not-found", "Not Found", detail);
}

function staleVersion(): BomProblem {
	return new BomProblem(
		412,
		"urn:bandai:pats:problem:precondition-failed",
		"Precondition Failed",
		"The BOM resource changed since the supplied If-Match version.",
	);
}

function publishedResource(): BomProblem {
	return new BomProblem(
		409,
		"urn:bandai:pats:problem:conflict",
		"Conflict",
		"Published or retired BOM records are immutable in the draft API.",
	);
}

async function evidenceCount(
	database: BomDatabase,
	subjectType: CanonicalEvidenceSubjectType,
	subjectId: string,
): Promise<number> {
	return database.canonicalEvidenceLink.count({ where: { subjectType, subjectId } });
}

function toBomDefinitionResource(
	definition: {
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
		id: definition.id,
		modelId: definition.modelId,
		revision: definition.revision,
		lifecycleStatus: definition.lifecycleStatus,
		evidenceStatus: definition.evidenceStatus,
		provenance: { sourceEvidenceCount },
		rowVersion: definition.rowVersion,
		createdAt: definition.createdAt.toISOString(),
		updatedAt: definition.updatedAt.toISOString(),
	};
}

function toBomLineResource(
	line: {
		id: string;
		bomDefinitionId: string;
		modelPartId: string;
		lineNumber: number;
		relationshipKind: BomRelationshipKind;
		quantityMagnitude: number | null;
		quantityUom: string | null;
		usageBasis: string | null;
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
		id: line.id,
		bomDefinitionId: line.bomDefinitionId,
		modelPartId: line.modelPartId,
		lineNumber: line.lineNumber,
		relationshipKind: line.relationshipKind,
		quantityMagnitude: line.quantityMagnitude,
		quantityUom: line.quantityUom,
		usageBasis: line.usageBasis,
		sourceRepresentation: line.sourceRepresentation,
		lifecycleStatus: line.lifecycleStatus,
		evidenceStatus: line.evidenceStatus,
		provenance: { sourceEvidenceCount },
		rowVersion: line.rowVersion,
		createdAt: line.createdAt.toISOString(),
		updatedAt: line.updatedAt.toISOString(),
	};
}

export interface BomFoundationRouterOptions {
	idempotencyStore?: IdempotencyStore;
}

export function bomFoundationRouter(
	database: BomDatabase,
	options: BomFoundationRouterOptions = {},
): Router {
	const router = Router();
	const idempotencyStore = options.idempotencyStore ?? new InMemoryBomIdempotencyStore();

	/**
	 * @openapi
	 * /api/v1/catalog/bom-definitions:
	 *   post:
	 *     operationId: catalogBomDefinitionCreate
	 *     summary: Create a draft BOM revision
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201: { description: Draft BOM revision created }
	 *       404: { description: Parent model not found }
	 *       409: { description: Duplicate BOM revision or idempotency conflict }
	 *       422: { description: Invalid BOM revision or source evidence }
	 */
	router.post("/bom-definitions", async (req, res, next) => {
		try {
			const body = parseBody(req, bomDefinitionCreateSchema);
			const result = await executeCreate(
				req,
				idempotencyStore,
				"catalogBomDefinitionCreate",
				body,
				async () => {
					const definition = await inTransaction(database, async (transaction) => {
						const model = await transaction.model.findUnique({
							where: { id: body.modelId },
							select: { id: true },
						});
						if (!model) throw notFound("The requested catalog model was not found.");

						const created = await transaction.bomDefinition.create({
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
							CanonicalEvidenceSubjectType.BOM_DEFINITION,
							created.id,
						);
						return created;
					});

					return {
						status: 201,
						body: toBomDefinitionResource(
							definition,
							body.sourceEvidenceIds?.length ?? 0,
						),
						headers: {
							Location: `/api/v1/catalog/bom-definitions/${definition.id}`,
							ETag: `"${definition.rowVersion}"`,
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
	 * /api/v1/catalog/bom-lines:
	 *   post:
	 *     operationId: catalogBomLineCreate
	 *     summary: Add an ordered model-part line to a draft BOM
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - $ref: '#/components/parameters/IdempotencyKey'
	 *     responses:
	 *       201: { description: Draft BOM line created }
	 *       404: { description: BOM or model part not found }
	 *       409: { description: Duplicate line or idempotency conflict }
	 *       422: { description: Cross-model or invalid BOM line }
	 */
	router.post("/bom-lines", async (req, res, next) => {
		try {
			const body = parseBody(req, bomLineCreateSchema);
			const result = await executeCreate(
				req,
				idempotencyStore,
				"catalogBomLineCreate",
				body,
				async () => {
					const line = await inTransaction(database, async (transaction) => {
						const [definition, modelPart] = await Promise.all([
							transaction.bomDefinition.findUnique({
								where: { id: body.bomDefinitionId },
								select: { id: true, modelId: true },
							}),
							transaction.modelPart.findUnique({
								where: { id: body.modelPartId },
								select: { id: true, modelId: true },
							}),
						]);
						if (!definition)
							throw notFound("The requested BOM definition was not found.");
						if (!modelPart)
							throw notFound("The requested catalog model part was not found.");
						if (definition.modelId !== modelPart.modelId) {
							throw new BomProblem(
								422,
								"urn:bandai:pats:problem:validation-error",
								"Validation Failed",
								"A BOM line must reference a ModelPart belonging to the BOM's Model.",
								[
									{
										field: "modelPartId",
										message: "The ModelPart belongs to a different Model.",
									},
								],
							);
						}

						const created = await transaction.bomLine.create({
							data: {
								bomDefinitionId: body.bomDefinitionId,
								modelPartId: body.modelPartId,
								lineNumber: body.lineNumber,
								relationshipKind: relationshipKind(body.relationshipKind),
								quantityMagnitude: body.quantityMagnitude ?? null,
								quantityUom: body.quantityUom ?? null,
								usageBasis: body.usageBasis ?? null,
								sourceRepresentation: body.sourceRepresentation ?? null,
								lifecycleStatus: CatalogLifecycleStatus.DRAFT,
								evidenceStatus: evidenceStatus(body.evidenceStatus),
								rowVersion: 1,
							},
						});
						await linkEvidence(
							transaction,
							body.sourceEvidenceIds,
							CanonicalEvidenceSubjectType.BOM_LINE,
							created.id,
						);
						return created;
					});

					return {
						status: 201,
						body: toBomLineResource(line, body.sourceEvidenceIds?.length ?? 0),
						headers: {
							Location: `/api/v1/catalog/bom-lines/${line.id}`,
							ETag: `"${line.rowVersion}"`,
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
	 * /api/v1/catalog/bom-definitions/{bomDefinitionId}:
	 *   patch:
	 *     operationId: catalogBomDefinitionPatch
	 *     summary: Update draft BOM evidence status
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: bomDefinitionId
	 *         required: true
	 *         schema: { type: string }
	 *       - $ref: '#/components/parameters/IfMatch'
	 *     responses:
	 *       200: { description: Updated draft BOM revision }
	 *       412: { description: Stale or missing If-Match }
	 */
	router.patch("/bom-definitions/:bomDefinitionId", async (req, res, next) => {
		try {
			const body = parseBody(req, bomDefinitionPatchSchema);
			const expectedVersion = requireIfMatch(req);
			const current = await database.bomDefinition.findUnique({
				where: { id: req.params.bomDefinitionId },
			});
			if (!current) throw notFound("The requested BOM definition was not found.");
			if (current.lifecycleStatus !== CatalogLifecycleStatus.DRAFT) throw publishedResource();
			if (current.rowVersion !== expectedVersion) throw staleVersion();

			const definition = await database.bomDefinition.update({
				where: { id: current.id },
				data: {
					evidenceStatus: evidenceStatus(body.evidenceStatus),
					rowVersion: { increment: 1 },
				},
			});
			res.setHeader("ETag", `"${definition.rowVersion}"`);
			res.status(200).json(
				toBomDefinitionResource(
					definition,
					await evidenceCount(
						database,
						CanonicalEvidenceSubjectType.BOM_DEFINITION,
						definition.id,
					),
				),
			);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	/** @openapi
	 * /api/v1/catalog/bom-lines/{bomLineId}:
	 *   patch:
	 *     operationId: catalogBomLinePatch
	 *     summary: Correct a draft BOM line without silent quantity conversion
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: bomLineId
	 *         required: true
	 *         schema: { type: string }
	 *       - $ref: '#/components/parameters/IfMatch'
	 *     responses:
	 *       200: { description: Updated draft BOM line }
	 *       412: { description: Stale or missing If-Match }
	 */
	router.patch("/bom-lines/:bomLineId", async (req, res, next) => {
		try {
			const body = parseBody(req, bomLinePatchSchema);
			const expectedVersion = requireIfMatch(req);
			const current = await database.bomLine.findUnique({
				where: { id: req.params.bomLineId },
			});
			if (!current) throw notFound("The requested BOM line was not found.");
			if (current.lifecycleStatus !== CatalogLifecycleStatus.DRAFT) throw publishedResource();
			if (current.rowVersion !== expectedVersion) throw staleVersion();

			const line = await database.bomLine.update({
				where: { id: current.id },
				data: {
					...(body.lineNumber === undefined ? {} : { lineNumber: body.lineNumber }),
					...(body.relationshipKind === undefined
						? {}
						: { relationshipKind: relationshipKind(body.relationshipKind) }),
					...(body.quantityMagnitude === undefined
						? {}
						: { quantityMagnitude: body.quantityMagnitude }),
					...(body.quantityUom === undefined ? {} : { quantityUom: body.quantityUom }),
					...(body.usageBasis === undefined ? {} : { usageBasis: body.usageBasis }),
					...(body.sourceRepresentation === undefined
						? {}
						: { sourceRepresentation: body.sourceRepresentation }),
					...(body.evidenceStatus === undefined
						? {}
						: { evidenceStatus: evidenceStatus(body.evidenceStatus) }),
					rowVersion: { increment: 1 },
				},
			});
			res.setHeader("ETag", `"${line.rowVersion}"`);
			res.status(200).json(
				toBomLineResource(
					line,
					await evidenceCount(database, CanonicalEvidenceSubjectType.BOM_LINE, line.id),
				),
			);
		} catch (error) {
			handleRouteError(error, req, res, next);
		}
	});

	return router;
}
