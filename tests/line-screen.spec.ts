import express from "express";
import request from "supertest";
import { expect } from "chai";
import { canonicalRouter, requireCanonicalCapability } from "../app/canonical/router";
import { commandRouter } from "../app/pats/command-router";
import { domainReadRouter } from "../app/pats/domain-read";
import type { CommandTransaction } from "../app/pats/command-support";
import type { IdentityDependencies, SubjectAssignmentRecord } from "../app/identity/types";

type Database = Record<string, unknown>;

function identity(assignments: SubjectAssignmentRecord[], subjectId = "subject-command"): IdentityDependencies {
	return {
		authenticator: { authenticate: async () => ({ provider: "local", issuer: "pats-local", providerSubject: "command-user" }) },
		subjects: {
			resolve: async () => ({ id: subjectId, provider: "local", issuer: "pats-local", providerSubject: "command-user", status: "ACTIVE" as const }),
			findById: async () => null,
			listAssignments: async () => assignments,
		},
	};
}

const lineRow = {
	id: "line-1",
	sectionId: "section-1",
	processId: "process-1",
	lineCode: "DEC-LS-01",
	label: "Line Spray 01",
	assignedLeaderId: "subject-leader",
	activeLeaderId: "subject-leader",
	displayOrder: 0,
	isEnabled: true,
	rowVersion: 3,
	workProcess: { id: "process-1", name: "Line Spray", subStageId: "substage-1" },
	section: { id: "section-1", sectionCode: "SEC-DEC", name: "Decoration" },
	assignedLeader: { id: "subject-leader", displayNameSnapshot: "Aila Torres" },
	activeLeader: { id: "subject-leader", displayNameSnapshot: "Aila Torres" },
	operatorAssignments: [{ id: "assignment-1", subjectId: "subject-operator", subject: { id: "subject-operator", displayNameSnapshot: "Joshua Reyes" } }],
};

function appFor(database: Database, assignments: SubjectAssignmentRecord[], subjectId = "subject-command") {
	const app = express();
	const deps = identity(assignments, subjectId);
	app.use("/api/v1", canonicalRouter({
		identity: deps,
		domainReads: { router: domainReadRouter(database as never, requireCanonicalCapability) },
		domainCommands: { router: commandRouter(database as never, requireCanonicalCapability) },
	}));
	return app;
}

function commandDatabase(overrides: Record<string, unknown> = {}, calls: Record<string, unknown[]> = {}): Database {
	const store = { lineRow } as Record<string, unknown>;
	const database: Database = {
		section: {
			findUnique: async ({ where }: { where: { id: string } }) => (where.id === "section-1" ? { id: "section-1", name: "Decoration", sectionCode: "SEC-DEC" } : null),
		},
		line: {
			findUnique: async ({ where }: { where: { id: string } }) => (where.id === "line-1" ? { ...lineRow } : null),
			findFirst: async ({ where }: { where: { id?: string; OR?: Array<Record<string, unknown>> } }) => {
				const matchesSubject = (where.OR ?? []).some((clause) =>
					Object.values(clause).includes("subject-leader"));
				return where.id === "line-1" && matchesSubject ? { ...lineRow } : null;
			},
			count: async () => 1,
			create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "line-9", rowVersion: 1, displayOrder: 0, isEnabled: true, ...data }),
			update: async ({ data }: { data: Record<string, unknown> }) => ({ ...lineRow, ...data, rowVersion: lineRow.rowVersion + 1 }),
		},
		workProcess: {
			findUnique: async ({ where }: { where: { id: string } }) => (where.id === "process-1" ? { id: "process-1", isEnabled: true, sectionId: "section-1" } : null),
			count: async () => (calls.childCount ? (calls.childCount as number) : 0),
		},
		subject: {
			findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, status: "ACTIVE" }),
		},
		lineOperatorAssignment: {
			findFirst: async ({ where }: { where: { subjectId: string; status: string; lineId?: string } }) => {
				const existing = store.existingAssignment as Record<string, unknown> | null;
				if (existing && where.subjectId === existing.subjectId && where.status === "ACTIVE") return existing;
				return null;
			},
			findUnique: async ({ where }: { where: { id: string } }) => (where.id === "assignment-1" ? {
				id: "assignment-1",
				lineId: "line-1",
				subjectId: "subject-operator",
				status: "ACTIVE",
				line: { lineCode: "DEC-FS-MS-01", activeLeaderId: "subject-leader", assignedLeaderId: "subject-leader" },
			} : null),
			create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "assignment-9", status: "ACTIVE", startedAt: new Date(), endedAt: null, ...data }),
			update: async ({ data }: { data: Record<string, unknown> }) => ({ id: "assignment-1", lineId: "line-1", subjectId: "subject-operator", ...data, endedAt: new Date() }),
			updateMany: async () => ({ count: 1 }),
		},
		routingViolation: { count: async () => 2 },
		batchPositionProjection: { count: async () => 1 },
		monitoringDailySheet: { count: async () => 0 },
		idempotencyRecord: {
			findUnique: async () => null,
			create: async () => ({ id: "idem-1" }),
			update: async () => ({ id: "idem-1" }),
			delete: async () => ({ id: "idem-1" }),
		},
		auditRecord: {
			create: async ({ data }: { data: Record<string, unknown> }) => {
				(calls.audit as unknown[] ?? (calls.audit = [])).push(data.action);
				return data;
			},
		},
		outboxMessage: { create: async () => ({ id: "outbox-1" }) },
		$transaction: async <T>(work: (transaction: unknown) => Promise<T>) => work(database as unknown as CommandTransaction),
		...overrides,
	} as unknown as Database;
	return database;
}

