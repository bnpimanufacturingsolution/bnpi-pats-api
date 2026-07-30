import { Router, type Request, type RequestHandler, type Response } from "express";
import type { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import { buildOffsetPage, parseOffsetPagination } from "../canonical/collection";

type DomainReadDatabase = Pick<
	PatsPrismaClient,
	| "project"
	| "workflowGroup"
	| "stage"
	| "subStage"
	| "station"
	| "stationStep"
	| "workInstruction"
	| "batch"
	| "batchPositionProjection"
	| "stageEvent"
	| "inventoryTransaction"
	| "routingViolation"
	| "qualityInspection"
	| "qualityDecision"
	| "planDemandAllocation"
>;

const PROBLEM_TYPE = {
	malformed: "urn:bandai:pats:problem:malformed-request",
	notFound: "urn:bandai:pats:problem:not-found",
	dependency: "urn:bandai:pats:problem:dependency-unavailable",
} as const;

function instance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function problem(req: Request, res: Response, status: number, type: string, title: string, detail: string): void {
	res.type("application/problem+json").status(status).json({ type, title, status, detail, instance: instance(req) });
}

function query(req: Request): Record<string, string | string[] | undefined> {
	return req.query as Record<string, string | string[] | undefined>;
}

function pagination(req: Request, res: Response, extraKeys: readonly string[] = []) {
	const requestQuery = query(req);
	const allowedKeys = new Set(["page", "limit", ...extraKeys]);
	if (Object.keys(requestQuery).some((key) => !allowedKeys.has(key))) {
		problem(req, res, 400, PROBLEM_TYPE.malformed, "Bad Request", "The collection query is invalid.");
		return null;
	}
	const parsed = parseOffsetPagination({ page: requestQuery.page, limit: requestQuery.limit });
	if ("ok" in parsed) {
		problem(req, res, 400, PROBLEM_TYPE.malformed, "Bad Request", "The collection pagination is invalid.");
		return null;
	}
	return parsed;
}

function decimal(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return String(value);
}

function date(value: Date | null | undefined): string | null {
	return value ? value.toISOString() : null;
}

function routeResource(route: {
	id: string;
	stageId: string;
	subStageId: string | null;
	stepOrder: number;
}) {
	return {
		routeStepId: route.id,
		stageId: route.stageId,
		subStageId: route.subStageId,
		stepOrder: route.stepOrder,
	};
}

export function domainReadRouter(
	database: DomainReadDatabase,
	requireCapability: (capability: string) => RequestHandler,
): Router {
	const router = Router();

	router.get("/production-plans", requireCapability("planning.read"), async (req, res) => {
		const page = pagination(req, res);
		if (!page) return;
		try {
			const [totalItems, plans] = await Promise.all([
				database.project.count(),
				database.project.findMany({
					skip: (page.page - 1) * page.limit,
					take: page.limit,
					orderBy: [{ createdAt: "desc" }, { id: "asc" }],
					select: {
						id: true,
						projectCode: true,
						name: true,
						status: true,
						requiredProductionQuantity: true,
						productId: true,
						rowVersion: true,
						createdAt: true,
						releasedAt: true,
						product: { select: { productName: true } },
						lots: { select: { id: true } },
					},
				}),
			]);
			const data = plans.map((plan) => ({
				planId: plan.id,
				planCode: plan.projectCode,
				name: plan.name,
				status: plan.status,
				requiredProductionQuantity: plan.requiredProductionQuantity,
				productId: plan.productId,
				productName: plan.product?.productName ?? null,
				lotCount: plan.lots.length,
				rowVersion: plan.rowVersion,
				createdAt: plan.createdAt.toISOString(),
				releasedAt: date(plan.releasedAt),
			}));
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(data, page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS production plan data is unavailable.");
		}
	});

	router.get("/production-plans/:planId", requireCapability("planning.read"), async (req, res) => {
		try {
			const plan = await database.project.findUnique({
				where: { id: req.params.planId },
				include: {
					product: { select: { id: true, productCode: true, productName: true } },
					productSpecification: true,
					demandAllocations: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { model: { select: { id: true, modelNumber: true, modelName: true } } } },
					materialRequirements: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
					parts: { orderBy: [{ partCode: "asc" }, { id: "asc" }] },
					partsLists: { orderBy: [{ version: "desc" }, { id: "asc" }], include: { steps: { orderBy: [{ stepOrder: "asc" }, { id: "asc" }] } } },
					pmrs: true,
					lots: {
						orderBy: [{ createdAt: "asc" }, { id: "asc" }],
						include: {
							partAllocations: { include: { part: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
							batches: { include: { parts: true, positionProjection: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
						},
					},
				},
			});
			if (!plan) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The requested production plan was not found.");
				return;
			}
			res.setHeader("Cache-Control", "no-store").json({
				planId: plan.id,
				planCode: plan.projectCode,
				name: plan.name,
				status: plan.status,
				requiredProductionQuantity: plan.requiredProductionQuantity,
				rowVersion: plan.rowVersion,
				createdAt: plan.createdAt.toISOString(),
				releasedAt: date(plan.releasedAt),
				product: plan.product,
				productSpecification: plan.productSpecification,
				allocations: plan.demandAllocations.map((allocation) => ({
					allocationId: allocation.id,
					modelId: allocation.modelId,
					model: allocation.model,
					marketRegion: allocation.marketRegion,
					demandPurpose: allocation.demandPurpose,
					quantityMagnitude: decimal(allocation.quantityMagnitude),
					quantityUom: allocation.quantityUom,
					usageBasis: allocation.usageBasis,
					lifecycleStatus: allocation.lifecycleStatus,
				})),
				parts: plan.parts,
				partsListVersions: plan.partsLists.map((partsList) => ({
					partsListVersionId: partsList.id,
					version: partsList.version,
					status: partsList.status,
					publishedAt: date(partsList.publishedAt),
					routeSteps: partsList.steps.map(routeResource),
				})),
				materialRequirements: plan.materialRequirements.map((requirement) => ({
					materialRequirementId: requirement.id,
					partId: requirement.partId,
					quantityMagnitude: decimal(requirement.quantityMagnitude),
					quantityUom: requirement.quantityUom,
					status: requirement.status,
					externalReference: requirement.externalReference,
				})),
				pmrsReference: plan.pmrs,
				lots: plan.lots.map((lot) => ({
					lotId: lot.id,
					lotCode: lot.lotCode,
					lotName: lot.lotName,
					status: lot.status,
					quantityMagnitude: decimal(lot.quantityMagnitude),
					quantityUom: lot.quantityUom,
					partAllocations: lot.partAllocations.map((allocation) => ({
						lotPartAllocationId: allocation.id,
						partId: allocation.partId,
						partCode: allocation.part.partCode,
						quantityMagnitude: decimal(allocation.quantityMagnitude),
						quantityUom: allocation.quantityUom,
					})),
					batches: lot.batches.map((batch) => ({
						batchId: batch.id,
						batchCode: batch.batchCode,
						barcodeValue: batch.barcodeValue,
						status: batch.status,
						plannedQuantity: batch.plannedQuantity,
						parts: batch.parts,
						position: batch.positionProjection,
					})),
				})),
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS production plan data is unavailable.");
		}
	});

	router.get("/workflow-groups", requireCapability("execution.read"), async (req, res) => {
		try {
			const groups = await database.workflowGroup.findMany({ orderBy: [{ displayOrder: "asc" }, { id: "asc" }], include: { stages: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }], include: { subStageLinks: { include: { subStage: true } } } } } });
			res.setHeader("Cache-Control", "no-store").json({ data: groups });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS workflow configuration is unavailable.");
		}
	});

	router.get("/stages", requireCapability("execution.read"), async (req, res) => {
		try {
			const stages = await database.stage.findMany({
				orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
				include: { workflowGroup: { select: { id: true, name: true } }, subStageLinks: { include: { subStage: true } } },
			});
			res.setHeader("Cache-Control", "no-store").json({ data: stages });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS stage configuration is unavailable.");
		}
	});

	router.get("/sub-stages", requireCapability("execution.read"), async (req, res) => {
		try {
			const subStages = await database.subStage.findMany({
				orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
				include: { eligibleStages: { include: { stage: { select: { id: true, name: true } } } } },
			});
			res.setHeader("Cache-Control", "no-store").json({ data: subStages });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS sub-stage configuration is unavailable.");
		}
	});

	router.get("/stations", requireCapability("execution.read"), async (req, res) => {
		try {
			const stations = await database.station.findMany({ orderBy: [{ displayOrder: "asc" }, { id: "asc" }], include: { boundSteps: true } });
			res.setHeader("Cache-Control", "no-store").json({ data: stations });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS station configuration is unavailable.");
		}
	});

	router.get("/station-steps", requireCapability("execution.read"), async (req, res) => {
		try {
			const stationSteps = await database.stationStep.findMany({
				orderBy: [{ stationId: "asc" }, { stageId: "asc" }, { id: "asc" }],
				include: {
					station: { select: { id: true, stationCode: true, name: true } },
					stage: { select: { id: true, name: true } },
					subStage: { select: { id: true, name: true } },
				},
			});
			res.setHeader("Cache-Control", "no-store").json({ data: stationSteps });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS station-step configuration is unavailable.");
		}
	});

	router.get("/work-instructions", requireCapability("execution.read"), async (req, res) => {
		try {
			const instructions = await database.workInstruction.findMany({ orderBy: [{ stageId: "asc" }, { subStageId: "asc" }, { version: "desc" }, { id: "asc" }] });
			res.setHeader("Cache-Control", "no-store").json({ data: instructions });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS work-instruction configuration is unavailable.");
		}
	});

	router.get("/batches", requireCapability("execution.read"), async (req, res) => {
		const page = pagination(req, res, ["batch_id"]);
		if (!page) return;
		try {
			const batchId = query(req).batch_id;
			const where = typeof batchId === "string" && batchId.trim() ? { id: batchId } : {};
			const [totalItems, batches] = await Promise.all([
				database.batch.count({ where }),
				database.batch.findMany({ where, skip: (page.page - 1) * page.limit, take: page.limit, orderBy: [{ createdAt: "desc" }, { id: "asc" }], include: { lot: { select: { id: true, lotCode: true, projectId: true } }, positionProjection: true, parts: true } }),
			]);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(batches, page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS batch data is unavailable.");
		}
	});

	router.get("/batch-positions", requireCapability("execution.read"), async (req, res) => {
		try {
			const positions = await database.batchPositionProjection.findMany({ orderBy: [{ updatedAt: "desc" }, { batchId: "asc" }], include: { batch: { select: { id: true, batchCode: true, lotId: true, status: true } } } });
			res.setHeader("Cache-Control", "no-store").json({ data: positions.map((position) => ({ ...position, quantityMagnitude: decimal(position.quantityMagnitude), updatedAt: position.updatedAt.toISOString() })) });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS batch position data is unavailable.");
		}
	});

	router.get("/stage-events", requireCapability("execution.read"), async (req, res) => {
		const page = pagination(req, res, ["batch_id"]);
		if (!page) return;
		try {
			const batchId = query(req).batch_id;
			const where = typeof batchId === "string" && batchId.trim() ? { batchId } : {};
			const [totalItems, events] = await Promise.all([
				database.stageEvent.count({ where }),
				database.stageEvent.findMany({ where, skip: (page.page - 1) * page.limit, take: page.limit, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], include: { actorSubject: { select: { id: true, displayNameSnapshot: true } } } }),
			]);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(events.map((event) => ({ ...event, quantityMagnitude: decimal(event.quantityMagnitude), occurredAt: event.occurredAt.toISOString() })), page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS stage event data is unavailable.");
		}
	});

	router.get("/inventory-transactions", requireCapability("inventory.read"), async (req, res) => {
		const page = pagination(req, res, ["batch_id"]);
		if (!page) return;
		try {
			const batchId = query(req).batch_id;
			const where = typeof batchId === "string" && batchId.trim() ? { batchId } : {};
			const [totalItems, transactions] = await Promise.all([
				database.inventoryTransaction.count({ where }),
				database.inventoryTransaction.findMany({ where, skip: (page.page - 1) * page.limit, take: page.limit, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], include: { recordedBySubject: { select: { id: true, displayNameSnapshot: true } } } }),
			]);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(transactions.map((transaction) => ({ ...transaction, expectedQuantityMagnitude: decimal(transaction.expectedQuantityMagnitude), actualQuantityMagnitude: decimal(transaction.actualQuantityMagnitude), recordedAt: transaction.recordedAt.toISOString() })), page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS inventory transaction data is unavailable.");
		}
	});

	router.get("/routing-violations", requireCapability("execution.read"), async (_req, res) => {
		try {
			const violations = await database.routingViolation.findMany({ orderBy: [{ detectedAt: "desc" }, { id: "desc" }] });
			res.setHeader("Cache-Control", "no-store").json({ data: violations });
		} catch {
			problem(_req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS routing violation data is unavailable.");
		}
	});

	router.get("/quality-inspections", requireCapability("quality.read"), async (_req, res) => {
		try {
			const inspections = await database.qualityInspection.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { decisions: { orderBy: [{ decidedAt: "desc" }, { id: "desc" }] }, batch: { select: { id: true, batchCode: true, lotId: true } } } });
			res.setHeader("Cache-Control", "no-store").json({ data: inspections.map((inspection) => ({ ...inspection, inspectedQuantity: decimal(inspection.inspectedQuantity), startedAt: inspection.startedAt.toISOString(), completedAt: date(inspection.completedAt) })) });
		} catch {
			problem(_req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS quality inspection data is unavailable.");
		}
	});

	router.get("/dashboard-summaries", requireCapability("execution.read"), async (req, res) => {
		try {
			const [plans, activeBatches, openViolations, qualityHolds, inventoryTransactions] = await Promise.all([
				database.project.count(),
				database.batch.count({ where: { status: "ACTIVE" } }),
				database.routingViolation.count({ where: { status: "OPEN" } }),
				database.qualityDecision.count({ where: { decision: "HOLD" } }),
				database.inventoryTransaction.count(),
			]);
			res.setHeader("Cache-Control", "no-store").json({ generatedAt: new Date().toISOString(), plans, activeBatches, openViolations, qualityHolds, inventoryTransactions });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS dashboard data is unavailable.");
		}
	});

	router.get("/reports/line", requireCapability("execution.read"), async (req, res) => {
		try {
			const [plans, batches, events, violations, qualityDecisions, transactions] = await Promise.all([
				database.project.count(),
				database.batch.count(),
				database.stageEvent.count({ where: { status: "ACCEPTED" } }),
				database.routingViolation.count(),
				database.qualityDecision.count(),
				database.inventoryTransaction.count(),
			]);
			res.setHeader("Cache-Control", "no-store").json({ generatedAt: new Date().toISOString(), production: { plans, batches, acceptedStageEvents: events }, exceptions: { routingViolations: violations }, quality: { decisions: qualityDecisions }, traceability: { inventoryTransactions: transactions } });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS line report data is unavailable.");
		}
	});

	return router;
}
