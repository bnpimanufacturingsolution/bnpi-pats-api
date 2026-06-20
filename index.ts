// Set max listeners BEFORE any imports to prevent warnings
process.setMaxListeners(50);

import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { PrismaClient } from "./generated/prisma";
import { config } from "./config/config";
import openApiSpecs from "./docs/openApiSpecs";
import verifyToken from "./middleware/verifyToken";
import { connectAllDatabases, disconnectAllDatabases } from "./config/database";
import { securityMiddleware, devSecurityMiddleware } from "./middleware/security";
import { authSecurityMiddleware } from "./middleware/security";
import requestIdMiddleware from "./middleware/requestId";
import { sanitizeInputs } from "./middleware/sanitization";
import { initCronJobs } from "./cron";
import { AppError } from "./errors";
import { env } from "./config/env";

// Extend Express Request to include socket.io
interface RequestWithIO extends Request {
	io?: Server;
}

// Extend global to include app instance and error handler flag
declare global {
	var app: express.Application | undefined;
	var __errorHandlersRegistered: boolean | undefined;
}

// Register error handlers only once (prevents accumulation during hot-reload)
if (!global.__errorHandlersRegistered) {
	global.__errorHandlersRegistered = true;

	process.on("uncaughtException", (err) => {
		console.error("=== UNCAUGHT EXCEPTION ===");
		console.error("Error:", err.message);
		console.error("Stack:", err.stack);
		console.error("========================");
		process.exit(1);
	});

	process.on("unhandledRejection", (reason: any, promise) => {
		console.error("=== UNHANDLED PROMISE REJECTION ===");
		console.error("Promise:", promise);
		console.error("Reason:", reason);
		console.error("===============================");
		process.exit(1);
	});
}

