import { Response, NextFunction } from "express";
import { PrismaClient, Prisma, DemandPlan, DemandEstimateVersion } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { validateQueryParams } from "../../helper/validation-helper";
import {
	buildFilterConditions,
	buildFindManyQuery,
	buildSearchConditions,
	getNestedFields,
} from "../../helper/query-builder";
import { buildSuccessResponse, buildPagination } from "../../helper/success-handler";
import {
	handleNotFound,
	handleUpdateNotFound,
	validateUpdatePayload,
} from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";
import { groupDataByField } from "../../helper/dataGrouping";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";
import { demandRepository } from "./demand.repository";
import {
	CreateDemandPlan,
	UpdateDemandPlan,
	CreateDemandLine,
	UpdateDemandLine,
	CreateDemandEstimateVersion,
	UpdateDemandEstimateVersion,
	CreateProjectConversion,
} from "../../zod/demand.zod";
import {
	buildProductSnapshot,
	DemandProductSnapshotSource,
	generateDemandPlanCode,
	getNextNumericSequence,
	normalizeDemandPlanCode,
} from "./demand.utils";

const demandLogger = createLogger("demand-plan");

const PLAN_LIST_INCLUDE = {
	demandLines: {
		where: { isDeleted: false },
	},
	estimateVersions: {
		where: { isDeleted: false },
	},
	projectConversions: {
		where: { isDeleted: false },
	},
} as Prisma.DemandPlanInclude;

const PLAN_DETAIL_INCLUDE = {
	demandLines: {
		where: { isDeleted: false },
		orderBy: { lineNo: "asc" as const },
		include: {
			product: true,
		},
	},
	estimateVersions: {
		where: { isDeleted: false },
		orderBy: { versionNumber: "desc" as const },
		include: {
			demandEstimateLines: {
				where: { isDeleted: false },
				orderBy: { lineNo: "asc" as const },
				include: {
					demandLine: true,
					product: true,
				},
			},
			demandMaterialRequirements: {
				where: { isDeleted: false },
				orderBy: { lineNo: "asc" as const },
			},
			demandLaborRequirements: {
				where: { isDeleted: false },
				orderBy: { lineNo: "asc" as const },
			},
			projectConversion: true,
		},
	},
	projectConversions: {
		where: { isDeleted: false },
		orderBy: { createdAt: "desc" as const },
	},
} as Prisma.DemandPlanInclude;

const VERSION_DETAIL_INCLUDE = {
	demandEstimateLines: {
		where: { isDeleted: false },
		orderBy: { lineNo: "asc" as const },
		include: {
			demandLine: true,
			product: true,
		},
	},
	demandMaterialRequirements: {
		where: { isDeleted: false },
		orderBy: { lineNo: "asc" as const },
	},
	demandLaborRequirements: {
		where: { isDeleted: false },
		orderBy: { lineNo: "asc" as const },
	},
	projectConversion: true,
} as Prisma.DemandEstimateVersionInclude;

type DemandQueryParams = {
	page: number;
	limit: number;
	skip: number;
	order: "asc" | "desc";
	fields?: string;
	query: string;
	filter?: string;
	document: boolean;
	pagination: boolean;
	count: boolean;
	groupBy?: string;
	sort?: string | object;
};

type DemandPlanWithRelations = DemandPlan & {
	demandLines?: Array<{
		id: string;
		productId: string;
		lineNo: number;
		productCode: string;
		productName: string;
		productRevision?: string | null;
		unitOfMeasure: string;
		quantity: number;
		productSnapshot?: unknown;
		notes?: string | null;
	}>;
	estimateVersions?: Array<{ versionNumber: number }>;
};

type DemandPlanLineRelation = NonNullable<DemandPlanWithRelations["demandLines"]>[number];

type DemandEstimateVersionWithRelations = DemandEstimateVersion & {
	demandEstimateLines?: unknown[];
	demandMaterialRequirements?: unknown[];
	demandLaborRequirements?: unknown[];
	projectConversion?: unknown | null;
};

type DemandEstimateLineDraft = {
	demandLineId: string;
	productId: string;
	lineNo?: number;
	productCode?: string;
	productName?: string;
	productRevision?: string;
	unitOfMeasure?: string;
	requestedQuantity: number;
	estimatedQuantity?: number;
	productSnapshot?: unknown;
	notes?: string;
};

