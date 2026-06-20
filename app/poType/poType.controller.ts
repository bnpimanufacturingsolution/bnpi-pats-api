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
import { handleNotFound, handleUpdateNotFound, validateUpdatePayload } from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";

import { config } from "../../config/constant";
import { poTypeRepository } from "./poType.repository";
import { CreatePOType, UpdatePOType } from "../../zod/poType.zod";
import { POType } from "../../generated/prisma";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const poTypeLogger = createLogger("poType");

export const controller = (prisma: PrismaClient) => {
	const repository = poTypeRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const poTypeData: CreatePOType = { ...req.body, workspaceId };

		const poType: POType = await repository.create(poTypeData);
		poTypeLogger.info(`PO Type created: ${poType.id}`);

		logCreate(req, "POType", { ...poType, name: poType.name });
		await invalidateEntityCache("poType", poTypeLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.PO_TYPE.CREATED, poType, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, poTypeLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		poTypeLogger.info(`Getting PO types, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.POTypeWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["code", "name", "description"];

		if (query) {
			const searchConditions = buildSearchConditions("POType", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("POType", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "POType");
		const [poTypes, total]: [POType[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		poTypeLogger.info(`Retrieved ${poTypes.length} PO types`);

		const processedData = groupBy && document ? groupDataByField(poTypes, groupBy as string) : poTypes;
		const responseData: Record<string, unknown> = {
			...(document && { poTypes: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "POType", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PO_TYPE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		poTypeLogger.info(`Getting PO type by ID: ${id}`);

		const cacheKey = `cache:poType:byId:${id}:${fields || "full"}`;
		const poType = await getOrFetch(cacheKey, async () => {
			const query: Prisma.POTypeFindFirstArgs = { where: { id, workspaceId, isDeleted: false } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(poType, res, "POType", poTypeLogger, id)) return;

		poTypeLogger.info(`PO Type retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PO_TYPE.RETRIEVED, poType, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, poTypeLogger)) return;

		const validatedData = req.body;
		poTypeLogger.info(`Updating PO type: ${id}`);

		const updateData: UpdatePOType = { ...validatedData };
		const { existingPOType, updatedPOType } = await repository.update(id, updateData, workspaceId);

		if (handleUpdateNotFound(existingPOType, updatedPOType, res, "POType", poTypeLogger, id)) return;

		poTypeLogger.info(`PO Type updated: ${id}`);

		logUpdate(req, "POType", id, existingPOType!, { ...updatedPOType!, name: updatedPOType!.name });
		await invalidateEntityCache("poType", poTypeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PO_TYPE.UPDATED, { poType: updatedPOType }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		poTypeLogger.info(`Deleting PO type: ${id}`);

		const existingPOType = await repository.remove(id, workspaceId);

		if (handleNotFound(existingPOType, res, "POType", poTypeLogger, id)) return;

		poTypeLogger.info(`PO Type deleted: ${id}`);

		logDelete(req, "POType", { ...existingPOType!, name: existingPOType!.name });
		await invalidateEntityCache("poType", poTypeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PO_TYPE.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
