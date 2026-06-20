import { PrismaClient } from "../generated/prisma";

export interface MetricFilter {
	useFilter?: Record<string, unknown>;
	startDate?: string | Date;
	endDate?: string | Date;
	year?: number;
}

export interface MetricConfig {
	model: string;
	data: string[];
	operations: {
		[key: string]: {
			type: "count" | "sum" | "avg" | "groupBy" | "custom";
			field?: string;
			groupBy?: string;
			dateField?: string;
			customQuery?: (prisma: PrismaClient, filter: MetricFilter) => Promise<unknown>;
		};
	};
}

// Helper function to build where clause with date filtering
export function buildWhereClause(filter: MetricFilter, dateField?: string, model?: string): Record<string, unknown> {
	let whereClause: Record<string, unknown> = {
		...filter.useFilter,
	};

	// Only add isDeleted filter for models that have this field
	if (model === "user") {
		whereClause.isDeleted = false;
	}

	if (dateField && (filter.startDate || filter.endDate)) {
		const dateFilter: Record<string, Date> = {};
		if (filter.startDate) {
			dateFilter.gte = new Date(filter.startDate);
		}
		if (filter.endDate) {
			dateFilter.lte = new Date(filter.endDate);
		}

		// Handle nested date fields like 'user.createdAt'
		if (dateField.includes(".")) {
			const [parent, field] = dateField.split(".");
			whereClause[parent] = {
				[field]: dateFilter,
			};
		} else {
			whereClause[dateField] = dateFilter;
		}
	}

	return whereClause;
}

// Helper function to execute metric operations
export async function executeMetricOperation(
	prisma: PrismaClient,
	model: string,
	operation: string,
	config: MetricConfig,
	filter: MetricFilter,
): Promise<unknown> {
	const op = config.operations[operation];
	if (!op) {
		throw new Error(`Operation ${operation} not found for model ${model}`);
	}

	// Get the Prisma model
	const prismaModel = (prisma as unknown as Record<string, unknown>)[model.toLowerCase()];
	if (!prismaModel) {
		throw new Error(`Model ${model} not found in Prisma client`);
	}

	switch (op.type) {
		case "count":
			const countWhere = buildWhereClause(filter, op.dateField, model);
			if (operation === "activeUsers") {
				countWhere.status = "active";
			}
			return await (prismaModel as { count: (args: unknown) => Promise<number> }).count({ where: countWhere });

		case "groupBy":
			const groupWhere = buildWhereClause(filter, op.dateField, model);

			if (op.groupBy === "year" && op.dateField) {
				// For year grouping, we need custom logic
				const dateField = op.dateField as string;
				const results = await (prismaModel as { findMany: (args: unknown) => Promise<unknown[]> }).findMany({
					where: groupWhere,
					select: { [dateField]: true },
				});

				const grouped = (results as unknown[]).reduce((acc: Record<string, number>, item: unknown) => {
					const itemRecord = item as Record<string, unknown>;
					const date = itemRecord[dateField];
					if (date instanceof Date) {
						const year = date.getFullYear().toString();
						acc[year] = (acc[year] || 0) + 1;
					}
					return acc;
				}, {});

				return Object.entries(grouped).map(([year, count]) => ({ year, _count: count }));
			}

			if (op.groupBy === "month" && op.dateField) {
				// For month grouping, we need custom logic
				const dateField = op.dateField as string;
				const results = await (prismaModel as { findMany: (args: unknown) => Promise<unknown[]> }).findMany({
					where: groupWhere,
					select: { [dateField]: true },
				});

				const grouped = (results as unknown[]).reduce((acc: Record<string, number>, item: unknown) => {
					const itemRecord = item as Record<string, unknown>;
					const date = itemRecord[dateField];
					if (date instanceof Date) {
						const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
						acc[month] = (acc[month] || 0) + 1;
					}
					return acc;
				}, {});

				return Object.entries(grouped).map(([month, count]) => ({ month, _count: count }));
			}

			// Regular groupBy operation
			return await (prismaModel as { groupBy: (args: unknown) => Promise<unknown> }).groupBy({
				by: [op.groupBy],
				where: groupWhere,
				_count: { id: true },
			});

		case "custom":
			if (op.customQuery) {
				return await op.customQuery(prisma, filter);
			}
			throw new Error(`Custom query not implemented for operation ${operation}`);

		default:
			throw new Error(`Operation type ${op.type} not supported`);
	}
}
