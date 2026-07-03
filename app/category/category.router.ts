import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";
import { CreateCategorySchema, UpdateCategorySchema } from "../../zod/category.zod";

const READ_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const WRITE_ROLES = ["OWNER", "ADMIN", "MEMBER"];
const DELETE_ROLES = ["OWNER", "ADMIN"];

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
	generateCode(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/category";

	/**
	 * @openapi
	 * /api/category/generate-code:
	 *   get:
	 *     summary: Generate category code from name
	 *     description: Generates a unique 3-character code based on the category name (e.g., Materials → MTR). Does not save to database.
	 *     tags: [Category]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: name
	 *         required: true
	 *         schema:
	 *           type: string
	 *           minLength: 1
	 *         description: Category name to generate code from
	 *         example: "Materials"
	 *     responses:
	 *       200:
	 *         description: Category code generated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 code:
	 *                   type: string
	 *                   description: The generated 3-character code
	 *                   example: "MTR"
	 *                 isAvailable:
	 *                   type: boolean
	 *                   description: Whether the code is available (not used by another category)
	 *                 existingCategory:
	 *                   type: object
	 *                   nullable: true
	 *                   description: The existing category if code is taken
	 *       400:
	 *         description: Name is required
	 *       500:
	 *         description: Internal server error
	 */
	routes.get("/generate-code", validateWorkspaceId, requireWorkspaceRole(READ_ROLES), controller.generateCode);

	/**
	 * @openapi
	 * /api/category/{id}:
	 *   get:
	 *     summary: Get category by ID
	 *     description: Retrieve a specific category by its unique identifier with optional field selection
	 *     tags: [Category]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Category ID (MongoDB ObjectId format)
	 *         example: "507f1f77bcf86cd799439011"
	 *       - in: query
	 *         name: fields
	 *         required: false
	 *         schema:
	 *           type: string
	 *         description: Comma-separated list of fields to include (supports nested fields with dot notation)
	 *         example: "id,name,description,color"
	 *     responses:
	 *       200:
	 *         description: Category retrieved successfully
	 *       404:
	 *         description: Category not found
	 *       500:
	 *         description: Internal server error
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
				return `cache:category:${req.params.id}:${fields}`;
			},
		}),
		controller.getById,
	);

	/**
	 * @openapi
	 * /api/category:
	 *   get:
	 *     summary: Get all categories
	 *     description: Retrieve categories with advanced filtering, pagination, sorting, field selection, and optional grouping
	 *     tags: [Category]
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
	 *           default: 100
	 *         description: Number of records per page
	 *       - in: query
	 *         name: query
	 *         schema:
	 *           type: string
	 *         description: Search query to filter by name or description
	 *       - in: query
	 *         name: isActive
	 *         schema:
	 *           type: boolean
	 *         description: Filter by active status
	 *     responses:
	 *       200:
	 *         description: Categories retrieved successfully
	 *       500:
	 *         description: Internal server error
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:category:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	/**
	 * @openapi
	 * /api/category:
	 *   post:
	 *     summary: Create new category
	 *     description: Create a new category with the provided data
	 *     tags: [Category]
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
	 *               - type
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 120
	 *                 description: Category name
	 *                 example: "Human Resource"
	 *               description:
	 *                 type: string
	 *                 maxLength: 500
	 *                 description: Category description
	 *                 example: "Personnel and staffing costs"
	 *               color:
	 *                 type: string
	 *                 pattern: '^#[0-9A-Fa-f]{6}$'
	 *                 description: Hex color code for UI display
	 *                 example: "#3B82F6"
	 *               type:
	 *                 type: string
	 *                 enum: [CAPEX, OPEX]
	 *                 description: Category type (Capital vs Operational Expenditure)
	 *                 example: "OPEX"
	 *               isActive:
	 *                 type: boolean
	 *                 description: Active status
	 *                 default: true
	 *     responses:
	 *       201:
	 *         description: Category created successfully
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
		validate(CreateCategorySchema),
		controller.create,
	);

	/**
	 * @openapi
	 * /api/category/{id}:
	 *   patch:
	 *     summary: Update category
	 *     description: Update category data by ID (partial update)
	 *     tags: [Category]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Category ID (MongoDB ObjectId format)
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
	 *                 maxLength: 120
	 *               description:
	 *                 type: string
	 *                 maxLength: 500
	 *               color:
	 *                 type: string
	 *                 pattern: '^#[0-9A-Fa-f]{6}$'
	 *               type:
	 *                 type: string
	 *                 enum: [CAPEX, OPEX]
	 *               isActive:
	 *                 type: boolean
	 *     responses:
	 *       200:
	 *         description: Category updated successfully
	 *       400:
	 *         description: Validation failed
	 *       404:
	 *         description: Category not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		transformFormData,
		validate(UpdateCategorySchema),
		controller.update,
	);

	/**
	 * @openapi
	 * /api/category/{id}:
	 *   delete:
	 *     summary: Delete category
	 *     description: Soft delete a category by ID
	 *     tags: [Category]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *         description: Category ID (MongoDB ObjectId format)
	 *     responses:
	 *       204:
	 *         description: Category deleted successfully
	 *       404:
	 *         description: Category not found
	 *       500:
	 *         description: Internal server error
	 */
	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	route.use(path, routes);

	return route;
};
