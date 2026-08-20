import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import { isInjectionOriginStage } from "../app/pats/command-support";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

function identity(assignments: SubjectAssignmentRecord[]): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({
				provider: "local",
				issuer: "pats-local",
				providerSubject: "command-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-command",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "command-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

function appFor(database: Record<string, unknown>) {
	const app = express();
	app.use("/api/v1", canonicalRouter({
		identity: identity([{ kind: "ROLE_BUNDLE", key: "production-operator", status: "ACTIVE" }]),
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function idempotentDb(extra: Record<string, unknown>) {
	const database: Record<string, unknown> = {
		idempotencyRecord: {
			findUnique: async () => null,
			create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-1", ...data }),
			update: async () => undefined,
			delete: async () => undefined,
		},
		$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) =>
			work(database),
		auditRecord: { create: async () => undefined },
		outboxMessage: { create: async () => undefined },
		...extra,
	};
	return database;
}

describe("Injection origin", () => {
	it("treats Injection catalog names as origin", () => {
		expect(isInjectionOriginStage({ name: "Injection" })).to.equal(true);
		expect(isInjectionOriginStage({ name: "Injection (Molding)" })).to.equal(true);
		expect(isInjectionOriginStage({ name: "Decoration" })).to.equal(false);
	});

	it("rejects STAGE_SCAN_RECORDED at Injection", async () => {
		const database = idempotentDb({
			stage: { findUnique: async () => ({ name: "Injection" }) },
			batch: { findUnique: async () => ({ id: "batch-1", lotId: "lot-1" }) },
		});
		const app = appFor(database);
		const response = await request(app)
			.post("/api/v1/stage-events")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "inj-scan-1")
			.send({ batchId: "batch-1", stageId: "stage-injection", eventType: "STAGE_SCAN_RECORDED" });

		expect(response.status).to.equal(409);
		expect(response.body.detail).to.match(/Injection is origin/i);
	});

	it("rejects RECEIVING into Injection", async () => {
		const database = idempotentDb({
			batch: {
				findUnique: async () => ({
					id: "batch-1",
					lotId: "lot-1",
					lot: { projectId: "plan-1" },
				}),
			},
			part: { findFirst: async () => ({ id: "part-1" }) },
			stage: { findUnique: async () => ({ name: "Injection" }) },
		});
		const app = appFor(database);
		const response = await request(app)
			.post("/api/v1/inventory-transactions")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "inj-recv-1")
			.send({
				transactionType: "RECEIVING",
				batchId: "batch-1",
				partId: "part-1",
				toStageId: "stage-injection",
				expectedQuantity: 240,
				actualQuantity: 240,
			});

		expect(response.status).to.equal(409);
		expect(response.body.detail).to.match(/Injection is origin/i);
	});
});