// Wrap everything in try-catch
try {
	const app = express();
	const prisma = new PrismaClient();

	// Import route modules
	const template = require("./app/template")(prisma);
	const project = require("./app/project")(prisma);
	const estimation = require("./app/estimation")(prisma);
	const sequential = require("./app/sequential")(prisma);
	const item = require("./app/item")(prisma);
	const order = require("./app/order")(prisma);
	const vendor = require("./app/vendor")(prisma);
	const payslip = require("./app/payslip")(prisma);
	const transaction = require("./app/transaction")(prisma);
	const metric = require("./app/metric")(prisma);
	const category = require("./app/category")(prisma);
	const field = require("./app/field")(prisma);
	const itemType = require("./app/itemType")(prisma);
	const product = require("./app/product")(prisma);
	const demand = require("./app/demand")(prisma);
	const milestone = require("./app/milestone")(prisma);
	const usageCode = require("./app/usageCode")(prisma);
	const employee = require("./app/employee")(prisma);
	const workspace = require("./app/workspace")(prisma);
	const purchaseOrder = require("./app/purchaseOrder")(prisma);
	const deliveryOrder = require("./app/deliveryOrder")(prisma);
	const invoice = require("./app/invoice")(prisma);
	const paymentTerm = require("./app/paymentTerm")(prisma);
	const poType = require("./app/poType")(prisma);
	const paymentSchedule = require("./app/paymentSchedule")(prisma);
	const workspaceMember = require("./app/workspaceMember")(prisma);
	const projectMember = require("./app/projectMember")(prisma);
	const docs = require("./app/docs/docs");

	// 1. Request ID tracking (first middleware for all requests)
	app.use(requestIdMiddleware);

	// 2. Body parsing
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(cookieParser());

	// 3. Configure CORS
	app.use(
		cors({
			origin: config.cors.origins,
			credentials: config.cors.credentials,
		}),
	);

	// 4. Apply security middleware AFTER body parsing
	if (process.env.NODE_ENV === "production") {
		app.use(securityMiddleware);
		console.log("🔒 Production security middleware enabled");
	} else {
		app.use(devSecurityMiddleware);
		console.log("⚠ Development security middleware enabled (relaxed mode)");
	}

	// 5. XSS Sanitization (after body parsing and security)
	app.use(sanitizeInputs());

	// 6. Socket.io setup (before routes so it's available to all routes)
	const server = createServer(app);
	const io = new Server(server, {
		cors: {
			origin: config.cors.origins,
			credentials: config.cors.credentials,
		},
	});

	// Socket.io attachment
	app.use((req: Request, res: Response, next: NextFunction) => {
		(req as RequestWithIO).io = io;
		next();
	});

	// Health check endpoints
	app.get("/", (req: Request, res: Response) => {
		res.status(200).json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		});
	});

	app.get("/health", (req: Request, res: Response) => {
		res.status(200).json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			message: "SLA monitoring is active",
		});
	});

	// Redis health check endpoint (requires authentication for detailed info)
	app.get("/health/redis", verifyToken, async (req: Request, res: Response) => {
		try {
			const { redisClient } = await import("./config/redis");
			const start = Date.now();
			await redisClient.ping();
			const latency = Date.now() - start;

			// Only show detailed metrics to authenticated users
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
		} catch (error) {
			res.status(503).json({
				status: "unhealthy",
				redis: {
					connected: false,
				},
				timestamp: new Date().toISOString(),
			});
		}
	});

	// ========================================
	// PUBLIC ROUTES (No Authentication Required)
	// ========================================
	if (process.env.NODE_ENV !== "production") {
		app.use(`${config.baseApiPath}/swagger`, swaggerUi.serve, swaggerUi.setup(openApiSpecs()));
	}

	// Apply authentication-specific security middleware for auth routes
	app.use(`${config.baseApiPath}/auth`, authSecurityMiddleware);

	// Public routes (no authentication required)
	app.use(config.baseApiPath, template);
	app.use(config.baseApiPath, docs(prisma, app));

	// ========================================
	// APPLY AUTHENTICATION MIDDLEWARE
	// ========================================
	// verifyToken middleware contains PUBLIC_ROUTE_PATTERNS whitelist
	// Only whitelisted endpoints are accessible without authentication
	app.use(config.baseApiPath, (req: Request, res: Response, next: NextFunction) => {
		// Skip authentication for public routes
		const publicPaths = ["/docs", "/auth", "/template", "/swagger"];
		const isPublicPath = publicPaths.some((path) => req.path.startsWith(path));

		if (isPublicPath) {
			return next();
		}

		// Apply token verification for all other routes
		verifyToken(req, res, next);
	});

	// Test mode bypass (ONLY for development/testing)
	if (env.ENABLE_TEST_MODE === "true") {
		app.use(config.baseApiPath, (req: Request, res: Response, next: NextFunction) => {
			// Inject a mock authenticated user for testing
			(req as any).user = {
				id: "test-user-507f1f77bcf86cd799439011",
				email: "test@example.com",
				role: "admin",
			};
			next();
		});
		console.log("⚠️  TEST MODE ENABLED - Authentication bypassed for all requests");
	}

	// ========================================
	// PROTECTED ROUTES (Authentication Required)
	// ========================================
	// These routes have authentication middleware applied via verifyToken
	// Individual endpoints are whitelisted in PUBLIC_ROUTE_PATTERNS if they need public access
	app.use(config.baseApiPath, project);
	app.use(config.baseApiPath, estimation);
	app.use(config.baseApiPath, sequential);
	app.use(config.baseApiPath, item);
	app.use(config.baseApiPath, order);
	app.use(config.baseApiPath, vendor);
	app.use(config.baseApiPath, payslip);
	app.use(config.baseApiPath, transaction);
	app.use(`${config.baseApiPath}/metric`, metric);
	app.use(config.baseApiPath, category);
	app.use(config.baseApiPath, field);
	app.use(config.baseApiPath, itemType);
	app.use(config.baseApiPath, product);
	app.use(config.baseApiPath, demand);
	app.use(config.baseApiPath, milestone);
	app.use(config.baseApiPath, usageCode);
	app.use(config.baseApiPath, employee);
	app.use(config.baseApiPath, workspace);
	app.use(config.baseApiPath, purchaseOrder);
	app.use(config.baseApiPath, deliveryOrder);
	app.use(config.baseApiPath, invoice);
	app.use(config.baseApiPath, paymentTerm);
	app.use(config.baseApiPath, poType);
	app.use(config.baseApiPath, paymentSchedule);
	app.use(config.baseApiPath, workspaceMember);
	app.use(config.baseApiPath, projectMember);

	// 404 handler for unmatched routes
	app.use((req: Request, res: Response) => {
		res.status(404).json({
			success: false,
			message: `Route ${req.method} ${req.path} not found`,
			code: 404,
		});
	});

	// Global error handler for Express (must be after all routes)
	app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
		const isDev = process.env.NODE_ENV !== "production";

		// Handle known operational errors (AppError hierarchy)
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

		// Handle Prisma known errors
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

		// Unknown/programming errors - log full details
		console.error("Express error:", err.stack || err);

		res.status(500).json({
			status: "error",
			message: isDev ? err.message : "Internal server error",
			code: 500,
			...(isDev && { stack: err.stack }),
			timestamp: new Date().toISOString(),
		});
	});

	// Store app instance globally for docs generation after all routes are registered
	global.app = app;

	server.on("error", (err: NodeJS.ErrnoException) => {
		console.error("=== SERVER ERROR ===");
		if (err.code === "EADDRINUSE") {
			console.error(
				`Error: Port ${config.port} is already in use. Please use a different port.`,
			);
		} else {
			console.error("Error:", err.message);
		}
		console.error("Stack:", err.stack);
		console.error("===================");
		process.exit(1);
	});

	server.listen(config.port, async () => {
		try {
			await connectAllDatabases();
			console.log(`✅ Database connected`);

			initCronJobs(prisma);
			console.log(`✅ Cron jobs initialized`);

			console.log(`🚀 Server is running on port ${config.port}`);
		} catch (error) {
			console.error(
				"Failed to connect to database:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

	// Graceful shutdown
	const gracefulShutdown = async (signal: string) => {
		console.log(`Received ${signal}, shutting down gracefully...`);
		try {
			// Disconnect database
			await disconnectAllDatabases();
			console.log("✅ All database connections closed");

			server.close(() => {
				console.log("✅ Server closed");
				process.exit(0);
			});
		} catch (error) {
			console.error("Error during shutdown:", error);
			process.exit(1);
		}
	};

	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
} catch (error) {
	console.error("=== STARTUP ERROR ===");
	console.error("Error during app initialization:", error);
	console.error("Stack:", error instanceof Error ? error.stack : "");
	console.error("====================");
	process.exit(1);
}
