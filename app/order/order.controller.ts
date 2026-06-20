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
import { orderRepository } from "./order.repository";
import { CreateOrder, UpdateOrder } from "../../zod/order.zod";
import { Order } from "../../generated/prisma";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const orderLogger = createLogger("order");

export const controller = (prisma: PrismaClient) => {
	const repository = orderRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const orderData: CreateOrder = { ...req.body, workspaceId };

		const order: Order = await repository.create(orderData);
		orderLogger.info(`Order created: ${order.id}`);

		logCreate(req, "Order", { ...order, name: order.orderNumber });
		await invalidateEntityCache("order", orderLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.ORDER.CREATED, order, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, orderLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		orderLogger.info(`Getting orders, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.OrderWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["name", "description", "type"];

		if (query) {
			const searchConditions = buildSearchConditions("Order", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Order", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Order");
		const [orders, total]: [Order[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		orderLogger.info(`Retrieved ${orders.length} orders`);

		const processedData = groupBy && document ? groupDataByField(orders, groupBy as string) : orders;
		const responseData: Record<string, unknown> = {
			...(document && { orders: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Order", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ORDER.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		orderLogger.info(`Getting order by ID: ${id}`);

		const cacheKey = `cache:order:byId:${id}:${fields || "full"}`;
		const order = await getOrFetch(cacheKey, async () => {
			const query: Prisma.OrderFindFirstArgs = { where: { id, workspaceId } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(order, res, "Order", orderLogger, id)) return;

		orderLogger.info(`Order retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ORDER.RETRIEVED, order, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, orderLogger)) return;

		const validatedData = req.body;
		orderLogger.info(`Updating order: ${id}`);

		const updateData: UpdateOrder = { ...validatedData };
		const { existingOrder, updatedOrder } = await repository.update(id, updateData, workspaceId);

		if (handleUpdateNotFound(existingOrder, updatedOrder, res, "Order", orderLogger, id)) return;

		orderLogger.info(`Order updated: ${id}`);

		logUpdate(req, "Order", id, existingOrder!, { ...updatedOrder!, name: updatedOrder!.orderNumber });
		await invalidateEntityCache("order", orderLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.ORDER.UPDATED, { order: updatedOrder }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		orderLogger.info(`Deleting order: ${id}`);

		const existingOrder = await repository.remove(id, workspaceId);

		if (handleNotFound(existingOrder, res, "Order", orderLogger, id)) return;

		orderLogger.info(`Order deleted: ${id}`);

		logDelete(req, "Order", { ...existingOrder!, name: existingOrder!.orderNumber });
		await invalidateEntityCache("order", orderLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.ORDER.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
