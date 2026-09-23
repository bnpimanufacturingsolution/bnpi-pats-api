import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

function identity(assignments: SubjectAssignmentRecord[]): IdentityDependencies {
	return {
		authenticator: { authenticate: async () => ({ provider: "local", issuer: "pats-local", providerSubject: "delete-user" }) },
		subjects: {
			resolve: async () => ({ id: "subject-delete", provider: "local", issuer: "pats-local", providerSubject: "delete-user", status: "ACTIVE" as const }),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

function appFor(database: Record<string, unknown>) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity([{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]),
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function idempotencyStub() {
	let stored: Record<string, unknown> | null = null;
	return {
		findUnique: async () => stored,
		create: async ({ data }: { data: Record<string, unknown> }) => {
			stored = { id: "idem-delete", ...data, status: "PENDING", responseStatus: null, responseBody: null, responseHeaders: null };
			return stored;
		},
		update: async ({ data }: { data: Record<string, unknown> }) => {
			stored = { ...(stored ?? {}), ...data };
		},
		delete: async () => undefined,
	};
}

function audited() {
	return {
		auditRecord: { create: async () => undefined },
		outboxMessage: { create: async () => undefined },
	};
}

describe("work-process delete referential contract", () => {
	it("refuses with 409 when station-screen lines are attached instead of tripping the FK into a 500", async () => {
		const calls: string[] = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: idempotencyStub(),
			...audited(),
			$transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(database),
			workProcess: {
				findUnique: async () => ({ id: "proc-1", name: "Capsulation Task" }),
				findMany: async () => [],
				updateMany: async () => {
					calls.push("workProcess.updateMany");
					return { count: 0 };
				},
				delete: async () => {
					calls.push("workProcess.delete");
					return { id: "proc-1" };
				},
			},
			line: { count: async () => 1 },
			booth: { updateMany: async () => ({ count: 0 }) },
			monitoringDailySheet: { updateMany: async () => ({ count: 0 }) },
			monitoringStationBoard: { updateMany: async () => ({ count: 0 }) },
		};
		const response = await request(appFor(database))
			.delete("/api/v1/work-processes/proc-1")
			.set("Authorization", "Bearer admin-token")
			.set("Idempotency-Key", "wp-del-lines-1")
			.expect(409)
			.expect("Content-Type", /application\/problem\+json/);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:conflict");
		expect(response.body.detail).to.contain("line(s)");
		expect(calls).to.not.include("workProcess.delete");
	});

	it("detaches children, booths, and monitoring evidence instead of tripping FKs into a 500", async () => {
		const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
		const deletes: unknown[] = [];
		const childrenByParent: Record<string, Array<{ id: string }>> = {
			"proc-1": [{ id: "child-1" }],
			"child-1": [{ id: "grand-1" }],
			"grand-1": [],
		};
		const database: Record<string, unknown> = {
			idempotencyRecord: idempotencyStub(),
			...audited(),
			$transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(database),
			workProcess: {
				findUnique: async () => ({ id: "proc-1", name: "Full Spray" }),
				findMany: async ({ where }: { where: { parentProcessId: string } }) =>
					childrenByParent[where.parentProcessId] ?? [],
				updateMany: async ({ where, data }: { where: unknown; data: Record<string, unknown> }) => {
					updates.push({ where, data });
					return { count: 1 };
				},
				delete: async ({ where }: { where: unknown }) => {
					deletes.push(where);
					return { id: "proc-1" };
				},
			},
			line: { count: async () => 0 },
			booth: {
				updateMany: async ({ where, data }: { where: unknown; data: Record<string, unknown> }) => {
					updates.push({ where, data });
					return { count: 0 };
				},
			},
			monitoringDailySheet: {
				updateMany: async ({ where, data }: { where: unknown; data: Record<string, unknown> }) => {
					updates.push({ where, data });
					return { count: 0 };
				},
			},
			monitoringStationBoard: {
				updateMany: async ({ where, data }: { where: unknown; data: Record<string, unknown> }) => {
					updates.push({ where, data });
					return { count: 0 };
				},
			},
		};
		const response = await request(appFor(database))
			.delete("/api/v1/work-processes/proc-1")
			.set("Authorization", "Bearer admin-token")
			.set("Idempotency-Key", "wp-del-detach-1")
			.expect(200);
		expect(response.body).to.deep.equal({ processId: "proc-1" });
		// All descendants leave the section; only the direct child is
		// detached from the deleted parent so the subtree stays intact.
		const sectionUnassign = updates.find((update) => update.data.sectionId === null);
		expect(sectionUnassign).to.exist;
		expect((sectionUnassign?.where as { id: { in: string[] } }).id.in).to.have.members([
			"child-1",
			"grand-1",
		]);
		const parentDetach = updates.filter((update) => update.data.parentProcessId === null);
		expect(parentDetach).to.have.length(1);
		expect((parentDetach[0]?.where as { id: { in: string[] } }).id.in).to.deep.equal([
			"child-1",
		]);
		// Optional references (booth, daily sheet, station board) are
		// detached, not cascade-deleted.
		const referenceDetaches = updates.filter(
			(update) =>
				JSON.stringify(update.where) === JSON.stringify({ workProcessId: "proc-1" }),
		);
		expect(referenceDetaches).to.have.length(3);
		for (const detach of referenceDetaches) {
			expect(Object.values(detach.data)).to.deep.equal([null]);
		}
		expect(deletes).to.deep.equal([{ id: "proc-1" }]);
	});
});

describe("section delete referential contract", () => {
	it("refuses with 409 when station-screen lines belong to the section instead of tripping the FK into a 500", async () => {
		const calls: string[] = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: idempotencyStub(),
			...audited(),
			$transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(database),
			section: {
				findUnique: async () => ({ id: "sec-1", name: "Decoration", sectionCode: "SEC-DECO" }),
				delete: async () => {
					calls.push("section.delete");
					return { id: "sec-1" };
				},
			},
			line: { count: async () => 2 },
			stationStep: { deleteMany: async () => ({ count: 0 }) },
			booth: { updateMany: async () => ({ count: 0 }) },
			workProcess: { updateMany: async () => ({ count: 0 }) },
		};
		const response = await request(appFor(database))
			.delete("/api/v1/sections/sec-1")
			.set("Authorization", "Bearer admin-token")
			.set("Idempotency-Key", "sec-del-lines-1")
			.expect(409)
			.expect("Content-Type", /application\/problem\+json/);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:conflict");
		expect(response.body.detail).to.contain("line(s)");
		expect(calls).to.not.include("section.delete");
	});

	it("still deletes a section with no lines and unassigns its processes", async () => {
		const calls: string[] = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: idempotencyStub(),
			...audited(),
			$transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(database),
			section: {
				findUnique: async () => ({ id: "sec-1", name: "Decoration", sectionCode: "SEC-DECO" }),
				delete: async () => {
					calls.push("section.delete");
					return { id: "sec-1" };
				},
			},
			line: { count: async () => 0 },
			stationStep: {
				deleteMany: async () => {
					calls.push("stationStep.deleteMany");
					return { count: 0 };
				},
			},
			booth: {
				updateMany: async () => {
					calls.push("booth.updateMany");
					return { count: 0 };
				},
			},
			workProcess: {
				updateMany: async () => {
					calls.push("workProcess.updateMany");
					return { count: 0 };
				},
			},
		};
		const response = await request(appFor(database))
			.delete("/api/v1/sections/sec-1")
			.set("Authorization", "Bearer admin-token")
			.set("Idempotency-Key", "sec-del-ok-1")
			.expect(200);
		expect(response.body).to.deep.equal({ sectionId: "sec-1" });
		expect(calls).to.include.members([
			"stationStep.deleteMany",
			"booth.updateMany",
			"workProcess.updateMany",
			"section.delete",
		]);
	});
});
