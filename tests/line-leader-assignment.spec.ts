import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

function identity(): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({
				provider: "local",
				issuer: "pats-local",
				providerSubject: "ll-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-command",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "ll-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () =>
				[{ kind: "CAPABILITY", key: "daily-metrics.encode", status: "ACTIVE" }] satisfies SubjectAssignmentRecord[],
		},
	};
}

function appFor(database: Record<string, unknown>) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity(),
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function db(assignments: Array<Record<string, unknown>>) {
	const database: Record<string, unknown> = {
		idempotencyRecord: {
			findUnique: async () => null,
			create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-1", ...data }),
			update: async () => undefined,
			delete: async () => undefined,
		},
		$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) =>
			work(database),
		monitoringDailySheet: {
			findUnique: async () => null,
			create: async ({ data }: { data: Record<string, unknown> }) => ({
				id: "sheet-1",
				rowVersion: 1,
				productionDate: data.productionDate,
				payloadJson: data.payloadJson,
			}),
		},
		workProcess: {
			findUnique: async () => ({
				subStageId: "sub-fs",
				subStage: { eligibleStages: [{ stageId: "stage-deco" }] },
			}),
		},
		lineLeaderAssignment: {
			findMany: async () => assignments,
		},
		auditRecord: { create: async () => undefined },
		outboxMessage: { create: async () => undefined },
	};
	return database;
}

const payload = {
	date: "2026-08-20",
	processId: "proc-fs-body-red",
	processName: "Full Spray · Body · Red",
	slots: [],
};

describe("Line Leader assignment coverage", () => {
	it("allows encode when the subject has no assignment rows (phase-0 bootstrap)", async () => {
		const app = appFor(db([]));
		const response = await request(app)
			.put("/api/v1/monitoring/daily-sheets/sheet-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "ll-boot-1")
			.send({ payload });
		expect(response.status).to.equal(201);
	});

	it("rejects encode outside the covering assignment", async () => {
		const app = appFor(
			db([{ stageId: "stage-injection", subStageId: null, workProcessId: null }]),
		);
		const response = await request(app)
			.put("/api/v1/monitoring/daily-sheets/sheet-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "ll-deny-1")
			.send({ payload });
		expect(response.status).to.equal(403);
	});

	it("allows encode when assignment covers Decoration / Full Spray", async () => {
		const app = appFor(
			db([{ stageId: "stage-deco", subStageId: "sub-fs", workProcessId: null }]),
		);
		const response = await request(app)
			.put("/api/v1/monitoring/daily-sheets/sheet-1")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "ll-allow-1")
			.send({ payload });
		expect(response.status).to.equal(201);
	});
});
