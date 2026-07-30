import { Router, type Request, type RequestHandler } from "express";
import { z } from "zod";
import {
	PrismaClient as PatsPrismaClient,
	PlanLifecycleStatus,
	LotStatus,
	BatchStatus,
	StageEventStatus,
	InventoryTransactionStatus,
	QualityInspectionStatus,
	RoutingViolationStatus,
} from "../../generated/pats-client";
import {
	CommandProblem,
	actorDisplay,
	actorId,
	commandError,
	executeCommand,
	parseCommandBody,
	recordCommandSuccess,
	requireIfMatch,
	respondCommand,
} from "./command-support";
import type { CommandTransaction } from "./command-support";

const decimalString = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, "Must be a non-negative decimal with up to 6 places.");

const productionPlanCreateSchema = z.object({
	planCode: z.string().trim().min(1).max(120),
	name: z.string().trim().min(1).max(240),
	requiredProductionQuantity: z.number().int().positive(),
	productId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

const productionPlanPatchSchema = z.object({
	name: z.string().trim().min(1).max(240).optional(),
	requiredProductionQuantity: z.number().int().positive().optional(),
	productId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

const lotCreateSchema = z.object({
	lotCode: z.string().trim().min(1).max(120),
	lotName: z.string().trim().min(1).max(240),
	partId: z.string().trim().min(1).max(100),
	partsListId: z.string().trim().min(1).max(100),
	partsListVersion: z.number().int().positive(),
	requiredProductionQuantity: z.number().int().positive(),
	labelPackSize: z.number().int().positive(),
	quantityMagnitude: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
	usageBasis: z.string().trim().max(120).nullable().optional(),
}).strict();

const batchPartSchema = z.object({
	partId: z.string().trim().min(1).max(100),
	quantity: z.number().int().positive(),
	quantityMagnitude: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
}).strict();

const batchCreateSchema = z.object({
	batchCode: z.string().trim().min(1).max(120),
	barcodeValue: z.string().trim().min(1).max(240),
	lotId: z.string().trim().min(1).max(100),
	plannedQuantity: z.number().int().positive(),
	labelPackSize: z.number().int().positive(),
	currentStageId: z.string().trim().min(1).max(100),
	currentSubStageId: z.string().trim().min(1).max(100).nullable().optional(),
	parts: z.array(batchPartSchema).max(100).optional(),
}).strict();

const stageEventCreateSchema = z.object({
	batchId: z.string().trim().min(1).max(100),
	stageId: z.string().trim().min(1).max(100),
	subStageId: z.string().trim().min(1).max(100).nullable().optional(),
	partId: z.string().trim().min(1).max(100).nullable().optional(),
	eventType: z.enum(["STAGE_SCAN_RECORDED", "ROUTE_VALIDATED", "STAGE_COMPLETED", "VARIANCE_FLAG_RAISED"]),
	quantity: z.number().int().positive().nullable().optional(),
	quantityMagnitude: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
	usageBasis: z.string().trim().max(120).nullable().optional(),
	sourceRepresentation: z.string().trim().max(240).nullable().optional(),
}).strict();

const inventoryTransactionCreateSchema = z.object({
	transactionType: z.enum(["RECEIVING", "ISSUANCE"]),
	batchId: z.string().trim().min(1).max(100),
	partId: z.string().trim().min(1).max(100),
	fromStageId: z.string().trim().min(1).max(100).nullable().optional(),
	fromSubStageId: z.string().trim().min(1).max(100).nullable().optional(),
	toStageId: z.string().trim().min(1).max(100),
	toSubStageId: z.string().trim().min(1).max(100).nullable().optional(),
	expectedQuantity: z.number().int().nonnegative(),
	actualQuantity: z.number().int().nonnegative(),
	quantityMagnitude: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
	usageBasis: z.string().trim().max(120).nullable().optional(),
	withdrawalFormRef: z.string().trim().max(120).nullable().optional(),
	materialRequirementId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

const qualityInspectionCreateSchema = z.object({
	batchId: z.string().trim().min(1).max(100),
	stageId: z.string().trim().min(1).max(100),
	subStageId: z.string().trim().min(1).max(100).nullable().optional(),
	stationId: z.string().trim().min(1).max(100).nullable().optional(),
	inspectedQuantity: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
	evidence: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

const qualityDecisionSchema = z.object({
	decision: z.enum(["PASSED", "FAILED", "HOLD"]),
	reasonCode: z.string().trim().max(80).nullable().optional(),
	reasonNote: z.string().trim().max(500).nullable().optional(),
}).strict();

const routingViolationResolutionSchema = z.object({
	resolutionNote: z.string().trim().min(1).max(500),
}).strict();

const stageCreateSchema = z.object({
	workflowGroupId: z.string().trim().min(1).max(100),
	name: z.string().trim().min(1).max(160),
	displayOrder: z.number().int().nonnegative(),
}).strict();

const subStageCreateSchema = z.object({
	name: z.string().trim().min(1).max(160),
	displayOrder: z.number().int().nonnegative(),
	isConfigurable: z.boolean().optional(),
	isBuffer: z.boolean().optional(),
	hasQualityCheckpoint: z.boolean().optional(),
	 subProcessGroup: z.string().trim().max(120).nullable().optional(),
}).strict();

const stationCreateSchema = z.object({
	name: z.string().trim().min(1).max(160),
	stationCode: z.string().trim().min(1).max(80),
	stageId: z.string().trim().min(1).max(100),
	screenType: z.enum(["COMPUTER", "TABLET"]).optional(),
	scannerAttached: z.boolean().optional(),
	printerAttached: z.boolean().optional(),
	displayOrder: z.number().int().nonnegative(),
}).strict();

const stationStepCreateSchema = z.object({
	stationId: z.string().trim().min(1).max(100),
	stageId: z.string().trim().min(1).max(100),
	subStageId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

const workInstructionCreateSchema = z.object({
	stageId: z.string().trim().min(1).max(100),
	subStageId: z.string().trim().min(1).max(100).nullable().optional(),
	steps: z.array(z.record(z.string(), z.string())).min(1).max(100),
	version: z.number().int().positive().optional(),
	sourceRevisionRef: z.string().trim().max(160).nullable().optional(),
}).strict();

function resourceHeaders(id: string, rowVersion: number): Record<string, string> {
	return { Location: `/api/v1/production-plans/${id}`, ETag: `"${rowVersion}"` };
}

function batchHeaders(id: string, rowVersion: number): Record<string, string> {
	return { Location: `/api/v1/batches/${id}`, ETag: `"${rowVersion}"` };
}

function planResponse(plan: { id: string; projectCode: string; name: string; status: string; requiredProductionQuantity: number; productId: string | null; rowVersion: number }) {
	return {
		planId: plan.id,
		planCode: plan.projectCode,
		name: plan.name,
		status: plan.status,
		requiredProductionQuantity: plan.requiredProductionQuantity,
		productId: plan.productId,
		rowVersion: plan.rowVersion,
	};
}

function notFound(detail: string): never {
	throw new CommandProblem(404, "urn:bandai:pats:problem:not-found", "Not Found", detail);
}

function conflict(detail: string): never {
	throw new CommandProblem(409, "urn:bandai:pats:problem:conflict", "Conflict", detail);
}

function staleVersion(): never {
	throw new CommandProblem(412, "urn:bandai:pats:problem:precondition-failed", "Precondition Failed", "The resource changed since it was read. Reload it before retrying.");
}

function requireCapability(capability: string, gate: (capability: string) => RequestHandler): RequestHandler {
	return gate(capability);
}

async function batchRouteContext(transaction: CommandTransaction, batchId: string) {
	const batch = await transaction.batch.findUnique({ where: { id: batchId }, include: { lot: true, parts: true, positionProjection: true } });
	if (!batch) notFound("The requested batch was not found.");
	const partsList = await transaction.partsList.findUnique({ where: { id: batch.lot.partsListId }, include: { steps: { orderBy: { stepOrder: "asc" } } } });
	if (!partsList) conflict("The batch does not have a readable published route version.");
	const partIds = batch.parts.map((part) => part.partId);
	const routeSteps = partsList.steps.filter((step) => partIds.length === 0 || partIds.includes(step.partId));
	if (routeSteps.length === 0) conflict("The batch does not have an ordered route step for execution.");
	const currentIndex = batch.positionProjection?.routeStepId
		? routeSteps.findIndex((step) => step.id === batch.positionProjection?.routeStepId)
		: -1;
	const expected = routeSteps.find((step) => step.stepOrder > (currentIndex < 0 ? -1 : routeSteps[currentIndex].stepOrder));
	if (!expected) conflict("The batch has no remaining forward route step.");
	return { batch, routeSteps, expected, defaultPartId: batch.parts[0]?.partId ?? null };
}

export function commandRouter(
	database: PatsPrismaClient,
	requireCanonicalCapability: (capability: string) => RequestHandler,
): Router {
	const router = Router();

	router.post("/production-plans", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, productionPlanCreateSchema);
			const response = await executeCommand(database, req, "productionPlanCreate", body, async (transaction) => {
				if (body.productId) {
					const product = await transaction.product.findUnique({ where: { id: body.productId }, select: { id: true } });
					if (!product) notFound("The requested catalog product was not found.");
				}
				const plan = await transaction.project.create({
					data: {
						workspaceId: process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS",
						projectCode: body.planCode,
						name: body.name,
						requiredProductionQuantity: body.requiredProductionQuantity,
						status: PlanLifecycleStatus.DRAFT,
						productId: body.productId ?? null,
					},
				});
				await recordCommandSuccess(transaction, req, "PRODUCTION_PLAN_CREATED", "ProductionPlan", plan.id, { planCode: plan.projectCode });
				return { status: 201, body: planResponse(plan), headers: resourceHeaders(plan.id, plan.rowVersion) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.patch("/production-plans/:planId", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, productionPlanPatchSchema);
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanPatch", { planId: req.params.planId, body }, async (transaction) => {
				const current = await transaction.project.findUnique({ where: { id: req.params.planId } });
				if (!current) notFound("The requested production plan was not found.");
				if (current.rowVersion !== expectedVersion) staleVersion();
				if (current.status === PlanLifecycleStatus.RELEASED || current.status === PlanLifecycleStatus.COMPLETED || current.status === PlanLifecycleStatus.CANCELLED) conflict("Released or completed production plans cannot be edited.");
				if (body.productId) {
					const product = await transaction.product.findUnique({ where: { id: body.productId }, select: { id: true } });
					if (!product) notFound("The requested catalog product was not found.");
				}
				const plan = await transaction.project.update({
					where: { id: current.id },
					data: {
						...(body.name === undefined ? {} : { name: body.name }),
						...(body.requiredProductionQuantity === undefined ? {} : { requiredProductionQuantity: body.requiredProductionQuantity }),
						...(body.productId === undefined ? {} : { productId: body.productId }),
						rowVersion: { increment: 1 },
					},
				});
				await recordCommandSuccess(transaction, req, "PRODUCTION_PLAN_UPDATED", "ProductionPlan", plan.id, { rowVersion: plan.rowVersion });
				return { status: 200, body: planResponse(plan), headers: resourceHeaders(plan.id, plan.rowVersion) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/production-plans/:planId/release", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanRelease", { planId: req.params.planId, expectedVersion }, async (transaction) => {
				const current = await transaction.project.findUnique({ where: { id: req.params.planId } });
				if (!current) notFound("The requested production plan was not found.");
				if (current.rowVersion !== expectedVersion) staleVersion();
				if (current.status !== PlanLifecycleStatus.DRAFT && current.status !== PlanLifecycleStatus.READY) conflict("Only draft or ready production plans can be released.");
				const plan = await transaction.project.update({
					where: { id: current.id },
					data: { status: PlanLifecycleStatus.RELEASED, releasedAt: new Date(), releasedBySubjectId: actorId(req), rowVersion: { increment: 1 } },
				});
				await recordCommandSuccess(transaction, req, "PRODUCTION_PLAN_RELEASED", "ProductionPlan", plan.id, { rowVersion: plan.rowVersion });
				return { status: 200, body: planResponse(plan), headers: resourceHeaders(plan.id, plan.rowVersion) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/production-plans/:planId/lots", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, lotCreateSchema);
			const response = await executeCommand(database, req, "productionPlanLotCreate", { planId: req.params.planId, body }, async (transaction) => {
				const plan = await transaction.project.findUnique({ where: { id: req.params.planId }, select: { id: true } });
				if (!plan) notFound("The requested production plan was not found.");
				const partsList = await transaction.partsList.findFirst({ where: { id: body.partsListId, projectId: req.params.planId, version: body.partsListVersion }, select: { id: true } });
				if (!partsList) notFound("The requested parts-list version was not found for this production plan.");
				const part = await transaction.part.findFirst({ where: { id: body.partId, projectId: req.params.planId }, select: { id: true, partName: true } });
				if (!part) notFound("The requested plan part was not found.");
				const lot = await transaction.lot.create({
					data: {
						projectId: req.params.planId,
						lotCode: body.lotCode,
						lotName: body.lotName,
						partsListId: body.partsListId,
						partsListVersion: body.partsListVersion,
						partId: body.partId,
						partName: part.partName,
						requiredProductionQuantity: body.requiredProductionQuantity,
						status: LotStatus.PLANNED,
						quantityMagnitude: body.quantityMagnitude ?? null,
						quantityUom: body.quantityUom ?? null,
						usageBasis: body.usageBasis ?? null,
						labelPackSize: body.labelPackSize,
					},
				});
				await transaction.lotPartAllocation.create({
					data: {
						lotId: lot.id,
						partId: body.partId,
						quantityMagnitude: body.quantityMagnitude ?? String(body.requiredProductionQuantity),
						quantityUom: body.quantityUom ?? "EA",
						usageBasis: body.usageBasis ?? null,
					},
				});
				await recordCommandSuccess(transaction, req, "LOT_CREATED", "Lot", lot.id, { planId: req.params.planId, lotCode: lot.lotCode });
				return { status: 201, body: { lotId: lot.id, lotCode: lot.lotCode, status: lot.status }, headers: { Location: `/api/v1/lots/${lot.id}` } };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/batches", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, batchCreateSchema);
			const response = await executeCommand(database, req, "batchCreate", body, async (transaction) => {
				const lot = await transaction.lot.findUnique({ where: { id: body.lotId }, select: { id: true, projectId: true } });
				if (!lot) notFound("The requested lot was not found.");
				const parts = body.parts ?? [];
				const uniquePartIds = [...new Set(parts.map((part) => part.partId))];
				const validParts = await transaction.part.findMany({ where: { id: { in: uniquePartIds }, projectId: lot.projectId }, select: { id: true } });
				if (validParts.length !== uniquePartIds.length) notFound("Every batch part must belong to the lot's production plan.");
				const batch = await transaction.batch.create({
					data: {
						batchCode: body.batchCode,
						barcodeValue: body.barcodeValue,
						lotId: body.lotId,
						plannedQuantity: body.plannedQuantity,
						labelPackSize: body.labelPackSize,
						currentStageId: body.currentStageId,
						currentSubStageId: body.currentSubStageId ?? null,
						status: BatchStatus.PLANNED,
						createdBySubjectId: actorId(req),
					},
				});
				if (parts.length > 0) {
					await transaction.batchPartLine.createMany({
						data: parts.map((part) => ({ batchId: batch.id, partId: part.partId, quantity: part.quantity, quantityMagnitude: part.quantityMagnitude ?? null, quantityUom: part.quantityUom ?? null })),
					});
				}
				await transaction.batchPositionProjection.create({
					data: { batchId: batch.id, stageId: body.currentStageId, subStageId: body.currentSubStageId ?? null, quantityMagnitude: String(body.plannedQuantity), quantityUom: "EA" },
				});
				await recordCommandSuccess(transaction, req, "BATCH_CREATED", "Batch", batch.id, { lotId: batch.lotId, batchCode: batch.batchCode });
				return { status: 201, body: { batchId: batch.id, batchCode: batch.batchCode, barcodeValue: batch.barcodeValue, status: batch.status, rowVersion: batch.rowVersion }, headers: batchHeaders(batch.id, batch.rowVersion) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/stage-events", requireCapability("execution.write", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stageEventCreateSchema);
			const response = await executeCommand(database, req, "stageEventRecord", body, async (transaction) => {
				const context = await batchRouteContext(transaction, body.batchId);
				const attemptedSubStageId = body.subStageId ?? null;
				const accepted = context.expected.stageId === body.stageId && context.expected.subStageId === attemptedSubStageId;
				const partId = body.partId ?? context.defaultPartId;
				if (!partId) conflict("A stage event requires a batch part so route evidence remains traceable.");
				const event = await transaction.stageEvent.create({
					data: {
						stageId: body.stageId,
						subStageId: attemptedSubStageId,
						eventType: body.eventType,
						batchId: body.batchId,
						lotId: context.batch.lotId,
						partId,
						quantity: body.quantity ?? null,
						occurredAt: new Date(),
						actor: actorDisplay(req),
						isRoutingViolation: !accepted,
						status: accepted ? StageEventStatus.ACCEPTED : StageEventStatus.BLOCKED,
						routeStepId: accepted ? context.expected.id : null,
						actorSubjectId: actorId(req),
						quantityMagnitude: body.quantityMagnitude ?? null,
						quantityUom: body.quantityUom ?? null,
						usageBasis: body.usageBasis ?? null,
						sourceRepresentation: body.sourceRepresentation ?? null,
					},
				});
				let routingViolationId: string | null = null;
				if (accepted) {
					await transaction.batch.update({
						where: { id: context.batch.id },
						data: { currentStageId: body.stageId, currentSubStageId: attemptedSubStageId, rowVersion: { increment: 1 } },
					});
					await transaction.batchPositionProjection.update({
						where: { batchId: context.batch.id },
						data: { stageId: body.stageId, subStageId: attemptedSubStageId, routeStepId: context.expected.id, lastEventId: event.id, positionStatus: StageEventStatus.ACCEPTED, quantityMagnitude: body.quantityMagnitude ?? null, quantityUom: body.quantityUom ?? null },
					});
				} else {
					const violation = await transaction.routingViolation.create({
						data: {
							stageEventId: event.id,
							batchId: context.batch.id,
							lotId: context.batch.lotId,
							partId,
							attemptedStageId: body.stageId,
							attemptedSubStageId,
							expectedSteps: context.routeSteps.map((step) => ({ routeStepId: step.id, stageId: step.stageId, subStageId: step.subStageId, stepOrder: step.stepOrder })),
							detectedAt: new Date(),
							status: "OPEN",
						},
					});
					routingViolationId = violation.id;
				}
				await recordCommandSuccess(transaction, req, accepted ? "STAGE_EVENT_ACCEPTED" : "ROUTING_VIOLATION_DETECTED", "StageEvent", event.id, { batchId: event.batchId, status: event.status, routingViolationId });
				return { status: 201, body: { stageEventId: event.id, status: event.status, routingViolationId }, headers: { Location: `/api/v1/stage-events/${event.id}` } };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/inventory-transactions", requireCapability("inventory.issue", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, inventoryTransactionCreateSchema);
			const response = await executeCommand(database, req, "inventoryTransactionRecord", body, async (transaction) => {
				const batch = await transaction.batch.findUnique({ where: { id: body.batchId }, select: { id: true, lotId: true, lot: { select: { projectId: true } } } });
				if (!batch) notFound("The requested batch was not found.");
				const part = await transaction.part.findFirst({ where: { id: body.partId, projectId: batch.lot.projectId }, select: { id: true } });
				if (!part) notFound("The requested inventory part was not found in the batch's production plan.");
				if (body.materialRequirementId) {
					const requirement = await transaction.materialRequirement.findFirst({ where: { id: body.materialRequirementId, projectId: batch.lot.projectId }, select: { id: true } });
					if (!requirement) notFound("The requested material requirement was not found.");
				}
				const transactionRecord = await transaction.inventoryTransaction.create({
					data: {
						transactionType: body.transactionType,
						batchId: batch.id,
						partId: body.partId,
						lotId: batch.lotId,
						fromStageId: body.fromStageId ?? null,
						fromSubStageId: body.fromSubStageId ?? null,
						toStageId: body.toStageId,
						toSubStageId: body.toSubStageId ?? null,
						expectedQuantity: body.expectedQuantity,
						actualQuantity: body.actualQuantity,
						withdrawalFormRef: body.withdrawalFormRef ?? null,
						recordedAt: new Date(),
						recordedBy: actorDisplay(req),
						recordedBySubjectId: actorId(req),
						status: body.expectedQuantity === body.actualQuantity ? InventoryTransactionStatus.ACCEPTED : InventoryTransactionStatus.RECORDED,
						expectedQuantityMagnitude: String(body.expectedQuantity),
						actualQuantityMagnitude: body.quantityMagnitude ?? String(body.actualQuantity),
						quantityUom: body.quantityUom ?? null,
						usageBasis: body.usageBasis ?? null,
						materialRequirementId: body.materialRequirementId ?? null,
					},
				});
				await recordCommandSuccess(transaction, req, "INVENTORY_TRANSACTION_RECORDED", "InventoryTransaction", transactionRecord.id, { batchId: batch.id, status: transactionRecord.status });
				return { status: 201, body: { inventoryTransactionId: transactionRecord.id, status: transactionRecord.status }, headers: { Location: `/api/v1/inventory-transactions/${transactionRecord.id}` } };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/quality-inspections", requireCapability("quality.resolve", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, qualityInspectionCreateSchema);
			const response = await executeCommand(database, req, "qualityInspectionCreate", body, async (transaction) => {
				const batch = await transaction.batch.findUnique({ where: { id: body.batchId }, select: { id: true } });
				if (!batch) notFound("The requested batch was not found.");
				const inspection = await transaction.qualityInspection.create({
					data: {
						batchId: body.batchId,
						stageId: body.stageId,
						subStageId: body.subStageId ?? null,
						stationId: body.stationId ?? null,
						inspectedQuantity: body.inspectedQuantity ?? null,
						quantityUom: body.quantityUom ?? null,
						status: QualityInspectionStatus.OPEN,
						inspectedBySubjectId: actorId(req),
						evidence: body.evidence ? (JSON.parse(JSON.stringify(body.evidence)) as never) : undefined,
					},
				});
				await recordCommandSuccess(transaction, req, "QUALITY_INSPECTION_CREATED", "QualityInspection", inspection.id, { batchId: inspection.batchId, stageId: inspection.stageId });
				return { status: 201, body: { qualityInspectionId: inspection.id, status: inspection.status, rowVersion: inspection.rowVersion }, headers: { Location: `/api/v1/quality-inspections/${inspection.id}`, ETag: `"${inspection.rowVersion}"` } };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/quality-inspections/:inspectionId/decisions", requireCapability("quality.resolve", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, qualityDecisionSchema);
			const expectedVersion = requireIfMatch(req, "quality inspection");
			const response = await executeCommand(database, req, "qualityDecisionCreate", { inspectionId: req.params.inspectionId, body, expectedVersion }, async (transaction) => {
				const inspection = await transaction.qualityInspection.findUnique({ where: { id: req.params.inspectionId } });
				if (!inspection) notFound("The requested quality inspection was not found.");
				if (inspection.rowVersion !== expectedVersion) staleVersion();
				if (inspection.status === QualityInspectionStatus.COMPLETED || inspection.status === QualityInspectionStatus.CANCELLED) conflict("This quality inspection has already been closed.");
				const decision = await transaction.qualityDecision.create({
					data: {
						inspectionId: inspection.id,
						decision: body.decision,
						reasonCode: body.reasonCode ?? null,
						reasonNote: body.reasonNote ?? null,
						decidedBySubjectId: actorId(req),
					},
				});
				const updatedInspection = await transaction.qualityInspection.update({
					where: { id: inspection.id },
					data: { status: body.decision === "HOLD" ? QualityInspectionStatus.IN_PROGRESS : QualityInspectionStatus.COMPLETED, completedAt: body.decision === "HOLD" ? null : new Date(), rowVersion: { increment: 1 } },
				});
				await recordCommandSuccess(transaction, req, "QUALITY_DECISION_RECORDED", "QualityInspection", inspection.id, { qualityDecisionId: decision.id, decision: decision.decision });
				return { status: 201, body: { qualityDecisionId: decision.id, qualityInspectionId: updatedInspection.id, decision: decision.decision, inspectionStatus: updatedInspection.status, rowVersion: updatedInspection.rowVersion }, headers: { Location: `/api/v1/quality-inspections/${inspection.id}/decisions/${decision.id}`, ETag: `"${updatedInspection.rowVersion}"` } };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/routing-violations/:violationId/resolve", requireCapability("reconciliation.resolve", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, routingViolationResolutionSchema);
			const response = await executeCommand(database, req, "routingViolationResolve", { violationId: req.params.violationId, body }, async (transaction) => {
				const violation = await transaction.routingViolation.findUnique({ where: { id: req.params.violationId } });
				if (!violation) notFound("The requested routing violation was not found.");
				if (violation.status === RoutingViolationStatus.RESOLVED || violation.status === RoutingViolationStatus.WAIVED) conflict("This routing violation is already closed.");
				const resolved = await transaction.routingViolation.update({
					where: { id: violation.id },
					data: { resolved: true, status: RoutingViolationStatus.RESOLVED, resolvedAt: new Date(), resolvedBy: actorDisplay(req), resolvedBySubjectId: actorId(req), resolutionNote: body.resolutionNote },
				});
				await recordCommandSuccess(transaction, req, "ROUTING_VIOLATION_RESOLVED", "RoutingViolation", resolved.id, { batchId: resolved.batchId });
				return { status: 200, body: { routingViolationId: resolved.id, status: resolved.status, resolvedAt: resolved.resolvedAt?.toISOString() ?? null }, headers: {} };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/stages", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stageCreateSchema);
			const response = await executeCommand(database, req, "stageCreate", body, async (transaction) => {
				const group = await transaction.workflowGroup.findUnique({ where: { id: body.workflowGroupId }, select: { id: true } });
				if (!group) notFound("The requested workflow group was not found.");
				const stage = await transaction.stage.create({ data: body });
				await recordCommandSuccess(transaction, req, "STAGE_CREATED", "Stage", stage.id, { workflowGroupId: stage.workflowGroupId });
				return { status: 201, body: { stageId: stage.id, name: stage.name, displayOrder: stage.displayOrder }, headers: { Location: `/api/v1/stages/${stage.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/sub-stages", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, subStageCreateSchema);
			const response = await executeCommand(database, req, "subStageCreate", body, async (transaction) => {
				const subStage = await transaction.subStage.create({ data: body });
				await recordCommandSuccess(transaction, req, "SUB_STAGE_CREATED", "SubStage", subStage.id, { name: subStage.name });
				return { status: 201, body: { subStageId: subStage.id, name: subStage.name, displayOrder: subStage.displayOrder }, headers: { Location: `/api/v1/sub-stages/${subStage.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/stations", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stationCreateSchema);
			const response = await executeCommand(database, req, "stationCreate", body, async (transaction) => {
				const stage = await transaction.stage.findUnique({ where: { id: body.stageId }, select: { id: true } });
				if (!stage) notFound("The requested station stage was not found.");
				const station = await transaction.station.create({ data: { ...body, workspaceId: process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS", screenType: body.screenType ?? "COMPUTER", scannerAttached: body.scannerAttached ?? true, printerAttached: body.printerAttached ?? true } });
				await recordCommandSuccess(transaction, req, "STATION_CREATED", "Station", station.id, { stationCode: station.stationCode });
				return { status: 201, body: { stationId: station.id, stationCode: station.stationCode, name: station.name }, headers: { Location: `/api/v1/stations/${station.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/station-steps", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stationStepCreateSchema);
			const response = await executeCommand(database, req, "stationStepCreate", body, async (transaction) => {
				const station = await transaction.station.findUnique({ where: { id: body.stationId }, select: { id: true } });
				const stage = await transaction.stage.findUnique({ where: { id: body.stageId }, select: { id: true } });
				if (!station || !stage) notFound("The requested station or stage was not found.");
				const step = await transaction.stationStep.create({ data: { ...body, subStageId: body.subStageId ?? null } });
				await recordCommandSuccess(transaction, req, "STATION_STEP_CREATED", "StationStep", step.id, { stationId: step.stationId, stageId: step.stageId });
				return { status: 201, body: { stationStepId: step.id, stationId: step.stationId, stageId: step.stageId, subStageId: step.subStageId }, headers: { Location: `/api/v1/station-steps/${step.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/work-instructions", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, workInstructionCreateSchema);
			const response = await executeCommand(database, req, "workInstructionCreate", body, async (transaction) => {
				const stage = await transaction.stage.findUnique({ where: { id: body.stageId }, select: { id: true } });
				if (!stage) notFound("The requested work-instruction stage was not found.");
				const instruction = await transaction.workInstruction.create({ data: { ...body, subStageId: body.subStageId ?? null, version: body.version ?? 1, steps: JSON.parse(JSON.stringify(body.steps)) as never } });
				await recordCommandSuccess(transaction, req, "WORK_INSTRUCTION_CREATED", "WorkInstruction", instruction.id, { stageId: instruction.stageId, version: instruction.version });
				return { status: 201, body: { workInstructionId: instruction.id, stageId: instruction.stageId, version: instruction.version }, headers: { Location: `/api/v1/work-instructions/${instruction.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	return router;
}
