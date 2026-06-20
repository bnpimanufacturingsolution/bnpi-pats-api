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
import { handleNotFound } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { env } from "../../config/env";
import { workspaceMemberRepository } from "./workspace-member.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const logger = createLogger("workspace-member");

/**
 * Fetch user details from SSO by userId
 */
const fetchSSOUser = async (
	userId: string,
	authHeader?: string,
	organizationId?: string,
): Promise<{ name?: string; email?: string } | null> => {
	try {
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (authHeader) headers["Authorization"] = authHeader;
		if (organizationId) headers["x-organization-id"] = organizationId;

		const url = `${env.SSO_BASE_URL}/user/${userId}`;
		logger.info(`Fetching SSO user: ${url}`);

		const response = await fetch(url, { headers });
		if (!response.ok) {
			// Log response body for debugging
			const errorBody = await response.text().catch(() => "");
			logger.warn(`SSO user fetch failed: ${response.status} ${response.statusText} - ${errorBody}`);
			return null;
		}

		const result = await response.json();
		logger.info(`SSO user response: ${JSON.stringify(result)}`);

		const user = result?.data || result;
		return {
			name: user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
			email: user?.email || undefined,
		};
	} catch (error) {
		logger.error(`SSO user fetch error: ${error}`);
		return null;
	}
};

export const controller = (prisma: PrismaClient) => {
	const repository = workspaceMemberRepository(prisma);

	const add = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const validatedData = req.body;
		const workspaceId = req.workspaceId!;

		// Check if user is already a member
		const existingMember = await repository.getByWorkspaceAndUser(workspaceId, validatedData.userId);
		if (existingMember) {
			res.status(409).json({
				success: false,
				message: config.ERROR.WORKSPACE_MEMBER.ALREADY_EXISTS,
				code: 409,
			});
			return;
		}

		const member = await repository.add({ ...validatedData, workspaceId });
		logger.info(`Workspace member added: ${member.id} (user: ${validatedData.userId})`);

		logCreate(req, "WorkspaceMember", member);
		await invalidateEntityCache("workspaceMember", logger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.WORKSPACE_MEMBER.ADDED, member, 201));
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
		logger.info(`Getting workspace members, workspace: ${workspaceId}, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.WorkspaceMemberWhereInput = { workspaceId, isDeleted: false };
		const searchFields = ["displayName", "email", "userId"];

		if (query) {
			const searchConditions = buildSearchConditions("WorkspaceMember", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("WorkspaceMember", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "WorkspaceMember");
		const [members, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		logger.info(`Retrieved ${members.length} workspace members`);

		// Enrich members with SSO user details
		const authHeader = req.headers.authorization;
		const organizationId = req.organizationId;
		const enrichedMembers = document ? await Promise.all(
			members.map(async (member) => {
				if (member.displayName && member.email) return member;
				const ssoUser = await fetchSSOUser(member.userId, authHeader, organizationId);
				if (!ssoUser) return member;
				return {
					...member,
					displayName: member.displayName || ssoUser.name || null,
					email: member.email || ssoUser.email || null,
				};
			})
		) : members;

		const processedData = groupBy && document ? groupDataByField(enrichedMembers, groupBy as string) : enrichedMembers;
		const responseData: Record<string, unknown> = {
			...(document && { workspaceMembers: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "WorkspaceMember", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE_MEMBER.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const workspaceId = req.workspaceId!;

		logger.info(`Getting workspace member by ID: ${id}`);

		const member = await repository.getById({
			where: { id, workspaceId, isDeleted: false },
		});

		if (handleNotFound(member, res, "WorkspaceMember", logger, id)) return;

		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE_MEMBER.RETRIEVED, member, 200));
	});

	const getMyMembership = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const userId = req.userId!;

		logger.info(`Getting membership for user: ${userId} in workspace: ${workspaceId}`);

		const member = await repository.getByWorkspaceAndUser(workspaceId, userId);

		if (!member) {
			res.status(404).json({
				success: false,
				message: "You are not a member of this workspace",
				code: 404,
			});
			return;
		}

		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE_MEMBER.RETRIEVED, member, 200));
	});

	const updateRole = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { role } = req.body;
		const workspaceId = req.workspaceId!;

		logger.info(`Updating workspace member role: ${id} to ${role}`);

		// If demoting from OWNER, check it's not the last owner
		const existingMember = await repository.getById({
			where: { id, workspaceId, isDeleted: false },
		});

		if (handleNotFound(existingMember, res, "WorkspaceMember", logger, id)) return;

		if (existingMember!.role === "OWNER" && role !== "OWNER") {
			const ownerCount = await repository.countByRole(workspaceId, "OWNER");
			if (ownerCount <= 1) {
				res.status(400).json({
					success: false,
					message: config.ERROR.WORKSPACE_MEMBER.CANNOT_REMOVE_LAST_OWNER,
					code: 400,
				});
				return;
			}
		}

		const { existing, updated } = await repository.updateRole(id, role, workspaceId);

		if (!updated) {
			if (handleNotFound(existing, res, "WorkspaceMember", logger, id)) return;
		}

		logUpdate(req, "WorkspaceMember", id, existing!, updated!);
		await invalidateEntityCache("workspaceMember", logger);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE_MEMBER.UPDATED, updated, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const workspaceId = req.workspaceId!;

		logger.info(`Removing workspace member: ${id}`);

		// Check if it's the last owner
		const existingMember = await repository.getById({
			where: { id, workspaceId, isDeleted: false },
		});

		if (handleNotFound(existingMember, res, "WorkspaceMember", logger, id)) return;

		if (existingMember!.role === "OWNER") {
			const ownerCount = await repository.countByRole(workspaceId, "OWNER");
			if (ownerCount <= 1) {
				res.status(400).json({
					success: false,
					message: config.ERROR.WORKSPACE_MEMBER.CANNOT_REMOVE_LAST_OWNER,
					code: 400,
				});
				return;
			}
		}

		const removed = await repository.remove(id, workspaceId);
		if (handleNotFound(removed, res, "WorkspaceMember", logger, id)) return;

		// Cascade: soft-delete all project memberships for this user in this workspace
		await prisma.projectMember.updateMany({
			where: { userId: existingMember!.userId, workspaceId, isDeleted: false },
			data: { isDeleted: true },
		});

		logDelete(req, "WorkspaceMember", removed!);
		await invalidateEntityCache("workspaceMember", logger);
		await invalidateEntityCache("projectMember", logger);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.WORKSPACE_MEMBER.REMOVED, {}, 200));
	});

	return { add, getAll, getById, getMyMembership, updateRole, remove };
};
