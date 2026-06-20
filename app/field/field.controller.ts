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
import { handleNotFound, handleUpdateNotFound } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete } from "../../helper/logging-helper";
import { fieldRepository } from "./field.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";
import { config } from "../../config/constant";

const fieldLogger = createLogger("field");

export const controller = (prisma: PrismaClient) => {
	const repository = fieldRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		const field = await repository.create(validatedData);
		fieldLogger.info(`Field created: ${field.id}`);

		logCreate(req, "Field", field);
		await invalidateEntityCache("field", fieldLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.FIELD.CREATED, field, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, fieldLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, skip, sort, order, query,
			filter, document, pagination, count,
		} = validationResult.validatedParams!;

		const whereClause: any = { isDeleted: false, workspaceId };
		const searchFields = ["name"];

		if (query) {
			const searchConditions = buildSearchConditions("Field", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Field", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, undefined, "Field");
		const fields = await repository.findMany(findManyQuery);

		let total = 0;
		if (count) {
			total = await repository.count({ where: whereClause });
		}

		const responseData: Record<string, unknown> = {
			...(document && { fields }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
		};

		res.status(200).json(buildSuccessResponse(config.SUCCESS.FIELD.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		const field = await repository.getById({ where: { id, workspaceId } });

		if (handleNotFound(field, res, "Field", fieldLogger, id)) return;

		res.status(200).json(buildSuccessResponse(config.SUCCESS.FIELD.RETRIEVED, field, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const validatedData = req.body;

		const { existingField, updatedField } = await repository.update(id, validatedData, workspaceId);

		if (handleUpdateNotFound(existingField, updatedField, res, "Field", fieldLogger, id)) return;

		fieldLogger.info(`Field updated: ${id}`);

		logUpdate(req, "Field", id, existingField!, updatedField!);
		await invalidateEntityCache("field", fieldLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.FIELD.UPDATED, { field: updatedField }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		const existingField = await repository.remove(id, workspaceId);

		if (handleNotFound(existingField, res, "Field", fieldLogger, id)) return;

		fieldLogger.info(`Field deleted: ${id}`);

		logDelete(req, "Field", existingField!);
		await invalidateEntityCache("field", fieldLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.FIELD.DELETED, null, 200));
	});

	return { create, getAll, getById, update, remove };
};
