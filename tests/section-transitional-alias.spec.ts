import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import { domainReadRouter } from "../app/pats/domain-read";
import { PrismaClient } from "../generated/pats-client";
import type { CommandTransaction } from "../app/pats/command-support";

const adminIdentity = {
	authenticator: {
		authenticate: async (req: { header(name: string): string | undefined }) =>
			req.header("Authorization") === "Bearer t"
				? { provider: "local", issuer: "pats-local", providerSubject: "u" }
				: null,
	},
	subjects: {
		resolve: async () => ({ id: "sub-1", provider: "local", issuer: "pats-local", providerSubject: "u", status: "ACTIVE" }),
		findById: async () => null,
		listAssignments: async () => [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }],
	},
};

function appFor(database: Record<string, unknown>) {
	const app = express();
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: adminIdentity as never,
			domainReads: { router: domainReadRouter(database, requireCanonicalCapability) },
			domainCommands: { router: commandRouter(database, requireCanonicalCapability) },
		}),
	);
	return app;
}

describe("section canonical routes (post Station→Section rename)", () => {
	it("POST /sections with sectionCode emits no deprecation headers", async () => {
		const section = { id: "s-1", sectionCode: "SEC-1", name: "S1" };
		const database = new Proxy(new PrismaClient(), {
			get(_t, property) {
				switch (property) {
					case "stage": return { findUnique: async () => ({ id: "stage-1" }) };
					case "section": return { findUnique: async () => null, create: async () => section };
					case "subStage": return { findMany: async () => [{ id: "sub-1" }] };
					case "stationStep": return { createMany: async () => ({ count: 1 }) };
					case "idempotencyRecord": return { findUnique: async () => null, create: async () => ({ id: "i" }), update: async () => ({}) };
					case "$transaction": return async (work: (tx: CommandTransaction) => Promise<unknown>) => work(database);
					case "auditRecord": return { create: async () => ({}) };
					case "outboxMessage": return { create: async () => ({}) };
					default: throw new Error(`unexpected ${String(property)}`);
				}
			},
		});
		const res = await request(appFor(database))
			.post("/api/v1/sections")
			.set("Authorization", "Bearer t")
			.set("Idempotency-Key", "smoke-section-create")
			.send({ name: "S1", sectionCode: "SEC-1", stageId: "stage-1", displayOrder: 0 })
			.expect(201);
		expect(res.body).to.deep.equal({ sectionId: "s-1", sectionCode: "SEC-1", name: "S1" });
		expect(res.headers["deprecation"]).to.equal(undefined);
	});

	it("PUT /sections/order accepts sectionIds and returns canonical body", async () => {
		const database = new Proxy(new PrismaClient(), {
			get(_t, property) {
				switch (property) {
					case "section": return {
						findMany: async () => [{ id: "s-1" }],
						update: async () => ({}),
					};
					case "idempotencyRecord": return { findUnique: async () => null, create: async () => ({ id: "i" }), update: async () => ({}) };
					case "$transaction": return async (work: (tx: CommandTransaction) => Promise<unknown>) => work(database);
					case "auditRecord": return { create: async () => ({}) };
					case "outboxMessage": return { create: async () => ({}) };
					default: throw new Error(`unexpected ${String(property)}`);
				}
			},
		});
		const res = await request(appFor(database))
			.put("/api/v1/sections/order")
			.set("Authorization", "Bearer t")
			.set("Idempotency-Key", "smoke-section-order")
			.send({ sectionIds: ["s-1"] })
			.expect(200);
		expect(res.body).to.deep.equal({ sectionIds: ["s-1"] });
	});

	it("GET /sections list returns canonical shape", async () => {
		const database = new Proxy(new PrismaClient(), {
			get(_t, property) {
				if (property === "section") {
					return { findMany: async () => [{ id: "s-1", sectionCode: "SEC-1", name: "S1", boundSteps: [] }], count: async () => 1 };
				}
				throw new Error(`unexpected ${String(property)}`);
			},
		});
		const res = await request(appFor(database))
			.get("/api/v1/sections")
			.set("Authorization", "Bearer t")
			.expect(200);
		expect(res.body.data[0]).to.include({ sectionCode: "SEC-1" });
	});

	it("GET /booths accepts canonical section_id snake_case", async () => {
		let received: unknown;
		const database = new Proxy(new PrismaClient(), {
			get(_t, property) {
				if (property === "booth") {
					return { findMany: async (args: unknown) => { received = args; return []; } };
				}
				throw new Error(`unexpected ${String(property)}`);
			},
		});
		await request(appFor(database))
			.get("/api/v1/booths")
			.query({ section_id: "s-1" })
			.set("Authorization", "Bearer t")
			.expect(200);
		expect(received).to.deep.equal({ where: { isEnabled: true, sectionId: "s-1" }, orderBy: [{ displayOrder: "asc" }, { boothCode: "asc" }] });
	});
});
