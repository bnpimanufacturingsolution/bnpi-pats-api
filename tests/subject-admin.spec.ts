import assert from "node:assert";
import argon2 from "argon2";
import express from "express";
import request from "supertest";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { subjectAdminRouter } from "../app/pats/subject-admin";
import type { SubjectAssignmentRecord } from "../app/identity/types";

interface SubjectRow {
	id: string;
	displayNameSnapshot: string | null;
	emailSnapshot: string | null;
	status: "ACTIVE" | "DISABLED";
	createdAt: Date;
	updatedAt: Date;
}

function seedState() {
	const now = new Date("2026-10-03T00:00:00.000Z");
	const subjects = new Map<string, SubjectRow>([
		["subject-admin", { id: "subject-admin", displayNameSnapshot: "Admin One", emailSnapshot: "admin@pats.local", status: "ACTIVE", createdAt: now, updatedAt: now }],
		["subject-operator", { id: "subject-operator", displayNameSnapshot: "Operator One", emailSnapshot: "operator@pats.local", status: "ACTIVE", createdAt: now, updatedAt: now }],
	]);
	const credentials = new Map<string, { subjectId: string; username: string; passwordHash: string; lastLoginAt: Date | null }>([
		["subject-admin", { subjectId: "subject-admin", username: "admin.one", passwordHash: "hash-admin", lastLoginAt: null }],
		["subject-operator", { subjectId: "subject-operator", username: "operator.one", passwordHash: "hash-operator", lastLoginAt: null }],
	]);
	const assignments: Array<{ subjectId: string; kind: "ROLE_BUNDLE"; key: string; status: "ACTIVE" | "REVOKED" }> = [
		{ subjectId: "subject-admin", kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" },
		{ subjectId: "subject-operator", kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" },
	];
	const audit: Array<Record<string, unknown>> = [];
	return { subjects, credentials, assignments, audit };
}

type State = ReturnType<typeof seedState>;

function databaseFor(state: State) {
	const tx = {
		subject: {
			create: async ({ data }: { data: Record<string, unknown> }) => {
				const row: SubjectRow = {
					id: `subject-${state.subjects.size + 1}`,
					displayNameSnapshot: (data.displayNameSnapshot as string | null) ?? null,
					emailSnapshot: (data.emailSnapshot as string | null) ?? null,
					status: (data.status as SubjectRow["status"]) ?? "ACTIVE",
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				state.subjects.set(row.id, row);
				return row;
			},
			update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
				const row = state.subjects.get(where.id);
				assert.ok(row, "expected subject to exist");
				if (data.displayNameSnapshot !== undefined) row.displayNameSnapshot = data.displayNameSnapshot as string | null;
				if (data.emailSnapshot !== undefined) row.emailSnapshot = data.emailSnapshot as string | null;
				if (data.status !== undefined) row.status = data.status as SubjectRow["status"];
				row.updatedAt = new Date();
				return row;
			},
		},
		subjectCredential: {
			create: async ({ data }: { data: { subjectId: string; username: string; passwordHash: string } }) => {
				state.credentials.set(data.subjectId, { ...data, lastLoginAt: null });
				return data;
			},
			update: async ({ where, data }: { where: { subjectId: string }; data: { passwordHash: string } }) => {
				const row = state.credentials.get(where.subjectId);
				assert.ok(row, "expected credential to exist");
				row.passwordHash = data.passwordHash;
				return row;
			},
		},
		subjectAssignment: {
			create: async ({ data }: { data: { subjectId: string; kind: "ROLE_BUNDLE"; key: string; status: "ACTIVE" } }) => {
				state.assignments.push({ ...data });
				return data;
			},
			updateMany: async ({ where, data }: { where: { subjectId: string; kind: string; status: string }; data: { status: "REVOKED"; revokedAt: Date } }) => {
				let count = 0;
				for (const row of state.assignments) {
					if (row.subjectId === where.subjectId && row.kind === where.kind && row.status === where.status) {
						row.status = data.status;
						count += 1;
					}
				}
				return { count };
			},
			upsert: async ({ where, update, create }: { where: { subjectId_kind_key: { subjectId: string; kind: "ROLE_BUNDLE"; key: string } }; update: { status: "ACTIVE"; revokedAt: null; suspendedAt: null }; create: { subjectId: string; kind: "ROLE_BUNDLE"; key: string; status: "ACTIVE" } }) => {
				const existing = state.assignments.find(
					(row) => row.subjectId === where.subjectId_kind_key.subjectId && row.kind === "ROLE_BUNDLE" && row.key === where.subjectId_kind_key.key,
				);
				if (existing) {
					existing.status = update.status;
					return existing;
				}
				state.assignments.push({ ...create });
				return create;
			},
		},
		auditRecord: {
			create: async ({ data }: { data: Record<string, unknown> }) => {
				state.audit.push(data);
				return data;
			},
		},
		outboxMessage: {
			create: async ({ data }: { data: Record<string, unknown> }) => data,
		},
	};
	return {
		subject: {
			findUnique: async ({ where }: { where: { id: string } }) => state.subjects.get(where.id) ?? null,
		},
		subjectCredential: {
			findUnique: async ({ where }: { where: { username?: string; subjectId?: string } }) => {
				if (where.username !== undefined) {
					for (const row of state.credentials.values()) if (row.username === where.username) return row;
					return null;
				}
				return state.credentials.get(where.subjectId as string) ?? null;
			},
		},
		subjectAssignment: {
			findMany: async ({ where }: { where: { subjectId: string; kind?: string; status?: string } }) =>
				state.assignments.filter(
					(row) =>
						row.subjectId === where.subjectId &&
						(where.kind === undefined || row.kind === where.kind) &&
						(where.status === undefined || row.status === where.status),
				),
		},
		$transaction: async <T>(work: (transaction: unknown) => Promise<T>): Promise<T> => work(tx),
	};
}

function appFor(state: State, assignments: SubjectAssignmentRecord[], subjectId = "subject-admin", authenticated = true) {
	const app = express();
	app.use(express.json());
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: {
				authenticator: {
					authenticate: async () =>
						authenticated
							? { provider: "local", issuer: "pats-local", providerSubject: "admin.one", subjectId }
							: null,
				},
				subjects: {
					resolve: async () => ({
						id: subjectId,
						provider: "local",
						issuer: "pats-local",
						providerSubject: "admin.one",
						status: "ACTIVE" as const,
					}),
					findById: async () => null,
					listAssignments: async () => assignments,
				},
			},
			subjectAdmin: { router: subjectAdminRouter(databaseFor(state) as never, requireCanonicalCapability) },
		}),
	);
	return app;
}