describe("line-screen surface", () => {
	describe("GET /lines", () => {
		it("admin sees every enabled line with leader and operator projections", async () => {
			const seen: unknown[] = [];
			const database = {
				line: {
					count: async ({ where }: { where: unknown }) => { seen.push(where); return 1; },
					findMany: async () => [{ ...lineRow }],
				},
			};
			const response = await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.get("/api/v1/lines")
				.expect(200);
			expect(response.body.pagination).to.deep.equal({ page: 1, pageSize: 50, totalItems: 1, totalPages: 1 });
			expect(response.body.data).to.have.lengthOf(1);
			expect(response.body.data[0]).to.deep.include({ lineCode: "DEC-LS-01", sectionCode: "SEC-DEC", processName: "Line Spray" });
			expect(response.body.data[0].activeLeader.name).to.equal("Aila Torres");
			expect(response.body.data[0].operators).to.have.lengthOf(1);
			expect(seen[0]).to.deep.equal({ isEnabled: true });
		});

		it("a non-admin subject is scoped to lines they lead or operate", async () => {
			const seen: unknown[] = [];
			const database = {
				line: {
					count: async ({ where }: { where: unknown }) => { seen.push(where); return 0; },
					findMany: async () => [],
				},
			};
			const response = await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]))
				.get("/api/v1/lines")
				.expect(200);
			expect(response.body.data).to.have.lengthOf(0);
			expect(JSON.stringify(seen[0])).to.include("activeLeaderId");
			expect(JSON.stringify(seen[0])).to.include("operatorAssignments");
		});

		it("filters by section_id and process_id", async () => {
			const seen: unknown[] = [];
			const database = {
				line: {
					count: async ({ where }: { where: unknown }) => { seen.push(where); return 0; },
					findMany: async () => [],
				},
			};
			await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.get("/api/v1/lines?section_id=section-1&process_id=process-1")
				.expect(200);
			expect(seen[0]).to.deep.equal({ isEnabled: true, sectionId: "section-1", processId: "process-1" });
		});

		it("rejects unknown query keys", async () => {
			const database = { line: { count: async () => 0, findMany: async () => [] } };
			const response = await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.get("/api/v1/lines?bogus=1")
				.expect(400);
			expect(response.body.type).to.equal("urn:bandai:pats:problem:malformed-request");
		});
	});

	describe("GET /lines/{id}/attention", () => {
		it("returns evidence-derived attention flags", async () => {
			const database = commandDatabase();
			const response = await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.get("/api/v1/lines/line-1/attention")
				.expect(200);
			expect(response.body).to.deep.include({ lineId: "line-1", lineCode: "DEC-LS-01", openViolations: 2, stuckWip: 1, unfilledHour: true });
		});

		it("denies a subject not scoped to the line", async () => {
			const database = commandDatabase();
			const response = await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }], "subject-nobody"))
				.get("/api/v1/lines/line-1/attention")
				.expect(403);
			expect(response.body.type).to.equal("urn:bandai:pats:problem:authorization-denied");
		});

		it("returns 404 for an unknown or disabled line", async () => {
			const database = commandDatabase();
			await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.get("/api/v1/lines/missing/attention")
				.expect(404);
		});
	});

	describe("POST /lines", () => {
		const body = { sectionId: "section-1", processId: "process-1", lineCode: "DEC-FS-MS-02", assignedLeaderId: "subject-leader" };

		it("requires an Idempotency-Key", async () => {
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.post("/api/v1/lines").send(body)
				.expect(400).expect("Content-Type", /application\/problem\+json/);
			expect(response.body.detail).to.match(/Idempotency-Key/);
		});

		it("rejects a missing assigned leader with field-level validation", async () => {
			const { assignedLeaderId: _omitted, ...invalid } = body;
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.post("/api/v1/lines").set("Idempotency-Key", "line-key-1").send(invalid)
				.expect(422);
			expect(response.body.errors[0].field).to.equal("assignedLeaderId");
		});

		it("conflicts when the process has children (leaf-only rule)", async () => {
			const response = await request(appFor(commandDatabase({}, { childCount: 3 }), [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.post("/api/v1/lines").set("Idempotency-Key", "line-key-2").send(body)
				.expect(409);
			expect(response.body.type).to.equal("urn:bandai:pats:problem:conflict");
		});

		it("creates the line with active leader defaulting to the assigned leader", async () => {
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.post("/api/v1/lines").set("Idempotency-Key", "line-key-3").send(body)
				.expect(201);
			expect(response.headers.location).to.equal("/api/v1/lines/line-9");
			expect(response.headers.etag).to.equal('"1"');
			expect(response.body).to.deep.include({ lineCode: "DEC-FS-MS-02", assignedLeaderId: "subject-leader", activeLeaderId: "subject-leader" });
		});

		it("denies a subject without operations.manage", async () => {
			await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }]))
				.post("/api/v1/lines").set("Idempotency-Key", "line-key-4").send(body)
				.expect(403);
		});
	});

	describe("PATCH /lines/{id}", () => {
		it("requires If-Match with the current row version", async () => {
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.patch("/api/v1/lines/line-1").set("Idempotency-Key", "line-key-5").send({ label: "Renamed" })
				.expect(412);
			expect(response.body.type).to.equal("urn:bandai:pats:problem:precondition-failed");
		});

		it("updates fields and returns the next ETag", async () => {
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.patch("/api/v1/lines/line-1")
				.set("Idempotency-Key", "line-key-6")
				.set("If-Match", '"3"')
				.send({ label: "Renamed", activeLeaderId: null })
				.expect(200);
			expect(response.headers.etag).to.equal('"4"');
			expect(response.body).to.deep.include({ lineId: "line-1", label: "Renamed" });
		});
	});

	describe("DELETE /lines/{id}", () => {
		it("soft-disables the line and ends active operator assignments", async () => {
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.delete("/api/v1/lines/line-1")
				.set("Idempotency-Key", "line-key-7")
				.set("If-Match", '"3"')
				.expect(200);
			expect(response.body).to.deep.include({ lineId: "line-1", isEnabled: false });
			expect(response.headers.etag).to.equal('"4"');
		});
	});

	describe("DELETE /lines/{id}/permanent", () => {
		const disabledLineRow = { ...lineRow, isEnabled: false, rowVersion: 4 };

		function hardDeleteDatabase(overrides: Record<string, unknown> = {}) {
			const calls: Record<string, unknown[]> = {};
			const database = commandDatabase(
				{
					line: {
						findUnique: async ({ where }: { where: { id: string } }) =>
							where.id === "line-1" ? { ...disabledLineRow } : null,
						delete: async ({ where }: { where: { id: string } }) => {
							(calls.deleted ?? (calls.deleted = [])).push(where.id);
							return { ...disabledLineRow };
						},
					},
					lineOperatorAssignment: {
						count: async () => 0,
						deleteMany: async ({ where }: { where: { lineId: string } }) => {
							(calls.cleared ?? (calls.cleared = [])).push(where.lineId);
							return { count: 1 };
						},
					},
					...overrides,
				},
				calls,
			);
			return { database, calls };
		}

		const admin = [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }] as SubjectAssignmentRecord[];

		it("permanently deletes a disabled line with no active operators", async () => {
			const { database, calls } = hardDeleteDatabase();
			const response = await request(appFor(database, admin))
				.delete("/api/v1/lines/line-1/permanent")
				.set("Idempotency-Key", "line-key-8")
				.set("If-Match", '"4"')
				.expect(200);
			expect(response.body).to.deep.equal({ lineId: "line-1", lineCode: "DEC-LS-01" });
			expect(calls.cleared).to.deep.equal(["line-1"]);
			expect(calls.deleted).to.deep.equal(["line-1"]);
		});

		it("refuses with 409 while operators are still active (force disable first)", async () => {
			const { database } = hardDeleteDatabase({
				lineOperatorAssignment: {
					count: async () => 1,
					deleteMany: async () => ({ count: 0 }),
				},
			});
			const response = await request(appFor(database, admin))
				.delete("/api/v1/lines/line-1/permanent")
				.set("Idempotency-Key", "line-key-9")
				.set("If-Match", '"4"')
				.expect(409);
			expect(response.body.detail).to.contain("Force disable");
		});

		it("refuses with 409 while the line is still enabled (disable first)", async () => {
			const { database } = hardDeleteDatabase({
				line: {
					findUnique: async ({ where }: { where: { id: string } }) =>
						where.id === "line-1" ? { ...lineRow } : null,
					delete: async () => ({ ...lineRow }),
				},
			});
			const response = await request(appFor(database, admin))
				.delete("/api/v1/lines/line-1/permanent")
				.set("Idempotency-Key", "line-key-10")
				.set("If-Match", '"3"')
				.expect(409);
			expect(response.body.detail).to.contain("Disable the line");
		});

		it("returns 404 for an unknown line", async () => {
			const { database } = hardDeleteDatabase({
				line: {
					findUnique: async () => null,
					delete: async () => ({ ...disabledLineRow }),
				},
			});
			await request(appFor(database, admin))
				.delete("/api/v1/lines/missing/permanent")
				.set("Idempotency-Key", "line-key-11")
				.set("If-Match", '"1"')
				.expect(404);
		});
	});

	describe("operator assignments", () => {
		const assignmentBody = { subjectId: "subject-operator", lineId: "line-1" };

		it("assigns when the caller is the line's active leader", async () => {
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }], "subject-leader"))
				.post("/api/v1/operator-assignments").set("Idempotency-Key", "assign-1")
				.send({ ...assignmentBody, reason: "help" })
				.expect(201);
			expect(response.body.status).to.equal("ACTIVE");
		});

		it("conflicts while the operator is still on another line", async () => {
			const database = commandDatabase();
			database.lineOperatorAssignment = {
				...((database as { lineOperatorAssignment: unknown }).lineOperatorAssignment as Record<string, unknown>),
				findFirst: async () => ({ id: "assignment-old", lineId: "line-other" }),
			};
			const response = await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.post("/api/v1/operator-assignments").set("Idempotency-Key", "assign-2")
				.send(assignmentBody)
				.expect(409);
			expect(response.body.detail).to.match(/another line/);
		});

		it("forbids a non-leader non-admin from assigning", async () => {
			await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }], "subject-nobody"))
				.post("/api/v1/operator-assignments").set("Idempotency-Key", "assign-3")
				.send(assignmentBody)
				.expect(403);
		});

		it("ends an assignment when the caller is the line's active leader", async () => {
			const response = await request(appFor(commandDatabase(), [{ kind: "ROLE_BUNDLE", key: "operator", status: "ACTIVE" }], "subject-leader"))
				.delete("/api/v1/operator-assignments/assignment-1").set("Idempotency-Key", "assign-4")
				.expect(200);
			expect(response.body.status).to.equal("ENDED");
		});

		it("conflicts on an already-ended assignment", async () => {
			const database = commandDatabase();
			database.lineOperatorAssignment = {
				...((database as { lineOperatorAssignment: Record<string, unknown> }).lineOperatorAssignment),
				findUnique: async () => ({ id: "assignment-1", lineId: "line-1", subjectId: "subject-operator", status: "ENDED", line: { lineCode: "DEC-FS-MS-01", activeLeaderId: "subject-command", assignedLeaderId: "subject-command" } }),
			};
			await request(appFor(database, [{ kind: "ROLE_BUNDLE", key: "admin", status: "ACTIVE" }]))
				.delete("/api/v1/operator-assignments/assignment-1").set("Idempotency-Key", "assign-5")
				.expect(409);
		});
	});
});
