import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreatePOTypeSchema, UpdatePOTypeSchema } from "../../zod/poType.zod";
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
	const path = "/po-type";

	/**
	 * @openapi
	 * /api/po-type/{id}:
	 *   get:
	 *     summary: Get PO type by ID
	 *     description: Retrieve a specific PO type by its unique identifier
	 *     tags: [POType]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: PO Type ID (MongoDB ObjectId format)
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: PO type retrieved successfully
	 *       404:
	 *         description: PO type not found
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 300,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:poType:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/po-type:
	 *   get:
	 *     summary: Get all PO types
	 *     description: Retrieve PO types with filtering, pagination, and sorting
	 *     tags: [POType]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           default: 1
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           default: 10
	 *       - in: query
	 *         name: order
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *       - in: query
	 *         name: sort
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: filter
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: PO types retrieved successfully
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 300,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:poType:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/po-type:
	 *   post:
	 *     summary: Create new PO type
	 *     description: Create a new purchase order type
	 *     tags: [POType]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - code
	 *               - name
	 *             properties:
	 *               code:
	 *                 type: string
	 *                 example: "S"
	 *               name:
	 *                 type: string
	 *                 example: "Service"
	 *               description:
	 *                 type: string
	 *                 example: "Service-based purchase orders"
	 *               requiresDelivery:
	 *                 type: boolean
	 *                 example: false
	 *               autoCreateInvoice:
	 *                 type: boolean
	 *                 example: true
	 *     responses:
	 *       201:
	 *         description: PO type created successfully
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreatePOTypeSchema), controller.create);

	/**
	 * @openapi
	 * /api/po-type/{id}:
	 *   patch:
	 *     summary: Update PO type
	 *     description: Update PO type data by ID
	 *     tags: [POType]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *     responses:
	 *       200:
	 *         description: PO type updated successfully
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		transformFormData,
		validate(UpdatePOTypeSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/po-type/{id}:
	 *   delete:
	 *     summary: Delete PO type
	 *     description: Soft delete a PO type by ID
	 *     tags: [POType]
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
	 *         description: PO type deleted successfully
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
