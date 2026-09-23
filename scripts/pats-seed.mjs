/**
 * Canonical PATS seed orchestrator (demo / uat).
 *
 * Primary catalog/plan material is drawn from client parts-list evidence for
 * B251 Machibouke Hamburger Shop 3 (Rev 6.0) — see pats-seed-client-b251.mjs.
 * Contour families: inj parts, deco part nos, paint nos (PN-*), shared capsule.
 * Values remain PROVISIONAL seed evidence, not Drive-approved publication.
 *
 * SEED_MODE=none|demo|uat — additive + idempotent by default (+ PATS_SEED_FRESH=1
 * for a gated reset+reseed; dev/test only, never default, refused in production).
 * The seeded subjects are the canonical RBAC fixture set for future Playwright
 * ABAC/RBAC tests — positive + negative capability/deny paths. See the fixture
 * table in seedProfile(). v1.0 fabricated B308 family is dropped.
 *
 * Requires PATS_DATABASE_URL and PATS_SEED_PASSWORD (12-1024 chars) for writable modes.
 */
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "../generated/pats-client/index.js";
import {
	CLIENT_B251,
	decoPartDisplayName,
	paintPartDisplayName,
} from "./pats-seed-client-b251.mjs";

const mode = (process.env.SEED_MODE ?? "none").trim().toLowerCase();

if (mode === "none") {
	console.log("PATS seed mode is none; no writes performed.");
	process.exit(0);
}

if (mode !== "demo" && mode !== "uat") {
	throw new Error("SEED_MODE must be one of: none, demo, uat.");
}

if (!process.env.PATS_DATABASE_URL) {
	throw new Error("PATS_DATABASE_URL is required when SEED_MODE is demo or uat.");
}

const password = process.env.PATS_SEED_PASSWORD?.trim();
if (!password || password.length < 12 || password.length > 1024) {
	throw new Error("PATS_SEED_PASSWORD must contain 12-1024 characters for demo/uat seeding.");
}

// ── Fresh-reset (guarded destructive wipe) ───────────────────────
// PATS_SEED_FRESH=1 turns this run into reset+reseed: wipe the canonical PATS
// tables (dependency-ordered deleteMany) then run the additive upsert below.
// Gated on purpose: never on by default, refused for production ENVs, and the
// wipe runs INSIDE the same $transaction as the seed so any failure rolls the
// whole reset back instead of leaving a half-wiped database. The additive
// upserts remain the default path.
const freshReset = (process.env.PATS_SEED_FRESH ?? "").trim() === "1";
if (freshReset) {
	const seedEnv = (process.env.ENV ?? process.env.NODE_ENV ?? "").toLowerCase();
	if (seedEnv === "production" || seedEnv === "prod") {
		throw new Error(
			"PATS_SEED_FRESH refuses to run in production. Use ENV=dev|test (or leave it unset for a local dev DB).",
		);
	}
}

const profile = mode;
// Relative-to-now anchor so every fresh seed is "recent" and plans/batches/QC
// line up with the monitoring sheets (which snap to today) instead of a stale
// frozen date. All offsets below spread from this single instant per run.
const seedClock = new Date(Date.now());
const prisma = new PrismaClient();

