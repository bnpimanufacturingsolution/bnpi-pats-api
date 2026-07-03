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
import { groupDataByField } from "../../helper/dataGrouping";
import { assertFound } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { projectMemberRepository } from "./project-member.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = createLogger("project-member");

export const controller = (prisma: PrismaClient) => {
	const repository = projectMemberRepository(prisma);

	const add = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const validatedData = req.body;
		const workspaceId = req.workspaceId!;

		// Verify user is a workspace member first
		const workspaceMember = await prisma.workspaceMember.findFirst({
			where: { workspaceId, userId: validatedData.userId, isDeleted: false },
		});

		if (!workspaceMember) {
			res.status(400).json({
				success: false,
				message: config.ERROR.PROJECT_MEMBER.NOT_WORKSPACE_MEMBER,
				code: 400,
			});
			return;
		}

		// Check if already a project member
		const existingMember = await repository.getByProjectAndUser(validatedData.projectId, validatedData.userId);
		if (existingMember) {
			res.status(409).json({
				success: false,
				message: config.ERROR.PROJECT_MEMBER.ALREADY_EXISTS,
				code: 409,
			});
			return;
		}

		const member = await repository.add({ ...validatedData, workspaceId });
		logger.info(`Project member added: ${member.id} (user: ${validatedData.userId}, project: ${validatedData.projectId})`);

		logCreate(req, "ProjectMember", member);
		await invalidateEntityCache("projectMember", logger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.ADDED, member, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const validationResult = validateQueryParams(req, logger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		const workspaceId = req.workspaceId!;
		logger.info(`Getting project members, workspace: ${workspaceId}, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.ProjectMemberWhereInput = { workspaceId, isDeleted: false };
		const searchFields = ["displayName", "email", "userId"];

		if (query) {
			const searchConditions = buildSearchConditions("ProjectMember", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("ProjectMember", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "ProjectMember");
		const [members, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		logger.info(`Retrieved ${members.length} project members`);

		const processedData = groupBy && document ? groupDataByField(members, groupBy as string) : members;
		const responseData: Record<string, unknown> = {
			...(document && { projectMembers: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "ProjectMember", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.RETRIEVED_ALL, responseData, 200));
	});

	const getByProject = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { projectId } = req.params;
		const workspaceId = req.workspaceId!;

		logger.info(`Getting members for project: ${projectId}`);

		const members = await repository.getByProject(projectId, workspaceId);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.RETRIEVED_ALL, members, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const workspaceId = req.workspaceId!;

		logger.info(`Getting project member by ID: ${id}`);

		const member = await repository.getById({
			where: { id, workspaceId, isDeleted: false },
		});

		assertFound(member, "ProjectMember", logger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.RETRIEVED, member, 200));
	});

	const getMyProjectRole = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { projectId } = req.params;
		const workspaceId = req.workspaceId!;
		const userId = req.userId!;

		logger.info(`Getting project role for user: ${userId} in project: ${projectId}`);

		// Check workspace-level auto-access first
		const workspaceMember = await prisma.workspaceMember.findFirst({
			where: { workspaceId, userId, isDeleted: false },
		});

		if (workspaceMember && (workspaceMember.role === "OWNER" || workspaceMember.role === "ADMIN")) {
			res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.RETRIEVED, {
				userId,
				projectId,
				role: "ADMIN",
				accessType: "workspace-auto",
				workspaceRole: workspaceMember.role,
			}, 200));
			return;
		}

		// Check explicit project membership
		const projectMember = await repository.getByProjectAndUser(projectId, userId);

		if (!projectMember) {
			res.status(404).json({
				success: false,
				message: "You do not have access to this project",
				code: 404,
			});
			return;
		}

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.RETRIEVED, {
			...projectMember,
			accessType: "direct",
		}, 200));
	});

	const updateRole = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { role } = req.body;
		const workspaceId = req.workspaceId!;

		logger.info(`Updating project member role: ${id} to ${role}`);

		const { existing, updated } = await repository.updateRole(id, role, workspaceId);

		if (!updated) {
			assertFound(existing, "ProjectMember", logger, id);
		}

		logUpdate(req, "ProjectMember", id, existing!, updated!);
		await invalidateEntityCache("projectMember", logger);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.UPDATED, updated, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const workspaceId = req.workspaceId!;

		logger.info(`Removing project member: ${id}`);

		const removed = await repository.remove(id, workspaceId);
		assertFound(removed, "ProjectMember", logger, id);

		logDelete(req, "ProjectMember", removed!);
		await invalidateEntityCache("projectMember", logger);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT_MEMBER.REMOVED, {}, 200));
	});

	return { add, getAll, getByProject, getById, getMyProjectRole, updateRole, remove };
};
