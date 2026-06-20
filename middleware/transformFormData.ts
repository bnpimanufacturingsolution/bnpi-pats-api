import { Request, Response, NextFunction } from "express";
import { transformFormDataToObject } from "../helper/transformObject";
import { createLogger } from "../helper/logger";

const transformLogger = createLogger("transform-middleware");

/**
 * Transform form data middleware
 * Converts form-encoded or multipart/form-data to JSON object structure
 * Should be applied BEFORE validation middleware
 *
 * @example
 * router.post('/', transformFormData, validate(CreateUserSchema), controller.create);
 */
export const transformFormData = (req: Request, res: Response, next: NextFunction) => {
	const contentType = req.get("Content-Type") || "";

	// Only transform if it's form data
	if (
		contentType.includes("application/x-www-form-urlencoded") ||
		contentType.includes("multipart/form-data")
	) {
		transformLogger.info("Original form data:", JSON.stringify(req.body, null, 2));
		req.body = transformFormDataToObject(req.body);
		transformLogger.info(
			"Transformed form data to object structure:",
			JSON.stringify(req.body, null, 2),
		);
	}

	next();
};

export default transformFormData;
