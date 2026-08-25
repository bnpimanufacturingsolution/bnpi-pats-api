import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import { nextExpectedRouteStep } from "../app/pats/batch-resolve";
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

describe("Part route (station + process)", () => {
	it("replaces an ordered station/process route and can omit Mask Spray", async () => {
		const created: Array<Record<string, unknown>> = [];
		const database: Record<string, unknown> = {
			idempotencyRecord: {
				findUnique: async () => null,
				create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "idempotency-1", ...data }),
				update: async () => undefined,
				delete: async () => undefined,
			},
			$transaction: async (work: (transaction: Record<string, unknown>) => Promise<unknown>) =>
				work(database),
			partsList: { findUnique: async () => ({ id: "pl-1" }) },
			part: { findUnique: async () => ({ id: "part-1" }) },
			station: {
				findMany: async () => [
					{ id: "station-fs", stageId: "stg-deco", boundSteps: [{ subStageId: "sub-fs" }] },
					{ id: "station-tampo", stageId: "stg-deco", boundSteps: [{ subStageId: "sub-tampo" }] },
				],
			},
			workProcess: { findMany: async () => [{ id: "proc-red" }, { id: "proc-face" }] },
			routingStep: {
				deleteMany: async () => ({ count: 3 }),
				create: async ({ data }: { data: Record<string, unknown> }) => {
					created.push(data);
					return { id: `step-${created.length}`, ...data };
				},
			},
			auditRecord: { create: async () => undefined },
			outboxMessage: { create: async () => undefined },
		};
		const app = express();
		app.use("/api/v1", canonicalRouter({
			identity: identity([{ kind: "ROLE_BUNDLE", key: "planner", status: "ACTIVE" }]),
			domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
		}));
		const response = await request(app)
			.put("/api/v1/parts-lists/pl-1/parts/part-1/route")
			.set("Authorization", "Bearer command-token")
			.set("Idempotency-Key", "route-1")
			.send({
				steps: [
					{ stationId: "station-fs", processId: "proc-red" },
					{ stationId: "station-tampo", processId: "proc-face" },
				],
			});
		expect(response.status).to.equal(200);
		expect(response.body.steps).to.have.length(2);
		expect(created.map((row) => row.stationId)).to.deep.equal(["station-fs", "station-tampo"]);
		expect(created.some((row) => row.stationId === "station-mask")).to.equal(false);
	});

	it("exposes stationId on the next expected route step", () => {
		const next = nextExpectedRouteStep(
			[
				{
					id: "step-1",
					stageId: "stg-deco",
					subStageId: "sub-fs",
					stationId: "station-fs",
					processId: "proc-red",
					stepOrder: 1,
					partId: "part-1",
				},
				{
					id: "step-2",
					stageId: "stg-deco",
					subStageId: "sub-tampo",
					stationId: "station-tampo",
					processId: "proc-face",
					stepOrder: 2,
					partId: "part-1",
				},
			],
			"step-1",
		);
		expect(next?.stationId).to.equal("station-tampo");
		expect(next?.processId).to.equal("proc-face");
	});
});
