import express, { type NextFunction, type Request, type Response } from "express";
import type { Application } from "express";
import swaggerUi from "swagger-ui-express";
import type { Server as SocketServer } from "socket.io";
import { prisma } from "../config/prisma";
import { config } from "../config/config";
import openApiSpecs from "../docs/openApiSpecs";
import verifyToken from "../middleware/verifyToken";
import { authSecurityMiddleware, devSecurityMiddleware, securityMiddleware } from "../middleware/security";
import requestIdMiddleware from "../middleware/requestId";
import { sanitizeInputs } from "../middleware/sanitization";
import { AppError } from "../errors";
import { env } from "../config/env";
import { registerLegacyRoutes, type LegacyRouteRegistration } from "./legacy/register-legacy-routes";
import { patsModule } from "./pats";
import { canonicalRouter } from "./canonical/router";
import type { IdentityDependencies } from "./identity/types";

interface RequestWithIO extends Request {
	io?: SocketServer;
}

export interface AppOptions {
	enableLegacyRoutes?: boolean;
	/** Supplied by index.ts so Socket.IO is attached before route handlers. */
	app?: Application;
	io?: SocketServer;
	/** Provider-neutral canonical identity adapter; absent means protected self routes fail closed. */
	identity?: IdentityDependencies;
}

const blockedRegistrations = (baseApiPath: string): readonly LegacyRouteRegistration[] => [
	{ path: baseApiPath, load: (client) => require("./employee")(client) },
	{ path: baseApiPath, load: (client) => require("./product")(client) },
	{ path: baseApiPath, load: (client) => require("./workspaceMember")(client) },
	{ path: baseApiPath, load: (client) => require("./projectMember")(client) },
];

export function createApp(options: AppOptions = {}): Application {
	const app = options.app ?? express();

	// Request ID tracking (first middleware for all requests)
	app.use(requestIdMiddleware);

	// Canonical PATS routes are intentionally isolated from legacy parsing,
	// authentication, and error envelopes.
	app.use("/api/v1", canonicalRouter({ identity: options.identity }));

	// Body parsing
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(require("cookie-parser")());

	// Configure CORS
	app.use(
		require("cors")({
			origin: config.cors.origins,
			credentials: config.cors.credentials,
		}),
	);

	// Apply security middleware AFTER body parsing
	if (process.env.NODE_ENV === "production") {
		app.use(securityMiddleware);
		console.log("🔒 Production security middleware enabled");
	} else {
		app.use(devSecurityMiddleware);
		console.log("⚠ Development security middleware enabled (relaxed mode)");
	}

	// XSS sanitization (after body parsing and security)
	app.use(sanitizeInputs());

	// Socket.IO must be attached before any route handlers that may use req.io.
	if (options.io) {
		app.use((req: Request, _res: Response, next: NextFunction) => {
			(req as RequestWithIO).io = options.io;
			next();
		});
	}

	// Health check endpoints
	app.get("/", (_req: Request, res: Response) => {
		res.status(200).json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		});
	});

	app.get("/health", (_req: Request, res: Response) => {
		res.status(200).json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			message: "SLA monitoring is active",
		});
	});

	app.get("/health/redis", verifyToken, async (_req: Request, res: Response) => {
		try {
			const { redisClient } = await import("../config/redis.js");
			const start = Date.now();
			await redisClient.ping();
			const latency = Date.now() - start;
			const stats = await redisClient.getClient().info("memory");
			const memoryMatch = stats.match(/used_memory_human:(.+)/);
			const memoryUsage = memoryMatch ? memoryMatch[1].trim() : "Unknown";
			const dbsize = await redisClient.getClient().dbsize();

			res.status(200).json({
				status: "healthy",
				redis: {
					connected: redisClient.isClientConnected(),
					latency: `${latency}ms`,
					memoryUsage,
					totalKeys: dbsize,
				},
				timestamp: new Date().toISOString(),
			});
		} catch (_error) {
			res.status(503).json({
				status: "unhealthy",
				redis: { connected: false },
				timestamp: new Date().toISOString(),
			});
		}
	});

	// Public documentation and auth boundaries
	if (process.env.NODE_ENV !== "production") {
		app.use(`${config.baseApiPath}/swagger`, swaggerUi.serve, swaggerUi.setup(openApiSpecs()));
	}
	app.use(`${config.baseApiPath}/auth`, authSecurityMiddleware);

	app.use(config.baseApiPath, require("./docs/docs")(prisma, app));

	// Authentication middleware for all API routes not explicitly public.
	app.use(config.baseApiPath, (req: Request, res: Response, next: NextFunction) => {
		const publicPaths = ["/docs", "/auth", "/swagger"];
		const isPublicPath = publicPaths.some((path) => req.path.startsWith(path));

		if (isPublicPath) return next();
		verifyToken(req, res, next);
	});

	if (env.ENABLE_TEST_MODE === "true") {
		app.use(config.baseApiPath, (req: Request, _res: Response, next: NextFunction) => {
			(req as any).user = {
				id: "test-user-507f1f77bcf86cd799439011",
				email: "test@example.com",
				role: "admin",
			};
			next();
		});
		console.log("⚠️ TEST MODE ENABLED - Authentication bypassed for all requests");
	}

	// PATS is a separate PostgreSQL-backed read surface. It is mounted after the
	// shared authentication boundary and before legacy compatibility routes.
	app.use(config.baseApiPath, patsModule());

	// Retained platform and blocked-review routes stay mounted in the default
	// application. They are not part of the quarantine compatibility switch.
	registerLegacyRoutes(app, prisma, [
		{ path: config.baseApiPath, load: (client) => require("./workspace")(client) },
		...blockedRegistrations(config.baseApiPath),
	]);

	// 404 handler for unmatched routes
	app.use((req: Request, res: Response) => {
		res.status(404).json({
			success: false,
			message: `Route ${req.method} ${req.path} not found`,
			code: 404,
		});
	});

	// Global error handler for Express
	app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
		const isDev = process.env.NODE_ENV !== "production";

		if (err instanceof AppError && err.isOperational) {
			res.status(err.statusCode).json({
				status: "error",
				message: err.message,
				code: err.statusCode,
				...(err.errors && { errors: err.errors }),
				timestamp: new Date().toISOString(),
			});
			return;
		}

		if (err.constructor?.name === "PrismaClientKnownRequestError") {
			const prismaErr = err as Error & { code: string; meta?: Record<string, unknown> };
			if (prismaErr.code === "P2002") {
				const target = (prismaErr.meta?.target as string[])?.join(", ") || "field";
				res.status(409).json({
					status: "error",
					message: `Duplicate value for: ${target}`,
					code: 409,
					timestamp: new Date().toISOString(),
				});
				return;
			}
			if (prismaErr.code === "P2025") {
				res.status(404).json({
					status: "error",
					message: "Record not found",
					code: 404,
					timestamp: new Date().toISOString(),
				});
				return;
			}
		}

		console.error("Express error:", err.stack || err);
		res.status(500).json({
			status: "error",
			message: isDev ? err.message : "Internal server error",
			code: 500,
			...(isDev && { stack: err.stack }),
			timestamp: new Date().toISOString(),
		});
	});

	return app;
}
