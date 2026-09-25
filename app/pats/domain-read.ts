import { Router, type Request, type RequestHandler, type Response } from "express";
import { Prisma, type PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import { buildOffsetPage, parseOffsetPagination } from "../canonical/collection";
import { actorId, CommandProblem, sendCommandProblem } from "./command-support";
import { parseBatchResolveCode, resolveBatchByCode } from "./batch-resolve";
import { parseResolveCode, resolveQualityInspectionByCode } from "./quality-resolve";
import { listAllowedQualityStageIds } from "./quality-stage-scope";
import { hasCapability } from "../identity/policy";
import type { SubjectAssignmentRecord } from "../identity/types";
import { setDeprecationHeaders } from "../canonical/response-headers";

// Station→Section rename (2026-09-16) transitional bridge: /sections is
// CANONICAL, /stations is TRANSITIONAL (§7) with Deprecation/Sunset headers.
const SECTION_LEGACY_SUNSET = new Date("2027-06-30T00:00:00Z");

function isLegacyStationPath(req: Request): boolean {
	const path = req.baseUrl + req.path;
	return /(^|\/)stations(\/|$)/.test(path);
}

function applyLegacyStationHeaders(req: Request, res: Response): void {
	if (isLegacyStationPath(req)) setDeprecationHeaders(res, SECTION_LEGACY_SUNSET);
}

type DomainReadDatabase = Pick<
	PatsPrismaClient,
	| "$queryRaw"
	| "project"
	| "workflowGroup"
	| "stage"
	| "subStage"
	| "section"
	| "stationStep"
	| "workInstruction"
	| "workProcess"
	| "booth"
	| "line"
	| "lineOperatorAssignment"
	| "subject"
	| "monitoringDailySheet"
	| "monitoringStationBoard"
	| "batch"
	| "batchPositionProjection"
	| "routingStep"
	| "stageEvent"
	| "inventoryTransaction"
	| "routingViolation"
	| "qualityInspection"
	| "qualityDecision"
	| "qualityStageAssignment"
	| "printJob"
	| "lot"
	| "part"
	| "section"
	| "productionLine"
>;

const PROBLEM_TYPE = {
	malformed: "urn:bandai:pats:problem:malformed-request",
	notFound: "urn:bandai:pats:problem:not-found",
	authorizationDenied: "urn:bandai:pats:problem:authorization-denied",
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
	// Only real floor stages count toward progress. Release-minted batches sit at
	// the STG-PROJECTS pre-floor marker (no Stage row); counting them as active
	// yields segment-less rows (or 100% "Not started") that crowd out projects
	// with real stage progress in the top-5 widget slice.
	const knownStageIds = new Set(stageRows.map((stage) => stage.id));
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
		if (!knownStageIds.has(stageId)) continue;
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
		.filter((row) => row.segments.length > 0)
		.sort((left, right) => {
			const leftProgress = left.segments.some((segment) => segment.kind !== "remaining") ? 1 : 0;
			const rightProgress = right.segments.some((segment) => segment.kind !== "remaining") ? 1 : 0;
			return rightProgress - leftProgress || right.activeBatchCount - left.activeBatchCount || left.productName.localeCompare(right.productName);
		});
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

type BoundStep = { stageId: string; subStageId: string | null };

/** StationStep rows when present; otherwise whole station.stageId (stage-wide). */
function resolveStationBoundSteps(
	station: { stageId: string; boundSteps: BoundStep[] },
): BoundStep[] {
	if (station.boundSteps.length > 0) return station.boundSteps;
	return [{ stageId: station.stageId, subStageId: null }];
}

/** Prisma OR filter: null subStageId on a step means entire stage (all substages). */
function boundStepsOrFilter(steps: BoundStep[]): { OR: Array<Record<string, unknown>> } {
	return {
		OR: steps.map((step) =>
			step.subStageId == null
				? { stageId: step.stageId }
				: { stageId: step.stageId, subStageId: step.subStageId },
		),
	};
}

/** Same bound-step idea for RoutingViolation attempted stage/substage fields. */
function stepFilterAsViolationWhere(steps: BoundStep[]): { OR: Array<Record<string, unknown>> } {
	return {
		OR: steps.map((step) =>
			step.subStageId == null
				? { attemptedStageId: step.stageId }
				: { attemptedStageId: step.stageId, attemptedSubStageId: step.subStageId },
		),
	};
}

function eventQuantity(event: { quantity?: number | null; quantityMagnitude?: unknown }): number {
	const magnitude = Number(event.quantityMagnitude ?? event.quantity ?? 0);
	return Number.isFinite(magnitude) ? magnitude : 0;
}

/**
 * UTC calendar day for support "today" window.
 * Query `date=YYYY-MM-DD` preferred for tests; default = current UTC date.
 */
function parseSupportDateWindow(
	raw: string | string[] | undefined,
): { ok: true; dateKey: string; start: Date; end: Date } | { ok: false } {
	const value = Array.isArray(raw) ? raw[0] : raw;
	const dateKey =
		typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
			? value
			: value === undefined || value === ""
				? reportDateKey(new Date())
				: null;
	if (!dateKey) return { ok: false };
	const [year, month, day] = dateKey.split("-").map(Number);
	const start = new Date(Date.UTC(year, month - 1, day));
	const end = new Date(Date.UTC(year, month - 1, day + 1));
	return { ok: true, dateKey, start, end };
}

export function domainReadRouter(
	database: DomainReadDatabase,
	requireCapability: (capability: string) => RequestHandler,
): Router {
	const router = Router();

	router.get(["/projects", "/production-plans"], requireCapability("planning.read"), async (req, res) => {
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
						lot: { select: { id: true } },
					},
				}),
			]);
			const isProject = (req.baseUrl + req.path).includes("/projects");
			const data = plans.map((plan) => {
				const base = {
					planId: plan.id,
					planCode: plan.projectCode,
					name: plan.name,
					status: plan.status,
					requiredProductionQuantity: plan.requiredProductionQuantity,
					productId: plan.productId,
					productName: plan.product?.productName ?? null,
					lotCount: plan.lot ? 1 : 0,
					rowVersion: plan.rowVersion,
					createdAt: plan.createdAt.toISOString(),
					releasedAt: date(plan.releasedAt),
				};
				if (isProject) {
					return {
						projectId: plan.id,
						projectCode: plan.projectCode,
						...base,
					};
				}
				return base;
			});
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(data, page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS project data is unavailable.");
		}
	});

	router.get(["/projects/:projectId", "/production-plans/:planId"], requireCapability("planning.read"), async (req, res) => {
		const targetId = req.params.projectId ?? req.params.planId;
		try {
			const plan = await database.project.findUnique({
				where: { id: targetId },
				include: {
					product: { select: { id: true, productCode: true, productName: true } },
					productSpecification: true,
					modelAllocations: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { model: { select: { id: true, modelNumber: true, modelName: true } } } },
					parts: { orderBy: [{ partCode: "asc" }, { id: "asc" }] },
					partsLists: { orderBy: [{ version: "desc" }, { id: "asc" }], include: { steps: { orderBy: [{ stepOrder: "asc" }, { id: "asc" }], include: { part: { select: { partCode: true, partName: true } } } } } },
					lot: {
						include: {
							partAllocations: { include: { part: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
							batches: { include: { parts: true, positionProjection: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
						},
					},
				},
			});
			if (!plan) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The requested project was not found.");
				return;
			}
			// Mutable plan resources expose the optimistic-concurrency token as a strong ETag.
			// Clients must send this value (or body.rowVersion) as If-Match on plan commands.
			res.setHeader("ETag", `"${plan.rowVersion}"`);
			res.setHeader("Cache-Control", "no-store").json({
				projectId: plan.id,
				planId: plan.id,
				projectCode: plan.projectCode,
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
				parts: plan.parts,
				partsListVersions: plan.partsLists.map((partsList) => ({
					partsListVersionId: partsList.id,
					version: partsList.version,
					status: partsList.status,
					publishedAt: date(partsList.publishedAt),
					routeSteps: partsList.steps.map(routeResource),
				})),
				lots: plan.lot ? [{
					lotId: plan.lot.id,
					lotCode: plan.lot.lotCode,
					lotName: plan.lot.lotName,
					partsListId: plan.lot.partsListId,
					partsListVersion: plan.lot.partsListVersion,
					status: plan.lot.status,
					requiredProductionQuantity: plan.lot.requiredProductionQuantity,
					labelPackSize: plan.lot.labelPackSize,
					quantityMagnitude: decimal(plan.lot.quantityMagnitude),
					quantityUom: plan.lot.quantityUom,
					partAllocations: plan.lot.partAllocations.map((allocation) => ({
						lotPartAllocationId: allocation.id,
						partId: allocation.partId,
						partCode: allocation.part.partCode,
						quantityMagnitude: decimal(allocation.quantityMagnitude),
						quantityUom: allocation.quantityUom,
					})),
					batches: plan.lot.batches.map((batch) => ({
						batchId: batch.id,
						batchCode: batch.batchCode,
						barcodeValue: batch.barcodeValue,
						status: batch.status,
						plannedQuantity: batch.plannedQuantity,
						parts: batch.parts,
						position: batch.positionProjection,
					})),
				}] : [],
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

	router.get(["/sections", "/stations"], requireCapability("execution.read"), async (req, res) => {
		const page = pagination(req, res, ["search"]);
		if (!page) return;
		try {
			const requestQuery = query(req);
			const searchRaw = requestQuery.search;
			const searchText = (Array.isArray(searchRaw) ? searchRaw[0] : searchRaw)?.toString().trim() ?? "";
			const skip = (page.page - 1) * page.limit;
			const whereClause = searchText
				? {
						OR: [
							{ name: { contains: searchText, mode: "insensitive" as const } },
							{ sectionCode: { contains: searchText, mode: "insensitive" as const } },
						],
				  }
				: undefined;
			const [totalItems, stations] = await Promise.all([
				searchText.length >= 3
					? database.$queryRaw<{ count: number }[]>(Prisma.sql`
						SELECT COUNT(*)::integer AS count FROM "Section" s
						WHERE s."name" % ${searchText} OR s."sectionCode" % ${searchText}
					`).then(r => r[0]?.count ?? 0)
					: database.section.count({ where: whereClause }),
				searchText.length >= 3
					? database.$queryRaw<{ id: string; sectionCode: string; name: string; displayOrder: number; isEnabled: boolean; parentSectionId: string | null; stageId: string | null }[]>(Prisma.sql`
						SELECT s."id", s."sectionCode", s."name", s."displayOrder", s."isEnabled", s."parentSectionId", s."stageId"
						FROM "Section" s
						WHERE s."name" % ${searchText} OR s."sectionCode" % ${searchText}
						ORDER BY s."name" <-> ${searchText}, s."displayOrder" ASC, s."id" ASC
						LIMIT ${page.limit} OFFSET ${skip}
					`)
					: database.section.findMany({
							where: whereClause,
							orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
							skip,
							take: page.limit,
							include: { boundSteps: true, productionLine: { select: { id: true, lineCode: true, name: true } } },
					  }),
			]);
			applyLegacyStationHeaders(req, res);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(stations.map((s) => ({ ...s, stationCode: s.sectionCode, productionLineId: (s as { productionLineId?: string | null }).productionLineId ?? null })), page, totalItems));
		} catch (error) {
			console.error("[domain-read] GET /sections failed:", error);
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS section configuration is unavailable.");
		}
	});

	/**
	 * @openapi
	 * /api/v1/production-lines:
	 *   get:
	 *     operationId: productionLineCollectionGet
	 *     summary: List production-line umbrellas for the Section tree
	 *     description: A ProductionLine owns Sections; multiple Sections may belong to one line. The collection carries no Station identity.
	 *     tags: [PATS Floor]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: search
	 *         schema: { type: string }
	 *       - in: query
	 *         name: page
	 *         schema: { type: integer, minimum: 1, default: 1 }
	 *       - in: query
	 *         name: limit
	 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
	 *     responses:
	 *       200: { description: Paginated production-line summaries }
	 *       400: { description: Malformed or incomplete collection query }
	 *       401: { description: Authentication required }
	 *       403: { description: operations.manage capability required }
	 *       503: { description: Production-line data unavailable }
	 */
	router.get("/production-lines", requireCapability("execution.read"), async (req, res) => {
		const page = pagination(req, res, ["search"]);
		if (!page) return;
		try {
			const requestQuery = query(req);
			const searchRaw = requestQuery.search;
			const searchText = (Array.isArray(searchRaw) ? searchRaw[0] : searchRaw)?.toString().trim() ?? "";
			const skip = (page.page - 1) * page.limit;
			const whereClause = searchText
				? {
						OR: [
							{ name: { contains: searchText, mode: "insensitive" as const } },
							{ lineCode: { contains: searchText, mode: "insensitive" as const } },
						],
				  }
				: undefined;
			const [totalItems, lines] = await Promise.all([
				database.productionLine.count({ where: whereClause }),
				database.productionLine.findMany({
					where: whereClause,
					orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
					skip,
					take: page.limit,
					select: { id: true, lineCode: true, name: true, displayOrder: true, isEnabled: true },
				}),
			]);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(lines.map((line) => ({
				productionLineId: line.id,
				lineCode: line.lineCode,
				name: line.name,
				displayOrder: line.displayOrder,
				isEnabled: line.isEnabled,
			})), page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS production-line data is unavailable.");
		}
	});

	router.get(["/sections/:sectionId/history", "/stations/:stationId/history"], requireCapability("execution.read"), async (req, res) => {
		try {
			const station = await database.section.findUnique({
				where: { id: req.params.sectionId ?? req.params.stationId },
				select: {
					id: true,
					sectionCode: true,
					name: true,
					stageId: true,
					boundSteps: { select: { stageId: true, subStageId: true } },
				},
			});
			if (!station) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The requested station was not found.");
				return;
			}

			const boundSteps = resolveStationBoundSteps(station);
			const stageIds = [...new Set(boundSteps.map((step) => step.stageId))];
			const stepFilter = boundStepsOrFilter(boundSteps);
			const [stages, events, violations] = await Promise.all([
				database.stage.findMany({ where: { id: { in: stageIds } }, select: { id: true, name: true } }),
				database.stageEvent.findMany({
					where: stepFilter,
					orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
					include: { actorSubject: { select: { displayNameSnapshot: true } } },
				}),
				database.routingViolation.findMany({
					where: { AND: [stepFilterAsViolationWhere(boundSteps), { status: "OPEN" }] },
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

			res.setHeader("Cache-Control", "no-store");
			applyLegacyStationHeaders(req, res);
			res.json({
				station: { id: station.id, stationCode: station.sectionCode, name: station.name, stageId: station.stageId },
				// Canonical alias for the renamed resource; `station` is the TRANSITIONAL shape (§7).
				section: { id: station.id, sectionCode: station.sectionCode, name: station.name, stageId: station.stageId },
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

	/**
	 * Rebuildable station support projection for workstation secondary cards.
	 * - todayOutput: first-success PrintJobs (SENT|SIMULATED, sequence 1) at this station today
	 * - materials: positions on bound steps that have not had a first-success print here
	 * - lotPlans: ceil(lot.requiredProductionQuantity / lot.labelPackSize) — Lot Progress
	 *   denominator is the lot plan, never hop occupancy (how many sit at this PC)
	 * - wipProgress: same positions (compat)
	 * - staff / expectedOutput / targetQuantity: null until product owns sources
	 */
	router.get(["/sections/:sectionId/support", "/stations/:stationId/support"], requireCapability("execution.read"), async (req, res) => {
		try {
			const requestQuery = query(req);
			const allowedKeys = new Set(["date"]);
			if (Object.keys(requestQuery).some((key) => !allowedKeys.has(key))) {
				problem(req, res, 400, PROBLEM_TYPE.malformed, "Bad Request", "The support query is invalid.");
				return;
			}
			const window = parseSupportDateWindow(requestQuery.date);
			if (!window.ok) {
				problem(req, res, 400, PROBLEM_TYPE.malformed, "Bad Request", "The support date must be YYYY-MM-DD.");
				return;
			}

			const station = await database.section.findUnique({
				where: { id: req.params.sectionId ?? req.params.stationId },
				select: {
					id: true,
					sectionCode: true,
					name: true,
					stageId: true,
					boundSteps: { select: { stageId: true, subStageId: true } },
				},
			});
			if (!station) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The requested station was not found.");
				return;
			}

			const boundSteps = resolveStationBoundSteps(station);
			const stepFilter = boundStepsOrFilter(boundSteps);

		const [todaysPrints, printedHere, positions] = await Promise.all([
			database.printJob.findMany({
				where: {
					sectionId: station.id,
					sequence: 1,
					status: { in: ["SENT", "SIMULATED"] },
					occurredAt: { gte: window.start, lt: window.end },
				},
				select: { id: true, batchId: true, quantity: true },
			}),
			database.printJob.findMany({
				where: {
					sectionId: station.id,
					sequence: 1,
					status: { in: ["SENT", "SIMULATED"] },
				},
					// PrintJob.batchId is a scalar — there is no Prisma `batch` relation.
					select: { batchId: true, quantity: true },
				}),
				database.batchPositionProjection.findMany({
					where: stepFilter,
					orderBy: [{ updatedAt: "desc" }, { batchId: "asc" }],
					include: {
						batch: {
							select: {
								id: true,
								batchCode: true,
								barcodeValue: true,
								plannedQuantity: true,
								status: true,
								lot: {
									select: {
										id: true,
										lotCode: true,
										requiredProductionQuantity: true,
										labelPackSize: true,
									},
								},
								parts: {
									orderBy: { partId: "asc" },
									take: 1,
									select: { part: { select: { partName: true } } },
								},
							},
						},
					},
				}),
			]);

			const issuedBatchIds = new Set(printedHere.map((job) => job.batchId));
			const quantity = todaysPrints.reduce((sum, job) => sum + (Number(job.quantity) || 0), 0);
			const wipBatches = positions.map((position) => {
				const qty = Number(position.quantityMagnitude ?? 0);
				const quantityAtStation = Number.isFinite(qty) ? qty : 0;
				const planned =
					position.batch.plannedQuantity != null && Number.isFinite(Number(position.batch.plannedQuantity))
						? Number(position.batch.plannedQuantity)
						: null;
				const progressRatio =
					planned != null && planned > 0 ? Math.min(1, quantityAtStation / planned) : null;
				return {
					batchId: position.batch.id,
					batchCode: position.batch.batchCode,
					barcodeValue: position.batch.barcodeValue,
					partName: position.batch.parts[0]?.part.partName ?? position.batch.batchCode,
					lotId: position.batch.lot.id,
					lotCode: position.batch.lot.lotCode,
					lotRequiredQuantity: Number(position.batch.lot.requiredProductionQuantity) || 0,
					lotBatchSize: Number(position.batch.lot.labelPackSize) || 0,
					stageId: position.stageId,
					subStageId: position.subStageId,
					status: position.batch.status,
					quantity: quantityAtStation,
					plannedQuantity: planned,
					progressRatio,
				};
			});
			const materials = wipBatches
				.filter((row) => !issuedBatchIds.has(row.batchId))
				.map((row) => ({
					batchId: row.batchId,
					barcodeValue: row.barcodeValue,
					partName: row.partName,
					quantity: row.quantity,
				}));

			type LotPlanRow = {
				lotId: string;
				lotCode: string;
				requiredQuantity: number;
				batchSize: number;
				plannedBatchCount: number;
				completedBatchCount: number;
				completedQuantity: number;
			};
			const lotPlanMap = new Map<string, LotPlanRow>();
			const upsertLotPlan = (
				lot:
					| {
							id: string;
							lotCode: string;
							requiredProductionQuantity?: number;
							labelPackSize?: number;
					  }
					| undefined,
				batchSizeFallback = 0,
			) => {
				if (!lot) return;
				const requiredQuantity = Number(lot.requiredProductionQuantity) || 0;
				const batchSize = (Number(lot.labelPackSize) || 0) || batchSizeFallback;
				const plannedBatchCount =
					requiredQuantity > 0 && batchSize > 0
						? Math.ceil(requiredQuantity / batchSize)
						: 0;
				if (plannedBatchCount <= 0 || lotPlanMap.has(lot.id)) return;
				lotPlanMap.set(lot.id, {
					lotId: lot.id,
					lotCode: lot.lotCode,
					requiredQuantity,
					batchSize,
					plannedBatchCount,
					completedBatchCount: 0,
					completedQuantity: 0,
				});
			};

			for (const row of wipBatches) {
				upsertLotPlan(
					{
						id: row.lotId,
						lotCode: row.lotCode,
						requiredProductionQuantity: row.lotRequiredQuantity,
						labelPackSize: row.lotBatchSize,
					},
					row.quantity,
				);
			}
			for (const job of printedHere) {
				const hop = wipBatches.find((row) => row.batchId === job.batchId);
				if (!hop) continue;
				const plan = lotPlanMap.get(hop.lotId);
				if (!plan) continue;
				plan.completedBatchCount += 1;
				plan.completedQuantity += Number(job.quantity) || hop.quantity || 0;
			}
			const lotPlans = [...lotPlanMap.values()];

			res.setHeader("Cache-Control", "no-store");
			applyLegacyStationHeaders(req, res);
			res.json({
				stationId: station.id,
				stationCode: station.sectionCode,
				// Canonical aliases for the renamed resource (§7).
				sectionId: station.id,
				sectionCode: station.sectionCode,
				name: station.name,
				asOf: new Date().toISOString(),
				date: window.dateKey,
				todayOutput: {
					quantity,
					eventCount: todaysPrints.length,
					/** No schedule/target resource yet — always null (do not invent). */
					targetQuantity: null,
				},
				wipProgress: {
					batchCount: wipBatches.length,
					totalQuantity: wipBatches.reduce((sum, row) => sum + row.quantity, 0),
					batches: wipBatches,
				},
				materials,
				lotPlans,
				staff: null,
				expectedOutput: null,
			});
		} catch (error) {
			console.error("station support unavailable", error);
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS station support data is unavailable.");
		}
	});

	router.get("/station-steps", requireCapability("execution.read"), async (req, res) => {
		try {
		const stationSteps = await database.stationStep.findMany({
			orderBy: [{ sectionId: "asc" }, { stageId: "asc" }, { id: "asc" }],
			include: {
				section: { select: { id: true, sectionCode: true, name: true } },
				stage: { select: { id: true, name: true } },
				subStage: { select: { id: true, name: true } },
			},
		});
		const stationStepsResponse = stationSteps.map((step) => ({
			...step,
			// Transitional `station` shape (§7) beside the canonical `section` shape.
			station: { id: step.section.id, stationCode: step.section.sectionCode, name: step.section.name },
			section: { id: step.section.id, sectionCode: step.section.sectionCode, name: step.section.name },
		}));
			res.setHeader("Cache-Control", "no-store").json({ data: stationStepsResponse });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS station-step configuration is unavailable.");
		}
	});

	router.get("/work-processes", requireCapability("execution.read"), async (req, res) => {
		const page = pagination(req, res, ["subStageId", "search"]);
		if (!page) return;
		try {
			const requestQuery = query(req);
			const subStageId = Array.isArray(requestQuery.subStageId)
				? requestQuery.subStageId[0]
				: requestQuery.subStageId;
			const searchRaw = requestQuery.search;
			const searchText = (Array.isArray(searchRaw) ? searchRaw[0] : searchRaw)?.toString().trim() ?? "";
			const skip = (page.page - 1) * page.limit;
			const where = { isEnabled: true, ...(subStageId ? { subStageId } : {}) };
			const [totalItems, processes] = await Promise.all([
				searchText.length >= 3
					? database.$queryRaw<{ count: number }[]>(Prisma.sql`
						SELECT COUNT(*)::integer AS count FROM "WorkProcess" wp
						LEFT JOIN "SubStage" subStage ON wp."subStageId" = subStage."id"
						WHERE wp."isEnabled" = true
						${subStageId ? Prisma.sql`AND wp."subStageId" = ${subStageId}` : Prisma.sql``}
						AND (wp."name" % ${searchText} OR subStage."name" % ${searchText})
					`).then(r => r[0]?.count ?? 0)
					: database.workProcess.count({ where }),
				searchText.length >= 3
					? database.$queryRaw<{ id: string; subStageId: string; subStageName: string; name: string; displayOrder: number; isEnabled: boolean; sectionId: string | null; parentProcessId: string | null }[]>(Prisma.sql`
						SELECT wp."id", wp."subStageId", subStage."name" AS "subStageName", wp."name", wp."displayOrder", wp."isEnabled", wp."sectionId", wp."parentProcessId"
						FROM "WorkProcess" wp
						LEFT JOIN "SubStage" subStage ON wp."subStageId" = subStage."id"
						WHERE wp."isEnabled" = true
						${subStageId ? Prisma.sql`AND wp."subStageId" = ${subStageId}` : Prisma.sql``}
						AND (wp."name" % ${searchText} OR subStage."name" % ${searchText})
						ORDER BY wp."displayOrder" ASC, wp."id" ASC, wp."name" <-> ${searchText}
						LIMIT ${page.limit} OFFSET ${skip}
					`)
					: database.workProcess.findMany({
							where,
							orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
							skip,
							take: page.limit,
							include: { subStage: { select: { id: true, name: true } } },
					  }),
			]);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(processes.map((p) => ({
				id: p.id,
				subStageId: p.subStageId,
				subStageName: "subStage" in p ? (p.subStage?.name ?? null) : p.subStageName,
				name: p.name,
				displayOrder: p.displayOrder,
				isEnabled: p.isEnabled,
				sectionId: p.sectionId,
				parentProcessId: p.parentProcessId,
			})), page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS work-process catalog is unavailable.");
		}
	});

	router.get("/booths", requireCapability("execution.read"), async (req, res) => {
		try {
		const requestQuery = query(req);
		// `section_id` is canonical snake_case (§5); `station_id` + `stationId` are
		// the TRANSITIONAL aliases (§7). All three filter the renamed `sectionId` column.
		const allowedKeys = new Set(["section_id", "station_id", "stationId"]);
		if (Object.keys(requestQuery).some((key) => !allowedKeys.has(key))) {
			problem(req, res, 400, PROBLEM_TYPE.malformed, "Bad Request", "The booth query is invalid.");
			return;
		}
		const sectionIdRaw =
			requestQuery.section_id ?? requestQuery.station_id ?? requestQuery.stationId;
		const sectionId = Array.isArray(sectionIdRaw)
			? sectionIdRaw[0]
			: sectionIdRaw;
		const booths = await database.booth.findMany({
			where: {
				isEnabled: true,
				...(sectionId ? { sectionId } : {}),
			},
			orderBy: [{ displayOrder: "asc" }, { boothCode: "asc" }],
		});
		res.setHeader("Cache-Control", "no-store").json({
			data: booths.map((booth) => ({
				id: booth.id,
				boothCode: booth.boothCode,
				label: booth.label,
				// Transitional `stationId` (§7) beside the canonical `sectionId`.
				stationId: booth.sectionId,
				sectionId: booth.sectionId,
					stageId: booth.stageId,
					subStageId: booth.subStageId,
					workProcessId: booth.workProcessId,
					displayOrder: booth.displayOrder,
					isEnabled: booth.isEnabled,
				})),
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS booth catalog is unavailable.");
		}
	});

	// Line-screen catalog (1 line = 1 station screen). Admin sees all lines;
	// everyone else sees only lines they are active leader or active operator on.
	router.get("/lines", requireCapability("execution.read"), async (req, res) => {
		const page = pagination(req, res, ["section_id", "process_id", "include_disabled"]);
		if (!page) return;
		try {
			const requestQuery = query(req);
			const single = (key: string) => {
				const raw = requestQuery[key];
				return Array.isArray(raw) ? raw[0] : raw;
			};
			const sectionId = single("section_id");
			const processId = single("process_id");
			const includeDisabled = single("include_disabled") === "true";
			const subjectId = actorId(req);
			const assignments: SubjectAssignmentRecord[] = (req as Request & { canonicalAssignments?: SubjectAssignmentRecord[] }).canonicalAssignments ?? [];
			const isAdmin = hasCapability(assignments, "operations.manage");
			const scopeFilter = isAdmin
				? {}
				: {
						OR: [
							{ activeLeaderId: subjectId },
							{ assignedLeaderId: subjectId },
							{ operatorAssignments: { some: { subjectId, status: "ACTIVE" as const } } },
						],
				  };
			const where = {
				...(includeDisabled ? {} : { isEnabled: true }),
				...(sectionId ? { sectionId } : {}),
				...(processId ? { processId } : {}),
				...scopeFilter,
			};
			const [totalItems, lines] = await Promise.all([
				database.line.count({ where }),
				database.line.findMany({
					where,
					orderBy: [{ displayOrder: "asc" }, { lineCode: "asc" }],
					skip: (page.page - 1) * page.limit,
					take: page.limit,
					include: {
						workProcess: { select: { id: true, name: true } },
						section: { select: { id: true, sectionCode: true, name: true } },
						assignedLeader: { select: { id: true, displayNameSnapshot: true } },
						activeLeader: { select: { id: true, displayNameSnapshot: true } },
						operatorAssignments: {
							where: { status: "ACTIVE" },
							select: { id: true, subjectId: true, subject: { select: { id: true, displayNameSnapshot: true } } },
						},
					},
				}),
			]);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(lines.map((line) => ({
				id: line.id,
				lineCode: line.lineCode,
				label: line.label,
				sectionId: line.sectionId,
				sectionCode: line.section.sectionCode,
				sectionName: line.section.name,
				processId: line.workProcess.id,
				processName: line.workProcess.name,
				assignedLeader: { id: line.assignedLeader.id, name: line.assignedLeader.displayNameSnapshot },
				activeLeader: line.activeLeader ? { id: line.activeLeader.id, name: line.activeLeader.displayNameSnapshot } : null,
				operators: line.operatorAssignments.map((assignment) => ({
					assignmentId: assignment.id,
					subjectId: assignment.subjectId,
					name: assignment.subject.displayNameSnapshot,
				})),
				displayOrder: line.displayOrder,
				isEnabled: line.isEnabled,
				rowVersion: line.rowVersion,
				stationScreen: line.isEnabled && Boolean(line.activeLeader ?? line.assignedLeader),
			})), page, totalItems));
		} catch (error) {
			console.error("[domain-read] GET /lines failed:", error);
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS line catalog is unavailable.");
		}
	});

	// Attention flags for the leader switcher red dot (L-12). Evidence-derived:
	// open violations at the line's sub-stage, WIP parked at that sub-stage
	// longer than 8h, and no daily sheet row for today for the line's process.
	router.get("/lines/:lineId/attention", requireCapability("execution.read"), async (req, res) => {
		try {
			const line = await database.line.findUnique({
				where: { id: req.params.lineId },
				select: {
					id: true,
					lineCode: true,
					isEnabled: true,
					workProcess: { select: { id: true, subStageId: true } },
				},
			});
			if (!line || !line.isEnabled) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The requested line was not found.");
				return;
			}
			const subjectId = actorId(req);
			const assignments: SubjectAssignmentRecord[] = (req as Request & { canonicalAssignments?: SubjectAssignmentRecord[] }).canonicalAssignments ?? [];
			const isAdmin = hasCapability(assignments, "operations.manage");
			if (!isAdmin) {
				const activeOperatorAssignment = await database.lineOperatorAssignment.findFirst({
					where: { subjectId, status: "ACTIVE", lineId: line.id },
					select: { id: true },
				});
				const leadsLine = await database.line.findFirst({
					where: { id: line.id, OR: [{ activeLeaderId: subjectId }, { assignedLeaderId: subjectId }] },
					select: { id: true },
				});
				if (!activeOperatorAssignment && !leadsLine) {
					problem(req, res, 403, PROBLEM_TYPE.authorizationDenied, "Forbidden", "The subject is not scoped to this line.");
					return;
				}
			}
			const subStageId = line.workProcess.subStageId;
			const stuckThreshold = new Date(Date.now() - 8 * 60 * 60 * 1000);
			const productionDate = new Date().toISOString().slice(0, 10);
			const [openViolations, stuckWip, todaysSheets] = await Promise.all([
				subStageId ? database.routingViolation.count({ where: { status: "OPEN", attemptedSubStageId: subStageId } }) : Promise.resolve(0),
				subStageId ? database.batchPositionProjection.count({ where: { subStageId, updatedAt: { lt: stuckThreshold } } }) : Promise.resolve(0),
				database.monitoringDailySheet.count({ where: { productionDate, workProcessId: line.workProcess.id } }),
			]);
			res.setHeader("Cache-Control", "no-store").json({
				lineId: line.id,
				lineCode: line.lineCode,
				openViolations,
				stuckWip,
				unfilledHour: todaysSheets === 0,
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS line attention data is unavailable.");
		}
	});

	// Subject directory for leader/operator pickers (admin identity.read).
	router.get("/subjects", requireCapability("identity.read"), async (req, res) => {
		const page = pagination(req, res, ["search", "status"]);
		if (!page) return;
		try {
			const requestQuery = query(req);
			const single = (key: string) => {
				const raw = requestQuery[key];
				return Array.isArray(raw) ? raw[0] : raw;
			};
			const search = single("search")?.trim() ?? "";
			const status = single("status")?.trim();
			const where = {
				...(status ? { status: status as "ACTIVE" | "DISABLED" } : {}),
				...(search.length > 0
					? { displayNameSnapshot: { contains: search, mode: "insensitive" as const } }
					: {}),
			};
			const [totalItems, subjects] = await Promise.all([
				database.subject.count({ where }),
				database.subject.findMany({
					where,
					orderBy: [{ displayNameSnapshot: "asc" }, { id: "asc" }],
					skip: (page.page - 1) * page.limit,
					take: page.limit,
					select: {
						id: true,
						displayNameSnapshot: true,
						emailSnapshot: true,
						status: true,
					},
				}),
			]);
			res.setHeader("Cache-Control", "no-store").json(buildOffsetPage(subjects, page, totalItems));
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS subject directory is unavailable.");
		}
	});

	router.get("/monitoring/daily-sheets", requireCapability("monitoring.read"), async (req, res) => {
		try {
			const sheets = await database.monitoringDailySheet.findMany({
				orderBy: [{ productionDate: "desc" }, { updatedAt: "desc" }],
			});
			res.setHeader("Cache-Control", "no-store").json({
				data: sheets.map((sheet) => sheet.payloadJson),
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS monitoring daily sheets are unavailable.");
		}
	});

	router.get("/monitoring/daily-sheets/:sheetId", requireCapability("monitoring.read"), async (req, res) => {
		try {
			const sheet = await database.monitoringDailySheet.findUnique({ where: { id: req.params.sheetId } });
			if (!sheet) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The monitoring daily sheet was not found.");
				return;
			}
			res.setHeader("Cache-Control", "no-store")
				.setHeader("ETag", `"${sheet.rowVersion}"`)
				.json(sheet.payloadJson);
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS monitoring daily sheets are unavailable.");
		}
	});

	router.get("/monitoring/station-boards", requireCapability("monitoring.read"), async (req, res) => {
		try {
			const boards = await database.monitoringStationBoard.findMany({
				orderBy: [{ productionDate: "desc" }, { updatedAt: "desc" }],
			});
			res.setHeader("Cache-Control", "no-store").json({
				data: boards.map((board) => board.payloadJson),
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS monitoring station boards are unavailable.");
		}
	});

	router.get("/monitoring/station-boards/:boardId", requireCapability("monitoring.read"), async (req, res) => {
		try {
			const board = await database.monitoringStationBoard.findUnique({ where: { id: req.params.boardId } });
			if (!board) {
				problem(req, res, 404, PROBLEM_TYPE.notFound, "Not Found", "The monitoring station board was not found.");
				return;
			}
			res.setHeader("Cache-Control", "no-store")
				.setHeader("ETag", `"${board.rowVersion}"`)
				.json(board.payloadJson);
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS monitoring station boards are unavailable.");
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

	router.get("/batches/resolve", requireCapability("execution.read"), async (req, res) => {
		try {
			const requestQuery = query(req);
			if (Object.keys(requestQuery).some((key) => key !== "code")) {
				problem(req, res, 400, PROBLEM_TYPE.malformed, "Bad Request", "The resolve query is invalid.");
				return;
			}
			const code = parseBatchResolveCode(requestQuery.code);
			const body = await resolveBatchByCode(database, code);
			res.setHeader("Cache-Control", "no-store").json(body);
		} catch (error) {
			if (error instanceof CommandProblem) {
				sendCommandProblem(req, res, error);
				return;
			}
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS batch resolve is unavailable.");
		}
	});

	router.get("/print-jobs", requireCapability("execution.read"), async (req, res) => {
		try {
			const batchId = query(req).batchId ?? query(req).batch_id;
			const where = typeof batchId === "string" && batchId.trim() ? { batchId } : {};
			const jobs = await database.printJob.findMany({
				where,
				orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
				take: 50,
			});
			res.setHeader("Cache-Control", "no-store").json({
				data: jobs.map((job) => ({
					...job,
					occurredAt: job.occurredAt.toISOString(),
				})),
			});
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS print jobs are unavailable.");
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
							lineId: true,
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
									requiredProductionQuantity: true,
									labelPackSize: true,
									// Floor release gate: operators lack planning.read, so the
									// position row carries project status for the arrival queue.
									project: { select: { status: true } },
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
						lot: (() => {
							const { project: projectRef, ...lot } = position.batch.lot;
							return {
								...lot,
								// Floor release gate: operators lack planning.read, so the
								// position row carries project status for the arrival queue.
								projectStatus: projectRef?.status ?? null,
							};
						})(),
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

	router.get("/quality-inspections/resolve", requireCapability("quality.resolve"), async (req, res) => {
		try {
			const requestQuery = query(req);
			if (Object.keys(requestQuery).some((key) => key !== "code")) {
				problem(req, res, 400, PROBLEM_TYPE.malformed, "Bad Request", "The resolve query is invalid.");
				return;
			}
			const code = parseResolveCode(requestQuery.code);
			const body = await resolveQualityInspectionByCode(database, { subjectId: actorId(req), code });
			res.setHeader("Cache-Control", "no-store").json(body);
		} catch (error) {
			if (error instanceof CommandProblem) {
				sendCommandProblem(req, res, error);
				return;
			}
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS quality resolve is unavailable.");
		}
	});

	router.get("/quality-inspections", requireCapability("quality.read"), async (req, res) => {
		try {
			const allowedStageIds = await listAllowedQualityStageIds(database, actorId(req));
			if (allowedStageIds.length === 0) {
				res.setHeader("Cache-Control", "no-store").json({ data: [] });
				return;
			}
			const inspections = await database.qualityInspection.findMany({
				where: { stageId: { in: allowedStageIds } },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				include: { decisions: { orderBy: [{ decidedAt: "desc" }, { id: "desc" }] }, batch: { select: { id: true, batchCode: true, lotId: true, plannedQuantity: true, parts: { orderBy: [{ partId: "asc" }], take: 1, select: { partId: true, quantity: true, quantityMagnitude: true, quantityUom: true, part: { select: { id: true, partCode: true, partName: true } } } } } } },
			});
			res.setHeader("Cache-Control", "no-store").json({ data: inspections.map((inspection) => ({ ...inspection, inspectedQuantity: decimal(inspection.inspectedQuantity), startedAt: inspection.startedAt.toISOString(), completedAt: date(inspection.completedAt) })) });
		} catch {
			problem(req, res, 503, PROBLEM_TYPE.dependency, "Dependency Unavailable", "PATS quality inspection data is unavailable.");
		}
	});

	router.get("/dashboard-summaries", requireCapability("dashboard.read"), async (req, res) => {
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

	router.get("/reports/line", requireCapability("dashboard.read"), async (req, res) => {
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
