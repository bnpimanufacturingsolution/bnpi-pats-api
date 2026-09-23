import { Router, type Request, type RequestHandler } from "express";
import { z } from "zod";
import {
	Prisma,
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
import { hasCapability } from "../identity/policy";
import type { SubjectAssignmentRecord } from "../identity/types";
import { assertQualityStageAllowed } from "./quality-stage-scope";
import { recordPrintJob } from "./print-job";
import { allowUnauthenticatedDeskPrint, deliverDeskLabel } from "./print-desk";

const decimalString = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, "Must be a non-negative decimal with up to 6 places.");

const productionPlanCreateSchema = z.object({
	planCode: z.string().trim().min(1).max(120).optional(),
	projectCode: z.string().trim().min(1).max(120).optional(),
	name: z.string().trim().min(1).max(240),
	requiredProductionQuantity: z.number().int().positive(),
	productId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict().refine((body) => Boolean(body.projectCode || body.planCode), "Either projectCode or planCode is required.");

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
	sectionId: z.string().trim().min(1).max(100).optional(),
	reprintOf: z.string().trim().min(1).max(100).nullable().optional(),
	// Actual pcs in the completed pack (label truth). Optional — defaults to the
	// planned pack quantity; must be a positive integer when provided.
	actualQuantity: z.number().int().positive().nullable().optional(),
}).strict().refine((body) => Boolean(body.sectionId), "sectionId is required.");

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
	sectionId: z.string().trim().min(1).max(100).nullable().optional(),
	inspectedQuantity: decimalString.nullable().optional(),
	quantityUom: z.string().trim().min(1).max(40).nullable().optional(),
	evidence: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

// Finalization override map for a run-scoped plan part (REQ-CT per-step CT).
// Required but nullable: clients send explicit null to fall back to the snapshot.
const planPartCycleTimesSchema = z.object({
	plannedCycleTimesOverride: z
		.record(z.string().trim().min(1).max(220), z.number().int().min(1).max(86400))
		.nullable(),
}).strict();

const qualityDecisionSchema = z
	.object({
		decision: z.enum(["PASSED", "FAILED", "HOLD"]),
		reasonCode: z.string().trim().max(80).nullable().optional(),
		reasonNote: z.string().trim().max(500).nullable().optional(),
	})
	.strict()
	.superRefine((body, ctx) => {
		// A fail must say why (2026-09-09 QC plan D3); PASSED/HOLD need no reason.
		if (body.decision === "FAILED" && !(body.reasonCode && body.reasonCode.length > 0)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["reasonCode"],
				message: "A FAILED decision requires a reason code.",
			});
		}
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

const sectionCreateSchema = z.object({
	name: z.string().trim().min(1).max(160),
		sectionCode: z.string().trim().min(1).max(80).optional(),
		// stageId/displayOrder are optional: the board's create flow carries no
	// stage context, so the server places new sections in the first stage
	// and appends them. Explicit values are still honored when provided.
	stageId: z.string().trim().min(1).max(100).optional(),
	screenType: z.enum(["COMPUTER", "TABLET"]).optional(),
	scannerAttached: z.boolean().optional(),
	printerAttached: z.boolean().optional(),
	displayOrder: z.number().int().nonnegative().optional(),
}).strict();

const sectionPatchSchema = z.object({
	name: z.string().trim().min(1).max(160).optional(),
	sectionCode: z.string().trim().min(1).max(80).optional(),
}).strict();

