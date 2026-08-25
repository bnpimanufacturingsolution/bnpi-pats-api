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
	isInjectionOriginStage,
	parseCommandBody,
	recordCommandSuccess,
	requireIfMatch,
	respondCommand,
} from "./command-support";
import type { CommandTransaction } from "./command-support";
import { assertQualityStageAllowed } from "./quality-stage-scope";
import { recordPrintJob } from "./print-job";
import { allowUnauthenticatedDeskPrint, deliverDeskLabel } from "./print-desk";
import { hasAnyCapability } from "../identity/policy";
import type { SubjectAssignmentRecord } from "../identity/types";

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

const productionPlanModelAllocationSchema = z.object({
	modelId: z.string().trim().min(1).max(100),
	plannedQuantity: z.number().int().positive(),
	quantityMagnitude: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
	usageBasis: z.string().trim().max(120).nullable().optional(),
	marketRegion: z.string().trim().max(120).nullable().optional(),
	demandPurpose: z.string().trim().max(120).nullable().optional(),
	sourceRevisionRef: z.string().trim().max(160).nullable().optional(),
}).strict();

const productionPlanPartsListVersionSchema = z.object({
	steps: z.array(z.object({
		partId: z.string().trim().min(1).max(100),
		stageId: z.string().trim().min(1).max(100),
		subStageId: z.string().trim().min(1).max(100).nullable().optional(),
		stepOrder: z.number().int().positive(),
	}).strict()).max(1000),
	sourceRevisionRef: z.string().trim().max(160).nullable().optional(),
}).strict();

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
	stationId: z.string().trim().min(1).max(100).nullable().optional(),
	processId: z.string().trim().min(1).max(100).nullable().optional(),
	partId: z.string().trim().min(1).max(100).nullable().optional(),
	eventType: z.enum(["STAGE_SCAN_RECORDED", "ROUTE_VALIDATED", "STAGE_COMPLETED", "VARIANCE_FLAG_RAISED"]),
	quantity: z.number().int().positive().nullable().optional(),
	quantityMagnitude: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
	usageBasis: z.string().trim().max(120).nullable().optional(),
	sourceRepresentation: z.string().trim().max(240).nullable().optional(),
}).strict();

const printJobCreateSchema = z.object({
	batchId: z.string().trim().min(1).max(100),
	stationId: z.string().trim().min(1).max(100),
	reprintOf: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

const deskPrintSchema = z.object({
	barcodeValue: z.string().trim().min(1).max(240),
	batchCode: z.string().trim().min(1).max(120),
	lotCode: z.string().trim().min(1).max(120),
	partName: z.string().trim().max(160).optional(),
	partCode: z.string().trim().max(80).optional(),
	quantity: z.number().int().positive(),
	fromStepLabel: z.string().trim().max(160).optional(),
	toStepLabel: z.string().trim().max(160).optional(),
	atLabel: z.string().trim().max(160).optional(),
	operatorName: z.string().trim().max(120).optional(),
	machineName: z.string().trim().max(160).optional(),
	qrValue: z.string().trim().max(600).optional(),
	widthMm: z.number().positive().optional(),
	heightMm: z.number().positive().optional(),
});

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

const qualityDecisionSchema = z
	.object({
		decision: z.enum(["PASSED", "FAILED", "HOLD"]),
		reasonCode: z.string().trim().max(80).nullable().optional(),
		reasonNote: z.string().trim().max(500).nullable().optional(),
	})
	.strict()
	.refine((body) => body.decision !== "FAILED" || Boolean(body.reasonCode && body.reasonCode.length > 0), {
		message: "A fail reason is required when the decision is FAILED.",
		path: ["reasonCode"],
	});

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
	stationCode: z.string().trim().min(1).max(80).optional(),
	stageId: z.string().trim().min(1).max(100).optional(),
	productionLineId: z.string().trim().min(1).max(100).nullable().optional(),
	screenType: z.enum(["COMPUTER", "TABLET"]).optional(),
	scannerAttached: z.boolean().optional(),
	printerAttached: z.boolean().optional(),
	displayOrder: z.number().int().nonnegative().optional(),
}).strict();

const stationProcessReplaceSchema = z.object({
	processIds: z.array(z.string().trim().min(1).max(100)).max(200),
}).strict();

const stationOrderReplaceSchema = z.object({
	stationIds: z.array(z.string().trim().min(1).max(100)).min(1).max(200),
}).strict();

