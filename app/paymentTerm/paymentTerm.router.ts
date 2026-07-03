import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreatePaymentTermSchema, UpdatePaymentTermSchema } from "../../zod/paymentTerm.zod";
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
	const path = "/payment-term";

	/**
	 * @openapi
	 * /api/payment-term/{id}:
	 *   get:
	 *     summary: Get payment term by ID
	 *     description: Retrieve a specific payment term by its unique identifier
	 *     tags: [PaymentTerm]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Payment Term ID (MongoDB ObjectId format)
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Payment term retrieved successfully
	 *       404:
	 *         description: Payment term not found
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		cache({
			ttl: 300,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:paymentTerm:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/payment-term:
	 *   get:
	 *     summary: Get all payment terms
	 *     description: Retrieve payment terms with filtering, pagination, and sorting
	 *     tags: [PaymentTerm]
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
	 *         description: Payment terms retrieved successfully
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 300,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:paymentTerm:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/payment-term:
	 *   post:
	 *     summary: Create new payment term
	 *     description: Create a new payment term
	 *     tags: [PaymentTerm]
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
	 *                 example: "NET30"
	 *               name:
	 *                 type: string
	 *                 example: "Net 30 Days"
	 *               dueDays:
	 *                 type: integer
	 *                 example: 30
	 *               discountDays:
	 *                 type: integer
	 *                 example: 10
	 *               discountRate:
	 *                 type: number
	 *                 example: 2
	 *     responses:
	 *       201:
	 *         description: Payment term created successfully
	 */
	routes.post(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		transformFormData,
		validate(CreatePaymentTermSchema),
		controller.create,
	);

	/**
	 * @openapi
	 * /api/payment-term/{id}:
	 *   patch:
	 *     summary: Update payment term
	 *     description: Update payment term data by ID
	 *     tags: [PaymentTerm]
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
	 *         description: Payment term updated successfully
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		transformFormData,
		validate(UpdatePaymentTermSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/payment-term/{id}:
	 *   delete:
	 *     summary: Delete payment term
	 *     description: Soft delete a payment term by ID
	 *     tags: [PaymentTerm]
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
	 *         description: Payment term deleted successfully
	 */
	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
