import { PrismaClient } from "../../generated/prisma";

/**
 * MongoDB Aggregation Pipeline Stage
 */
export type PipelineStage =
	| { $match: Record<string, unknown> }
	| { $group: Record<string, unknown> }
	| { $sort: Record<string, number> }
	| { $limit: number }
	| { $skip: number }
	| { $project: Record<string, number | boolean> }
	| { $lookup: Record<string, unknown> }
	| { $unwind: string | Record<string, unknown> }
	| { $addFields: Record<string, unknown> }
	| { $count: string }
	| Record<string, unknown>;

/**
 * Prisma Model Name (dynamic model access)
 */
export type PrismaModelName = keyof Omit<
	PrismaClient,
	| "$connect"
	| "$disconnect"
	| "$on"
	| "$transaction"
	| "$use"
	| "$extends"
	| "$executeRaw"
	| "$executeRawUnsafe"
	| "$queryRaw"
	| "$queryRawUnsafe"
>;

/**
 * Prisma Model Delegate (for dynamic model access)
 */
export interface PrismaModelDelegate {
	aggregateRaw: (options: { pipeline: PipelineStage[] }) => Promise<unknown>;
	findRaw?: (options: { filter?: Record<string, unknown> }) => Promise<unknown>;
	[key: string]: unknown;
}

/**
 * Extended Prisma Client with dynamic model access
 */
export type ExtendedPrismaClient = PrismaClient & {
	[K in PrismaModelName]: PrismaModelDelegate;
};
