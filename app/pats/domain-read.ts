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
	| "routingStep"
	| "stageEvent"
	| "inventoryTransaction"
	| "routingViolation"
	| "qualityInspection"
	| "qualityDecision"
	| "planDemandAllocation"
	| "lot"
	| "part"
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
	partId: string;
	part: { partCode: string; partName: string };
	stageId: string;
	subStageId: string | null;
	stepOrder: number;
}) {
	return {
		routeStepId: route.id,
		partId: route.partId,
		partCode: route.part.partCode,
		partName: route.part.partName,
		stageId: route.stageId,
		subStageId: route.subStageId,
		stepOrder: route.stepOrder,
	};
}

type DashboardProgressSegment = {
	kind: "stage" | "blocked" | "remaining";
	stageId: string;
	stageName: string;
	quantity: number;
};

function dashboardProgress(
	activeBatchRows: Array<{
		id: string;
		plannedQuantity: number;
		lot: {
			id: string;
			projectId: string;
			requiredProductionQuantity: number;
			project: { name: string; product: { productName: string } | null };
		};
		positionProjection: { stageId: string; quantityMagnitude: unknown } | null;
	}>,
	stageRows: Array<{ id: string; name: string; displayOrder: number }>,
	openViolationRows: Array<{ batchId: string; attemptedStageId: string }>,
) {
	const blockedBatchIds = new Set(openViolationRows.map((violation) => violation.batchId));
	const projects = new Map<
		string,
		{
			projectName: string;
			productName: string;
			plannedQuantity: number;
			activeQuantity: number;
			activeBatchCount: number;
			lotIds: Set<string>;
			stages: Map<string, { healthy: number; blocked: number }>;
		}
	>();

	for (const batch of activeBatchRows) {
		const project = projects.get(batch.lot.projectId) ?? {
			projectName: batch.lot.project.name,
			productName: batch.lot.project.product?.productName ?? batch.lot.project.name,
			plannedQuantity: 0,
			activeQuantity: 0,
			activeBatchCount: 0,
			lotIds: new Set(),
			stages: new Map(),
		};
		const quantity = Number(batch.positionProjection?.quantityMagnitude ?? batch.plannedQuantity);
		const stageId = batch.positionProjection?.stageId;
		if (!stageId || !Number.isFinite(quantity)) continue;
		const stage = project.stages.get(stageId) ?? { healthy: 0, blocked: 0 };
		const isBlocked = blockedBatchIds.has(batch.id);
		if (isBlocked) stage.blocked += quantity;
		else stage.healthy += quantity;
		project.stages.set(stageId, stage);
		if (!project.lotIds.has(batch.lot.id)) {
			project.plannedQuantity += batch.lot.requiredProductionQuantity;
			project.lotIds.add(batch.lot.id);
		}
		project.activeQuantity += quantity;
		project.activeBatchCount += 1;
		projects.set(batch.lot.projectId, project);
	}

	return [...projects.entries()]
		.map(([projectId, project]) => {
			const effectiveTotal = Math.max(project.plannedQuantity, project.activeQuantity);
			const segments: DashboardProgressSegment[] = [];
			for (const stage of stageRows) {
				const quantities = project.stages.get(stage.id);
				if (!quantities) continue;
				if (quantities.healthy > 0) segments.push({ kind: "stage", stageId: stage.id, stageName: stage.name, quantity: quantities.healthy });
				if (quantities.blocked > 0) segments.push({ kind: "blocked", stageId: stage.id, stageName: stage.name, quantity: quantities.blocked });
			}
			const remaining = effectiveTotal - project.activeQuantity;
			if (remaining > 0) segments.push({ kind: "remaining", stageId: "remaining", stageName: "Not started", quantity: remaining });
			return { projectId, projectName: project.projectName, productName: project.productName, plannedQuantity: project.plannedQuantity, activeQuantity: project.activeQuantity, activeBatchCount: project.activeBatchCount, segments };
		})
		.sort((left, right) => right.activeBatchCount - left.activeBatchCount || left.productName.localeCompare(right.productName));
}

