// Set max listeners BEFORE startup work to prevent repeated process warnings.
process.setMaxListeners(50);

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { prisma } from "./config/prisma";
import { config } from "./config/config";
import { connectAllDatabases, disconnectAllDatabases } from "./config/database";
import { initCronJobs } from "./cron";
import { env } from "./config/env";
import { createApp } from "./app/create-app";

declare global {
	var app: express.Application | undefined;
	var __errorHandlersRegistered: boolean | undefined;
}

// Register process handlers once so test imports and hot reload do not stack
// duplicate listeners.
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

try {
	// index.ts owns the listener lifecycle. createApp owns only Express
	// middleware and route composition so tests can instantiate it safely.
	const rawApp = express();
	const server = createServer(rawApp);
	const io = new Server(server, {
		cors: {
			origin: config.cors.origins,
			credentials: config.cors.credentials,
		},
	});

	const app = createApp({
		app: rawApp,
		io,
		enableLegacyRoutes: env.ENABLE_LEGACY_API === "true",
	});
	global.app = app;

	server.on("error", (err: NodeJS.ErrnoException) => {
		console.error("=== SERVER ERROR ===");
		if (err.code === "EADDRINUSE") {
			console.error(`Error: Port ${config.port} is already in use. Please use a different port.`);
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
			console.log("✅ Database connected");

			initCronJobs(prisma);
			console.log("✅ Cron jobs initialized");

			console.log(`🚀 Server is running on port ${config.port}`);
		} catch (error) {
			console.error(
				"Failed to connect to database:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

	const gracefulShutdown = async (signal: string) => {
		console.log(`Received ${signal}, shutting down gracefully...`);
		try {
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
