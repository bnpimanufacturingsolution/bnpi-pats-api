import { Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { validateQueryParams } from "../../helper/validation-helper";
import {
	buildFilterConditions,
	buildFindManyQuery,
	buildSearchConditions,
} from "../../helper/query-builder";
import { buildSuccessResponse, buildPagination } from "../../helper/success-handler";
import { assertFound } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { itemTypeRepository } from "./itemType.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const itemTypeLogger = createLogger("itemType");

export const controller = (prisma: PrismaClient) => {
	const repository = itemTypeRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		const itemType = await repository.create(validatedData);
		itemTypeLogger.info(`ItemType created: ${itemType.id}`);

		logCreate(req, "ItemType", itemType);
		await invalidateEntityCache("itemType", itemTypeLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.ITEM_TYPE.CREATED, itemType, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, itemTypeLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, skip, sort, order, query,
			filter, document, pagination, count,
		} = validationResult.validatedParams!;

		const whereClause: any = { isDeleted: false, workspaceId };
		const searchFields = ["name", "description"];

		if (query) {
			const searchConditions = buildSearchConditions("ItemType", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("ItemType", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, undefined, "ItemType");
		const itemTypes = await repository.findMany(findManyQuery);

		let total = 0;
		if (count) {
			total = await repository.count({ where: whereClause });
		}

		const responseData: Record<string, unknown> = {
			...(document && { itemTypes }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
		};

		res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM_TYPE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		const itemType = await repository.getById({ where: { id, workspaceId } });

		assertFound(itemType, "ItemType", itemTypeLogger, id);

		itemTypeLogger.info(`ItemType retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM_TYPE.RETRIEVED, itemType, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const validatedData = req.body;

		const { existingItemType, updatedItemType } = await repository.update(id, validatedData, workspaceId);

		assertFound(existingItemType, "ItemType", itemTypeLogger, id);
		assertFound(updatedItemType, "ItemType", itemTypeLogger, id);

		itemTypeLogger.info(`ItemType updated: ${id}`);

		logUpdate(req, "ItemType", id, existingItemType!, updatedItemType!);
		await invalidateEntityCache("itemType", itemTypeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM_TYPE.UPDATED, updatedItemType, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		const itemType = await repository.remove(id, workspaceId);

		assertFound(itemType, "ItemType", itemTypeLogger, id);

		itemTypeLogger.info(`ItemType deleted: ${id}`);

		logDelete(req, "ItemType", itemType!);
		await invalidateEntityCache("itemType", itemTypeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM_TYPE.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
