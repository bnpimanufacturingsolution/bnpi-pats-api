import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import { domainReadRouter } from "../app/pats/domain-read";
import type { SubjectAssignmentRecord } from "../app/identity/types";

const MANAGE = [
	{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" },
	{ kind: "CAPABILITY", key: "operations.manage", status: "ACTIVE" },
] as SubjectAssignmentRecord[];

function identity(assignments: SubjectAssignmentRecord[]) {
	return {
		authenticator: { authenticate: async () => ({ provider: "local", issuer: "pats-local", providerSubject: "machine-user" }) },
		subjects: {
			resolve: async () => ({ id: "subject-machine", provider: "local", issuer: "pats-local", providerSubject: "machine-user", status: "ACTIVE" as const }),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

function commandApp(database: Record<string, unknown>, assignments: SubjectAssignmentRecord[] = MANAGE) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function readApp(database: Record<string, unknown>, assignments: SubjectAssignmentRecord[] = MANAGE) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(assignments),
		domainReads: { router: domainReadRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function commandDoubles(extra: Record<string, unknown>) {
	const database: Record<string, unknown> = {
		idempotencyRecord: {
			findUnique: async () => null,
			create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-machine", ...data }),
			update: async () => undefined,
			delete: async () => undefined,
		},
		$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) => work(database),
		auditRecord: { create: async () => undefined },
		outboxMessage: { create: async () => undefined },
		...extra,
	};
	return database;
}

describe("production line machine contract", () => {
	it("lists an empty machine collection for a line with no machines", async () => {
		const app = readApp({
			productionLine: { findUnique: async () => ({ id: "pline-1" }) },
			machine: {
				count: async () => 0,
				findMany: async () => [],
			},
		});

		const response = await request(app)
			.get("/api/v1/production-lines/pline-1/machines")
			.set("Authorization", "Bearer machine-token");

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({
			data: [],
			pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
		});
	});

	it("returns 404 when the production line does not exist", async () => {
		const app = readApp({
			productionLine: { findUnique: async () => null },
			machine: {
				count: async () => { throw new Error("must not query machines for a missing line"); },
				findMany: async () => { throw new Error("must not query machines for a missing line"); },
			},
		});

		const response = await request(app)
			.get("/api/v1/production-lines/missing/machines")
			.set("Authorization", "Bearer machine-token");

		expect(response.status).to.equal(404);
	});

	it("creates a machine on the line with a Location header", async () => {
		let createdData: Record<string, unknown> | undefined;
		const database = commandDoubles({
			productionLine: { findUnique: async () => ({ id: "pline-1" }) },
			machine: {
				findUnique: async () => null,
				count: async () => 0,
				create: async ({ data }: { data: Record<string, unknown> }) => {
					createdData = data;
					return { id: "machine-1", rowVersion: 1, ...data };
				},
			},
		});
		const app = commandApp(database);

		const response = await request(app)
			.post("/api/v1/production-lines/pline-1/machines")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-create-1")
			.send({ machineCode: "INJP-20441-JCX", name: "Injection Press" });

		expect(response.status).to.equal(201);
		expect(response.body).to.deep.equal({
			machineId: "machine-1",
			productionLineId: "pline-1",
			machineCode: "INJP-20441-JCX",
			name: "Injection Press",
			displayOrder: 0,
			isEnabled: true,
			rowVersion: 1,
		});
		expect(response.headers["location"]).to.equal("/api/v1/production-lines/pline-1/machines/machine-1");
		expect(createdData).to.include({ productionLineId: "pline-1", machineCode: "INJP-20441-JCX" });
	});

	it("rejects machine creation for a missing line and on duplicate code", async () => {
		const missingApp = commandApp(commandDoubles({
			productionLine: { findUnique: async () => null },
			machine: { create: async () => { throw new Error("must not create without a line"); } },
		}));
		const missing = await request(missingApp)
			.post("/api/v1/production-lines/missing/machines")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-create-missing")
			.send({ machineCode: "INJP-20441-JCX", name: "Injection Press" });
		expect(missing.status).to.equal(404);

		const dupApp = commandApp(commandDoubles({
			productionLine: { findUnique: async () => ({ id: "pline-1" }) },
			machine: {
				findUnique: async () => ({ id: "machine-9" }),
				create: async () => { throw new Error("must not create on conflict"); },
			},
		}));
		const dup = await request(dupApp)
			.post("/api/v1/production-lines/pline-1/machines")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-create-dup")
			.send({ machineCode: "INJP-20441-JCX", name: "Other Press" });
		expect(dup.status).to.equal(409);
		expect(dup.body.type).to.equal("urn:bandai:pats:problem:conflict");
	});

	it("rejects a lowercase machine code with 422", async () => {
		const app = commandApp(commandDoubles({
			productionLine: { findUnique: async () => ({ id: "pline-1" }) },
			machine: { create: async () => { throw new Error("must not create on validation failure"); } },
		}));
		const response = await request(app)
			.post("/api/v1/production-lines/pline-1/machines")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-create-bad-code")
			.send({ machineCode: "injp-lower", name: "Bad Press" });

		expect(response.status).to.equal(422);
	});

	it("denies machine creation without operations.manage", async () => {
		const app = commandApp(
			commandDoubles({
				productionLine: { findUnique: async () => ({ id: "pline-1" }) },
				machine: { create: async () => { throw new Error("must not create when denied"); } },
			}),
			[{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }],
		);
		const response = await request(app)
			.post("/api/v1/production-lines/pline-1/machines")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-create-denied")
			.send({ machineCode: "INJP-20441-JCX", name: "Injection Press" });

		expect(response.status).to.equal(403);
	});

	it("patches a machine with If-Match and bumps the row version", async () => {
		const row = { id: "machine-1", productionLineId: "pline-1", machineCode: "INJP-20441-JCX", name: "Injection Press", displayOrder: 0, isEnabled: true, rowVersion: 1 };
		const database = commandDoubles({
			machine: {
				findUnique: async () => ({ ...row }),
				update: async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...(data as object), rowVersion: 2 }),
			},
		});
		const app = commandApp(database);

		const response = await request(app)
			.patch("/api/v1/production-lines/pline-1/machines/machine-1")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-patch-1")
			.set("If-Match", '"1"')
			.send({ name: "Injection Press 01" });

		expect(response.status).to.equal(200);
		expect(response.body).to.include({ machineId: "machine-1", name: "Injection Press 01", rowVersion: 2 });
		expect(response.headers["etag"]).to.equal('"2"');

		const stale = await request(app)
			.patch("/api/v1/production-lines/pline-1/machines/machine-1")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-patch-stale")
			.set("If-Match", '"9"')
			.send({ name: "Stale Press" });
		expect(stale.status).to.equal(412);
	});

	it("returns 404 when the machine belongs to another line", async () => {
		const app = commandApp(commandDoubles({
			machine: {
				findUnique: async () => ({ id: "machine-1", productionLineId: "pline-other", rowVersion: 1 }),
				update: async () => { throw new Error("must not update a foreign-line machine"); },
				delete: async () => { throw new Error("must not delete a foreign-line machine"); },
			},
		}));

		const patched = await request(app)
			.patch("/api/v1/production-lines/pline-1/machines/machine-1")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-patch-foreign")
			.set("If-Match", '"1"')
			.send({ name: "Other Line Press" });
		expect(patched.status).to.equal(404);

		const deleted = await request(app)
			.delete("/api/v1/production-lines/pline-1/machines/machine-1")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-delete-foreign")
			.set("If-Match", '"1"');
		expect(deleted.status).to.equal(404);
	});

	it("deletes a machine with If-Match and keeps no dependents", async () => {
		let deletedId: string | undefined;
		const database = commandDoubles({
			machine: {
				findUnique: async () => ({ id: "machine-1", productionLineId: "pline-1", machineCode: "INJP-20441-JCX", rowVersion: 1 }),
				delete: async ({ where }: { where: { id: string } }) => { deletedId = where.id; return { id: where.id }; },
			},
		});
		const app = commandApp(database);

		const response = await request(app)
			.delete("/api/v1/production-lines/pline-1/machines/machine-1")
			.set("Authorization", "Bearer machine-token")
			.set("Idempotency-Key", "machine-delete-1")
			.set("If-Match", '"1"');

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({ machineId: "machine-1", machineCode: "INJP-20441-JCX" });
		expect(deletedId).to.equal("machine-1");
	});
});
