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
import { buildErrorResponse, assertFound } from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";

import { config } from "../../config/constant";
import { sequentialRepository } from "./sequential.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const sequentialLogger = createLogger("sequential");

export const controller = (prisma: PrismaClient) => {
	const repository = sequentialRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		// Check if name or code already exists
		const existing = await prisma.sequential.findFirst({
			where: {
				OR: [{ name: validatedData.name }, { code: validatedData.code }],
				isDeleted: false,
				workspaceId,
			},
		});

		if (existing) {
			sequentialLogger.error(`Sequential with name "${validatedData.name}" or code "${validatedData.code}" already exists`);
			res.status(409).json(buildErrorResponse("Sequential with this name or code already exists", 409));
			return;
		}

		const sequential = await repository.create(validatedData);
		sequentialLogger.info(`Sequential created: ${sequential.id}`);

		logCreate(req, "Sequential", sequential);
		await invalidateEntityCache("sequential", sequentialLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.SEQUENTIAL.CREATED, sequential, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, sequentialLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		sequentialLogger.info(`Getting sequentials, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.SequentialWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["name", "code", "pattern", "module"];

		if (query) {
			const searchConditions = buildSearchConditions("Sequential", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Sequential", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Sequential");
		const [sequentials, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		sequentialLogger.info(`Retrieved ${sequentials.length} sequentials`);

		const processedData = groupBy && document ? groupDataByField(sequentials, groupBy as string) : sequentials;
		const responseData: Record<string, unknown> = {
			...(document && { sequentials: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Sequential", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.SEQUENTIAL.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		sequentialLogger.info(`Getting sequential by ID: ${id}`);

		const cacheKey = `cache:sequential:byId:${id}:${fields || "full"}`;
		const sequential = await getOrFetch(cacheKey, async () => {
			const query: Prisma.SequentialFindFirstArgs = { where: { id, isDeleted: false, workspaceId } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		assertFound(sequential, "Sequential", sequentialLogger, id);

		sequentialLogger.info(`Sequential retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.SEQUENTIAL.RETRIEVED, sequential, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const validatedData = req.body;

		const existingSequential = await prisma.sequential.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		assertFound(existingSequential, "Sequential", sequentialLogger, id);

		// Check for duplicate name or code if they're being updated
		if (validatedData.name || validatedData.code) {
			const duplicate = await prisma.sequential.findFirst({
				where: {
					OR: [
						...(validatedData.name ? [{ name: validatedData.name }] : []),
						...(validatedData.code ? [{ code: validatedData.code }] : []),
					],
					id: { not: id },
					isDeleted: false,
					workspaceId,
				},
			});

			if (duplicate) {
				sequentialLogger.error("Sequential with this name or code already exists");
				res.status(409).json(buildErrorResponse("Sequential with this name or code already exists", 409));
				return;
			}
		}

		const { existingSequential: existingSequentialFromUpdate, updatedSequential } = await repository.update(id, validatedData, workspaceId);

		assertFound(existingSequentialFromUpdate, "Sequential", sequentialLogger, id);
		assertFound(updatedSequential, "Sequential", sequentialLogger, id);

		sequentialLogger.info(`Sequential updated: ${id}`);

		logUpdate(req, "Sequential", id, existingSequential!, updatedSequential!);
		await invalidateEntityCache("sequential", sequentialLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.SEQUENTIAL.UPDATED, updatedSequential, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		sequentialLogger.info(`Deleting sequential: ${id}`);

		const sequential = await repository.remove(id, workspaceId);

		assertFound(sequential, "Sequential", sequentialLogger, id);

		sequentialLogger.info(`Sequential deleted: ${id}`);

		logDelete(req, "Sequential", sequential!);
		await invalidateEntityCache("sequential", sequentialLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.SEQUENTIAL.DELETED, sequential, 200));
	});

	return { create, getAll, getById, update, remove };
};
