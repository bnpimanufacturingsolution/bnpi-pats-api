import { Router, Request, Response, NextFunction } from "express";
import { validate, validateObjectId } from "../../middleware/validate";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";
import { AddProjectMemberSchema, UpdateProjectMemberRoleSchema } from "../../zod/projectMember.zod";

const READ_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const WRITE_ROLES = ["OWNER", "ADMIN", "MEMBER"];
const DELETE_ROLES = ["OWNER", "ADMIN"];

interface IController {
	add(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	getByProject(req: Request, res: Response, next: NextFunction): void;
	getById(req: Request, res: Response, next: NextFunction): void;
	getMyProjectRole(req: Request, res: Response, next: NextFunction): void;
	updateRole(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/project-member";

	/**
	 * @openapi
	 * /api/project-member/project/{projectId}/me:
	 *   get:
	 *     summary: Get current user's role in a project
	 *     tags: [ProjectMember]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: projectId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Project role retrieved successfully
	 */
	routes.get(
		"/project/:projectId/me",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("projectId"),
		controller.getMyProjectRole,
	);

	/**
	 * @openapi
	 * /api/project-member/project/{projectId}:
	 *   get:
	 *     summary: Get all members of a project
	 *     tags: [ProjectMember]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: projectId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Project members retrieved successfully
	 */
	routes.get(
		"/project/:projectId",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("projectId"),
		controller.getByProject,
	);

	/**
	 * @openapi
	 * /api/project-member/{id}:
	 *   get:
	 *     summary: Get project member by ID
	 *     tags: [ProjectMember]
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
	routes.get(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/project-member:
	 *   get:
	 *     summary: Get all project members in workspace
	 *     tags: [ProjectMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Members retrieved successfully
	 */
	routes.get("/", validateWorkspaceId, requireWorkspaceRole(READ_ROLES), controller.getAll);

	/**
	 * @openapi
	 * /api/project-member:
	 *   post:
	 *     summary: Add a member to a project
	 *     tags: [ProjectMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       201:
	 *         description: Member added successfully
	 */
	routes.post(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validate(AddProjectMemberSchema),
		controller.add,
	);

	/**
	 * @openapi
	 * /api/project-member/{id}/role:
	 *   patch:
	 *     summary: Update project member role
	 *     tags: [ProjectMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Role updated successfully
	 */
	routes.patch(
		"/:id/role",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		validate(UpdateProjectMemberRoleSchema),
		controller.updateRole,
	);

	/**
	 * @openapi
	 * /api/project-member/{id}:
	 *   delete:
	 *     summary: Remove project member
	 *     tags: [ProjectMember]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Member removed successfully
	 */
	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
