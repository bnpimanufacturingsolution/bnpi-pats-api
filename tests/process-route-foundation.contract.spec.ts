import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter } from "../app/canonical/router";
import { processRouteFoundationRouter } from "../app/pats/process-route-foundation";
import type { IdentityDependencies } from "../app/identity/types";

const date = new Date("2026-07-29T00:00:00.000Z");

function identity(): IdentityDependencies {
	return {
		authenticator: {
			authenticate: async () => ({
				provider: "local",
				issuer: "pats-local",
				providerSubject: "route-test-user",
			}),
		},
		subjects: {
			resolve: async () => ({
				id: "subject-route-test",
				provider: "local",
				issuer: "pats-local",
				providerSubject: "route-test-user",
				status: "ACTIVE" as const,
			}),
			findById: async () => null,
			listAssignments: async () => [
				{ kind: "CAPABILITY" as const, key: "catalog.manage", status: "ACTIVE" as const },
			],
		},
	};
}

function database() {
	const routes: Array<Record<string, any>> = [];
	const stages: Array<Record<string, any>> = [];
	const links: Array<Record<string, unknown>> = [];
	const db = {
		model: {
			findUnique: async ({ where }: { where: { id: string } }) =>
				where.id === "model-a" ? { id: "model-a" } : null,
		},
		processRoute: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const created = {
					id: `route-${routes.length + 1}`,
					...data,
					createdAt: date,
					updatedAt: date,
				};
				routes.push(created);
				return created;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				routes.find((route) => route.id === where.id) ?? null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const current = routes.find((route) => route.id === where.id);
				if (!current) throw new Error("missing route");
				const updated = {
					...current,
					...data,
					rowVersion: current.rowVersion + 1,
					updatedAt: new Date(date.getTime() + 1000),
				};
				routes[routes.indexOf(current)] = updated;
				return updated;
			},
		},
		processRouteStage: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const created = {
					id: `route-stage-${stages.length + 1}`,
					...data,
					createdAt: date,
					updatedAt: date,
				};
				stages.push(created);
				return created;
			},
			findUnique: async ({ where }: { where: { id: string } }) =>
				stages.find((stage) => stage.id === where.id) ?? null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const current = stages.find((stage) => stage.id === where.id);
				if (!current) throw new Error("missing stage");
				const updated = {
					...current,
					...data,
					rowVersion: current.rowVersion + 1,
					updatedAt: new Date(date.getTime() + 1000),
				};
				stages[stages.indexOf(current)] = updated;
				return updated;
			},
		},
		sourceEvidence: {
			findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
				where.id.in.map((id) => ({ id })),
		},
		canonicalEvidenceLink: {
			createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
				links.push(...data);
				return { count: data.length };
			},
			count: async ({ where }: { where: { subjectId: string } }) =>
				links.filter((link) => link.subjectId === where.subjectId).length,
		},
		$transaction: async <T>(callback: (transaction: typeof db) => Promise<T>) => callback(db),
	};
	return { db, routes, stages, links };
}

function appWithDatabase() {
	const state = database();
	const app = express();
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: identity(),
			catalogMutations: {
				requiredCapability: "catalog.manage",
				router: processRouteFoundationRouter(state.db as never),
			},
		}),
	);
	return { app, ...state };
}

describe("canonical process route writes", () => {
	it("creates an ordered route stage with source identity and provenance", async () => {
		const { app, routes, stages, links } = appWithDatabase();
		const routeResponse = await request(app)
			.post("/api/v1/catalog/process-routes")
			.set("Authorization", "Bearer route-test-token")
			.set("Idempotency-Key", "route-create")
			.send({
				modelId: "model-a",
				revision: 1,
				evidenceStatus: "INFERRED",
				sourceEvidenceIds: ["evidence-route"],
			});

		expect(routeResponse.status).to.equal(201);
		expect(routeResponse.body).to.include({
			modelId: "model-a",
			revision: 1,
			lifecycleStatus: "DRAFT",
		});
		expect(routes).to.have.length(1);

		const stageResponse = await request(app)
			.post("/api/v1/catalog/route-stages")
			.set("Authorization", "Bearer route-test-token")
			.set("Idempotency-Key", "stage-create")
			.send({
				processRouteId: routeResponse.body.id,
				sequence: 1,
				stageName: "Fullspray",
				sourceRepresentation: "Full Spray / paint",
				sourceEvidenceIds: ["evidence-stage"],
			});

		expect(stageResponse.status).to.equal(201);
		expect(stageResponse.body).to.include({
			sequence: 1,
			stageName: "Fullspray",
			stageKey: null,
		});
		expect(stageResponse.body.provenance).to.deep.equal({ sourceEvidenceCount: 1 });
		expect(stages).to.have.length(1);
		expect(links).to.have.length(2);
	});

	it("rejects a route stage with no canonical or source stage identity", async () => {
		const { app } = appWithDatabase();
		const routeResponse = await request(app)
			.post("/api/v1/catalog/process-routes")
			.set("Authorization", "Bearer route-test-token")
			.set("Idempotency-Key", "missing-stage-route")
			.send({ modelId: "model-a", revision: 1 });

		const response = await request(app)
			.post("/api/v1/catalog/route-stages")
			.set("Authorization", "Bearer route-test-token")
			.set("Idempotency-Key", "missing-stage-identity")
			.send({ processRouteId: routeResponse.body.id, sequence: 1 });

		expect(response.status).to.equal(422);
		expect(response.body.type).to.equal("urn:bandai:pats:problem:validation-error");
	});

	it("uses If-Match when correcting route stage sequence", async () => {
		const { app } = appWithDatabase();
		const routeResponse = await request(app)
			.post("/api/v1/catalog/process-routes")
			.set("Authorization", "Bearer route-test-token")
			.set("Idempotency-Key", "patch-route")
			.send({ modelId: "model-a", revision: 1 });
		const stageResponse = await request(app)
			.post("/api/v1/catalog/route-stages")
			.set("Authorization", "Bearer route-test-token")
			.set("Idempotency-Key", "patch-stage")
			.send({ processRouteId: routeResponse.body.id, sequence: 1, stageKey: "FULL_SPRAY" });

		const missingPrecondition = await request(app)
			.patch(`/api/v1/catalog/route-stages/${stageResponse.body.id}`)
			.set("Authorization", "Bearer route-test-token")
			.send({ sequence: 2 });
		expect(missingPrecondition.status).to.equal(412);

		const updated = await request(app)
			.patch(`/api/v1/catalog/route-stages/${stageResponse.body.id}`)
			.set("Authorization", "Bearer route-test-token")
			.set("If-Match", '"1"')
			.send({ sequence: 2 });
		expect(updated.status).to.equal(200);
		expect(updated.headers.etag).to.equal('"2"');
		expect(updated.body.sequence).to.equal(2);
	});
});