type DemandEstimateLineCreatePayload = DemandEstimateLineDraft & {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	demandEstimateVersionId: string;
	lineNo: number;
	productCode: string;
	productName: string;
	unitOfMeasure: string;
};

type DemandMaterialRequirementCreatePayload = {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	demandEstimateVersionId: string;
	lineNo: number;
	materialCode?: string;
	materialName: string;
	materialType?: string;
	quantityPerUnit: number;
	totalRequiredQuantity: number;
	unitOfMeasure: string;
	scrapRatePercentage?: number;
	isOptional?: boolean;
	sourceLabel?: string;
	materialSnapshot?: unknown;
	notes?: string;
};

type DemandLaborRequirementCreatePayload = {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	demandEstimateVersionId: string;
	lineNo: number;
	stepName: string;
	workCenter?: string;
	stepOrder?: number;
	laborHours: number;
	crewSize?: number;
	ratePerHour?: number;
	totalLaborCost?: number;
	sourceLabel?: string;
	laborSnapshot?: unknown;
	notes?: string;
};

function buildDemandPlanSummary(plan: Record<string, unknown> & {
	demandLines?: unknown[];
	estimateVersions?: unknown[];
	projectConversions?: unknown[];
}) {
	return {
		...plan,
		lineCount: plan.demandLines?.length ?? 0,
		versionCount: plan.estimateVersions?.length ?? 0,
		conversionCount: plan.projectConversions?.length ?? 0,
	};
}

function buildDemandPlanLinePayload(
	product: DemandProductSnapshotSource,
	data: CreateDemandLine,
	workspaceId: string,
	organizationId?: string,
	demandPlanId?: string,
	lineNo?: number,
) {
	return {
		workspaceId,
		organizationId,
		demandPlanId: demandPlanId ?? "",
		productId: product.id,
		lineNo: lineNo ?? data.lineNo ?? 1,
		productCode: product.code,
		productName: product.name,
		productRevision: product.revision,
		unitOfMeasure: product.unitOfMeasure,
		quantity: data.quantity,
		targetDeliveryDate: data.targetDeliveryDate,
		priority: data.priority,
		productSnapshot: data.productSnapshot ?? buildProductSnapshot(product),
		notes: data.notes,
	};
}

