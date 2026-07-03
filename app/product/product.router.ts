import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";
import { CreateProductSchema, UpdateProductSchema } from "../../zod/product.zod";
import { controller } from "./product.controller";
import { Permission, requirePermission } from "../../middleware/rbac";

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

export const router = (route: Router, productController: IController): Router => {
	const routes = Router();
	const path = "/product";

	/**
	 * @openapi
	 * /api/product/generate-code:
	 *   get:
	 *     summary: Generate product code
	 *     description: Generate the next available product code within the current workspace
	 *     tags: [Product]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Product code generated successfully
	 */
	routes.get(
		"/generate-code",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		requirePermission(Permission.PRODUCT_CREATE),
		productController.generateCode,
	);

	/**
	 * @openapi
	 * /api/product/{id}:
	 *   get:
	 *     summary: Get product by ID
	 *     description: Retrieve a product and its production, BOM, and cost assumption data
	 *     tags: [Product]
	 *     security:
	 *       - bearerAuth: []
	 */
	routes.get(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		requirePermission(Permission.PRODUCT_READ),
		cache({
			ttl: 300,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:product:byId:${req.params.id}:${queryKey}`;
			},
		}),
		productController.getById,
	);

	/**
	 * @openapi
	 * /api/product:
	 *   get:
	 *     summary: Get all products
	 *     description: Retrieve products with filtering, searching, sorting, and pagination
	 *     tags: [Product]
	 *     security:
	 *       - bearerAuth: []
	 */
	routes.get(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		requirePermission(Permission.PRODUCT_READ),
		cache({
			ttl: 300,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:product:list:${queryKey}`;
			},
		}),
		productController.getAll,
	);

	/**
	 * @openapi
	 * /api/product:
	 *   post:
	 *     summary: Create new product
	 *     description: Create a new product master record
	 *     tags: [Product]
	 *     security:
	 *       - bearerAuth: []
	 */
	routes.post(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		requirePermission(Permission.PRODUCT_CREATE),
		transformFormData,
		validate(CreateProductSchema),
		productController.create,
	);

	/**
	 * @openapi
	 * /api/product/{id}:
	 *   patch:
	 *     summary: Update product
	 *     description: Update a product master record by ID
	 *     tags: [Product]
	 *     security:
	 *       - bearerAuth: []
	 */
	routes.patch(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		requirePermission(Permission.PRODUCT_UPDATE),
		transformFormData,
		validate(UpdateProductSchema),
		productController.update,
	);

	/**
	 * @openapi
	 * /api/product/{id}:
	 *   delete:
	 *     summary: Delete product
	 *     description: Soft delete a product by ID
	 *     tags: [Product]
	 *     security:
	 *       - bearerAuth: []
	 */
	routes.delete(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(DELETE_ROLES),
		validateObjectId("id"),
		requirePermission(Permission.PRODUCT_DELETE),
		productController.remove,
	);

	route.use(path, routes);

	return route;
};
