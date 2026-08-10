import { Router, type RequestHandler } from "express";
import { catalogController } from "./catalog";
import validateWorkspaceId from "../../middleware/validateWorkspaceId";
import type { ObjectStorage } from "../storage/object-storage";
import type { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";

export const catalogRouter = (
	patsPrisma: Pick<PatsPrismaClient, "product">,
	objectStorage: ObjectStorage,
	workspaceAccess: RequestHandler,
	options: { canonical?: boolean } = {},
): Router => {
	const router = Router();

	/**
	 * @openapi
	 * /api/pats/catalog/products/{productId}:
	 *   get:
	 *     summary: Read a workspace-scoped PATS product catalog record
	 *     description: Returns Product -> Model -> ModelPart data without legacy seed fallback. Optional private imageObjectKey metadata is resolved to a short-lived read URL and is never returned.
	 *     tags: [PATS Catalog]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: header
	 *         name: x-workspace-id
	 *         required: true
	 *         schema:
	 *           type: string
	 *           pattern: '^[0-9a-fA-F]{24}$'
	 *       - in: path
	 *         name: productId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Complete or sparse PATS catalog record
	 *       400:
	 *         description: Workspace header is missing or invalid
	 *       404:
	 *         description: Product is not linked to the requested workspace
	 *       503:
	 *         description: Private image storage is unavailable
	 */
	router.get(
		"/pats/catalog/products/:productId",
		validateWorkspaceId,
		workspaceAccess,
		catalogController(patsPrisma, objectStorage, { canonical: options.canonical }),
	);

	return router;
};
