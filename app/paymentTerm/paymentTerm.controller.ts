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
import { validateUpdatePayload, assertFound } from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { paymentTermRepository } from "./paymentTerm.repository";
import { CreatePaymentTerm, UpdatePaymentTerm } from "../../zod/paymentTerm.zod";
import { PaymentTerm } from "../../generated/prisma";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const paymentTermLogger = createLogger("paymentTerm");

export const controller = (prisma: PrismaClient) => {
	const repository = paymentTermRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const paymentTermData: CreatePaymentTerm = { ...req.body, workspaceId };

		const paymentTerm: PaymentTerm = await repository.create(paymentTermData);
		paymentTermLogger.info(`Payment Term created: ${paymentTerm.id}`);

		logCreate(req, "PaymentTerm", { ...paymentTerm, name: paymentTerm.name });
		await invalidateEntityCache("paymentTerm", paymentTermLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.PAYMENT_TERM.CREATED, paymentTerm, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, paymentTermLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		paymentTermLogger.info(`Getting payment terms, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.PaymentTermWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["code", "name", "description"];

		if (query) {
			const searchConditions = buildSearchConditions("PaymentTerm", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("PaymentTerm", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "PaymentTerm");
		const [paymentTerms, total]: [PaymentTerm[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		paymentTermLogger.info(`Retrieved ${paymentTerms.length} payment terms`);

		const processedData = groupBy && document ? groupDataByField(paymentTerms, groupBy as string) : paymentTerms;
		const responseData: Record<string, unknown> = {
			...(document && { paymentTerms: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "PaymentTerm", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_TERM.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		paymentTermLogger.info(`Getting payment term by ID: ${id}`);

		const cacheKey = `cache:paymentTerm:byId:${id}:${fields || "full"}`;
		const paymentTerm = await getOrFetch(cacheKey, async () => {
			const query: Prisma.PaymentTermFindFirstArgs = { where: { id, workspaceId, isDeleted: false } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		assertFound(paymentTerm, "PaymentTerm", paymentTermLogger, id);

		paymentTermLogger.info(`Payment Term retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_TERM.RETRIEVED, paymentTerm, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, paymentTermLogger)) return;

		const validatedData = req.body;
		paymentTermLogger.info(`Updating payment term: ${id}`);

		const updateData: UpdatePaymentTerm = { ...validatedData };
		const { existingPaymentTerm, updatedPaymentTerm } = await repository.update(id, updateData, workspaceId);

		assertFound(existingPaymentTerm, "PaymentTerm", paymentTermLogger, id);
		assertFound(updatedPaymentTerm, "PaymentTerm", paymentTermLogger, id);

		paymentTermLogger.info(`Payment Term updated: ${id}`);

		logUpdate(req, "PaymentTerm", id, existingPaymentTerm!, { ...updatedPaymentTerm!, name: updatedPaymentTerm!.name });
		await invalidateEntityCache("paymentTerm", paymentTermLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_TERM.UPDATED, { paymentTerm: updatedPaymentTerm }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		paymentTermLogger.info(`Deleting payment term: ${id}`);

		const existingPaymentTerm = await repository.remove(id, workspaceId);

		assertFound(existingPaymentTerm, "PaymentTerm", paymentTermLogger, id);

		paymentTermLogger.info(`Payment Term deleted: ${id}`);

		logDelete(req, "PaymentTerm", { ...existingPaymentTerm!, name: existingPaymentTerm!.name });
		await invalidateEntityCache("paymentTerm", paymentTermLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_TERM.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
