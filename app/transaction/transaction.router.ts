import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { uploadDocuments } from "../../middleware/upload";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateTransactionSchema, UpdateTransactionSchema } from "../../zod/transaction.zod";
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
	getMetric(req: Request, res: Response, next: NextFunction): void;
	getRunningBalance(req: Request, res: Response, next: NextFunction): void;
	setCleared(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/transaction";

	/**
	 * @openapi
	 * /api/transaction/metric:
	 *   get:
	 *     summary: Get transaction metrics for a project
	 *     description: Retrieve aggregated transaction metrics including totals by status and type
	 *     tags: [Transaction]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: projectId
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Project ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *     responses:
	 *       200:
	 *         description: Transaction metrics retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/Success'
	 *                 - type: object
	 *                   properties:
	 *                     data:
	 *                       type: object
	 *                       properties:
	 *                         metrics:
	 *                           type: object
	 *                           properties:
	 *                             totalIncoming:
	 *                               type: number
	 *                             totalOutgoing:
	 *                               type: number
	 *                             clearedIncoming:
	 *                               type: number
	 *                             clearedOutgoing:
	 *                               type: number
	 *                             pendingIncoming:
	 *                               type: number
	 *                             pendingOutgoing:
	 *                               type: number
	 *                             bouncedCount:
	 *                               type: integer
	 *                             bouncedAmount:
	 *                               type: number
	 *                             netBalance:
	 *                               type: number
	 *                             clearedBalance:
	 *                               type: number
	 *                             pendingBalance:
	 *                               type: number
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       401:
	 *         $ref: '#/components/responses/Unauthorized'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	routes.get(
		"/metric",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const projectId = req.query.projectId as string;
				return `cache:transaction:metric:${projectId}`;
			},
		}),
		controller.getMetric,
	);

	/**
	 * @openapi
	 * /api/transaction/metric/running-balance:
	 *   get:
	 *     summary: Get transactions with running balance
	 *     description: Retrieve transactions with calculated running balance based on transaction type and date
	 *     tags: [Transaction]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         required: false
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           default: 1
	 *         description: Page number for pagination
	 *       - in: query
	 *         name: limit
	 *         required: false
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           maximum: 100
	 *           default: 10
	 *         description: Number of records per page
	 *       - in: query
	 *         name: order
	 *         required: false
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *           default: desc
	 *         description: Sort order for results
	 *       - in: query
	 *         name: sort
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Field to sort by
	 *         example: "transactionDate"
	 *       - in: query
	 *         name: query
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Search query to filter transactions
	 *       - in: query
	 *         name: filter
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: JSON array of filter objects
	 *     responses:
	 *       200:
	 *         description: Transactions with running balance retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/Success'
	 *                 - type: object
	 *                   properties:
	 *                     data:
	 *                       type: object
	 *                       properties:
	 *                         transactions:
	 *                           type: array
	 *                           items:
	 *                             allOf:
	 *                               - $ref: '#/components/schemas/Transaction'
	 *                               - type: object
	 *                                 properties:
	 *                                   runningBalance:
	 *                                     type: number
	 *                                     description: Calculated running balance at this transaction
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       401:
	 *         $ref: '#/components/responses/Unauthorized'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	routes.get(
		"/metric/running-balance",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:transaction:metric:running-balance:${queryKey}`;
			},
		}),
		controller.getRunningBalance,
	);

	/**
	 * @openapi
	 * /api/transaction/{id}:
	 *   get:
	 *     summary: Get transaction by ID
	 *     description: Retrieve a specific bank transaction by its unique identifier with optional field selection
	 *     tags: [Transaction]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Transaction ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports nested fields with dot notation)
	 *         example: "id,transactionNumber,payeeName,amount,status"
	 *     responses:
	 *       200:
	 *         description: Transaction retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/Success'
	 *                 - type: object
	 *                   properties:
	 *                     data:
	 *                       type: object
	 *                       properties:
	 *                         transaction:
	 *                           $ref: '#/components/schemas/Transaction'
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       401:
	 *         $ref: '#/components/responses/Unauthorized'
	 *       404:
	 *         $ref: '#/components/responses/NotFound'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
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
				return `cache:transaction:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/transaction:
	 *   get:
	 *     summary: Get all transactions
	 *     description: Retrieve bank transactions with advanced filtering, pagination, sorting, field selection, and optional grouping
	 *     tags: [Transaction]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: page
	 *         required: false
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           default: 1
	 *         description: Page number for pagination
	 *         example: 1
	 *       - in: query
	 *         name: limit
	 *         required: false
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           maximum: 100
	 *           default: 10
	 *         description: Number of records per page
	 *         example: 10
	 *       - in: query
	 *         name: order
	 *         required: false
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *           default: desc
	 *         description: Sort order for results
	 *         example: desc
	 *       - in: query
	 *         name: sort
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Field to sort by or JSON object for multi-field sorting
	 *         example: "transactionDate"
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports dot notation)
	 *         example: "id,transactionNumber,payeeName,amount,status"
	 *       - in: query
	 *         name: query
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Search query to filter by transaction number, payee name, or bank name
	 *         example: "CHK-001"
	 *       - in: query
	 *         name: filter
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: JSON array of filter objects for advanced filtering
	 *         example: '[{"status":"CLEARED"},{"isDeleted":false}]'
	 *       - in: query
	 *         name: groupBy
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Group results by a field name
	 *         example: "status"
	 *       - in: query
	 *         name: document
	 *         required: false
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include transaction documents in response
	 *       - in: query
	 *         name: pagination
	 *         required: false
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include pagination metadata in response
	 *       - in: query
	 *         name: count
	 *         required: false
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include total count in response
	 *     responses:
	 *       200:
	 *         description: Transactions retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/Success'
	 *                 - type: object
	 *                   properties:
	 *                     data:
	 *                       type: object
	 *                       properties:
	 *                         transactions:
	 *                           type: array
	 *                           items:
	 *                             $ref: '#/components/schemas/Transaction'
	 *                           description: Present when document="true" and no groupBy
	 *                         groups:
	 *                           type: object
	 *                           additionalProperties:
	 *                             type: array
	 *                             items:
	 *                               $ref: '#/components/schemas/Transaction'
	 *                           description: Present when groupBy is used and document="true"
	 *                         count:
	 *                           type: integer
	 *                           description: Present when count="true"
	 *                         pagination:
	 *                           $ref: '#/components/schemas/Pagination'
	 *                           description: Present when pagination="true"
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       401:
	 *         $ref: '#/components/responses/Unauthorized'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:transaction:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/transaction:
	 *   post:
	 *     summary: Create new transaction
	 *     description: Create a new bank transaction with the provided data
	 *     tags: [Transaction]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - transactionNumber
	 *               - transactionDate
	 *               - estimationId
	 *               - payeeName
	 *               - amount
	 *             properties:
	 *               transactionNumber:
	 *                 type: string
	 *                 minLength: 1
	 *                 description: Transaction number (unique identifier)
	 *                 example: "CHK-2025-001"
	 *               transactionDate:
	 *                 type: string
	 *                 format: date
	 *                 description: Date on the transaction
	 *                 example: "2025-01-15"
	 *               estimationId:
	 *                 type: string
	 *                 description: Estimation ID (MongoDB ObjectId)
	 *                 example: "507f1f77bcf86cd799439011"
	 *               payeeName:
	 *                 type: string
	 *                 minLength: 1
	 *                 description: Name of the payee
	 *                 example: "ABC Construction Inc."
	 *               amount:
	 *                 type: number
	 *                 minimum: 0
	 *                 description: Transaction amount
	 *                 example: 15000.00
	 *               bankName:
	 *                 type: string
	 *                 description: Name of the bank
	 *                 example: "First National Bank"
	 *               accountNumber:
	 *                 type: string
	 *                 description: Account number (masked)
	 *                 example: "****1234"
	 *               status:
	 *                 type: string
	 *                 enum: [PENDING, CLEARED, BOUNCED, CANCELLED, VOIDED]
	 *                 description: Transaction status
	 *                 default: PENDING
	 *         application/x-www-form-urlencoded:
	 *           schema:
	 *             $ref: '#/components/schemas/CreateTransaction'
	 *         multipart/form-data:
	 *           schema:
	 *             $ref: '#/components/schemas/CreateTransaction'
	 *     responses:
	 *       201:
	 *         description: Transaction created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/Success'
	 *                 - type: object
	 *                   properties:
	 *                     data:
	 *                       type: object
	 *                       properties:
	 *                         transaction:
	 *                           $ref: '#/components/schemas/Transaction'
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       401:
	 *         $ref: '#/components/responses/Unauthorized'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	routes.post(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		uploadDocuments,
		transformFormData,
		validate(CreateTransactionSchema),
		controller.create,
	);

	/**
	 * @openapi
	 * /api/transaction/{id}:
	 *   patch:
	 *     summary: Update transaction
	 *     description: Update transaction data by ID (partial update)
	 *     tags: [Transaction]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Transaction ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             minProperties: 1
	 *             properties:
	 *               status:
	 *                 type: string
	 *                 enum: [PENDING, CLEARED, BOUNCED, CANCELLED, VOIDED]
	 *                 description: Transaction status
	 *                 example: "CLEARED"
	 *               clearedDate:
	 *                 type: string
	 *                 format: date
	 *                 description: Date when transaction was cleared
	 *                 example: "2025-01-20"
	 *               bouncedDate:
	 *                 type: string
	 *                 format: date
	 *                 description: Date when transaction bounced
	 *                 example: "2025-01-20"
	 *               bouncedReason:
	 *                 type: string
	 *                 description: Reason for bounce
	 *                 example: "Insufficient funds"
	 *     responses:
	 *       200:
	 *         description: Transaction updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/Success'
	 *                 - type: object
	 *                   properties:
	 *                     data:
	 *                       type: object
	 *                       properties:
	 *                         transaction:
	 *                           $ref: '#/components/schemas/Transaction'
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       401:
	 *         $ref: '#/components/responses/Unauthorized'
	 *       404:
	 *         $ref: '#/components/responses/NotFound'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		uploadDocuments,
		transformFormData,
		validate(UpdateTransactionSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/transaction/{id}:
	 *   delete:
	 *     summary: Delete transaction
	 *     description: Soft delete a transaction by ID (sets isDeleted flag)
	 *     tags: [Transaction]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Transaction ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *     responses:
	 *       200:
	 *         description: Transaction deleted successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/Success'
	 *                 - type: object
	 *                   properties:
	 *                     data:
	 *                       type: object
	 *                       description: Empty object for successful deletion
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       401:
	 *         $ref: '#/components/responses/Unauthorized'
	 *       404:
	 *         $ref: '#/components/responses/NotFound'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	/**
	 * @openapi
	 * /api/transaction/{id}/clear:
	 *   post:
	 *     summary: Mark transaction as cleared
	 *     description: Update transaction status to CLEARED with a clear date.
	 *     tags: [Transaction]
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
	 *         description: Transaction marked as cleared
	 */
	routes.post(
		"/:id/clear",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		controller.setCleared,
	);

	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
