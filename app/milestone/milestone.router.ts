import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateMilestoneSchema, UpdateMilestoneSchema } from "../../zod/milestone.zod";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/milestone";

	/**
	 * @openapi
	 * /api/milestone/{id}:
	 *   get:
	 *     summary: Get milestone by ID
	 *     description: Retrieve a specific milestone by its unique identifier
	 *     tags: [Milestone]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Milestone ID (MongoDB ObjectId format)
	 *     responses:
	 *       200:
	 *         description: Milestone retrieved successfully
	 *       404:
	 *         description: Milestone not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 300, // 5 minutes
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:milestone:byId:${req.params.id}:${queryKey}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/milestone:
	 *   get:
	 *     summary: Get all milestones
	 *     description: Retrieve milestones with filtering, searching, sorting, and pagination
	 *     tags: [Milestone]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           default: 1
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           maximum: 100
	 *           default: 10
	 *       - in: query
	 *         name: search
	 *         schema:
	 *           type: string
	 *         description: Search query to filter by title or description
	 *       - in: query
	 *         name: filter
	 *         schema:
	 *           type: string
	 *         description: Filter condition (e.g., "status:IN_PROGRESS", "phase:FOUNDATION")
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *           default: createdAt
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *           default: desc
	 *     responses:
	 *       200:
	 *         description: Milestones retrieved successfully
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 300, // 5 minutes
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:milestone:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/milestone:
	 *   post:
	 *     summary: Create new milestone
	 *     description: Create a new milestone with the provided data
	 *     tags: [Milestone]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - title
	 *               - phase
	 *             properties:
	 *               title:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 255
	 *               description:
	 *                 type: string
	 *               phase:
	 *                 type: string
	 *                 enum: [FOUNDATION, CORE_MODULES, ADVANCED_FEATURES, ENHANCED_FEATURES, INTEGRATION_OPTIMIZATION, ENTERPRISE_FEATURES]
	 *               status:
	 *                 type: string
	 *                 enum: [NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD]
	 *               priority:
	 *                 type: string
	 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
	 *               progressPercent:
	 *                 type: number
	 *                 minimum: 0
	 *                 maximum: 100
	 *               startDate:
	 *                 type: string
	 *                 format: date-time
	 *               targetDate:
	 *                 type: string
	 *                 format: date-time
	 *     responses:
	 *       201:
	 *         description: Milestone created successfully
	 *       400:
	 *         description: Validation failed
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreateMilestoneSchema), controller.create);

	/**
	 * @openapi
	 * /api/milestone/{id}:
	 *   patch:
	 *     summary: Update milestone
	 *     description: Update milestone data by ID (partial update)
	 *     tags: [Milestone]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *     responses:
	 *       200:
	 *         description: Milestone updated successfully
	 *       400:
	 *         description: Validation failed
	 *       404:
	 *         description: Milestone not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		validate(UpdateMilestoneSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/milestone/{id}:
	 *   delete:
	 *     summary: Delete milestone
	 *     description: Soft delete a milestone by ID
	 *     tags: [Milestone]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *     responses:
	 *       200:
	 *         description: Milestone deleted successfully
	 *       404:
	 *         description: Milestone not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
