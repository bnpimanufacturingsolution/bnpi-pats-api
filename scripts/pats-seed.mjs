/**
 * Canonical PATS seed orchestrator (demo / uat).
 *
 * Synthetic development/UAT data only. Values are provisional/manual seed evidence —
 * not approved client truth. Prototype fixture shapes from bnpi-pats-app are repurposed
 * here so active screens have usable multi-lot/batch progress without localStorage.
 *
 * SEED_MODE=none|demo|uat
 * Requires PATS_DATABASE_URL and PATS_SEED_PASSWORD (12-1024 chars) for writable modes.
 */
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "../generated/pats-client/index.js";

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

function code(value) {
	return `${prefix}-${value}`;
}

/** Deterministic offsets from seedClock so re-seeds stay stable and still fall inside report windows. */
function atOffset({ days = 0, hours = 0, minutes = 0 } = {}) {
	return new Date(seedClock.getTime() + ((days * 24 + hours) * 60 + minutes) * 60_000);
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

	// Role-pure subjects plus a multi-capability admin for local full-shell smoke.
	// Planner also receives production-operator for prototype-parity line visibility
	// (demo/uat seed only — not a production RBAC policy claim).
	const planner = await upsertSubject(
		tx,
		"subject-planner",
		`${profile}.planner`,
		`${prefix} Planner`,
		["planner", "catalog-manager", "production-operator", "inventory-controller"],
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
	const admin = await upsertSubject(
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

	// ── Catalog (prototype product pack family, provisional) ─────────────────
	const productB250Id = stableId("product-b250");
	const productB251Id = stableId("product-b251");
	const model01Id = stableId("model-01");
	const model02Id = stableId("model-02");
	const modelB251M01Id = stableId("model-b251-01");
	const modelB251M02Id = stableId("model-b251-02");
	const modelPartBodyId = stableId("model-part-body");
	const modelPartAccessoryId = stableId("model-part-accessory");
	const modelPartBunId = stableId("model-part-b251-bun");
	const modelPartPattyId = stableId("model-part-b251-patty");
	const bomId = stableId("bom-revision-1");
	const bomB251Id = stableId("bom-b251-revision-1");
	const routeId = stableId("process-route-revision-1");
	const routeB251Id = stableId("process-route-b251-1");

	await tx.product.upsert({
		where: { id: productB250Id },
		update: {
			productName: `${prefix} B250 Shimajirou Accessory`,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
			rowVersion: 1,
		},
		create: {
			id: productB250Id,
			productCode: code("B250"),
			productName: `${prefix} B250 Shimajirou Accessory`,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
	});
	await tx.product.upsert({
		where: { id: productB251Id },
		update: {
			productName: `${prefix} B251 Machibouke Hamburger Shop 3`,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
			rowVersion: 1,
		},
		create: {
			id: productB251Id,
			productCode: code("B251"),
			productName: `${prefix} B251 Machibouke Hamburger Shop 3`,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
		},
	});

	for (const [id, productId, number, name] of [
		[model01Id, productB250Id, "01", "Shimajirou Blue"],
		[model02Id, productB250Id, "02", "Shimajirou Pink"],
		[modelB251M01Id, productB251Id, "01", "Avocado Burger"],
		[modelB251M02Id, productB251Id, "02", "Cheese Burger"],
	]) {
		await tx.model.upsert({
			where: { id },
			update: {
				productId,
				modelNumber: number,
				modelName: name,
				sourceStatus: "MANUAL",
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id,
				productId,
				modelNumber: number,
				modelName: name,
				sourceStatus: "MANUAL",
				sourceReference: { seedProfile: profile, evidenceStatus: "PROVISIONAL", origin: "prototype-fixture-repurpose" },
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
	}

	for (const [id, modelId, partCode, partName] of [
		[modelPartBodyId, model01Id, "B250-01-08", "Body"],
		[modelPartAccessoryId, model01Id, "B250-02-01", "Accessory"],
		[modelPartBunId, modelB251M01Id, "B251-01-01", "Avocado Burger Upper Bun"],
		[modelPartPattyId, modelB251M01Id, "B251-01-04", "Cheese & Patty"],
	]) {
		await tx.modelPart.upsert({
			where: { id },
			update: {
				modelId,
				partCode,
				partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
			},
			create: {
				id,
				modelId,
				partCode,
				partName,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
				routingSteps: [],
			},
		});
	}

	await tx.bomDefinition.upsert({
		where: { id: bomId },
		update: { modelId: model01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		create: { id: bomId, modelId: model01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
	});
	for (const [id, lineNumber, modelPartId, name] of [
		[stableId("bom-line-body"), 1, modelPartBodyId, "Body component"],
		[stableId("bom-line-accessory"), 2, modelPartAccessoryId, "Accessory component"],
	]) {
		await tx.bomLine.upsert({
			where: { id },
			update: {
				bomDefinitionId: bomId,
				modelPartId,
				lineNumber,
				relationshipKind: "COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "1 per product",
				sourceRepresentation: name,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id,
				bomDefinitionId: bomId,
				modelPartId,
				lineNumber,
				relationshipKind: "COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "1 per product",
				sourceRepresentation: name,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
	}

	await tx.bomDefinition.upsert({
		where: { id: bomB251Id },
		update: { modelId: modelB251M01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		create: { id: bomB251Id, modelId: modelB251M01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
	});
	for (const [id, lineNumber, modelPartId, name] of [
		[stableId("bom-line-b251-bun"), 1, modelPartBunId, "Upper bun"],
		[stableId("bom-line-b251-patty"), 2, modelPartPattyId, "Cheese and patty"],
	]) {
		await tx.bomLine.upsert({
			where: { id },
			update: {
				bomDefinitionId: bomB251Id,
				modelPartId,
				lineNumber,
				relationshipKind: "COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "1 per product",
				sourceRepresentation: name,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
			create: {
				id,
				bomDefinitionId: bomB251Id,
				modelPartId,
				lineNumber,
				relationshipKind: "COMPONENT",
				quantityMagnitude: 1,
				quantityUom: "piece",
				usageBasis: "1 per product",
				sourceRepresentation: name,
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
	}

	await tx.processRoute.upsert({
		where: { id: routeId },
		update: { modelId: model01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		create: { id: routeId, modelId: model01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
	});
	await tx.processRoute.upsert({
		where: { id: routeB251Id },
		update: { modelId: modelB251M01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		create: { id: routeB251Id, modelId: modelB251M01Id, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
	});

	// ── Workflow / stages (prototype Stage + SubStage vocabulary) ────────────
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

	const injectionStationId = stableId("station-injection-01");
	const decorationStationId = stableId("station-decoration-01");
	const assemblyStationId = stableId("station-assembly-01");
	const warehouseStationId = stableId("station-warehouse-01");

	await tx.workflowGroup.upsert({
		where: { id: workflowId },
		update: {
			projectId: null,
			name: `${prefix} Main Production`,
			linkageMode: "LINKED",
			displayOrder: 1,
			lifecycleStatus: "PUBLISHED",
			isSystemSeed: true,
		},
		create: {
			id: workflowId,
			projectId: null,
			name: `${prefix} Main Production`,
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

	const routeStageSeeds = [
		[stableId("route-stage-injection"), routeId, injectionStageId, null, 1, "Injection"],
		[stableId("route-stage-decoration"), routeId, decorationStageId, subFullSprayId, 2, "Decoration / Full Spray"],
		[stableId("route-stage-assembly"), routeId, assemblyStageId, subQualityCheckId, 3, "Assembly / Quality Check"],
		[stableId("route-stage-warehouse"), routeId, warehouseStageId, subMainPackingId, 4, "Warehouse / Main Packing"],
		[stableId("route-b251-injection"), routeB251Id, injectionStageId, null, 1, "Injection"],
		[stableId("route-b251-decoration"), routeB251Id, decorationStageId, subMaskSprayId, 2, "Decoration / Mask Spray"],
		[stableId("route-b251-assembly"), routeB251Id, assemblyStageId, subSubAssemblyId, 3, "Assembly / Sub-Assembly"],
	];
	for (const [id, processRouteId, stageId, subStageId, sequence, name] of routeStageSeeds) {
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
		[injectionStationId, "Injection Station 01", "ST-INJ-01", injectionStageId, 1],
		[decorationStationId, "Decoration Station 01", "ST-DEC-01", decorationStageId, 2],
		[assemblyStationId, "Assembly Station 01", "ST-ASM-01", assemblyStageId, 3],
		[warehouseStationId, "Warehouse Station 01", "ST-WH-01", warehouseStageId, 4],
	]) {
		await tx.station.upsert({
			where: { id },
			update: {
				workspaceId: "PATS",
				name: `${prefix} ${name}`,
				stationCode: code(stationCode),
				operationalContextKey: "PATS",
				stageId,
				displayOrder,
				isEnabled: true,
			},
			create: {
				id,
				workspaceId: "PATS",
				name: `${prefix} ${name}`,
				stationCode: code(stationCode),
				operationalContextKey: "PATS",
				stageId,
				displayOrder,
				isEnabled: true,
			},
		});
	}

	for (const [id, stationId, stageId, subStageId] of [
		[stableId("station-step-injection"), injectionStationId, injectionStageId, null],
		[stableId("station-step-decoration"), decorationStationId, decorationStageId, subFullSprayId],
		[stableId("station-step-qc"), assemblyStationId, assemblyStageId, subQualityCheckId],
		[stableId("station-step-warehouse"), warehouseStationId, warehouseStageId, subMainPackingId],
	]) {
		await tx.stationStep.upsert({
			where: { id },
			update: { stationId, stageId, subStageId },
			create: { id, stationId, stageId, subStageId },
		});
	}

	for (const [stageId, title, subStageId] of [
		[injectionStageId, "Injection work instruction", null],
		[decorationStageId, "Decoration spray work instruction", subFullSprayId],
		[assemblyStageId, "Assembly quality work instruction", subQualityCheckId],
		[warehouseStageId, "Warehouse packing work instruction", subMainPackingId],
	]) {
		const instructionId = stableId(`work-instruction-${stageId}`);
		await tx.workInstruction.upsert({
			where: { id: instructionId },
			update: {
				steps: [{ en: title }, { en: "Scan batch and confirm route step" }],
				status: "PUBLISHED",
				sourceRevisionRef: `${prefix}-SEED`,
			},
			create: {
				id: instructionId,
				stageId,
				subStageId,
				steps: [{ en: title }, { en: "Scan batch and confirm route step" }],
				status: "PUBLISHED",
				sourceRevisionRef: `${prefix}-SEED`,
				version: 1,
			},
		});
	}

	// ── Primary production plan (B250) — keeps stable keys from I3 ───────────
	const projectId = stableId("production-plan-001");
	const planPartBodyId = stableId("plan-part-body");
	const planPartAccessoryId = stableId("plan-part-accessory");
	const partsListId = stableId("parts-list-version-1");
	const lotId = stableId("lot-001");
	const batchId = stableId("batch-001");

	await tx.project.upsert({
		where: { id: projectId },
		update: {
			workspaceId: "PATS",
			projectCode: code("PLAN-001"),
			name: `${prefix} B250 Production Plan`,
			requiredProductionQuantity: 4320,
			status: "RELEASED",
			releasedAt: seedClock,
			releasedBySubjectId: planner.id,
			productId: productB250Id,
		},
		create: {
			id: projectId,
			workspaceId: "PATS",
			projectCode: code("PLAN-001"),
			name: `${prefix} B250 Production Plan`,
			requiredProductionQuantity: 4320,
			productId: productB250Id,
			status: "RELEASED",
			releasedAt: seedClock,
			releasedBySubjectId: planner.id,
			createdAt: seedClock,
		},
	});
	await tx.productSpecification.upsert({
		where: { projectId },
		update: {
			skuCode: code("B250-SKU"),
			productName: `${prefix} B250 Shimajirou Accessory`,
			trayQuantityStandard: 240,
			sourceRevisionRef: `${prefix}-PRODUCT-MASTER-1`,
		},
		create: {
			id: stableId("product-specification"),
			projectId,
			skuCode: code("B250-SKU"),
			productName: `${prefix} B250 Shimajirou Accessory`,
			trayQuantityStandard: 240,
			sourceRevisionRef: `${prefix}-PRODUCT-MASTER-1`,
			createdAt: seedClock,
		},
	});
	await tx.planDemandAllocation.upsert({
		where: { id: stableId("plan-demand-allocation") },
		update: {
			projectId,
			modelId: model01Id,
			marketRegion: "JP",
			demandPurpose: "production",
			quantityMagnitude: "4320.000000",
			quantityUom: "piece",
			usageBasis: "finished product",
			sourceRevisionRef: `${prefix}-DEMAND-1`,
			lifecycleStatus: "COMMITTED",
		},
		create: {
			id: stableId("plan-demand-allocation"),
			projectId,
			modelId: model01Id,
			marketRegion: "JP",
			demandPurpose: "production",
			quantityMagnitude: "4320.000000",
			quantityUom: "piece",
			usageBasis: "finished product",
			sourceRevisionRef: `${prefix}-DEMAND-1`,
			lifecycleStatus: "COMMITTED",
			createdAt: seedClock,
		},
	});
	await tx.projectModelAllocation.upsert({
		where: { projectId_modelId: { projectId, modelId: model01Id } },
		update: { plannedQuantity: 4320, quantityMagnitude: "4320.000000", quantityUom: "piece", lifecycleStatus: "COMMITTED" },
		create: {
			id: stableId("project-model-allocation-01"),
			projectId,
			modelId: model01Id,
			plannedQuantity: 4320,
			quantityMagnitude: "4320.000000",
			quantityUom: "piece",
			lifecycleStatus: "COMMITTED",
		},
	});

	for (const [id, codeValue, name, modelPartId] of [
		[planPartBodyId, "B250-01-08", "Body", modelPartBodyId],
		[planPartAccessoryId, "B250-02-01", "Accessory", modelPartAccessoryId],
	]) {
		await tx.part.upsert({
			where: { id },
			update: {
				projectId,
				partCode: codeValue,
				partName: name,
				sourceModelId: model01Id,
				sourceModelPartId: modelPartId,
				lifecycleStatus: "PUBLISHED",
				variancePercentThreshold: 0.05,
			},
			create: {
				id,
				projectId,
				partCode: codeValue,
				partName: name,
				sourceModelId: model01Id,
				sourceModelPartId: modelPartId,
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
			sourceRevisionRef: `${prefix}-PARTS-LIST-1`,
			publishedAt: seedClock,
		},
		create: {
			id: partsListId,
			projectId,
			version: 1,
			status: "PUBLISHED",
			sourceRevisionRef: `${prefix}-PARTS-LIST-1`,
			publishedAt: seedClock,
			createdAt: seedClock,
		},
	});

	for (const [id, partId, stageId, subStageId, stepOrder] of [
		[stableId("route-step-body-injection"), planPartBodyId, injectionStageId, null, 1],
		[stableId("route-step-body-decoration"), planPartBodyId, decorationStageId, subFullSprayId, 2],
		[stableId("route-step-body-assembly"), planPartBodyId, assemblyStageId, subQualityCheckId, 3],
		[stableId("route-step-body-warehouse"), planPartBodyId, warehouseStageId, subMainPackingId, 4],
		[stableId("route-step-accessory-injection"), planPartAccessoryId, injectionStageId, null, 1],
		[stableId("route-step-accessory-decoration"), planPartAccessoryId, decorationStageId, subMaskSprayId, 2],
		[stableId("route-step-accessory-assembly"), planPartAccessoryId, assemblyStageId, subAssortmentId, 3],
	]) {
		await tx.routingStep.upsert({
			where: { id },
			update: { partsListId, partId, stageId, subStageId, stepOrder },
			create: { id, partsListId, partId, stageId, subStageId, stepOrder },
		});
	}

	await tx.pmrs.upsert({
		where: { projectId },
		update: {
			partsListId,
			externalControlNumber: `${prefix}-PMRS-001`,
			revisionLabel: "01",
			status: "attached",
			sourceReference: { seedProfile: profile, evidenceStatus: "PROVISIONAL" },
		},
		create: {
			id: stableId("pmrs-reference"),
			projectId,
			partsListId,
			externalControlNumber: `${prefix}-PMRS-001`,
			revisionLabel: "01",
			status: "attached",
			sourceReference: { seedProfile: profile, evidenceStatus: "PROVISIONAL" },
		},
	});
	await tx.materialRequirement.upsert({
		where: { id: stableId("material-requirement-body") },
		update: {
			projectId,
			partId: planPartBodyId,
			externalReference: `${prefix}-PMRS-001-L01`,
			quantityMagnitude: "4320.000000",
			quantityUom: "piece",
			usageBasis: "1 per product",
			sourceRevisionRef: `${prefix}-PMRS-001`,
			status: "APPROVED",
		},
		create: {
			id: stableId("material-requirement-body"),
			projectId,
			partId: planPartBodyId,
			externalReference: `${prefix}-PMRS-001-L01`,
			quantityMagnitude: "4320.000000",
			quantityUom: "piece",
			usageBasis: "1 per product",
			sourceRevisionRef: `${prefix}-PMRS-001`,
			status: "APPROVED",
			createdAt: seedClock,
		},
	});

	// Lots — primary + supplemental (prototype multi-lot pattern)
	const lot2Id = stableId("lot-002");
	const lot3Id = stableId("lot-003");
	const lot1BodyAllocId = stableId("lot-allocation-body");
	const lot1AccAllocId = stableId("lot-allocation-accessory");
	const lot2BodyAlloc = stableId("lot-allocation-lot-002-body");
	const lot3BodyAlloc = stableId("lot-allocation-lot-003-body");

	const lotSeeds = [
		[lotId, "LOT-001", `${prefix} B250 Lot 001`, 4320, "ACTIVE"],
		[lot2Id, "LOT-002", `${prefix} B250 Lot 002`, 1800, "ACTIVE"],
		[lot3Id, "LOT-003", `${prefix} B250 Lot 003`, 1500, "ACTIVE"],
	];
	for (const [id, lotCode, lotName, qty, status] of lotSeeds) {
		await tx.lot.upsert({
			where: { id },
			update: {
				projectId,
				lotCode: code(lotCode),
				lotName,
				partsListId,
				partsListVersion: 1,
				partId: planPartBodyId,
				partName: "Body",
				requiredProductionQuantity: qty,
				status,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				labelPackSize: 240,
				createdAtStage: "Planning",
			},
			create: {
				id,
				projectId,
				lotCode: code(lotCode),
				lotName,
				partsListId,
				partsListVersion: 1,
				partId: planPartBodyId,
				partName: "Body",
				requiredProductionQuantity: qty,
				status,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				labelPackSize: 240,
				createdAtStage: "Planning",
				createdAt: seedClock,
			},
		});
	}

	// Explicit allocation ids used by batch part lines (must match FK targets below).
	const allocationSeeds = [
		[lot1BodyAllocId, lotId, planPartBodyId, "4320.000000"],
		[lot1AccAllocId, lotId, planPartAccessoryId, "4320.000000"],
		[lot2BodyAlloc, lot2Id, planPartBodyId, "1800.000000"],
		[lot3BodyAlloc, lot3Id, planPartBodyId, "1500.000000"],
	];
	for (const [allocId, allocLotId, partId, quantity] of allocationSeeds) {
		await tx.lotPartAllocation.upsert({
			where: { lotId_partId: { lotId: allocLotId, partId } },
			update: {
				quantityMagnitude: quantity,
				quantityUom: "piece",
				usageBasis: "1 per product",
				status: "COMMITTED",
			},
			create: {
				id: allocId,
				lotId: allocLotId,
				partId,
				quantityMagnitude: quantity,
				quantityUom: "piece",
				usageBasis: "1 per product",
				status: "COMMITTED",
				createdAt: seedClock,
			},
		});
	}

	const batchSeeds = [
		// key, code, lot, qty, stage, sub, alloc, status
		[batchId, "BATCH-001", lotId, 500, decorationStageId, subFullSprayId, lot1BodyAllocId, "ACTIVE"],
		[stableId("batch-002"), "BATCH-002", lotId, 480, injectionStageId, null, lot1BodyAllocId, "ACTIVE"],
		[stableId("batch-003"), "BATCH-003", lotId, 460, assemblyStageId, subQualityCheckId, lot1BodyAllocId, "ACTIVE"],
		[stableId("batch-004"), "BATCH-004", lot2Id, 320, injectionStageId, null, lot2BodyAlloc, "ACTIVE"],
		[stableId("batch-005"), "BATCH-005", lot2Id, 280, decorationStageId, subMaskSprayId, lot2BodyAlloc, "ACTIVE"],
		[stableId("batch-006"), "BATCH-006", lot2Id, 240, assemblyStageId, subSubAssemblyId, lot2BodyAlloc, "ACTIVE"],
		[stableId("batch-007"), "BATCH-007", lot3Id, 300, decorationStageId, subTampoId, lot3BodyAlloc, "ACTIVE"],
		[stableId("batch-008"), "BATCH-008", lot3Id, 260, warehouseStageId, subMainPackingId, lot3BodyAlloc, "ACTIVE"],
		[stableId("batch-009"), "BATCH-009", lotId, 240, warehouseStageId, subMainPackingId, lot1BodyAllocId, "CLOSED"],
	];

	for (const [id, batchCode, lot, qty, stageId, subStageId, allocId, status] of batchSeeds) {
		await tx.batch.upsert({
			where: { id },
			update: {
				batchCode: code(batchCode),
				barcodeValue: code(batchCode),
				lotId: lot,
				plannedQuantity: qty,
				labelPackSize: 240,
				currentStageId: stageId,
				currentSubStageId: subStageId,
				status,
				createdBySubjectId: operator.id,
			},
			create: {
				id,
				batchCode: code(batchCode),
				barcodeValue: code(batchCode),
				lotId: lot,
				plannedQuantity: qty,
				labelPackSize: 240,
				currentStageId: stageId,
				currentSubStageId: subStageId,
				status,
				createdBySubjectId: operator.id,
				createdAt: seedClock,
			},
		});
		await tx.batchPartLine.upsert({
			where: { batchId_partId: { batchId: id, partId: planPartBodyId } },
			update: {
				quantity: qty,
				lotPartAllocationId: allocId,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
			},
			create: {
				batchId: id,
				partId: planPartBodyId,
				quantity: qty,
				lotPartAllocationId: allocId,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
			},
		});
	}

	// Stage events + positions for dashboard activity / throughput (spread across seed week)
	const eventSeeds = [
		[stableId("stage-event-injection"), batchId, injectionStageId, null, 500, 0, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-decoration"), batchId, decorationStageId, subFullSprayId, 495, 0, 5, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-violation"), batchId, assemblyStageId, null, 500, 0, 6, "STAGE_SCAN_RECORDED", "BLOCKED", true],
		[stableId("stage-event-b2-inj"), stableId("batch-002"), injectionStageId, null, 480, 1, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-b3-qc"), stableId("batch-003"), assemblyStageId, subQualityCheckId, 460, 1, 3, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-b4-inj"), stableId("batch-004"), injectionStageId, null, 320, 1, 4, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-b5-dec"), stableId("batch-005"), decorationStageId, subMaskSprayId, 280, 2, 1, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-b6-asm"), stableId("batch-006"), assemblyStageId, subSubAssemblyId, 240, 2, 2, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-b7-dec"), stableId("batch-007"), decorationStageId, subTampoId, 300, 2, 3, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-b8-wh"), stableId("batch-008"), warehouseStageId, subMainPackingId, 260, 2, 4, "STAGE_COMPLETED", "ACCEPTED", false],
		[stableId("stage-event-b9-wh"), stableId("batch-009"), warehouseStageId, subMainPackingId, 240, 2, 5, "STAGE_COMPLETED", "ACCEPTED", false],
	];

	for (const [id, eventBatchId, stageId, subStageId, qty, day, hour, eventType, status, isViolation] of eventSeeds) {
		const lotForBatch = batchSeeds.find((b) => b[0] === eventBatchId)?.[2] ?? lotId;
		await tx.stageEvent.upsert({
			where: { id },
			update: {
				stageId,
				subStageId,
				batchId: eventBatchId,
				lotId: lotForBatch,
				partId: planPartBodyId,
				quantity: qty,
				occurredAt: atOffset({ days: day, hours: hour }),
				actor: operator.displayNameSnapshot ?? operator.id,
				actorSubjectId: operator.id,
				eventType,
				status,
				isRoutingViolation: isViolation,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				sourceRepresentation: `${prefix}-SEED`,
			},
			create: {
				id,
				stageId,
				subStageId,
				batchId: eventBatchId,
				lotId: lotForBatch,
				partId: planPartBodyId,
				quantity: qty,
				occurredAt: atOffset({ days: day, hours: hour }),
				actor: operator.displayNameSnapshot ?? operator.id,
				actorSubjectId: operator.id,
				eventType,
				status,
				isRoutingViolation: isViolation,
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				sourceRepresentation: `${prefix}-SEED`,
			},
		});
	}

	const violationEventId = stableId("stage-event-violation");
	await tx.routingViolation.upsert({
		where: { stageEventId: violationEventId },
		update: {
			batchId,
			lotId,
			partId: planPartBodyId,
			attemptedStageId: assemblyStageId,
			attemptedSubStageId: null,
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
			id: stableId("routing-violation-001"),
			stageEventId: violationEventId,
			batchId,
			lotId,
			partId: planPartBodyId,
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

	// Inventory transactions (receiving + issuance patterns from fixtures)
	const inventorySeeds = [
		[stableId("inventory-issuance-001"), "ISSUANCE", batchId, injectionStageId, decorationStageId, 500, 495, 0, 4],
		[stableId("inventory-receiving-001"), "RECEIVING", stableId("batch-002"), null, injectionStageId, 480, 480, 0, 3],
		[stableId("inventory-issuance-002"), "ISSUANCE", stableId("batch-005"), injectionStageId, decorationStageId, 280, 275, 1, 2],
		[stableId("inventory-receiving-002"), "RECEIVING", stableId("batch-004"), null, injectionStageId, 320, 318, 1, 1],
		[stableId("inventory-issuance-003"), "ISSUANCE", stableId("batch-008"), assemblyStageId, warehouseStageId, 260, 260, 2, 2],
	];
	for (const [id, type, invBatchId, fromStageId, toStageId, expected, actual, day, hour] of inventorySeeds) {
		const lotForBatch = batchSeeds.find((b) => b[0] === invBatchId)?.[2] ?? lotId;
		await tx.inventoryTransaction.upsert({
			where: { id },
			update: {
				transactionType: type,
				batchId: invBatchId,
				partId: planPartBodyId,
				lotId: lotForBatch,
				fromStageId,
				toStageId,
				expectedQuantity: expected,
				actualQuantity: actual,
				expectedQuantityMagnitude: `${expected}.000000`,
				actualQuantityMagnitude: `${actual}.000000`,
				quantityUom: "piece",
				usageBasis: "1 per product",
				withdrawalFormRef: type === "ISSUANCE" ? `${prefix}-WITHDRAWAL-${id.slice(0, 4)}` : null,
				recordedAt: atOffset({ days: day, hours: hour }),
				recordedBy: operator.displayNameSnapshot ?? operator.id,
				recordedBySubjectId: operator.id,
				status: "ACCEPTED",
				sourceRepresentation: `${prefix}-SEED`,
			},
			create: {
				id,
				transactionType: type,
				batchId: invBatchId,
				partId: planPartBodyId,
				lotId: lotForBatch,
				fromStageId,
				toStageId,
				expectedQuantity: expected,
				actualQuantity: actual,
				expectedQuantityMagnitude: `${expected}.000000`,
				actualQuantityMagnitude: `${actual}.000000`,
				quantityUom: "piece",
				usageBasis: "1 per product",
				withdrawalFormRef: type === "ISSUANCE" ? `${prefix}-WITHDRAWAL-${id.slice(0, 4)}` : null,
				recordedAt: atOffset({ days: day, hours: hour }),
				recordedBy: operator.displayNameSnapshot ?? operator.id,
				recordedBySubjectId: operator.id,
				status: "ACCEPTED",
				sourceRepresentation: `${prefix}-SEED`,
			},
		});
	}

	// Batch position projections for every active batch
	for (const [id, , , qty, stageId, subStageId, , status] of batchSeeds) {
		if (status === "CLOSED") continue;
		const lastEvent = eventSeeds.find((e) => e[1] === id && e[7] === "ACCEPTED");
		await tx.batchPositionProjection.upsert({
			where: { batchId: id },
			update: {
				stageId,
				subStageId,
				lastEventId: lastEvent?.[0] ?? null,
				positionStatus: "ACCEPTED",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				projectionVersion: 1,
			},
			create: {
				batchId: id,
				stageId,
				subStageId,
				lastEventId: lastEvent?.[0] ?? null,
				positionStatus: "ACCEPTED",
				quantityMagnitude: `${qty}.000000`,
				quantityUom: "piece",
				projectionVersion: 1,
			},
		});
	}

	// Quality: keep completed HOLD sample + open IN_PROGRESS inspection for QC worklist
	const inspectionId = stableId("quality-inspection-001");
	const openInspectionId = stableId("quality-inspection-open");
	await tx.qualityInspection.upsert({
		where: { id: inspectionId },
		update: {
			batchId,
			stageId: assemblyStageId,
			subStageId: subQualityCheckId,
			stationId: assemblyStationId,
			inspectedQuantity: "495.000000",
			quantityUom: "piece",
			status: "COMPLETED",
			inspectedBySubjectId: quality.id,
			evidence: { seedProfile: profile, evidenceStatus: "PROVISIONAL" },
			startedAt: atOffset({ hours: 6, minutes: 30 }),
			completedAt: atOffset({ hours: 6, minutes: 45 }),
		},
		create: {
			id: inspectionId,
			batchId,
			stageId: assemblyStageId,
			subStageId: subQualityCheckId,
			stationId: assemblyStationId,
			inspectedQuantity: "495.000000",
			quantityUom: "piece",
			status: "COMPLETED",
			inspectedBySubjectId: quality.id,
			evidence: { seedProfile: profile, evidenceStatus: "PROVISIONAL" },
			startedAt: atOffset({ hours: 6, minutes: 30 }),
			completedAt: atOffset({ hours: 6, minutes: 45 }),
		},
	});
	await tx.qualityDecision.upsert({
		where: { id: stableId("quality-decision-001") },
		update: {
			inspectionId,
			decision: "HOLD",
			reasonCode: "ROUTING_REVIEW",
			reasonNote: "Seeded evidence requires routing review before release.",
			decidedBySubjectId: quality.id,
			decidedAt: atOffset({ hours: 6, minutes: 45 }),
		},
		create: {
			id: stableId("quality-decision-001"),
			inspectionId,
			decision: "HOLD",
			reasonCode: "ROUTING_REVIEW",
			reasonNote: "Seeded evidence requires routing review before release.",
			decidedBySubjectId: quality.id,
			decidedAt: atOffset({ hours: 6, minutes: 45 }),
		},
	});
	await tx.qualityInspection.upsert({
		where: { id: openInspectionId },
		update: {
			batchId: stableId("batch-003"),
			stageId: assemblyStageId,
			subStageId: subQualityCheckId,
			stationId: assemblyStationId,
			inspectedQuantity: "460.000000",
			quantityUom: "piece",
			status: "IN_PROGRESS",
			inspectedBySubjectId: quality.id,
			evidence: { seedProfile: profile, evidenceStatus: "PROVISIONAL" },
			startedAt: atOffset({ days: 1, hours: 3 }),
			completedAt: null,
		},
		create: {
			id: openInspectionId,
			batchId: stableId("batch-003"),
			stageId: assemblyStageId,
			subStageId: subQualityCheckId,
			stationId: assemblyStationId,
			inspectedQuantity: "460.000000",
			quantityUom: "piece",
			status: "IN_PROGRESS",
			inspectedBySubjectId: quality.id,
			evidence: { seedProfile: profile, evidenceStatus: "PROVISIONAL" },
			startedAt: atOffset({ days: 1, hours: 3 }),
		},
	});

	// Secondary plan (B251) for multi-product planning desk
	const projectB251Id = stableId("production-plan-b251");
	const planPartBunId = stableId("plan-part-b251-bun");
	const partsListB251Id = stableId("parts-list-b251-v1");
	const lotB251Id = stableId("lot-b251-001");
	const batchB251Id = stableId("batch-b251-001");

	await tx.project.upsert({
		where: { id: projectB251Id },
		update: {
			workspaceId: "PATS",
			projectCode: code("PLAN-B251"),
			name: `${prefix} B251 Hamburger Shop Plan`,
			requiredProductionQuantity: 2400,
			status: "RELEASED",
			releasedAt: seedClock,
			releasedBySubjectId: planner.id,
			productId: productB251Id,
		},
		create: {
			id: projectB251Id,
			workspaceId: "PATS",
			projectCode: code("PLAN-B251"),
			name: `${prefix} B251 Hamburger Shop Plan`,
			requiredProductionQuantity: 2400,
			productId: productB251Id,
			status: "RELEASED",
			releasedAt: seedClock,
			releasedBySubjectId: planner.id,
			createdAt: seedClock,
		},
	});
	await tx.part.upsert({
		where: { id: planPartBunId },
		update: {
			projectId: projectB251Id,
			partCode: "B251-01-01",
			partName: "Avocado Burger Upper Bun",
			sourceModelId: modelB251M01Id,
			sourceModelPartId: modelPartBunId,
			lifecycleStatus: "PUBLISHED",
			variancePercentThreshold: 0.05,
		},
		create: {
			id: planPartBunId,
			projectId: projectB251Id,
			partCode: "B251-01-01",
			partName: "Avocado Burger Upper Bun",
			sourceModelId: modelB251M01Id,
			sourceModelPartId: modelPartBunId,
			lifecycleStatus: "PUBLISHED",
			variancePercentThreshold: 0.05,
		},
	});
	await tx.partsList.upsert({
		where: { id: partsListB251Id },
		update: {
			projectId: projectB251Id,
			version: 1,
			status: "PUBLISHED",
			sourceRevisionRef: `${prefix}-PARTS-LIST-B251`,
			publishedAt: seedClock,
		},
		create: {
			id: partsListB251Id,
			projectId: projectB251Id,
			version: 1,
			status: "PUBLISHED",
			sourceRevisionRef: `${prefix}-PARTS-LIST-B251`,
			publishedAt: seedClock,
			createdAt: seedClock,
		},
	});
	await tx.routingStep.upsert({
		where: { id: stableId("route-step-b251-inj") },
		update: {
			partsListId: partsListB251Id,
			partId: planPartBunId,
			stageId: injectionStageId,
			subStageId: null,
			stepOrder: 1,
		},
		create: {
			id: stableId("route-step-b251-inj"),
			partsListId: partsListB251Id,
			partId: planPartBunId,
			stageId: injectionStageId,
			subStageId: null,
			stepOrder: 1,
		},
	});
	await tx.lot.upsert({
		where: { id: lotB251Id },
		update: {
			projectId: projectB251Id,
			lotCode: code("LOT-B251-001"),
			lotName: `${prefix} B251 Lot 001`,
			partsListId: partsListB251Id,
			partsListVersion: 1,
			partId: planPartBunId,
			partName: "Avocado Burger Upper Bun",
			requiredProductionQuantity: 2400,
			status: "ACTIVE",
			quantityMagnitude: "2400.000000",
			quantityUom: "piece",
			labelPackSize: 240,
			createdAtStage: "Planning",
		},
		create: {
			id: lotB251Id,
			projectId: projectB251Id,
			lotCode: code("LOT-B251-001"),
			lotName: `${prefix} B251 Lot 001`,
			partsListId: partsListB251Id,
			partsListVersion: 1,
			partId: planPartBunId,
			partName: "Avocado Burger Upper Bun",
			requiredProductionQuantity: 2400,
			status: "ACTIVE",
			quantityMagnitude: "2400.000000",
			quantityUom: "piece",
			labelPackSize: 240,
			createdAtStage: "Planning",
			createdAt: seedClock,
		},
	});
	const lotB251Alloc = stableId("lot-allocation-b251-bun");
	await tx.lotPartAllocation.upsert({
		where: { lotId_partId: { lotId: lotB251Id, partId: planPartBunId } },
		update: { quantityMagnitude: "2400.000000", quantityUom: "piece", status: "COMMITTED" },
		create: {
			id: lotB251Alloc,
			lotId: lotB251Id,
			partId: planPartBunId,
			quantityMagnitude: "2400.000000",
			quantityUom: "piece",
			usageBasis: "1 per product",
			status: "COMMITTED",
			createdAt: seedClock,
		},
	});
	await tx.batch.upsert({
		where: { id: batchB251Id },
		update: {
			batchCode: code("BATCH-B251-001"),
			barcodeValue: code("BATCH-B251-001"),
			lotId: lotB251Id,
			plannedQuantity: 360,
			labelPackSize: 240,
			currentStageId: injectionStageId,
			status: "ACTIVE",
			createdBySubjectId: operator.id,
		},
		create: {
			id: batchB251Id,
			batchCode: code("BATCH-B251-001"),
			barcodeValue: code("BATCH-B251-001"),
			lotId: lotB251Id,
			plannedQuantity: 360,
			labelPackSize: 240,
			currentStageId: injectionStageId,
			status: "ACTIVE",
			createdBySubjectId: operator.id,
			createdAt: seedClock,
		},
	});
	await tx.batchPartLine.upsert({
		where: { batchId_partId: { batchId: batchB251Id, partId: planPartBunId } },
		update: {
			quantity: 360,
			lotPartAllocationId: lotB251Alloc,
			quantityMagnitude: "360.000000",
			quantityUom: "piece",
		},
		create: {
			batchId: batchB251Id,
			partId: planPartBunId,
			quantity: 360,
			lotPartAllocationId: lotB251Alloc,
			quantityMagnitude: "360.000000",
			quantityUom: "piece",
		},
	});
	await tx.batchPositionProjection.upsert({
		where: { batchId: batchB251Id },
		update: {
			stageId: injectionStageId,
			positionStatus: "ACCEPTED",
			quantityMagnitude: "360.000000",
			quantityUom: "piece",
			projectionVersion: 1,
		},
		create: {
			batchId: batchB251Id,
			stageId: injectionStageId,
			positionStatus: "ACCEPTED",
			quantityMagnitude: "360.000000",
			quantityUom: "piece",
			projectionVersion: 1,
		},
	});
	await tx.stageEvent.upsert({
		where: { id: stableId("stage-event-b251-inj") },
		update: {
			stageId: injectionStageId,
			batchId: batchB251Id,
			lotId: lotB251Id,
			partId: planPartBunId,
			quantity: 360,
			occurredAt: atOffset({ days: 2, hours: 2 }),
			actor: operator.displayNameSnapshot ?? operator.id,
			actorSubjectId: operator.id,
			eventType: "STAGE_COMPLETED",
			status: "ACCEPTED",
			quantityMagnitude: "360.000000",
			quantityUom: "piece",
			sourceRepresentation: `${prefix}-SEED`,
		},
		create: {
			id: stableId("stage-event-b251-inj"),
			stageId: injectionStageId,
			batchId: batchB251Id,
			lotId: lotB251Id,
			partId: planPartBunId,
			quantity: 360,
			occurredAt: atOffset({ days: 2, hours: 2 }),
			actor: operator.displayNameSnapshot ?? operator.id,
			actorSubjectId: operator.id,
			eventType: "STAGE_COMPLETED",
			status: "ACCEPTED",
			quantityMagnitude: "360.000000",
			quantityUom: "piece",
			sourceRepresentation: `${prefix}-SEED`,
		},
	});

	await tx.auditRecord.upsert({
		where: { id: stableId("audit-seed-release") },
		update: {
			actorSubjectId: planner.id,
			action: "seed.release-plan",
			resourceType: "ProductionPlan",
			resourceId: projectId,
			outcome: "SUCCESS",
			correlationId: `${prefix}-SEED`,
			detail: { seedProfile: profile, evidenceStatus: "PROVISIONAL", origin: "prototype-fixture-repurpose" },
			occurredAt: seedClock,
		},
		create: {
			id: stableId("audit-seed-release"),
			actorSubjectId: planner.id,
			action: "seed.release-plan",
			resourceType: "ProductionPlan",
			resourceId: projectId,
			outcome: "SUCCESS",
			correlationId: `${prefix}-SEED`,
			detail: { seedProfile: profile, evidenceStatus: "PROVISIONAL", origin: "prototype-fixture-repurpose" },
			occurredAt: seedClock,
		},
	});
	await tx.outboxMessage.upsert({
		where: { id: stableId("outbox-seed-plan-released") },
		update: {
			aggregateType: "ProductionPlan",
			aggregateId: projectId,
			eventType: "production-plan.released",
			schemaVersion: 1,
			payload: { planId: projectId, seedProfile: profile },
			status: "PENDING",
			availableAt: seedClock,
			attempts: 0,
			lastError: null,
			publishedAt: null,
		},
		create: {
			id: stableId("outbox-seed-plan-released"),
			aggregateType: "ProductionPlan",
			aggregateId: projectId,
			eventType: "production-plan.released",
			schemaVersion: 1,
			payload: { planId: projectId, seedProfile: profile },
			status: "PENDING",
			availableAt: seedClock,
			attempts: 0,
		},
	});

	return {
		profile,
		subjects: 4,
		products: 2,
		plans: 2,
		lots: 4,
		batches: batchSeeds.length + 1,
		productId: productB250Id,
		projectId,
		lotId,
		batchId,
		violationEventId,
		inspectionId,
		openInspectionId,
		adminUsername: `${profile}.admin`,
	};
}

try {
	const result = await prisma.$transaction((tx) => seedProfile(tx), {
		maxWait: 20_000,
		timeout: 120_000,
	});
	console.log(`Seeded PATS ${result.profile} profile: ${JSON.stringify(result)}`);
} finally {
	await prisma.$disconnect();
}
