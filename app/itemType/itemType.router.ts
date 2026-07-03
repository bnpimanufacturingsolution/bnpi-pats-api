import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateItemTypeSchema, UpdateItemTypeSchema } from "../../zod/itemType.zod";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";

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
	const path = "/item-type";

	/**
	 * @openapi
	 * /api/item-type/{id}:
	 *   get:
	 *     summary: Get itemType by ID
	 *     description: Retrieve a specific itemType by its unique identifier
	 *     tags: [ItemType]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: ItemType ID (MongoDB ObjectId format)
	 *     responses:
	 *       200:
	 *         description: ItemType retrieved successfully
	 *       404:
	 *         description: ItemType not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		cache({
			ttl: 300, // 5 minutes
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:itemType:byId:${req.params.id}:${queryKey}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/item-type:
	 *   get:
	 *     summary: Get all itemTypes
	 *     description: Retrieve itemTypes with filtering, searching, sorting, and pagination
	 *     tags: [ItemType]
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
	 *         name: search
	 *         schema:
	 *           type: string
	 *         description: Search query to filter by name or description
	 *       - in: query
	 *         name: filter
	 *         schema:
	 *           type: string
	 *         description: Filter condition (e.g., "status:ACTIVE")
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *           default: createdAt
	 *         description: Field to sort by
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *           default: desc
	 *         description: Sort order
	 *     responses:
	 *       200:
	 *         description: ItemTypes retrieved successfully
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 300, // 5 minutes
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:itemType:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/item-type:
	 *   post:
	 *     summary: Create new itemType
	 *     description: Create a new itemType with the provided data
	 *     tags: [ItemType]
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
	 *               - status
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 255
	 *                 description: ItemType name
	 *                 example: "Task"
	 *               description:
	 *                 type: string
	 *                 description: ItemType description
	 *                 example: "Standard task item for project activities"
	 *               icon:
	 *                 type: string
	 *                 description: Icon identifier
	 *                 example: "task"
	 *               status:
	 *                 type: string
	 *                 enum: [ACTIVE, INACTIVE]
	 *                 description: ItemType status
	 *                 example: "ACTIVE"
	 *               defaultFields:
	 *                 type: array
	 *                 description: Default fields for this item type
	 *                 default: []
	 *     responses:
	 *       201:
	 *         description: ItemType created successfully
	 *       400:
	 *         description: Validation failed
	 *       500:
	 *         description: Internal server error
	 */
	routes.post(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		transformFormData,
		validate(CreateItemTypeSchema),
		controller.create,
	);

	/**
	 * @openapi
	 * /api/item-type/{id}:
	 *   patch:
	 *     summary: Update itemType
	 *     description: Update itemType data by ID (partial update)
	 *     tags: [ItemType]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: ItemType ID (MongoDB ObjectId format)
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
	 *                 maxLength: 255
	 *               description:
	 *                 type: string
	 *               icon:
	 *                 type: string
	 *               status:
	 *                 type: string
	 *                 enum: [ACTIVE, INACTIVE]
	 *               defaultFields:
	 *                 type: array
	 *     responses:
	 *       200:
	 *         description: ItemType updated successfully
	 *       400:
	 *         description: Validation failed
	 *       404:
	 *         description: ItemType not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		transformFormData,
		validate(UpdateItemTypeSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/item-type/{id}:
	 *   delete:
	 *     summary: Delete itemType
	 *     description: Soft delete an itemType by ID
	 *     tags: [ItemType]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: ItemType ID (MongoDB ObjectId format)
	 *     responses:
	 *       200:
	 *         description: ItemType deleted successfully
	 *       404:
	 *         description: ItemType not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
