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
import { invoiceRepository } from "./invoice.repository";
import { CreateInvoice, UpdateInvoice } from "../../zod/invoice.zod";
import { Invoice } from "../../generated/prisma";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const invoiceLogger = createLogger("invoice");

export const controller = (prisma: PrismaClient) => {
	const repository = invoiceRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const invoiceData: CreateInvoice = { ...req.body, workspaceId };

		const invoice: Invoice = await repository.create(invoiceData);
		invoiceLogger.info(`Invoice created: ${invoice.id}`);

		logCreate(req, "Invoice", { ...invoice, name: invoice.invoiceNumber });
		await invalidateEntityCache("invoice", invoiceLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.INVOICE.CREATED, invoice, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, invoiceLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		invoiceLogger.info(`Getting invoices, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.InvoiceWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["invoiceNumber", "partyName", "remarks"];

		if (query) {
			const searchConditions = buildSearchConditions("Invoice", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Invoice", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Invoice");
		const [invoices, total]: [Invoice[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		invoiceLogger.info(`Retrieved ${invoices.length} invoices`);

		const processedData = groupBy && document ? groupDataByField(invoices, groupBy as string) : invoices;
		const responseData: Record<string, unknown> = {
			...(document && { invoices: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Invoice", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.INVOICE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		invoiceLogger.info(`Getting invoice by ID: ${id}`);

		const cacheKey = `cache:invoice:byId:${id}:${fields || "full"}`;
		const invoice = await getOrFetch(cacheKey, async () => {
			const query: Prisma.InvoiceFindFirstArgs = { where: { id, workspaceId, isDeleted: false } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(invoice, res, "Invoice", invoiceLogger, id)) return;

		invoiceLogger.info(`Invoice retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.INVOICE.RETRIEVED, invoice, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, invoiceLogger)) return;

		const validatedData = req.body;
		invoiceLogger.info(`Updating invoice: ${id}`);

		const updateData: UpdateInvoice = { ...validatedData };
		const { existingInvoice, updatedInvoice } = await repository.update(id, updateData, workspaceId);

		if (handleUpdateNotFound(existingInvoice, updatedInvoice, res, "Invoice", invoiceLogger, id)) return;

		invoiceLogger.info(`Invoice updated: ${id}`);

		logUpdate(req, "Invoice", id, existingInvoice!, { ...updatedInvoice!, name: updatedInvoice!.invoiceNumber });
		await invalidateEntityCache("invoice", invoiceLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.INVOICE.UPDATED, { invoice: updatedInvoice }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		invoiceLogger.info(`Deleting invoice: ${id}`);

		const existingInvoice = await repository.remove(id, workspaceId);

		if (handleNotFound(existingInvoice, res, "Invoice", invoiceLogger, id)) return;

		invoiceLogger.info(`Invoice deleted: ${id}`);

		logDelete(req, "Invoice", { ...existingInvoice!, name: existingInvoice!.invoiceNumber });
		await invalidateEntityCache("invoice", invoiceLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.INVOICE.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