const adminAssignments: SubjectAssignmentRecord[] = [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }];
const operatorAssignments: SubjectAssignmentRecord[] = [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }];

describe("subject admin boundary", () => {
	it("creates a local subject with credential and role bundle (201 + Location)", async () => {
		const state = seedState();
		const response = await request(appFor(state, adminAssignments))
			.post("/api/v1/subjects")
			.send({ username: "qi.two", password: "temporary-password-12", displayName: "QI Two", email: "qi.two@pats.local", roleBundle: "qi" })
			.expect(201);

		assert.ok(response.headers.location.startsWith("/api/v1/subjects/"));
		assert.strictEqual(response.body.username, "qi.two");
		assert.strictEqual(response.body.displayName, "QI Two");
		assert.strictEqual(response.body.email, "qi.two@pats.local");
		assert.strictEqual(response.body.status, "ACTIVE");
		assert.strictEqual(response.body.roleBundle, "qi");
		assert.strictEqual(response.body.passwordHash, undefined);
		assert.strictEqual(JSON.stringify(response.body).includes("pats-local"), false);
		assert.ok(await argon2.verify(state.credentials.get(response.body.id)?.passwordHash as string, "temporary-password-12"));
		assert.deepStrictEqual(state.audit.map((entry) => entry.action), ["SUBJECT_CREATED"]);
	});

	it("rejects duplicate usernames with 409", async () => {
		const state = seedState();
		await request(appFor(state, adminAssignments))
			.post("/api/v1/subjects")
			.send({ username: "operator.one", password: "temporary-password-12", displayName: "Dupe", roleBundle: "operator" })
			.expect(409);
	});

	it("validates the create body with field-level errors (422)", async () => {
		const state = seedState();
		const response = await request(appFor(state, adminAssignments))
			.post("/api/v1/subjects")
			.send({ username: "BAD NAME", password: "short", displayName: "", roleBundle: "superadmin" })
			.expect(422);
		assert.ok(Array.isArray(response.body.errors) && response.body.errors.length > 0);
	});

	it("forbids subject creation for non-admin capabilities (403)", async () => {
		const state = seedState();
		await request(appFor(state, operatorAssignments, "subject-operator"))
			.post("/api/v1/subjects")
			.send({ username: "qi.three", password: "temporary-password-12", displayName: "QI Three", roleBundle: "qi" })
			.expect(403);
	});

	it("requires authentication (401 when no bearer identity)", async () => {
		const state = seedState();
		await request(appFor(state, adminAssignments, "subject-admin", false))
			.post("/api/v1/subjects")
			.send({ username: "qi.four", password: "temporary-password-12", displayName: "QI Four", roleBundle: "qi" })
			.expect(401);
	});

	it("reads a single subject as a provider-safe projection", async () => {
		const state = seedState();
		const response = await request(appFor(state, adminAssignments)).get("/api/v1/subjects/subject-operator").expect(200);
		assert.strictEqual(response.body.id, "subject-operator");
		assert.strictEqual(response.body.username, "operator.one");
		assert.strictEqual(response.body.roleBundle, "operator");
		assert.deepStrictEqual(Object.keys(response.body).sort(), ["createdAt", "displayName", "email", "id", "lastLoginAt", "roleBundle", "status", "updatedAt", "username"]);
	});

	it("returns 404 for unknown subjects", async () => {
		const state = seedState();
		await request(appFor(state, adminAssignments)).get("/api/v1/subjects/subject-missing").expect(404);
		await request(appFor(state, adminAssignments)).patch("/api/v1/subjects/subject-missing").send({ displayName: "Ghost" }).expect(404);
	});

	it("patches display name, status, and role with a single field-replacement", async () => {
		const state = seedState();
		const response = await request(appFor(state, adminAssignments))
			.patch("/api/v1/subjects/subject-operator")
			.send({ displayName: "Operator Uno", status: "DISABLED", roleBundle: "qi" })
			.expect(200);
		assert.strictEqual(response.body.displayName, "Operator Uno");
		assert.strictEqual(response.body.status, "DISABLED");
		assert.strictEqual(response.body.roleBundle, "qi");
		assert.ok(state.assignments.every((row) => row.subjectId !== "subject-operator" || row.key !== "operator" || row.status === "REVOKED"));
		assert.deepStrictEqual(state.audit.map((entry) => entry.action), ["SUBJECT_UPDATED"]);
	});

	it("resets the password without exposing the hash", async () => {
		const state = seedState();
		const response = await request(appFor(state, adminAssignments))
			.patch("/api/v1/subjects/subject-operator")
			.send({ password: "brand-new-password-34" })
			.expect(200);
		assert.strictEqual(response.body.passwordHash, undefined);
		assert.ok(await argon2.verify(state.credentials.get("subject-operator")?.passwordHash as string, "brand-new-password-34"));
	});

	it("blocks self-disable and self-demote (403)", async () => {
		const state = seedState();
		await request(appFor(state, adminAssignments)).patch("/api/v1/subjects/subject-admin").send({ status: "DISABLED" }).expect(403);
		await request(appFor(state, adminAssignments)).patch("/api/v1/subjects/subject-admin").send({ roleBundle: "operator" }).expect(403);
	});

	it("rejects empty patches with 422", async () => {
		const state = seedState();
		await request(appFor(state, adminAssignments)).patch("/api/v1/subjects/subject-operator").send({}).expect(422);
	});
});
