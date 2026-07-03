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
import { payslipRepository } from "./payslip.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const payslipLogger = createLogger("payslip");

export const controller = (prisma: PrismaClient) => {
	const repository = payslipRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		const payslip = await repository.create(validatedData);
		payslipLogger.info(`Payslip created: ${payslip.id}`);

		logCreate(req, "Payslip", { ...payslip, name: payslip.payslipNumber });
		await invalidateEntityCache("payslip", payslipLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.PAYSLIP.CREATED, payslip, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, payslipLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		payslipLogger.info(`Getting payslips, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.PayslipWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["payslipNumber", "name", "notes"];

		if (query) {
			const searchConditions = buildSearchConditions("Payslip", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Payslip", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Payslip");
		const [payslips, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		payslipLogger.info(`Retrieved ${payslips.length} payslips`);

		const processedData = groupBy && document ? groupDataByField(payslips, groupBy as string) : payslips;
		const responseData: Record<string, unknown> = {
			...(document && { payslips: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Payslip", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYSLIP.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		payslipLogger.info(`Getting payslip by ID: ${id}`);

		const cacheKey = `cache:payslip:byId:${id}:${fields || "full"}`;
		const payslip = await getOrFetch(cacheKey, async () => {
			const query: Prisma.PayslipFindFirstArgs = { where: { id, workspaceId } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		assertFound(payslip, "Payslip", payslipLogger, id);

		payslipLogger.info(`Payslip retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYSLIP.RETRIEVED, payslip, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, payslipLogger)) return;

		const validatedData = req.body;
		payslipLogger.info(`Updating payslip: ${id}`);

		const { existingPayslip, updatedPayslip } = await repository.update(id, validatedData, workspaceId);

		assertFound(existingPayslip, "Payslip", payslipLogger, id);
		assertFound(updatedPayslip, "Payslip", payslipLogger, id);

		payslipLogger.info(`Payslip updated: ${id}`);

		logUpdate(req, "Payslip", id, existingPayslip!, { ...updatedPayslip!, name: updatedPayslip!.payslipNumber });
		await invalidateEntityCache("payslip", payslipLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYSLIP.UPDATED, { payslip: updatedPayslip }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		payslipLogger.info(`Deleting payslip: ${id}`);

		const existingPayslip = await repository.remove(id, workspaceId);

		assertFound(existingPayslip, "Payslip", payslipLogger, id);

		payslipLogger.info(`Payslip deleted: ${id}`);

		logDelete(req, "Payslip", { ...existingPayslip!, name: existingPayslip!.payslipNumber });
		await invalidateEntityCache("payslip", payslipLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYSLIP.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
