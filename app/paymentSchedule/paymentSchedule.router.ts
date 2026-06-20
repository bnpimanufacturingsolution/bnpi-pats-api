import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { ReleasePaymentSchema } from "../../zod/paymentSchedule.zod";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	getByPurchaseOrderId(req: Request, res: Response, next: NextFunction): void;
	releasePayment(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/payment-schedule";

	/**
	 * @openapi
	 * /api/payment-schedule/purchase-order/{purchaseOrderId}:
	 *   get:
	 *     summary: Get payment schedule by purchase order ID
	 *     description: Retrieve the payment schedule for a specific purchase order
	 *     tags: [PaymentSchedule]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: purchaseOrderId
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Purchase Order ID (MongoDB ObjectId format)
	 *     responses:
	 *       200:
	 *         description: Payment schedule retrieved successfully
	 *       404:
	 *         description: Payment schedule not found for this PO
	 */
	routes.get(
		"/purchase-order/:purchaseOrderId",
		validateWorkspaceId,
		validateObjectId("purchaseOrderId"),
		controller.getByPurchaseOrderId,
	);

	/**
	 * @openapi
	 * /api/payment-schedule/{id}:
	 *   get:
	 *     summary: Get payment schedule by ID
	 *     description: Retrieve a specific payment schedule by its unique identifier
	 *     tags: [PaymentSchedule]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Payment Schedule ID (MongoDB ObjectId format)
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include
	 *     responses:
	 *       200:
	 *         description: Payment schedule retrieved successfully
	 *       404:
	 *         description: Payment schedule not found
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:paymentSchedule:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/payment-schedule:
	 *   get:
	 *     summary: Get all payment schedules
	 *     description: Retrieve payment schedules with filtering, pagination, and sorting
	 *     tags: [PaymentSchedule]
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
	 *         name: filter
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Payment schedules retrieved successfully
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:paymentSchedule:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/payment-schedule/{id}/release:
	 *   post:
	 *     summary: Release a payment for a schedule item
	 *     description: Create a transaction for a specific payment schedule installment
	 *     tags: [PaymentSchedule]
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
	 *             required:
	 *               - itemIndex
	 *               - amount
	 *             properties:
	 *               itemIndex:
	 *                 type: integer
	 *               amount:
	 *                 type: number
	 *               paymentMethod:
	 *                 type: string
	 *                 enum: [CHECK, CASH, BANK_TRANSFER, ONLINE, OTHER]
	 *     responses:
	 *       200:
	 *         description: Payment released successfully
	 *       400:
	 *         description: Invalid request or business rule violation
	 */
	routes.post(
		"/:id/release",
		validateWorkspaceId,
		validateObjectId("id"),
		validate(ReleasePaymentSchema),
		controller.releasePayment,
	);

	/**
	 * @openapi
	 * /api/payment-schedule/{id}:
	 *   delete:
	 *     summary: Delete payment schedule
	 *     description: Soft delete a payment schedule by ID
	 *     tags: [PaymentSchedule]
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
	 *         description: Payment schedule deleted successfully
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
