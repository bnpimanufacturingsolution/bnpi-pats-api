import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { PrismaClient as PatsPrismaClient, Prisma } from "../../generated/pats-client";
import { z } from "zod";

const PROBLEM = {
	conflict: "urn:bandai:pats:problem:conflict",
	malformed: "urn:bandai:pats:problem:malformed-request",
	precondition: "urn:bandai:pats:problem:precondition-failed",
	notFound: "urn:bandai:pats:problem:not-found",
	validation: "urn:bandai:pats:problem:validation-error",
} as const;

export class CommandProblem extends Error {
	public constructor(
		public readonly status: number,
		public readonly type: string,
		public readonly title: string,
		detail: string,
		public readonly errors?: Array<{ field: string; message: string }>,
	) {
		super(detail);
		this.name = "CommandProblem";
	}
}

export interface CommandResponse {
	status: number;
	body: unknown;
	headers: Record<string, string>;
}

export type CommandTransaction = Prisma.TransactionClient;

export function actorId(req: Request): string {
	return (req as Request & { canonicalSubject?: { id?: string } }).canonicalSubject?.id ?? "canonical-subject";
}

export function actorDisplay(req: Request): string {
	return (req as Request & { canonicalSubject?: { displayNameSnapshot?: string } }).canonicalSubject?.displayNameSnapshot ?? actorId(req);
}

export function parseCommandBody<T>(req: Request, schema: z.ZodSchema<T>): T {
	const result = schema.safeParse(req.body);
	if (result.success) return result.data;
	throw new CommandProblem(
		422,
		PROBLEM.validation,
		"Validation Failed",
		"The request body contains invalid PATS command data.",
		result.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })),
	);
}

export function requireIfMatch(req: Request, resourceName: string): number {
	const value = req.header("If-Match");
	const match = value?.match(/^"(\d+)"$/);
	if (!match) {
		throw new CommandProblem(412, PROBLEM.precondition, "Precondition Failed", `If-Match must contain the current ${resourceName} row version.`);
	}
	return Number(match[1]);
}

export function sendCommandProblem(req: Request, res: Response, problem: CommandProblem): void {
	res.type("application/problem+json").status(problem.status).json({
		type: problem.type,
		title: problem.title,
		status: problem.status,
		detail: problem.message,
		instance: req.originalUrl.split("?", 1)[0],
		...(problem.errors ? { errors: problem.errors } : {}),
	});
}

export function setResourceVersion(res: Response, rowVersion: number): void {
	res.setHeader("ETag", `"${rowVersion}"`);
}

function requestHash(body: unknown): string {
	return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function isUniqueConstraint(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function headersValue(value: unknown): Record<string, string> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const entries = Object.entries(value);
	if (!entries.every(([, item]) => typeof item === "string")) return null;
	return Object.fromEntries(entries) as Record<string, string>;
}

/**
 * Claims and completes the canonical idempotency row in the same transaction as the command.
 * A crashed command leaves a pending claim, so concurrent reuse fails closed until the operator
 * explicitly expires the claim; no business row is duplicated by a retry.
 */
export async function executeCommand(
	database: PatsPrismaClient,
	req: Request,
	operation: string,
	body: unknown,
	work: (transaction: CommandTransaction) => Promise<CommandResponse>,
): Promise<CommandResponse & { replayed: boolean }> {
	const key = req.header("Idempotency-Key");
	if (!key || key.trim().length === 0 || key.length > 255) {
		throw new CommandProblem(400, PROBLEM.malformed, "Bad Request", "A valid Idempotency-Key header is required for this command.");
	}

	const subjectId = actorId(req);
	const hash = requestHash(body);
	let record = await database.idempotencyRecord.findUnique({
		where: { subjectId_operation_idempotencyKey: { subjectId, operation, idempotencyKey: key } },
	});
	if (record) {
		if (record.requestHash !== hash) {
			throw new CommandProblem(409, PROBLEM.conflict, "Conflict", "The Idempotency-Key was already used with a different request payload.");
		}
		if (record.status !== "COMPLETED" || record.responseStatus === null || record.responseBody === null) {
			throw new CommandProblem(409, PROBLEM.conflict, "Conflict", "The Idempotency-Key is already in progress or cannot be replayed safely.");
		}
		return {
			status: record.responseStatus,
			body: record.responseBody,
			headers: headersValue(record.responseHeaders) ?? {},
			replayed: true,
		};
	}

	try {
		record = await database.idempotencyRecord.create({
			data: { subjectId, operation, idempotencyKey: key, requestHash: hash },
		});
	} catch (error) {
		if (!isUniqueConstraint(error)) throw error;
		throw new CommandProblem(409, PROBLEM.conflict, "Conflict", "The Idempotency-Key is already being used by another request.");
	}

	try {
		const response = await database.$transaction(async (transaction) => {
			const result = await work(transaction);
			await transaction.idempotencyRecord.update({
				where: { id: record?.id },
				data: {
					status: "COMPLETED",
					responseStatus: result.status,
					responseBody: jsonValue(result.body),
					responseHeaders: jsonValue(result.headers),
				},
			});
			return result;
		});
		return { ...response, replayed: false };
	} catch (error) {
		await database.idempotencyRecord.delete({ where: { id: record.id } }).catch(() => undefined);
		throw error;
	}
}

export async function recordCommandSuccess(
	transaction: CommandTransaction,
	req: Request,
	action: string,
	resourceType: string,
	resourceId: string,
	detail: Record<string, unknown>,
): Promise<void> {
	const actorSubjectId = actorId(req);
	const correlationId = req.header("x-request-id") ?? null;
	await transaction.auditRecord.create({
		data: {
			actorSubjectId,
			action,
			resourceType,
			resourceId,
			outcome: "SUCCESS",
			correlationId,
			detail: jsonValue(detail),
		},
	});
	await transaction.outboxMessage.create({
		data: {
			aggregateType: resourceType,
			aggregateId: resourceId,
			eventType: action,
			payload: jsonValue({ ...detail, resourceType, resourceId, actorSubjectId }),
		},
	});
}

export function respondCommand(res: Response, response: CommandResponse): void {
	Object.entries(response.headers).forEach(([name, value]) => res.setHeader(name, value));
	res.status(response.status).json(response.body);
}

export function commandError(error: unknown, req: Request, res: Response, next: NextFunction): void {
	if (error instanceof CommandProblem) {
		sendCommandProblem(req, res, error);
		return;
	}
	if (isUniqueConstraint(error)) {
		sendCommandProblem(req, res, new CommandProblem(409, PROBLEM.conflict, "Conflict", "The requested PATS business identifier is already in use."));
		return;
	}
	next(error);
}

export const commandProblemTypes = PROBLEM;
