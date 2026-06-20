import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { Request, Response } from "express";
import { getLogger } from "../helper/logger";

const logger = getLogger();

// Centralized rate limiting configuration
const RATE_LIMIT_CONFIG = {
	windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes default
	max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "300"), // 300 requests per 15 minutes
	delayAfter: 150, // Start slowing down after 150 requests
	delayMs: 100, // Add 100ms delay per request after limit
	maxDelayMs: 5000, // Maximum delay of 5 seconds
};

// Strict rate limiting for authentication endpoints
const AUTH_RATE_LIMIT_CONFIG = {
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || "10"), // Only 10 attempts per 15 minutes
	skipSuccessfulRequests: false, // Count both successful and failed attempts
};

// Create centralized rate limiter
export const rateLimiter = rateLimit({
	windowMs: RATE_LIMIT_CONFIG.windowMs,
	max: RATE_LIMIT_CONFIG.max,
	message: {
		error: "Too many requests",
		message: "Rate limit exceeded. Please try again later.",
		retryAfter: Math.ceil(RATE_LIMIT_CONFIG.windowMs / 1000),
	},
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req: Request) => req.ip || "unknown",
	handler: (req: Request, res: Response) => {
		logger.warn("Rate limit exceeded", {
			ip: req.ip,
			path: req.path,
			userAgent: req.get("User-Agent"),
		});

		res.status(429).json({
			error: "Too many requests",
			message: "Rate limit exceeded. Please try again later.",
			retryAfter: Math.ceil(RATE_LIMIT_CONFIG.windowMs / 1000),
			timestamp: new Date().toISOString(),
		});
	},
});

// Strict rate limiter for authentication endpoints (login, register, password reset)
export const authRateLimiter = rateLimit({
	windowMs: AUTH_RATE_LIMIT_CONFIG.windowMs,
	max: AUTH_RATE_LIMIT_CONFIG.max,
	skipSuccessfulRequests: AUTH_RATE_LIMIT_CONFIG.skipSuccessfulRequests,
	message: {
		error: "Too many authentication attempts",
		message: "Too many login attempts. Please try again later.",
		retryAfter: Math.ceil(AUTH_RATE_LIMIT_CONFIG.windowMs / 1000),
	},
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req: Request) => {
		// Use IP + email/username if provided for more granular limiting
		const identifier = req.body?.email || req.body?.username || "";
		return `${req.ip}-${identifier}`;
	},
	handler: (req: Request, res: Response) => {
		logger.warn("Authentication rate limit exceeded", {
			ip: req.ip,
			path: req.path,
			email: req.body?.email || "unknown",
			userAgent: req.get("User-Agent"),
		});

		res.status(429).json({
			error: "Too many authentication attempts",
			message: "Too many login attempts from this IP. Please try again later.",
			retryAfter: Math.ceil(AUTH_RATE_LIMIT_CONFIG.windowMs / 1000),
			timestamp: new Date().toISOString(),
		});
	},
});

// Create centralized slow down middleware
export const slowDownMiddleware = slowDown({
	windowMs: RATE_LIMIT_CONFIG.windowMs,
	delayAfter: RATE_LIMIT_CONFIG.delayAfter,
	delayMs: () => RATE_LIMIT_CONFIG.delayMs,
	maxDelayMs: RATE_LIMIT_CONFIG.maxDelayMs,
	validate: { delayMs: false },
});

// Export the centralized configuration
export const rateLimitConfig = RATE_LIMIT_CONFIG;

// Default export with the main rate limiter
export default rateLimiter;