function reportDateKey(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function reportDateBuckets(now: Date): string[] {
	const buckets: string[] = [];
	const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

	for (let offset = 6; offset >= 0; offset -= 1) {
		const bucket = new Date(cursor);
		bucket.setUTCDate(cursor.getUTCDate() - offset);
		buckets.push(reportDateKey(bucket));
	}

	return buckets;
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
					modelAllocations: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { model: { select: { id: true, modelNumber: true, modelName: true } } } },
					demandAllocations: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { model: { select: { id: true, modelNumber: true, modelName: true } } } },
					materialRequirements: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
					parts: { orderBy: [{ partCode: "asc" }, { id: "asc" }] },
					partsLists: { orderBy: [{ version: "desc" }, { id: "asc" }], include: { steps: { orderBy: [{ stepOrder: "asc" }, { id: "asc" }], include: { part: { select: { partCode: true, partName: true } } } } } },
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
			// Mutable plan resources expose the optimistic-concurrency token as a strong ETag.
			// Clients must send this value (or body.rowVersion) as If-Match on plan commands.
			res.setHeader("ETag", `"${plan.rowVersion}"`);
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
				modelAllocations: plan.modelAllocations.map((allocation) => ({
					allocationId: allocation.id,
					modelId: allocation.modelId,
					model: allocation.model,
					plannedQuantity: allocation.plannedQuantity,
					quantityMagnitude: decimal(allocation.quantityMagnitude),
					quantityUom: allocation.quantityUom,
					usageBasis: allocation.usageBasis,
					lifecycleStatus: allocation.lifecycleStatus,
					rowVersion: allocation.rowVersion,
				})),
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
					partsListId: lot.partsListId,
					partsListVersion: lot.partsListVersion,
					status: lot.status,
					requiredProductionQuantity: lot.requiredProductionQuantity,
					labelPackSize: lot.labelPackSize,
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

	router.get("/stations/:stationId/history", requireCapability("execution.read"), async (req, res) => {
		try {
			const station = await database.station.findUnique({
				where: { id: req.params.stationId },
				select: {
					id: true,
					stationCode: true,
					name: true,
					stageId: true,
					boundSteps: { select: { stageId: true, subStageId: true } },
				},
			});
			if (!station) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The requested station was not found.");
				return;
			}

			const stageIds = [...new Set([station.stageId, ...station.boundSteps.map((step) => step.stageId)])];
			const [stages, events, violations] = await Promise.all([
				database.stage.findMany({ where: { id: { in: stageIds } }, select: { id: true, name: true } }),
				database.stageEvent.findMany({
					where: { stageId: { in: stageIds } },
					orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
					include: { actorSubject: { select: { displayNameSnapshot: true } } },
				}),
				database.routingViolation.findMany({
					where: { attemptedStageId: { in: stageIds }, status: "OPEN" },
					orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
				}),
			]);

			const batchIds = [...new Set([...events.map((event) => event.batchId), ...violations.map((violation) => violation.batchId)])];
			const lotIds = [...new Set(violations.map((violation) => violation.lotId))];
			const partIds = [...new Set(violations.map((violation) => violation.partId))];
			const [batches, lots, parts] = await Promise.all([
				batchIds.length ? database.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, batchCode: true } }) : [],
				lotIds.length ? database.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, lotCode: true } }) : [],
				partIds.length ? database.part.findMany({ where: { id: { in: partIds } }, select: { id: true, partCode: true, partName: true } }) : [],
			]);
			const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
			const batchCodes = new Map(batches.map((batch) => [batch.id, batch.batchCode]));
			const lotCodes = new Map(lots.map((lot) => [lot.id, lot.lotCode]));
			const partsById = new Map(parts.map((part) => [part.id, part]));

			res.setHeader("Cache-Control", "no-store").json({
				station: { id: station.id, stationCode: station.stationCode, name: station.name, stageId: station.stageId },
				events: events.map((event) => ({
					id: event.id,
					occurredAt: event.occurredAt.toISOString(),
					batchId: event.batchId,
					batchCode: batchCodes.get(event.batchId) ?? event.batchId,
					stageId: event.stageId,
					subStageId: event.subStageId,
					stepName: stageNames.get(event.stageId) ?? event.stageId,
					actor: event.actorSubject?.displayNameSnapshot ?? event.actor,
					eventType: event.eventType,
					isRoutingViolation: event.isRoutingViolation,
					status: event.status,
				})),
				openViolations: violations.map((violation) => ({
					routingViolationId: violation.id,
					batchId: violation.batchId,
					batchCode: batchCodes.get(violation.batchId) ?? violation.batchId,
					lotId: violation.lotId,
					lotCode: lotCodes.get(violation.lotId) ?? violation.lotId,
					partId: violation.partId,
					partCode: partsById.get(violation.partId)?.partCode ?? violation.partId,
					partName: partsById.get(violation.partId)?.partName ?? violation.partId,
					attemptedStep: {
						stageId: violation.attemptedStageId,
						subStageId: violation.attemptedSubStageId,
						stepName: stageNames.get(violation.attemptedStageId) ?? violation.attemptedStageId,
					},
					detectedAt: violation.detectedAt.toISOString(),
					resolved: violation.resolved,
				})),
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS station history data is unavailable.");
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
			const positions = await database.batchPositionProjection.findMany({
				orderBy: [{ updatedAt: "desc" }, { batchId: "asc" }],
				include: {
					batch: {
						select: {
							id: true,
							batchCode: true,
							barcodeValue: true,
							lotId: true,
							plannedQuantity: true,
							labelPackSize: true,
							status: true,
							rowVersion: true,
							createdAt: true,
							lot: {
								select: {
									id: true,
									lotCode: true,
									lotName: true,
									projectId: true,
									partsListId: true,
								},
							},
							parts: {
								select: {
									partId: true,
									quantity: true,
									quantityMagnitude: true,
									quantityUom: true,
									part: { select: { id: true, partCode: true, partName: true } },
								},
							},
						},
					},
				},
			});
			const partsListIds = [...new Set(positions.map((position) => position.batch.lot.partsListId))];
			const routeSteps = partsListIds.length
				? await database.routingStep.findMany({
						where: { partsListId: { in: partsListIds } },
						orderBy: [{ partsListId: "asc" }, { partId: "asc" }, { stepOrder: "asc" }, { id: "asc" }],
						include: { part: { select: { id: true, partCode: true, partName: true } } },
					})
				: [];
			const routeStepsByPartsListId = new Map<string, typeof routeSteps>();
			for (const routeStep of routeSteps) {
				const steps = routeStepsByPartsListId.get(routeStep.partsListId) ?? [];
				steps.push(routeStep);
				routeStepsByPartsListId.set(routeStep.partsListId, steps);
			}
			res.setHeader("Cache-Control", "no-store").json({
				data: positions.map((position) => ({
					...position,
					quantityMagnitude: decimal(position.quantityMagnitude),
					updatedAt: position.updatedAt.toISOString(),
					batch: {
						...position.batch,
						createdAt: position.batch.createdAt.toISOString(),
						parts: position.batch.parts.map((part) => ({
							...part,
							quantityMagnitude: decimal(part.quantityMagnitude),
							part: part.part,
						})),
					},
					routeSteps: (routeStepsByPartsListId.get(position.batch.lot.partsListId) ?? []).map((step) => ({
						routeStepId: step.id,
						partId: step.partId,
						part: step.part,
						stageId: step.stageId,
						subStageId: step.subStageId,
						stepOrder: step.stepOrder,
					})),
				})),
			});
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
			const inspections = await database.qualityInspection.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { decisions: { orderBy: [{ decidedAt: "desc" }, { id: "desc" }] }, batch: { select: { id: true, batchCode: true, lotId: true, plannedQuantity: true, parts: { orderBy: [{ partId: "asc" }], take: 1, select: { partId: true, quantity: true, quantityMagnitude: true, quantityUom: true, part: { select: { id: true, partCode: true, partName: true } } } } } } } });
			res.setHeader("Cache-Control", "no-store").json({ data: inspections.map((inspection) => ({ ...inspection, inspectedQuantity: decimal(inspection.inspectedQuantity), startedAt: inspection.startedAt.toISOString(), completedAt: date(inspection.completedAt) })) });
		} catch {
			problem(_req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS quality inspection data is unavailable.");
		}
	});

	router.get("/dashboard-summaries", requireCapability("execution.read"), async (req, res) => {
		try {
			const [plans, activeBatchRows, stageRows, openViolationRows, qualityHolds, inventoryTransactions] = await Promise.all([
				database.project.count(),
				database.batch.findMany({
					where: { status: "ACTIVE" },
					select: {
						id: true,
						plannedQuantity: true,
						lot: {
							select: {
								id: true,
								projectId: true,
								requiredProductionQuantity: true,
								project: { select: { name: true, product: { select: { productName: true } } } },
							},
						},
						positionProjection: { select: { stageId: true, quantityMagnitude: true } },
					},
				}),
				database.stage.findMany({ select: { id: true, name: true, displayOrder: true }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] }),
				database.routingViolation.findMany({ where: { status: "OPEN" }, select: { batchId: true, attemptedStageId: true } }),
				database.qualityDecision.count({ where: { decision: "HOLD" } }),
				database.inventoryTransaction.count(),
			]);
			const activeLots = new Set(activeBatchRows.map((row) => row.lot.id));
			const activeProjects = new Set(activeBatchRows.map((row) => row.lot.projectId));
			res.setHeader("Cache-Control", "no-store").json({
				generatedAt: new Date().toISOString(),
				plans,
				activeProjects: activeProjects.size,
				activeLots: activeLots.size,
				activeBatches: activeBatchRows.length,
				openViolations: openViolationRows.length,
				qualityHolds,
				inventoryTransactions,
				productionProgress: dashboardProgress(activeBatchRows, stageRows, openViolationRows),
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS dashboard data is unavailable.");
		}
	});

	router.get("/reports/line", requireCapability("execution.read"), async (req, res) => {
		try {
			const reportNow = new Date();
			const throughputStart = new Date(Date.UTC(reportNow.getUTCFullYear(), reportNow.getUTCMonth(), reportNow.getUTCDate()));
			throughputStart.setUTCDate(throughputStart.getUTCDate() - 6);
			const [plans, batches, events, violations, qualityDecisions, transactions, stages, activityRows, throughputRows, inventoryRows, violationRows, closedBatchRows] = await Promise.all([
				database.project.count(),
				database.batch.count(),
				database.stageEvent.count({ where: { status: "ACCEPTED" } }),
				database.routingViolation.count(),
				database.qualityDecision.count(),
				database.inventoryTransaction.count(),
				database.stage.findMany({ select: { id: true, name: true }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] }),
				database.stageEvent.findMany({ take: 50, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], include: { actorSubject: { select: { displayNameSnapshot: true } } } }),
				database.stageEvent.findMany({ where: { status: "ACCEPTED", eventType: "STAGE_COMPLETED", occurredAt: { gte: throughputStart } }, select: { quantity: true, quantityMagnitude: true, occurredAt: true } }),
				database.inventoryTransaction.findMany({ take: 100, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], include: { recordedBySubject: { select: { displayNameSnapshot: true } } } }),
				database.routingViolation.findMany({ take: 100, orderBy: [{ detectedAt: "desc" }, { id: "desc" }] }),
				database.batch.findMany({ where: { status: { in: ["CLOSED", "HELD", "SCRAPPED"] } }, take: 100, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, batchCode: true, plannedQuantity: true, currentStageId: true, status: true } }),
			]);
			const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
			const identityIds = {
				batch: [...new Set([...activityRows.map((row) => row.batchId), ...inventoryRows.map((row) => row.batchId), ...violationRows.map((row) => row.batchId)])],
				lot: [...new Set([...inventoryRows.map((row) => row.lotId), ...violationRows.map((row) => row.lotId)])],
				part: [...new Set([...activityRows.map((row) => row.partId), ...inventoryRows.map((row) => row.partId), ...violationRows.map((row) => row.partId)].filter((id): id is string => Boolean(id)))],
			};
			const [batchIdentities, lotIdentities, partIdentities] = await Promise.all([
				database.batch.findMany({ where: { id: { in: identityIds.batch } }, select: { id: true, batchCode: true } }),
				database.lot.findMany({ where: { id: { in: identityIds.lot } }, select: { id: true, lotCode: true } }),
				database.part.findMany({ where: { id: { in: identityIds.part } }, select: { id: true, partCode: true, partName: true, variancePercentThreshold: true } }),
			]);
			const batchCodes = new Map(batchIdentities.map((batch) => [batch.id, batch.batchCode]));
			const lotCodes = new Map(lotIdentities.map((lot) => [lot.id, lot.lotCode]));
			const parts = new Map(partIdentities.map((part) => [part.id, part]));
			const activity = activityRows.map((event) => ({
				id: event.id,
				occurredAt: event.occurredAt.toISOString(),
				stepName: stageNames.get(event.stageId) ?? event.stageId,
				batchId: batchCodes.get(event.batchId) ?? event.batchId,
				actor: event.actorSubject?.displayNameSnapshot ?? event.actor,
				eventType: event.eventType,
				isRoutingViolation: event.isRoutingViolation,
			}));
			const actualByDate = new Map<string, number>();
			for (const event of throughputRows) {
				const quantity = Number(event.quantityMagnitude ?? event.quantity ?? 0);
				if (!Number.isFinite(quantity)) continue;
				const key = reportDateKey(event.occurredAt);
				actualByDate.set(key, (actualByDate.get(key) ?? 0) + quantity);
			}
			// Provisional expected pace: released-plan required qty / 7-day window.
			// Not a formal schedule resource — comparison aid until a schedule API exists.
			let dailyExpected: number | null = null;
			try {
				const releasedPlans = await database.project.findMany({
					where: { status: "RELEASED" },
					select: { requiredProductionQuantity: true },
				});
				const planPaceTotal = releasedPlans.reduce(
					(sum: number, plan: { requiredProductionQuantity: number }) =>
						sum + (Number(plan.requiredProductionQuantity) || 0),
					0,
				);
				if (planPaceTotal > 0) dailyExpected = Math.max(1, Math.round(planPaceTotal / 7));
			} catch {
				dailyExpected = null;
			}
			const dailyThroughput = reportDateBuckets(reportNow).map((date) => ({
				date,
				expected: dailyExpected,
				actual: actualByDate.get(date) ?? 0,
			}));
			const closedLots = closedBatchRows.map((batch) => ({
				id: batch.batchCode,
				closedAt: null,
				finalStage: stageNames.get(batch.currentStageId) ?? batch.currentStageId,
				qty: String(batch.plannedQuantity),
				result: batch.status === "CLOSED" ? "Closed" : batch.status === "HELD" ? "Held" : "Scrapped",
				exception: batch.status === "CLOSED" ? "None" : `Batch ${batch.status.toLowerCase()}`,
			}));
			const routingViolations = violationRows.map((violation) => {
				const part = parts.get(violation.partId);
				const expectedSteps = Array.isArray(violation.expectedSteps) ? violation.expectedSteps : [];
				return {
					routingViolationId: violation.id,
					partId: violation.partId,
					partCode: part?.partCode ?? "Unknown",
					partName: part?.partName ?? "Unknown part",
					batchId: violation.batchId,
					lotId: violation.lotId,
					lotCode: lotCodes.get(violation.lotId) ?? "Unknown lot",
					attemptedStageName: stageNames.get(violation.attemptedStageId) ?? violation.attemptedStageId,
					expectedStageNames: expectedSteps.map((step) => {
						const stageId = typeof step === "object" && step !== null && "stageId" in step ? String(step.stageId) : "";
						return stageNames.get(stageId) ?? stageId;
					}).filter(Boolean),
					detectedAt: violation.detectedAt.toISOString(),
					resolved: violation.resolved,
				};
			});
			const inventoryTransactions = inventoryRows.map((transaction) => {
				const part = parts.get(transaction.partId);
				const variancePercent = transaction.expectedQuantity === 0
					? transaction.actualQuantity === 0 ? 0 : 1
					: (transaction.actualQuantity - transaction.expectedQuantity) / transaction.expectedQuantity;
				const threshold = part?.variancePercentThreshold ?? 0.05;
				return {
					inventoryTransactionId: transaction.id,
					transactionType: transaction.transactionType === "RECEIVING" ? "Receiving" : "Issuance",
					partCode: part?.partCode ?? "Unknown",
					partName: part?.partName ?? "Unknown part",
					lotCode: lotCodes.get(transaction.lotId) ?? "Unknown lot",
					batchId: transaction.batchId,
					fromStageName: transaction.fromStageId ? stageNames.get(transaction.fromStageId) ?? transaction.fromStageId : null,
					toStageName: stageNames.get(transaction.toStageId) ?? transaction.toStageId,
					expectedQuantity: transaction.expectedQuantity,
					actualQuantity: transaction.actualQuantity,
					variancePercent,
					exceedsVarianceThreshold: Math.abs(variancePercent) > threshold,
					withdrawalFormRef: transaction.withdrawalFormRef ?? undefined,
					recordedAt: transaction.recordedAt.toISOString(),
					recordedBy: transaction.recordedBySubject?.displayNameSnapshot ?? transaction.recordedBy,
				};
			});
			res.setHeader("Cache-Control", "no-store").json({ generatedAt: new Date().toISOString(), production: { plans, batches, acceptedStageEvents: events }, exceptions: { routingViolations: violations }, quality: { decisions: qualityDecisions }, traceability: { inventoryTransactions: transactions }, dailyThroughput, activity, closedLots, routingViolations, inventoryTransactions });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS line report data is unavailable.");
		}
	});

	return router;
}
