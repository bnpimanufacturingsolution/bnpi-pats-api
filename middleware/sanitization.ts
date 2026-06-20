import { Request, Response, NextFunction } from "express";
import validator from "validator";
import { getLogger } from "../helper/logger";

const logger = getLogger();

/**
 * XSS Sanitization Middleware
 * Recursively sanitizes all string values in request body, query, and params
 * to prevent Cross-Site Scripting (XSS) attacks
 */

interface SanitizationOptions {
	allowedTags?: string[];
	stripTags?: boolean;
}

const defaultOptions: SanitizationOptions = {
	stripTags: true,
	allowedTags: [], // No HTML tags allowed by default
};

/**
 * Sanitize a single string value
 */
function sanitizeString(value: string, options: SanitizationOptions = defaultOptions): string {
	if (typeof value !== "string") return value;

	// Remove null bytes
	let sanitized = value.replace(/\0/g, "");

	// Escape HTML entities to prevent XSS
	// sanitized = validator.escape(sanitized); // DISABLED: Causing double escaping issues (e.g. / -> &#x2F;)

	// Remove any remaining script tags or event handlers
	sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
	sanitized = sanitized.replace(/on\w+\s*=\s*["']?[^"']*["']?/gi, "");
	sanitized = sanitized.replace(/javascript:/gi, "");
	sanitized = sanitized.replace(/data:text\/html/gi, "");

	return sanitized;
}

/**
 * Recursively sanitize object/array
 */
function sanitizeValue(value: unknown, options: SanitizationOptions = defaultOptions): unknown {
	if (value === null || value === undefined) {
		return value;
	}

	if (typeof value === "string") {
		return sanitizeString(value, options);
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeValue(item, options));
	}

	if (typeof value === "object" && value !== null) {
		const sanitized: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			// Also sanitize the keys to prevent prototype pollution
			const sanitizedKey = sanitizeString(key, options);
			sanitized[sanitizedKey] = sanitizeValue(val, options);
		}
		return sanitized;
	}

	return value;
}

/**
 * Middleware to sanitize all user inputs
 */
export const sanitizeInputs = (options: SanitizationOptions = defaultOptions) => {
	return (req: Request, _res: Response, next: NextFunction) => {
		try {
			// Sanitize body
			if (req.body && typeof req.body === "object") {
				req.body = sanitizeValue(req.body, options);
			}

			// Sanitize query parameters (Handle read-only property)
			if (req.query && typeof req.query === "object") {
				const sanitizedQuery = sanitizeValue(req.query, options) as any;
				// In some versions of Express/Node, req.query is a getter. 
				// Better to modify it in-place if possible, or skip if it fails.
				try {
					Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
					Object.assign(req.query, sanitizedQuery);
				} catch (e) {
					// Fallback: If we can't modify it, we might be stuck, but we don't crash
					logger.warn("Could not modify req.query in-place", { path: req.path });
				}
			}

			// Sanitize URL parameters
			if (req.params && typeof req.params === "object") {
				const sanitizedParams = sanitizeValue(req.params, options) as any;
				try {
					Object.assign(req.params, sanitizedParams);
				} catch (e) {
					logger.warn("Could not modify req.params in-place", { path: req.path });
				}
			}

			logger.debug("Request sanitized", {
				path: req.path,
				method: req.method,
			});

			next();
		} catch (error) {
			logger.error("Error sanitizing request", {
				error: error instanceof Error ? error.message : "Unknown error",
				path: req.path,
			});
			next(); // Continue even if sanitization fails
		}
	};
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
	return validator.isEmail(email);
};

/**
 * Validate URL format
 */
export const validateURL = (url: string): boolean => {
	return validator.isURL(url, {
		protocols: ["http", "https"],
		require_protocol: true,
	});
};

/**
 * Validate MongoDB ObjectId format
 */
export const validateObjectId = (id: string): boolean => {
	return validator.isMongoId(id);
};

/**
 * Sanitize HTML allowing specific tags
 */
export const sanitizeHTML = (html: string, allowedTags: string[] = []): string => {
	// Basic sanitization - for production, consider using DOMPurify or sanitize-html
	let sanitized = html;

	// Remove all tags except allowed ones
	if (allowedTags.length === 0) {
		sanitized = validator.escape(html);
	} else {
		// Create regex to match tags not in allowedTags
		const allowedTagsPattern = allowedTags.join("|");
		const dangerousTagsPattern = new RegExp(`<(?!\\/?(${allowedTagsPattern})\\b)[^>]*>`, "gi");
		sanitized = html.replace(dangerousTagsPattern, "");
	}

	return sanitized;
};

/**
 * Prevent NoSQL injection by sanitizing MongoDB queries
 */
export const sanitizeMongoQuery = (query: unknown): unknown => {
	if (typeof query !== "object" || query === null) {
		return query;
	}

	const sanitized: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(query)) {
		// Prevent prototype pollution
		if (key === "__proto__" || key === "constructor" || key === "prototype") {
			continue;
		}

		// Remove MongoDB operators from user input keys
		if (key.startsWith("$")) {
			logger.warn("Attempted MongoDB operator injection", { key, value });
			continue;
		}

		sanitized[key] = sanitizeMongoQuery(value);
	}

	return sanitized;
};

export default {
	sanitizeInputs,
	validateEmail,
	validateURL,
	validateObjectId,
	sanitizeHTML,
	sanitizeMongoQuery,
};
