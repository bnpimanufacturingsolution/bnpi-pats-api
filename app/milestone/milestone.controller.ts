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
import { assertFound } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete } from "../../helper/logging-helper";
import { milestoneRepository } from "./milestone.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";
import { config } from "../../config/constant";

const milestoneLogger = createLogger("milestone");

export const controller = (prisma: PrismaClient) => {
	const repository = milestoneRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		const milestone = await repository.create(validatedData);
		milestoneLogger.info(`Milestone created: ${milestone.id}`);

		logCreate(req, "Milestone", { ...milestone, name: milestone.title });
		await invalidateEntityCache("milestone", milestoneLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.MILESTONE.CREATED, milestone, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, milestoneLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, skip, sort, order, query,
			filter, document, pagination, count,
		} = validationResult.validatedParams!;

		const whereClause: Prisma.MilestoneWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["title", "description"];

		if (query) {
			const searchConditions = buildSearchConditions("Milestone", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Milestone", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, undefined, "Milestone");
		const milestones = await repository.findMany(findManyQuery);

		let total = 0;
		if (count) {
			total = await repository.count({ where: whereClause });
		}

		const responseData: Record<string, unknown> = {
			...(document && { milestones }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
		};

		res.status(200).json(buildSuccessResponse(config.SUCCESS.MILESTONE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		const milestone = await repository.getById({ where: { id, workspaceId } });

		assertFound(milestone, "Milestone", milestoneLogger, id);

		milestoneLogger.info(`Milestone retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.MILESTONE.RETRIEVED, milestone, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const validatedData = req.body;

		const { existingMilestone, updatedMilestone } = await repository.update(id, validatedData, workspaceId);

		assertFound(existingMilestone, "Milestone", milestoneLogger, id);
		assertFound(updatedMilestone, "Milestone", milestoneLogger, id);

		milestoneLogger.info(`Milestone updated: ${id}`);

		logUpdate(req, "Milestone", id, existingMilestone!, { ...updatedMilestone!, name: updatedMilestone!.title });
		await invalidateEntityCache("milestone", milestoneLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.MILESTONE.UPDATED, updatedMilestone, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		const milestone = await repository.remove(id, workspaceId);

		assertFound(milestone, "Milestone", milestoneLogger, id);

		milestoneLogger.info(`Milestone deleted: ${id}`);

		logDelete(req, "Milestone", { ...milestone!, name: milestone!.title });
		await invalidateEntityCache("milestone", milestoneLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.MILESTONE.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
