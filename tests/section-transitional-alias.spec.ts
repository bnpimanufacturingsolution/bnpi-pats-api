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

	describe("section transitional aliases (Station rename bridge, standard section 7)", () => {
it("POST /stations accepts stationCode and emits Deprecation+Sunset with canonical Location", async () => {
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
			.post("/api/v1/stations")
			.set("Authorization", "Bearer t")
			.set("Idempotency-Key", "smoke-station-create")
			.send({ name: "S1", stationCode: "SEC-1", stageId: "stage-1", displayOrder: 0 })
			.expect(201);
		expect(res.body).to.deep.equal({ sectionId: "s-1", sectionCode: "SEC-1", name: "S1" });
		expect(res.headers["deprecation"]).to.equal("true");
		expect(res.headers["sunset"]).to.match(/GMT$/);
		expect(res.headers["location"]).to.equal("/api/v1/sections/s-1");
	});

	it("POST /sections with canonical sectionCode emits no deprecation headers", async () => {
		const section = { id: "s-2", sectionCode: "SEC-2", name: "S2" };
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
			.send({ name: "S2", sectionCode: "SEC-2", stageId: "stage-1", displayOrder: 0 })
			.expect(201);
		expect(res.headers["deprecation"]).to.equal(undefined);
	});

	it("PUT /stations/order accepts stationIds and returns canonical body", async () => {
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
			.put("/api/v1/stations/order")
			.set("Authorization", "Bearer t")
			.set("Idempotency-Key", "smoke-station-order")
			.send({ stationIds: ["s-1"] })
			.expect(200);
		expect(res.body).to.deep.equal({ sectionIds: ["s-1"] });
		expect(res.headers["deprecation"]).to.equal("true");
	});

	it("GET /stations list alias works with deprecation headers and both code keys", async () => {
		const database = new Proxy(new PrismaClient(), {
			get(_t, property) {
				if (property === "section") {
					return { findMany: async () => [{ id: "s-1", sectionCode: "SEC-1", name: "S1", boundSteps: [] }], count: async () => 1 };
				}
				throw new Error(`unexpected ${String(property)}`);
			},
		});
		const res = await request(appFor(database))
			.get("/api/v1/stations")
			.set("Authorization", "Bearer t")
			.expect(200);
		expect(res.body.data[0]).to.include({ sectionCode: "SEC-1", stationCode: "SEC-1" });
		expect(res.headers["deprecation"]).to.equal("true");
	});

	it("GET /booths accepts canonical station_id snake_case", async () => {
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
			.query({ station_id: "s-1" })
			.set("Authorization", "Bearer t")
			.expect(200);
		expect(received).to.deep.equal({ where: { isEnabled: true, stationId: "s-1" }, orderBy: [{ displayOrder: "asc" }, { boothCode: "asc" }] });
	});
});
