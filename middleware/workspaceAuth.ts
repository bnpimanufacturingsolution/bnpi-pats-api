import { Response, NextFunction } from "express";
import { PrismaClient } from "../generated/prisma";
import { createLogger } from "../helper/logger";
import { AuthRequest } from "./verifyToken";

const logger = createLogger("workspace-auth");

/**
 * Creates a workspace role-checking middleware.
 * Looks up WorkspaceMember by req.userId + req.workspaceId.
 * Returns 403 if user doesn't have one of the required roles.
 *
 * @example
 * const { requireWorkspaceRole } = createWorkspaceAuth(prisma);
 * router.post("/", validateWorkspaceId, requireWorkspaceRole(["OWNER", "ADMIN"]), controller.add);
 */
export const createWorkspaceAuth = (prisma: PrismaClient) => {
	const requireWorkspaceRole = (allowedRoles: string[]) => {
		return async (req: AuthRequest, res: Response, next: NextFunction) => {
			const userId = req.userId;
			const workspaceId = req.workspaceId;

			if (!userId || !workspaceId) {
				logger.warn("Workspace auth failed - missing userId or workspaceId", {
					path: req.path,
					userId,
					workspaceId,
				});
				res.status(401).json({
					success: false,
					message: "Authentication required",
					code: 401,
				});
				return;
			}

			try {
				const member = await prisma.workspaceMember.findFirst({
					where: { workspaceId, userId, isDeleted: false },
					select: { id: true, role: true },
				});

				if (!member) {
					logger.warn("Workspace auth failed - not a member", {
						path: req.path,
						userId,
						workspaceId,
					});
					res.status(403).json({
						success: false,
						message: "You are not a member of this workspace",
						code: 403,
					});
					return;
				}

				if (!allowedRoles.includes(member.role)) {
					logger.warn("Workspace auth failed - insufficient role", {
						path: req.path,
						userId,
						workspaceId,
						userRole: member.role,
						requiredRoles: allowedRoles,
					});
					res.status(403).json({
						success: false,
						message: "Insufficient workspace role for this action",
						code: 403,
					});
					return;
				}

				// Attach workspace member info to request
				(req as any).workspaceMemberRole = member.role;
				(req as any).workspaceMemberId = member.id;

				next();
			} catch (error) {
				logger.error("Workspace auth error", { error, path: req.path });
				res.status(500).json({
					success: false,
					message: "Internal server error during authorization",
					code: 500,
				});
			}
		};
	};

	return { requireWorkspaceRole };
};
