import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateDeliveryOrderSchema, UpdateDeliveryOrderSchema } from "../../zod/deliveryOrder.zod";
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
	const path = "/delivery-order";

	/**
	 * @openapi
	 * /api/delivery-order/{id}:
	 *   get:
	 *     summary: Get delivery order by ID
	 *     description: Retrieve a specific delivery order by its unique identifier
	 *     tags: [DeliveryOrder]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Delivery Order ID (MongoDB ObjectId format)
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Delivery order retrieved successfully
	 *       404:
	 *         description: Delivery order not found
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:deliveryOrder:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/delivery-order:
	 *   get:
	 *     summary: Get all delivery orders
	 *     description: Retrieve delivery orders with filtering, pagination, and sorting
	 *     tags: [DeliveryOrder]
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
	 *         description: Delivery orders retrieved successfully
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:deliveryOrder:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/delivery-order:
	 *   post:
	 *     summary: Create new delivery order
	 *     description: Create a new delivery order
	 *     tags: [DeliveryOrder]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - doNumber
	 *               - purchaseOrderId
	 *               - vendorId
	 *             properties:
	 *               doNumber:
	 *                 type: string
	 *               purchaseOrderId:
	 *                 type: string
	 *               vendorId:
	 *                 type: string
	 *               items:
	 *                 type: array
	 *     responses:
	 *       201:
	 *         description: Delivery order created successfully
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreateDeliveryOrderSchema), controller.create);

	/**
	 * @openapi
	 * /api/delivery-order/{id}:
	 *   patch:
	 *     summary: Update delivery order
	 *     description: Update delivery order data by ID
	 *     tags: [DeliveryOrder]
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
	 *         description: Delivery order updated successfully
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		transformFormData,
		validate(UpdateDeliveryOrderSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/delivery-order/{id}:
	 *   delete:
	 *     summary: Delete delivery order
	 *     description: Soft delete a delivery order by ID
	 *     tags: [DeliveryOrder]
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
	 *         description: Delivery order deleted successfully
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
