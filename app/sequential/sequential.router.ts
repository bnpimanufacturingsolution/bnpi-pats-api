import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";
import { CreateSequentialSchema, UpdateSequentialSchema } from "../../zod/sequential.zod";

const READ_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const WRITE_ROLES = ["OWNER", "ADMIN", "MEMBER"];
const DELETE_ROLES = ["OWNER", "ADMIN"];

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/sequential";

	/**
	 * @openapi
	 * /api/sequential/{id}:
	 *   get:
	 *     summary: Get sequential by ID
	 *     description: Retrieve a specific sequential by its unique identifier with optional field selection
	 *     tags: [Sequential]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Sequential ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *         example: "id,name,code,pattern,current"
	 *     responses:
	 *       200:
	 *         description: Sequential retrieved successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Sequential not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:sequential:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/sequential:
	 *   get:
	 *     summary: Get all sequentials
	 *     description: Retrieve sequentials with advanced filtering, pagination, sorting, field selection, and optional grouping
	 *     tags: [Sequential]
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
	 *           default: 10
	 *         description: Number of records per page
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *           default: desc
	 *         description: Sort order
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *         description: Field to sort by
	 *         example: "createdAt"
	 *       - in: query
	 *         name: fields
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *         example: "id,name,code,pattern,current"
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query
	 *         example: "INV"
	 *       - in: query
	 *         name: filter
	 *         schema:
	 *           type: string
	 *         description: JSON array of filter objects
	 *         example: '[{"code":"INV"}]'
	 *       - in: query
	 *         name: groupBy
	 *         schema:
	 *           type: string
	 *         description: Group results by field
	 *         example: "code"
	 *       - in: query
	 *         name: document
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include sequential documents
	 *       - in: query
	 *         name: pagination
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include pagination metadata
	 *       - in: query
	 *         name: count
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include total count
	 *     responses:
	 *       200:
	 *         description: Sequentials retrieved successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:sequential:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/sequential:
	 *   post:
	 *     summary: Create new sequential
	 *     description: Create a new sequential with the provided data
	 *     tags: [Sequential]
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
	 *               - pattern
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 example: "Invoice Number"
	 *               code:
	 *                 type: string
	 *                 example: "INV"
	 *               pattern:
	 *                 type: string
	 *                 example: "INV-{YYYY}-{0000}"
	 *               current:
	 *                 type: integer
	 *                 default: 0
	 *                 example: 0
	 *     responses:
	 *       201:
	 *         description: Sequential created successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       409:
	 *         description: Sequential with this name or code already exists
	 *       500:
	 *         description: Internal server error
	 */
	routes.post(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		transformFormData,
		validate(CreateSequentialSchema),
		controller.create,
	);

	/**
	 * @openapi
	 * /api/sequential/{id}:
	 *   patch:
	 *     summary: Update sequential
	 *     description: Update sequential data by ID (partial update)
	 *     tags: [Sequential]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Sequential ID
	 *         example: "507f1f77bcf86cd799439011"
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
	 *               code:
	 *                 type: string
	 *               pattern:
	 *                 type: string
	 *               current:
	 *                 type: integer
	 *     responses:
	 *       200:
	 *         description: Sequential updated successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Sequential not found
	 *       409:
	 *         description: Sequential with this name or code already exists
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		validate(UpdateSequentialSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/sequential/{id}:
	 *   delete:
	 *     summary: Delete sequential
	 *     description: Soft delete a sequential by ID
	 *     tags: [Sequential]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Sequential ID
	 *         example: "507f1f77bcf86cd799439011"
	 *     responses:
	 *       200:
	 *         description: Sequential deleted successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Sequential not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
