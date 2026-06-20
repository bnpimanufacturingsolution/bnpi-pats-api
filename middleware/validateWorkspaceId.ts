import { Response, NextFunction } from "express";
import { buildErrorResponse } from "../helper/error-handler";
import { createLogger } from "../helper/logger";
import { AuthRequest } from "./verifyToken";

const workspaceLogger = createLogger("workspace-validation");

/**
 * Middleware to validate workspaceId from header or query parameter
 * Checks x-workspace-id header first, then falls back to query parameter
 * Validates it's a valid MongoDB ObjectId and sets req.workspaceId for use in controllers
 *
 * @example
 * router.get('/', validateWorkspaceId, controller.getAll);
 */
export const validateWorkspaceId = (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	// Check header first (from frontend), then query parameter
	const workspaceId = (req.headers["x-workspace-id"] as string) || (req.query.workspaceId as string);

	if (!workspaceId) {
		workspaceLogger.warn(`Missing workspaceId in request: ${req.method} ${req.path}`);
		const errorResponse = buildErrorResponse(
			"workspaceId is required (via x-workspace-id header or query parameter)",
			400,
		);
		res.status(400).json(errorResponse);
		return;
	}

	// MongoDB ObjectId validation (24 hex characters)
	const objectIdRegex = /^[0-9a-fA-F]{24}$/;
	if (!objectIdRegex.test(workspaceId)) {
		workspaceLogger.warn(`Invalid workspaceId format: ${workspaceId}`);
		const errorResponse = buildErrorResponse(
			"Invalid workspaceId format. Must be a valid MongoDB ObjectId",
			400,
		);
		res.status(400).json(errorResponse);
		return;
	}

	// Set workspaceId on request for use in controllers
	req.workspaceId = workspaceId;
	next();
};

export default validateWorkspaceId;
