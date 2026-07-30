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
	const planner = await upsertSubject(tx, "subject-planner", `${profile}.planner`, `${prefix} Planner`, ["planner", "catalog-manager"], passwordHash);
	const operator = await upsertSubject(tx, "subject-operator", `${profile}.operator`, `${prefix} Operator`, ["production-operator", "inventory-controller"], passwordHash);
	const quality = await upsertSubject(tx, "subject-quality", `${profile}.quality`, `${prefix} Quality`, ["quality-reviewer"], passwordHash);

	const productId = stableId("product-b250");
	const modelId = stableId("model-01");
	const modelTwoId = stableId("model-02");
	const modelPartBodyId = stableId("model-part-body");
	const modelPartAccessoryId = stableId("model-part-accessory");
	const bomId = stableId("bom-revision-1");
	const routeId = stableId("process-route-revision-1");
	const workflowId = stableId("workflow-main-production");
	const injectionStageId = stableId("stage-injection");
	const decorationStageId = stableId("stage-decoration");
	const assemblyStageId = stableId("stage-assembly");
	const qcSubStageId = stableId("substage-quality-check");
	const injectionStationId = stableId("station-injection-01");
	const decorationStationId = stableId("station-decoration-01");
	const assemblyStationId = stableId("station-assembly-01");

	await tx.product.upsert({
		where: { id: productId },
		update: { productName: `${prefix} B250 Shimajirou Accessory`, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", rowVersion: 1 },
		create: {
			id: productId,
			productCode: code("B250"),
			productName: `${prefix} B250 Shimajirou Accessory`,
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
			sourceReference: undefined,
		},
	});

	for (const [id, number, name] of [
		[modelId, "01", "Shimajirou Blue"],
		[modelTwoId, "02", "Shimajirou Pink"],
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
				sourceReference: { seedProfile: profile, evidenceStatus: "PROVISIONAL" },
				lifecycleStatus: "PUBLISHED",
				evidenceStatus: "PROVISIONAL",
			},
		});
	}

	await tx.modelPart.upsert({
		where: { id: modelPartBodyId },
		update: { modelId, partCode: "B250-01-08", partName: "Body", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
		create: {
			id: modelPartBodyId,
			modelId,
			partCode: "B250-01-08",
			partName: "Body",
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
			routingSteps: [],
		},
	});
	await tx.modelPart.upsert({
		where: { id: modelPartAccessoryId },
		update: { modelId, partCode: "B250-02-01", partName: "Accessory", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
		create: {
			id: modelPartAccessoryId,
			modelId,
			partCode: "B250-02-01",
			partName: "Accessory",
			lifecycleStatus: "PUBLISHED",
			evidenceStatus: "PROVISIONAL",
			routingSteps: [],
		},
	});

	await tx.bomDefinition.upsert({
		where: { id: bomId },
		update: { modelId, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		create: { id: bomId, modelId, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
	});
	for (const [id, lineNumber, modelPartId, name] of [
		[stableId("bom-line-body"), 1, modelPartBodyId, "Body component"],
		[stableId("bom-line-accessory"), 2, modelPartAccessoryId, "Accessory component"],
	]) {
		await tx.bomLine.upsert({
			where: { id },
			update: { bomDefinitionId: bomId, modelPartId, lineNumber, relationshipKind: "COMPONENT", quantityMagnitude: 1, quantityUom: "piece", usageBasis: "1 per product", sourceRepresentation: name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
			create: { id, bomDefinitionId: bomId, modelPartId, lineNumber, relationshipKind: "COMPONENT", quantityMagnitude: 1, quantityUom: "piece", usageBasis: "1 per product", sourceRepresentation: name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		});
	}

	await tx.processRoute.upsert({
		where: { id: routeId },
		update: { modelId, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		create: { id: routeId, modelId, revision: 1, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
	});

	await tx.workflowGroup.upsert({
		where: { id: workflowId },
		update: { projectId: null, name: `${prefix} Main Production`, linkageMode: "LINKED", displayOrder: 1, lifecycleStatus: "PUBLISHED", isSystemSeed: true },
		create: { id: workflowId, projectId: null, name: `${prefix} Main Production`, linkageMode: "LINKED", displayOrder: 1, lifecycleStatus: "PUBLISHED", isSystemSeed: true },
	});
	for (const [id, name, displayOrder] of [
		[injectionStageId, "Injection", 1],
		[decorationStageId, "Decoration", 2],
		[assemblyStageId, "Assembly", 3],
	]) {
		await tx.stage.upsert({
			where: { id },
			update: { workflowGroupId: workflowId, name, displayOrder, isSystemSeed: true },
			create: { id, workflowGroupId: workflowId, name, displayOrder, isSystemSeed: true },
		});
	}
	await tx.subStage.upsert({
		where: { id: qcSubStageId },
		update: { name: "Quality Check", displayOrder: 1, hasQualityCheckpoint: true, isMandatoryCheckpoint: true, isSystemSeed: true },
		create: { id: qcSubStageId, name: "Quality Check", displayOrder: 1, hasQualityCheckpoint: true, isMandatoryCheckpoint: true, isSystemSeed: true },
	});
	await tx.subStageEligibility.upsert({ where: { stageId_subStageId: { stageId: assemblyStageId, subStageId: qcSubStageId } }, update: {}, create: { stageId: assemblyStageId, subStageId: qcSubStageId } });

	const routeStageSeeds = [
		[stableId("route-stage-injection"), injectionStageId, null, 1, "Injection"],
		[stableId("route-stage-decoration"), decorationStageId, null, 2, "Decoration"],
		[stableId("route-stage-assembly"), assemblyStageId, qcSubStageId, 3, "Assembly / Quality Check"],
	];
	for (const [id, stageId, subStageId, sequence, name] of routeStageSeeds) {
		await tx.processRouteStage.upsert({
			where: { id },
			update: { processRouteId: routeId, stageId, subStageId, sequence, stageKey: name.toLowerCase().replaceAll(" ", "-"), stageName: name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
			create: { id, processRouteId: routeId, stageId, subStageId, sequence, stageKey: name.toLowerCase().replaceAll(" ", "-"), stageName: name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
		});
	}

	for (const [id, name, stationCode, stageId, displayOrder] of [
		[injectionStationId, "Injection Station 01", "ST-INJ-01", injectionStageId, 1],
		[decorationStationId, "Decoration Station 01", "ST-DEC-01", decorationStageId, 2],
		[assemblyStationId, "Assembly Station 01", "ST-ASM-01", assemblyStageId, 3],
	]) {
		await tx.station.upsert({
			where: { id },
			update: { workspaceId: "PATS", name: `${prefix} ${name}`, stationCode: code(stationCode), operationalContextKey: "PATS", stageId, displayOrder, isEnabled: true },
			create: { id, workspaceId: "PATS", name: `${prefix} ${name}`, stationCode: code(stationCode), operationalContextKey: "PATS", stageId, displayOrder, isEnabled: true },
		});
	}
	for (const [id, stationId, stageId, subStageId] of [
		[stableId("station-step-injection"), injectionStationId, injectionStageId, null],
		[stableId("station-step-decoration"), decorationStationId, decorationStageId, null],
		[stableId("station-step-qc"), assemblyStationId, assemblyStageId, qcSubStageId],
	]) {
		await tx.stationStep.upsert({
			where: { id },
			update: { stationId, stageId, subStageId },
			create: { id, stationId, stageId, subStageId },
		});
	}
	for (const [stageId, title] of [[injectionStageId, "Injection work instruction"], [decorationStageId, "Decoration work instruction"], [assemblyStageId, "Assembly quality work instruction"]]) {
		const instructionId = stableId(`work-instruction-${stageId}`);
		await tx.workInstruction.upsert({
			where: { id: instructionId },
			update: { steps: [{ en: title }, { en: "Scan batch and confirm route step" }], status: "PUBLISHED", sourceRevisionRef: `${prefix}-SEED` },
			create: { id: instructionId, stageId, subStageId: stageId === assemblyStageId ? qcSubStageId : null, steps: [{ en: title }, { en: "Scan batch and confirm route step" }], status: "PUBLISHED", sourceRevisionRef: `${prefix}-SEED`, version: 1 },
		});
	}

	const projectId = stableId("production-plan-001");
	const planPartBodyId = stableId("plan-part-body");
	const planPartAccessoryId = stableId("plan-part-accessory");
	const partsListId = stableId("parts-list-version-1");
	const lotId = stableId("lot-001");
	const batchId = stableId("batch-001");

	await tx.project.upsert({
		where: { id: projectId },
		update: { workspaceId: "PATS", projectCode: code("PLAN-001"), name: `${prefix} B250 Production Plan`, requiredProductionQuantity: 1000, status: "RELEASED", releasedAt: seedClock, releasedBySubjectId: planner.id },
		create: { id: projectId, workspaceId: "PATS", projectCode: code("PLAN-001"), name: `${prefix} B250 Production Plan`, requiredProductionQuantity: 1000, productId, status: "RELEASED", releasedAt: seedClock, releasedBySubjectId: planner.id, createdAt: seedClock },
	});
	await tx.productSpecification.upsert({
		where: { projectId },
		update: { skuCode: code("B250-SKU"), productName: `${prefix} B250 Shimajirou Accessory`, trayQuantityStandard: 10, sourceRevisionRef: `${prefix}-PRODUCT-MASTER-1` },
		create: { id: stableId("product-specification"), projectId, skuCode: code("B250-SKU"), productName: `${prefix} B250 Shimajirou Accessory`, trayQuantityStandard: 10, sourceRevisionRef: `${prefix}-PRODUCT-MASTER-1`, createdAt: seedClock },
	});
	await tx.planDemandAllocation.upsert({
		where: { id: stableId("plan-demand-allocation") },
		update: { projectId, modelId, marketRegion: "JP", demandPurpose: "production", quantityMagnitude: "1000.000000", quantityUom: "piece", usageBasis: "finished product", sourceRevisionRef: `${prefix}-DEMAND-1`, lifecycleStatus: "COMMITTED" },
		create: { id: stableId("plan-demand-allocation"), projectId, modelId, marketRegion: "JP", demandPurpose: "production", quantityMagnitude: "1000.000000", quantityUom: "piece", usageBasis: "finished product", sourceRevisionRef: `${prefix}-DEMAND-1`, lifecycleStatus: "COMMITTED", createdAt: seedClock },
	});

	for (const [id, codeValue, name, modelPartId] of [
		[planPartBodyId, "B250-01-08", "Body", modelPartBodyId],
		[planPartAccessoryId, "B250-02-01", "Accessory", modelPartAccessoryId],
	]) {
		await tx.part.upsert({
			where: { id },
			update: { projectId, partCode: codeValue, partName: name, sourceModelId: modelId, sourceModelPartId: modelPartId, lifecycleStatus: "PUBLISHED", variancePercentThreshold: 0.05 },
			create: { id, projectId, partCode: codeValue, partName: name, sourceModelId: modelId, sourceModelPartId: modelPartId, lifecycleStatus: "PUBLISHED", variancePercentThreshold: 0.05 },
		});
	}
	await tx.partsList.upsert({
		where: { id: partsListId },
		update: { projectId, version: 1, status: "PUBLISHED", sourceRevisionRef: `${prefix}-PARTS-LIST-1`, publishedAt: seedClock },
		create: { id: partsListId, projectId, version: 1, status: "PUBLISHED", sourceRevisionRef: `${prefix}-PARTS-LIST-1`, publishedAt: seedClock, createdAt: seedClock },
	});
	for (const [id, partId, stageId, subStageId, stepOrder] of [
		[stableId("route-step-body-injection"), planPartBodyId, injectionStageId, null, 1],
		[stableId("route-step-body-decoration"), planPartBodyId, decorationStageId, null, 2],
		[stableId("route-step-body-assembly"), planPartBodyId, assemblyStageId, qcSubStageId, 3],
		[stableId("route-step-accessory-injection"), planPartAccessoryId, injectionStageId, null, 1],
		[stableId("route-step-accessory-decoration"), planPartAccessoryId, decorationStageId, null, 2],
	]) {
		await tx.routingStep.upsert({ where: { id }, update: { partsListId, partId, stageId, subStageId, stepOrder }, create: { id, partsListId, partId, stageId, subStageId, stepOrder } });
	}
	await tx.pmrs.upsert({
		where: { projectId },
		update: { partsListId, externalControlNumber: `${prefix}-PMRS-001`, revisionLabel: "01", status: "attached", sourceReference: { seedProfile: profile, evidenceStatus: "PROVISIONAL" } },
		create: { id: stableId("pmrs-reference"), projectId, partsListId, externalControlNumber: `${prefix}-PMRS-001`, revisionLabel: "01", status: "attached", sourceReference: { seedProfile: profile, evidenceStatus: "PROVISIONAL" } },
	});
	await tx.materialRequirement.upsert({
		where: { id: stableId("material-requirement-body") },
		update: { projectId, partId: planPartBodyId, externalReference: `${prefix}-PMRS-001-L01`, quantityMagnitude: "1000.000000", quantityUom: "piece", usageBasis: "1 per product", sourceRevisionRef: `${prefix}-PMRS-001`, status: "APPROVED" },
		create: { id: stableId("material-requirement-body"), projectId, partId: planPartBodyId, externalReference: `${prefix}-PMRS-001-L01`, quantityMagnitude: "1000.000000", quantityUom: "piece", usageBasis: "1 per product", sourceRevisionRef: `${prefix}-PMRS-001`, status: "APPROVED", createdAt: seedClock },
	});
	await tx.lot.upsert({
		where: { id: lotId },
		update: { projectId, lotCode: code("LOT-001"), lotName: `${prefix} B250 Lot 001`, partsListId, partsListVersion: 1, partId: planPartBodyId, partName: "Body", requiredProductionQuantity: 1000, status: "ACTIVE", quantityMagnitude: "1000.000000", quantityUom: "piece", labelPackSize: 10, createdAtStage: "Planning" },
		create: { id: lotId, projectId, lotCode: code("LOT-001"), lotName: `${prefix} B250 Lot 001`, partsListId, partsListVersion: 1, partId: planPartBodyId, partName: "Body", requiredProductionQuantity: 1000, status: "ACTIVE", quantityMagnitude: "1000.000000", quantityUom: "piece", labelPackSize: 10, createdAtStage: "Planning", createdAt: seedClock },
	});
	for (const [id, partId, quantity] of [[stableId("lot-allocation-body"), planPartBodyId, "1000.000000"], [stableId("lot-allocation-accessory"), planPartAccessoryId, "1000.000000"]]) {
		await tx.lotPartAllocation.upsert({
			where: { lotId_partId: { lotId, partId } },
			update: { quantityMagnitude: quantity, quantityUom: "piece", usageBasis: "1 per product", status: "COMMITTED" },
			create: { id, lotId, partId, quantityMagnitude: quantity, quantityUom: "piece", usageBasis: "1 per product", status: "COMMITTED", createdAt: seedClock },
		});
	}
	await tx.batch.upsert({
		where: { id: batchId },
		update: { batchCode: code("BATCH-001"), barcodeValue: code("BATCH-001"), lotId, plannedQuantity: 500, labelPackSize: 10, currentStageId: decorationStageId, currentSubStageId: null, status: "ACTIVE", createdBySubjectId: operator.id },
		create: { id: batchId, batchCode: code("BATCH-001"), barcodeValue: code("BATCH-001"), lotId, plannedQuantity: 500, labelPackSize: 10, currentStageId: decorationStageId, currentSubStageId: null, status: "ACTIVE", createdBySubjectId: operator.id, createdAt: seedClock },
	});
	for (const [partId, allocationId] of [[planPartBodyId, stableId("lot-allocation-body")], [planPartAccessoryId, stableId("lot-allocation-accessory")]]) {
		await tx.batchPartLine.upsert({
			where: { batchId_partId: { batchId, partId } },
			update: { quantity: 500, lotPartAllocationId: allocationId, quantityMagnitude: "500.000000", quantityUom: "piece" },
			create: { batchId, partId, quantity: 500, lotPartAllocationId: allocationId, quantityMagnitude: "500.000000", quantityUom: "piece" },
		});
	}

	const injectionEventId = stableId("stage-event-injection");
	const decorationEventId = stableId("stage-event-decoration");
	const violationEventId = stableId("stage-event-violation");
	await tx.stageEvent.upsert({
		where: { id: injectionEventId },
		update: { stageId: injectionStageId, batchId, lotId, partId: planPartBodyId, quantity: 500, occurredAt: new Date("2026-07-28T08:30:00.000Z"), actor: operator.displayNameSnapshot ?? operator.id, actorSubjectId: operator.id, eventType: "STAGE_COMPLETED", status: "ACCEPTED", quantityMagnitude: "500.000000", quantityUom: "piece", sourceRepresentation: `${prefix}-SEED` },
		create: { id: injectionEventId, stageId: injectionStageId, batchId, lotId, partId: planPartBodyId, quantity: 500, occurredAt: new Date("2026-07-28T08:30:00.000Z"), actor: operator.displayNameSnapshot ?? operator.id, actorSubjectId: operator.id, eventType: "STAGE_COMPLETED", status: "ACCEPTED", quantityMagnitude: "500.000000", quantityUom: "piece", sourceRepresentation: `${prefix}-SEED` },
	});
	await tx.stageEvent.upsert({
		where: { id: decorationEventId },
		update: { stageId: decorationStageId, batchId, lotId, partId: planPartBodyId, quantity: 500, occurredAt: new Date("2026-07-28T09:30:00.000Z"), actor: operator.displayNameSnapshot ?? operator.id, actorSubjectId: operator.id, eventType: "STAGE_COMPLETED", status: "ACCEPTED", quantityMagnitude: "500.000000", quantityUom: "piece", sourceRepresentation: `${prefix}-SEED` },
		create: { id: decorationEventId, stageId: decorationStageId, batchId, lotId, partId: planPartBodyId, quantity: 500, occurredAt: new Date("2026-07-28T09:30:00.000Z"), actor: operator.displayNameSnapshot ?? operator.id, actorSubjectId: operator.id, eventType: "STAGE_COMPLETED", status: "ACCEPTED", quantityMagnitude: "500.000000", quantityUom: "piece", sourceRepresentation: `${prefix}-SEED` },
	});
	await tx.stageEvent.upsert({
		where: { id: violationEventId },
		update: { stageId: assemblyStageId, subStageId: null, batchId, lotId, partId: planPartBodyId, quantity: 500, occurredAt: new Date("2026-07-28T10:00:00.000Z"), actor: operator.displayNameSnapshot ?? operator.id, actorSubjectId: operator.id, eventType: "ROUTING_VIOLATION_DETECTED", status: "BLOCKED", isRoutingViolation: true, quantityMagnitude: "500.000000", quantityUom: "piece", sourceRepresentation: `${prefix}-SEED` },
		create: { id: violationEventId, stageId: assemblyStageId, subStageId: null, batchId, lotId, partId: planPartBodyId, quantity: 500, occurredAt: new Date("2026-07-28T10:00:00.000Z"), actor: operator.displayNameSnapshot ?? operator.id, actorSubjectId: operator.id, eventType: "ROUTING_VIOLATION_DETECTED", status: "BLOCKED", isRoutingViolation: true, quantityMagnitude: "500.000000", quantityUom: "piece", sourceRepresentation: `${prefix}-SEED` },
	});
	await tx.routingViolation.upsert({
		where: { stageEventId: violationEventId },
		update: { batchId, lotId, partId: planPartBodyId, attemptedStageId: assemblyStageId, attemptedSubStageId: null, expectedSteps: [{ stageId: injectionStageId, order: 1 }, { stageId: decorationStageId, order: 2 }, { stageId: assemblyStageId, subStageId: qcSubStageId, order: 3 }], detectedAt: new Date("2026-07-28T10:00:00.000Z"), status: "OPEN", resolved: false },
		create: { id: stableId("routing-violation-001"), stageEventId: violationEventId, batchId, lotId, partId: planPartBodyId, attemptedStageId: assemblyStageId, expectedSteps: [{ stageId: injectionStageId, order: 1 }, { stageId: decorationStageId, order: 2 }, { stageId: assemblyStageId, subStageId: qcSubStageId, order: 3 }], detectedAt: new Date("2026-07-28T10:00:00.000Z"), status: "OPEN", resolved: false },
	});
	await tx.inventoryTransaction.upsert({
		where: { id: stableId("inventory-issuance-001") },
		update: { transactionType: "ISSUANCE", batchId, partId: planPartBodyId, lotId, fromStageId: injectionStageId, toStageId: decorationStageId, expectedQuantity: 500, actualQuantity: 495, expectedQuantityMagnitude: "500.000000", actualQuantityMagnitude: "495.000000", quantityUom: "piece", usageBasis: "1 per product", withdrawalFormRef: `${prefix}-WITHDRAWAL-001`, recordedAt: new Date("2026-07-28T09:00:00.000Z"), recordedBy: operator.displayNameSnapshot ?? operator.id, recordedBySubjectId: operator.id, status: "ACCEPTED", sourceRepresentation: `${prefix}-SEED` },
		create: { id: stableId("inventory-issuance-001"), transactionType: "ISSUANCE", batchId, partId: planPartBodyId, lotId, fromStageId: injectionStageId, toStageId: decorationStageId, expectedQuantity: 500, actualQuantity: 495, expectedQuantityMagnitude: "500.000000", actualQuantityMagnitude: "495.000000", quantityUom: "piece", usageBasis: "1 per product", withdrawalFormRef: `${prefix}-WITHDRAWAL-001`, recordedAt: new Date("2026-07-28T09:00:00.000Z"), recordedBy: operator.displayNameSnapshot ?? operator.id, recordedBySubjectId: operator.id, status: "ACCEPTED", sourceRepresentation: `${prefix}-SEED` },
	});
	await tx.batchPositionProjection.upsert({
		where: { batchId },
		update: { stageId: decorationStageId, subStageId: null, lastEventId: decorationEventId, positionStatus: "ACCEPTED", quantityMagnitude: "495.000000", quantityUom: "piece", projectionVersion: 1 },
		create: { batchId, stageId: decorationStageId, lastEventId: decorationEventId, positionStatus: "ACCEPTED", quantityMagnitude: "495.000000", quantityUom: "piece", projectionVersion: 1 },
	});
	const inspectionId = stableId("quality-inspection-001");
	await tx.qualityInspection.upsert({
		where: { id: inspectionId },
		update: { batchId, stageId: assemblyStageId, subStageId: qcSubStageId, stationId: assemblyStationId, inspectedQuantity: "495.000000", quantityUom: "piece", status: "COMPLETED", inspectedBySubjectId: quality.id, evidence: { seedProfile: profile, evidenceStatus: "PROVISIONAL" }, startedAt: new Date("2026-07-28T10:30:00.000Z"), completedAt: new Date("2026-07-28T10:45:00.000Z") },
		create: { id: inspectionId, batchId, stageId: assemblyStageId, subStageId: qcSubStageId, stationId: assemblyStationId, inspectedQuantity: "495.000000", quantityUom: "piece", status: "COMPLETED", inspectedBySubjectId: quality.id, evidence: { seedProfile: profile, evidenceStatus: "PROVISIONAL" }, startedAt: new Date("2026-07-28T10:30:00.000Z"), completedAt: new Date("2026-07-28T10:45:00.000Z") },
	});
	await tx.qualityDecision.upsert({
		where: { id: stableId("quality-decision-001") },
		update: { inspectionId, decision: "HOLD", reasonCode: "ROUTING_REVIEW", reasonNote: "Seeded evidence requires routing review before release.", decidedBySubjectId: quality.id, decidedAt: new Date("2026-07-28T10:45:00.000Z") },
		create: { id: stableId("quality-decision-001"), inspectionId, decision: "HOLD", reasonCode: "ROUTING_REVIEW", reasonNote: "Seeded evidence requires routing review before release.", decidedBySubjectId: quality.id, decidedAt: new Date("2026-07-28T10:45:00.000Z") },
	});
	await tx.auditRecord.upsert({
		where: { id: stableId("audit-seed-release") },
		update: { actorSubjectId: planner.id, action: "seed.release-plan", resourceType: "ProductionPlan", resourceId: projectId, outcome: "SUCCESS", correlationId: `${prefix}-SEED`, detail: { seedProfile: profile, evidenceStatus: "PROVISIONAL" }, occurredAt: seedClock },
		create: { id: stableId("audit-seed-release"), actorSubjectId: planner.id, action: "seed.release-plan", resourceType: "ProductionPlan", resourceId: projectId, outcome: "SUCCESS", correlationId: `${prefix}-SEED`, detail: { seedProfile: profile, evidenceStatus: "PROVISIONAL" }, occurredAt: seedClock },
	});
	await tx.outboxMessage.upsert({
		where: { id: stableId("outbox-seed-plan-released") },
		update: { aggregateType: "ProductionPlan", aggregateId: projectId, eventType: "production-plan.released", schemaVersion: 1, payload: { planId: projectId, seedProfile: profile }, status: "PENDING", availableAt: seedClock, attempts: 0, lastError: null, publishedAt: null },
		create: { id: stableId("outbox-seed-plan-released"), aggregateType: "ProductionPlan", aggregateId: projectId, eventType: "production-plan.released", schemaVersion: 1, payload: { planId: projectId, seedProfile: profile }, status: "PENDING", availableAt: seedClock, attempts: 0 },
	});

	return { profile, subjects: 3, productId, projectId, lotId, batchId, violationEventId, inspectionId };
}

try {
	const result = await prisma.$transaction((tx) => seedProfile(tx));
	console.log(`Seeded PATS ${result.profile} profile: ${JSON.stringify(result)}`);
} finally {
	await prisma.$disconnect();
}