function stableId(key) {
	const hex = createHash("sha256").update(`pats-seed:${profile}:${key}`).digest("hex").slice(0, 32).split("");
	hex[12] = "5";
	hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
	return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

/** Business codes are bare stems (B251, ST-INJ-01, ...). No profile prefix:
 *  PATS business codes are globally unique in the schema, so multi-profile
 *  co-seeding is not supported. Profile identity lives in stableId() keys and
 *  sourceReference.seedProfile. */
function code(value) {
	return value;
}

function atOffset({ days = 0, hours = 0, minutes = 0 } = {}) {
	return new Date(seedClock.getTime() + ((days * 24 + hours) * 60 + minutes) * 60_000);
}

/**
 * Planned cycle-time seed assumptions, keyed per route step
 * (`stageId::subStageId`, empty subStageId when stage-wide).
 * SEED ASSUMPTION (user to correct with floor quotations): tampo is quick,
 * spray is slow, molding/capsule sit between; paint consumables carry no CT.
 * Paints (PN-*) stay null — honest absence, not zero.
 * Stage ids resolve mid-seed, so catalog rows seed null and the CT pass below
 * (once stages exist) fills the maps; run parts snapshot inline (stages in
 * scope there).
 */
function plannedCtMapForPartCode(partCode, ids) {
	if (typeof partCode !== "string") return null;
	if (partCode.startsWith("PN-")) return null;
	if (partCode === "C002-01-42") {
		return ids?.warehouse && ids?.packing ? { [`${ids.warehouse}::${ids.packing}`]: 20 } : null;
	}
	if (partCode.endsWith("ST")) {
		return ids?.decoration && ids?.tampo ? { [`${ids.decoration}::${ids.tampo}`]: 15 } : null;
	}
	if (partCode.endsWith("S")) {
		if (!ids?.decoration || !ids?.fullSpray || !ids?.lineSpray) return null;
		return {
			[`${ids.decoration}::${ids.fullSpray}`]: 40,
			[`${ids.decoration}::${ids.lineSpray}`]: 40,
		};
	}
	if (/^B251-01-\d+$/.test(partCode)) {
		return ids?.injection ? { [`${ids.injection}::`]: 25 } : null;
	}
	return null;
}

/** Hourly grid matching app monitoring encode (10 shift slots). */
function defaultDaySlots(actuals = []) {
	const labels = ["9:00", "10:00", "11:00", "12:00", "1:00", "2:00", "3:00", "4:00", "5:00", "6:00"];
	return labels.map((clockLabel, index) => ({
		index,
		clockLabel,
		actualOutput: actuals[index] === undefined ? null : actuals[index],
	}));
}

/** Calendar day for monitoring encode seed (local “today” so UI lists show data immediately). */
function monitoringSeedDate() {
	return new Date().toISOString().slice(0, 10);
}

/**
 * @param {string[]} roleBundles
 * @param {{ kind: "ROLE_BUNDLE" | "CAPABILITY"; key: string }[]} [extraAssignments]
 *   Direct CAPABILITY grants (e.g. Line Leader `daily-metrics.encode`). Not a fourth business role.
 */
async function upsertSubject(tx, key, username, displayName, roleBundles, passwordHash, extraAssignments = []) {
	// Email snapshot stays bound to the username: `/users/me` is the Layer-1
	// identity anchor and e2e asserts the `<username>@pats.local` address set
	// exactly (see e2e/rbac/api-matrix.spec.ts). Only the display name is narrative.
	const snapshotEmail = `${username}@pats.local`;
	const subject = await tx.subject.upsert({
		where: { id: stableId(key) },
		update: {
			displayNameSnapshot: displayName,
			emailSnapshot: snapshotEmail,
			status: "ACTIVE",
		},
		create: {
			id: stableId(key),
			provider: "local",
			issuer: "pats-local",
			providerSubject: username,
			displayNameSnapshot: displayName,
			emailSnapshot: snapshotEmail,
			status: "ACTIVE",
		},
	});

	await tx.subjectCredential.upsert({
		where: { username },
		update: { subjectId: subject.id, passwordHash },
		create: { subjectId: subject.id, username, passwordHash },
	});

	for (const role of roleBundles) {
		await tx.subjectAssignment.upsert({
			where: { subjectId_kind_key: { subjectId: subject.id, kind: "ROLE_BUNDLE", key: role } },
			update: { status: "ACTIVE", suspendedAt: null, revokedAt: null },
			create: { subjectId: subject.id, kind: "ROLE_BUNDLE", key: role, status: "ACTIVE" },
		});
	}

	for (const assignment of extraAssignments) {
		await tx.subjectAssignment.upsert({
			where: {
				subjectId_kind_key: {
					subjectId: subject.id,
					kind: assignment.kind,
					key: assignment.key,
				},
			},
			update: { status: "ACTIVE", suspendedAt: null, revokedAt: null },
			create: {
				subjectId: subject.id,
				kind: assignment.kind,
				key: assignment.key,
				status: "ACTIVE",
			},
		});
	}

	// Re-seed must slim leftover fat bundles (e.g. marco.villanueva no longer holds QC).
	const desiredKeys = new Set([
		...roleBundles.map((role) => `ROLE_BUNDLE:${role}`),
		...extraAssignments.map((assignment) => `${assignment.kind}:${assignment.key}`),
	]);
	const existingAssignments = await tx.subjectAssignment.findMany({
		where: { subjectId: subject.id, status: "ACTIVE" },
	});
	for (const assignment of existingAssignments) {
		if (!desiredKeys.has(`${assignment.kind}:${assignment.key}`)) {
			await tx.subjectAssignment.update({
				where: { id: assignment.id },
				data: { status: "REVOKED", revokedAt: seedClock },
			});
		}
	}

	await tx.userPreference.upsert({
		where: { userId: subject.id },
		update: { locale: "EN", completedTours: [] },
		create: { userId: subject.id, locale: "EN", completedTours: [] },
	});

	return subject;
}

/**
 * Dependency-ordered wipe of every canonical table the seed writes.
 * ONLY invoked when freshReset is enabled (guarded by PATS_SEED_FRESH + the ENV
 * check above). Runs inside the seed $transaction so a failed reset+reseed rolls
 * back cleanly. Children are deleted before parents. Tables outside the seed's
 * writable surface are intentionally left untouched.
 *
 * Beyond the seed-written tables this also clears:
 * - runtime-accumulating canonical tables (processChangeLog, idempotencyRecord)
 *   whose rows reference seeded subjects/projects and would otherwise wedge the
 *   reset; they are rebuilt from live API traffic.
 * - legacy orphan join tables (StationProcess, LineLeaderAssignment) that predate
 *   the current schema, still FK into seed tables, and have no Prisma model. They
 *   are cleared with raw SQL and skipped when absent (fresh DBs without the legacy
 *   migration history).
 */
async function wipeSeededTables(tx) {
	// Legacy tables predate the canonical model and usually do not exist. A
	// failed DELETE would abort the whole transaction (every later statement
	// then fails with 25P02), so probe pg_tables first instead of try/catch.
	const legacyRows = await tx.$queryRawUnsafe(
		"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('StationProcess', 'LineLeaderAssignment')",
	);
	const legacyTables = new Set(legacyRows.map((row) => row.tablename));
	for (const legacyTable of ["StationProcess", "LineLeaderAssignment"]) {
		if (legacyTables.has(legacyTable)) {
			await tx.$executeRawUnsafe(`DELETE FROM "${legacyTable}"`);
		}
	}

	for (const model of [
		"outboxMessage",
		"auditRecord",
		"idempotencyRecord",
		"qualityDecision",
		"qualityInspection",
		"workInstruction",
		"processChangeLog",
		"subjectAssignment",
		"subjectCredential",
		"userPreference",
		"monitoringStationBoard",
		"monitoringDailySheet",
		"routingViolation",
		"stageEvent",
		"printJob",
		"inventoryTransaction",
		"batchPositionProjection",
		"batchPartLine",
		"lotPartAllocation",
		"batch",
		"materialRequirement",
		"routingStep",
		"pmrs",
		"partsList",
		"qualityStageAssignment",
		"stationStep",
		"subStageEligibility",
		"processRouteStage",
		"booth",
		"workProcess",
		"stage",
		"subStage",
		"section",
		"bomLine",
		"bomDefinition",
		"modelPart",
		"processRoute",
		"lot",
		"part",
		"planDemandAllocation",
		"projectModelAllocation",
		"productSpecification",
		"project",
		"model",
		"product",
		"workflowGroup",
		"subject",
	]) {
		await tx[model].deleteMany({});
	}
}

async function seedProfile(tx) {
	const passwordHash = await argon2.hash(password);

	if (freshReset) {
		await wipeSeededTables(tx);
	}

	// ── RBAC fixture subjects (Playwright ABAC/RBAC ground) ────────────────
	// Every subject is a deliberate capability-matrix row. All share the single
	// PATS_SEED_PASSWORD. stableId(key) entries keep re-seeds idempotent.
	//   positive  liza.delacruz  — admin bundle; every capability true.
	//   positive  marco.villanueva — pure planner (planning + read-only
	//                                monitoring + catalog read). No QC,
	//                                no floor ops, no day-sheet encode.
	//   positive  joshua.reyes     — floor execution + inventory.issue +
	//                                station encode. DENIED: daily-sheet
	//                                encode, QC, ops-admin, catalog-manage.
	//   positive  aila.torres      — operator + CAPABILITY daily-metrics.encode
	//                                (Journey B / day-sheet grant path) +
	//                                CAPABILITY quality.read (Reports QC reads
	//                                without a Quality stage scope; scope-less
	//                                LL cannot resolve, only read).
	//   positive  karen.limjoco    — qi bundle + quality-stage scope
	//                                Decoration + Injection (QC-primary).
	//   negative  paolo.garcia     — qi bundle with NO quality-stage rows:
	//                                Journey D must FAIL CLOSED (scope-
	//                                dependent deny fixture).
	// The operator-only deny path needs no separate user — joshua.reyes already
	// is the operator without daily-metrics.encode. Extra guest accounts were
	// considered and dropped: they add no distinct capability assertion.
	//
	// Display names and email snapshots are NARRATIVE ONLY (realistic employee
	// names so surfaces read like a live factory). The proper-name usernames are the
	// RBAC fixture contract — e2e/RBAC tests log in with them and must never be
	// renamed. Re-seeding updates the display/email snapshots idempotently.

	const planner = await upsertSubject(
		tx,
		"subject-planner",
		"marco.villanueva",
		"Marco Villanueva",
		// Pure planner: planning + read-only monitoring + catalog read. Not a QC account.
		["planner"],
		passwordHash,
	);
	const operator = await upsertSubject(
		tx,
		"subject-operator",
		"joshua.reyes",
		"Joshua Reyes",
		["operator"],
		passwordHash,
	);
	// Line Leader = operator + daily-metrics.encode assignment (not a fourth business role).
	const lineLeader = await upsertSubject(
		tx,
		"subject-lineleader",
		"aila.torres",
		"Aila Torres",
		["operator"],
		passwordHash,
		[
			{ kind: "CAPABILITY", key: "daily-metrics.encode" },
			{ kind: "CAPABILITY", key: "quality.read" },
		],
	);
	const quality = await upsertSubject(
		tx,
		"subject-quality",
		"karen.limjoco",
		"Karen Limjoco",
		["qi"],
		passwordHash,
	);
	// Negative-path QC fixture: qi bundle but intentionally NO qualityStage rows.
	// Seeded later in this profile the same way, but never added to
	// qualityScopeBySubject — Journey D scope lookups for this subject must
	// resolve to an empty set and fail closed.
	const qualityNoScope = await upsertSubject(
		tx,
		"subject-quality-noscope",
		"paolo.garcia",
		"Paolo Garcia",
		["qi"],
		passwordHash,
	);
	const admin = await upsertSubject(
		tx,
		"subject-admin",
		"liza.delacruz",
		"Liza Dela Cruz",
		["admin"],
		passwordHash,
	);

	// ── Client-evidence catalog: B251 ────────────────────────────────────────
	const productB251Id = stableId("product-b251");
	const modelIds = {};
	const partIds = {};

	await tx.product.upsert({
		where: { id: productB251Id },
		update: {
			productName: CLIENT_B251.productName,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
			rowVersion: 1,
		},
		create: {
			id: productB251Id,
			productCode: code(CLIENT_B251.productCode),
			productName: CLIENT_B251.productName,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
	});

	for (const model of CLIENT_B251.models) {
		const modelId = stableId(`model-b251-${model.modelNumber}`);
		modelIds[model.modelNumber] = modelId;
		await tx.model.upsert({
			where: { id: modelId },
			update: {
				productId: productB251Id,
				modelNumber: model.modelNumber,
				modelName: model.modelName,
				sourceStatus: model.sourceStatus,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: model.evidenceStatus,
				sourceReference: {
					seedProfile: profile,
					origin: "client-parts-list",
					productCode: CLIENT_B251.productCode,
					modelNumber: model.modelNumber,
					...(model.nameConflict ? { nameConflict: model.nameConflict } : {}),
				},
			},
			create: {
				id: modelId,
				productId: productB251Id,
				modelNumber: model.modelNumber,
				modelName: model.modelName,
				sourceStatus: model.sourceStatus,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: model.evidenceStatus,
				sourceReference: {
					seedProfile: profile,
					origin: "client-parts-list",
					productCode: CLIENT_B251.productCode,
					modelNumber: model.modelNumber,
					...(model.nameConflict ? { nameConflict: model.nameConflict } : {}),
				},
			},
		});

		for (const [partCode, partName] of model.parts) {
			const partId = stableId(`model-part-${partCode}`);
			partIds[partCode] = partId;
		await tx.modelPart.upsert({
			where: { modelId_partCode: { modelId, partCode } },
			update: {
				partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
				plannedCycleTimes: null,
			},
			create: {
				id: partId,
				modelId,
				partCode,
				partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
				plannedCycleTimes: null,
			},
		});
		// Resolve actual id when an older row already owned the unique key.
		const resolved = await tx.modelPart.findUnique({
			where: { modelId_partCode: { modelId, partCode } },
			select: { id: true },
		});
		if (resolved) partIds[partCode] = resolved.id;
	}
}

	const injPartCount = Object.keys(partIds).length;
	/** @type {Record<string, string>} modelNumber -> capsule ModelPart id */
	const capsulePartIds = {};
	/** @type {Record<string, string>} deco partCode -> ModelPart id */
	const decoPartIds = {};
	/** @type {Record<string, string>} `${modelNumber}:${paintCode}` -> ModelPart id */
	const paintPartIds = {};
	let decoPartCount = 0;
	let paintPartCount = 0;
	let capsuleAttachmentCount = 0;

	async function upsertModelPartRow(txClient, { modelNumber, partCode, partName, seedKey }) {
		const modelId = modelIds[modelNumber];
		const partId = stableId(seedKey);
		await txClient.modelPart.upsert({
			where: { modelId_partCode: { modelId, partCode } },
			update: {
				partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
				plannedCycleTimes: null,
			},
			create: {
				id: partId,
				modelId,
				partCode,
				partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
				plannedCycleTimes: null,
			},
		});
		const resolved = await txClient.modelPart.findUnique({
			where: { modelId_partCode: { modelId, partCode } },
			select: { id: true },
		});
		return resolved?.id ?? partId;
	}

	// Shared capsule on every model (ALL MODELS packaging)
	for (const model of CLIENT_B251.models) {
		const partCode = CLIENT_B251.sharedCapsule.partCode;
		const id = await upsertModelPartRow(tx, {
			modelNumber: model.modelNumber,
			partCode,
			partName: CLIENT_B251.sharedCapsule.partName,
			seedKey: `model-part-capsule-${model.modelNumber}`,
		});
		capsulePartIds[model.modelNumber] = id;
		capsuleAttachmentCount += 1;
	}

	// Deco part nos — skip when code already exists as inj part on the same model
	for (const [modelNumber, decoList] of Object.entries(CLIENT_B251.decoPartsByModel)) {
		const injCodes = new Set(
			(CLIENT_B251.models.find((m) => m.modelNumber === modelNumber)?.parts ?? []).map(([c]) => c),
		);
		for (const deco of decoList) {
			if (injCodes.has(deco.partCode)) {
				// Drink rows reuse bare inj codes as deco part nos — do not duplicate ModelPart.
				continue;
			}
			const id = await upsertModelPartRow(tx, {
				modelNumber,
				partCode: deco.partCode,
				partName: decoPartDisplayName(deco),
				seedKey: `model-part-deco-${deco.partCode}`,
			});
			decoPartIds[deco.partCode] = id;
			decoPartCount += 1;
		}
	}

	// Paint nos — attach per model membership (same PN may appear on multiple models)
	for (const paint of CLIENT_B251.paintNumbers) {
		const displayName = paintPartDisplayName(paint);
		for (const modelNumber of paint.modelNumbers) {
			const id = await upsertModelPartRow(tx, {
				modelNumber,
				partCode: paint.partCode,
				partName: displayName,
				seedKey: `model-part-paint-${modelNumber}-${paint.partCode}`,
			});
			paintPartIds[`${modelNumber}:${paint.partCode}`] = id;
			paintPartCount += 1;
		}
	}

	// BOM + process route for model 01 (Avocado Burger) as representative published revision
	const avocadoModelId = modelIds["01"];
	const bomId = stableId("bom-b251-m01-r1");
	await tx.bomDefinition.upsert({
		where: { modelId_revision: { modelId: avocadoModelId, revision: 1 } },
		update: {
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
		create: {
			id: bomId,
			modelId: avocadoModelId,
			revision: 1,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
	});
	const bomResolved = await tx.bomDefinition.findUnique({
		where: { modelId_revision: { modelId: avocadoModelId, revision: 1 } },
		select: { id: true },
	});
	const bomDefinitionId = bomResolved?.id ?? bomId;
	let lineNo = 1;
	for (const [partCode] of CLIENT_B251.models[0].parts) {
		const lineId = stableId(`bom-line-${partCode}`);
		await tx.bomLine.upsert({
			where: { id: lineId },
			update: {
				bomDefinitionId,
				modelPartId: partIds[partCode],
				lineNumber: lineNo,
				relationshipKind: "COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "1 per product",
				sourceRepresentation: partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id: lineId,
				bomDefinitionId,
				modelPartId: partIds[partCode],
				lineNumber: lineNo,
				relationshipKind: "COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "1 per product",
				sourceRepresentation: partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
		lineNo += 1;
	}

	// Capsule packaging line on m01 BOM
	{
		const partCode = CLIENT_B251.sharedCapsule.partCode;
		const lineId = stableId(`bom-line-pack-${partCode}`);
		await tx.bomLine.upsert({
			where: { id: lineId },
			update: {
				bomDefinitionId,
				modelPartId: capsulePartIds["01"],
				lineNumber: lineNo,
				relationshipKind: "PACKAGING_COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "shared capsule ALL MODELS (PROVISIONAL)",
				sourceRepresentation: partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id: lineId,
				bomDefinitionId,
				modelPartId: capsulePartIds["01"],
				lineNumber: lineNo,
				relationshipKind: "PACKAGING_COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "shared capsule ALL MODELS (PROVISIONAL)",
				sourceRepresentation: partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
		lineNo += 1;
	}

	// Deco part nos for m01 as DECORATION_INPUT
	for (const deco of CLIENT_B251.decoPartsByModel["01"] ?? []) {
		if (!decoPartIds[deco.partCode]) continue;
		const lineId = stableId(`bom-line-deco-${deco.partCode}`);
		await tx.bomLine.upsert({
			where: { id: lineId },
			update: {
				bomDefinitionId,
				modelPartId: decoPartIds[deco.partCode],
				lineNumber: lineNo,
				relationshipKind: "DECORATION_INPUT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "deco part no (PROVISIONAL)",
				sourceRepresentation: deco.partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id: lineId,
				bomDefinitionId,
				modelPartId: decoPartIds[deco.partCode],
				lineNumber: lineNo,
				relationshipKind: "DECORATION_INPUT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "deco part no (PROVISIONAL)",
				sourceRepresentation: deco.partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
		lineNo += 1;
	}

	// Paint nos used on m01 as DECORATION_INPUT (paint material identity)
	for (const paint of CLIENT_B251.paintNumbers.filter((p) => p.modelNumbers.includes("01"))) {
		const modelPartId = paintPartIds[`01:${paint.partCode}`];
		if (!modelPartId) continue;
		const lineId = stableId(`bom-line-paint-${paint.partCode}`);
		await tx.bomLine.upsert({
			where: { id: lineId },
			update: {
				bomDefinitionId,
				modelPartId,
				lineNumber: lineNo,
				relationshipKind: "DECORATION_INPUT",
				quantityMagnitude: null,
				quantityUom: null,
				usageBasis: "paint no (PROVISIONAL; process not modeled)",
				sourceRepresentation: paint.partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id: lineId,
				bomDefinitionId,
				modelPartId,
				lineNumber: lineNo,
				relationshipKind: "DECORATION_INPUT",
				quantityMagnitude: null,
				quantityUom: null,
				usageBasis: "paint no (PROVISIONAL; process not modeled)",
				sourceRepresentation: paint.partCode,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
		lineNo += 1;
	}

	const routeId = stableId("process-route-b251-m01-r1");
	await tx.processRoute.upsert({
		where: { modelId_revision: { modelId: avocadoModelId, revision: 1 } },
		update: {
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
		create: {
			id: routeId,
			modelId: avocadoModelId,
			revision: 1,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
	});
	const routeResolved = await tx.processRoute.findUnique({
		where: { modelId_revision: { modelId: avocadoModelId, revision: 1 } },
		select: { id: true },
	});
	const processRouteId = routeResolved?.id ?? routeId;

	// ── Line configuration (factory stage vocabulary) ────────────────────────
	const workflowId = stableId("workflow-main-production");
	const injectionStageId = stableId("stage-injection");
	const decorationStageId = stableId("stage-decoration");
	const assemblyStageId = stableId("stage-assembly");
	const warehouseStageId = stableId("stage-warehouse");
	const subFullSprayId = stableId("substage-full-spray");
	const subLineSprayId = stableId("substage-line-spray");
	const subTampoId = stableId("substage-tampo");
	const subMimakiId = stableId("substage-mimaki");
	// Retired: Quality is Journey D, not a SubStage / Station / Process.
	const retiredQualityCheckSubId = stableId("substage-quality-check");
	const retiredQualityCheckSectionId = stableId("station-assembly-quality-check");
	const retiredQualityCheckProcessId = stableId("work-process-quality-check");
	const subAssemblyStagingId = stableId("substage-assembly-staging");
	const subSubAssemblyId = stableId("substage-sub-assembly");
	const subMainAssemblyId = stableId("substage-main-assembly");
	const subCapsulationId = stableId("substage-capsulation");
	const subAssortmentId = stableId("substage-assortment");
	const subMainPackingId = stableId("substage-main-packing");
	// Injection Molding: the Injection desk bridge sub-stage (Option A reshape).
	// Leaf under the Injection stage so the monitoring desk resolves a non-null
	// subStageId work-process and its daily sheet stops failing closed.
	const subInjectionMoldingId = stableId("substage-injection-molding");
	// Line-setup tree reshape (2026-09-19): one Section per Stage — the board's
	// Section → Process → Sub-process parents. The per-SubStage desk rows are
	// retired (see retiredDeskSectionIds below); four stable keys are reused
	// as the parents so every existing section reference keeps resolving.
	const injectionSectionId = stableId("station-injection-01");
	const decorationSectionId = stableId("station-decoration-full-spray"); // now the Decoration parent
	const assemblySubAssemblySectionId = stableId("station-assembly-sub-assembly"); // now the Assembly parent
	const warehouseSectionId = stableId("station-warehouse-main-packing"); // now the Warehouse parent
	// Retired per-SubStage desk keys: rows are disabled on reseed (additive
	// hardening) and wiped on fresh reseed. Kept as constants so the
	// disable-list stays explicit.
	const decorationLineSectionId = stableId("station-decoration-line-spray");
	const decorationTampoSectionId = stableId("station-decoration-tampo");
	const decorationMimakiSectionId = stableId("station-decoration-mimaki");
	const assemblyStagingSectionId = stableId("station-assembly-staging");
	const assemblyMainAssemblySectionId = stableId("station-assembly-main-assembly");
	const assemblyCapsulationSectionId = stableId("station-assembly-capsulation");
	const assemblyAssortmentSectionId = stableId("station-assembly-assortment");
	const retiredDeskSectionIds = [
		decorationLineSectionId,
		decorationTampoSectionId,
		decorationMimakiSectionId,
		assemblyStagingSectionId,
		assemblyMainAssemblySectionId,
		assemblyCapsulationSectionId,
		assemblyAssortmentSectionId,
	];

	await tx.workflowGroup.upsert({
		where: { id: workflowId },
		update: {
			name: "Main Production",
			linkageMode: "LINKED",
			displayOrder: 1,
			lifecycleStatus: "PUBLISHED",
			isSystemSeed: true,
		},
		create: {
			id: workflowId,
			projectId: null,
			name: "Main Production",
			linkageMode: "LINKED",
			displayOrder: 1,
			lifecycleStatus: "PUBLISHED",
			isSystemSeed: true,
		},
	});

	for (const [id, name, displayOrder] of [
		[injectionStageId, "Injection", 1],
		[decorationStageId, "Decoration", 2],
		[assemblyStageId, "Assembly", 3],
		[warehouseStageId, "Warehouse", 4],
	]) {
		await tx.stage.upsert({
			where: { id },
			update: { workflowGroupId: workflowId, name, displayOrder, isSystemSeed: true },
			create: { id, workflowGroupId: workflowId, name, displayOrder, isSystemSeed: true },
		});
	}

	// Journey D allowedStages (v1 stage grain). Fail closed without these rows.
	// karen.limjoco = Decoration + Injection (QC-primary QI). liza.delacruz = all catalog stages
	// so admin quality caps are not fail-closed on empty scope.
	// marco.villanueva is a pure planner — no QC capabilities and no stage rows.
	// paolo.garcia is the negative fixture — qi bundle but NO scope rows
	// here on purpose; any leaked rows from an earlier seed get revoked below.
	const qualityWorkspaceId = process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS";
	const allCatalogStageIds = [injectionStageId, decorationStageId, assemblyStageId, warehouseStageId];
	const qualityScopeBySubject = [
		[quality.id, [decorationStageId, injectionStageId]],
		[admin.id, allCatalogStageIds],
	];
	for (const [subjectId, stageIds] of qualityScopeBySubject) {
		for (const stageId of stageIds) {
			await tx.qualityStageAssignment.upsert({
				where: {
					subjectId_workspaceId_stageId: {
						subjectId,
						workspaceId: qualityWorkspaceId,
						stageId,
					},
				},
				update: { status: "ACTIVE" },
				create: {
					id: stableId(`qsa-${subjectId}-${stageId}`),
					subjectId,
					workspaceId: qualityWorkspaceId,
					stageId,
					status: "ACTIVE",
				},
			});
		}
	}
	// Re-seed must slim leftover fat scope (additive-mode hardening):
	// marco.villanueva never holds QC scope, and paolo.garcia must never
	// gain scope, so any stalker rows are revoked to preserve the deny fixture.
	const leftoverNoScopeSubjects = [planner.id, qualityNoScope.id];
	for (const subjectId of leftoverNoScopeSubjects) {
		const leftoverScope = await tx.qualityStageAssignment.findMany({
			where: { subjectId, workspaceId: qualityWorkspaceId, status: "ACTIVE" },
		});
		for (const row of leftoverScope) {
			await tx.qualityStageAssignment.update({
				where: { id: row.id },
				data: { status: "REVOKED" },
			});
		}
	}

	for (const [id, name, displayOrder, flags] of [
		[subInjectionMoldingId, "Molding", 1, { isConfigurable: true }],
		[subFullSprayId, "Full Spray", 1, { isConfigurable: true }],
		[subLineSprayId, "Line Spray (Mask)", 2, { isConfigurable: true }],
		[subTampoId, "Tampo", 3, { isConfigurable: true }],
		[subMimakiId, "Mimaki", 4, { isConfigurable: true }],
		[subAssemblyStagingId, "Assembly Staging", 1, { isConfigurable: true }],
		[subSubAssemblyId, "Sub Assembly", 2, { isConfigurable: true }],
		[subMainAssemblyId, "Main Assembly", 3, { isConfigurable: true }],
		[subCapsulationId, "Capsulation", 4, { isConfigurable: true }],
		[subAssortmentId, "Assortment", 5, { isConfigurable: true }],
		[subMainPackingId, "Main Packing", 1, { isConfigurable: true }],
	]) {
		await tx.subStage.upsert({
			where: { id },
			update: {
				name,
				displayOrder,
				isSystemSeed: true,
				hasQualityCheckpoint: Boolean(flags.hasQualityCheckpoint),
				isMandatoryCheckpoint: Boolean(flags.isMandatoryCheckpoint),
				isConfigurable: flags.isConfigurable !== false,
			},
			create: {
				id,
				name,
				displayOrder,
				isSystemSeed: true,
				hasQualityCheckpoint: Boolean(flags.hasQualityCheckpoint),
				isMandatoryCheckpoint: Boolean(flags.isMandatoryCheckpoint),
				isConfigurable: flags.isConfigurable !== false,
			},
		});
	}

	for (const [stageId, subStageId] of [
		[injectionStageId, subInjectionMoldingId],
		[decorationStageId, subFullSprayId],
		[decorationStageId, subLineSprayId],
		[decorationStageId, subTampoId],
		[decorationStageId, subMimakiId],
		[assemblyStageId, subAssemblyStagingId],
		[assemblyStageId, subSubAssemblyId],
		[assemblyStageId, subMainAssemblyId],
		[assemblyStageId, subCapsulationId],
		[assemblyStageId, subAssortmentId],
		[warehouseStageId, subMainPackingId],
	]) {
		await tx.subStageEligibility.upsert({
			where: { stageId_subStageId: { stageId, subStageId } },
			update: {},
			create: { stageId, subStageId },
		});
	}

	for (const [id, stageId, subStageId, sequence, name] of [
		[stableId("route-stage-inj"), injectionStageId, null, 1, "Injection"],
		[stableId("route-stage-deco"), decorationStageId, subFullSprayId, 2, "Decoration / Full Spray"],
		[stableId("route-stage-assy"), assemblyStageId, subSubAssemblyId, 3, "Assembly / Sub-Assembly"],
		[stableId("route-stage-wh"), warehouseStageId, subMainPackingId, 4, "Warehouse / Main Packing"],
	]) {
		await tx.processRouteStage.upsert({
			where: { id },
			update: {
				processRouteId,
				stageId,
				subStageId,
				sequence,
				stageKey: name.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-"),
				stageName: name,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id,
				processRouteId,
				stageId,
				subStageId,
				sequence,
				stageKey: name.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-"),
				stageName: name,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
	}

	for (const [id, name, sectionCode, stageId, displayOrder] of [
		[injectionSectionId, "Injection", "SEC-INJ", injectionStageId, 1],
		[decorationSectionId, "Decoration", "SEC-DEC", decorationStageId, 2],
		[assemblySubAssemblySectionId, "Assembly", "SEC-ASM", assemblyStageId, 3],
		[warehouseSectionId, "Warehouse", "SEC-WH", warehouseStageId, 4],
	]) {
		await tx.section.upsert({
			where: { id },
			update: {
				workspaceId: "PATS",
				name,
				sectionCode: code(sectionCode),
				operationalContextKey: "PATS",
				stageId,
				displayOrder,
				isEnabled: true,
			},
			create: {
				id,
				workspaceId: "PATS",
				name,
				sectionCode: code(sectionCode),
				operationalContextKey: "PATS",
				stageId,
				displayOrder,
				isEnabled: true,
			},
		});
	}

	for (const [id, sectionId, stageId, subStageId] of [
		// Injection keeps the stage-wide bound step (station history filters match
		// null-rotor events) and gains a sub-stage-bound step so the Monitoring
		// desk bridge can resolve its work-process against a non-null subStageId.
		[stableId("station-step-inj"), injectionSectionId, injectionStageId, null],
		[stableId("station-step-inj-mold"), injectionSectionId, injectionStageId, subInjectionMoldingId],
		[stableId("station-step-dec-fs"), decorationSectionId, decorationStageId, subFullSprayId],
		[stableId("station-step-dec-ls"), decorationSectionId, decorationStageId, subLineSprayId],
		[stableId("station-step-dec-tp"), decorationSectionId, decorationStageId, subTampoId],
		[stableId("station-step-dec-mk"), decorationSectionId, decorationStageId, subMimakiId],
		[stableId("station-step-asm-stg"), assemblySubAssemblySectionId, assemblyStageId, subAssemblyStagingId],
		[stableId("station-step-subassy"), assemblySubAssemblySectionId, assemblyStageId, subSubAssemblyId],
		[stableId("station-step-asm-main"), assemblySubAssemblySectionId, assemblyStageId, subMainAssemblyId],
		[stableId("station-step-asm-cap"), assemblySubAssemblySectionId, assemblyStageId, subCapsulationId],
		[stableId("station-step-assort"), assemblySubAssemblySectionId, assemblyStageId, subAssortmentId],
		[stableId("station-step-wh"), warehouseSectionId, warehouseStageId, subMainPackingId],
	]) {
		await tx.stationStep.upsert({
			where: { id },
			update: { sectionId, stageId, subStageId },
			create: { id, sectionId, stageId, subStageId },
		});
	}

	// Planned cycle-time master pass (REQ-CT-1 S1): per-step maps on catalog
	// ModelParts, now that stage ids have resolved. Paints stay null.
	// ctStepIds stays in scope: run-part snapshots below reuse it.
	const ctStepIds = {
		injection: injectionStageId,
		decoration: decorationStageId,
		tampo: subTampoId,
		fullSpray: subFullSprayId,
		lineSpray: subLineSprayId,
		warehouse: warehouseStageId,
		packing: subMainPackingId,
	};
	{
		const capsuleCode = CLIENT_B251.sharedCapsule.partCode;
		for (const [partCode, modelPartId] of [
			...Object.entries(partIds),
			...Object.entries(decoPartIds),
			...Object.values(capsulePartIds).map((id) => [capsuleCode, id]),
		]) {
			const map = plannedCtMapForPartCode(partCode, ctStepIds);
			if (!map) continue;
			await tx.modelPart.update({
				where: { id: modelPartId },
				data: { plannedCycleTimes: map },
			});
		}
	}

	// Work processes under sub-stages (catalog leaf; not stations). Bridge names match current SubStages.
	const processInjMachineOpId = stableId("work-process-inj-machine-op");
	const processInjGateCutId = stableId("work-process-inj-gate-cut");
	const processInjOfflineOpId = stableId("work-process-inj-offline-op");
	const processInjIQCId = stableId("work-process-inj-iqc");
	const processInjMHId = stableId("work-process-inj-mh");
	const processFsManualId = stableId("work-process-fs-manual");
	const processFsDrumId = stableId("work-process-fs-drum");
	const processLsMaskId = stableId("work-process-ls-mask");
	const processTampoId = stableId("work-process-tampo");
	const processMimakiId = stableId("work-process-mimaki");
	const processAsmStagingId = stableId("work-process-asm-staging");
	const processAsmSubId = stableId("work-process-asm-sub");
	const processAsmMainId = stableId("work-process-asm-main");
	const processAsmCapId = stableId("work-process-asm-cap");
	const processAsmAstId = stableId("work-process-asm-ast");
	const processMainPackingId = stableId("work-process-main-packing");

	// Board tree links: each process belongs to its stage's parent section.
	const processSectionBySubStage = {
		[subInjectionMoldingId]: injectionSectionId,
		[subFullSprayId]: decorationSectionId,
		[subLineSprayId]: decorationSectionId,
		[subTampoId]: decorationSectionId,
		[subMimakiId]: decorationSectionId,
		[subAssemblyStagingId]: assemblySubAssemblySectionId,
		[subSubAssemblyId]: assemblySubAssemblySectionId,
		[subMainAssemblyId]: assemblySubAssemblySectionId,
		[subCapsulationId]: assemblySubAssemblySectionId,
		[subAssortmentId]: assemblySubAssemblySectionId,
		[subMainPackingId]: warehouseSectionId,
	};
	for (const [id, subStageId, name, displayOrder] of [
		[processInjMachineOpId, subInjectionMoldingId, "Machine Operator", 1, 14],
		[processInjGateCutId, subInjectionMoldingId, "Gate Cutting", 2, null],
		[processInjOfflineOpId, subInjectionMoldingId, "Offline Operator", 3, null],
		[processInjIQCId, subInjectionMoldingId, "IQC", 4, null],
		[processInjMHId, subInjectionMoldingId, "MH", 5, null],
		[processFsManualId, subFullSprayId, "Manual Spray", 1, 12],
		[processFsDrumId, subFullSprayId, "Drum Spray", 2, null],
		[processLsMaskId, subLineSprayId, "Line Spray (Mask)", 1, 10],
		[processTampoId, subTampoId, "Tampo Printing", 1, 6],
		[processMimakiId, subMimakiId, "Machine Printing", 1, null],
		[processAsmStagingId, subAssemblyStagingId, "Staging", 1, null],
		[processAsmSubId, subSubAssemblyId, "Assembly Task", 1, null],
		[processAsmMainId, subMainAssemblyId, "Assembly Task", 1, null],
		[processAsmCapId, subCapsulationId, "Capsulation Task", 1, null],
		[processAsmAstId, subAssortmentId, "Assortment Task", 1, null],
		[processMainPackingId, subMainPackingId, "Main Packing", 1, null],
	]) {
		const sectionId = processSectionBySubStage[subStageId] ?? null;
		await tx.workProcess.upsert({
			where: { id },
			update: {
				subStageId,
				name,
				displayOrder,
				sectionId,
				isEnabled: true,
				isSystemSeed: true,
			},
			create: {
				id,
				subStageId,
				name,
				displayOrder,
				sectionId,
				isEnabled: true,
				isSystemSeed: true,
			},
		});
	}

	// Station-screen lines (1 line = 1 screen): one default line per seeded
	// leaf WorkProcess (L-3 default). Leaders: line-leader subject assigned and
	// active on every seeded line; admin flips active for cover at runtime.
	const lineCodeByProcessId = {
		[processInjMachineOpId]: "INJ-MO-01",
		[processInjGateCutId]: "INJ-GC-01",
		[processInjOfflineOpId]: "INJ-OO-01",
		[processInjIQCId]: "INJ-IQC-01",
		[processInjMHId]: "INJ-MH-01",
		[processFsManualId]: "DEC-FS-MS-01",
		[processFsDrumId]: "DEC-FS-DS-01",
		[processLsMaskId]: "DEC-LS-01",
		[processTampoId]: "DEC-TP-01",
		[processMimakiId]: "DEC-MK-01",
		[processAsmStagingId]: "ASM-STG-01",
		[processAsmSubId]: "ASM-SA-01",
		[processAsmMainId]: "ASM-MA-01",
		[processAsmCapId]: "ASM-CAP-01",
		[processAsmAstId]: "ASM-AST-01",
		[processMainPackingId]: "WH-MP-01",
	};
	const seededLines = await tx.workProcess.findMany({ where: { isEnabled: true } });
	for (const [index, process] of seededLines.sort((a, b) => a.displayOrder - b.displayOrder).entries()) {
		const lineCode = lineCodeByProcessId[process.id] ?? (() => { throw new Error(`No line code mapping for process "${process.name}" (id=${process.id})`); })();
		await tx.line.upsert({
			where: { lineCode },
			update: {
				sectionId: process.sectionId ?? injectionSectionId,
				processId: process.id,
				assignedLeaderId: lineLeader.id,
				activeLeaderId: lineLeader.id,
				displayOrder: index,
				isEnabled: true,
			},
			create: {
				id: stableId(`line-${lineCode}`),
				sectionId: process.sectionId ?? injectionSectionId,
				processId: process.id,
				lineCode,
				label: `${process.name} #${process.displayOrder}`,
				assignedLeaderId: lineLeader.id,
				activeLeaderId: lineLeader.id,
				displayOrder: index,
				isEnabled: true,
			},
		});
	}

	// Operator-on-line fixture: joshua.reyes runs the Manual Spray line (ACTIVE).
	const manualSprayLineId = stableId("line-DEC-FS-MS-01");
	await tx.lineOperatorAssignment.upsert({
		where: { id: stableId("line-op-joshua-dec-fs-ms-01") },
		update: { status: "ACTIVE", endedAt: null },
		create: {
			id: stableId("line-op-joshua-dec-fs-ms-01"),
			lineId: manualSprayLineId,
			subjectId: operator.id,
			status: "ACTIVE",
			actorSubjectId: lineLeader.id,
		},
	});

	// Quality Inspection is Journey D. Remount leftover Quality Check hops (additive — no deletes).
	await tx.qualityInspection.updateMany({
		where: { OR: [{ subStageId: retiredQualityCheckSubId }, { sectionId: retiredQualityCheckSectionId }] },
		data: { subStageId: subSubAssemblyId, sectionId: assemblySubAssemblySectionId },
	});
	await tx.batch.updateMany({
		where: { currentSubStageId: retiredQualityCheckSubId },
		data: { currentSubStageId: subSubAssemblyId },
	});
	await tx.batchPositionProjection.updateMany({
		where: { subStageId: retiredQualityCheckSubId },
		data: { subStageId: subSubAssemblyId },
	});
	await tx.stageEvent.updateMany({
		where: { subStageId: retiredQualityCheckSubId },
		data: { subStageId: subSubAssemblyId },
	});
	await tx.routingStep.updateMany({
		where: { subStageId: retiredQualityCheckSubId },
		data: { subStageId: subSubAssemblyId },
	});
	await tx.processRouteStage.updateMany({
		where: { subStageId: retiredQualityCheckSubId },
		data: { subStageId: subSubAssemblyId },
	});
	await tx.workInstruction.updateMany({
		where: { subStageId: retiredQualityCheckSubId },
		data: { subStageId: subSubAssemblyId },
	});
	await tx.workProcess.updateMany({
		where: { id: retiredQualityCheckProcessId },
		data: { isEnabled: false },
	});
	await tx.booth.updateMany({
		where: { OR: [{ sectionId: retiredQualityCheckSectionId }, { subStageId: retiredQualityCheckSubId }] },
		data: { sectionId: assemblySubAssemblySectionId, subStageId: subSubAssemblyId },
	});
	await tx.section.updateMany({
		where: { id: retiredQualityCheckSectionId },
		data: { isEnabled: false },
	});
	// Tree reshape: the retired per-SubStage desks stay queryable by id for
	// audit history but leave the board (fresh reseed wipes them outright).
	await tx.section.updateMany({
		where: { id: { in: retiredDeskSectionIds } },
		data: { isEnabled: false },
	});

	// Physical booths under decoration Full Spray station (1 station : N booths)
	for (const [id, boothCode, label, displayOrder] of [
		[stableId("booth-01"), "01", "Booth 01", 1],
		[stableId("booth-02"), "02", "Booth 02", 2],
	]) {
		await tx.booth.upsert({
			where: { id },
			update: {
				workspaceId: "PATS",
				boothCode: code(boothCode),
				label,
				sectionId: decorationSectionId,
				stageId: decorationStageId,
				subStageId: subFullSprayId,
				workProcessId: processFsManualId,
				displayOrder,
				isEnabled: true,
			},
			create: {
				id,
				workspaceId: "PATS",
				boothCode: code(boothCode),
				label,
				sectionId: decorationSectionId,
				stageId: decorationStageId,
				subStageId: subFullSprayId,
				workProcessId: processFsManualId,
				displayOrder,
				isEnabled: true,
			},
		});
	}

	for (const [stageId, title, subStageId] of [
		[injectionStageId, "Injection — verify mold cavity and shot count", null],
		[decorationStageId, "Decoration — paint process and drying check", subFullSprayId],
		[assemblyStageId, "Assembly — scan and confirm the Sub-Assembly hop", subSubAssemblyId],
		[warehouseStageId, "Warehouse — capsule pack and palletize", subMainPackingId],
	]) {
		const instructionId = stableId(`work-instruction-${stageId}`);
		await tx.workInstruction.upsert({
			where: { id: instructionId },
			update: {
				steps: [{ en: title }, { en: "Scan batch barcode and confirm route step" }],
				status: "PUBLISHED",
				sourceRevisionRef: `${CLIENT_B251.formCode}`,
			},
			create: {
				id: instructionId,
				stageId,
				subStageId,
				steps: [{ en: title }, { en: "Scan batch barcode and confirm route step" }],
				status: "PUBLISHED",
				sourceRevisionRef: `${CLIENT_B251.formCode}`,
				version: 1,
			},
		});
	}

	// ── Production plan for B251 (client product) ────────────────────────────
	const projectId = stableId("production-plan-b251-primary");
	const partsListId = stableId("parts-list-b251-v1");
	const planPartIds = {};

	// Plan demand: 18 trays × 240 = 4320 (client tray standard)
	const tray = CLIENT_B251.trayQuantityStandard;
	const planQty = 18 * tray;

	await tx.project.upsert({
		where: { id: projectId },
		update: {
			workspaceId: "PATS",
			projectCode: code("PRJ-B251-JUL"),
			name: `${CLIENT_B251.productName} — July production`,
			requiredProductionQuantity: planQty,
			status: "RELEASED",
			releasedAt: seedClock,
			releasedBySubjectId: planner.id,
			productId: productB251Id,
		},
		create: {
			id: projectId,
			workspaceId: "PATS",
			projectCode: code("PRJ-B251-JUL"),
			name: `${CLIENT_B251.productName} — July production`,
			requiredProductionQuantity: planQty,
			productId: productB251Id,
			status: "RELEASED",
			releasedAt: seedClock,
			releasedBySubjectId: planner.id,
			createdAt: seedClock,
		},
	});

	await tx.productSpecification.upsert({
		where: { projectId },
		update: {
			skuCode: code("B251-SKU"),
			productName: CLIENT_B251.productName,
			trayQuantityStandard: CLIENT_B251.trayQuantityStandard,
			sourceRevisionRef: CLIENT_B251.revision,
		},
		create: {
			id: stableId("product-spec-b251"),
			projectId,
			skuCode: code("B251-SKU"),
			productName: CLIENT_B251.productName,
			trayQuantityStandard: CLIENT_B251.trayQuantityStandard,
			sourceRevisionRef: CLIENT_B251.revision,
			createdAt: seedClock,
		},
	});

	// Model allocations for models 01–04 (confirmed); 05 deferred in name only still allocated
	const modelPlanQtys = {
		"01": 4 * tray,
		"02": 3 * tray,
		"03": 2 * tray,
		"04": 2 * tray,
		"05": 2 * tray,
		"06": 2 * tray,
	};
	for (const [modelNumber, qty] of Object.entries(modelPlanQtys)) {
		await tx.projectModelAllocation.upsert({
			where: {
				projectId_modelId: { projectId, modelId: modelIds[modelNumber] },
			},
			update: {
				plannedQuantity: qty,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				lifecycleStatus: "COMMITTED",
			},
			create: {
				id: stableId(`pma-b251-${modelNumber}`),
				projectId,
				modelId: modelIds[modelNumber],
				plannedQuantity: qty,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				lifecycleStatus: "COMMITTED",
			},
		});
		await tx.planDemandAllocation.upsert({
			where: { id: stableId(`pda-b251-${modelNumber}`) },
			update: {
				projectId,
				modelId: modelIds[modelNumber],
				marketRegion: "JP",
				demandPurpose: "production",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				usageBasis: "finished product",
				sourceRevisionRef: CLIENT_B251.revision,
				lifecycleStatus: "COMMITTED",
			},
			create: {
				id: stableId(`pda-b251-${modelNumber}`),
				projectId,
				modelId: modelIds[modelNumber],
				marketRegion: "JP",
				demandPurpose: "production",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				usageBasis: "finished product",
				sourceRevisionRef: CLIENT_B251.revision,
				lifecycleStatus: "COMMITTED",
				createdAt: seedClock,
			},
		});
	}

	// Snapshot plan parts: inj + deco part nos + capsule (paints stay catalog/BOM only)
	for (const model of CLIENT_B251.models) {
		for (const [partCode, partName] of model.parts) {
			const id = stableId(`plan-part-${partCode}`);
			planPartIds[partCode] = id;
		await tx.part.upsert({
			where: { id },
			update: {
				projectId,
				partCode,
				partName,
				plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
				sourceModelId: modelIds[model.modelNumber],
				sourceModelPartId: partIds[partCode],
				lifecycleStatus: "PUBLISHED",
				variancePercentThreshold: 0.05,
			},
			create: {
				id,
				projectId,
				partCode,
				partName,
				plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
				sourceModelId: modelIds[model.modelNumber],
				sourceModelPartId: partIds[partCode],
				lifecycleStatus: "PUBLISHED",
				variancePercentThreshold: 0.05,
			},
		});
	}
	for (const deco of CLIENT_B251.decoPartsByModel[model.modelNumber] ?? []) {
		if (!decoPartIds[deco.partCode]) continue;
		const id = stableId(`plan-part-deco-${deco.partCode}`);
		planPartIds[deco.partCode] = id;
		await tx.part.upsert({
			where: { id },
			update: {
				projectId,
				partCode: deco.partCode,
				partName: decoPartDisplayName(deco),
				plannedCycleTimes: plannedCtMapForPartCode(deco.partCode, ctStepIds),
				sourceModelId: modelIds[model.modelNumber],
				sourceModelPartId: decoPartIds[deco.partCode],
				lifecycleStatus: "PUBLISHED",
				variancePercentThreshold: 0.05,
			},
			create: {
				id,
				projectId,
				partCode: deco.partCode,
				partName: decoPartDisplayName(deco),
				plannedCycleTimes: plannedCtMapForPartCode(deco.partCode, ctStepIds),
				sourceModelId: modelIds[model.modelNumber],
				sourceModelPartId: decoPartIds[deco.partCode],
				lifecycleStatus: "PUBLISHED",
				variancePercentThreshold: 0.05,
			},
		});
	}
	}
	// One plan-level capsule part (packaging), sourced from model 01 attachment
	{
		const partCode = CLIENT_B251.sharedCapsule.partCode;
		const id = stableId(`plan-part-capsule-${partCode}`);
		planPartIds[partCode] = id;
		await tx.part.upsert({
			where: { id },
			update: {
				projectId,
				partCode,
				partName: CLIENT_B251.sharedCapsule.partName,
				plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
				sourceModelId: modelIds["01"],
				sourceModelPartId: capsulePartIds["01"],
				lifecycleStatus: "PUBLISHED",
				variancePercentThreshold: 0.05,
			},
			create: {
				id,
				projectId,
				partCode,
				partName: CLIENT_B251.sharedCapsule.partName,
				plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
				sourceModelId: modelIds["01"],
				sourceModelPartId: capsulePartIds["01"],
				lifecycleStatus: "PUBLISHED",
				variancePercentThreshold: 0.05,
			},
		});
	}

	await tx.partsList.upsert({
		where: { id: partsListId },
		update: {
			projectId,
			version: 1,
			status: "PUBLISHED",
			sourceRevisionRef: CLIENT_B251.revision,
			publishedAt: seedClock,
		},
		create: {
			id: partsListId,
			projectId,
			version: 1,
			status: "PUBLISHED",
			sourceRevisionRef: CLIENT_B251.revision,
			publishedAt: seedClock,
			createdAt: seedClock,
		},
	});

	// Route steps for primary Avocado Burger parts through factory stages
	const avocadoParts = CLIENT_B251.models[0].parts.map(([c]) => c);
	let stepOrder = 1;
	for (const partCode of avocadoParts) {
		for (const [stageId, subStageId] of [
			[injectionStageId, null],
			[decorationStageId, subFullSprayId],
			[assemblyStageId, subSubAssemblyId],
			[warehouseStageId, subMainPackingId],
		]) {
			const id = stableId(`route-step-${partCode}-${stepOrder}`);
			await tx.routingStep.upsert({
				where: { id },
				update: {
					partsListId,
					partId: planPartIds[partCode],
					stageId,
					subStageId,
					stepOrder,
				},
				create: {
					id,
					partsListId,
					partId: planPartIds[partCode],
					stageId,
					subStageId,
					stepOrder,
				},
			});
			stepOrder += 1;
		}
	}

	await tx.pmrs.upsert({
		where: { projectId },
		update: {
			partsListId,
			externalControlNumber: CLIENT_B251.formCode,
			revisionLabel: CLIENT_B251.revision,
			status: "attached",
			sourceReference: {
				origin: "client-parts-list",
				workbookTitle: CLIENT_B251.workbookTitle,
				evidenceStatus: "PROVISIONAL",
			},
		},
		create: {
			id: stableId("pmrs-b251"),
			projectId,
			partsListId,
			externalControlNumber: CLIENT_B251.formCode,
			revisionLabel: CLIENT_B251.revision,
			status: "attached",
			sourceReference: {
				origin: "client-parts-list",
				workbookTitle: CLIENT_B251.workbookTitle,
				evidenceStatus: "PROVISIONAL",
			},
		},
	});

	const primaryPartCode = "B251-01-01";
	const primaryPlanPartId = planPartIds[primaryPartCode];
	await tx.materialRequirement.upsert({
		where: { id: stableId("mr-b251-upper-bun") },
		update: {
			projectId,
			partId: primaryPlanPartId,
			externalReference: `${CLIENT_B251.formCode}-L01`,
			quantityMagnitude: `${modelPlanQtys["01"]}.000000`,
			quantityUom: "piece",
			usageBasis: "1 per product",
			sourceRevisionRef: CLIENT_B251.revision,
			status: "APPROVED",
		},
		create: {
			id: stableId("mr-b251-upper-bun"),
			projectId,
			partId: primaryPlanPartId,
			externalReference: `${CLIENT_B251.formCode}-L01`,
			quantityMagnitude: `${modelPlanQtys["01"]}.000000`,
			quantityUom: "piece",
			usageBasis: "1 per product",
			sourceRevisionRef: CLIENT_B251.revision,
			status: "APPROVED",
			createdAt: seedClock,
		},
	});

	// Lots: required pcs = seeded batches for that lot × tray size (240).
	const lotDefs = [
		["lot-avocado", "LOT-B251-01", "B251 Avocado Burger — Lot 01", "01", 4 * tray],
		["lot-hotdog", "LOT-B251-02", "B251 Cheese Hotdog — Lot 01", "02", 3 * tray],
		["lot-tacos", "LOT-B251-03", "B251 Tacos — Lot 01", "03", 2 * tray],
		["lot-fries", "LOT-B251-04", "B251 Potato Wedge — Lot 01", "04", 2 * tray],
		["lot-drink", "LOT-B251-05", "B251 Cola / Ice Coffee — Lot 01", "05", 2 * tray],
		["lot-tray", "LOT-B251-06", "B251 Tray — Lot 01", "06", 2 * tray],
	];
	const lotIds = {};
	const lotAllocIds = {};
	for (const [key, lotCode, lotName, modelNumber, qty] of lotDefs) {
		const lotId = stableId(key);
		lotIds[modelNumber] = lotId;
		const firstPartCode = CLIENT_B251.models.find((m) => m.modelNumber === modelNumber).parts[0][0];
		await tx.lot.upsert({
			where: { id: lotId },
			update: {
				projectId,
				lotCode: code(lotCode),
				lotName,
				partsListId,
				partsListVersion: 1,
				partId: planPartIds[firstPartCode],
				partName: CLIENT_B251.models.find((m) => m.modelNumber === modelNumber).parts[0][1],
				requiredProductionQuantity: qty,
				status: "ACTIVE",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				labelPackSize: CLIENT_B251.trayQuantityStandard,
				createdAtStage: "Planning",
			},
			create: {
				id: lotId,
				projectId,
				lotCode: code(lotCode),
				lotName,
				partsListId,
				partsListVersion: 1,
				partId: planPartIds[firstPartCode],
				partName: CLIENT_B251.models.find((m) => m.modelNumber === modelNumber).parts[0][1],
				requiredProductionQuantity: qty,
				status: "ACTIVE",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				labelPackSize: CLIENT_B251.trayQuantityStandard,
				createdAtStage: "Planning",
				createdAt: seedClock,
			},
		});
		for (const [partCode] of CLIENT_B251.models.find((m) => m.modelNumber === modelNumber).parts) {
			const allocId = stableId(`alloc-${lotCode}-${partCode}`);
			lotAllocIds[`${modelNumber}:${partCode}`] = allocId;
			await tx.lotPartAllocation.upsert({
				where: { lotId_partId: { lotId, partId: planPartIds[partCode] } },
				update: {
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					usageBasis: "1 per product",
					status: "COMMITTED",
				},
				create: {
					id: allocId,
					lotId,
					partId: planPartIds[partCode],
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					usageBasis: "1 per product",
					status: "COMMITTED",
					createdAt: seedClock,
				},
			});
		}
	}

	// Batches — one tray per batch (qty === labelPackSize). Keys kept so reseed updates in place.
	// [key, code, modelNumber, partCode, qty, stage, sub, status]
	const batchDefs = [
		["batch-av-inj", "BNI-2607-001", "01", "B251-01-01", tray, injectionStageId, null, "ACTIVE"],
		["batch-av-dec", "BNI-2607-002", "01", "B251-01-01", tray, decorationStageId, subFullSprayId, "ACTIVE"],
		["batch-av-qc", "BNI-2607-003", "01", "B251-01-04", tray, assemblyStageId, subSubAssemblyId, "ACTIVE"],
		["batch-hd-inj", "BNI-2607-004", "02", "B251-01-08", tray, injectionStageId, null, "ACTIVE"],
		["batch-hd-dec", "BNI-2607-005", "02", "B251-01-10", tray, decorationStageId, subLineSprayId, "ACTIVE"],
		["batch-tc-inj", "BNI-2607-006", "03", "B251-01-11", tray, injectionStageId, null, "ACTIVE"],
		["batch-tc-asm", "BNI-2607-007", "03", "B251-01-12", tray, assemblyStageId, subAssortmentId, "ACTIVE"],
		["batch-fw-dec", "BNI-2607-008", "04", "B251-01-15", tray, decorationStageId, subTampoId, "ACTIVE"],
		["batch-av-wh", "BNI-2607-009", "01", "B251-01-01", tray, warehouseStageId, subMainPackingId, "CLOSED"],
		["batch-dr-inj", "BNI-2607-010", "05", "B251-01-22", tray, injectionStageId, null, "ACTIVE"],
		["batch-dr-dec", "BNI-2607-011", "05", "B251-01-20", tray, decorationStageId, subFullSprayId, "ACTIVE"],
		["batch-tr-inj", "BNI-2607-012", "06", "B251-01-23", tray, injectionStageId, null, "ACTIVE"],
		["batch-tr-asm", "BNI-2607-013", "06", "B251-01-23", tray, assemblyStageId, subAssortmentId, "ACTIVE"],
		["batch-hd-asm", "BNI-2607-014", "02", "B251-01-10", tray, assemblyStageId, subSubAssemblyId, "ACTIVE"],
		["batch-fw-inj", "BNI-2607-015", "04", "B251-01-16", tray, injectionStageId, null, "ACTIVE"],
	];

	const batchIds = {};
	for (const [key, batchCode, modelNumber, partCode, qty, stageId, subStageId, status] of batchDefs) {
		const id = stableId(key);
		batchIds[key] = id;
		const lotId = lotIds[modelNumber];
		const allocId = lotAllocIds[`${modelNumber}:${partCode}`];
		await tx.batch.upsert({
			where: { id },
			update: {
				batchCode: code(batchCode),
				barcodeValue: code(batchCode),
				lotId,
				plannedQuantity: qty,
				labelPackSize: CLIENT_B251.trayQuantityStandard,
				currentStageId: stageId,
				currentSubStageId: subStageId,
				status,
				createdBySubjectId: operator.id,
			},
			create: {
				id,
				batchCode: code(batchCode),
				barcodeValue: code(batchCode),
				lotId,
				plannedQuantity: qty,
				labelPackSize: CLIENT_B251.trayQuantityStandard,
				currentStageId: stageId,
				currentSubStageId: subStageId,
				status,
				createdBySubjectId: operator.id,
				createdAt: seedClock,
			},
		});
		await tx.batchPartLine.upsert({
			where: { batchId_partId: { batchId: id, partId: planPartIds[partCode] } },
			update: {
				quantity: qty,
				lotPartAllocationId: allocId,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
			},
			create: {
				batchId: id,
				partId: planPartIds[partCode],
				quantity: qty,
				lotPartAllocationId: allocId,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
			},
		});
	}

	// ── Story projects: the B251 line arc (10 projects deep) ────────────────
	// July (above) is the full-depth anchor. These nine tell the rest of the
	// story across statuses: replenishment → seasonal planning → model pushes →
	// trial pause → completions → retro + forecast. Depth is graduated on purpose:
	// August carries lots/batches/prints (desk realism); drafts carry plans only;
	// completions carry closed lots/batches (history). QC/print history stays
	// exclusive to July (below) to bound seed complexity.
	// [key, projectCode, name, status, released?, {model: trays}]
	const storyProjects = [
		["aug", "PRJ-B251-AUG", "B251 August replenishment", "RELEASED", true, { "01": 3, "02": 2, "03": 2 }],
		["sep", "PRJ-B251-SEP", "B251 September seasonal launch", "DRAFT", false, { "01": 4, "02": 3, "03": 2, "04": 2, "05": 2, "06": 2 }],
		["m02", "PRJ-B251-M02", "B251 Cheese Hotdog push", "RELEASED", true, { "02": 5 }],
		["m03", "PRJ-B251-M03", "B251 Tacos run", "RELEASED", true, { "03": 4 }],
		["m04", "PRJ-B251-M04", "B251 Potato Wedge trial", "PAUSED", false, { "04": 2 }],
		["m05", "PRJ-B251-M05", "B251 Cola / Ice Coffee completed", "COMPLETED", true, { "05": 3 }],
		["m06", "PRJ-B251-M06", "B251 Tray buffer", "READY", false, { "06": 3 }],
		["jun", "PRJ-B251-JUN", "B251 June pilot (retro)", "COMPLETED", true, { "01": 2 }],
		["oct", "PRJ-B251-OCT", "B251 October forecast", "DRAFT", false, { "01": 2, "02": 2 }],
	];
	// Lots per story project: [lotSuffix, lotCode, lotName, modelNumber, trays, lotStatus]
	const storyLots = {
		aug: [
			["aug1", "LOT-B251-11", "B251 August replenishment — Lot 01", "01", 3, "ACTIVE"],
			["aug2", "LOT-B251-12", "B251 August replenishment — Lot 02", "02", 2, "ACTIVE"],
		],
		sep: [["sep1", "LOT-B251-13", "B251 September seasonal — Lot 01", "01", 4, "PLANNED"]],
		m02: [["m02a", "LOT-B251-14", "B251 Cheese Hotdog — Lot 01", "02", 5, "ACTIVE"]],
		m03: [["m03a", "LOT-B251-15", "B251 Tacos — Lot 01", "03", 4, "ACTIVE"]],
		m04: [["m04a", "LOT-B251-16", "B251 Potato Wedge — Lot 01", "04", 2, "PLANNED"]],
		m05: [["m05a", "LOT-B251-17", "B251 Cola / Ice Coffee — Lot 01", "05", 3, "COMPLETED"]],
		m06: [["m06a", "LOT-B251-18", "B251 Tray — Lot 01", "06", 3, "PLANNED"]],
		jun: [["jun1", "LOT-B251-19", "B251 June pilot — Lot 01", "01", 2, "COMPLETED"]],
		oct: [],
	};
	// Batches per story project: [batchSuffix, batchCode, lotSuffix, partCode, stage, sub, status]
	// ("-" subStage = null.)
	const storyBatches = {
		aug: [
			["augb1", "BNI-2608-001", "aug1", "B251-01-01", "inj", "-", "ACTIVE"],
			["augb2", "BNI-2608-002", "aug1", "B251-01-01ST", "dec", "fs", "ACTIVE"],
			["augb3", "BNI-2608-003", "aug2", "B251-01-08", "inj", "-", "ACTIVE"],
			["augb4", "BNI-2608-004", "aug2", "B251-01-10", "dec", "ls", "ACTIVE"],
		],
		m02: [
			["m02b1", "BNI-2608-101", "m02a", "B251-01-08", "inj", "-", "ACTIVE"],
			["m02b2", "BNI-2608-102", "m02a", "B251-01-10", "asm", "sub", "ACTIVE"],
		],
		m03: [
			["m03b1", "BNI-2608-201", "m03a", "B251-01-11", "inj", "-", "ACTIVE"],
			["m03b2", "BNI-2608-202", "m03a", "B251-01-12", "asm", "ast", "ACTIVE"],
		],
		m05: [
			["m05b1", "BNI-2608-301", "m05a", "B251-01-22", "inj", "-", "CLOSED"],
			["m05b2", "BNI-2608-302", "m05a", "B251-01-20", "dec", "fs", "CLOSED"],
		],
		jun: [
			["junb1", "BNI-2606-001", "jun1", "B251-01-01", "inj", "-", "CLOSED"],
			["junb2", "BNI-2606-002", "jun1", "B251-01-02", "inj", "-", "CLOSED"],
		],
		sep: [],
		m04: [],
		m06: [],
		oct: [],
	};
	const storyStage = {
		inj: injectionStageId,
		dec: decorationStageId,
		asm: assemblyStageId,
		wh: warehouseStageId,
	};
	const storySubStage = {
		fs: subFullSprayId,
		ls: subLineSprayId,
		tp: subTampoId,
		sub: subSubAssemblyId,
		ast: subAssortmentId,
		pack: subMainPackingId,
	};
	for (const [projKey, projectCode, name, status, released, modelTrays] of storyProjects) {
		const storyProjectId = stableId(`production-plan-${projKey}`);
		const storyPartsListId = stableId(`parts-list-${projKey}-v1`);
		const storyPlanPartIds = {};
		const storyLotIds = {};
		const storyAllocIds = {};
		const storyQty = Object.values(modelTrays).reduce((sum, trays) => sum + trays * tray, 0);

		await tx.project.upsert({
			where: { id: storyProjectId },
			update: {
				workspaceId: "PATS",
				projectCode: code(projectCode),
				name,
				requiredProductionQuantity: storyQty,
				status,
				...(released ? { releasedAt: seedClock, releasedBySubjectId: planner.id } : {}),
				productId: productB251Id,
			},
			create: {
				id: storyProjectId,
				workspaceId: "PATS",
				projectCode: code(projectCode),
				name,
				requiredProductionQuantity: storyQty,
				productId: productB251Id,
				status,
				...(released ? { releasedAt: seedClock, releasedBySubjectId: planner.id } : {}),
				createdAt: seedClock,
			},
		});
		await tx.productSpecification.upsert({
			where: { projectId: storyProjectId },
			update: {
				skuCode: code("B251-SKU"),
				productName: CLIENT_B251.productName,
				trayQuantityStandard: CLIENT_B251.trayQuantityStandard,
				sourceRevisionRef: CLIENT_B251.revision,
			},
			create: {
				id: stableId(`product-spec-${projKey}`),
				projectId: storyProjectId,
				skuCode: code("B251-SKU"),
				productName: CLIENT_B251.productName,
				trayQuantityStandard: CLIENT_B251.trayQuantityStandard,
				sourceRevisionRef: CLIENT_B251.revision,
				createdAt: seedClock,
			},
		});
		for (const [modelNumber, trays] of Object.entries(modelTrays)) {
			const qty = trays * tray;
			await tx.projectModelAllocation.upsert({
				where: { projectId_modelId: { projectId: storyProjectId, modelId: modelIds[modelNumber] } },
				update: {
					plannedQuantity: qty,
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					lifecycleStatus: "COMMITTED",
				},
				create: {
					id: stableId(`pma-${projKey}-${modelNumber}`),
					projectId: storyProjectId,
					modelId: modelIds[modelNumber],
					plannedQuantity: qty,
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					lifecycleStatus: "COMMITTED",
				},
			});
		}
		// Snapshot run parts (CT included) for this project's models.
		const storyModels = Object.keys(modelTrays);
		for (const modelNumber of storyModels) {
			const model = CLIENT_B251.models.find((m) => m.modelNumber === modelNumber);
			for (const [partCode, partName] of model.parts) {
				const id = stableId(`plan-part-${projKey}-${partCode}`);
				storyPlanPartIds[partCode] = id;
				await tx.part.upsert({
					where: { id },
					update: {
						projectId: storyProjectId,
						partCode,
						partName,
						plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
						sourceModelId: modelIds[modelNumber],
						sourceModelPartId: partIds[partCode],
						lifecycleStatus: "PUBLISHED",
						variancePercentThreshold: 0.05,
					},
					create: {
						id,
						projectId: storyProjectId,
						partCode,
						partName,
						plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
						sourceModelId: modelIds[modelNumber],
						sourceModelPartId: partIds[partCode],
						lifecycleStatus: "PUBLISHED",
						variancePercentThreshold: 0.05,
					},
				});
			}
			for (const deco of CLIENT_B251.decoPartsByModel[modelNumber] ?? []) {
				if (!decoPartIds[deco.partCode]) continue;
				const id = stableId(`plan-part-${projKey}-deco-${deco.partCode}`);
				storyPlanPartIds[deco.partCode] = id;
				await tx.part.upsert({
					where: { id },
					update: {
						projectId: storyProjectId,
						partCode: deco.partCode,
						partName: decoPartDisplayName(deco),
						plannedCycleTimes: plannedCtMapForPartCode(deco.partCode, ctStepIds),
						sourceModelId: modelIds[modelNumber],
						sourceModelPartId: decoPartIds[deco.partCode],
						lifecycleStatus: "PUBLISHED",
						variancePercentThreshold: 0.05,
					},
					create: {
						id,
						projectId: storyProjectId,
						partCode: deco.partCode,
						partName: decoPartDisplayName(deco),
						plannedCycleTimes: plannedCtMapForPartCode(deco.partCode, ctStepIds),
						sourceModelId: modelIds[modelNumber],
						sourceModelPartId: decoPartIds[deco.partCode],
						lifecycleStatus: "PUBLISHED",
						variancePercentThreshold: 0.05,
					},
				});
			}
		}
		if (storyModels.includes("01")) {
			const partCode = CLIENT_B251.sharedCapsule.partCode;
			const id = stableId(`plan-part-${projKey}-capsule-${partCode}`);
			storyPlanPartIds[partCode] = id;
			await tx.part.upsert({
				where: { id },
				update: {
					projectId: storyProjectId,
					partCode,
					partName: CLIENT_B251.sharedCapsule.partName,
					plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
					sourceModelId: modelIds["01"],
					sourceModelPartId: capsulePartIds["01"],
					lifecycleStatus: "PUBLISHED",
					variancePercentThreshold: 0.05,
				},
				create: {
					id,
					projectId: storyProjectId,
					partCode,
					partName: CLIENT_B251.sharedCapsule.partName,
					plannedCycleTimes: plannedCtMapForPartCode(partCode, ctStepIds),
					sourceModelId: modelIds["01"],
					sourceModelPartId: capsulePartIds["01"],
					lifecycleStatus: "PUBLISHED",
					variancePercentThreshold: 0.05,
				},
			});
		}
		await tx.partsList.upsert({
			where: { id: storyPartsListId },
			update: {
				projectId: storyProjectId,
				version: 1,
				status: "PUBLISHED",
				sourceRevisionRef: CLIENT_B251.revision,
				publishedAt: seedClock,
			},
			create: {
				id: storyPartsListId,
				projectId: storyProjectId,
				version: 1,
				status: "PUBLISHED",
				sourceRevisionRef: CLIENT_B251.revision,
				publishedAt: seedClock,
				createdAt: seedClock,
			},
		});
		let storyStepOrder = 1;
		for (const partCode of Object.keys(storyPlanPartIds)) {
			for (const [stageId, subStageId] of [
				[injectionStageId, null],
				[decorationStageId, subFullSprayId],
				[assemblyStageId, subSubAssemblyId],
				[warehouseStageId, subMainPackingId],
			]) {
				const id = stableId(`route-step-${projKey}-${partCode}-${storyStepOrder}`);
				await tx.routingStep.upsert({
					where: { id },
					update: {
						partsListId: storyPartsListId,
						partId: storyPlanPartIds[partCode],
						stageId,
						subStageId,
						stepOrder: storyStepOrder,
					},
					create: {
						id,
						partsListId: storyPartsListId,
						partId: storyPlanPartIds[partCode],
						stageId,
						subStageId,
						stepOrder: storyStepOrder,
					},
				});
				storyStepOrder += 1;
			}
		}
		for (const [lotSuffix, lotCode, lotName, modelNumber, trays, lotStatus] of storyLots[projKey] ?? []) {
			const qty = trays * tray;
			const lotId = stableId(`lot-${projKey}-${lotSuffix}`);
			storyLotIds[lotSuffix] = lotId;
			const firstPart = CLIENT_B251.models.find((m) => m.modelNumber === modelNumber).parts[0];
			await tx.lot.upsert({
				where: { id: lotId },
				update: {
					projectId: storyProjectId,
					lotCode: code(lotCode),
					lotName,
					partsListId: storyPartsListId,
					partsListVersion: 1,
					partId: storyPlanPartIds[firstPart[0]],
					partName: firstPart[1],
					requiredProductionQuantity: qty,
					status: lotStatus,
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					labelPackSize: CLIENT_B251.trayQuantityStandard,
					createdAtStage: "Planning",
				},
				create: {
					id: lotId,
					projectId: storyProjectId,
					lotCode: code(lotCode),
					lotName,
					partsListId: storyPartsListId,
					partsListVersion: 1,
					partId: storyPlanPartIds[firstPart[0]],
					partName: firstPart[1],
					requiredProductionQuantity: qty,
					status: lotStatus,
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					labelPackSize: CLIENT_B251.trayQuantityStandard,
					createdAtStage: "Planning",
					createdAt: seedClock,
				},
			});
			const lotModel = CLIENT_B251.models.find((m) => m.modelNumber === modelNumber);
			const lotPartCodes = [
				...lotModel.parts.map(([c]) => c),
				...(CLIENT_B251.decoPartsByModel[modelNumber] ?? [])
					.map((deco) => deco.partCode)
					.filter((c) => storyPlanPartIds[c] !== undefined),
				...(modelNumber === "01" && storyPlanPartIds[CLIENT_B251.sharedCapsule.partCode] !== undefined
					? [CLIENT_B251.sharedCapsule.partCode]
					: []),
			];
			for (const partCode of lotPartCodes) {
				const allocId = stableId(`alloc-${projKey}-${lotSuffix}-${partCode}`);
				storyAllocIds[`${lotSuffix}:${partCode}`] = allocId;
				await tx.lotPartAllocation.upsert({
					where: { lotId_partId: { lotId, partId: storyPlanPartIds[partCode] } },
					update: {
						quantityMagnitude: `${qty}.000000`,
						quantityUom: "piece",
						usageBasis: "1 per product",
						status: "COMMITTED",
					},
					create: {
						id: allocId,
						lotId,
						partId: storyPlanPartIds[partCode],
						quantityMagnitude: `${qty}.000000`,
						quantityUom: "piece",
						usageBasis: "1 per product",
						status: "COMMITTED",
						createdAt: seedClock,
					},
				});
			}
		}
		for (const [batchSuffix, batchCode, lotSuffix, partCode, stageKey, subKey, batchStatus] of storyBatches[projKey] ?? []) {
			const id = stableId(`batch-${projKey}-${batchSuffix}`);
			const stageId = storyStage[stageKey];
			const subStageId = subKey === "-" ? null : (storySubStage[subKey] ?? null);
			const lotId = storyLotIds[lotSuffix];
			const allocId = storyAllocIds[`${lotSuffix}:${partCode}`];
			await tx.batch.upsert({
				where: { id },
				update: {
					batchCode: code(batchCode),
					barcodeValue: code(batchCode),
					lotId,
					plannedQuantity: tray,
					labelPackSize: CLIENT_B251.trayQuantityStandard,
					currentStageId: stageId,
					currentSubStageId: subStageId,
					status: batchStatus,
					createdBySubjectId: operator.id,
				},
				create: {
					id,
					batchCode: code(batchCode),
					barcodeValue: code(batchCode),
					lotId,
					plannedQuantity: tray,
					labelPackSize: CLIENT_B251.trayQuantityStandard,
					currentStageId: stageId,
					currentSubStageId: subStageId,
					status: batchStatus,
					createdBySubjectId: operator.id,
					createdAt: seedClock,
				},
			});
			await tx.batchPartLine.upsert({
				where: { batchId_partId: { batchId: id, partId: storyPlanPartIds[partCode] } },
				update: {
					quantity: tray,
					lotPartAllocationId: allocId,
					quantityMagnitude: `${tray}.000000`,
					quantityUom: "piece",
				},
				create: {
					batchId: id,
					partId: storyPlanPartIds[partCode],
					quantity: tray,
					lotPartAllocationId: allocId,
					quantityMagnitude: `${tray}.000000`,
					quantityUom: "piece",
				},
			});
		}
	}
	// August first-prints (desk realism for the replenishment story).
	{
		const augBatchId = stableId("batch-aug-augb1");
		for (const [seq, qty, dueOffset, idSuffix] of [[1, 240, -90, "a1"], [2, 240, -30, "a2"]]) {
			const printJobId = stableId(`print-job-aug-${idSuffix}`);
			await tx.printJob.upsert({
				where: { id: printJobId },
				update: {
					batchId: augBatchId,
					sectionId: injectionSectionId,
					fromStageId: injectionStageId,
					fromSubStageId: null,
					toStageId: decorationStageId,
					toSubStageId: null,
					barcodeValue: code("BNI-2608-001"),
					quantity: qty,
					sequence: seq,
					language: "EN",
					reprintOf: null,
					renderedPayload: `{"sequence":${seq},"label":"BNI-2608-001-${seq}"}`,
					status: "SENT",
					failureReason: null,
					actor: "aila.torres",
					actorSubjectId: lineLeader.id,
					occurredAt: atOffset({ minutes: dueOffset }),
				},
				create: {
					id: printJobId,
					batchId: augBatchId,
					sectionId: injectionSectionId,
					fromStageId: injectionStageId,
					fromSubStageId: null,
					toStageId: decorationStageId,
					toSubStageId: null,
					barcodeValue: code("BNI-2608-001"),
					quantity: qty,
					sequence: seq,
					language: "EN",
					reprintOf: null,
					renderedPayload: `{"sequence":${seq},"label":"BNI-2608-001-${seq}"}`,
					status: "SENT",
					failureReason: null,
					actor: "aila.torres",
					actorSubjectId: lineLeader.id,
					occurredAt: atOffset({ minutes: dueOffset }),
				},
			});
		}
	}

	// Outputs-ledger evidence: first-print injection rows so the desk carryover
	// cue and Outputs ledger render non-empty for aila.torres. Sequence 1–2
	// keep the next live print (count+1) continuous. Same-day so reconciliation
	// (occurredAt date === sheet production date) counts them as labeled history.
	const fwInjBatchId = batchIds["batch-fw-inj"];
	for (const [seq, qty, dueOffset, idSuffix] of [
		[1, 240, -150, "1"],
		[2, 120, -40, "2"],
	]) {
		const printJobId = stableId(`print-job-inj-${idSuffix}`);
		await tx.printJob.upsert({
			where: { id: printJobId },
			update: {
				batchId: fwInjBatchId,
				sectionId: injectionSectionId,
				fromStageId: injectionStageId,
				fromSubStageId: null,
				toStageId: decorationStageId,
				toSubStageId: null,
				barcodeValue: code("BNI-2607-015"),
				quantity: qty,
				sequence: seq,
				language: "EN",
				reprintOf: null,
				renderedPayload: `{"sequence":${seq},"label":"BNI-2607-015-${seq}"}`,
				status: "SENT",
				failureReason: null,
				actor: "aila.torres",
				actorSubjectId: lineLeader.id,
				occurredAt: atOffset({ minutes: dueOffset }),
			},
			create: {
				id: printJobId,
				batchId: fwInjBatchId,
				sectionId: injectionSectionId,
				fromStageId: injectionStageId,
				fromSubStageId: null,
				toStageId: decorationStageId,
				toSubStageId: null,
				barcodeValue: code("BNI-2607-015"),
				quantity: qty,
				sequence: seq,
				reprintOf: null,
				language: "EN",
				renderedPayload: `{"sequence":${seq},"label":"BNI-2607-015-${seq}"}`,
				status: "SENT",
				actor: "aila.torres",
				actorSubjectId: lineLeader.id,
				occurredAt: atOffset({ minutes: dueOffset }),
			},
		});
	}

	// Stage events (named parts / batches for activity feed)
	const eventDefs = [
		["ev-av-inj", "batch-av-inj", injectionStageId, null, "B251-01-01", tray, 0, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-dec", "batch-av-dec", decorationStageId, subFullSprayId, "B251-01-01", tray - 2, 0, 5, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-skip", "batch-av-qc", assemblyStageId, null, "B251-01-04", tray, 0, 6, "STAGE_SCAN_RECORDED", "BLOCKED", true],
		["ev-hd-inj", "batch-hd-inj", injectionStageId, null, "B251-01-08", tray, 1, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-hd-dec", "batch-hd-dec", decorationStageId, subLineSprayId, "B251-01-10", tray - 2, 1, 3, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tc-inj", "batch-tc-inj", injectionStageId, null, "B251-01-11", tray, 1, 4, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tc-asm", "batch-tc-asm", assemblyStageId, subAssortmentId, "B251-01-12", tray, 2, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-fw-dec", "batch-fw-dec", decorationStageId, subTampoId, "B251-01-15", tray, 2, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-wh", "batch-av-wh", warehouseStageId, subMainPackingId, "B251-01-01", tray, 2, 4, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-dr-inj", "batch-dr-inj", injectionStageId, null, "B251-01-22", tray, 2, 5, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-dr-dec", "batch-dr-dec", decorationStageId, subFullSprayId, "B251-01-20", tray - 2, 2, 6, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tr-inj", "batch-tr-inj", injectionStageId, null, "B251-01-23", tray, 3, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tr-asm", "batch-tr-asm", assemblyStageId, subAssortmentId, "B251-01-23", tray, 3, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-hd-asm", "batch-hd-asm", assemblyStageId, subSubAssemblyId, "B251-01-10", tray, 3, 3, "STAGE_SCAN_RECORDED", "ACCEPTED", false],
		["ev-fw-inj", "batch-fw-inj", injectionStageId, null, "B251-01-16", tray, 3, 4, "STAGE_COMPLETED", "ACCEPTED", false],
	];

	for (const [key, batchKey, stageId, subStageId, partCode, qty, day, hour, eventType, status, isViolation] of eventDefs) {
		const id = stableId(key);
		const batchId = batchIds[batchKey];
		const modelNumber = batchDefs.find((b) => b[0] === batchKey)[2];
		const lotId = lotIds[modelNumber];
		await tx.stageEvent.upsert({
			where: { id },
			update: {
				stageId,
				subStageId,
				batchId,
				lotId,
				partId: planPartIds[partCode],
				quantity: qty,
				occurredAt: atOffset({ days: day, hours: hour }),
				actor: operator.displayNameSnapshot ?? operator.id,
				actorSubjectId: operator.id,
				eventType,
				status,
				isRoutingViolation: isViolation,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				sourceRepresentation: CLIENT_B251.formCode,
			},
			create: {
				id,
				stageId,
				subStageId,
				batchId,
				lotId,
				partId: planPartIds[partCode],
				quantity: qty,
				occurredAt: atOffset({ days: day, hours: hour }),
				actor: operator.displayNameSnapshot ?? operator.id,
				actorSubjectId: operator.id,
				eventType,
				status,
				isRoutingViolation: isViolation,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				sourceRepresentation: CLIENT_B251.formCode,
			},
		});
	}

	const violationEventId = stableId("ev-av-skip");
	await tx.routingViolation.upsert({
		where: { stageEventId: violationEventId },
		update: {
			batchId: batchIds["batch-av-qc"],
			lotId: lotIds["01"],
			partId: planPartIds["B251-01-04"],
			attemptedStageId: assemblyStageId,
			expectedSteps: [
				{ stageId: injectionStageId, order: 1 },
				{ stageId: decorationStageId, subStageId: subFullSprayId, order: 2 },
				{ stageId: assemblyStageId, subStageId: subSubAssemblyId, order: 3 },
			],
			detectedAt: atOffset({ hours: 6 }),
			status: "OPEN",
			resolved: false,
		},
		create: {
			id: stableId("rv-b251-skip-deco"),
			stageEventId: violationEventId,
			batchId: batchIds["batch-av-qc"],
			lotId: lotIds["01"],
			partId: planPartIds["B251-01-04"],
			attemptedStageId: assemblyStageId,
			expectedSteps: [
				{ stageId: injectionStageId, order: 1 },
				{ stageId: decorationStageId, subStageId: subFullSprayId, order: 2 },
				{ stageId: assemblyStageId, subStageId: subSubAssemblyId, order: 3 },
			],
			detectedAt: atOffset({ hours: 6 }),
			status: "OPEN",
			resolved: false,
		},
	});

	// Inventory transactions with real part codes
	const invDefs = [
		["inv-1", "ISSUANCE", "batch-av-dec", "B251-01-01", injectionStageId, decorationStageId, tray, tray - 2, 0, 4],
		["inv-2", "RECEIVING", "batch-av-inj", "B251-01-01", null, injectionStageId, tray, tray, 0, 1],
		["inv-3", "ISSUANCE", "batch-hd-dec", "B251-01-10", injectionStageId, decorationStageId, tray, tray - 2, 1, 2],
		["inv-4", "RECEIVING", "batch-tc-inj", "B251-01-11", null, injectionStageId, tray, tray - 2, 1, 3],
		["inv-5", "ISSUANCE", "batch-av-wh", "B251-01-01", assemblyStageId, warehouseStageId, tray, tray, 2, 3],
	];
	for (const [key, type, batchKey, partCode, fromStageId, toStageId, expected, actual, day, hour] of invDefs) {
		const modelNumber = batchDefs.find((b) => b[0] === batchKey)[2];
		await tx.inventoryTransaction.upsert({
			where: { id: stableId(key) },
			update: {
				transactionType: type,
				batchId: batchIds[batchKey],
				partId: planPartIds[partCode],
				lotId: lotIds[modelNumber],
				fromStageId,
				toStageId,
				expectedQuantity: expected,
				actualQuantity: actual,
				expectedQuantityMagnitude: `${expected}.000000`,
				actualQuantityMagnitude: `${actual}.000000`,
				quantityUom: "piece",
				usageBasis: "1 per product",
				withdrawalFormRef: type === "ISSUANCE" ? `WD-${partCode}` : null,
				recordedAt: atOffset({ days: day, hours: hour }),
				recordedBy: operator.displayNameSnapshot ?? operator.id,
				recordedBySubjectId: operator.id,
				status: "ACCEPTED",
				sourceRepresentation: CLIENT_B251.formCode,
			},
			create: {
				id: stableId(key),
				transactionType: type,
				batchId: batchIds[batchKey],
				partId: planPartIds[partCode],
				lotId: lotIds[modelNumber],
				fromStageId,
				toStageId,
				expectedQuantity: expected,
				actualQuantity: actual,
				expectedQuantityMagnitude: `${expected}.000000`,
				actualQuantityMagnitude: `${actual}.000000`,
				quantityUom: "piece",
				usageBasis: "1 per product",
				withdrawalFormRef: type === "ISSUANCE" ? `WD-${partCode}` : null,
				recordedAt: atOffset({ days: day, hours: hour }),
				recordedBy: operator.displayNameSnapshot ?? operator.id,
				recordedBySubjectId: operator.id,
				status: "ACCEPTED",
				sourceRepresentation: CLIENT_B251.formCode,
			},
		});
	}

	for (const [key, , , partCode, qty, stageId, subStageId, status] of batchDefs) {
		if (status === "CLOSED") continue;
		const id = batchIds[key];
		const lastEv = eventDefs.find((e) => e[1] === key && e[8] === "STAGE_COMPLETED");
		await tx.batchPositionProjection.upsert({
			where: { batchId: id },
			update: {
				stageId,
				subStageId,
				lastEventId: lastEv ? stableId(lastEv[0]) : null,
				positionStatus: "ACCEPTED",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				projectionVersion: 1,
			},
			create: {
				batchId: id,
				stageId,
				subStageId,
				lastEventId: lastEv ? stableId(lastEv[0]) : null,
				positionStatus: "ACCEPTED",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				projectionVersion: 1,
			},
		});
	}

	// QC worklist + history on B251 batches (PROVISIONAL seed dispositions)
	// [key, batchKey, partCode, partName, qty, stage, sub, status, day, hour]
	const qcOpenDefs = [
		["qi-b251-open-taco", "batch-tc-asm", "B251-01-12", "Right Taco", tray, assemblyStageId, subAssortmentId, "IN_PROGRESS", 1, 3],
		["qi-b251-open-av", "batch-av-qc", "B251-01-04", "Cheese & Patty", tray, assemblyStageId, subSubAssemblyId, "IN_PROGRESS", 0, 7],
		["qi-b251-open-hd", "batch-hd-asm", "B251-01-10", "Cheese Hotdog", tray, assemblyStageId, subSubAssemblyId, "IN_PROGRESS", 3, 3],
		["qi-b251-open-tray", "batch-tr-asm", "B251-01-23", "Tray", tray, assemblyStageId, subAssortmentId, "IN_PROGRESS", 3, 2],
		["qi-b251-open-drink", "batch-dr-dec", "B251-01-20", "Ice L", tray, decorationStageId, subFullSprayId, "IN_PROGRESS", 2, 6],
	];
	const inspectionOpenId = stableId("qi-b251-open-taco");
	for (const [key, batchKey, partCode, partName, qty, stageId, subStageId, status, day, hour] of qcOpenDefs) {
		const id = stableId(key);
		await tx.qualityInspection.upsert({
			where: { id },
			update: {
				batchId: batchIds[batchKey],
				stageId,
				subStageId,
				sectionId: stageId === decorationStageId ? decorationSectionId : assemblySubAssemblySectionId,
				inspectedQuantity: `${qty}.000000`,
				quantityUom: "piece",
				status,
				inspectedBySubjectId: quality.id,
				evidence: {
					partCode,
					partName,
					origin: "client-parts-list",
					evidenceStatus: "PROVISIONAL",
				},
				startedAt: atOffset({ days: day, hours: hour }),
				completedAt: null,
			},
			create: {
				id,
				batchId: batchIds[batchKey],
				stageId,
				subStageId,
				sectionId: stageId === decorationStageId ? decorationSectionId : assemblySubAssemblySectionId,
				inspectedQuantity: `${qty}.000000`,
				quantityUom: "piece",
				status,
				inspectedBySubjectId: quality.id,
				evidence: {
					partCode,
					partName,
					origin: "client-parts-list",
					evidenceStatus: "PROVISIONAL",
				},
				startedAt: atOffset({ days: day, hours: hour }),
			},
		});
	}

	// Completed inspections with decisions for history panel
	const qcDoneDefs = [
		["qi-b251-hold", "batch-av-dec", "B251-01-01", "Avocado Burger Upper Bun", tray, decorationStageId, subFullSprayId, "HOLD", "ROUTING_REVIEW", "Batch advanced without full decoration completion evidence.", 0, 6],
		["qi-b251-pass-wh", "batch-av-wh", "B251-01-01", "Avocado Burger Upper Bun", 240, warehouseStageId, subMainPackingId, "PASSED", "VISUAL_OK", "Pack appearance and label match B251 tray standard.", 2, 4],
		["qi-b251-fail-hd", "batch-hd-dec", "B251-01-10", "Cheese Hotdog", tray, decorationStageId, subLineSprayId, "FAILED", "PAINT_DEFECT", "Mask spray miss on Cheese Hotdog body — return to Decoration.", 1, 3],
		["qi-b251-pass-fw", "batch-fw-dec", "B251-01-15", "Fries", 240, decorationStageId, subTampoId, "PASSED", "TAMPO_OK", "Tampo registration within tolerance for Potato Wedge fries.", 2, 2],
	];
	for (const [key, batchKey, partCode, partName, qty, stageId, subStageId, decision, reasonCode, reasonNote, day, hour] of qcDoneDefs) {
		const inspectionId = stableId(key);
		const decidedAt = atOffset({ days: day, hours: hour, minutes: 45 });
		await tx.qualityInspection.upsert({
			where: { id: inspectionId },
			update: {
				batchId: batchIds[batchKey],
				stageId,
				subStageId,
				sectionId:
					stageId === warehouseStageId
						? warehouseSectionId
						: stageId === decorationStageId
							? decorationSectionId
							: assemblySubAssemblySectionId,
				inspectedQuantity: `${qty}.000000`,
				quantityUom: "piece",
				status: "COMPLETED",
				inspectedBySubjectId: quality.id,
				evidence: {
					partCode,
					partName,
					origin: "client-parts-list",
					evidenceStatus: "PROVISIONAL",
				},
				startedAt: atOffset({ days: day, hours: hour, minutes: 30 }),
				completedAt: decidedAt,
			},
			create: {
				id: inspectionId,
				batchId: batchIds[batchKey],
				stageId,
				subStageId,
				sectionId:
					stageId === warehouseStageId
						? warehouseSectionId
						: stageId === decorationStageId
							? decorationSectionId
							: assemblySubAssemblySectionId,
				inspectedQuantity: `${qty}.000000`,
				quantityUom: "piece",
				status: "COMPLETED",
				inspectedBySubjectId: quality.id,
				evidence: {
					partCode,
					partName,
					origin: "client-parts-list",
					evidenceStatus: "PROVISIONAL",
				},
				startedAt: atOffset({ days: day, hours: hour, minutes: 30 }),
				completedAt: decidedAt,
			},
		});
		await tx.qualityDecision.upsert({
			where: { id: stableId(`qd-${key}`) },
			update: {
				inspectionId,
				decision,
				reasonCode,
				reasonNote,
				decidedBySubjectId: quality.id,
				decidedAt,
			},
			create: {
				id: stableId(`qd-${key}`),
				inspectionId,
				decision,
				reasonCode,
				reasonNote,
				decidedBySubjectId: quality.id,
				decidedAt,
			},
		});
	}


	await tx.auditRecord.upsert({
		where: { id: stableId("audit-seed-b251-release") },
		update: {
			actorSubjectId: planner.id,
			action: "seed.release-plan",
			resourceType: "ProductionPlan",
			resourceId: projectId,
			outcome: "SUCCESS",
			correlationId: `SEED-B251`,
			detail: {
				seedProfile: profile,
				productCode: CLIENT_B251.productCode,
				workbookTitle: CLIENT_B251.workbookTitle,
				evidenceStatus: "PROVISIONAL",
				origin: "client-parts-list",
			},
			occurredAt: seedClock,
		},
		create: {
			id: stableId("audit-seed-b251-release"),
			actorSubjectId: planner.id,
			action: "seed.release-plan",
			resourceType: "ProductionPlan",
			resourceId: projectId,
			outcome: "SUCCESS",
			correlationId: `SEED-B251`,
			detail: {
				seedProfile: profile,
				productCode: CLIENT_B251.productCode,
				workbookTitle: CLIENT_B251.workbookTitle,
				evidenceStatus: "PROVISIONAL",
				origin: "client-parts-list",
			},
			occurredAt: seedClock,
		},
	});
	await tx.outboxMessage.upsert({
		where: { id: stableId("outbox-seed-b251-released") },
		update: {
			aggregateType: "ProductionPlan",
			aggregateId: projectId,
			eventType: "production-plan.released",
			schemaVersion: 1,
			payload: { planId: projectId, productCode: CLIENT_B251.productCode, seedProfile: profile },
			status: "PENDING",
			availableAt: seedClock,
			attempts: 0,
		},
		create: {
			id: stableId("outbox-seed-b251-released"),
			aggregateType: "ProductionPlan",
			aggregateId: projectId,
			eventType: "production-plan.released",
			schemaVersion: 1,
			payload: { planId: projectId, productCode: CLIENT_B251.productCode, seedProfile: profile },
			status: "PENDING",
			availableAt: seedClock,
			attempts: 0,
		},
	});

	// ── Monitoring encode seed (Line Leader sheets + booth boards) ─────────
	// Durable seed rows for Management / Daily / Station monitoring in canonical mode.
	const monDate = monitoringSeedDate();
	const booth01Id = stableId("booth-01");
	const booth02Id = stableId("booth-02");

	const sheetFullSpraySlots = defaultDaySlots([206, 190, 190, 190, 0, 185, 175, null, null, null]);
	const sheetFullSprayPayload = {
		id: stableId("mon-sheet-full-spray"),
		date: monDate,
		lineId: "line-main",
		lineLabel: "Main line",
		processId: processFsManualId,
		processName: "Full Spray",
		lineLeaderName: "Aila Torres",
		productId: productB251Id,
		productName: CLIENT_B251.productName,
		modelId: "01",
		modelName: "Avocado Burger",
		partId: planPartIds["B251-01-01"] ?? "part-unknown",
		partName: "Avocado Burger body",
		lotId: stableId("lot-avocado"),
		lotCode: code("LOT-B251-01"),
		targetPerShift: 1440,
		hourlyTarget: 192,
		operatorNames: "Operator A / Operator B",
		inputPartsAvailable: 1500,
		slots: sheetFullSpraySlots,
		defectiveQty: 12,
		status: "draft",
		updatedAt: new Date().toISOString(),
	};

	const sheetMaskSlots = defaultDaySlots([170, 180, 0, 165, 160, null, null, null, null, null]);
	const sheetMaskPayload = {
		id: stableId("mon-sheet-mask-spray"),
		date: monDate,
		lineId: "line-main",
		lineLabel: "Main line",
		processId: processLsMaskId,
		processName: "Line Spray (Mask)",
		labelledCycleTimeSec: 10,
		lineLeaderName: "Aila Torres",
		productId: productB251Id,
		productName: CLIENT_B251.productName,
		modelId: "02",
		modelName: "Cheese Hotdog",
		partId: planPartIds["B251-01-02"] ?? "part-unknown",
		partName: "Cheese Hotdog body",
		lotId: stableId("lot-hotdog"),
		lotCode: code("LOT-B251-02"),
		targetPerShift: 1350,
		hourlyTarget: 180,
		operatorNames: "Operator C",
		inputPartsAvailable: 1400,
		slots: sheetMaskSlots,
		defectiveQty: 4,
		status: "draft",
		updatedAt: new Date().toISOString(),
	};

	// Desk-id rows (Production Desk Hourly Sheet): the desk reads today's sheet by
	// deterministic id (`desk-daily:{station}:{process}:{date}`), so the seed ships
	// the same Full Spray / Line Spray (Mask) numbers under those ids. Reseed refreshes
	// them like the stable-id sheets above (additive; a reseed on a later day
	// leaves the prior day's desk rows orphaned — wipe with PATS_SEED_FRESH=1
	// for a clean slate).
	const deskFullSprayPayload = {
		...sheetFullSprayPayload,
		id: `desk-daily:${decorationSectionId}:${processFsManualId}:${monDate}`,
	};
	const deskMaskSprayPayload = {
		...sheetMaskPayload,
		id: `desk-daily:${decorationSectionId}:${processLsMaskId}:${monDate}`,
	};

	for (const payload of [
		sheetFullSprayPayload,
		sheetMaskPayload,
		deskFullSprayPayload,
		deskMaskSprayPayload,
	]) {
		await tx.monitoringDailySheet.upsert({
			where: { id: payload.id },
			update: {
				workspaceId: "PATS",
				productionDate: payload.date,
				lineLabel: payload.lineLabel,
				workProcessId: payload.processId,
				processName: payload.processName,
				lineLeaderName: payload.lineLeaderName,
				productName: payload.productName,
				modelName: payload.modelName,
				partName: payload.partName,
				lotCode: payload.lotCode,
				targetPerShift: payload.targetPerShift,
				hourlyTarget: payload.hourlyTarget,
				operatorNames: payload.operatorNames,
				inputPartsAvailable: payload.inputPartsAvailable,
				defectiveQty: payload.defectiveQty,
				status: payload.status,
				slotsJson: payload.slots,
				payloadJson: payload,
				rowVersion: 1,
			},
			create: {
				id: payload.id,
				workspaceId: "PATS",
				productionDate: payload.date,
				lineLabel: payload.lineLabel,
				workProcessId: payload.processId,
				processName: payload.processName,
				lineLeaderName: payload.lineLeaderName,
				productName: payload.productName,
				modelName: payload.modelName,
				partName: payload.partName,
				lotCode: payload.lotCode,
				targetPerShift: payload.targetPerShift,
				hourlyTarget: payload.hourlyTarget,
				operatorNames: payload.operatorNames,
				inputPartsAvailable: payload.inputPartsAvailable,
				defectiveQty: payload.defectiveQty,
				status: payload.status,
				slotsJson: payload.slots,
				payloadJson: payload,
				rowVersion: 1,
			},
		});
	}

	const boardSlots = defaultDaySlots([280, 300, 0, 295, 290, 310, null, null, null, null]);
	const boardPayload = {
		id: stableId("mon-board-booth-01"),
		date: monDate,
		boothId: booth01Id,
		boothLabel: "Booth 01",
		operatorName: "Operator A",
		partId: planPartIds["B251-01-01"] ?? "part-unknown",
		partName: "Avocado Burger body",
		lotId: stableId("lot-avocado"),
		lotCode: code("LOT-B251-01"),
		productId: productB251Id,
		productName: CLIENT_B251.productName,
		modelId: "01",
		modelName: "Avocado Burger",
		processId: processFsManualId,
		processName: "Full Spray",
		labelledCycleTimeSec: 12,
		targetPerHour: 300,
		targetPerDay: 2250,
		slots: boardSlots,
		updatedAt: new Date().toISOString(),
	};

	await tx.monitoringStationBoard.upsert({
		where: { id: boardPayload.id },
		update: {
			workspaceId: "PATS",
			productionDate: boardPayload.date,
			boothId: boardPayload.boothId,
			workProcessId: boardPayload.processId,
			boothLabel: boardPayload.boothLabel,
			processName: boardPayload.processName,
			partName: boardPayload.partName,
			lotCode: boardPayload.lotCode,
			labelledCycleTimeSec: boardPayload.labelledCycleTimeSec,
			targetPerHour: boardPayload.targetPerHour,
			targetPerDay: boardPayload.targetPerDay,
			slotsJson: boardPayload.slots,
			payloadJson: boardPayload,
			rowVersion: 1,
		},
		create: {
			id: boardPayload.id,
			workspaceId: "PATS",
			productionDate: boardPayload.date,
			boothId: boardPayload.boothId,
			workProcessId: boardPayload.processId,
			boothLabel: boardPayload.boothLabel,
			processName: boardPayload.processName,
			partName: boardPayload.partName,
			lotCode: boardPayload.lotCode,
			labelledCycleTimeSec: boardPayload.labelledCycleTimeSec,
			targetPerHour: boardPayload.targetPerHour,
			targetPerDay: boardPayload.targetPerDay,
			slotsJson: boardPayload.slots,
			payloadJson: boardPayload,
			rowVersion: 1,
		},
	});

	// Second booth board (lighter shift) for multi-board station list
	const board2Slots = defaultDaySlots([250, 270, 0, 260, null, null, null, null, null, null]);
	const board2Payload = {
		...boardPayload,
		id: stableId("mon-board-booth-02"),
		boothId: booth02Id,
		boothLabel: "Booth 02",
		operatorName: "Operator B",
		slots: board2Slots,
		targetPerHour: 280,
		targetPerDay: 2100,
		updatedAt: new Date().toISOString(),
	};
	await tx.monitoringStationBoard.upsert({
		where: { id: board2Payload.id },
		update: {
			workspaceId: "PATS",
			productionDate: board2Payload.date,
			boothId: board2Payload.boothId,
			workProcessId: board2Payload.processId,
			boothLabel: board2Payload.boothLabel,
			processName: board2Payload.processName,
			partName: board2Payload.partName,
			lotCode: board2Payload.lotCode,
			labelledCycleTimeSec: board2Payload.labelledCycleTimeSec,
			targetPerHour: board2Payload.targetPerHour,
			targetPerDay: board2Payload.targetPerDay,
			slotsJson: board2Payload.slots,
			payloadJson: board2Payload,
			rowVersion: 1,
		},
		create: {
			id: board2Payload.id,
			workspaceId: "PATS",
			productionDate: board2Payload.date,
			boothId: board2Payload.boothId,
			workProcessId: board2Payload.processId,
			boothLabel: board2Payload.boothLabel,
			processName: board2Payload.processName,
			partName: board2Payload.partName,
			lotCode: board2Payload.lotCode,
			labelledCycleTimeSec: board2Payload.labelledCycleTimeSec,
			targetPerHour: board2Payload.targetPerHour,
			targetPerDay: board2Payload.targetPerDay,
			slotsJson: board2Payload.slots,
			payloadJson: board2Payload,
			rowVersion: 1,
		},
	});

	return {
		profile,
		subjects: 6,
		primaryProduct: CLIENT_B251.productCode,
		productName: CLIENT_B251.productName,
		models: CLIENT_B251.models.length,
		injParts: injPartCount,
		decoParts: decoPartCount,
		paintParts: paintPartCount,
		capsuleAttachments: capsuleAttachmentCount,
		catalogModelParts: injPartCount + decoPartCount + paintPartCount + capsuleAttachmentCount,
		planParts: Object.keys(planPartIds).length,
		plans: 1 + storyProjects.length,
		lots: lotDefs.length + Object.values(storyLots).reduce((sum, lots) => sum + lots.length, 0),
		batches:
			batchDefs.length +
			Object.values(storyBatches).reduce((sum, batches) => sum + batches.length, 0),
		stations: 11,
		workProcesses: 16,
		booths: 2,
		monitoringDailySheets: 4,
		monitoringStationBoards: 2,
		productId: productB251Id,
		projectId,
		openInspectionId: inspectionOpenId,
		adminUsername: "liza.delacruz",
		evidenceNote:
			"B251 client-parts-list (PROVISIONAL) + monitoring encode seed — fabricated B308 family dropped; not Drive-approved",
	};
}

try {
	const result = await prisma.$transaction((tx) => seedProfile(tx), {
		maxWait: 20_000,
		timeout: 180_000,
	});
	console.log(`Seeded PATS ${result.profile} profile: ${JSON.stringify(result)}`);
} finally {
	await prisma.$disconnect();
}
