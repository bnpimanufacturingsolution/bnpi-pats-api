import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreatePurchaseOrderSchema, UpdatePurchaseOrderSchema } from "../../zod/purchaseOrder.zod";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
	exportPdf(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/purchase-order";

	/**
	 * @openapi
	 * /api/purchase-order/{id}/export-pdf:
	 *   get:
	 *     summary: Export purchase order as PDF
	 *     description: Generate and download a PDF document for a specific purchase order
	 *     tags: [PurchaseOrder]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Purchase Order ID (MongoDB ObjectId format)
	 *     responses:
	 *       200:
	 *         description: PDF file generated successfully
	 *         content:
	 *           application/pdf:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       404:
	 *         description: Purchase order not found
	 */
	routes.get(
		"/:id/export-pdf",
		validateWorkspaceId,
		validateObjectId("id"),
		controller.exportPdf,
	);

	/**
	 * @openapi
	 * /api/purchase-order/{id}:
	 *   get:
	 *     summary: Get purchase order by ID
	 *     description: Retrieve a specific purchase order by its unique identifier
	 *     tags: [PurchaseOrder]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Purchase Order ID (MongoDB ObjectId format)
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Purchase order retrieved successfully
	 *       404:
	 *         description: Purchase order not found
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:purchaseOrder:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/purchase-order:
	 *   get:
	 *     summary: Get all purchase orders
	 *     description: Retrieve purchase orders with filtering, pagination, and sorting
	 *     tags: [PurchaseOrder]
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
	 *         description: Purchase orders retrieved successfully
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:purchaseOrder:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/purchase-order:
	 *   post:
	 *     summary: Create new purchase order
	 *     description: Create a new purchase order
	 *     tags: [PurchaseOrder]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - poNumber
	 *               - vendorId
	 *             properties:
	 *               poNumber:
	 *                 type: string
	 *               vendorId:
	 *                 type: string
	 *               items:
	 *                 type: array
	 *     responses:
	 *       201:
	 *         description: Purchase order created successfully
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreatePurchaseOrderSchema), controller.create);

	/**
	 * @openapi
	 * /api/purchase-order/{id}:
	 *   patch:
	 *     summary: Update purchase order
	 *     description: Update purchase order data by ID
	 *     tags: [PurchaseOrder]
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
	 *         description: Purchase order updated successfully
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		transformFormData,
		validate(UpdatePurchaseOrderSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/purchase-order/{id}:
	 *   delete:
	 *     summary: Delete purchase order
	 *     description: Soft delete a purchase order by ID
	 *     tags: [PurchaseOrder]
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
	 *         description: Purchase order deleted successfully
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