export const controller = (prisma: PrismaClient) => {
	const repository = demandRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = req.body as CreateDemandPlan;

		const existingPlans = await prisma.demandPlan.findMany({
			where: { workspaceId, isDeleted: false },
			select: { planCode: true },
		});

		const planCode = validatedData.planCode
			? normalizeDemandPlanCode(validatedData.planCode)
			: generateDemandPlanCode(
					existingPlans.map((plan) => plan.planCode),
					validatedData.periodStart,
				).code;

		const createdPlan = await repository.createPlan({
			...validatedData,
			planCode,
			status: validatedData.status ?? "DRAFT",
			workspaceId,
			organizationId: req.organizationId,
		});

		demandLogger.info(`Demand plan created: ${createdPlan.id} (${createdPlan.planCode})`);
		logCreate(req, "DemandPlan", { ...createdPlan, name: createdPlan.planCode });
		await invalidateEntityCache("demandPlan", demandLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.CREATED, createdPlan, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, demandLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const validatedParams = validationResult.validatedParams as DemandQueryParams;
		const {
			page,
			limit,
			skip,
			order,
			sort,
			fields,
			query,
			filter,
			document,
			pagination,
			count,
			groupBy,
		} = validatedParams;

		const whereClause: Prisma.DemandPlanWhereInput = {
			isDeleted: false,
			workspaceId,
		};

		const searchFields = ["planCode", "name", "description", "periodLabel", "notes"];
		if (query) {
			const searchConditions = buildSearchConditions("DemandPlan", query, searchFields);
			if (searchConditions.length > 0) {
				whereClause.OR = searchConditions;
			}
		}

		if (filter) {
			const filterConditions = buildFilterConditions("DemandPlan", filter);
			if (filterConditions.length > 0) {
				whereClause.AND = filterConditions;
			}
		}

		const findManyQuery = buildFindManyQuery(
			whereClause,
			skip,
			limit,
			order,
			sort,
			fields,
			"DemandPlan",
		);

		if (!fields && !findManyQuery.select) {
			findManyQuery.include = PLAN_LIST_INCLUDE;
		}

		const [plans, total] = await repository.findMany(findManyQuery, whereClause, {
			document,
			count,
		});

		const summarizedPlans = document
			? plans.map((plan) => buildDemandPlanSummary(plan as any))
			: plans;
		const processedPlans =
			groupBy && document ? groupDataByField(summarizedPlans, groupBy as string) : summarizedPlans;

		const responseData: Record<string, unknown> = {
			...(document && { demandPlans: processedPlans }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "DemandPlan", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };
		const fields = typeof req.query.fields === "string" ? req.query.fields : undefined;

		if (!id) {
			throw new Error(config.ERROR.QUERY_PARAMS.MISSING_ID);
		}

		const cacheKey = `cache:demandPlan:byId:${id}:${fields || "full"}`;
		const demandPlan = await getOrFetch(cacheKey, async () => {
			const query: Prisma.DemandPlanFindFirstArgs = {
				where: { id, isDeleted: false, workspaceId },
			};

			query.select = getNestedFields(fields);

			if (!fields && !query.select) {
				query.include = PLAN_DETAIL_INCLUDE;
			}

			return repository.getById(query);
		});

		if (handleNotFound(demandPlan, res, "DemandPlan", demandLogger, id)) return;

		res.status(200).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.RETRIEVED, demandPlan, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };

		if (!validateUpdatePayload(req.body, res, demandLogger)) return;

		const validatedData = req.body as UpdateDemandPlan;
		const updateData: UpdateDemandPlan = {
			...validatedData,
			...(validatedData.planCode && { planCode: normalizeDemandPlanCode(validatedData.planCode) }),
		};

		const { existingPlan, updatedPlan } = await repository.updatePlan(id, updateData, workspaceId);
		if (handleUpdateNotFound(existingPlan, updatedPlan, res, "DemandPlan", demandLogger, id)) return;

		logUpdate(req, "DemandPlan", id, existingPlan!, {
			...updatedPlan!,
			name: updatedPlan!.planCode,
		});
		await invalidateEntityCache("demandPlan", demandLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.UPDATED, updatedPlan, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };

		const removedPlan = await repository.removePlan(id, workspaceId);
		if (handleNotFound(removedPlan, res, "DemandPlan", demandLogger, id)) return;

		logDelete(req, "DemandPlan", { ...removedPlan!, name: removedPlan!.planCode });
		await invalidateEntityCache("demandPlan", demandLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.DELETED, {}, 200));
	});

	const addLine = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };
		const validatedData = req.body as CreateDemandLine;

		const plan = await repository.getById({
			where: { id, workspaceId, isDeleted: false },
		});
		if (handleNotFound(plan, res, "DemandPlan", demandLogger, id)) return;

		const product = await repository.findProductById(validatedData.productId, workspaceId);
		if (handleNotFound(product, res, "Product", demandLogger, validatedData.productId)) return;

		const existingLines = await repository.findLinesByPlanId(id, workspaceId);
		const lineNo = validatedData.lineNo ?? getNextNumericSequence(existingLines.map((line) => line.lineNo));
		const linePayload = buildDemandPlanLinePayload(
			product!,
			validatedData,
			workspaceId,
			req.organizationId,
			id,
			lineNo,
		);

		const createdLine = await repository.createLine(linePayload);

		logCreate(req, "DemandLine", { ...createdLine, name: createdLine.productName });
		await invalidateEntityCache("demandPlan", demandLogger, id);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.LINE_CREATED, createdLine, 201));
	});

	const updateLine = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id, lineId } = req.params as { id: string; lineId: string };

		if (!validateUpdatePayload(req.body, res, demandLogger)) return;

		const validatedData = req.body as UpdateDemandLine;
		const existingLine = await repository.getLineById(lineId, workspaceId);
		if (handleNotFound(existingLine?.demandPlanId === id ? existingLine : null, res, "DemandLine", demandLogger, lineId)) return;

		let product = null;
		if (validatedData.productId) {
			product = await repository.findProductById(validatedData.productId, workspaceId);
			if (handleNotFound(product, res, "Product", demandLogger, validatedData.productId)) return;
		}

		const updateData: UpdateDemandLine = {
			...validatedData,
			...(product && {
				productCode: product.code,
				productName: product.name,
				productRevision: product.revision,
				unitOfMeasure: product.unitOfMeasure,
				productSnapshot: buildProductSnapshot(product),
			}),
		};

		const { existingLine: before, updatedLine } = await repository.updateLine(lineId, updateData, workspaceId);
		if (handleUpdateNotFound(before, updatedLine, res, "DemandLine", demandLogger, lineId)) return;

		logUpdate(req, "DemandLine", lineId, before!, {
			...updatedLine!,
			name: updatedLine!.productName,
		});
		await invalidateEntityCache("demandPlan", demandLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.LINE_UPDATED, updatedLine, 200));
	});

	const removeLine = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id, lineId } = req.params as { id: string; lineId: string };

		const existingLine = await repository.getLineById(lineId, workspaceId);
		if (handleNotFound(existingLine?.demandPlanId === id ? existingLine : null, res, "DemandLine", demandLogger, lineId)) return;

		const removedLine = await repository.removeLine(lineId, workspaceId);
		if (handleNotFound(removedLine, res, "DemandLine", demandLogger, lineId)) return;

		logDelete(req, "DemandLine", { ...removedLine!, name: removedLine!.productName });
		await invalidateEntityCache("demandPlan", demandLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.LINE_DELETED, {}, 200));
	});

	const createVersion = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };
		const validatedData = req.body as CreateDemandEstimateVersion;

		const plan = (await repository.getById({
			where: { id, workspaceId, isDeleted: false },
			include: {
				demandLines: {
					where: { isDeleted: false },
					orderBy: { lineNo: "asc" },
				},
				estimateVersions: {
					where: { isDeleted: false },
					select: { versionNumber: true },
				},
			},
		})) as DemandPlanWithRelations | null;

		if (handleNotFound(plan, res, "DemandPlan", demandLogger, id)) return;

		const nextVersionNumber =
			validatedData.versionNumber ??
			getNextNumericSequence(plan!.estimateVersions?.map((version: { versionNumber: number }) => version.versionNumber) ?? []);
		const sourceEstimateLines: DemandEstimateLineDraft[] = validatedData.estimateLines?.length
			? (validatedData.estimateLines as DemandEstimateLineDraft[])
			: ((plan!.demandLines ?? []).map((line: DemandPlanLineRelation) => ({
					demandLineId: line.id,
					productId: line.productId,
					lineNo: line.lineNo,
					productCode: line.productCode,
					productName: line.productName,
					productRevision: line.productRevision,
					unitOfMeasure: line.unitOfMeasure,
					requestedQuantity: line.quantity,
					estimatedQuantity: line.quantity,
					productSnapshot: line.productSnapshot,
					notes: line.notes,
				})) as DemandEstimateLineDraft[]);

		const normalizedEstimateLines: Array<DemandEstimateLineCreatePayload | null> = await Promise.all(
			sourceEstimateLines.map(async (line: DemandEstimateLineDraft, index: number) => {
				const sourceDemandLine = (plan!.demandLines ?? []).find((item) => item.id === line.demandLineId);
				const productId = line.productId ?? sourceDemandLine?.productId;
				if (!productId) {
					throw new Error("Product ID is required for demand estimate lines");
				}

				const product = await repository.findProductById(productId, workspaceId);
				if (handleNotFound(product, res, "Product", demandLogger, productId)) return null;

				return {
					workspaceId,
					organizationId: req.organizationId,
					demandPlanId: id,
					demandEstimateVersionId: "",
					demandLineId: line.demandLineId,
					productId,
					lineNo: line.lineNo ?? index + 1,
					productCode: line.productCode ?? sourceDemandLine?.productCode ?? product!.code,
					productName: line.productName ?? sourceDemandLine?.productName ?? product!.name,
					productRevision: line.productRevision ?? sourceDemandLine?.productRevision ?? product!.revision,
					unitOfMeasure: line.unitOfMeasure ?? sourceDemandLine?.unitOfMeasure ?? product!.unitOfMeasure,
					requestedQuantity: line.requestedQuantity ?? sourceDemandLine?.quantity ?? 0,
					estimatedQuantity: line.estimatedQuantity ?? line.requestedQuantity ?? sourceDemandLine?.quantity ?? 0,
					productSnapshot: line.productSnapshot ?? sourceDemandLine?.productSnapshot ?? buildProductSnapshot(product!),
					notes: line.notes,
				};
			}),
		);

		const validEstimateLines = normalizedEstimateLines.filter(
			(line): line is DemandEstimateLineCreatePayload => line !== null,
		);

		const normalizedMaterialRequirements: DemandMaterialRequirementCreatePayload[] = (
			validatedData.materialRequirements ?? []
		).map((material: any, index: number) => ({
			workspaceId,
			organizationId: req.organizationId,
			demandPlanId: id,
			demandEstimateVersionId: "",
			lineNo: material.lineNo ?? index + 1,
			materialCode: material.materialCode,
			materialName: material.materialName,
			materialType: material.materialType,
			quantityPerUnit: material.quantityPerUnit,
			totalRequiredQuantity: material.totalRequiredQuantity,
			unitOfMeasure: material.unitOfMeasure,
			scrapRatePercentage: material.scrapRatePercentage ?? 0,
			isOptional: material.isOptional ?? false,
			sourceLabel: material.sourceLabel,
			materialSnapshot: material.materialSnapshot,
			notes: material.notes,
		}));

		const normalizedLaborRequirements: DemandLaborRequirementCreatePayload[] = (
			validatedData.laborRequirements ?? []
		).map((labor: any, index: number) => ({
			workspaceId,
			organizationId: req.organizationId,
			demandPlanId: id,
			demandEstimateVersionId: "",
			lineNo: labor.lineNo ?? index + 1,
			stepName: labor.stepName,
			workCenter: labor.workCenter,
			stepOrder: labor.stepOrder,
			laborHours: labor.laborHours,
			crewSize: labor.crewSize,
			ratePerHour: labor.ratePerHour,
			totalLaborCost: labor.totalLaborCost,
			sourceLabel: labor.sourceLabel,
			laborSnapshot: labor.laborSnapshot,
			notes: labor.notes,
		}));

		const createdVersion = await prisma.$transaction(async (transaction) => {
			const transactionRepository = demandRepository(transaction);

			const version = await transactionRepository.createEstimateVersion({
				...validatedData,
				workspaceId,
				organizationId: req.organizationId,
				demandPlanId: id,
				versionNumber: nextVersionNumber,
				status: validatedData.status ?? "DRAFT",
			});

			for (const estimateLine of validEstimateLines) {
				await transactionRepository.createEstimateLine({
					...estimateLine,
					demandEstimateVersionId: version.id,
				});
			}

			for (const material of normalizedMaterialRequirements) {
				await transactionRepository.createMaterialRequirement({
					...material,
					demandEstimateVersionId: version.id,
				});
			}

			for (const labor of normalizedLaborRequirements) {
				await transactionRepository.createLaborRequirement({
					...labor,
					demandEstimateVersionId: version.id,
				});
			}

			return version;
		});

		const versionDetail = await prisma.demandEstimateVersion.findFirst({
			where: { id: createdVersion.id, workspaceId, isDeleted: false },
			include: VERSION_DETAIL_INCLUDE,
		});

		logCreate(req, "DemandEstimateVersion", {
			...createdVersion,
			name: createdVersion.versionLabel || `Version ${createdVersion.versionNumber}`,
		});
		await invalidateEntityCache("demandPlan", demandLogger, id);

		res.status(201).json(
			buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.VERSION_CREATED, versionDetail || createdVersion, 201),
		);
	});

	const getVersions = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };

		const plan = await repository.getById({
			where: { id, workspaceId, isDeleted: false },
			select: { id: true },
		});
		if (handleNotFound(plan, res, "DemandPlan", demandLogger, id)) return;

		const cacheKey = `cache:demandPlan:${id}:versions:${workspaceId}`;
		const versions = await getOrFetch(cacheKey, async () => repository.findVersionsByPlanId(id, workspaceId));
		res.status(200).json(
			buildSuccessResponse("Demand estimate versions retrieved successfully", versions, 200),
		);
	});

	const getVersionById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id, versionId } = req.params as { id: string; versionId: string };

		const cacheKey = `cache:demandPlan:${id}:version:${versionId}:full`;
		const version = await getOrFetch(cacheKey, async () => {
			return prisma.demandEstimateVersion.findFirst({
				where: { id: versionId, demandPlanId: id, workspaceId, isDeleted: false },
				include: VERSION_DETAIL_INCLUDE,
			});
		});

		if (handleNotFound(version, res, "DemandEstimateVersion", demandLogger, versionId)) return;

		res.status(200).json(
			buildSuccessResponse("Demand estimate version retrieved successfully", version, 200),
		);
	});

	const updateVersion = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id, versionId } = req.params as { id: string; versionId: string };

		const versionBeforeUpdate = await repository.getVersionById(versionId, workspaceId);
		if (
			handleNotFound(
				versionBeforeUpdate?.demandPlanId === id ? versionBeforeUpdate : null,
				res,
				"DemandEstimateVersion",
				demandLogger,
				versionId,
			)
		)
			return;

		if (!validateUpdatePayload(req.body, res, demandLogger)) return;

		const validatedData = req.body as UpdateDemandEstimateVersion;
		const { existingVersion, updatedVersion } = await repository.updateEstimateVersion(
			versionId,
			validatedData,
			workspaceId,
		);

		if (handleUpdateNotFound(existingVersion, updatedVersion, res, "DemandEstimateVersion", demandLogger, versionId)) {
			return;
		}

		logUpdate(req, "DemandEstimateVersion", versionId, existingVersion!, {
			...updatedVersion!,
			name: updatedVersion!.versionLabel || `Version ${updatedVersion!.versionNumber}`,
		});
		await invalidateEntityCache("demandPlan", demandLogger, existingVersion!.demandPlanId);

		res.status(200).json(
			buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.VERSION_UPDATED, updatedVersion, 200),
		);
	});

	const removeVersion = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id, versionId } = req.params as { id: string; versionId: string };

		const versionBeforeDelete = await repository.getVersionById(versionId, workspaceId);
		if (
			handleNotFound(
				versionBeforeDelete?.demandPlanId === id ? versionBeforeDelete : null,
				res,
				"DemandEstimateVersion",
				demandLogger,
				versionId,
			)
		)
			return;

		const removedVersion = await repository.removeEstimateVersion(versionId, workspaceId);
		if (handleNotFound(removedVersion, res, "DemandEstimateVersion", demandLogger, versionId)) return;

		logDelete(req, "DemandEstimateVersion", {
			...removedVersion!,
			name: removedVersion!.versionLabel || `Version ${removedVersion!.versionNumber}`,
		});
		await invalidateEntityCache("demandPlan", demandLogger, removedVersion!.demandPlanId);

		res.status(200).json(
			buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.VERSION_DELETED, {}, 200),
		);
	});

	const createProjectConversion = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };
		const validatedData = req.body as CreateProjectConversion;

		const version = await prisma.demandEstimateVersion.findFirst({
			where: {
				id: validatedData.demandEstimateVersionId,
				demandPlanId: id,
				workspaceId,
				isDeleted: false,
			},
		});

		if (handleNotFound(version, res, "DemandEstimateVersion", demandLogger, validatedData.demandEstimateVersionId)) {
			return;
		}

		const conversion = await repository.createProjectConversion({
			workspaceId,
			organizationId: req.organizationId,
			demandPlanId: id,
			demandEstimateVersionId: validatedData.demandEstimateVersionId,
			projectId: validatedData.projectId,
			conversionCode: validatedData.conversionCode,
			status: validatedData.status ?? "PENDING",
			convertedAt: validatedData.convertedAt,
			metadata: validatedData.metadata,
			notes: validatedData.notes,
		});

		logCreate(req, "ProjectConversion", {
			...conversion,
			name: conversion.conversionCode || conversion.id,
		});
		await invalidateEntityCache("demandPlan", demandLogger, id);

		res.status(201).json(
			buildSuccessResponse(config.SUCCESS.DEMAND_PLAN.PROJECT_CONVERSION_CREATED, conversion, 201),
		);
	});

	const getProjectConversions = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params as { id: string };

		const plan = await repository.getById({
			where: { id, workspaceId, isDeleted: false },
			select: { id: true },
		});
		if (handleNotFound(plan, res, "DemandPlan", demandLogger, id)) return;

		const cacheKey = `cache:demandPlan:${id}:projectConversions:${workspaceId}`;
		const conversions = await getOrFetch(cacheKey, async () =>
			repository.findProjectConversionsByPlanId(id, workspaceId),
		);
		res.status(200).json(
			buildSuccessResponse("Workspace conversions retrieved successfully", conversions, 200),
		);
	});

	return {
		create,
		getAll,
		getById,
		update,
		remove,
		addLine,
		updateLine,
		removeLine,
		createVersion,
		getVersions,
		getVersionById,
		updateVersion,
		removeVersion,
		createProjectConversion,
		getProjectConversions,
	};
};
