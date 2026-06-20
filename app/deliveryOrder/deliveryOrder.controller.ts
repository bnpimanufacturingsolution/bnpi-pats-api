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
import { deliveryOrderRepository } from "./deliveryOrder.repository";
import { CreateDeliveryOrder, UpdateDeliveryOrder } from "../../zod/deliveryOrder.zod";
import { DeliveryOrder } from "../../generated/prisma";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const deliveryOrderLogger = createLogger("deliveryOrder");

export const controller = (prisma: PrismaClient) => {
	const repository = deliveryOrderRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const deliveryOrderData: CreateDeliveryOrder = { ...req.body, workspaceId };

		const deliveryOrder: DeliveryOrder = await repository.create(deliveryOrderData);
		deliveryOrderLogger.info(`Delivery Order created: ${deliveryOrder.id}`);

		logCreate(req, "DeliveryOrder", { ...deliveryOrder, name: deliveryOrder.doNumber });
		await invalidateEntityCache("deliveryOrder", deliveryOrderLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.DELIVERY_ORDER.CREATED, deliveryOrder, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, deliveryOrderLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		deliveryOrderLogger.info(`Getting delivery orders, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.DeliveryOrderWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["doNumber", "trackingNumber", "carrier", "remarks"];

		if (query) {
			const searchConditions = buildSearchConditions("DeliveryOrder", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("DeliveryOrder", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "DeliveryOrder");
		const [deliveryOrders, total]: [DeliveryOrder[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		deliveryOrderLogger.info(`Retrieved ${deliveryOrders.length} delivery orders`);

		const processedData = groupBy && document ? groupDataByField(deliveryOrders, groupBy as string) : deliveryOrders;
		const responseData: Record<string, unknown> = {
			...(document && { deliveryOrders: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "DeliveryOrder", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.DELIVERY_ORDER.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		deliveryOrderLogger.info(`Getting delivery order by ID: ${id}`);

		const cacheKey = `cache:deliveryOrder:byId:${id}:${fields || "full"}`;
		const deliveryOrder = await getOrFetch(cacheKey, async () => {
			const query: Prisma.DeliveryOrderFindFirstArgs = { where: { id, workspaceId, isDeleted: false } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(deliveryOrder, res, "DeliveryOrder", deliveryOrderLogger, id)) return;

		deliveryOrderLogger.info(`Delivery Order retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.DELIVERY_ORDER.RETRIEVED, deliveryOrder, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, deliveryOrderLogger)) return;

		const validatedData = req.body;
		deliveryOrderLogger.info(`Updating delivery order: ${id}`);

		const updateData: UpdateDeliveryOrder = { ...validatedData };
		const { existingDeliveryOrder, updatedDeliveryOrder } = await repository.update(id, updateData, workspaceId);

		if (handleUpdateNotFound(existingDeliveryOrder, updatedDeliveryOrder, res, "DeliveryOrder", deliveryOrderLogger, id)) return;

		deliveryOrderLogger.info(`Delivery Order updated: ${id}`);

		logUpdate(req, "DeliveryOrder", id, existingDeliveryOrder!, { ...updatedDeliveryOrder!, name: updatedDeliveryOrder!.doNumber });
		await invalidateEntityCache("deliveryOrder", deliveryOrderLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.DELIVERY_ORDER.UPDATED, { deliveryOrder: updatedDeliveryOrder }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		deliveryOrderLogger.info(`Deleting delivery order: ${id}`);

		const existingDeliveryOrder = await repository.remove(id, workspaceId);

		if (handleNotFound(existingDeliveryOrder, res, "DeliveryOrder", deliveryOrderLogger, id)) return;

		deliveryOrderLogger.info(`Delivery Order deleted: ${id}`);

		logDelete(req, "DeliveryOrder", { ...existingDeliveryOrder!, name: existingDeliveryOrder!.doNumber });
		await invalidateEntityCache("deliveryOrder", deliveryOrderLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.DELIVERY_ORDER.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
