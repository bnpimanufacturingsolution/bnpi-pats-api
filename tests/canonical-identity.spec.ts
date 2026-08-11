import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { parse } from "yaml";
import { canonicalRouter } from "../app/canonical/router";
import type { IdentityDependencies, SubjectAssignmentRecord, SubjectRecord, VerifiedIdentity } from "../app/identity/types";

const verified: VerifiedIdentity = {
	provider: "on-prem-oidc",
	issuer: "https://identity.internal.example/realms/pats",
	providerSubject: "subject-123",
	displayName: "Operator One",
	email: "operator@example.invalid",
};

const activeSubject: SubjectRecord = {
	id: "subject-row-1",
	provider: verified.provider,
	issuer: verified.issuer,
	providerSubject: verified.providerSubject,
	displayNameSnapshot: verified.displayName,
	emailSnapshot: verified.email,
	status: "ACTIVE",
};

function createIdentity(
	authenticated: VerifiedIdentity | null = verified,
	subject: SubjectRecord = activeSubject,
	assignments: SubjectAssignmentRecord[] = [],
): IdentityDependencies {
	return {
		authenticator: { authenticate: async () => authenticated },
		subjects: {
			resolve: async () => subject,
			findById: async () => subject,
			listAssignments: async () => assignments,
		},
	};
}

function createTestApp(identity?: IdentityDependencies) {
	const app = express();
	app.use("/api/v1", canonicalRouter({ identity }));
	return app;
}

describe("canonical identity boundary", () => {
	it("returns a provider-safe self projection and does not expose provider identifiers", async () => {
		const response = await request(createTestApp(createIdentity())).get("/api/v1/users/me").expect(200);

		assert.deepStrictEqual(response.body, {
			id: "subject-row-1",
			displayName: "Operator One",
			email: "operator@example.invalid",
		});
		assert.strictEqual(JSON.stringify(response.body).includes("provider"), false);
		assert.strictEqual(JSON.stringify(response.body).includes("issuer"), false);
		assert.strictEqual(JSON.stringify(response.body).includes("subject-123"), false);
	});

	it("derives sorted capabilities from active direct assignments and role bundles", async () => {
		const response = await request(
			createTestApp(
				createIdentity(verified, activeSubject, [
					{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" },
					{ kind: "CAPABILITY", key: "execution.read", status: "ACTIVE" },
					{ kind: "CAPABILITY", key: "inventory.issue", status: "REVOKED" },
					{ kind: "CAPABILITY", key: "unapproved.capability", status: "ACTIVE" },
					{ kind: "ROLE_BUNDLE", key: "unknown-role", status: "ACTIVE" },
				]),
			),
		)
			.get("/api/v1/users/me/capabilities")
			.expect(200);

		assert.deepStrictEqual(response.body, {
			capabilities: [
				"execution.read",
				"material-requirement.manage",
				"monitoring.read",
				"planning.manage",
				"planning.read",
			],
		});
	});

	it("fails closed when authentication is absent", async () => {
		const response = await request(createTestApp(createIdentity(null)))
			.get("/api/v1/users/me")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(401);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:authentication-required");
		assert.strictEqual(response.headers["www-authenticate"], "Bearer");
	});

	it("fails closed when the resolved subject is disabled", async () => {
		const disabled: SubjectRecord = { ...activeSubject, status: "DISABLED" };
		const response = await request(createTestApp(createIdentity(verified, disabled)))
			.get("/api/v1/users/me")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(403);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:authorization-denied");
	});

	it("returns a canonical method problem for unsupported self-projection methods", async () => {
		const response = await request(createTestApp(createIdentity()))
			.post("/api/v1/users/me")
			.expect("Allow", "GET")
			.expect(405);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:method-not-allowed");
	});

	it("returns dependency-unavailable when no canonical adapter is composed", async () => {
		const response = await request(createTestApp()).get("/api/v1/users/me").expect(503);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:dependency-unavailable");
	});

	it("keeps the identity OpenAPI source contract aligned with the canonical routes", () => {
		const document = parse(
			fs.readFileSync(path.resolve(__dirname, "../docs/openapi/2026-07-15-pats-api-v1-identity.yaml"), "utf8"),
		) as { servers: Array<{ url: string }>; paths: Record<string, unknown> };

		assert.ok(document.servers.some((server) => server.url === "/api/v1"));
		assert.deepStrictEqual(Object.keys(document.paths).sort(), ["/auth/login", "/users/me", "/users/me/capabilities"]);
	});
});
