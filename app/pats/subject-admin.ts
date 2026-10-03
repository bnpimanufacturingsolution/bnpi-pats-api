import { Router, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import argon2 from "argon2";
import type { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import {
	CommandProblem,
	actorId,
	commandError,
	parseCommandBody,
	recordCommandSuccess,
	sendCommandProblem,
} from "./command-support";

type SubjectAdminDatabase = Pick<
	PatsPrismaClient,
	"$transaction" | "subject" | "subjectCredential" | "subjectAssignment"
>;

const PROBLEM_TYPE = {
	validation: "urn:bandai:pats:problem:validation-error",
	notFound: "urn:bandai:pats:problem:not-found",
	conflict: "urn:bandai:pats:problem:conflict",
	authorizationDenied: "urn:bandai:pats:problem:authorization-denied",
	dependency: "urn:bandai:pats:problem:dependency-unavailable",
} as const;

const ROLE_BUNDLES = ["admin", "qi", "operator"] as const;

const usernameSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(/^[a-z0-9][a-z0-9._-]{2,127}$/, "Must be 3-128 characters: lowercase letters, digits, dot, underscore, or hyphen.");

const passwordSchema = z.string().min(12, "Must contain 12-1024 characters.").max(1024, "Must contain 12-1024 characters.");

const displayNameSchema = z.string().trim().min(1, "Must not be empty.").max(128, "Must be at most 128 characters.");

const emailSchema = z.string().trim().toLowerCase().max(254, "Must be at most 254 characters.").email("Must be a valid email address.");

const subjectCreateSchema = z.object({
	username: usernameSchema,
	password: passwordSchema,
	displayName: displayNameSchema,
	email: emailSchema.nullish(),
	roleBundle: z.enum(ROLE_BUNDLES),
});

const subjectPatchSchema = z
	.object({
		displayName: displayNameSchema.optional(),
		email: emailSchema.nullable().optional(),
		status: z.enum(["ACTIVE", "DISABLED"]).optional(),
		roleBundle: z.enum(ROLE_BUNDLES).optional(),
		password: passwordSchema.optional(),
	})
	.refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided." });

function notFoundProblem(req: Request, res: Response): void {
	sendCommandProblem(req, res, new CommandProblem(404, PROBLEM_TYPE.notFound, "Not Found", "The requested subject was not found."));
}

interface SubjectAdminRow {
	id: string;
	displayNameSnapshot: string | null;
	emailSnapshot: string | null;
	status: "ACTIVE" | "DISABLED";
	createdAt: Date;
	updatedAt: Date;
}

interface SubjectAdminResource {
	id: string;
	username: string | null;
	displayName: string | null;
	email: string | null;
	status: "ACTIVE" | "DISABLED";
	roleBundle: (typeof ROLE_BUNDLES)[number] | null;
	lastLoginAt: string | null;
	createdAt: string;
	updatedAt: string;
}

async function toResource(
	database: Pick<SubjectAdminDatabase, "subjectCredential" | "subjectAssignment">,
	subject: SubjectAdminRow,
): Promise<SubjectAdminResource> {
	const [credential, assignments] = await Promise.all([
		database.subjectCredential.findUnique({ where: { subjectId: subject.id } }),
		database.subjectAssignment.findMany({
			where: { subjectId: subject.id, kind: "ROLE_BUNDLE", status: "ACTIVE" },
			orderBy: { key: "asc" },
		}),
	]);
	return {
		id: subject.id,
		username: credential?.username ?? null,
		displayName: subject.displayNameSnapshot,
		email: subject.emailSnapshot,
		status: subject.status,
		roleBundle: (assignments[0]?.key as SubjectAdminResource["roleBundle"]) ?? null,
		lastLoginAt: credential?.lastLoginAt ? credential.lastLoginAt.toISOString() : null,
		createdAt: subject.createdAt.toISOString(),
		updatedAt: subject.updatedAt.toISOString(),
	};
}

/**
 * Admin subject management (CANONICAL).
 *
 * - GET /subjects/:subjectId requires identity.read (provider-safe projection).
 * - POST /subjects and PATCH /subjects/:subjectId require operations.manage.
 * - PATCH is field-replacement and idempotent; password is write-only and the
 *   single active ROLE_BUNDLE is replaced when roleBundle is present.
 * - The actor cannot disable or demote their own subject (403).
 * - No DELETE: disable via PATCH status (soft-hide, standard section 6).
 */
export function subjectAdminRouter(
	database: SubjectAdminDatabase,
	requireCapability: (capability: string) => RequestHandler,
): Router {
	const router = Router();

	router.get("/subjects/:subjectId", requireCapability("identity.read"), async (req, res) => {
		try {
			const subject = (await database.subject.findUnique({ where: { id: req.params.subjectId } })) as SubjectAdminRow | null;
			if (!subject) {
				notFoundProblem(req, res);
				return;
			}
			res
				.setHeader("Cache-Control", "no-store")
				.json(await toResource(database, subject));
		} catch {
			res
				.type("application/problem+json")
				.status(503)
				.json({
					type: PROBLEM_TYPE.dependency,
					title: "Dependency Unavailable",
					status: 503,
					detail: "PATS subject data is unavailable.",
					instance: req.originalUrl.split("?", 1)[0],
				});
		}
	});

	router.post("/subjects", requireCapability("operations.manage"), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, subjectCreateSchema);
			const existing = await database.subjectCredential.findUnique({ where: { username: body.username } });
			if (existing) {
				sendCommandProblem(
					req,
					res,
					new CommandProblem(409, PROBLEM_TYPE.conflict, "Conflict", "The requested username is already in use."),
				);
				return;
			}
			const created = await database.$transaction(async (transaction) => {
				const subject = (await transaction.subject.create({
					data: {
						provider: "local",
						issuer: "pats-local",
						providerSubject: body.username,
						displayNameSnapshot: body.displayName,
						emailSnapshot: body.email ?? null,
						status: "ACTIVE",
					},
				})) as SubjectAdminRow;
				await transaction.subjectCredential.create({
					data: { subjectId: subject.id, username: body.username, passwordHash: await argon2.hash(body.password) },
				});
				await transaction.subjectAssignment.create({
					data: { subjectId: subject.id, kind: "ROLE_BUNDLE", key: body.roleBundle, status: "ACTIVE" },
				});
				await recordCommandSuccess(transaction, req, "SUBJECT_CREATED", "Subject", subject.id, {
					username: body.username,
					roleBundle: body.roleBundle,
				});
				return subject;
			});
			const resource = await toResource(database, created);
			res.setHeader("Location", `/api/v1/subjects/${created.id}`).status(201).json(resource);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.patch("/subjects/:subjectId", requireCapability("operations.manage"), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, subjectPatchSchema);
			const subjectId = req.params.subjectId;
			const subject = (await database.subject.findUnique({ where: { id: subjectId } })) as SubjectAdminRow | null;
			if (!subject) {
				notFoundProblem(req, res);
				return;
			}
			const selfEdit = actorId(req) === subjectId;
			if (selfEdit && body.status === "DISABLED") {
				sendCommandProblem(
					req,
					res,
					new CommandProblem(403, PROBLEM_TYPE.authorizationDenied, "Forbidden", "The authenticated subject cannot disable its own account."),
				);
				return;
			}
			if (selfEdit && body.roleBundle !== undefined) {
				sendCommandProblem(
					req,
					res,
					new CommandProblem(403, PROBLEM_TYPE.authorizationDenied, "Forbidden", "The authenticated subject cannot change its own role."),
				);
				return;
			}
			const updated = await database.$transaction(async (transaction) => {
				const next = (await transaction.subject.update({
					where: { id: subjectId },
					data: {
						...(body.displayName !== undefined ? { displayNameSnapshot: body.displayName } : {}),
						...(body.email !== undefined ? { emailSnapshot: body.email } : {}),
						...(body.status !== undefined ? { status: body.status } : {}),
					},
				})) as SubjectAdminRow;
				if (body.password !== undefined) {
					await transaction.subjectCredential.update({
						where: { subjectId },
						data: { passwordHash: await argon2.hash(body.password) },
					});
				}
				if (body.roleBundle !== undefined) {
					await transaction.subjectAssignment.updateMany({
						where: { subjectId, kind: "ROLE_BUNDLE", status: "ACTIVE" },
						data: { status: "REVOKED", revokedAt: new Date() },
					});
					await transaction.subjectAssignment.upsert({
						where: { subjectId_kind_key: { subjectId, kind: "ROLE_BUNDLE", key: body.roleBundle } },
						update: { status: "ACTIVE", revokedAt: null, suspendedAt: null },
						create: { subjectId, kind: "ROLE_BUNDLE", key: body.roleBundle, status: "ACTIVE" },
					});
				}
				await recordCommandSuccess(transaction, req, "SUBJECT_UPDATED", "Subject", subjectId, {
					...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
					...(body.email !== undefined ? { email: body.email } : {}),
					...(body.status !== undefined ? { status: body.status } : {}),
					...(body.roleBundle !== undefined ? { roleBundle: body.roleBundle } : {}),
					passwordReset: body.password !== undefined,
				});
				return next;
			});
			res.json(await toResource(database, updated));
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	return router;
}
