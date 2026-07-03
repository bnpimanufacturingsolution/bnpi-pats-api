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
import { assertFound } from "../../helper/error-handler";
import { generateCodeFromName } from "../../helper/code-generator";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { categoryRepository } from "./category.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";
import { config } from "../../config/constant";
import { BadRequestError } from "../../errors";

const categoryLogger = createLogger("category");

export const controller = (prisma: PrismaClient) => {
	const repository = categoryRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		const category = await repository.create(validatedData);
		categoryLogger.info(`Category created: ${category.id}`);

		// Log & invalidate cache using helpers
		logCreate(req, "Category", category);
		await invalidateEntityCache("category", categoryLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.CATEGORY.CREATED, category, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, categoryLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		categoryLogger.info(`Getting categories, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.CategoryWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["name", "code", "description"];

		if (query) {
			const searchConditions = buildSearchConditions("Category", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Category", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Category");
		const [categories, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		categoryLogger.info(`Retrieved ${categories.length} categories`);

		const processedData = groupBy && document ? groupDataByField(categories, groupBy as string) : categories;
		const responseData: Record<string, unknown> = {
			...(document && { categories: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Category", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.CATEGORY.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		categoryLogger.info(`Getting category by ID: ${id}`);

		const validationResult = validateQueryParams(req, categoryLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const { fields } = validationResult.validatedParams!;
		const query: Prisma.CategoryFindFirstArgs = { where: { id, isDeleted: false, workspaceId } };

		if (fields && fields.length > 0) {
			query.select = getNestedFields(fields);
		}

		const category = await repository.getById(query);

		// Use helper for not found check
		assertFound(category, "Category", categoryLogger, id);

		categoryLogger.info(`Category retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.CATEGORY.RETRIEVED, category, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const validatedData = req.body;

		const { existingCategory, updatedCategory } = await repository.update(id, validatedData, workspaceId);

		// Use helper for not found check
		assertFound(existingCategory, "Category", categoryLogger, id);
		assertFound(updatedCategory, "Category", categoryLogger, id);

		categoryLogger.info(`Category updated: ${id}`);

		// Log & invalidate cache using helpers
		logUpdate(req, "Category", id, existingCategory!, updatedCategory!);
		await invalidateEntityCache("category", categoryLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.CATEGORY.UPDATED, updatedCategory, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		categoryLogger.info(`Deleting category: ${id}`);

		const category = await repository.remove(id, workspaceId);

		// Use helper for not found check
		assertFound(category, "Category", categoryLogger, id);

		categoryLogger.info(`Category deleted: ${id}`);

		// Log & invalidate cache using helpers
		logDelete(req, "Category", category!);
		await invalidateEntityCache("category", categoryLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.CATEGORY.DELETED, {}, 200));
	});

	const generateCode = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { name } = req.query;

		if (!name || typeof name !== "string") {
			throw new BadRequestError("Category name is required to generate code");
		}

		categoryLogger.info(`Generating category code for name: ${name}`);

		const code = generateCodeFromName(name);
		const existingCategory = await prisma.category.findFirst({
			where: { code, isDeleted: false, workspaceId },
			select: { id: true, name: true, code: true },
		});

		const isAvailable = !existingCategory;
		categoryLogger.info(`Generated category code: ${code}, available: ${isAvailable}`);

		res.status(200).json(
			buildSuccessResponse(config.SUCCESS.CATEGORY.CODE_GENERATED, {
				code,
				isAvailable,
				existingCategory: existingCategory || null,
			}, 200),
		);
	});

	return { create, getAll, getById, update, remove, generateCode };
};

export type CategoryController = ReturnType<typeof controller>;
