import { Response, NextFunction, Request } from "express";
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
import { workspaceRepository } from "./workspace.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const workspaceLogger = createLogger("workspace");

export const controller = (prisma: PrismaClient) => {
	const repository = workspaceRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const validatedData = req.body;

		// Get organizationId from the current login request (JWT workspaceId)
		// This allows linking the Workspace to the external company/auth system
		if (req.workspaceId && !validatedData.organizationId) {
			validatedData.organizationId = req.workspaceId;
		}

		const workspace = await repository.create(validatedData);
		workspaceLogger.info(`Workspace created: ${workspace.id}`);

		// Auto-assign the creator as OWNER of the new workspace
		if (req.userId) {
			const displayName = [req.firstName, req.lastName].filter(Boolean).join(" ") || undefined;
			await prisma.workspaceMember.create({
				data: {
					workspaceId: workspace.id,
					userId: req.userId,
					role: "OWNER",
					displayName,
					email: req.userEmail || undefined,
				},
			});
			workspaceLogger.info(`Creator ${req.userId} assigned as OWNER of workspace ${workspace.id}`);
		}

		logCreate(req, "Workspace", workspace);
		await invalidateEntityCache("workspace", workspaceLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.WORKSPACE.CREATED, workspace, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const validationResult = validateQueryParams(req, workspaceLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		workspaceLogger.info(`Getting workspaces, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.WorkspaceWhereInput = { isDeleted: false };
		const searchFields = ["name", "code", "description"];

		if (query) {
			const searchConditions = buildSearchConditions("Workspace", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Workspace", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Workspace");
		const [workspaces, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		workspaceLogger.info(`Retrieved ${workspaces.length} workspaces`);

		const processedData = groupBy && document ? groupDataByField(workspaces, groupBy as string) : workspaces;
		const responseData: Record<string, unknown> = {
			...(document && { workspaces: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Workspace", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { fields } = req.query;

		workspaceLogger.info(`Getting workspace by ID: ${id}`);

		const cacheKey = `cache:workspace:byId:${id}:${fields || "full"}`;
		const workspace = await getOrFetch(cacheKey, async () => {
			const query: Prisma.WorkspaceFindFirstArgs = { where: { id } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(workspace, res, "Workspace", workspaceLogger, id)) return;

		workspaceLogger.info(`Workspace retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE.RETRIEVED, workspace, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, workspaceLogger)) return;

		const validatedData = req.body;
		workspaceLogger.info(`Updating workspace: ${id}`);

		const { existingWorkspace, updatedWorkspace } = await repository.update(id, validatedData);

		if (handleUpdateNotFound(existingWorkspace, updatedWorkspace, res, "Workspace", workspaceLogger, id)) return;

		workspaceLogger.info(`Workspace updated: ${id}`);

		logUpdate(req, "Workspace", id, existingWorkspace!, updatedWorkspace!);
		await invalidateEntityCache("workspace", workspaceLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE.UPDATED, { workspace: updatedWorkspace }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		workspaceLogger.info(`Deleting workspace: ${id}`);

		const existingWorkspace = await repository.remove(id);

		if (handleNotFound(existingWorkspace, res, "Workspace", workspaceLogger, id)) return;

		workspaceLogger.info(`Workspace deleted: ${id}`);

		logDelete(req, "Workspace", existingWorkspace!);
		await invalidateEntityCache("workspace", workspaceLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE.DELETED, {}, 200));
	});

	const checkCode = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { code } = req.params;
		workspaceLogger.info(`Checking workspace code availability: ${code}`);

		const exists = await repository.checkCodeExists(code);

		res.status(200).json(buildSuccessResponse(
			exists ? "Workspace code already exists" : "Workspace code is available",
			{ code, available: !exists },
			200
		));
	});

	return { create, getAll, getById, update, remove, checkCode };
};