const workProcessCreateSchema = z.object({
	name: z.string().trim().min(1).max(160),
	labelledCycleTimeSec: z.number().int().nonnegative().nullable().optional(),
	stationId: z.string().trim().min(1).max(100).optional(),
}).strict();

const partRouteReplaceSchema = z.object({
	steps: z.array(z.object({
		stationId: z.string().trim().min(1).max(100),
		processId: z.string().trim().min(1).max(100).nullable().optional(),
		stepOrder: z.number().int().positive().optional(),
	}).strict()).max(80),
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

const monitoringDailySheetUpsertSchema = z.object({
	id: z.string().trim().min(1).max(120).optional(),
	payload: z.record(z.string(), z.unknown()),
}).strict();

const monitoringStationBoardUpsertSchema = z.object({
	id: z.string().trim().min(1).max(120).optional(),
	payload: z.record(z.string(), z.unknown()),
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

async function assertLineLeaderSheetCoverage(
	transaction: CommandTransaction,
	subjectId: string,
	workspaceId: string,
	sheet: { stageId: string | null; subStageId: string | null; workProcessId: string | null },
): Promise<void> {
	const assignments = await transaction.lineLeaderAssignment.findMany({
		where: { subjectId, workspaceId, status: "ACTIVE" },
	});
	if (assignments.length === 0) return;
	if (!sheet.stageId) {
		conflict("Line Leader encode requires a stage on the day sheet.");
	}
	const covered = assignments.some(
		(assignment) =>
			assignment.stageId === sheet.stageId &&
			(assignment.subStageId === null || assignment.subStageId === sheet.subStageId) &&
			(assignment.workProcessId === null || assignment.workProcessId === sheet.workProcessId),
	);
	if (!covered) {
		throw new CommandProblem(
			403,
			"urn:bandai:pats:problem:not-allowed-stage",
			"Not Allowed",
			"This Line Leader assignment does not cover this day sheet.",
		);
	}
}

function staleVersion(): never {
	throw new CommandProblem(412, "urn:bandai:pats:problem:precondition-failed", "Precondition Failed", "The resource changed since it was read. Reload it before retrying.");
}

function ensurePlanEditable(plan: { status: string }): void {
	const immutableStatuses: string[] = [PlanLifecycleStatus.RELEASED, PlanLifecycleStatus.COMPLETED, PlanLifecycleStatus.CANCELLED];
	if (immutableStatuses.includes(plan.status)) {
		conflict("Released or completed production plans cannot be edited.");
	}
}

function catalogRoutingSteps(value: unknown): Array<{ stageId: string; subStageId: string | null; stepOrder: number }> {
	if (!Array.isArray(value)) return [];
	return value.flatMap((candidate, index) => {
		if (typeof candidate !== "object" || candidate === null) return [];
		const step = candidate as { stageId?: unknown; subStageId?: unknown; order?: unknown };
		if (typeof step.stageId !== "string" || step.stageId.trim().length === 0) return [];
		return [{
			stageId: step.stageId,
			subStageId: typeof step.subStageId === "string" ? step.subStageId : null,
			stepOrder: typeof step.order === "number" && Number.isInteger(step.order) && step.order > 0 ? step.order : index + 1,
		}];
	});
}

function requireCapability(capability: string, gate: (capability: string) => RequestHandler): RequestHandler {
	return gate(capability);
}

function requireSetupManage(gate: (capability: string) => RequestHandler): RequestHandler {
	return (req, res, next) => {
		const assignments = ((req as Request & { canonicalAssignments?: SubjectAssignmentRecord[] }).canonicalAssignments ?? []);
		if (hasAnyCapability(assignments, ["operations.manage", "catalog.manage", "planning.manage"])) {
			next();
			return;
		}
		gate("operations.manage")(req, res, next);
	};
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

	router.post("/production-plans/:planId/model-allocations", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, productionPlanModelAllocationSchema);
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanModelAllocationUpsert", { planId: req.params.planId, body }, async (transaction) => {
				const plan = await transaction.project.findUnique({ where: { id: req.params.planId }, select: { id: true, productId: true, status: true, rowVersion: true } });
				if (!plan) notFound("The requested production plan was not found.");
				if (plan.rowVersion !== expectedVersion) staleVersion();
				ensurePlanEditable(plan);

				const model = await transaction.model.findUnique({ where: { id: body.modelId }, include: { modelParts: true } });
				if (!model) notFound("The requested catalog model was not found.");
				if (plan.productId !== null && model.productId !== plan.productId) conflict("The selected model does not belong to the production plan product.");

				const allocation = await transaction.projectModelAllocation.upsert({
					where: { projectId_modelId: { projectId: plan.id, modelId: model.id } },
					create: {
						projectId: plan.id,
						modelId: model.id,
						plannedQuantity: body.plannedQuantity,
						quantityMagnitude: body.quantityMagnitude ?? null,
						quantityUom: body.quantityUom ?? null,
						usageBasis: body.usageBasis ?? null,
						marketRegion: body.marketRegion ?? null,
						demandPurpose: body.demandPurpose ?? null,
						sourceRevisionRef: body.sourceRevisionRef ?? null,
					},
					update: {
						plannedQuantity: body.plannedQuantity,
						quantityMagnitude: body.quantityMagnitude ?? null,
						quantityUom: body.quantityUom ?? null,
						usageBasis: body.usageBasis ?? null,
						marketRegion: body.marketRegion ?? null,
						demandPurpose: body.demandPurpose ?? null,
						sourceRevisionRef: body.sourceRevisionRef ?? null,
						rowVersion: { increment: 1 },
					},
				});

				const modelPartIds = model.modelParts.map((modelPart) => modelPart.id);
				const existingParts = modelPartIds.length === 0
					? []
					: await transaction.part.findMany({ where: { projectId: plan.id, sourceModelPartId: { in: modelPartIds } }, select: { sourceModelPartId: true } });
				const existingPartIds = new Set(existingParts.map((part) => part.sourceModelPartId));
				for (const modelPart of model.modelParts) {
					if (existingPartIds.has(modelPart.id)) continue;
					await transaction.part.create({
						data: {
							projectId: plan.id,
							partCode: modelPart.partCode,
							partName: modelPart.partName,
							sourceModelId: model.id,
							sourceModelPartId: modelPart.id,
						},
					});
				}

				const currentPartsList = await transaction.partsList.findFirst({ where: { projectId: plan.id }, orderBy: [{ version: "desc" }, { id: "desc" }], include: { steps: true } });
				let partsListVersionId = currentPartsList?.id ?? null;
				if (!currentPartsList) {
					const planParts = await transaction.part.findMany({ where: { projectId: plan.id }, select: { id: true, sourceModelPartId: true } });
					const planPartByModelPartId = new Map(planParts.flatMap((part) => part.sourceModelPartId ? [[part.sourceModelPartId, part.id] as const] : []));
					const validStageIds = new Set((await transaction.stage.findMany({ select: { id: true } })).map((stage) => stage.id));
					const configuredSubStages = await transaction.subStage.findMany({ select: { id: true, eligibleStages: { select: { stageId: true } } } });
					const validSubStagePairs = new Set(configuredSubStages.flatMap((subStage) => subStage.eligibleStages.map((eligibility) => `${subStage.id}:${eligibility.stageId}`)));
					const initialSteps = model.modelParts.flatMap((modelPart) => {
						const partId = planPartByModelPartId.get(modelPart.id);
						if (!partId) return [];
						return catalogRoutingSteps(modelPart.routingSteps).filter((step) => validStageIds.has(step.stageId) && (step.subStageId === null || validSubStagePairs.has(`${step.subStageId}:${step.stageId}`))).map((step) => ({ ...step, partId }));
					});
					const partsList = await transaction.partsList.create({ data: { projectId: plan.id, version: 1, status: "DRAFT", steps: { create: initialSteps } }, select: { id: true } });
					partsListVersionId = partsList.id;
				}

				const updatedPlan = await transaction.project.update({ where: { id: plan.id }, data: { rowVersion: { increment: 1 } }, select: { id: true, rowVersion: true } });
				await recordCommandSuccess(transaction, req, "PRODUCTION_PLAN_MODEL_ALLOCATION_UPSERTED", "ProductionPlan", plan.id, { allocationId: allocation.id, modelId: model.id, partsListVersionId });
				return { status: 200, body: { allocationId: allocation.id, modelId: allocation.modelId, plannedQuantity: allocation.plannedQuantity, partsListVersionId, planRowVersion: updatedPlan.rowVersion }, headers: resourceHeaders(plan.id, updatedPlan.rowVersion) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/production-plans/:planId/parts-list-versions", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, productionPlanPartsListVersionSchema);
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanPartsListVersionCreate", { planId: req.params.planId, body }, async (transaction) => {
				const plan = await transaction.project.findUnique({ where: { id: req.params.planId }, select: { id: true, status: true, rowVersion: true } });
				if (!plan) notFound("The requested production plan was not found.");
				if (plan.rowVersion !== expectedVersion) staleVersion();
				ensurePlanEditable(plan);

				const partIds = [...new Set(body.steps.map((step) => step.partId))];
				const parts = await transaction.part.findMany({ where: { projectId: plan.id, id: { in: partIds } }, select: { id: true } });
				if (parts.length !== partIds.length) notFound("Every route step must reference a part in the production plan.");
				const stageIds = [...new Set(body.steps.map((step) => step.stageId))];
				const subStageIds = [...new Set(body.steps.flatMap((step) => step.subStageId ? [step.subStageId] : []))];
				const [stages, subStages] = await Promise.all([
					transaction.stage.findMany({ where: { id: { in: stageIds } }, select: { id: true } }),
					transaction.subStage.findMany({ where: { id: { in: subStageIds } }, select: { id: true, eligibleStages: { select: { stageId: true } } } }),
				]);
				if (stages.length !== stageIds.length) notFound("Every route step must reference a configured stage.");
				if (subStages.length !== subStageIds.length) notFound("Every route step must reference a configured sub-stage.");
				const eligibleStagePairs = new Set(subStages.flatMap((subStage) => subStage.eligibleStages.map((eligibility) => `${subStage.id}:${eligibility.stageId}`)));
				if (body.steps.some((step) => step.subStageId !== null && step.subStageId !== undefined && !eligibleStagePairs.has(`${step.subStageId}:${step.stageId}`))) {
					conflict("Every route sub-stage must be eligible under its selected stage.");
				}
				const routeIdentity = new Set<string>();
				const partOrders = new Set<string>();
				for (const step of body.steps) {
					const identity = `${step.partId}:${step.stageId}:${step.subStageId ?? ""}`;
					const order = `${step.partId}:${step.stepOrder}`;
					if (routeIdentity.has(identity)) conflict("A part cannot repeat the same route stage.");
					if (partOrders.has(order)) conflict("A part cannot repeat a route step order.");
					routeIdentity.add(identity);
					partOrders.add(order);
				}

				const previous = await transaction.partsList.findFirst({ where: { projectId: plan.id }, orderBy: [{ version: "desc" }, { id: "desc" }], select: { version: true } });
				const partsList = await transaction.partsList.create({
					data: {
						projectId: plan.id,
						version: (previous?.version ?? 0) + 1,
						status: "DRAFT",
						sourceRevisionRef: body.sourceRevisionRef ?? null,
						steps: { create: body.steps.map((step) => ({ partId: step.partId, stageId: step.stageId, subStageId: step.subStageId ?? null, stepOrder: step.stepOrder })) },
					},
					select: { id: true, version: true },
				});
				const updatedPlan = await transaction.project.update({ where: { id: plan.id }, data: { rowVersion: { increment: 1 } }, select: { id: true, rowVersion: true } });
				await recordCommandSuccess(transaction, req, "PRODUCTION_PLAN_PARTS_LIST_VERSION_CREATED", "PartsList", partsList.id, { planId: plan.id, version: partsList.version, stepCount: body.steps.length });
				return { status: 201, body: { partsListVersionId: partsList.id, version: partsList.version, planRowVersion: updatedPlan.rowVersion }, headers: resourceHeaders(plan.id, updatedPlan.rowVersion) };
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
				if (body.eventType === "STAGE_SCAN_RECORDED") {
					const attemptedStage = await transaction.stage.findUnique({
						where: { id: body.stageId },
						select: { name: true },
					});
					if (isInjectionOriginStage(attemptedStage)) {
						conflict("Injection is origin: Receiving Scanning (In) is not recorded here. Quantity is created on Issuance / print.");
					}
				}
				const context = await batchRouteContext(transaction, body.batchId);
				const attemptedSubStageId = body.subStageId ?? null;
				const expected = context.expected as typeof context.expected & {
					stationId?: string | null;
					processId?: string | null;
				};
				const accepted = expected.stationId && body.stationId
					? expected.stationId === body.stationId &&
						(expected.processId == null || body.processId == null || expected.processId === body.processId)
					: expected.stageId === body.stageId && expected.subStageId === attemptedSubStageId;
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

	router.post("/print-jobs/desk", (req, res, next) => {
		if (allowUnauthenticatedDeskPrint(req)) {
			next();
			return;
		}
		requireCapability("execution.write", requireCanonicalCapability)(req, res, next);
	}, async (req, res, next) => {
		try {
			const body = parseCommandBody(req, deskPrintSchema);
			const result = await deliverDeskLabel({
				barcodeValue: body.barcodeValue,
				batchCode: body.batchCode,
				lotCode: body.lotCode,
				partName: body.partName ?? "",
				partCode: body.partCode ?? "",
				quantity: body.quantity,
				fromStepLabel: body.fromStepLabel ?? "",
				toStepLabel: body.toStepLabel ?? "",
				atLabel: body.atLabel ?? body.toStepLabel ?? "",
				operatorName: body.operatorName ?? "",
				machineName: body.machineName ?? "",
				qrValue: body.qrValue ?? body.barcodeValue,
				printedAt: new Date().toISOString(),
				sequence: 1,
				widthMm: body.widthMm ?? 102,
				heightMm: body.heightMm ?? 152,
				dpi: 300,
			});
			res.status(result.status === "FAILED" ? 503 : 200).json({
				status: result.status,
				failureReason: result.failureReason,
				language: result.language,
			});
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post("/print-jobs", requireCapability("execution.write", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, printJobCreateSchema);
			const response = await executeCommand(database, req, "printJobCreate", body, async (transaction) => {
				try {
					const job = await recordPrintJob(transaction as unknown as Parameters<typeof recordPrintJob>[0], {
						batchId: body.batchId,
						stationId: body.stationId,
						reprintOf: body.reprintOf ?? null,
						actor: actorDisplay(req),
						actorSubjectId: actorId(req),
					});
					await recordCommandSuccess(transaction, req, "PRINT_JOB_RECORDED", "PrintJob", job.id, {
						batchId: job.batchId,
						status: job.status,
					});
					return {
						status: job.status === "FAILED" ? 201 : 201,
						body: {
							printJobId: job.id,
							status: job.status,
							barcodeValue: job.barcodeValue,
							quantity: job.quantity,
							sequence: job.sequence,
							failureReason: job.failureReason,
						},
						headers: { Location: `/api/v1/print-jobs/${job.id}` },
					};
				} catch (error) {
					if (error instanceof Error && error.message === "NOT_FOUND_STATION") {
						notFound("The requested station was not found.");
					}
					if (error instanceof Error && error.message === "NOT_FOUND_BATCH") {
						notFound("The requested batch was not found.");
					}
					if (error instanceof Error && error.message === "NOT_FOUND_REPRINT") {
						notFound("The reprint source print job was not found for this batch.");
					}
					throw error;
				}
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
				if (body.transactionType === "RECEIVING") {
					const toStage = await transaction.stage.findUnique({
						where: { id: body.toStageId },
						select: { name: true },
					});
					if (isInjectionOriginStage(toStage)) {
						conflict("Injection is origin: Receiving is not recorded here. First quantity is Issuance / print.");
					}
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
				await assertQualityStageAllowed(transaction, actorId(req), body.stageId);
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
				await assertQualityStageAllowed(transaction, actorId(req), inspection.stageId);
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

	router.post("/stations", requireSetupManage(requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stationCreateSchema);
			const response = await executeCommand(database, req, "stationCreate", body, async (transaction) => {
				let productionLineId = body.productionLineId ?? null;
				if (!productionLineId) {
					const line = await transaction.productionLine.findFirst({
						where: { kind: "MANUFACTURING" },
						orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
						select: { id: true },
					});
					productionLineId = line?.id ?? null;
				} else {
					const line = await transaction.productionLine.findUnique({ where: { id: productionLineId }, select: { id: true } });
					if (!line) notFound("The requested production line was not found.");
				}
				let stageId = body.stageId;
				if (!stageId) {
					const stage = await transaction.stage.findFirst({
						where: {
							AND: [
								{ name: { not: { contains: "Warehouse", mode: "insensitive" } } },
								{ name: { not: { contains: "Planning", mode: "insensitive" } } },
							],
						},
						orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
						select: { id: true },
					});
					stageId = stage?.id;
				} else {
					const stage = await transaction.stage.findUnique({ where: { id: stageId }, select: { id: true } });
					if (!stage) notFound("The requested station stage was not found.");
				}
				if (!stageId) notFound("The requested station stage was not found.");
				let displayOrder = body.displayOrder;
				if (displayOrder === undefined) {
					const last = await transaction.station.findFirst({ orderBy: { displayOrder: "desc" }, select: { displayOrder: true } });
					displayOrder = (last?.displayOrder ?? 0) + 1;
				}
				const slug = body.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "STATION";
				const stationCode = body.stationCode ?? `ST-${slug}-${String(displayOrder).padStart(2, "0")}`;
				const station = await transaction.station.create({
					data: {
						name: body.name,
						stationCode,
						stageId,
						productionLineId,
						displayOrder,
						workspaceId: process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS",
						screenType: body.screenType ?? "COMPUTER",
						scannerAttached: body.scannerAttached ?? true,
						printerAttached: body.printerAttached ?? true,
					},
				});
				await recordCommandSuccess(transaction, req, "STATION_CREATED", "Station", station.id, { stationCode: station.stationCode });
				return { status: 201, body: { stationId: station.id, stationCode: station.stationCode, name: station.name }, headers: { Location: `/api/v1/stations/${station.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.put("/stations/order", requireSetupManage(requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stationOrderReplaceSchema);
			const stationIds = [...new Set(body.stationIds)];
			const response = await executeCommand(database, req, "stationOrderReplace", { stationIds }, async (transaction) => {
				const found = await transaction.station.findMany({ where: { id: { in: stationIds } }, select: { id: true } });
				if (found.length !== stationIds.length) notFound("The requested station was not found.");
				for (let index = 0; index < stationIds.length; index += 1) {
					const stationId = stationIds[index];
					if (!stationId) continue;
					await transaction.station.update({ where: { id: stationId }, data: { displayOrder: index + 1 } });
				}
				const remainder = await transaction.station.findMany({
					where: {
						id: { notIn: stationIds },
						isEnabled: true,
						productionLine: { kind: "MANUFACTURING" },
					},
					orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
					select: { id: true },
				});
				for (let index = 0; index < remainder.length; index += 1) {
					const stationId = remainder[index]?.id;
					if (!stationId) continue;
					await transaction.station.update({
						where: { id: stationId },
						data: { displayOrder: stationIds.length + index + 1 },
					});
				}
				await recordCommandSuccess(transaction, req, "STATION_ORDER_REPLACED", "Station", stationIds[0] ?? "order", { stationCount: stationIds.length });
				return { status: 200, body: { stationIds }, headers: { Location: "/api/v1/stations/order" } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.put("/stations/:stationId/processes", requireSetupManage(requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stationProcessReplaceSchema);
			const stationId = req.params.stationId;
			const processIds = [...new Set(body.processIds)];
			const response = await executeCommand(database, req, "stationProcessReplace", { stationId, processIds }, async (transaction) => {
				const station = await transaction.station.findUnique({ where: { id: stationId }, select: { id: true } });
				if (!station) notFound("The requested station was not found.");
				if (processIds.length > 0) {
					const found = await transaction.workProcess.findMany({ where: { id: { in: processIds } }, select: { id: true } });
					if (found.length !== processIds.length) notFound("The requested process was not found.");
				}
				await transaction.stationProcess.deleteMany({ where: { stationId } });
				for (const processId of processIds) {
					await transaction.stationProcess.create({ data: { stationId, processId } });
				}
				await recordCommandSuccess(transaction, req, "STATION_PROCESSES_REPLACED", "Station", stationId, { processCount: processIds.length });
				return { status: 200, body: { stationId, processIds }, headers: { Location: `/api/v1/stations/${stationId}/processes` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/work-processes", requireSetupManage(requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, workProcessCreateSchema);
			const response = await executeCommand(database, req, "workProcessCreate", body, async (transaction) => {
				if (body.stationId) {
					const station = await transaction.station.findUnique({ where: { id: body.stationId }, select: { id: true } });
					if (!station) notFound("The requested station was not found.");
				}
				const last = await transaction.workProcess.findFirst({ orderBy: { displayOrder: "desc" }, select: { displayOrder: true } });
				const process = await transaction.workProcess.create({
					data: {
						name: body.name,
						labelledCycleTimeSec: body.labelledCycleTimeSec ?? null,
						displayOrder: (last?.displayOrder ?? 0) + 1,
						isEnabled: true,
						isSystemSeed: false,
						subStageId: null,
					},
				});
				if (body.stationId) {
					await transaction.stationProcess.create({ data: { stationId: body.stationId, processId: process.id } });
				}
				await recordCommandSuccess(transaction, req, "WORK_PROCESS_CREATED", "WorkProcess", process.id, { name: process.name, stationId: body.stationId ?? null });
				return {
					status: 201,
					body: {
						processId: process.id,
						name: process.name,
						labelledCycleTimeSec: process.labelledCycleTimeSec,
						stationId: body.stationId ?? null,
					},
					headers: { Location: `/api/v1/work-processes/${process.id}` },
				};
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.put("/parts-lists/:partsListId/parts/:partId/route", requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, partRouteReplaceSchema);
			const partsListId = req.params.partsListId;
			const partId = req.params.partId;
			const response = await executeCommand(database, req, "partRouteReplace", { partsListId, partId, steps: body.steps }, async (transaction) => {
				const partsList = await transaction.partsList.findUnique({ where: { id: partsListId }, select: { id: true } });
				const part = await transaction.part.findUnique({ where: { id: partId }, select: { id: true } });
				if (!partsList || !part) notFound("The requested parts list or part was not found.");
				const stationIds = [...new Set(body.steps.map((step) => step.stationId))];
				const stations = stationIds.length
					? await transaction.station.findMany({
						where: { id: { in: stationIds } },
						select: { id: true, stageId: true, boundSteps: { select: { subStageId: true }, take: 1 } },
					})
					: [];
				if (stations.length !== stationIds.length) notFound("The requested station was not found.");
				const processIds = [...new Set(body.steps.map((step) => step.processId).filter((id): id is string => Boolean(id)))];
				if (processIds.length > 0) {
					const found = await transaction.workProcess.findMany({ where: { id: { in: processIds } }, select: { id: true } });
					if (found.length !== processIds.length) notFound("The requested process was not found.");
				}
				await transaction.routingStep.deleteMany({ where: { partsListId, partId } });
				const created: Array<{ routeStepId: string; stationId: string | null; processId: string | null; stepOrder: number }> = [];
				for (const [index, step] of body.steps.entries()) {
					const station = stations.find((row) => row.id === step.stationId);
					if (!station) notFound("The requested station was not found.");
					const row = await transaction.routingStep.create({
						data: {
							partsListId,
							partId,
							stationId: step.stationId,
							processId: step.processId ?? null,
							stageId: station.stageId,
							subStageId: station.boundSteps[0]?.subStageId ?? null,
							stepOrder: step.stepOrder ?? index + 1,
						},
					});
					created.push({
						routeStepId: row.id,
						stationId: row.stationId,
						processId: row.processId,
						stepOrder: row.stepOrder,
					});
				}
				await recordCommandSuccess(transaction, req, "PART_ROUTE_REPLACED", "Part", partId, { partsListId, stepCount: created.length });
				return {
					status: 200,
					body: { partsListId, partId, steps: created },
					headers: { Location: `/api/v1/parts-lists/${partsListId}/parts/${partId}/route` },
				};
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

	router.put("/monitoring/daily-sheets/:sheetId", requireCapability("daily-metrics.encode", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, monitoringDailySheetUpsertSchema);
			const sheetId = req.params.sheetId;
			const payload = body.payload as Record<string, unknown>;
			const response = await executeCommand(database, req, "monitoringDailySheetUpsert", { sheetId, ...body }, async (transaction) => {
				const existing = await transaction.monitoringDailySheet.findUnique({ where: { id: sheetId } });
				const expectedVersion = existing ? requireIfMatch(req, "monitoring daily sheet") : null;
				if (existing && expectedVersion !== existing.rowVersion) staleVersion();
				const productionDate = String(payload.date ?? "");
				const processName = String(payload.processName ?? "");
				const slotsJson = payload.slots ?? [];
				const workProcessId =
					typeof payload.processId === "string" && payload.processId.length > 0 ? payload.processId : null;
				let stageId = typeof payload.stageId === "string" && payload.stageId.length > 0 ? payload.stageId : null;
				let subStageId =
					typeof payload.subStageId === "string" && payload.subStageId.length > 0 ? payload.subStageId : null;
				if (workProcessId && (!stageId || !subStageId)) {
					const process = await transaction.workProcess.findUnique({
						where: { id: workProcessId },
						select: { subStageId: true, subStage: { select: { eligibleStages: { select: { stageId: true } } } } },
					});
					if (process) {
						subStageId = subStageId ?? process.subStageId;
						stageId = stageId ?? process.subStage.eligibleStages[0]?.stageId ?? null;
					}
				}
				const workspaceId = process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS";
				await assertLineLeaderSheetCoverage(transaction, actorId(req), workspaceId, {
					stageId,
					subStageId,
					workProcessId,
				});
				const data = {
					workspaceId,
					productionDate,
					lineLabel: String(payload.lineLabel ?? ""),
					stageId,
					subStageId,
					workProcessId,
					encodedBySubjectId: actorId(req),
					processName,
					lineLeaderName: String(payload.lineLeaderName ?? ""),
					productName: String(payload.productName ?? ""),
					modelName: String(payload.modelName ?? ""),
					partName: String(payload.partName ?? ""),
					lotCode: String(payload.lotCode ?? ""),
					targetPerShift: Number(payload.targetPerShift ?? 0) || 0,
					hourlyTarget: Number(payload.hourlyTarget ?? 0) || 0,
					operatorNames: String(payload.operatorNames ?? ""),
					inputPartsAvailable:
						payload.inputPartsAvailable === null || payload.inputPartsAvailable === undefined
							? null
							: Number(payload.inputPartsAvailable),
					defectiveQty:
						payload.defectiveQty === null || payload.defectiveQty === undefined
							? null
							: Number(payload.defectiveQty),
					status: String(payload.status ?? "draft"),
					slotsJson: JSON.parse(JSON.stringify(slotsJson)) as never,
					payloadJson: JSON.parse(JSON.stringify({ ...payload, id: sheetId })) as never,
				};
				const sheet = existing
					? await transaction.monitoringDailySheet.update({
							where: { id: sheetId },
							data: { ...data, rowVersion: existing.rowVersion + 1 },
						})
					: await transaction.monitoringDailySheet.create({
							data: { id: sheetId, ...data, rowVersion: 1 },
						});
				await recordCommandSuccess(transaction, req, "MONITORING_DAILY_SHEET_UPSERT", "MonitoringDailySheet", sheet.id, {
					productionDate: sheet.productionDate,
				});
				return {
					status: existing ? 200 : 201,
					body: sheet.payloadJson ?? { id: sheet.id },
					headers: {
						Location: `/api/v1/monitoring/daily-sheets/${sheet.id}`,
						ETag: `"${sheet.rowVersion}"`,
					},
				};
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.put("/monitoring/station-boards/:boardId", requireCapability("monitoring.station.encode", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, monitoringStationBoardUpsertSchema);
			const boardId = req.params.boardId;
			const payload = body.payload as Record<string, unknown>;
			const response = await executeCommand(database, req, "monitoringStationBoardUpsert", { boardId, ...body }, async (transaction) => {
				const existing = await transaction.monitoringStationBoard.findUnique({ where: { id: boardId } });
				const expectedVersion = existing ? requireIfMatch(req, "monitoring station board") : null;
				if (existing && expectedVersion !== existing.rowVersion) staleVersion();
				const productionDate = String(payload.date ?? "");
				const slotsJson = payload.slots ?? [];
				const boothId =
					typeof payload.boothId === "string" && payload.boothId.length > 0 ? payload.boothId : null;
				const data = {
					workspaceId: process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS",
					productionDate,
					boothId,
					workProcessId:
						typeof payload.processId === "string" && payload.processId.length > 0
							? payload.processId
							: null,
					boothLabel: String(payload.boothLabel ?? ""),
					processName: String(payload.processName ?? ""),
					partName: String(payload.partName ?? ""),
					lotCode: String(payload.lotCode ?? ""),
					labelledCycleTimeSec: Number(payload.labelledCycleTimeSec ?? 0) || 0,
					targetPerHour: Number(payload.targetPerHour ?? 0) || 0,
					targetPerDay: Number(payload.targetPerDay ?? 0) || 0,
					slotsJson: JSON.parse(JSON.stringify(slotsJson)) as never,
					payloadJson: JSON.parse(JSON.stringify({ ...payload, id: boardId })) as never,
				};
				const board = existing
					? await transaction.monitoringStationBoard.update({
							where: { id: boardId },
							data: { ...data, rowVersion: existing.rowVersion + 1 },
						})
					: await transaction.monitoringStationBoard.create({
							data: { id: boardId, ...data, rowVersion: 1 },
						});
				await recordCommandSuccess(transaction, req, "MONITORING_STATION_BOARD_UPSERT", "MonitoringStationBoard", board.id, {
					productionDate: board.productionDate,
				});
				return {
					status: existing ? 200 : 201,
					body: board.payloadJson,
					headers: {
						Location: `/api/v1/monitoring/station-boards/${board.id}`,
						ETag: `"${board.rowVersion}"`,
					},
				};
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	return router;
}
