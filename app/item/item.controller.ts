/**
 * Item Controller
 *
 * HTTP request/response handling for item operations.
 * Delegates business logic to ItemService.
 */

import { Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { validateQueryParams } from "../../helper/validation-helper";
import {
	buildFilterConditions,
	buildFindManyQuery,
	buildSearchConditions,
} from "../../helper/query-builder";
import { buildSuccessResponse, buildPagination } from "../../helper/success-handler";
import { groupDataByField } from "../../helper/dataGrouping";
import { buildErrorResponse, handleNotFound, validateUpdatePayload } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import asyncHandler from "../../middleware/asyncHandler";
import { createItemService } from "./item.service";
import { AuthRequest } from "../../middleware/verifyToken";

const itemLogger = createLogger("item-controller");

export const controller = (prisma: PrismaClient) => {
	const service = createItemService(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		itemLogger.info(`Creating item for estimation: ${validatedData.estimationId}`);

		const { item, progress } = await service.createItem(validatedData);
		itemLogger.info(`Item created: ${item.id}`);

		logCreate(req, "Item", { ...item, name: item.itemName });
		await invalidateEntityCache("item", itemLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.ITEM.CREATED, { item, progress }, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, itemLogger);

		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page,
			limit,
			order,
			fields,
			sort,
			skip,
			query,
			document,
			pagination,
			count,
			filter,
			groupBy,
		} = validationResult.validatedParams!;

		itemLogger.info(`Getting items, page: ${page}, limit: ${limit}, query: ${query}`);

		// Base where clause
		const whereClause: Prisma.ItemWhereInput = {
			isDeleted: false,
			workspaceId,
		};

		// Search fields
		const searchFields = ["itemName", "category", "type"];
		if (query) {
			const searchConditions = buildSearchConditions("Item", query, searchFields);
			if (searchConditions.length > 0) {
				whereClause.OR = searchConditions;
			}
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Item", filter);
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
			"Item",
		);

		// Ensure fields composite type and relations are always selected
		if (!findManyQuery.select) {
			findManyQuery.select = {
				id: true,
				estimationId: true,
				categoryId: true,
				itemTypeId: true,
				itemName: true,
				estimatedQuantity: true,
				actualQuantity: true,
				estimatedUnitPrice: true,
				estimatedTotal: true,
				actualUnitPrice: true,
				actualTotal: true,
				documentUrls: true,
				fields: true,
				status: true,
				startDate: true,
				endDate: true,
				estimationPoints: true,
				orderId: true,
				isNewAddition: true,
				parentItemId: true,
				isDeleted: true,
				createdAt: true,
				updatedAt: true,
				category: true,
				itemType: true,
			};
			delete findManyQuery.include;
		} else if (findManyQuery.select) {
			const selectObj = findManyQuery.select as Record<string, unknown>;
			if (!selectObj.fields) selectObj.fields = true;
			if (!selectObj.category) selectObj.category = true;
			if (!selectObj.itemType) selectObj.itemType = true;
			delete findManyQuery.include;
		}

		const [items, total] = await service.getAllItems(findManyQuery, whereClause, {
			document,
			count,
		});

		itemLogger.info(`Retrieved ${items.length} items`);

		const processedData =
			groupBy && document ? groupDataByField(items, groupBy as string) : items;

		const responseData: Record<string, unknown> = {
			...(document && { items: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Item", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		itemLogger.info(`Getting item by ID: ${id}`);

		const item = await service.getItemById(id, fields as string | undefined, workspaceId);

		if (handleNotFound(item, res, "Item", itemLogger, id)) return;

		itemLogger.info(`Item retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM.RETRIEVED, item, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, itemLogger)) return;

		const validatedData = req.body;
		itemLogger.info(`Updating item: ${id}`);

		try {
			const { existingItem, updatedItem, progress } = await service.updateItem(id, validatedData, workspaceId);

			if (handleNotFound(existingItem, res, "Item", itemLogger, id)) return;

			itemLogger.info(`Item updated: ${id}`);

			logUpdate(req, "Item", id, existingItem!, { ...updatedItem, name: updatedItem.itemName });
			await invalidateEntityCache("item", itemLogger, id);

			res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM.UPDATED, { item: updatedItem, progress }, 200));
		} catch (error: any) {
			if (error.message?.includes("cannot update actual") || error.message?.includes("must be")) {
				res.status(400).json(buildErrorResponse(error.message, 400));
			} else {
				throw error;
			}
		}
	});

	const updateActualPriceWithDocuments = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const files = req.files as Express.Multer.File[];

		try {
			// Validate actual unit price
			const actualUnitPrice = parseFloat(req.body.actualUnitPrice);
			if (isNaN(actualUnitPrice) || actualUnitPrice < 0) {
				itemLogger.error("Invalid actual unit price");
				res.status(400).json(buildErrorResponse("Actual unit price must be a valid positive number", 400));
				return;
			}

			itemLogger.info(`Updating actual price with documents for item: ${id}`);

			// Parse documentsToDelete
			let documentsToDelete: string[] = [];
			if (req.body.documentsToDelete) {
				try {
					documentsToDelete = JSON.parse(req.body.documentsToDelete);
					itemLogger.info(`Marking ${documentsToDelete.length} documents for deletion`);
				} catch (parseError) {
					itemLogger.error(`Failed to parse documentsToDelete: ${parseError}`);
				}
			}

			const { existingItem, updatedItem } = await service.updateActualPriceWithDocuments(
				id,
				actualUnitPrice,
				files,
				documentsToDelete,
				workspaceId,
			);

			itemLogger.info(`Item updated with documents: ${id}`);

			logUpdate(req, "Item", id, existingItem, { ...updatedItem, name: updatedItem.itemName });
			await invalidateEntityCache("item", itemLogger, id);

			res.status(200).json(buildSuccessResponse(
				config.SUCCESS.ITEM.UPDATED_WITH_DOCS,
				{ item: updatedItem, uploadedDocuments: files?.length || 0 },
				200,
			));
		} catch (error: any) {
			itemLogger.error(`Error updating actual price with documents: ${error}`);

			if (error.message?.includes("cannot update actual") || error.message?.includes("must be")) {
				res.status(400).json(buildErrorResponse(error.message, 400));
			} else if (error.message?.includes("not found")) {
				res.status(404).json(buildErrorResponse(error.message, 404));
			} else if (error.message?.includes("upload")) {
				res.status(500).json(buildErrorResponse("Failed to upload documents", 500));
			} else {
				res.status(500).json(buildErrorResponse(config.ERROR.COMMON.INTERNAL_SERVER_ERROR, 500));
			}
		}
	};

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		itemLogger.info(`Deleting item: ${id}`);

		const { existingItem, progress } = await service.deleteItem(id, workspaceId);

		if (handleNotFound(existingItem, res, "Item", itemLogger, id)) return;

		itemLogger.info(`Item deleted: ${id}`);

		logDelete(req, "Item", { ...existingItem, name: existingItem.itemName });
		await invalidateEntityCache("item", itemLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.ITEM.DELETED, { progress }, 200));
	});

	return { create, getAll, getById, update, updateActualPriceWithDocuments, remove };
};
