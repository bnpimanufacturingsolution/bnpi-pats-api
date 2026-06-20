import { Router, Request, Response, NextFunction } from "express";
import { validate, validateObjectId } from "../../middleware/validate";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { AddWorkspaceMemberSchema, UpdateWorkspaceMemberRoleSchema } from "../../zod/workspaceMember.zod";

interface IController {
	add(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	getById(req: Request, res: Response, next: NextFunction): void;
	getMyMembership(req: Request, res: Response, next: NextFunction): void;
	updateRole(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/workspace-member";

	/**
	 * @openapi
	 * /api/workspace-member/me:
	 *   get:
	 *     summary: Get current user's workspace membership
	 *     tags: [WorkspaceMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Membership retrieved successfully
	 *       404:
	 *         description: Not a member of this workspace
	 */
	routes.get("/me", validateWorkspaceId, controller.getMyMembership);

	/**
	 * @openapi
	 * /api/workspace-member/{id}:
	 *   get:
	 *     summary: Get workspace member by ID
	 *     tags: [WorkspaceMember]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Member retrieved successfully
	 */
	routes.get("/:id", validateWorkspaceId, validateObjectId("id"), controller.getById);

	/**
	 * @openapi
	 * /api/workspace-member:
	 *   get:
	 *     summary: Get all workspace members
	 *     tags: [WorkspaceMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Members retrieved successfully
	 */
	routes.get("/", validateWorkspaceId, controller.getAll);

	/**
	 * @openapi
	 * /api/workspace-member:
	 *   post:
	 *     summary: Add a member to workspace
	 *     tags: [WorkspaceMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       201:
	 *         description: Member added successfully
	 */
	routes.post("/", validateWorkspaceId, validate(AddWorkspaceMemberSchema), controller.add);

	/**
	 * @openapi
	 * /api/workspace-member/{id}/role:
	 *   patch:
	 *     summary: Update workspace member role
	 *     tags: [WorkspaceMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Role updated successfully
	 */
	routes.patch(
		"/:id/role",
		validateWorkspaceId,
		validateObjectId("id"),
		validate(UpdateWorkspaceMemberRoleSchema),
		controller.updateRole,
	);

	/**
	 * @openapi
	 * /api/workspace-member/{id}:
	 *   delete:
	 *     summary: Remove workspace member
	 *     tags: [WorkspaceMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Member removed successfully
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
