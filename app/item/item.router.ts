import { Router, Request, Response, NextFunction } from "express";
import { cache, cacheShort, cacheMedium, cacheUser } from "../../middleware/cache";
import { uploadDocuments } from "../../middleware/upload";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateItemSchema, UpdateItemSchema } from "../../zod/item.zod";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	updateActualPriceWithDocuments(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/item";

	/**
	 * @openapi
	 * /api/item/{id}:
	 *   get:
	 *     summary: Get item by ID
	 *     description: Retrieve a specific item by its unique identifier with optional field selection
	 *     tags: [Item]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Item ID (MongoDB ObjectId format)
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Item retrieved successfully
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       404:
	 *         $ref: '#/components/responses/NotFound'
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:item:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/item:
	 *   get:
	 *     summary: Get all items
	 *     description: Retrieve items with filtering, pagination, and grouping
	 *     tags: [Item]
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
	 *           default: 10
	 *       - in: query
	 *         name: type
	 *         schema:
	 *           type: string
	 *           enum: [CAPEX, OPEX, MISC]
	 *         description: Filter by item type
	 *       - in: query
	 *         name: document
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include item documents in response
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
	 *         description: Items retrieved successfully
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:item:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/item:
	 *   post:
	 *     summary: Create new item
	 *     description: Create a new item (CAPEX or OPEX)
	 *     tags: [Item]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - projectId
	 *               - type
	 *               - itemName
	 *               - quantity
	 *               - estimatedUnitPrice
	 *               - estimatedTotal
	 *             properties:
	 *               projectId:
	 *                 type: string
	 *               type:
	 *                 type: string
	 *                 enum: [CAPEX, OPEX, MISC]
	 *               category:
	 *                 type: string
	 *                 description: Category (mainly for OPEX items)
	 *               itemName:
	 *                 type: string
	 *               quantity:
	 *                 type: integer
	 *               estimatedUnitPrice:
	 *                 type: number
	 *               estimatedTotal:
	 *                 type: number
	 *     responses:
	 *       201:
	 *         description: Item created successfully
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreateItemSchema), controller.create);

	/**
	 * @openapi
	 * /api/item/{id}:
	 *   patch:
	 *     summary: Update item
	 *     description: Update item data by ID
	 *     tags: [Item]
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
	 *         description: Item updated successfully
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		transformFormData,
		validate(UpdateItemSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/item/{id}/actual:
	 *   patch:
	 *     summary: Update actual cost with documents
	 *     description: Update item actual price and upload supporting documents (invoices, receipts, etc.)
	 *     tags: [Item]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Item ID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - actualUnitPrice
	 *             properties:
	 *               actualUnitPrice:
	 *                 type: number
	 *                 description: Actual unit price
	 *               documents:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                   format: binary
	 *                 description: Supporting documents
	 *     responses:
	 *       200:
	 *         description: Actual cost updated successfully
	 *       400:
	 *         description: Bad request
	 *       404:
	 *         description: Item not found
	 */
	routes.patch(
		"/:id/actual",
		validateWorkspaceId,
		validateObjectId("id"),
		uploadDocuments,
		controller.updateActualPriceWithDocuments,
	);

	/**
	 * @openapi
	 * /api/item/{id}:
	 *   delete:
	 *     summary: Delete item
	 *     description: Permanently delete a item by ID
	 *     tags: [Item]
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
	 *         description: Item deleted successfully
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
