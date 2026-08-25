import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { domainReadRouter } from "../app/pats/domain-read";
import { commandRouter } from "../app/pats/command-router";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

function identity(assignments: SubjectAssignmentRecord[]): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({
				provider: "local",
				issuer: "pats-local",
				providerSubject: "line-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-command",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "line-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

describe("Production Line / StationProcess", () => {
	it("lists production lines", async () => {
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]),
			domainReads: {
				router: domainReadRouter({
					productionLine: {
						findMany: async () => [
							{ id: "line-01", name: "Line 01", kind: "MANUFACTURING", displayOrder: 1, workspaceId: "PATS" },
							{ id: "line-wh", name: "Warehouse", kind: "WAREHOUSE", displayOrder: 2, workspaceId: "PATS" },
						],
					},
				} as never, requireCanonicalCapability),
			},
		}));
		const response = await request(app)
			.get("/api/v1/production-lines")
			.set("Authorization", "Bearer read-token");
		expect(response.status).to.equal(200);
		expect(response.body.data).to.have.length(2);
		expect(response.body.data[0].kind).to.equal("MANUFACTURING");
	});

	it("does not list warehouse stations on the manufacturing directory", async () => {
		let receivedWhere: unknown;
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]),
			domainReads: {
				router: domainReadRouter({
					station: {
						findMany: async (args: { where?: Record<string, unknown> }) => {
							receivedWhere = args.where;
							return [];
						},
					},
				} as never, requireCanonicalCapability),
			},
		}));
		const response = await request(app)
			.get("/api/v1/stations")
			.set("Authorization", "Bearer read-token");
		expect(response.status).to.equal(200);
		expect(JSON.stringify(receivedWhere)).to.contain("MANUFACTURING");
		expect(JSON.stringify(receivedWhere)).to.not.match(/"kind":"WAREHOUSE"/);
	});

	it("replaces a station process list", async () => {
		const created: string[] = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-1", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) =>
				work(database),
			station: { findUnique: async () => ({ id: "station-fs" }) },
			workProcess: {
				findMany: async () => [{ id: "proc-red" }, { id: "proc-white" }],
			},
			stationProcess: {
				deleteMany: async () => ({ count: 1 }),
				create: async ({ data }: { data: { processId: string } }) => {
					created.push(data.processId);
					return data;
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "operations-admin", status: "ACTIVE" }]),
			domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
		}));
		const response = await request(app)
			.put("/api/v1/stations/station-fs/processes")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "sp-1")
			.send({ processIds: ["proc-red", "proc-white", "proc-red"] });
		expect(response.status).to.equal(200);
		expect(response.body.processIds).to.deep.equal(["proc-red", "proc-white"]);
		expect(created).to.deep.equal(["proc-red", "proc-white"]);
	});

	it("creates a process leaf and assigns it to a station", async () => {
		const created: Array<Record<string, unknown>> = [];
		const assigned: Array<Record<string, unknown>> = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-1", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) =>
				work(database),
			station: { findUnique: async () => ({ id: "station-fs" }) },
			workProcess: {
				findFirst: async () => ({ displayOrder: 4 }),
				create: async ({ data }: { data: Record<string, unknown> }) => {
					const row = { id: "proc-new", labelledCycleTimeSec: null, ...data };
					created.push(row);
					return row;
				},
			},
			stationProcess: {
				create: async ({ data }: { data: Record<string, unknown> }) => {
					assigned.push(data);
					return data;
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "operations-admin", status: "ACTIVE" }]),
			domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
		}));
		const response = await request(app)
			.post("/api/v1/work-processes")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "wp-1")
			.send({ name: "Full Spray · Body · Blue", stationId: "station-fs" });
		expect(response.status).to.equal(201);
		expect(response.body.name).to.equal("Full Spray · Body · Blue");
		expect(response.body.stationId).to.equal("station-fs");
		expect(created[0]?.name).to.equal("Full Spray · Body · Blue");
		expect(assigned).to.deep.equal([{ stationId: "station-fs", processId: "proc-new" }]);
	});

	it("lets a planner with catalog.manage reorder stations", async () => {
		const updates: Array<{ id: string; displayOrder: number }> = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-1", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) =>
				work(database),
			station: {
				findMany: async (args?: { where?: { id?: { notIn?: string[] } } }) => {
					if (args?.where?.id?.notIn) return [];
					return [{ id: "station-mask" }, { id: "station-fs" }];
				},
				update: async ({ where, data }: { where: { id: string }; data: { displayOrder: number } }) => {
					updates.push({ id: where.id, displayOrder: data.displayOrder });
					return { id: where.id, ...data };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }, { kind: "ROLE_BUNDLE", key: "catalog-manager", status: "ACTIVE" }]),
			domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
		}));
		const response = await request(app)
			.put("/api/v1/stations/order")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "so-planner-1")
			.send({ stationIds: ["station-mask", "station-fs"] });
		expect(response.status).to.equal(200);
		expect(updates).to.deep.equal([
			{ id: "station-mask", displayOrder: 1 },
			{ id: "station-fs", displayOrder: 2 },
		]);
	});

	it("reorders manufacturing stations", async () => {
		const updates: Array<{ id: string; displayOrder: number }> = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-1", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) =>
				work(database),
			station: {
				findMany: async (args?: { where?: { id?: { notIn?: string[] } } }) => {
					if (args?.where?.id?.notIn) return [];
					return [{ id: "station-mask" }, { id: "station-fs" }];
				},
				update: async ({ where, data }: { where: { id: string }; data: { displayOrder: number } }) => {
					updates.push({ id: where.id, displayOrder: data.displayOrder });
					return { id: where.id, ...data };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "operations-admin", status: "ACTIVE" }]),
			domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
		}));
		const response = await request(app)
			.put("/api/v1/stations/order")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "so-1")
			.send({ stationIds: ["station-mask", "station-fs", "station-mask"] });
		expect(response.status).to.equal(200);
		expect(response.body.stationIds).to.deep.equal(["station-mask", "station-fs"]);
		expect(updates).to.deep.equal([
			{ id: "station-mask", displayOrder: 1 },
			{ id: "station-fs", displayOrder: 2 },
		]);
	});
});
