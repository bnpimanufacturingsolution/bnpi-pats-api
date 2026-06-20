import { Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { validateQueryParams } from "../../helper/validation-helper";
import {
	buildFilterConditions,
	buildFindManyQuery,
	buildSearchConditions,
	getNestedFields,
} from "../../helper/query-builder";
import { buildSuccessResponse, buildPagination } from "../../helper/success-handler";
import { groupDataByField } from "../../helper/dataGrouping";
import { handleNotFound, handleUpdateNotFound } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { usageCodeRepository } from "./usageCode.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const usageCodeLogger = createLogger("usageCode");

export const controller = (prisma: PrismaClient) => {
	const repository = usageCodeRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId: workspaceId };

		const usageCode = await repository.create(validatedData);
		usageCodeLogger.info(`UsageCode created: ${usageCode.id}`);

		logCreate(req, "UsageCode", usageCode);
		await invalidateEntityCache("usageCode", usageCodeLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.USAGE_CODE.CREATED, usageCode, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, usageCodeLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		usageCodeLogger.info(`Getting usageCodes, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.UsageCodeWhereInput = { isDeleted: false, workspaceId: workspaceId };
		const searchFields = ["name", "code", "description"];

		if (query) {
			const searchConditions = buildSearchConditions("UsageCode", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("UsageCode", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "UsageCode");
		const [usageCodes, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		usageCodeLogger.info(`Retrieved ${usageCodes.length} usageCodes`);

		const processedData = groupBy && document ? groupDataByField(usageCodes, groupBy as string) : usageCodes;
		const responseData: Record<string, unknown> = {
			...(document && { usageCodes: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "UsageCode", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.USAGE_CODE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		usageCodeLogger.info(`Getting usageCode by ID: ${id}`);

		const validationResult = validateQueryParams(req, usageCodeLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const { fields } = validationResult.validatedParams!;
		const query: Prisma.UsageCodeFindFirstArgs = { where: { id, isDeleted: false, workspaceId: workspaceId } };

		if (fields && fields.length > 0) {
			query.select = getNestedFields(fields);
		}

		const usageCode = await repository.getById(query);

		if (handleNotFound(usageCode, res, "UsageCode", usageCodeLogger, id)) return;

		usageCodeLogger.info(`UsageCode retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.USAGE_CODE.RETRIEVED, usageCode, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const validatedData = req.body;

		const { existingUsageCode, updatedUsageCode } = await repository.update(id, validatedData, workspaceId);

		if (handleUpdateNotFound(existingUsageCode, updatedUsageCode, res, "UsageCode", usageCodeLogger, id)) return;

		usageCodeLogger.info(`UsageCode updated: ${id}`);

		logUpdate(req, "UsageCode", id, existingUsageCode!, updatedUsageCode!);
		await invalidateEntityCache("usageCode", usageCodeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.USAGE_CODE.UPDATED, updatedUsageCode, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		usageCodeLogger.info(`Deleting usageCode: ${id}`);

		const usageCode = await repository.remove(id, workspaceId);

		if (handleNotFound(usageCode, res, "UsageCode", usageCodeLogger, id)) return;

		usageCodeLogger.info(`UsageCode deleted: ${id}`);

		logDelete(req, "UsageCode", usageCode!);
		await invalidateEntityCache("usageCode", usageCodeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.USAGE_CODE.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};

export type UsageCodeController = ReturnType<typeof controller>;
