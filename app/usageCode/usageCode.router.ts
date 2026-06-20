import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateUsageCodeSchema, UpdateUsageCodeSchema } from "../../zod/usageCode.zod";
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
	const path = "/usageCode";

	/**
	 * @openapi
	 * /api/usageCode/{id}:
	 *   get:
	 *     summary: Get usageCode by ID
	 *     description: Retrieve a specific usageCode by its unique identifier with optional field selection
	 *     tags: [UsageCode]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: UsageCode ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports nested fields with dot notation)
	 *         example: "id,name,code,description"
	 *     responses:
	 *       200:
	 *         description: UsageCode retrieved successfully
	 *       404:
	 *         description: UsageCode not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:usageCode:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/usageCode:
	 *   get:
	 *     summary: Get all usageCodes
	 *     description: Retrieve usageCodes with advanced filtering, pagination, sorting, field selection, and optional grouping
	 *     tags: [UsageCode]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           default: 1
	 *         description: Page number for pagination
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           maximum: 100
	 *           default: 100
	 *         description: Number of records per page
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter by name, code, or description
	 *     responses:
	 *       200:
	 *         description: UsageCodes retrieved successfully
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:usageCode:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/usageCode:
	 *   post:
	 *     summary: Create new usageCode
	 *     description: Create a new usageCode with the provided data
	 *     tags: [UsageCode]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - name
	 *               - code
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 120
	 *                 description: UsageCode name
	 *                 example: "Office Supplies"
	 *               code:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 50
	 *                 description: Unique code identifier
	 *                 example: "OFF-SUP"
	 *               description:
	 *                 type: string
	 *                 maxLength: 500
	 *                 description: UsageCode description
	 *                 example: "General office supplies and materials"
	 *     responses:
	 *       201:
	 *         description: UsageCode created successfully
	 *       400:
	 *         description: Validation failed
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreateUsageCodeSchema), controller.create);

	/**
	 * @openapi
	 * /api/usageCode/{id}:
	 *   patch:
	 *     summary: Update usageCode
	 *     description: Update usageCode data by ID (partial update)
	 *     tags: [UsageCode]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: UsageCode ID (MongoDB ObjectId format)
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             minProperties: 1
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 120
	 *               code:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 50
	 *               description:
	 *                 type: string
	 *                 maxLength: 500
	 *     responses:
	 *       200:
	 *         description: UsageCode updated successfully
	 *       400:
	 *         description: Validation failed
	 *       404:
	 *         description: UsageCode not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		transformFormData,
		validate(UpdateUsageCodeSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/usageCode/{id}:
	 *   delete:
	 *     summary: Delete usageCode
	 *     description: Soft delete a usageCode by ID
	 *     tags: [UsageCode]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: UsageCode ID (MongoDB ObjectId format)
	 *     responses:
	 *       204:
	 *         description: UsageCode deleted successfully
	 *       404:
	 *         description: UsageCode not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
