import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateInvoiceSchema, UpdateInvoiceSchema } from "../../zod/invoice.zod";
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
	const path = "/invoice";

	/**
	 * @openapi
	 * /api/invoice/{id}:
	 *   get:
	 *     summary: Get invoice by ID
	 *     description: Retrieve a specific invoice by its unique identifier
	 *     tags: [Invoice]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Invoice ID (MongoDB ObjectId format)
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Invoice retrieved successfully
	 *       404:
	 *         description: Invoice not found
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:invoice:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/invoice:
	 *   get:
	 *     summary: Get all invoices
	 *     description: Retrieve invoices with filtering, pagination, and sorting
	 *     tags: [Invoice]
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
	 *         description: Invoices retrieved successfully
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:invoice:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/invoice:
	 *   post:
	 *     summary: Create new invoice
	 *     description: Create a new invoice
	 *     tags: [Invoice]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - invoiceNumber
	 *             properties:
	 *               invoiceNumber:
	 *                 type: string
	 *               invoiceType:
	 *                 type: string
	 *                 enum: [PAYABLE, RECEIVABLE]
	 *               vendorId:
	 *                 type: string
	 *               items:
	 *                 type: array
	 *     responses:
	 *       201:
	 *         description: Invoice created successfully
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreateInvoiceSchema), controller.create);

	/**
	 * @openapi
	 * /api/invoice/{id}:
	 *   patch:
	 *     summary: Update invoice
	 *     description: Update invoice data by ID
	 *     tags: [Invoice]
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
	 *         description: Invoice updated successfully
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		transformFormData,
		validate(UpdateInvoiceSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/invoice/{id}:
	 *   delete:
	 *     summary: Delete invoice
	 *     description: Soft delete an invoice by ID
	 *     tags: [Invoice]
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
	 *         description: Invoice deleted successfully
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