const stationStepCreateSchema = z.object({
	sectionId: z.string().trim().min(1).max(100),
	stageId: z.string().trim().min(1).max(100),
	subStageId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

const sectionProcessesSchema = z.object({
	processIds: z.array(z.string().trim().min(1).max(100)).min(0),
}).strict();

const sectionOrderSchema = z.object({
	sectionIds: z.array(z.string().trim().min(1).max(100)).min(1),
}).strict();

const workProcessCreateSchema = z
	.object({
		sectionId: z.string().trim().min(1).max(100).nullable().optional(),
		stationId: z.string().trim().min(1).max(100).nullable().optional(),
		subStageId: z.string().trim().min(1).max(100).nullable().optional(),
		parentProcessId: z.string().trim().min(1).max(100).nullable().optional(),
		name: z.string().min(1),
	})
	.strict()
	.refine(
		(body) => Boolean(body.subStageId) || Boolean(body.sectionId) || Boolean((body as { stationId?: string | null }).stationId),
		"Provide subStageId or sectionId.",
	);

const workProcessPatchSchema = z.object({
	name: z.string().trim().min(1).max(160).optional(),
	parentProcessId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

const lineCodePattern = /^[A-Z0-9](?:[A-Z0-9-]{0,48}[A-Z0-9])?$/;

const lineCreateSchema = z.object({
	sectionId: z.string().trim().min(1).max(100),
	processId: z.string().trim().min(1).max(100),
	lineCode: z.string().trim().regex(lineCodePattern, "Must be uppercase alphanumeric with dashes (1-50 chars).").max(50),
	label: z.string().trim().max(160).nullable().optional(),
	assignedLeaderId: z.string().trim().min(1).max(100),
	displayOrder: z.number().int().nonnegative().optional(),
}).strict();

const linePatchSchema = z.object({
	label: z.string().trim().max(160).nullable().optional(),
	lineCode: z.string().trim().regex(lineCodePattern, "Must be uppercase alphanumeric with dashes (1-50 chars).").max(50).optional(),
	assignedLeaderId: z.string().trim().min(1).max(100).optional(),
	activeLeaderId: z.string().trim().min(1).max(100).nullable().optional(),
	displayOrder: z.number().int().nonnegative().optional(),
	isEnabled: z.boolean().optional(),
}).strict().refine((body) => Object.keys(body).length > 0, "At least one mutable field is required.");

const operatorAssignmentCreateSchema = z.object({
	subjectId: z.string().trim().min(1).max(100),
	lineId: z.string().trim().min(1).max(100),
	reason: z.string().trim().max(500).nullable().optional(),
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

function resourceHeaders(id: string, rowVersion: number, req?: Request): Record<string, string> {
	const isProject = req ? (req.baseUrl + req.path).includes("/projects") : false;
	const base = isProject ? "/api/v1/projects" : "/api/v1/production-plans";
	return { Location: `${base}/${id}`, ETag: `"${rowVersion}"` };
}

function batchHeaders(id: string, rowVersion: number): Record<string, string> {
	return { Location: `/api/v1/batches/${id}`, ETag: `"${rowVersion}"` };
}

function planResponse(plan: { id: string; projectCode: string; name: string; status: string; requiredProductionQuantity: number; productId: string | null; rowVersion: number }, req?: Request) {
	const isProject = req ? (req.baseUrl + req.path).includes("/projects") : false;
	const base = {
		planId: plan.id,
		planCode: plan.projectCode,
		name: plan.name,
		status: plan.status,
		requiredProductionQuantity: plan.requiredProductionQuantity,
		productId: plan.productId,
		rowVersion: plan.rowVersion,
	};
	if (isProject) {
		return {
			projectId: plan.id,
			projectCode: plan.projectCode,
			...base,
		};
	}
	return base;
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

function malformed(detail: string): never {
	throw new CommandProblem(400, "urn:bandai:pats:problem:malformed-request", "Bad Request", detail);
}

function forbidden(detail: string): never {
	throw new CommandProblem(403, "urn:bandai:pats:problem:authorization-denied", "Forbidden", detail);
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

/**
 * D1 capability split: one route, two gates. RECEIVING material in is the
 * operator's floor duty (inventory.receive); issuing material out stays behind
 * the stricter inventory.issue. The body is parsed before this middleware runs
 * (express.json mounts in the canonical router), so transactionType is
 * readable; unknown/missing types fall back to the legacy inventory.issue gate
 * and fail schema validation (400) for capability holders — fail-closed either
 * way.
 */
function requireInventoryTransactionCapability(gate: (capability: string) => RequestHandler): RequestHandler {
	return (req, res, next) => {
		const transactionType = (req.body as { transactionType?: unknown } | null | undefined)?.transactionType;
		const capability = transactionType === "RECEIVING" ? "inventory.receive" : "inventory.issue";
		return gate(capability)(req, res, next);
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

	router.post(["/projects", "/production-plans"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, productionPlanCreateSchema);
			const response = await executeCommand(database, req, "productionPlanCreate", body, async (transaction) => {
				if (body.productId) {
					const product = await transaction.product.findUnique({ where: { id: body.productId }, select: { id: true } });
					if (!product) notFound("The requested catalog product was not found.");
				}
				const planCode = (body.projectCode ?? body.planCode)!;
				const plan = await transaction.project.create({
					data: {
						workspaceId: process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS",
						projectCode: planCode,
						name: body.name,
						requiredProductionQuantity: body.requiredProductionQuantity,
						status: PlanLifecycleStatus.DRAFT,
						productId: body.productId ?? null,
					},
				});
				await recordCommandSuccess(transaction, req, "PRODUCTION_PLAN_CREATED", "ProductionPlan", plan.id, { planCode: plan.projectCode });
				return { status: 201, body: planResponse(plan, req), headers: resourceHeaders(plan.id, plan.rowVersion, req) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.patch(["/projects/:projectId", "/production-plans/:planId"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const targetId = req.params.projectId ?? req.params.planId;
			const body = parseCommandBody(req, productionPlanPatchSchema);
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanPatch", { planId: targetId, body }, async (transaction) => {
				const current = await transaction.project.findUnique({ where: { id: targetId } });
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
				return { status: 200, body: planResponse(plan, req), headers: resourceHeaders(plan.id, plan.rowVersion, req) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post(["/projects/:projectId/model-allocations", "/production-plans/:planId/model-allocations"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const targetId = req.params.projectId ?? req.params.planId;
			const body = parseCommandBody(req, productionPlanModelAllocationSchema);
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanModelAllocationUpsert", { planId: targetId, body }, async (transaction) => {
				const plan = await transaction.project.findUnique({ where: { id: targetId }, select: { id: true, productId: true, status: true, rowVersion: true } });
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
							plannedCycleTimes: (modelPart.plannedCycleTimes as Record<string, number> | null) ?? undefined,
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
				return { status: 200, body: { allocationId: allocation.id, modelId: allocation.modelId, plannedQuantity: allocation.plannedQuantity, partsListVersionId, planRowVersion: updatedPlan.rowVersion }, headers: resourceHeaders(plan.id, updatedPlan.rowVersion, req) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post(["/projects/:projectId/parts-list-versions", "/production-plans/:planId/parts-list-versions"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const targetId = req.params.projectId ?? req.params.planId;
			const body = parseCommandBody(req, productionPlanPartsListVersionSchema);
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanPartsListVersionCreate", { planId: targetId, body }, async (transaction) => {
				const plan = await transaction.project.findUnique({ where: { id: targetId }, select: { id: true, status: true, rowVersion: true } });
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
				return { status: 201, body: { partsListVersionId: partsList.id, version: partsList.version, planRowVersion: updatedPlan.rowVersion }, headers: resourceHeaders(plan.id, updatedPlan.rowVersion, req) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.patch(["/projects/:projectId/parts/:partId", "/production-plans/:planId/parts/:partId"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const targetId = req.params.projectId ?? req.params.planId;
			const partId = req.params.partId;
			const body = parseCommandBody(req, planPartCycleTimesSchema);
			const expectedVersion = requireIfMatch(req, "plan part");
			const response = await executeCommand(database, req, "planPartCycleTimeOverride", { planId: targetId, partId, body }, async (transaction) => {
				const part = await transaction.part.findUnique({ where: { id: partId }, select: { id: true, projectId: true, rowVersion: true } });
				if (!part || part.projectId !== targetId) notFound("The requested plan part was not found in this production plan.");
				const plan = await transaction.project.findUnique({ where: { id: targetId }, select: { id: true, status: true } });
				if (!plan) notFound("The owning production plan was not found.");
				ensurePlanEditable(plan);
				if (part.rowVersion !== expectedVersion) staleVersion();
				const updated = await transaction.part.update({ where: { id: part.id }, data: { plannedCycleTimesOverride: body.plannedCycleTimesOverride ?? Prisma.JsonNull, rowVersion: { increment: 1 } }, select: { id: true, plannedCycleTimes: true, plannedCycleTimesOverride: true, rowVersion: true } });
				// Prisma reads JSON NULL back as null, but the write sentinel can echo
				// through stubbed stores — normalize so the wire contract stays plain.
				const asCycleMap = (value: unknown): Record<string, number> | null =>
					value === null || value === undefined || value === Prisma.JsonNull || value === Prisma.DbNull
						? null
						: (value as Record<string, number>);
				const snapshot = asCycleMap(updated.plannedCycleTimes);
				const override = asCycleMap(updated.plannedCycleTimesOverride);
				await recordCommandSuccess(transaction, req, "PLAN_PART_CYCLE_TIME_OVERRIDDEN", "Part", updated.id, { projectId: targetId, rowVersion: updated.rowVersion });
				return { status: 200, body: { partId: updated.id, plannedCycleTimes: snapshot, plannedCycleTimesOverride: override }, headers: { ETag: `"${updated.rowVersion}"` } };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post(["/projects/:projectId/release", "/production-plans/:planId/release"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const targetId = req.params.projectId ?? req.params.planId;
			const expectedVersion = requireIfMatch(req, "production plan");
			const response = await executeCommand(database, req, "productionPlanRelease", { planId: targetId, expectedVersion }, async (transaction) => {
				const current = await transaction.project.findUnique({ where: { id: targetId } });
				if (!current) notFound("The requested production plan was not found.");
				if (current.rowVersion !== expectedVersion) staleVersion();
				if (current.status !== PlanLifecycleStatus.DRAFT && current.status !== PlanLifecycleStatus.READY) conflict("Only draft or ready production plans can be released.");
				const plan = await transaction.project.update({
					where: { id: current.id },
					data: { status: PlanLifecycleStatus.RELEASED, releasedAt: new Date(), releasedBySubjectId: actorId(req), rowVersion: { increment: 1 } },
				});
				await recordCommandSuccess(transaction, req, "PRODUCTION_PLAN_RELEASED", "ProductionPlan", plan.id, { rowVersion: plan.rowVersion });
				return { status: 200, body: planResponse(plan, req), headers: resourceHeaders(plan.id, plan.rowVersion, req) };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.delete(["/projects/:projectId", "/production-plans/:planId"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const targetId = req.params.projectId ?? req.params.planId;
			const ifMatch = req.header("If-Match");
			const expectedVersion = ifMatch?.match(/^"(\d+)"$/) ? Number(ifMatch.match(/^"(\d+)"$/)![1]) : undefined;
			const response = await executeCommand(database, req, "projectDraftDelete", { projectId: targetId }, async (transaction) => {
				const current = await transaction.project.findUnique({
					where: { id: targetId },
					include: { lots: { select: { id: true } } },
				});
				if (!current) notFound("The requested project was not found.");
				if (expectedVersion !== undefined && current.rowVersion !== expectedVersion) staleVersion();
				if (current.status !== PlanLifecycleStatus.DRAFT) {
					conflict("Released or completed projects cannot be deleted.");
				}
				if (current.lots.length > 0) {
					conflict("Projects with lots cannot be deleted.");
				}
				const partsLists = await transaction.partsList.findMany({ where: { projectId: current.id }, select: { id: true } });
				if (partsLists.length > 0) {
					const partsListIds = partsLists.map((p) => p.id);
					await transaction.routingStep.deleteMany({ where: { partsListId: { in: partsListIds } } });
					await transaction.partsList.deleteMany({ where: { id: { in: partsListIds } } });
				}
				await transaction.part.deleteMany({ where: { projectId: current.id } });
				await transaction.projectModelAllocation.deleteMany({ where: { projectId: current.id } });
				await transaction.planDemandAllocation.deleteMany({ where: { projectId: current.id } });
				await transaction.materialRequirement.deleteMany({ where: { projectId: current.id } });
				await transaction.productSpecification.deleteMany({ where: { projectId: current.id } });
				await transaction.pmrs.deleteMany({ where: { projectId: current.id } });
				await transaction.workflowGroup.deleteMany({ where: { projectId: current.id } });
				await transaction.processChangeLog.deleteMany({ where: { projectId: current.id } });

				await transaction.project.delete({ where: { id: current.id } });

				await recordCommandSuccess(transaction, req, "PROJECT_DRAFT_DELETED", "Project", current.id, {
					projectCode: current.projectCode,
					name: current.name,
				});

				return { status: 204, body: null, headers: {} };
			});
			respondCommand(res, response);
		} catch (error) {
			commandError(error, req, res, next);
		}
	});

	router.post(["/projects/:projectId/lots", "/production-plans/:planId/lots"], requireCapability("planning.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const targetId = req.params.projectId ?? req.params.planId;
			const body = parseCommandBody(req, lotCreateSchema);
			const response = await executeCommand(database, req, "productionPlanLotCreate", { planId: targetId, body }, async (transaction) => {
				const plan = await transaction.project.findUnique({ where: { id: targetId }, select: { id: true } });
				if (!plan) notFound("The requested production plan was not found.");
				const partsList = await transaction.partsList.findFirst({ where: { id: body.partsListId, projectId: targetId, version: body.partsListVersion }, select: { id: true } });
				if (!partsList) notFound("The requested parts-list version was not found for this production plan.");
				const part = await transaction.part.findFirst({ where: { id: body.partId, projectId: targetId }, select: { id: true, partName: true } });
				if (!part) notFound("The requested plan part was not found.");
				const lot = await transaction.lot.create({
					data: {
						projectId: targetId,
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
				await recordCommandSuccess(transaction, req, "LOT_CREATED", "Lot", lot.id, { planId: targetId, lotCode: lot.lotCode });
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
			const sectionId = body.sectionId;
			const response = await executeCommand(database, req, "printJobCreate", body, async (transaction) => {
				try {
					const job = await recordPrintJob(transaction as unknown as Parameters<typeof recordPrintJob>[0], {
						batchId: body.batchId,
					sectionId: sectionId!,
					reprintOf: body.reprintOf ?? null,
					actualQuantity: body.actualQuantity ?? null,
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
						notFound("The requested section was not found.");
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

	router.post("/inventory-transactions", requireInventoryTransactionCapability(requireCanonicalCapability), async (req, res, next) => {
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
				await assertQualityStageAllowed(transaction, actorId(req), body.stageId);
				const batch = await transaction.batch.findUnique({ where: { id: body.batchId }, select: { id: true } });
				if (!batch) notFound("The requested batch was not found.");
				const inspection = await transaction.qualityInspection.create({
					data: {
						batchId: body.batchId,
						stageId: body.stageId,
						subStageId: body.subStageId ?? null,
						sectionId: (body.sectionId) ?? null,
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

	router.post("/sections", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, sectionCreateSchema);
			const response = await executeCommand(database, req, "sectionCreate", body, async (transaction) => {
				let stageId = body.stageId;
				if (stageId) {
					const stage = await transaction.stage.findUnique({ where: { id: stageId }, select: { id: true } });
					if (!stage) notFound("The requested section stage was not found.");
				} else {
					const firstStage = await transaction.stage.findFirst({ orderBy: [{ displayOrder: "asc" }, { id: "asc" }], select: { id: true } });
					if (!firstStage) notFound("No stage exists to own the section.");
					stageId = firstStage.id;
				}
				const providedCode = body.sectionCode;
				let sectionCode: string;
				if (providedCode) {
					const clash = await transaction.section.findUnique({ where: { sectionCode: providedCode } });
					if (clash) conflict("The section code is already in use.");
					sectionCode = providedCode;
				} else {
					const stem = `SEC-${body.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "SEC"}`;
					sectionCode = stem;
					for (let attempt = 1; ; attempt++) {
						const clash = await transaction.section.findUnique({ where: { sectionCode } });
						if (!clash) break;
						sectionCode = `${stem}-${attempt + 1}`;
					}
				}
				const displayOrder = body.displayOrder ?? await transaction.section.count();
				const section = await transaction.section.create({ data: { name: body.name, sectionCode, stageId, screenType: body.screenType ?? "COMPUTER", scannerAttached: body.scannerAttached ?? true, printerAttached: body.printerAttached ?? true, displayOrder, workspaceId: process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS" } });

				// Create bound steps for all sub-stages of this stage so work processes
				// can resolve their sub-stage via the section's bound steps.
				const subStages = await transaction.subStage.findMany({
					where: { eligibleStages: { some: { stageId } } },
					select: { id: true },
				});
				if (subStages.length > 0) {
					await transaction.stationStep.createMany({
						data: subStages.map((subStage) => ({
							sectionId: section.id,
							stageId,
							subStageId: subStage.id,
						})),
						skipDuplicates: true,
					});
				}

				await recordCommandSuccess(transaction, req, "SECTION_CREATED", "Section", section.id, { sectionCode: section.sectionCode });
				return { status: 201, body: { sectionId: section.id, sectionCode: section.sectionCode, name: section.name }, headers: { Location: `/api/v1/sections/${section.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.patch("/sections/:sectionId", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, sectionPatchSchema);
			const sectionId = req.params.sectionId;
			const response = await executeCommand(database, req, "sectionUpdate", { sectionId, body }, async (transaction) => {
				const section = await transaction.section.findUnique({ where: { id: sectionId }, select: { id: true, name: true } });
				if (!section) notFound("The requested section was not found.");
				const data: Record<string, unknown> = {};
				if (body.name !== undefined) data.name = body.name;
				const nextCode = body.sectionCode;
				if (nextCode !== undefined) data.sectionCode = nextCode;
				if (Object.keys(data).length === 0) conflict("At least one field must be provided.");
				const updated = await transaction.section.update({ where: { id: sectionId }, data });
				await recordCommandSuccess(transaction, req, "SECTION_UPDATED", "Section", sectionId, { name: updated.name });
				// No ETag: Section rows carry no rowVersion validator, so concurrent
				// updates are last-writer-wins (documented N/A per standard §9).
				return { status: 200, body: { sectionId: updated.id, name: updated.name }, headers: { Location: `/api/v1/sections/${updated.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/station-steps", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, stationStepCreateSchema);
			const response = await executeCommand(database, req, "stationStepCreate", body, async (transaction) => {
				const section = await transaction.section.findUnique({ where: { id: body.sectionId }, select: { id: true } });
				const stage = await transaction.stage.findUnique({ where: { id: body.stageId }, select: { id: true } });
				if (!section || !stage) notFound("The requested section or stage was not found.");
				const step = await transaction.stationStep.create({ data: { ...body, subStageId: body.subStageId ?? null } });
				await recordCommandSuccess(transaction, req, "STATION_STEP_CREATED", "StationStep", step.id, { sectionId: step.sectionId, stageId: step.stageId });
				return { status: 201, body: { stationStepId: step.id, sectionId: step.sectionId, stageId: step.stageId, subStageId: step.subStageId }, headers: { Location: `/api/v1/station-steps/${step.id}` } };
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
				const data = {
					workspaceId: process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS",
					productionDate,
					lineLabel: String(payload.lineLabel ?? ""),
					workProcessId: typeof payload.processId === "string" && payload.processId.length > 0 ? payload.processId : null,
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
					body: sheet.payloadJson,
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

	router.put("/sections/:sectionId/processes", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, sectionProcessesSchema);
			const sectionId = req.params.sectionId;
			const response = await executeCommand(database, req, "sectionProcessesReplace", { sectionId, processIds: body.processIds }, async (transaction) => {
				const section = await transaction.section.findUnique({ where: { id: sectionId } });
				if (!section) notFound("The requested section was not found.");
				if (body.processIds.length > 0) {
					const processes = await transaction.workProcess.findMany({ where: { id: { in: body.processIds } } });
					const foundIds = new Set(processes.map((p) => p.id));
					const missing = body.processIds.filter((id) => !foundIds.has(id));
					if (missing.length > 0) notFound(`The following work processes were not found: ${missing.join(", ")}`);
				}
				await transaction.booth.updateMany({
					where: { sectionId: sectionId, workProcessId: { notIn: body.processIds } },
					data: { workProcessId: null },
				});
				for (const processId of body.processIds) {
					const booth = await transaction.booth.findFirst({ where: { sectionId: sectionId, workProcessId: null } });
					if (booth) {
						await transaction.booth.update({ where: { id: booth.id }, data: { workProcessId: processId } });
					}
				}
				// Board membership truth: the section owns exactly this process
				// set. Listed processes are claimed; processes this section
				// owned but no longer listed become unowned. Processes owned
				// by other sections are never touched.
				await transaction.workProcess.updateMany({
					where: { id: { in: body.processIds } },
					data: { sectionId },
				});
				await transaction.workProcess.updateMany({
					where: { id: { notIn: body.processIds }, sectionId },
					data: { sectionId: null },
				});
				for (const [index, processId] of body.processIds.entries()) {
					await transaction.workProcess.update({ where: { id: processId }, data: { displayOrder: index } });
				}
				await recordCommandSuccess(transaction, req, "SECTION_PROCESSES_REPLACED", "Section", sectionId, { processCount: body.processIds.length });
				// No ETag: Section rows carry no rowVersion validator (last-writer-wins, N/A per standard §9).
				return { status: 200, body: { sectionId, processIds: body.processIds }, headers: { Location: `/api/v1/sections/${sectionId}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.put("/sections/order", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, sectionOrderSchema);
			const sectionIds = body.sectionIds;
			const response = await executeCommand(database, req, "sectionOrderReorder", { sectionIds }, async (transaction) => {
				const sections = await transaction.section.findMany({ where: { id: { in: sectionIds } } });
				const foundIds = new Set(sections.map((s) => s.id));
				const missing = sectionIds.filter((id) => !foundIds.has(id));
				if (missing.length > 0) notFound(`The following sections were not found: ${missing.join(", ")}`);
				for (const [index, sectionId] of sectionIds.entries()) {
					await transaction.section.update({ where: { id: sectionId }, data: { displayOrder: index } });
				}
				await recordCommandSuccess(transaction, req, "SECTIONS_REORDERED", "Section", sectionIds[0] ?? "", { sectionCount: sectionIds.length });
				// No ETag: ordering carries no rowVersion validator (last-writer-wins, N/A per standard §9).
				return { status: 200, body: { sectionIds }, headers: { Location: `/api/v1/sections` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/work-processes", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, workProcessCreateSchema) as typeof workProcessCreateSchema._type & { stationId?: string | null };
			const sectionRef = body.sectionId ?? body.stationId ?? null;
			let resolvedSubStageId = body.subStageId ?? null;
			if (!resolvedSubStageId && sectionRef) {
				const section = await database.section.findFirst({
					where: { id: sectionRef },
					select: { boundSteps: { select: { subStageId: true } } },
				});
				if (section?.boundSteps.length) {
					resolvedSubStageId = section.boundSteps.find((step) => step.subStageId !== null)?.subStageId ?? null;
				}
			}
			if (!resolvedSubStageId) {
				malformed("The section has no bound sub-stage.");
				return;
			}
			const subStage = await database.subStage.findUnique({ where: { id: resolvedSubStageId }, select: { id: true } });
			if (!subStage) notFound("The requested sub-stage was not found.");
			// Senior guard: self-parent and cycle-proof. The app's descendantIds is
			// already cycle-proof, but the API must not trust the client.
			if (body.parentProcessId) {
				if (body.parentProcessId.trim().length === 0) malformed("parentProcessId must be a valid identifier.");
				const parent = await database.workProcess.findUnique({ where: { id: body.parentProcessId }, select: { id: true, parentProcessId: true } });
				if (!parent) notFound("The requested parent process was not found.");
				// Cycle check: walk parent chain, abort if we loop (defensive, 50 hops max)
				let cursor: string | null = parent.parentProcessId;
				const seen = new Set<string>([parent.id]);
				for (let hops = 0; hops < 50 && cursor; hops++) {
					if (seen.has(cursor)) break;
					seen.add(cursor);
					const next = await database.workProcess.findUnique({ where: { id: cursor }, select: { parentProcessId: true } });
					if (!next) break;
					cursor = next.parentProcessId;
				}
			}
			const response = await executeCommand(database, req, "workProcessCreate", { subStageId: resolvedSubStageId, name: body.name, sectionId: sectionRef, parentProcessId: body.parentProcessId }, async (transaction) => {
				const order = await transaction.workProcess.count({ where: { subStageId: resolvedSubStageId } });
				const process = await transaction.workProcess.create({
					data: { subStageId: resolvedSubStageId, name: body.name, displayOrder: order, isEnabled: true, isSystemSeed: false, sectionId: sectionRef ?? null, parentProcessId: body.parentProcessId ?? null },
				});
				await recordCommandSuccess(transaction, req, "WORK_PROCESS_CREATED", "WorkProcess", process.id, { subStageId: process.subStageId, name: process.name, sectionId: process.sectionId, parentProcessId: process.parentProcessId });
				return { status: 201, body: { processId: process.id, subStageId: process.subStageId, name: process.name, sectionId: process.sectionId, parentProcessId: process.parentProcessId }, headers: { Location: `/api/v1/work-processes/${process.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.patch("/work-processes/:processId", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, workProcessPatchSchema);
			const processId = req.params.processId;
			const response = await executeCommand(database, req, "workProcessUpdate", { processId, body }, async (transaction) => {
				const process = await transaction.workProcess.findUnique({ where: { id: processId }, select: { id: true, name: true, subStageId: true } });
				if (!process) notFound("The requested work process was not found.");
				if (body.parentProcessId !== undefined) {
					if (body.parentProcessId === processId) conflict("A process cannot be its own parent.");
					if (body.parentProcessId !== null) {
						const parent = await transaction.workProcess.findUnique({ where: { id: body.parentProcessId }, select: { id: true, parentProcessId: true } });
						if (!parent) notFound("The requested parent process was not found.");
						// Walk parent chain to detect cycle that would make processId an ancestor of its new parent
						let cursor: string | null = parent.parentProcessId;
						const seen = new Set<string>([parent.id]);
						for (let hops = 0; hops < 50 && cursor; hops++) {
							if (cursor === processId) conflict("The requested parent would create a circular reference.");
							if (seen.has(cursor)) break;
							seen.add(cursor);
							const next = await transaction.workProcess.findUnique({ where: { id: cursor }, select: { parentProcessId: true } });
							if (!next) break;
							cursor = next.parentProcessId;
						}
					}
				}
				const data: Record<string, unknown> = {};
				if (body.name !== undefined) data.name = body.name;
				if (body.parentProcessId !== undefined) data.parentProcessId = body.parentProcessId;
				if (Object.keys(data).length === 0) conflict("At least one field must be provided.");
				const updated = await transaction.workProcess.update({ where: { id: processId }, data });
				await recordCommandSuccess(transaction, req, "WORK_PROCESS_UPDATED", "WorkProcess", processId, { name: updated.name });
				// No ETag: WorkProcess rows carry no rowVersion validator (last-writer-wins, N/A per standard §9).
				return { status: 200, body: { processId: updated.id, subStageId: updated.subStageId, name: updated.name, sectionId: updated.sectionId, parentProcessId: updated.parentProcessId }, headers: {} };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.delete("/work-processes/:processId", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const processId = req.params.processId;
			const response = await executeCommand(database, req, "workProcessDelete", { processId }, async (transaction) => {
			const process = await transaction.workProcess.findUnique({ where: { id: processId }, select: { id: true, name: true } });
			if (!process) notFound("The requested work process was not found.");
			// Station-screen lines are operational instances bound to a leaf
			// process through a required FK. Deleting a process with lines
			// would destroy floor evidence, so refuse explicitly (409) instead
			// of tripping the FK into a 500.
			const attachedLineCount = await transaction.line.count({ where: { processId } });
			if (attachedLineCount > 0) conflict(`Cannot delete: ${attachedLineCount} line(s) attached.`);
			// Collect all descendants to unassign (sectionId null) - they become orphaned roots.
			// Direct children are additionally detached from the deleted parent
			// (parentProcessId null); deeper levels keep their own parent links
			// so the surviving subtree stays intact instead of tripping the
			// self-referential FK into a 500.
			const toUnassign = new Set<string>([processId]);
			const queue: string[] = [processId];
			const directChildIds: string[] = [];
			for (let i = 0; i < queue.length && i < 100; i++) {
				const current = queue[i];
				const children = await transaction.workProcess.findMany({ where: { parentProcessId: current }, select: { id: true } });
				for (const child of children) {
					if (!toUnassign.has(child.id)) {
						toUnassign.add(child.id);
						queue.push(child.id);
						if (current === processId) directChildIds.push(child.id);
					}
				}
			}
			// Unassign descendants from sections (keep them in catalog as unassigned, per UI "unassigned" contract)
			// The parent itself will be deleted, so exclude it from unassign
			const descendantIds = Array.from(toUnassign).filter((id) => id !== processId);
			if (descendantIds.length > 0) {
				await transaction.workProcess.updateMany({ where: { id: { in: descendantIds } }, data: { sectionId: null } });
			}
			if (directChildIds.length > 0) {
				await transaction.workProcess.updateMany({ where: { id: { in: directChildIds } }, data: { parentProcessId: null } });
			}
			// Optional references survive the delete as detached rows: durable
			// monitoring evidence keeps its denormalized labels while the FK is
			// cleared, instead of tripping the FK into a 500.
			await transaction.booth.updateMany({ where: { workProcessId: processId }, data: { workProcessId: null } });
			await transaction.monitoringDailySheet.updateMany({ where: { workProcessId: processId }, data: { workProcessId: null } });
			await transaction.monitoringStationBoard.updateMany({ where: { workProcessId: processId }, data: { workProcessId: null } });
			await transaction.workProcess.delete({ where: { id: processId } });
				await recordCommandSuccess(transaction, req, "WORK_PROCESS_DELETED", "WorkProcess", processId, { name: process.name });
				return { status: 200, body: { processId }, headers: {} };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.delete("/sections/:sectionId", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const sectionId = req.params.sectionId;
			const response = await executeCommand(database, req, "sectionDelete", { sectionId }, async (transaction) => {
			const section = await transaction.section.findUnique({ where: { id: sectionId }, select: { id: true, name: true, sectionCode: true } });
			if (!section) notFound("The requested section was not found.");
			// Station-screen lines belong to a section through a required FK.
			// Refuse explicitly (409) instead of tripping the FK into a 500;
			// processes are still unassigned below.
			const attachedSectionLineCount = await transaction.line.count({ where: { sectionId } });
			if (attachedSectionLineCount > 0) conflict(`Cannot delete: ${attachedSectionLineCount} line(s) in this section.`);
			await transaction.stationStep.deleteMany({ where: { sectionId: sectionId } });
				await transaction.booth.updateMany({ where: { sectionId: sectionId }, data: { sectionId: null } });
				await transaction.workProcess.updateMany({ where: { sectionId }, data: { sectionId: null } });
				await transaction.section.delete({ where: { id: sectionId } });
				await recordCommandSuccess(transaction, req, "SECTION_DELETED", "Section", sectionId, { sectionCode: section.sectionCode });
				// 200 with the deleted identifier (audit correlation) is the documented
				// DELETE contract for this resource; repeat deletes return 404.
				return { status: 200, body: { sectionId }, headers: { Location: `/api/v1/sections/${sectionId}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/lines", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, lineCreateSchema);
			const response = await executeCommand(database, req, "lineCreate", body, async (transaction) => {
				const section = await transaction.section.findUnique({ where: { id: body.sectionId }, select: { id: true } });
				if (!section) notFound("The requested section was not found.");
				const process = await transaction.workProcess.findUnique({
					where: { id: body.processId },
					select: { id: true, isEnabled: true, sectionId: true },
				});
				if (!process) notFound("The requested work process was not found.");
				if (!process.isEnabled) conflict("The requested work process is disabled.");
				const childCount = await transaction.workProcess.count({ where: { parentProcessId: body.processId } });
				if (childCount > 0) conflict("Lines attach to leaf processes only; parent counts roll up.");
				const leader = await transaction.subject.findUnique({ where: { id: body.assignedLeaderId }, select: { id: true, status: true } });
				if (!leader) notFound("The requested assigned leader was not found.");
				if (leader.status !== "ACTIVE") conflict("The requested assigned leader is not an active subject.");
				const order = body.displayOrder ?? await transaction.line.count({ where: { sectionId: body.sectionId } });
				const line = await transaction.line.create({
					data: {
						sectionId: body.sectionId,
						processId: body.processId,
						lineCode: body.lineCode,
						label: body.label ?? null,
						assignedLeaderId: body.assignedLeaderId,
						activeLeaderId: body.assignedLeaderId,
						displayOrder: order,
						isEnabled: true,
					},
				});
				await recordCommandSuccess(transaction, req, "LINE_CREATED", "Line", line.id, { lineCode: line.lineCode, processId: line.processId, assignedLeaderId: line.assignedLeaderId });
				return { status: 201, body: { lineId: line.id, lineCode: line.lineCode, sectionId: line.sectionId, processId: line.processId, assignedLeaderId: line.assignedLeaderId, activeLeaderId: line.activeLeaderId, displayOrder: line.displayOrder, isEnabled: line.isEnabled, rowVersion: line.rowVersion }, headers: { Location: `/api/v1/lines/${line.id}`, ETag: `"${line.rowVersion}"` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.patch("/lines/:lineId", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, linePatchSchema);
			const lineId = req.params.lineId;
			const response = await executeCommand(database, req, "lineUpdate", { lineId, ...body }, async (transaction) => {
				const line = await transaction.line.findUnique({ where: { id: lineId } });
				if (!line) notFound("The requested line was not found.");
				const ifMatch = requireIfMatch(req, "Line");
				if (ifMatch !== line.rowVersion) staleVersion();
				if (body.assignedLeaderId !== undefined) {
					const leader = await transaction.subject.findUnique({ where: { id: body.assignedLeaderId }, select: { id: true, status: true } });
					if (!leader) notFound("The requested assigned leader was not found.");
					if (leader.status !== "ACTIVE") conflict("The requested assigned leader is not an active subject.");
				}
				if (body.activeLeaderId !== undefined && body.activeLeaderId !== null) {
					const active = await transaction.subject.findUnique({ where: { id: body.activeLeaderId }, select: { id: true, status: true } });
					if (!active) notFound("The requested active leader was not found.");
					if (active.status !== "ACTIVE") conflict("The requested active leader is not an active subject.");
				}
				const data: Record<string, unknown> = { rowVersion: { increment: 1 } };
				if (body.label !== undefined) data.label = body.label;
				if (body.lineCode !== undefined) data.lineCode = body.lineCode;
				if (body.assignedLeaderId !== undefined) data.assignedLeaderId = body.assignedLeaderId;
				if (body.activeLeaderId !== undefined) data.activeLeaderId = body.activeLeaderId;
				if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder;
				if (body.isEnabled !== undefined) data.isEnabled = body.isEnabled;
				const updated = await transaction.line.update({ where: { id: lineId }, data });
				await recordCommandSuccess(transaction, req, "LINE_UPDATED", "Line", lineId, { lineCode: updated.lineCode, ...body });
				return { status: 200, body: { lineId: updated.id, lineCode: updated.lineCode, label: updated.label, assignedLeaderId: updated.assignedLeaderId, activeLeaderId: updated.activeLeaderId, displayOrder: updated.displayOrder, isEnabled: updated.isEnabled, rowVersion: updated.rowVersion }, headers: { ETag: `"${updated.rowVersion}"` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.delete("/lines/:lineId", requireCapability("operations.manage", requireCanonicalCapability), async (req, res, next) => {
		try {
			const lineId = req.params.lineId;
			const response = await executeCommand(database, req, "lineDelete", { lineId }, async (transaction) => {
				const line = await transaction.line.findUnique({ where: { id: lineId }, select: { id: true, lineCode: true, rowVersion: true } });
				if (!line) notFound("The requested line was not found.");
				const ifMatch = requireIfMatch(req, "Line");
				if (ifMatch !== line.rowVersion) staleVersion();
				await transaction.lineOperatorAssignment.updateMany({ where: { lineId, status: "ACTIVE" }, data: { status: "ENDED", endedAt: new Date() } });
				const updated = await transaction.line.update({ where: { id: lineId }, data: { isEnabled: false, rowVersion: { increment: 1 } } });
				await recordCommandSuccess(transaction, req, "LINE_DISABLED", "Line", lineId, { lineCode: line.lineCode });
				return { status: 200, body: { lineId, lineCode: updated.lineCode, isEnabled: updated.isEnabled, rowVersion: updated.rowVersion }, headers: { ETag: `"${updated.rowVersion}"` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.post("/operator-assignments", requireCapability("execution.write", requireCanonicalCapability), async (req, res, next) => {
		try {
			const body = parseCommandBody(req, operatorAssignmentCreateSchema);
			const response = await executeCommand(database, req, "operatorAssignmentCreate", body, async (transaction) => {
				const line = await transaction.line.findUnique({ where: { id: body.lineId }, select: { id: true, lineCode: true, isEnabled: true, activeLeaderId: true, assignedLeaderId: true } });
				if (!line) notFound("The requested line was not found.");
				if (!line.isEnabled) conflict("The requested line is disabled.");
				const caller = actorId(req);
				const assignments: SubjectAssignmentRecord[] = (req as Request & { canonicalAssignments?: SubjectAssignmentRecord[] }).canonicalAssignments ?? [];
				const isAdmin = hasCapability(assignments, "operations.manage");
				if (!isAdmin && line.activeLeaderId !== caller && line.assignedLeaderId !== caller) {
					forbidden("Only the line's active leader or an admin can assign operators to this line.");
				}
				const operator = await transaction.subject.findUnique({ where: { id: body.subjectId }, select: { id: true, status: true } });
				if (!operator) notFound("The requested operator was not found.");
				if (operator.status !== "ACTIVE") conflict("The requested operator is not an active subject.");
				const existing = await transaction.lineOperatorAssignment.findFirst({ where: { subjectId: body.subjectId, status: "ACTIVE" }, select: { id: true, lineId: true } });
				if (existing) {
					conflict(existing.lineId === body.lineId
						? "The operator is already assigned to this line."
						: "The operator is still assigned to another line; end that assignment first.");
				}
				const assignment = await transaction.lineOperatorAssignment.create({
					data: { lineId: body.lineId, subjectId: body.subjectId, reason: body.reason ?? null, status: "ACTIVE", actorSubjectId: caller },
				});
				await recordCommandSuccess(transaction, req, "OPERATOR_ASSIGNED", "LineOperatorAssignment", assignment.id, { lineId: body.lineId, subjectId: body.subjectId, reason: body.reason ?? null });
				return { status: 201, body: { operatorAssignmentId: assignment.id, lineId: assignment.lineId, subjectId: assignment.subjectId, status: assignment.status, startedAt: assignment.startedAt.toISOString() }, headers: { Location: `/api/v1/operator-assignments/${assignment.id}` } };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	router.delete("/operator-assignments/:assignmentId", requireCapability("execution.write", requireCanonicalCapability), async (req, res, next) => {
		try {
			const assignmentId = req.params.assignmentId;
			const response = await executeCommand(database, req, "operatorAssignmentEnd", { assignmentId }, async (transaction) => {
				const assignment = await transaction.lineOperatorAssignment.findUnique({
					where: { id: assignmentId },
					select: { id: true, lineId: true, subjectId: true, status: true, line: { select: { lineCode: true, activeLeaderId: true, assignedLeaderId: true } } },
				});
				if (!assignment) notFound("The requested operator assignment was not found.");
				if (assignment.status !== "ACTIVE") conflict("The requested operator assignment is already ended.");
				const caller = actorId(req);
				const assignments: SubjectAssignmentRecord[] = (req as Request & { canonicalAssignments?: SubjectAssignmentRecord[] }).canonicalAssignments ?? [];
				const isAdmin = hasCapability(assignments, "operations.manage");
				if (!isAdmin && assignment.line.activeLeaderId !== caller && assignment.line.assignedLeaderId !== caller) {
					forbidden("Only the line's active leader or an admin can end this assignment.");
				}
				const ended = await transaction.lineOperatorAssignment.update({
					where: { id: assignmentId },
					data: { status: "ENDED", endedAt: new Date() },
				});
				await recordCommandSuccess(transaction, req, "OPERATOR_ASSIGNMENT_ENDED", "LineOperatorAssignment", assignmentId, { lineId: assignment.lineId, subjectId: assignment.subjectId });
				return { status: 200, body: { operatorAssignmentId: ended.id, lineId: ended.lineId, subjectId: ended.subjectId, status: ended.status, endedAt: ended.endedAt?.toISOString() ?? null }, headers: {} };
			});
			respondCommand(res, response);
		} catch (error) { commandError(error, req, res, next); }
	});

	return router;
}
