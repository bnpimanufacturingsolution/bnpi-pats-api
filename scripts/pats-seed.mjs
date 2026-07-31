/**
 * Canonical PATS seed orchestrator (demo / uat).
 *
 * Primary catalog/plan material is drawn from client parts-list evidence for
 * B251 Machibouke Hamburger Shop 3 (Rev 6.0) — see pats-seed-client-b251.mjs.
 * Values remain PROVISIONAL seed evidence, not Drive-approved publication.
 *
 * SEED_MODE=none|demo|uat
 * Requires PATS_DATABASE_URL and PATS_SEED_PASSWORD (12-1024 chars) for writable modes.
 */
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "../generated/pats-client/index.js";
import { CLIENT_B251 } from "./pats-seed-client-b251.mjs";

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
	const injectionStationId = stableId("station-injection-01");
	const decorationStationId = stableId("station-decoration-01");
	const assemblyStationId = stableId("station-assembly-01");
	const warehouseStationId = stableId("station-warehouse-01");

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
		[injectionStationId, "Injection Station 01", "ST-INJ-01", injectionStageId, 1],
		[decorationStationId, "Decoration Station 01", "ST-DEC-01", decorationStageId, 2],
		[assemblyStationId, "Assembly Station 01", "ST-ASM-01", assemblyStageId, 3],
		[warehouseStationId, "Warehouse Station 01", "ST-WH-01", warehouseStageId, 4],
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
		[stableId("station-step-inj"), injectionStationId, injectionStageId, null],
		[stableId("station-step-dec"), decorationStationId, decorationStageId, subFullSprayId],
		[stableId("station-step-qc"), assemblyStationId, assemblyStageId, subQualityCheckId],
		[stableId("station-step-wh"), warehouseStationId, warehouseStageId, subMainPackingId],
	]) {
		await tx.stationStep.upsert({
			where: { id },
			update: { stationId, stageId, subStageId },
			create: { id, stationId, stageId, subStageId },
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

	// Snapshot plan parts from catalog model parts (all B251 parts)
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

	// Lots: one active lot per major model family
	const lotDefs = [
		["lot-avocado", "LOT-B251-01", "B251 Avocado Burger — Lot 01", "01", 1440],
		["lot-hotdog", "LOT-B251-02", "B251 Cheese Hotdog — Lot 01", "02", 720],
		["lot-tacos", "LOT-B251-03", "B251 Tacos — Lot 01", "03", 720],
		["lot-fries", "LOT-B251-04", "B251 Potato Wedge — Lot 01", "04", 480],
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

	// Batches — factory-style codes, WIP across stages
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

	// QC: completed HOLD + open inspection on Avocado QC batch
	const inspectionDoneId = stableId("qi-b251-hold");
	const inspectionOpenId = stableId("qi-b251-open");
	await tx.qualityInspection.upsert({
		where: { id: inspectionDoneId },
		update: {
			batchId: batchIds["batch-av-qc"],
			stageId: assemblyStageId,
			subStageId: subQualityCheckId,
			stationId: assemblyStationId,
			inspectedQuantity: "480.000000",
			quantityUom: "piece",
			status: "COMPLETED",
			inspectedBySubjectId: quality.id,
			evidence: {
				partCode: "B251-01-04",
				partName: "Cheese & Patty",
				origin: "client-parts-list",
				evidenceStatus: "PROVISIONAL",
			},
			startedAt: atOffset({ hours: 6, minutes: 30 }),
			completedAt: atOffset({ hours: 6, minutes: 45 }),
		},
		create: {
			id: inspectionDoneId,
			batchId: batchIds["batch-av-qc"],
			stageId: assemblyStageId,
			subStageId: subQualityCheckId,
			stationId: assemblyStationId,
			inspectedQuantity: "480.000000",
			quantityUom: "piece",
			status: "COMPLETED",
			inspectedBySubjectId: quality.id,
			evidence: {
				partCode: "B251-01-04",
				partName: "Cheese & Patty",
				origin: "client-parts-list",
				evidenceStatus: "PROVISIONAL",
			},
			startedAt: atOffset({ hours: 6, minutes: 30 }),
			completedAt: atOffset({ hours: 6, minutes: 45 }),
		},
	});
	await tx.qualityDecision.upsert({
		where: { id: stableId("qd-b251-hold") },
		update: {
			inspectionId: inspectionDoneId,
			decision: "HOLD",
			reasonCode: "ROUTING_REVIEW",
			reasonNote: "Batch advanced to Assembly without Decoration completion evidence.",
			decidedBySubjectId: quality.id,
			decidedAt: atOffset({ hours: 6, minutes: 45 }),
		},
		create: {
			id: stableId("qd-b251-hold"),
			inspectionId: inspectionDoneId,
			decision: "HOLD",
			reasonCode: "ROUTING_REVIEW",
			reasonNote: "Batch advanced to Assembly without Decoration completion evidence.",
			decidedBySubjectId: quality.id,
			decidedAt: atOffset({ hours: 6, minutes: 45 }),
		},
	});
	await tx.qualityInspection.upsert({
		where: { id: inspectionOpenId },
		update: {
			batchId: batchIds["batch-tc-asm"],
			stageId: assemblyStageId,
			subStageId: subAssortmentId,
			stationId: assemblyStationId,
			inspectedQuantity: "360.000000",
			quantityUom: "piece",
			status: "IN_PROGRESS",
			inspectedBySubjectId: quality.id,
			evidence: {
				partCode: "B251-01-12",
				partName: "Right Taco",
				origin: "client-parts-list",
				evidenceStatus: "PROVISIONAL",
			},
			startedAt: atOffset({ days: 1, hours: 3 }),
			completedAt: null,
		},
		create: {
			id: inspectionOpenId,
			batchId: batchIds["batch-tc-asm"],
			stageId: assemblyStageId,
			subStageId: subAssortmentId,
			stationId: assemblyStationId,
			inspectedQuantity: "360.000000",
			quantityUom: "piece",
			status: "IN_PROGRESS",
			inspectedBySubjectId: quality.id,
			evidence: {
				partCode: "B251-01-12",
				partName: "Right Taco",
				origin: "client-parts-list",
				evidenceStatus: "PROVISIONAL",
			},
			startedAt: atOffset({ days: 1, hours: 3 }),
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

	return {
		profile,
		subjects: 4,
		primaryProduct: CLIENT_B251.productCode,
		productName: CLIENT_B251.productName,
		models: CLIENT_B251.models.length,
		parts: Object.keys(partIds).length,
		plans: 1,
		lots: lotDefs.length,
		batches: batchDefs.length,
		productId: productB251Id,
		projectId,
		openInspectionId: inspectionOpenId,
		adminUsername: `${profile}.admin`,
		evidenceNote: "B251 client-parts-list Rev 6.0 — PROVISIONAL seed, not Drive-approved",
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
