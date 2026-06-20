import type { ErrorDetail } from "../helper/error-handler";

export class AppError extends Error {
	public readonly statusCode: number;
	public readonly isOperational: boolean;
	public readonly errors?: ErrorDetail[];

	constructor(message: string, statusCode: number, isOperational = true, errors?: ErrorDetail[]) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		this.errors = errors;
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

export class NotFoundError extends AppError {
	constructor(entityType: string, id?: string) {
		const message = id ? `${entityType} not found: ${id}` : `${entityType} not found`;
		super(message, 404);
	}
}

export class BadRequestError extends AppError {
	constructor(message: string, errors?: ErrorDetail[]) {
		super(message, 400, true, errors);
	}
}

export class ValidationError extends AppError {
	constructor(message: string = "Validation failed", errors?: ErrorDetail[]) {
		super(message, 400, true, errors);
	}
}

export class ConflictError extends AppError {
	constructor(message: string) {
		super(message, 409);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message: string = "Unauthorized") {
		super(message, 401);
	}
}

export class ForbiddenError extends AppError {
	constructor(message: string = "Forbidden") {
		super(message, 403);
	}
}
