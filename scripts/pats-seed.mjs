/**
 * Canonical PATS seed orchestrator (demo / uat).
 *
 * Primary catalog/plan material is drawn from client parts-list evidence for
 * B251 Machibouke Hamburger Shop 3 (Rev 6.0) — see pats-seed-client-b251.mjs.
 * Contour families: inj parts, deco part nos, paint nos (PN-*), shared capsule.
 * Values remain PROVISIONAL seed evidence, not Drive-approved publication.
 *
 * SEED_MODE=none|demo|uat
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
import { CLIENT_B308 } from "./pats-seed-client-b308.mjs";

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

const profile = mode;
const prefix = mode.toUpperCase();
const seedClock = new Date("2026-07-28T08:00:00.000Z");
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

async function upsertSubject(tx, key, username, displayName, roleBundles, passwordHash) {
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

	await tx.userPreference.upsert({
		where: { userId: subject.id },
		update: { locale: "EN", completedTours: [] },
		create: { userId: subject.id, locale: "EN", completedTours: [] },
	});

	return subject;
}

async function seedProfile(tx) {
	const passwordHash = await argon2.hash(password);

	const planner = await upsertSubject(
		tx,
		"subject-planner",
		`${profile}.planner`,
		`${prefix} Planner`,
		// Demo shell convenience: planner can walk planning + floor + QC without role switch.
		[
			"planner",
			"catalog-manager",
			"production-operator",
			"inventory-controller",
			"quality-reviewer",
		],
		passwordHash,
	);
	const operator = await upsertSubject(
		tx,
		"subject-operator",
		`${profile}.operator`,
		`${prefix} Operator`,
		["production-operator", "inventory-controller"],
		passwordHash,
	);
	const quality = await upsertSubject(
		tx,
		"subject-quality",
		`${profile}.quality`,
		`${prefix} Quality`,
		["quality-reviewer"],
		passwordHash,
	);
	await upsertSubject(
		tx,
		"subject-admin",
		`${profile}.admin`,
		`${prefix} Admin`,
		[
			"planner",
			"catalog-manager",
			"production-operator",
			"inventory-controller",
			"quality-reviewer",
			"operations-admin",
		],
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
	const subQualityCheckId = stableId("substage-quality-check");
	const subSubAssemblyId = stableId("substage-sub-assembly");
	const subAssortmentId = stableId("substage-assortment");
	const subMainPackingId = stableId("substage-main-packing");
	// Device install default (D-008): one Station per SubStage when present; stage-level otherwise.
	// Keep legacy keys for injection/decoration-primary so QC seed rows remain stable.
	const injectionStationId = stableId("station-injection-01");
	const decorationStationId = stableId("station-decoration-full-spray"); // primary deco PC (was decoration-01)
	const decorationMaskStationId = stableId("station-decoration-mask-spray");
	const decorationTampoStationId = stableId("station-decoration-tampo");
	const assemblyStationId = stableId("station-assembly-quality-check");
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

	for (const [id, name, displayOrder, flags] of [
		[subFullSprayId, "Full Spray", 1, { isConfigurable: true }],
		[subMaskSprayId, "Mask Spray", 2, { isConfigurable: true }],
		[subTampoId, "Tampo", 3, { isConfigurable: true }],
		[subQualityCheckId, "Quality Check", 1, { hasQualityCheckpoint: true, isMandatoryCheckpoint: true }],
		[subSubAssemblyId, "Sub-Assembly", 2, { isConfigurable: true }],
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
		[assemblyStageId, subQualityCheckId],
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
		[stableId("route-stage-assy"), assemblyStageId, subQualityCheckId, 3, "Assembly / Quality Check"],
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
		[assemblyStationId, "Assembly · Quality Check", "ST-ASM-QC", assemblyStageId, 5],
		[assemblySubAssemblyStationId, "Assembly · Sub-Assembly", "ST-ASM-SUB", assemblyStageId, 6],
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
		[stableId("station-step-qc"), assemblyStationId, assemblyStageId, subQualityCheckId],
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
	const processQualityCheckId = stableId("work-process-quality-check");
	const processMainPackingId = stableId("work-process-main-packing");

	for (const [id, subStageId, name, displayOrder, labelledCycleTimeSec] of [
		[processFullSprayId, subFullSprayId, "Full Spray", 1, 12],
		[processMaskSprayId, subMaskSprayId, "Mask Spray", 2, 10],
		[processTampoId, subTampoId, "Tampo", 3, 6],
		[processQualityCheckId, subQualityCheckId, "Quality Check", 1, null],
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
		[assemblyStageId, "Assembly — quality checkpoint before assortment", subQualityCheckId],
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
	const planQty = 18 * CLIENT_B251.trayQuantityStandard;

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
		"01": 1440,
		"02": 720,
		"03": 720,
		"04": 480,
		"05": 480,
		"06": 480,
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
			[assemblyStageId, subQualityCheckId],
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

	// Lots: one active lot per model family (including drink + tray)
	const lotDefs = [
		["lot-avocado", "LOT-B251-01", "B251 Avocado Burger — Lot 01", "01", 1440],
		["lot-hotdog", "LOT-B251-02", "B251 Cheese Hotdog — Lot 01", "02", 720],
		["lot-tacos", "LOT-B251-03", "B251 Tacos — Lot 01", "03", 720],
		["lot-fries", "LOT-B251-04", "B251 Potato Wedge — Lot 01", "04", 480],
		["lot-drink", "LOT-B251-05", "B251 Cola / Ice Coffee — Lot 01", "05", 480],
		["lot-tray", "LOT-B251-06", "B251 Tray — Lot 01", "06", 480],
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

	// Batches — factory-style codes, WIP across all stages / model families
	// [key, code, modelNumber, partCode, qty, stage, sub, status]
	const batchDefs = [
		["batch-av-inj", "BNI-2607-001", "01", "B251-01-01", 480, injectionStageId, null, "ACTIVE"],
		["batch-av-dec", "BNI-2607-002", "01", "B251-01-01", 480, decorationStageId, subFullSprayId, "ACTIVE"],
		["batch-av-qc", "BNI-2607-003", "01", "B251-01-04", 480, assemblyStageId, subQualityCheckId, "ACTIVE"],
		["batch-hd-inj", "BNI-2607-004", "02", "B251-01-08", 360, injectionStageId, null, "ACTIVE"],
		["batch-hd-dec", "BNI-2607-005", "02", "B251-01-10", 360, decorationStageId, subMaskSprayId, "ACTIVE"],
		["batch-tc-inj", "BNI-2607-006", "03", "B251-01-11", 360, injectionStageId, null, "ACTIVE"],
		["batch-tc-asm", "BNI-2607-007", "03", "B251-01-12", 360, assemblyStageId, subAssortmentId, "ACTIVE"],
		["batch-fw-dec", "BNI-2607-008", "04", "B251-01-15", 240, decorationStageId, subTampoId, "ACTIVE"],
		["batch-av-wh", "BNI-2607-009", "01", "B251-01-01", 240, warehouseStageId, subMainPackingId, "CLOSED"],
		["batch-dr-inj", "BNI-2607-010", "05", "B251-01-22", 240, injectionStageId, null, "ACTIVE"],
		["batch-dr-dec", "BNI-2607-011", "05", "B251-01-20", 240, decorationStageId, subFullSprayId, "ACTIVE"],
		["batch-tr-inj", "BNI-2607-012", "06", "B251-01-23", 120, injectionStageId, null, "ACTIVE"],
		["batch-tr-asm", "BNI-2607-013", "06", "B251-01-23", 120, assemblyStageId, subAssortmentId, "ACTIVE"],
		["batch-hd-asm", "BNI-2607-014", "02", "B251-01-10", 240, assemblyStageId, subQualityCheckId, "ACTIVE"],
		["batch-fw-inj", "BNI-2607-015", "04", "B251-01-16", 240, injectionStageId, null, "ACTIVE"],
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
		["ev-av-inj", "batch-av-inj", injectionStageId, null, "B251-01-01", 480, 0, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-dec", "batch-av-dec", decorationStageId, subFullSprayId, "B251-01-01", 475, 0, 5, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-skip", "batch-av-qc", assemblyStageId, null, "B251-01-04", 480, 0, 6, "STAGE_SCAN_RECORDED", "BLOCKED", true],
		["ev-hd-inj", "batch-hd-inj", injectionStageId, null, "B251-01-08", 360, 1, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-hd-dec", "batch-hd-dec", decorationStageId, subMaskSprayId, "B251-01-10", 355, 1, 3, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tc-inj", "batch-tc-inj", injectionStageId, null, "B251-01-11", 360, 1, 4, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tc-asm", "batch-tc-asm", assemblyStageId, subAssortmentId, "B251-01-12", 360, 2, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-fw-dec", "batch-fw-dec", decorationStageId, subTampoId, "B251-01-15", 240, 2, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-av-wh", "batch-av-wh", warehouseStageId, subMainPackingId, "B251-01-01", 240, 2, 4, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-dr-inj", "batch-dr-inj", injectionStageId, null, "B251-01-22", 240, 2, 5, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-dr-dec", "batch-dr-dec", decorationStageId, subFullSprayId, "B251-01-20", 235, 2, 6, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tr-inj", "batch-tr-inj", injectionStageId, null, "B251-01-23", 120, 3, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-tr-asm", "batch-tr-asm", assemblyStageId, subAssortmentId, "B251-01-23", 120, 3, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		["ev-hd-asm", "batch-hd-asm", assemblyStageId, subQualityCheckId, "B251-01-10", 240, 3, 3, "STAGE_SCAN_RECORDED", "ACCEPTED", false],
		["ev-fw-inj", "batch-fw-inj", injectionStageId, null, "B251-01-16", 240, 3, 4, "STAGE_COMPLETED", "ACCEPTED", false],
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
				{ stageId: assemblyStageId, subStageId: subQualityCheckId, order: 3 },
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
				{ stageId: assemblyStageId, subStageId: subQualityCheckId, order: 3 },
			],
			detectedAt: atOffset({ hours: 6 }),
			status: "OPEN",
			resolved: false,
		},
	});

	// Inventory transactions with real part codes
	const invDefs = [
		["inv-1", "ISSUANCE", "batch-av-dec", "B251-01-01", injectionStageId, decorationStageId, 480, 475, 0, 4],
		["inv-2", "RECEIVING", "batch-av-inj", "B251-01-01", null, injectionStageId, 480, 480, 0, 1],
		["inv-3", "ISSUANCE", "batch-hd-dec", "B251-01-10", injectionStageId, decorationStageId, 360, 355, 1, 2],
		["inv-4", "RECEIVING", "batch-tc-inj", "B251-01-11", null, injectionStageId, 360, 358, 1, 3],
		["inv-5", "ISSUANCE", "batch-av-wh", "B251-01-01", assemblyStageId, warehouseStageId, 240, 240, 2, 3],
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
		["qi-b251-open-taco", "batch-tc-asm", "B251-01-12", "Right Taco", 360, assemblyStageId, subAssortmentId, "IN_PROGRESS", 1, 3],
		["qi-b251-open-av", "batch-av-qc", "B251-01-04", "Cheese & Patty", 480, assemblyStageId, subQualityCheckId, "IN_PROGRESS", 0, 7],
		["qi-b251-open-hd", "batch-hd-asm", "B251-01-10", "Cheese Hotdog", 240, assemblyStageId, subQualityCheckId, "IN_PROGRESS", 3, 3],
		["qi-b251-open-tray", "batch-tr-asm", "B251-01-23", "Tray", 120, assemblyStageId, subAssortmentId, "IN_PROGRESS", 3, 2],
		["qi-b251-open-drink", "batch-dr-dec", "B251-01-20", "Ice L", 240, decorationStageId, subFullSprayId, "IN_PROGRESS", 2, 6],
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
				stationId: stageId === decorationStageId ? decorationStationId : assemblyStationId,
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
				stationId: stageId === decorationStageId ? decorationStationId : assemblyStationId,
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
		["qi-b251-hold", "batch-av-dec", "B251-01-01", "Avocado Burger Upper Bun", 480, decorationStageId, subFullSprayId, "HOLD", "ROUTING_REVIEW", "Batch advanced without full decoration completion evidence.", 0, 6],
		["qi-b251-pass-wh", "batch-av-wh", "B251-01-01", "Avocado Burger Upper Bun", 240, warehouseStageId, subMainPackingId, "PASSED", "VISUAL_OK", "Pack appearance and label match B251 tray standard.", 2, 4],
		["qi-b251-fail-hd", "batch-hd-dec", "B251-01-10", "Cheese Hotdog", 360, decorationStageId, subMaskSprayId, "FAILED", "PAINT_DEFECT", "Mask spray miss on Cheese Hotdog body — return to Decoration.", 1, 3],
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
							: assemblyStationId,
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
							: assemblyStationId,
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

	// ── Second product family (distinct from B251) for multi-SKU demos ───────
	const productB308Id = stableId("product-b308");
	const b308ModelIds = {};
	const b308PartIds = {};
	await tx.product.upsert({
		where: { id: productB308Id },
		update: {
			productName: CLIENT_B308.productName,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
		create: {
			id: productB308Id,
			productCode: code(CLIENT_B308.productCode),
			productName: CLIENT_B308.productName,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
	});
	for (const model of CLIENT_B308.models) {
		const modelId = stableId(`model-b308-${model.modelNumber}`);
		b308ModelIds[model.modelNumber] = modelId;
		await tx.model.upsert({
			where: { id: modelId },
			update: {
				productId: productB308Id,
				modelNumber: model.modelNumber,
				modelName: model.modelName,
				sourceStatus: model.sourceStatus,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: model.evidenceStatus,
				sourceReference: {
					seedProfile: profile,
					origin: "seed-provisional-variety",
					productCode: CLIENT_B308.productCode,
					modelNumber: model.modelNumber,
				},
			},
			create: {
				id: modelId,
				productId: productB308Id,
				modelNumber: model.modelNumber,
				modelName: model.modelName,
				sourceStatus: model.sourceStatus,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: model.evidenceStatus,
				sourceReference: {
					seedProfile: profile,
					origin: "seed-provisional-variety",
					productCode: CLIENT_B308.productCode,
					modelNumber: model.modelNumber,
				},
			},
		});
		for (const [partCode, partName] of model.parts) {
			const partId = stableId(`model-part-${partCode}`);
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
			const resolved = await tx.modelPart.findUnique({
				where: { modelId_partCode: { modelId, partCode } },
				select: { id: true },
			});
			if (resolved) b308PartIds[partCode] = resolved.id;
		}
	}
	// Shared capsule on every B308 model
	for (const model of CLIENT_B308.models) {
		const modelId = b308ModelIds[model.modelNumber];
		const partCode = CLIENT_B308.sharedCapsule.partCode;
		await tx.modelPart.upsert({
			where: { modelId_partCode: { modelId, partCode } },
			update: {
				partName: CLIENT_B308.sharedCapsule.partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
			},
			create: {
				id: stableId(`model-part-b308-capsule-${model.modelNumber}`),
				modelId,
				partCode,
				partName: CLIENT_B308.sharedCapsule.partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
			},
		});
	}

	// B308 export plan — WIP skewed to Decoration / Assembly / Warehouse (vs B251 Injection-heavy)
	const b308PlanId = stableId("production-plan-b308-export");
	const b308PlanQty = 10 * CLIENT_B308.trayQuantityStandard; // 2000
	const b308PlanPartIds = {};
	await tx.project.upsert({
		where: { id: b308PlanId },
		update: {
			workspaceId: "PATS",
			projectCode: code("PLAN-B308-EXP"),
			name: `${CLIENT_B308.productName} — Export replenishment`,
			requiredProductionQuantity: b308PlanQty,
			status: "RELEASED",
			releasedAt: atOffset({ days: 1, hours: 2 }),
			releasedBySubjectId: planner.id,
			productId: productB308Id,
		},
		create: {
			id: b308PlanId,
			workspaceId: "PATS",
			projectCode: code("PLAN-B308-EXP"),
			name: `${CLIENT_B308.productName} — Export replenishment`,
			requiredProductionQuantity: b308PlanQty,
			productId: productB308Id,
			status: "RELEASED",
			releasedAt: atOffset({ days: 1, hours: 2 }),
			releasedBySubjectId: planner.id,
			createdAt: seedClock,
		},
	});
	await tx.productSpecification.upsert({
		where: { projectId: b308PlanId },
		update: {
			skuCode: code("B308-SKU-EXP"),
			productName: CLIENT_B308.productName,
			trayQuantityStandard: CLIENT_B308.trayQuantityStandard,
			sourceRevisionRef: CLIENT_B308.revision,
		},
		create: {
			id: stableId("product-spec-b308"),
			projectId: b308PlanId,
			skuCode: code("B308-SKU-EXP"),
			productName: CLIENT_B308.productName,
			trayQuantityStandard: CLIENT_B308.trayQuantityStandard,
			sourceRevisionRef: CLIENT_B308.revision,
			createdAt: seedClock,
		},
	});
	const b308ModelPlanQtys = { "01": 600, "02": 500, "03": 500, "04": 400 };
	for (const [modelNumber, qty] of Object.entries(b308ModelPlanQtys)) {
		await tx.projectModelAllocation.upsert({
			where: {
				projectId_modelId: {
					projectId: b308PlanId,
					modelId: b308ModelIds[modelNumber],
				},
			},
			update: {
				plannedQuantity: qty,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				lifecycleStatus: "COMMITTED",
			},
			create: {
				id: stableId(`pma-b308-${modelNumber}`),
				projectId: b308PlanId,
				modelId: b308ModelIds[modelNumber],
				plannedQuantity: qty,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				lifecycleStatus: "COMMITTED",
			},
		});
	}
	const b308PartsListId = stableId("parts-list-b308-v1");
	await tx.partsList.upsert({
		where: { id: b308PartsListId },
		update: {
			projectId: b308PlanId,
			version: 1,
			status: "PUBLISHED",
			sourceRevisionRef: CLIENT_B308.revision,
			publishedAt: seedClock,
		},
		create: {
			id: b308PartsListId,
			projectId: b308PlanId,
			version: 1,
			status: "PUBLISHED",
			sourceRevisionRef: CLIENT_B308.revision,
			publishedAt: seedClock,
			createdAt: seedClock,
		},
	});
	for (const model of CLIENT_B308.models) {
		for (const [partCode, partName] of model.parts) {
			const id = stableId(`plan-part-${partCode}`);
			b308PlanPartIds[partCode] = id;
			await tx.part.upsert({
				where: { id },
				update: {
					projectId: b308PlanId,
					partCode,
					partName,
					sourceModelId: b308ModelIds[model.modelNumber],
					sourceModelPartId: b308PartIds[partCode],
					lifecycleStatus: "PUBLISHED",
					variancePercentThreshold: 0.05,
				},
				create: {
					id,
					projectId: b308PlanId,
					partCode,
					partName,
					sourceModelId: b308ModelIds[model.modelNumber],
					sourceModelPartId: b308PartIds[partCode],
					lifecycleStatus: "PUBLISHED",
					variancePercentThreshold: 0.05,
				},
			});
		}
	}
	const b308LotDefs = [
		["lot-b308-tako", "LOT-B308-01", "B308 Takoyaki — Export Lot A", "01", 600, "B308-01-01"],
		["lot-b308-ramen", "LOT-B308-02", "B308 Ramen Cup — Export Lot A", "02", 500, "B308-01-05"],
		["lot-b308-oni", "LOT-B308-03", "B308 Onigiri — Export Lot A", "03", 500, "B308-01-08"],
		["lot-b308-skewer", "LOT-B308-04", "B308 Yakitori — Export Lot A", "04", 400, "B308-01-11"],
	];
	const b308LotIds = {};
	for (const [key, lotCode, lotName, modelNumber, qty, partCode] of b308LotDefs) {
		const lotId = stableId(key);
		b308LotIds[modelNumber] = lotId;
		await tx.lot.upsert({
			where: { id: lotId },
			update: {
				projectId: b308PlanId,
				lotCode: code(lotCode),
				lotName,
				partsListId: b308PartsListId,
				partsListVersion: 1,
				partId: b308PlanPartIds[partCode],
				partName: CLIENT_B308.models.find((m) => m.modelNumber === modelNumber).parts[0][1],
				requiredProductionQuantity: qty,
				status: "ACTIVE",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				labelPackSize: CLIENT_B308.trayQuantityStandard,
				createdAtStage: "Planning",
			},
			create: {
				id: lotId,
				projectId: b308PlanId,
				lotCode: code(lotCode),
				lotName,
				partsListId: b308PartsListId,
				partsListVersion: 1,
				partId: b308PlanPartIds[partCode],
				partName: CLIENT_B308.models.find((m) => m.modelNumber === modelNumber).parts[0][1],
				requiredProductionQuantity: qty,
				status: "ACTIVE",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				labelPackSize: CLIENT_B308.trayQuantityStandard,
				createdAtStage: "Planning",
				createdAt: seedClock,
			},
		});
		for (const [pCode] of CLIENT_B308.models.find((m) => m.modelNumber === modelNumber).parts) {
			await tx.lotPartAllocation.upsert({
				where: {
					lotId_partId: { lotId, partId: b308PlanPartIds[pCode] },
				},
				update: {
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					usageBasis: "1 per product",
					status: "COMMITTED",
				},
				create: {
					id: stableId(`alloc-${lotCode}-${pCode}`),
					lotId,
					partId: b308PlanPartIds[pCode],
					quantityMagnitude: `${qty}.000000`,
					quantityUom: "piece",
					usageBasis: "1 per product",
					status: "COMMITTED",
					createdAt: seedClock,
				},
			});
		}
	}
	// Stage mix deliberately different from B251 (more Deco/Assembly/Warehouse, less Injection)
	const b308BatchDefs = [
		["batch-b308-tako-inj", "BNI-2608-101", "01", "B308-01-01", 200, injectionStageId, null],
		["batch-b308-tako-dec", "BNI-2608-102", "01", "B308-01-01", 200, decorationStageId, subFullSprayId],
		["batch-b308-ramen-dec", "BNI-2608-103", "02", "B308-01-05", 250, decorationStageId, subMaskSprayId],
		["batch-b308-ramen-asm", "BNI-2608-104", "02", "B308-01-06", 180, assemblyStageId, subAssortmentId],
		["batch-b308-oni-asm", "BNI-2608-105", "03", "B308-01-08", 200, assemblyStageId, subQualityCheckId],
		["batch-b308-skewer-wh", "BNI-2608-106", "04", "B308-01-11", 150, warehouseStageId, subMainPackingId],
		["batch-b308-oni-dec", "BNI-2608-107", "03", "B308-01-09", 160, decorationStageId, subTampoId],
	];
	for (const [key, batchCode, modelNumber, partCode, qty, stageId, subStageId] of b308BatchDefs) {
		const id = stableId(key);
		const lotId = b308LotIds[modelNumber];
		await tx.batch.upsert({
			where: { id },
			update: {
				batchCode: code(batchCode),
				barcodeValue: code(batchCode),
				lotId,
				plannedQuantity: qty,
				labelPackSize: CLIENT_B308.trayQuantityStandard,
				currentStageId: stageId,
				currentSubStageId: subStageId,
				status: "ACTIVE",
				createdBySubjectId: operator.id,
			},
			create: {
				id,
				batchCode: code(batchCode),
				barcodeValue: code(batchCode),
				lotId,
				plannedQuantity: qty,
				labelPackSize: CLIENT_B308.trayQuantityStandard,
				currentStageId: stageId,
				currentSubStageId: subStageId,
				status: "ACTIVE",
				createdBySubjectId: operator.id,
				createdAt: seedClock,
			},
		});
		await tx.batchPartLine.upsert({
			where: { batchId_partId: { batchId: id, partId: b308PlanPartIds[partCode] } },
			update: {
				quantity: qty,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
			},
			create: {
				batchId: id,
				partId: b308PlanPartIds[partCode],
				quantity: qty,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
			},
		});
		await tx.batchPositionProjection.upsert({
			where: { batchId: id },
			update: {
				stageId,
				subStageId,
				positionStatus: "ACCEPTED",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				projectionVersion: 1,
			},
			create: {
				batchId: id,
				stageId,
				subStageId,
				positionStatus: "ACCEPTED",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				projectionVersion: 1,
			},
		});
	}
	// Distinct activity for Street Food Friends (different part names in feed)
	const b308EventDefs = [
		["ev-b308-tako-inj", "batch-b308-tako-inj", injectionStageId, null, "B308-01-01", 200, 1, 5],
		["ev-b308-ramen-dec", "batch-b308-ramen-dec", decorationStageId, subMaskSprayId, "B308-01-05", 248, 2, 3],
		["ev-b308-oni-asm", "batch-b308-oni-asm", assemblyStageId, subQualityCheckId, "B308-01-08", 200, 2, 7],
		["ev-b308-skewer-wh", "batch-b308-skewer-wh", warehouseStageId, subMainPackingId, "B308-01-11", 150, 3, 2],
	];
	for (const [key, batchKey, stageId, subStageId, partCode, qty, day, hour] of b308EventDefs) {
		const id = stableId(key);
		const batchId = stableId(batchKey);
		const modelNumber = b308BatchDefs.find((b) => b[0] === batchKey)[2];
		const lotId = b308LotIds[modelNumber];
		await tx.stageEvent.upsert({
			where: { id },
			update: {
				stageId,
				subStageId,
				batchId,
				lotId,
				partId: b308PlanPartIds[partCode],
				quantity: qty,
				occurredAt: atOffset({ days: day, hours: hour }),
				actor: planner.displayNameSnapshot ?? planner.id,
				actorSubjectId: planner.id,
				eventType: "STAGE_COMPLETED",
				status: "ACCEPTED",
				isRoutingViolation: false,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				sourceRepresentation: CLIENT_B308.formCode,
			},
			create: {
				id,
				stageId,
				subStageId,
				batchId,
				lotId,
				partId: b308PlanPartIds[partCode],
				quantity: qty,
				occurredAt: atOffset({ days: day, hours: hour }),
				actor: planner.displayNameSnapshot ?? planner.id,
				actorSubjectId: planner.id,
				eventType: "STAGE_COMPLETED",
				status: "ACCEPTED",
				isRoutingViolation: false,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				sourceRepresentation: CLIENT_B308.formCode,
			},
		});
	}
	// Open QC on B308 Takoyaki deco batch (different product in QC list)
	await tx.qualityInspection.upsert({
		where: { id: stableId("qi-b308-open-tako") },
		update: {
			batchId: stableId("batch-b308-tako-dec"),
			stageId: decorationStageId,
			subStageId: subFullSprayId,
			stationId: decorationStationId,
			inspectedQuantity: "200.000000",
			quantityUom: "piece",
			status: "IN_PROGRESS",
			inspectedBySubjectId: quality.id,
			evidence: {
				partCode: "B308-01-01",
				partName: "Takoyaki Shell",
				origin: "seed-provisional-variety",
				evidenceStatus: "PROVISIONAL",
			},
			startedAt: atOffset({ days: 2, hours: 4 }),
			completedAt: null,
		},
		create: {
			id: stableId("qi-b308-open-tako"),
			batchId: stableId("batch-b308-tako-dec"),
			stageId: decorationStageId,
			subStageId: subFullSprayId,
			stationId: decorationStationId,
			inspectedQuantity: "200.000000",
			quantityUom: "piece",
			status: "IN_PROGRESS",
			inspectedBySubjectId: quality.id,
			evidence: {
				partCode: "B308-01-01",
				partName: "Takoyaki Shell",
				origin: "seed-provisional-variety",
				evidenceStatus: "PROVISIONAL",
			},
			startedAt: atOffset({ days: 2, hours: 4 }),
		},
	});

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
		subjects: 4,
		primaryProduct: CLIENT_B251.productCode,
		secondaryProduct: CLIENT_B308.productCode,
		productName: CLIENT_B251.productName,
		secondaryProductName: CLIENT_B308.productName,
		models: CLIENT_B251.models.length + CLIENT_B308.models.length,
		injParts: injPartCount,
		decoParts: decoPartCount,
		paintParts: paintPartCount,
		capsuleAttachments: capsuleAttachmentCount,
		catalogModelParts: injPartCount + decoPartCount + paintPartCount + capsuleAttachmentCount,
		planParts: Object.keys(planPartIds).length,
		plans: 2,
		lots: lotDefs.length + b308LotDefs.length,
		batches: batchDefs.length + b308BatchDefs.length,
		stations: 8,
		workProcesses: 5,
		booths: 2,
		monitoringDailySheets: 2,
		monitoringStationBoards: 2,
		productId: productB251Id,
		secondaryProductId: productB308Id,
		projectId,
		secondaryProjectId: b308PlanId,
		openInspectionId: inspectionOpenId,
		adminUsername: `${profile}.admin`,
		evidenceNote:
			"B251 client-parts-list + B308 Street Food Friends + monitoring encode seed — PROVISIONAL, not Drive-approved",
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
