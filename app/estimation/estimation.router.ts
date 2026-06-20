import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { CreateEstimationSchema, CreateDraftEstimationSchema, UpdateEstimationSchema } from "../../zod/estimation.zod";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
	createDraft(req: Request, res: Response, next: NextFunction): void;
	exportExcel(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/estimation";

	/**
	 * @openapi
	 * /api/estimation/{id}:
	 *   get:
	 *     summary: Get estimation by ID
	 *     description: Retrieve a specific estimation by its unique identifier with optional field selection
	 *     tags: [Estimation]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Estimation ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports nested fields)
	 *         example: "id,estimationNumber,estimatedCost,status,projectItems(itemName,estimatedTotal)"
	 *     responses:
	 *       200:
	 *         description: Estimation retrieved successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Estimation not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		cache({
			ttl: 90,
			keyGenerator: (req: Request) => {
				const fields = (req.query.fields as string) || "full";
				return `cache:estimation:byId:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/estimation:
	 *   get:
	 *     summary: Get all estimations
	 *     description: Retrieve estimations with advanced filtering, pagination, sorting, field selection, and optional grouping
	 *     tags: [Estimation]
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
	 *         example: "id,estimationNumber,status,estimatedCost"
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query
	 *         example: "EST-2025"
	 *       - in: query
	 *         name: filter
	 *         schema:
	 *           type: string
	 *         description: JSON array of filter objects
	 *         example: '[{"status":"APPROVED"}]'
	 *       - in: query
	 *         name: groupBy
	 *         schema:
	 *           type: string
	 *         description: Group results by field
	 *         example: "status"
	 *       - in: query
	 *         name: document
	 *         schema:
	 *           type: string
	 *           enum: ["true"]
	 *         description: Include estimation documents
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
	 *         description: Estimations retrieved successfully
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
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:estimation:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/estimation:
	 *   post:
	 *     summary: Create new estimation
	 *     description: Create a new estimation with the provided data
	 *     tags: [Estimation]
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
	 *               - marginPercentage
	 *             properties:
	 *               estimationNumber:
	 *                 type: string
	 *                 example: "EST-2025-001"
	 *               projectId:
	 *                 type: string
	 *                 example: "507f1f77bcf86cd799439011"
	 *               marginPercentage:
	 *                 type: number
	 *                 description: Margin percentage (0-100). Computed values stored in metaData.
	 *                 example: 30
	 *               status:
	 *                 type: string
	 *                 enum: [DRAFT, PENDING, APPROVED, REJECTED, REVISED]
	 *                 default: DRAFT
	 *               notes:
	 *                 type: string
	 *                 nullable: true
	 *     responses:
	 *       201:
	 *         description: Estimation created successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Project not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.post("/", validateWorkspaceId, transformFormData, validate(CreateEstimationSchema), controller.create);

	/**
	 * @openapi
	 * /api/estimation/draft:
	 *   post:
	 *     summary: Create draft estimation
	 *     description: Create a new draft estimation or copy from the latest draft estimation for a project
	 *     tags: [Estimation]
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
	 *             properties:
	 *               projectId:
	 *                 type: string
	 *                 description: Project ID to create draft for
	 *                 example: "507f1f77bcf86cd799439011"
	 *               copyFromLatest:
	 *                 type: boolean
	 *                 description: "If true, copies all data from the latest draft estimation"
	 *                 default: false
	 *                 example: true
	 *               sourceEstimationId:
	 *                 type: string
	 *                 description: "Optional ID of specific estimation to copy from (overrides copyFromLatest)"
	 *                 example: "507f1f77bcf86cd799439011"
	 *               name:
	 *                 type: string
	 *                 description: Name for the new draft (optional when copying, uses copied name if not provided)
	 *                 example: "Updated Estimate v2"
	 *               notes:
	 *                 type: string
	 *                 description: Notes for the new draft (optional when copying)
	 *                 example: "Copy of previous draft with updates"
	 *               estimationNumber:
	 *                 type: string
	 *                 description: Custom estimation number (auto-generated if not provided)
	 *                 example: "EST-2025-002"
	 *               marginPercentage:
	 *                 type: number
	 *                 description: Required when copyFromLatest is false. Computed values stored in metaData.
	 *                 example: 30
	 *     responses:
	 *       201:
	 *         description: Draft estimation created successfully
	 *       400:
	 *         description: Bad request - missing projectId or validation failed
	 *       404:
	 *         description: Project not found or no draft estimation to copy from
	 *       500:
	 *         description: Internal server error
	 */
	routes.post(
		"/draft",
		validateWorkspaceId,
		transformFormData,
		validate(CreateDraftEstimationSchema),
		controller.createDraft,
	);

	/**
	 * @openapi
	 * /api/estimation/{id}:
	 *   patch:
	 *     summary: Update estimation
	 *     description: Update estimation data by ID (partial update)
	 *     tags: [Estimation]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Estimation ID
	 *         example: "507f1f77bcf86cd799439011"
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             minProperties: 1
	 *             properties:
	 *               marginPercentage:
	 *                 type: number
	 *                 description: Margin percentage (0-100). Triggers metaData recalculation.
	 *               status:
	 *                 type: string
	 *                 enum: [DRAFT, PENDING, APPROVED, REJECTED, REVISED]
	 *               notes:
	 *                 type: string
	 *                 nullable: true
	 *     responses:
	 *       200:
	 *         description: Estimation updated successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Estimation not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		validateObjectId("id"),
		validate(UpdateEstimationSchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/estimation/export/excel:
	 *   get:
	 *     summary: Export estimations to Excel
	 *     description: Export all estimations to Excel format with optional filtering and sorting
	 *     tags: [Estimation]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: query
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Search query to filter estimations
	 *         example: "draft"
	 *       - in: query
	 *         name: filter
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: JSON array of filter objects
	 *         example: '[{"status":"APPROVED"}]'
	 *       - in: query
	 *         name: order
	 *         required: false
	 *         schema:
	 *           type: string
	 *           enum: [asc, desc]
	 *           default: desc
	 *         description: Sort order
	 *       - in: query
	 *         name: sort
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Field to sort by
	 *         example: "estimationNumber"
	 *     responses:
	 *       200:
	 *         description: Excel file downloaded successfully
	 *         content:
	 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
	 *             schema:
	 *               type: string
	 *               format: binary
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/export/excel", validateWorkspaceId, controller.exportExcel);

	/**
	 * @openapi
	 * /api/estimation/{id}:
	 *   delete:
	 *     summary: Delete estimation
	 *     description: Permanently delete an estimation by ID
	 *     tags: [Estimation]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Estimation ID
	 *         example: "507f1f77bcf86cd799439011"
	 *     responses:
	 *       200:
	 *         description: Estimation deleted successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Estimation not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
