import { Response, NextFunction } from "express";
import { PrismaClient } from "../generated/prisma";
import { createLogger } from "../helper/logger";
import { AuthRequest } from "./verifyToken";

const logger = createLogger("project-auth");

/**
 * Creates a project access-checking middleware.
 * First checks workspace OWNER/ADMIN (auto-access), then checks ProjectMember.
 *
 * @example
 * const { requireProjectAccess } = createProjectAuth(prisma);
 * router.patch("/:id", validateWorkspaceId, requireProjectAccess(["ADMIN", "EDITOR"]), controller.update);
 */
export const createProjectAuth = (prisma: PrismaClient) => {
	const requireProjectAccess = (allowedRoles: string[], projectIdParam: string = "projectId") => {
		return async (req: AuthRequest, res: Response, next: NextFunction) => {
			const userId = req.userId;
			const workspaceId = req.workspaceId;
			const projectId = req.params[projectIdParam] || req.body?.projectId;

			if (!userId || !workspaceId) {
				res.status(401).json({
					success: false,
					message: "Authentication required",
					code: 401,
				});
				return;
			}

			if (!projectId) {
				res.status(400).json({
					success: false,
					message: "Project ID is required",
					code: 400,
				});
				return;
			}

			try {
				// Check workspace-level auto-access first
				const workspaceMember = await prisma.workspaceMember.findFirst({
					where: { workspaceId, userId, isDeleted: false },
					select: { role: true },
				});

				if (workspaceMember && (workspaceMember.role === "OWNER" || workspaceMember.role === "ADMIN")) {
					(req as any).projectMemberRole = "ADMIN";
					(req as any).workspaceMemberRole = workspaceMember.role;
					next();
					return;
				}

				// Check explicit project membership
				const projectMember = await prisma.projectMember.findFirst({
					where: { projectId, userId, isDeleted: false },
					select: { id: true, role: true },
				});

				if (!projectMember) {
					logger.warn("Project auth failed - no access", {
						path: req.path,
						userId,
						projectId,
					});
					res.status(403).json({
						success: false,
						message: "You do not have access to this project",
						code: 403,
					});
					return;
				}

				if (!allowedRoles.includes(projectMember.role)) {
					logger.warn("Project auth failed - insufficient role", {
						path: req.path,
						userId,
						projectId,
						userRole: projectMember.role,
						requiredRoles: allowedRoles,
					});
					res.status(403).json({
						success: false,
						message: "Insufficient project role for this action",
						code: 403,
					});
					return;
				}

				(req as any).projectMemberRole = projectMember.role;
				(req as any).projectMemberId = projectMember.id;

				next();
			} catch (error) {
				logger.error("Project auth error", { error, path: req.path });
				res.status(500).json({
					success: false,
					message: "Internal server error during authorization",
					code: 500,
				});
			}
		};
	};

	return { requireProjectAccess };
};
