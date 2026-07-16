import assert from "node:assert";
import argon2 from "argon2";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { canonicalRouter } from "../app/canonical/router";
import { createLocalAuthDependencies } from "../app/identity/local-auth";
import type {
	LocalAccountRepository,
	LocalCredentialRecord,
	SubjectAssignmentRecord,
	SubjectRecord,
	SubjectRepository,
	VerifiedIdentity,
} from "../app/identity/types";

const secret = "local-auth-test-secret-which-is-long-enough";
const subject: SubjectRecord = {
	id: "subject-local-1",
	provider: "local",
	issuer: "pats-local",
	providerSubject: "operator-1",
	displayNameSnapshot: "Operator One",
	emailSnapshot: "operator@example.invalid",
	status: "ACTIVE",
};

class FakeRepository implements SubjectRepository, LocalAccountRepository {
	readonly credential: LocalCredentialRecord;
	lastLoginAt?: Date;

	constructor(passwordHash: string) {
		this.credential = { subjectId: subject.id, username: "operator.one", passwordHash };
	}

	async resolve(_identity: VerifiedIdentity): Promise<SubjectRecord> {
		return subject;
	}

	async findById(subjectId: string): Promise<SubjectRecord | null> {
		return subjectId === subject.id ? subject : null;
	}

	async listAssignments(_subjectId: string): Promise<SubjectAssignmentRecord[]> {
		return [{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }];
	}

	async findByUsername(username: string): Promise<LocalCredentialRecord | null> {
		return username === this.credential.username ? this.credential : null;
	}

	async markLogin(_subjectId: string, occurredAt: Date): Promise<void> {
		this.lastLoginAt = occurredAt;
	}
}

describe("PATS-local authentication", function () {
	this.timeout(15000);

	it("authenticates local credentials and issues a role-free bearer token", async () => {
		const passwordHash = await argon2.hash("correct-password", { timeCost: 2, memoryCost: 4096, parallelism: 1 });
		const repository = new FakeRepository(passwordHash);
		const localAuth = createLocalAuthDependencies(repository, repository, secret, { tokenTtlSeconds: 3600 });
		const app = express();
		app.use("/api/v1", canonicalRouter({ identity: localAuth, localAuth }));

		const login = await request(app)
			.post("/api/v1/auth/login")
			.send({ username: "Operator.One", password: "correct-password" })
			.expect("Content-Type", /application\/json/)
			.expect(200);

		assert.strictEqual(login.body.tokenType, "Bearer");
		assert.strictEqual(login.body.expiresIn, 3600);
		assert.ok(typeof login.body.accessToken === "string");
		assert.strictEqual(repository.lastLoginAt instanceof Date, true);

		const decoded = jwt.decode(login.body.accessToken) as Record<string, unknown>;
		assert.strictEqual(decoded.sub, subject.id);
		assert.strictEqual(decoded.typ, "pats-local-access");
		assert.strictEqual("role" in decoded, false);
		assert.strictEqual("workspaceId" in decoded, false);

		const self = await request(app)
			.get("/api/v1/users/me")
			.set("Authorization", `Bearer ${login.body.accessToken}`)
			.expect(200);
		assert.strictEqual(self.body.id, subject.id);
	});

	it("does not disclose whether a local username exists", async () => {
		const passwordHash = await argon2.hash("correct-password", { timeCost: 2, memoryCost: 4096, parallelism: 1 });
		const repository = new FakeRepository(passwordHash);
		const localAuth = createLocalAuthDependencies(repository, repository, secret);
		const app = express();
		app.use("/api/v1", canonicalRouter({ identity: localAuth, localAuth }));

		for (const credentials of [
			{ username: "operator.one", password: "wrong-password" },
			{ username: "missing.user", password: "wrong-password" },
		]) {
			const response = await request(app).post("/api/v1/auth/login").send(credentials).expect(401);
			assert.strictEqual(response.body.detail, "Invalid username or password.");
		}
	});

	it("rejects malformed login input with canonical validation details", async () => {
		const repository = new FakeRepository("unused");
		const localAuth = createLocalAuthDependencies(repository, repository, secret);
		const app = express();
		app.use("/api/v1", canonicalRouter({ localAuth }));

		const response = await request(app).post("/api/v1/auth/login").send({ username: "", password: "" }).expect(422);
		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:validation-error");
		assert.strictEqual(Array.isArray(response.body.errors), true);
	});

	it("rate-limits repeated local login attempts with canonical problem details", async () => {
		const repository = new FakeRepository("unused");
		const localAuth = createLocalAuthDependencies(repository, repository, secret);
		const app = express();
		app.use("/api/v1", canonicalRouter({ localAuth }));

		for (let attempt = 0; attempt < 10; attempt += 1) {
			await request(app)
				.post("/api/v1/auth/login")
				.send({ username: "operator.one", password: "wrong-password" })
				.expect(401);
		}

		const response = await request(app)
			.post("/api/v1/auth/login")
			.send({ username: "operator.one", password: "wrong-password" })
			.expect(429);
		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:rate-limit");
		assert.strictEqual(response.headers["retry-after"], "60");
	});
});
