/**
 * Cache Helper
 * Utility functions for cache operations
 */

import { invalidateCache } from "../middleware/cache";
import { redisClient } from "../config/redis";
import { createLogger } from "./logger";
import type { Logger } from "winston";

const cacheLogger = createLogger("cache-helper");

/**
 * Get data from cache or fetch from source, caching the result.
 * Replaces the manual Redis cache pattern used across controllers.
 *
 * @example
 * const purchaseOrder = await getOrFetch(
 *   `cache:purchaseOrder:byId:${id}:${fields || "full"}`,
 *   () => repository.getById(query),
 * );
 */
export async function getOrFetch<T>(
	key: string,
	fetchFn: () => Promise<T>,
	ttl: number = 3600,
): Promise<T> {
	try {
		if (redisClient.isClientConnected()) {
			const cached = await redisClient.getJSON<T>(key);
			if (cached !== null) return cached;
		}
	} catch (err) {
		cacheLogger.warn(`Cache read failed for key ${key}:`, err);
	}

	const data = await fetchFn();

	try {
		if (data && redisClient.isClientConnected()) {
			await redisClient.setJSON(key, data, ttl);
		}
	} catch (err) {
		cacheLogger.warn(`Cache write failed for key ${key}:`, err);
	}

	return data;
}

/**
 * Invalidate cache for an entity with standard error handling
 *
 * @param entityName - The entity name (e.g., "project", "category")
 * @param logger - The logger instance for this module
 * @param id - Optional entity ID for specific cache invalidation
 * @param additionalPatterns - Additional cache patterns to invalidate
 *
 * @example
 * // Invalidate list cache only (for create)
 * await invalidateEntityCache("project", projectLogger);
 *
 * // Invalidate both list and specific entity cache (for update/delete)
 * await invalidateEntityCache("project", projectLogger, projectId);
 *
 * // With additional patterns
 * await invalidateEntityCache("project", projectLogger, projectId, ["cache:estimation:*"]);
 */
export const invalidateEntityCache = async (
	entityName: string,
	logger: Logger,
	id?: string,
	additionalPatterns?: string[],
): Promise<void> => {
	try {
		// Always invalidate list cache
		await invalidateCache.byPattern(`cache:${entityName}:list:*`);

		// Invalidate specific entity cache if ID provided
		if (id) {
			await invalidateCache.byPattern(`cache:${entityName}:byId:${id}:*`);
			// Also try alternate pattern
			await invalidateCache.byPattern(`cache:${entityName}:${id}:*`);
		}

		// Invalidate additional patterns if provided
		if (additionalPatterns && additionalPatterns.length > 0) {
			for (const pattern of additionalPatterns) {
				await invalidateCache.byPattern(pattern);
			}
		}

		logger.info(
			`Cache invalidated for ${entityName}${id ? ` (id: ${id})` : ""}${
				additionalPatterns ? ` + ${additionalPatterns.length} additional patterns` : ""
			}`,
		);
	} catch (cacheError) {
		logger.warn(`Failed to invalidate cache for ${entityName}:`, cacheError);
	}
};

/**
 * Common cache patterns for different operations
 */
export const CachePatterns: Record<string, { onDelete: string[] }> = {
	project: {
		onDelete: ["cache:estimation:*", "cache:item:*", "cache:order:*", "cache:payslip:*"],
	},
	estimation: {
		onDelete: ["cache:item:*"],
	},
	item: {
		onDelete: ["cache:order:*", "cache:payslip:*"],
	},
};
