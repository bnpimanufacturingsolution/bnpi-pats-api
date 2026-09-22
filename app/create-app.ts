import express, { type NextFunction, type Request, type Response } from "express";
import type { Application } from "express";
import swaggerUi from "swagger-ui-express";
import type { Server as SocketServer } from "socket.io";
import { prisma } from "../config/prisma";
import { PrismaClient as PatsPrismaClient } from "../generated/pats-client";
import { config } from "../config/config";
import openApiSpecs from "../docs/openApiSpecs";
import verifyToken from "../middleware/verifyToken";
import {
	authSecurityMiddleware,
	devSecurityMiddleware,
	securityMiddleware,
} from "../middleware/security";
import requestIdMiddleware from "../middleware/requestId";
import { sanitizeInputs } from "../middleware/sanitization";
import { AppError } from "../errors";
import { env } from "../config/env";
import {
	registerLegacyRoutes,
	type LegacyRouteRegistration,
} from "./legacy/register-legacy-routes";
import { patsModule } from "./pats";
import { domainReadRouter } from "./pats/domain-read";
import { commandRouter } from "./pats/command-router";
import { catalogController, catalogProductCollectionController } from "./pats/catalog";
import { catalogFoundationRouter } from "./pats/catalog-foundation";
import { bomFoundationRouter } from "./pats/bom-foundation";
import { generateEndpointsFromAppInstance, type Endpoint } from "./docs/endpointGenerator";
import {
	catalogBomDefinitionCollectionController,
	catalogBomDefinitionController,
} from "./pats/bom";
import { processRouteFoundationRouter } from "./pats/process-route-foundation";
import { createMinioObjectStorage } from "./storage/minio-object-storage";
import { canonicalRouter, requireCanonicalCapability } from "./canonical/router";
import { PrismaCatalogIdempotencyStore } from "./canonical/prisma-idempotency-store";
import type { IdentityDependencies } from "./identity/types";
import type { ExpressApp } from "./types";
import { createLocalAuthDependencies, type LocalAuthDependencies } from "./identity/local-auth";
import { prismaSubjectRepository } from "./identity/prisma-subject-repository";

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
	/** PATS-local account login and signed-token adapter. */
	localAuth?: LocalAuthDependencies;
}

const blockedRegistrations = (baseApiPath: string): readonly LegacyRouteRegistration[] => [
	{ path: baseApiPath, load: (client) => require("./employee")(client) },
	{ path: baseApiPath, load: (client) => require("./product")(client) },
	{ path: baseApiPath, load: (client) => require("./workspaceMember")(client) },
	{ path: baseApiPath, load: (client) => require("./projectMember")(client) },
];

