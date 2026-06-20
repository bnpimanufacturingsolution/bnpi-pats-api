import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { getLogger } from "../helper/logger";

const logger = getLogger();

/**
 * Request ID Middleware
 * Generates a unique ID for each request for tracking and debugging
 */

declare global {
	namespace Express {
		interface Request {
			requestId?: string;
		}
	}
}

/**
 * Generate or extract request ID
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
	// Check if client provided a request ID (useful for client-side tracking)
	const clientRequestId = req.headers["x-request-id"] as string;

	// Generate new UUID if no client ID provided, or use client ID
	const requestId = clientRequestId && isValidUUID(clientRequestId) ? clientRequestId : randomUUID();

	// Attach to request object
	req.requestId = requestId;

	// Add to response headers for client reference
	res.setHeader("X-Request-Id", requestId);

	// Log request start with ID
	logger.info("Request started", {
		requestId,
		method: req.method,
		path: req.path,
		ip: req.ip,
		userAgent: req.get("User-Agent"),
	});

	// Capture response time
	const startTime = Date.now();

	// Log when response finishes
	res.on("finish", () => {
		const duration = Date.now() - startTime;
		const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

		logger[logLevel]("Request completed", {
			requestId,
			method: req.method,
			path: req.path,
			statusCode: res.statusCode,
			duration: `${duration}ms`,
			ip: req.ip,
		});
	});

	next();
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

/**
 * Get request ID from request object
 */
export function getRequestId(req: Request): string | undefined {
	return req.requestId;
}

export default requestIdMiddleware;
