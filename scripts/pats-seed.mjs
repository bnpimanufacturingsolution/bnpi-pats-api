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
 * The demo subjects are the canonical RBAC fixture set for future Playwright
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
const prefix = mode.toUpperCase();
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

/** Profile-scoped business codes (DEMO-B251 / UAT-B251) for multi-profile DBs. */
function code(value) {
	return `${prefix}-${value}`;
}

function atOffset({ days = 0, hours = 0, minutes = 0 } = {}) {
	return new Date(seedClock.getTime() + ((days * 24 + hours) * 60 + minutes) * 60_000);
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
	const subject = await tx.subject.upsert({
		where: { id: stableId(key) },
		update: {
			displayNameSnapshot: displayName,
			emailSnapshot: `${username}@pats.local`,
			status: "ACTIVE",
		},
		create: {
			id: stableId(key),
			provider: "local",
			issuer: "pats-local",
			providerSubject: username,
			displayNameSnapshot: displayName,
			emailSnapshot: `${username}@pats.local`,
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

	// Re-seed must slim leftover fat bundles (e.g. demo.planner no longer holds QC).
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
 */
async function wipeSeededTables(tx) {
	for (const model of [
		"outboxMessage",
		"auditRecord",
		"qualityDecision",
		"qualityInspection",
		"monitoringStationBoard",
		"monitoringDailySheet",
		"routingViolation",
		"stageEvent",
		"inventoryTransaction",
		"batchPositionProjection",
		"batchPartLine",
		"batch",
		"lotPartAllocation",
		"lot",
		"materialRequirement",
		"routingStep",
		"pmrs",
		"partsList",
		"part",
		"planDemandAllocation",
		"projectModelAllocation",
		"productSpecification",
		"project",
		"workInstruction",
		"booth",
		"workProcess",
		"stationStep",
		"station",
		"subStageEligibility",
		"subStage",
		"processRouteStage",
		"processRoute",
		"bomLine",
		"bomDefinition",
		"modelPart",
		"model",
		"product",
		"userPreference",
		"qualityStageAssignment",
		"subjectAssignment",
		"subjectCredential",
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
	//   positive  demo.admin           — admin bundle; every capability true.
	//   positive  demo.planner         — pure planner (planning + read-only
	//                                     monitoring + catalog read). No QC,
	//                                     no floor ops, no day-sheet encode.
	//   positive  demo.operator        — floor execution + inventory.issue +
	//                                     station encode. DENIED: daily-sheet
	//                                     encode, QC, ops-admin, catalog-manage.
	//   positive  demo.lineleader      — operator + CAPABILITY daily-metrics.encode
	//                                     (Journey B / day-sheet grant path).
	//   positive  demo.quality         — qi bundle + quality-stage scope
	//                                     Decoration + Injection (QC-primary).
	//   negative  demo.quality_noscope — qi bundle with NO quality-stage rows:
	//                                     Journey D must FAIL CLOSED (scope-
	//                                     dependent deny fixture).
	// The operator-only deny path needs no separate user — demo.operator already
	// is the operator without daily-metrics.encode. demo.inventory/demo.guest were
	// considered and dropped: they add no distinct capability assertion.

	const planner = await upsertSubject(
		tx,
		"subject-planner",
		`${profile}.planner`,
		`${prefix} Planner`,
		// Pure planner: planning + read-only monitoring + catalog read. Not a QC account.
		["planner"],
		passwordHash,
	);
	const operator = await upsertSubject(
		tx,
		"subject-operator",
		`${profile}.operator`,
		`${prefix} Operator`,
		["operator"],
		passwordHash,
	);
	// Line Leader = operator + daily-metrics.encode assignment (not a fourth business role).
	await upsertSubject(
		tx,
		"subject-lineleader",
		`${profile}.lineleader`,
		`${prefix} Line Leader`,
		["operator"],
		passwordHash,
		[{ kind: "CAPABILITY", key: "daily-metrics.encode" }],
	);
	const quality = await upsertSubject(
		tx,
		"subject-quality",
		`${profile}.quality`,
		`${prefix} Quality`,
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
		`${profile}.quality_noscope`,
		`${prefix} Quality NoScope`,
		["qi"],
		passwordHash,
	);
	const admin = await upsertSubject(
		tx,
		"subject-admin",
		`${profile}.admin`,
		`${prefix} Admin`,
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
				},
				create: {
					id: partId,
					modelId,
					partCode,
					partName,
					lifecycleStatus: "PUBLISHED",
					evidenceStatus: "PROVISIONAL",
					routingSteps: [],
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
			},
			create: {
				id: partId,
				modelId,
				partCode,
				partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
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
	const subMaskSprayId = stableId("substage-mask-spray");
	const subTampoId = stableId("substage-tampo");
	// Retired: Quality is Journey D, not a SubStage / Station / Process.
	const retiredQualityCheckSubId = stableId("substage-quality-check");
	const retiredQualityCheckStationId = stableId("station-assembly-quality-check");
	const retiredQualityCheckProcessId = stableId("work-process-quality-check");
	const subSubAssemblyId = stableId("substage-sub-assembly");
	const subAssortmentId = stableId("substage-assortment");
	const subMainPackingId = stableId("substage-main-packing");
	// Device install default (D-008): one Station per SubStage when present; stage-level otherwise.
	// Keep legacy keys for injection/decoration-primary so existing station ids stay stable.
	const injectionStationId = stableId("station-injection-01");
	const decorationStationId = stableId("station-decoration-full-spray"); // primary deco PC (was decoration-01)
	const decorationMaskStationId = stableId("station-decoration-mask-spray");
	const decorationTampoStationId = stableId("station-decoration-tampo");
	const assemblySubAssemblyStationId = stableId("station-assembly-sub-assembly");
	const assemblyAssortmentStationId = stableId("station-assembly-assortment");
	const warehouseStationId = stableId("station-warehouse-main-packing");

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
	// demo.quality = Decoration + Injection (QC-primary QI). demo.admin = all catalog stages
	// so admin quality caps are not fail-closed on empty scope.
	// demo.planner is a pure planner — no QC capabilities and no stage rows.
	// demo.quality_noscope is the negative fixture — qi bundle but NO scope rows
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
	// demo.planner never holds QC scope, and demo.quality_noscope must never
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
		[subFullSprayId, "Full Spray", 1, { isConfigurable: true }],
		[subMaskSprayId, "Mask Spray", 2, { isConfigurable: true }],
		[subTampoId, "Tampo", 3, { isConfigurable: true }],
		[subSubAssemblyId, "Sub-Assembly", 1, { isConfigurable: true }],
		[subAssortmentId, "Assortment", 3, { isConfigurable: true }],
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
		[decorationStageId, subFullSprayId],
		[decorationStageId, subMaskSprayId],
		[decorationStageId, subTampoId],
		[assemblyStageId, subSubAssemblyId],
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

	for (const [id, name, stationCode, stageId, displayOrder] of [
		[injectionStationId, "Injection · Molding", "ST-INJ-01", injectionStageId, 1],
		[decorationStationId, "Decoration · Full Spray", "ST-DEC-FS", decorationStageId, 2],
		[decorationMaskStationId, "Decoration · Mask Spray", "ST-DEC-MS", decorationStageId, 3],
		[decorationTampoStationId, "Decoration · Tampo", "ST-DEC-TP", decorationStageId, 4],
		[assemblySubAssemblyStationId, "Assembly · Sub-Assembly", "ST-ASM-SUB", assemblyStageId, 5],
		[assemblyAssortmentStationId, "Assembly · Assortment", "ST-ASM-AST", assemblyStageId, 7],
		[warehouseStationId, "Warehouse · Main Packing", "ST-WH-PK", warehouseStageId, 8],
	]) {
		await tx.station.upsert({
			where: { id },
			update: {
				workspaceId: "PATS",
				name,
				stationCode: code(stationCode),
				operationalContextKey: "PATS",
				stageId,
				displayOrder,
				isEnabled: true,
			},
			create: {
				id,
				workspaceId: "PATS",
				name,
				stationCode: code(stationCode),
				operationalContextKey: "PATS",
				stageId,
				displayOrder,
				isEnabled: true,
			},
		});
	}

	for (const [id, stationId, stageId, subStageId] of [
		// Injection has no floor sub-stages in seed → stage-wide bound step
		[stableId("station-step-inj"), injectionStationId, injectionStageId, null],
		[stableId("station-step-dec-fs"), decorationStationId, decorationStageId, subFullSprayId],
		[stableId("station-step-dec-ms"), decorationMaskStationId, decorationStageId, subMaskSprayId],
		[stableId("station-step-dec-tp"), decorationTampoStationId, decorationStageId, subTampoId],
		[stableId("station-step-subassy"), assemblySubAssemblyStationId, assemblyStageId, subSubAssemblyId],
		[stableId("station-step-assort"), assemblyAssortmentStationId, assemblyStageId, subAssortmentId],
		[stableId("station-step-wh"), warehouseStationId, warehouseStageId, subMainPackingId],
	]) {
		await tx.stationStep.upsert({
			where: { id },
			update: { stationId, stageId, subStageId },
			create: { id, stationId, stageId, subStageId },
		});
	}

	// Work processes under sub-stages (catalog leaf; not stations). Bridge names match current SubStages
	// until Option A reshape (intermediate SubStage + finer processes).
	const processFullSprayId = stableId("work-process-full-spray");
	const processMaskSprayId = stableId("work-process-mask-spray");
	const processTampoId = stableId("work-process-tampo");
	const processMainPackingId = stableId("work-process-main-packing");

	for (const [id, subStageId, name, displayOrder, labelledCycleTimeSec] of [
		[processFullSprayId, subFullSprayId, "Full Spray", 1, 12],
		[processMaskSprayId, subMaskSprayId, "Mask Spray", 2, 10],
		[processTampoId, subTampoId, "Tampo", 3, 6],
		[processMainPackingId, subMainPackingId, "Main Packing", 1, null],
	]) {
		await tx.workProcess.upsert({
			where: { id },
			update: {
				subStageId,
				name,
				displayOrder,
				isEnabled: true,
				isSystemSeed: true,
				labelledCycleTimeSec,
			},
			create: {
				id,
				subStageId,
				name,
				displayOrder,
				isEnabled: true,
				isSystemSeed: true,
				labelledCycleTimeSec,
			},
		});
	}

	// Quality Inspection is Journey D. Remount leftover Quality Check hops (additive — no deletes).
	await tx.qualityInspection.updateMany({
		where: { OR: [{ subStageId: retiredQualityCheckSubId }, { stationId: retiredQualityCheckStationId }] },
		data: { subStageId: subSubAssemblyId, stationId: assemblySubAssemblyStationId },
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
		where: { OR: [{ stationId: retiredQualityCheckStationId }, { subStageId: retiredQualityCheckSubId }] },
		data: { stationId: assemblySubAssemblyStationId, subStageId: subSubAssemblyId },
	});
	await tx.station.updateMany({
		where: { id: retiredQualityCheckStationId },
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
				stationId: decorationStationId,
				stageId: decorationStageId,
				subStageId: subFullSprayId,
				workProcessId: processFullSprayId,
				displayOrder,
				isEnabled: true,
			},
			create: {
				id,
				workspaceId: "PATS",
				boothCode: code(boothCode),
				label,
				stationId: decorationStationId,
				stageId: decorationStageId,
				subStageId: subFullSprayId,
				workProcessId: processFullSprayId,
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
			projectCode: code("PLAN-B251-JUL"),
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
			projectCode: code("PLAN-B251-JUL"),
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
		["batch-hd-dec", "BNI-2607-005", "02", "B251-01-10", tray, decorationStageId, subMaskSprayId, "ACTIVE"],
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

	// Stage events (named parts / batches for activity feed)
	const eventDefs = [
		["ev-av-inj", "batch-av-inj", injectionStageId, null, "B251-01-01", tray, 0, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-dec", "batch-av-dec", decorationStageId, subFullSprayId, "B251-01-01", tray - 2, 0, 5, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-skip", "batch-av-qc", assemblyStageId, null, "B251-01-04", tray, 0, 6, "STAGE_SCAN_RECORDED", "BLOCKED", true],
		["ev-hd-inj", "batch-hd-inj", injectionStageId, null, "B251-01-08", tray, 1, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-hd-dec", "batch-hd-dec", decorationStageId, subMaskSprayId, "B251-01-10", tray - 2, 1, 3, "STAGE_COMPLETED", "ACCEPTED", false],
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
				withdrawalFormRef: type === "ISSUANCE" ? `${prefix}-WD-${partCode}` : null,
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
				withdrawalFormRef: type === "ISSUANCE" ? `${prefix}-WD-${partCode}` : null,
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

	// QC worklist + history on B251 batches (PROVISIONAL demo dispositions)
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
				stationId: stageId === decorationStageId ? decorationStationId : assemblySubAssemblyStationId,
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
				stationId: stageId === decorationStageId ? decorationStationId : assemblySubAssemblyStationId,
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
		["qi-b251-fail-hd", "batch-hd-dec", "B251-01-10", "Cheese Hotdog", tray, decorationStageId, subMaskSprayId, "FAILED", "PAINT_DEFECT", "Mask spray miss on Cheese Hotdog body — return to Decoration.", 1, 3],
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
				stationId:
					stageId === warehouseStageId
						? warehouseStationId
						: stageId === decorationStageId
							? decorationStationId
							: assemblySubAssemblyStationId,
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
				stationId:
					stageId === warehouseStageId
						? warehouseStationId
						: stageId === decorationStageId
							? decorationStationId
							: assemblySubAssemblyStationId,
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
			correlationId: `${prefix}-SEED-B251`,
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
			correlationId: `${prefix}-SEED-B251`,
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
	// Durable demo for Management / Daily / Station monitoring in canonical mode.
	const monDate = monitoringSeedDate();
	const booth01Id = stableId("booth-01");
	const booth02Id = stableId("booth-02");

	const sheetFullSpraySlots = defaultDaySlots([206, 190, 190, 190, 0, 185, 175, null, null, null]);
	const sheetFullSprayPayload = {
		id: stableId("mon-sheet-full-spray"),
		date: monDate,
		lineId: "line-main",
		lineLabel: "Main line",
		processId: processFullSprayId,
		processName: "Full Spray",
		lineLeaderName: "DEMO Line Leader",
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
		processId: processMaskSprayId,
		processName: "Mask Spray",
		lineLeaderName: "DEMO Line Leader",
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

	for (const payload of [sheetFullSprayPayload, sheetMaskPayload]) {
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
		processId: processFullSprayId,
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
		plans: 1,
		lots: lotDefs.length,
		batches: batchDefs.length,
		stations: 7,
		workProcesses: 4,
		booths: 2,
		monitoringDailySheets: 2,
		monitoringStationBoards: 2,
		productId: productB251Id,
		projectId,
		openInspectionId: inspectionOpenId,
		adminUsername: `${profile}.admin`,
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
