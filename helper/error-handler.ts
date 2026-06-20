import type { Logger } from "winston";
import { NotFoundError, BadRequestError } from "../errors";

export interface ErrorDetail {
	field?: string;
	message: string;
}

export interface ErrorResponse {
	status: "error";
	message: string;
	code: number;
	errors?: ErrorDetail[];
	timestamp: string;
}

export function buildErrorResponse(
	message: string,
	code: number = 500,
	errors?: ErrorDetail[],
): ErrorResponse {
	return {
		status: "error",
		message,
		code,
		errors,
		timestamp: new Date().toISOString(),
	};
}

// Optional: Helper to convert Zod errors to ErrorDetail format
export function formatZodErrors(
	zodError: Record<string, unknown> | null | undefined,
): ErrorDetail[] {
	if (!zodError) return [];

	const formattedErrors = zodError as Record<
		string,
		Record<string, unknown[]> | unknown
	>; // Expecting zodError to be the result of error.format()

	return Object.entries(formattedErrors)
		.filter(([field]) => field !== "_errors") // Exclude top-level _errors
		.map(([field, error]) => {
			const errorRecord = error as Record<string, unknown[] | unknown>;
			const errorMessages = errorRecord._errors as string[] | undefined;
			return {
				field,
				message: errorMessages?.[0] || "Validation error",
			};
		})
		.filter((error) => error.message !== "Validation error"); // Filter out generic errors
}

/**
 * Throw NotFoundError if entity is null/undefined.
 * Used as a guard — call it and continue with the happy path.
 *
 * @example
 * const project = await repository.getById(id);
 * assertFound(project, "Project", projectLogger, id);
 * // project is now guaranteed non-null
 */
export function assertFound<T>(
	entity: T | null | undefined,
	entityType: string,
	logger?: Logger,
	id?: string,
): asserts entity is T {
	if (!entity) {
		logger?.warn(`${entityType} not found${id ? `: ${id}` : ""}`);
		throw new NotFoundError(entityType, id);
	}
}

/**
 * @deprecated Use `assertFound` instead. This function now throws NotFoundError.
 * Kept for backward compatibility during migration.
 */
export function handleNotFound<T>(
	entity: T | null | undefined,
	_res: unknown,
	entityType: string,
	logger?: Logger,
	id?: string,
): entity is null | undefined {
	if (!entity) {
		logger?.warn(`${entityType} not found${id ? `: ${id}` : ""}`);
		throw new NotFoundError(entityType, id);
	}
	return false;
}

/**
 * @deprecated Use `assertFound` on the updated entity instead. This function now throws NotFoundError.
 * Kept for backward compatibility during migration.
 */
export function handleUpdateNotFound<T>(
	existing: T | null | undefined,
	updated: T | null | undefined,
	_res: unknown,
	entityType: string,
	logger?: Logger,
	id?: string,
): boolean {
	if (!existing || !updated) {
		logger?.warn(`${entityType} not found for update${id ? `: ${id}` : ""}`);
		throw new NotFoundError(entityType, id);
	}
	return false;
}

/**
 * Validate required ID parameter — throws BadRequestError if missing.
 */
export function validateRequiredId(
	id: string | undefined,
	_res: unknown,
	paramName: string = "id",
	logger?: Logger,
): id is string {
	if (!id) {
		logger?.error(`Missing required parameter: ${paramName}`);
		throw new BadRequestError(`Missing required parameter: ${paramName}`);
	}
	return true;
}

/**
 * Validate update payload is not empty — throws BadRequestError if empty.
 */
export function validateUpdatePayload(
	body: Record<string, unknown>,
	_res: unknown,
	logger?: Logger,
): boolean {
	if (!body || Object.keys(body).length === 0) {
		logger?.error("No update fields provided");
		throw new BadRequestError("No update fields provided");
	}
	return true;
}
