import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateWorkspaceSchema, UpdateWorkspaceSchema } from "../../zod/workspace.zod";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";
import { AuthRequest } from "../../middleware/verifyToken";

/**
 * Workspace identity comes from the :id route param here, not the
 * x-workspace-id header, so scope req.workspaceId to it before running
 * requireWorkspaceRole.
 */
const scopeToRouteWorkspace = (req: Request, res: Response, next: NextFunction) => {
	(req as AuthRequest).workspaceId = req.params.id;
	next();
};

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
	checkCode(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/workspace";

	/**
	 * @openapi
	 * /api/workspace/check-code/{code}:
	 *   get:
	 *     summary: Check if workspace code is available
	 *     description: Check if a workspace code already exists in the system
	 *     tags: [Workspace]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: code
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Workspace code to check
	 *     responses:
	 *       200:
	 *         description: Code availability status
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 code:
	 *                   type: string
	 *                 available:
	 *                   type: boolean
	 */
	routes.get("/check-code/:code", controller.checkCode);

	/**
	 * @openapi
	 * /api/workspace/{id}:
	 *   get:
	 *     summary: Get workspace by ID
	 *     description: Retrieve a specific workspace by its unique identifier
	 *     tags: [Workspace]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Workspace ID (MongoDB ObjectId format)
	 *     responses:
	 *       200:
	 *         description: Workspace retrieved successfully
	 *       404:
	 *         $ref: '#/components/responses/NotFound'
	 */
	routes.get(
		"/:id",
		validateObjectId("id"),
		scopeToRouteWorkspace,
		requireWorkspaceRole(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:workspace:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/workspace:
	 *   get:
	 *     summary: Get all workspaces
	 *     description: Retrieve workspaces with filtering, pagination, and sorting
	 *     tags: [Workspace]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Workspaces retrieved successfully
	 */
	routes.get(
		"/",
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:workspace:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/workspace:
	 *   post:
	 *     summary: Create new workspace
	 *     description: Create a new workspace
	 *     tags: [Workspace]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       201:
	 *         description: Workspace created successfully
	 */
	routes.post("/", transformFormData, validate(CreateWorkspaceSchema), controller.create);

	/**
	 * @openapi
	 * /api/workspace/{id}:
	 *   patch:
	 *     summary: Update workspace
	 *     description: Update workspace data by ID
	 *     tags: [Workspace]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Workspace updated successfully
	 */
	routes.patch(
		"/:id",
		validateObjectId("id"),
		scopeToRouteWorkspace,
		requireWorkspaceRole(["OWNER", "ADMIN"]),
		transformFormData,
		validate(UpdateWorkspaceSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/workspace/{id}:
	 *   delete:
	 *     summary: Delete workspace
	 *     description: Delete a workspace by ID
	 *     tags: [Workspace]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Workspace deleted successfully
	 */
	routes.delete(
		"/:id",
		validateObjectId("id"),
		scopeToRouteWorkspace,
		requireWorkspaceRole(["OWNER"]),
		controller.remove,
	);

	route.use(path, routes);

	return route;
};
