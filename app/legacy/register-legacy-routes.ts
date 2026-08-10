import type { Application, Router } from "express";
import type { PrismaClient } from "../../generated/prisma";

export interface LegacyRouteRegistration {
	path: string;
	load: (prisma: PrismaClient) => Router;
}

/**
 * Mounts compatibility routes only when the caller explicitly opts in.
 * The registration list is intentionally supplied by the application
 * composition layer so this boundary cannot silently discover new routes.
 */
export function registerLegacyRoutes(
	app: Application,
	prisma: PrismaClient,
	registrations: readonly LegacyRouteRegistration[],
): void {
	for (const registration of registrations) {
		app.use(registration.path, registration.load(prisma));
	}
}