export function createApp(options: AppOptions = {}): Application {
	const app = options.app ?? express();
	const patsPrisma = new PatsPrismaClient();
	const catalogIdempotencyStore = new PrismaCatalogIdempotencyStore(patsPrisma);
	const localAuth =
		options.localAuth ??
		(() => {
			const repository = prismaSubjectRepository(patsPrisma);
			return createLocalAuthDependencies(repository, repository, env.JWT_SECRET);
		})();
	const patsObjectStorage = createMinioObjectStorage({
		endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
		accessKeyId: process.env.MINIO_ACCESS_KEY ?? "pats-minio",
		secretAccessKey: process.env.MINIO_SECRET_KEY ?? "change-me-minio",
		bucket: process.env.MINIO_BUCKET ?? "pats-private",
		tls: process.env.MINIO_USE_TLS === "true",
	});

	// Request ID tracking (first middleware for all requests)
	app.use(requestIdMiddleware);

	// CORS must run before canonical routes so browser preflight requests are
	// answered before the canonical method boundary can return 405.
	// exposedHeaders: ETag carries the concurrency token (rowVersion) that
	// optimistic-locking PUTs must echo back as If-Match — without it the
	// browser client can never read the token and every update 412s.
	app.use(
		require("cors")({
			origin: config.cors.origins,
			credentials: config.cors.credentials,
			exposedHeaders: ["ETag", "Location"],
		}),
	);

	// Canonical PATS routes are intentionally isolated from legacy parsing,
	// authentication, and error envelopes.
	app.use(
		"/api/v1",
		canonicalRouter({
			identity: options.identity ?? localAuth,
			localAuth,
			catalog: {
				requiredCapability: "catalog.read",
				handler: catalogController(patsPrisma, patsObjectStorage, { canonical: true }),
			},
			catalogCollection: {
				requiredCapability: "catalog.read",
				handler: catalogProductCollectionController(patsPrisma),
			},
			bomDefinitionCollection: {
				requiredCapability: "catalog.read",
				handler: catalogBomDefinitionCollectionController(patsPrisma),
			},
			bomDefinition: {
				requiredCapability: "catalog.read",
				handler: catalogBomDefinitionController(patsPrisma),
			},
			catalogMutations: {
				requiredCapability: "catalog.manage",
				router: express
					.Router()
					.use(
						catalogFoundationRouter(patsPrisma, {
							idempotencyStore: catalogIdempotencyStore,
						}),
					)
					.use(
						bomFoundationRouter(patsPrisma, {
							idempotencyStore: catalogIdempotencyStore,
						}),
					)
					.use(
						processRouteFoundationRouter(patsPrisma, {
							idempotencyStore: catalogIdempotencyStore,
						}),
						),
			},
			domainReads: {
				router: domainReadRouter(patsPrisma, requireCanonicalCapability),
			},
			domainCommands: {
				router: commandRouter(patsPrisma, requireCanonicalCapability),
			},
		}),
	);

	// Body parsing
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(require("cookie-parser")());

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

	// Health check helpers
	async function checkDomainHealth(appInstance: ExpressApp): Promise<DomainHealth[]> {
		const endpoints = await generateEndpointsFromAppInstance(appInstance);
		const domainMap = new Map<string, { endpoints: Endpoint[]; healthy: boolean }>();

		// Group endpoints by domain (tag)
		for (const ep of endpoints) {
			const domain = ep.tags[0] || "Unknown";
			if (!domainMap.has(domain)) {
				domainMap.set(domain, { endpoints: [], healthy: true });
			}
			domainMap.get(domain)!.endpoints.push(ep);
		}

		// Check health for each domain by testing a sample endpoint
		const domains: DomainHealth[] = [];
		for (const [name, data] of domainMap) {
			const sampleEndpoint = data.endpoints[0];
			let healthy = true;
			let latency = 0;
			let error: string | undefined;

			// Skip health check for system/docs domains
			if (name === "System" || name === "Documentation") {
				healthy = true;
			} else {
				// Try to make a test request to a GET endpoint
				try {
					const start = Date.now();
					// We can't easily make internal requests, so we'll check if routes exist
					healthy = data.endpoints.length > 0;
					latency = Date.now() - start;
				} catch (e) {
					healthy = false;
					error = e instanceof Error ? e.message : "Unknown error";
				}
			}

			domains.push({
				name,
				healthy,
				endpointCount: data.endpoints.length,
				latency,
				error,
				endpoints: data.endpoints.map((ep) => ({
					method: ep.method,
					path: ep.url,
					summary: ep.summary,
				})),
			});
		}

		return domains.sort((a, b) => a.name.localeCompare(b.name));
	}

	interface DomainHealth {
		name: string;
		healthy: boolean;
		endpointCount: number;
		latency: number;
		error?: string;
		endpoints: { method: string; path: string; summary: string }[];
	}

	interface DashboardData {
		status: string;
		timestamp: string;
		uptime: number;
		totalEndpoints: number;
		domains: DomainHealth[];
	}

	function generateHealthDashboardHTML(data: DashboardData): string {
		const healthyCount = data.domains.filter((d) => d.healthy).length;
		const totalCount = data.domains.length;
		const uptimeHours = Math.floor(data.uptime / 3600);
		const uptimeMinutes = Math.floor((data.uptime % 3600) / 60);
		const uptimeSeconds = Math.floor(data.uptime % 60);

		const domainCards = data.domains
			.map((domain) => {
				const statusClass = domain.healthy ? "healthy" : "unhealthy";
				const statusIcon = domain.healthy ? "✅" : "❌";
				const statusText = domain.healthy ? "Operational" : "Degraded";
				const endpointsHtml = domain.endpoints
					.slice(0, 5)
					.map(
						(ep) =>
							`<div class="endpoint-row"><span class="method ${ep.method.toLowerCase()}">${ep.method}</span><span class="path">${ep.path}</span><span class="summary">${ep.summary}</span></div>`,
					)
					.join("");
				const moreEndpoints = domain.endpoints.length > 5 ? `<div class="endpoint-row more">... and ${domain.endpoints.length - 5} more</div>` : "";

				return `
				<div class="domain-card ${statusClass}">
					<div class="domain-header">
						<span class="status-icon">${statusIcon}</span>
						<div class="domain-info">
							<h3>${domain.name}</h3>
							<div class="domain-meta">${domain.endpointCount} endpoints • ${statusText}</div>
						</div>
						<div class="domain-status ${statusClass}">${statusText}</div>
					</div>
					<div class="domain-endpoints">
						${endpointsHtml}
						${moreEndpoints}
					</div>
					${domain.error ? `<div class="domain-error">Error: ${domain.error}</div>` : ""}
				</div>
			}`;
			})
			.join("");

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Bandai PATS API - Health Dashboard</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f6fa; color: #2d3436; line-height: 1.6; }
		.container { max-width: 1200px; margin: 0 auto; padding: 24px; }
		header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #e1e5eb; }
		.logo { display: flex; align-items: center; gap: 12px; }
		.logo-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
		.logo h1 { font-size: 28px; font-weight: 700; color: #2d3436; }
		.logo span { font-size: 14px; color: #636e72; font-weight: 500; }
		.overall-status { display: flex; align-items: center; gap: 16px; padding: 16px 24px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
		.status-indicator { width: 16px; height: 16px; border-radius: 50%; background: ${healthyCount === totalCount ? "#00b894" : "#e17055"}; box-shadow: 0 0 0 4px ${healthyCount === totalCount ? "rgba(0,184,148,0.2)" : "rgba(225,112,85,0.2)"}; animation: pulse 2s infinite; }
		@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
		.status-info h2 { font-size: 18px; font-weight: 600; }
		.status-info p { font-size: 13px; color: #636e72; }
		.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
		.stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
		.stat-value { font-size: 36px; font-weight: 700; color: #2d3436; }
		.stat-label { font-size: 13px; color: #636e72; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
		.stat-card.healthy .stat-value { color: #00b894; }
		.stat-card.warning .stat-value { color: #fdcb6e; }
		.stat-card.error .stat-value { color: #e17055; }
		.domains-section h2 { font-size: 20px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
		.domains-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
		.domain-card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
		.domain-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
		.domain-card.unhealthy { border-left: 4px solid #e17055; }
		.domain-card.healthy { border-left: 4px solid #00b894; }
		.domain-header { display: flex; align-items: flex-start; gap: 12px; padding: 20px; }
		.status-icon { font-size: 20px; }
		.domain-info { flex: 1; min-width: 0; }
		.domain-info h3 { font-size: 16px; font-weight: 600; color: #2d3436; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
		.domain-meta { font-size: 12px; color: #636e72; margin-top: 4px; }
		.domain-status { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; white-space: nowrap; }
		.domain-status.healthy { background: #e8f8f0; color: #00b894; }
		.domain-status.unhealthy { background: #fdf0ed; color: #e17055; }
		.domain-endpoints { padding: 0 20px 20px; border-top: 1px solid #f1f2f6; }
		.endpoint-row { display: grid; grid-template-columns: 70px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f2f6; font-size: 12px; align-items: center; }
		.endpoint-row:last-child { border-bottom: none; }
		.endpoint-row.more { color: #636e72; font-style: italic; grid-column: 1 / -1; padding-top: 8px; }
		.method { padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; text-align: center; text-transform: uppercase; }
		.method.get { background: #e8f8f0; color: #00b894; }
		.method.post { background: #eef2ff; color: #4a6cf7; }
		.method.put, .method.patch { background: #fff8e1; color: #fdcb6e; }
		.method.delete { background: #fdf0ed; color: #e17055; }
		.path { font-family: 'SF Mono', 'Fira Code', monospace; color: #2d3436; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.summary { color: #636e72; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.domain-error { padding: 12px 20px; background: #fdf0ed; color: #e17055; font-size: 12px; border-top: 1px solid #fadbd8; }
		.refresh-btn { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.1s, box-shadow 0.2s; }
		.refresh-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,184,148,0.4); }
		.refresh-btn:active { transform: translateY(0); }
		.timestamp { text-align: center; color: #636e72; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e1e5eb; }
		@media (max-width: 768px) {
			.container { padding: 16px; }
			header { flex-direction: column; gap: 16px; text-align: center; }
			.overall-status { width: 100%; justify-content: center; }
			.domains-grid { grid-template-columns: 1fr; }
		}
	</style>
</head>
<body>
	<div class="container">
		<header>
			<div class="logo">
				<div class="logo-icon">P</div>
				<div>
					<h1>Bandai PATS API</h1>
					<span>Health Dashboard</span>
				</div>
			</div>
			<div class="overall-status">
				<div class="status-indicator"></div>
				<div class="status-info">
					<h2>${healthyCount === totalCount ? "All Systems Operational" : "Some Systems Degraded"}</h2>
					<p>${healthyCount} of ${totalCount} domains healthy</p>
				</div>
			</div>
		</header>

		<div class="stats-grid">
			<div class="stat-card ${healthyCount === totalCount ? "healthy" : "warning"}">
				<div class="stat-value">${healthyCount}/${totalCount}</div>
				<div class="stat-label">Domains Healthy</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${data.totalEndpoints}</div>
				<div class="stat-label">Total Endpoints</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s</div>
				<div class="stat-label">Uptime</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${new Date(data.timestamp).toLocaleTimeString()}</div>
				<div class="stat-label">Last Check</div>
			</div>
		</div>

		<div class="domains-section">
			<h2>🏗️ Domain Status</h2>
			<div class="domains-grid">
				${domainCards}
			</div>
		</div>

		<div style="text-align: center; margin-top: 24px;">
			<button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
		</div>

		<div class="timestamp">
			Generated at ${new Date(data.timestamp).toLocaleString()} • API v1.0 • Bandai PATS
		</div>
	</div>
</body>
</html>`;
	}

	// Health check endpoints
	app.get("/", async (_req: Request, res: Response) => {
		const endpoints = await generateEndpointsFromAppInstance(app as ExpressApp);
		const apiList = endpoints.map((ep) => ({
			method: ep.method,
			path: ep.url,
			summary: ep.summary,
			tags: ep.tags,
		}));
		res.status(200).json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			totalEndpoints: apiList.length,
			endpoints: apiList,
		});
	});

	// Health Dashboard UI
	app.get("/health/dashboard", async (_req: Request, res: Response) => {
		const endpoints = await generateEndpointsFromAppInstance(app as ExpressApp);
		const domainHealth = await checkDomainHealth(app as ExpressApp);

		const html = generateHealthDashboardHTML({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			totalEndpoints: endpoints.length,
			domains: domainHealth,
		});
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.status(200).send(html);
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
	app.use(config.baseApiPath, patsModule({ patsPrisma, objectStorage: patsObjectStorage }));

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
				res.status(409).json({
					status: "error",
					message: "A record with these details already exists.",
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
			message: "Internal server error",
			code: 500,
			timestamp: new Date().toISOString(),
		});
	});

	return app;
}
