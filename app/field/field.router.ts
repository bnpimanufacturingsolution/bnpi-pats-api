import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { controller } from "./field.controller";
import { cache } from "../../middleware/cache";
import { validate } from "../../middleware/validate";
import { CreateFieldSchema, UpdateFieldSchema } from "../../zod/field.zod";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";

const path = "/field";

export default (prisma: PrismaClient) => {
	const router = Router();
	const fieldController = controller(prisma);

	/**
	 * @route   POST /api/field
	 * @desc    Create a new field
	 * @access  Private
	 */
	router.post(path, validateWorkspaceId, validate(CreateFieldSchema), fieldController.create);

	/**
	 * @route   GET /api/field
	 * @desc    Get all fields with optional filtering, searching, sorting, and pagination
	 * @access  Private
	 * @query   filter - Filter condition (e.g., "category:common")
	 * @query   search - Search term (searches in name)
	 * @query   sort - Field to sort by (default: createdAt)
	 * @query   order - Sort order: asc or desc (default: desc)
	 * @query   page - Page number for pagination (default: 1)
	 * @query   limit - Number of items per page (default: 10)
	 * @query   count - Include total count (default: false)
	 * @query   document - Return paginated document format (default: false)
	 */
	router.get(
		path,
		validateWorkspaceId,
		cache({
			ttl: 300, // 5 minutes
			keyGenerator: (req) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:field:list:${queryKey}`;
			},
		}),
		fieldController.getAll,
	);

	/**
	 * @route   GET /api/field/:id
	 * @desc    Get field by ID
	 * @access  Private
	 */
	router.get(
		`${path}/:id`,
		validateWorkspaceId,
		cache({
			ttl: 300, // 5 minutes
			keyGenerator: (req) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:field:byId:${req.params.id}:${queryKey}`;
			},
		}),
		fieldController.getById,
	);

	/**
	 * @route   PATCH /api/field/:id
	 * @desc    Update field
	 * @access  Private
	 */
	router.patch(`${path}/:id`, validateWorkspaceId, validate(UpdateFieldSchema), fieldController.update);

	/**
	 * @route   DELETE /api/field/:id
	 * @desc    Soft delete field
	 * @access  Private
	 */
	router.delete(`${path}/:id`, validateWorkspaceId, fieldController.remove);

	return router;
};
