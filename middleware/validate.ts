import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { buildErrorResponse, formatZodErrors } from "../helper/error-handler";
import { createLogger } from "../helper/logger";

const validationLogger = createLogger("validation-middleware");

/**
 * Validation middleware factory
 * Validates request body/params/query against a Zod schema
 *
 * @example
 * router.post('/', validate(CreateUserSchema), userController.create);
 * router.post('/', validate(CreateUserSchema, 'body'), userController.create);
 * router.get('/:id', validate(IdSchema, 'params'), userController.getById);
 */
export const validate = (
	schema: ZodSchema,
	source: "body" | "params" | "query" = "body",
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const dataToValidate = req[source];

		const result = schema.safeParse(dataToValidate);

		if (!result.success) {
			const formattedErrors = formatZodErrors(result.error.format());
			validationLogger.error(`Validation failed for ${req.method} ${req.path}:`, formattedErrors);

			const errorResponse = buildErrorResponse("Validation failed", 400, formattedErrors);
			res.status(400).json(errorResponse);
			return;
		}

		// Replace the source data with validated data (adds type safety)
		req[source] = result.data;
		next();
	};
};

/**
 * Validate ObjectId parameter
 * Common validation for MongoDB ObjectId in route params
 *
 * @example
 * router.get('/:id', validateObjectId('id'), controller.getById);
 */
export const validateObjectId = (paramName: string = "id") => {
	return (req: Request, res: Response, next: NextFunction) => {
		const id = req.params[paramName];

		if (!id) {
			const errorResponse = buildErrorResponse(`${paramName} parameter is required`, 400);
			res.status(400).json(errorResponse);
			return;
		}

		// MongoDB ObjectId validation (24 hex characters)
		const objectIdRegex = /^[0-9a-fA-F]{24}$/;
		if (!objectIdRegex.test(id)) {
			const errorResponse = buildErrorResponse(
				`Invalid ${paramName} format. Must be a valid MongoDB ObjectId`,
				400,
			);
			res.status(400).json(errorResponse);
			return;
		}

		next();
	};
};

export default validate;
