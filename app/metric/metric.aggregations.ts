/**
 * MongoDB Raw Aggregation Pipelines for Metrics
 * Uses native MongoDB aggregation for optimal performance
 */

import { PrismaClient, Prisma } from "../../generated/prisma";
import type { MetricFilters } from "./metric.types";

// Helper type for raw command result
type RawCommandResult<T> = { cursor: { firstBatch: T[] } };

// ============================================================================
// TYPES
// ============================================================================

interface DashboardMetrics {
	totalProjects: number;
	activeProjects: number;
	completedProjects: number;
	pendingProjects: number;
	onHoldProjects: number;
	totalCapital: number;
	totalActualExpenses: number;
}

interface TransactionMetrics {
	totalIncoming: number;
	totalOutgoing: number;
	clearedIncoming: number;
	clearedOutgoing: number;
	pendingIncoming: number;
	pendingOutgoing: number;
	netBalance: number;
}

interface ItemMetrics {
	totalItems: number;
	completedItems: number;
	inProgressItems: number;
	pendingItems: number;
	totalEstimated: number;
	totalActual: number;
	capexTotal: number;
	opexTotal: number;
}

interface FinancialTrendData {
	_id: { year: number; month: number };
	revenue: number;
	expenses: number;
}

interface ProjectAnalysisData {
	_id: string;
	code: string;
	name: string;
	status: string;
	totalSales: number;
	totalCost: number;
	collected: number;
}

// ============================================================================
// HELPER: Build match stage from filters
// ============================================================================

const buildMatchStage = (filters: MetricFilters, dateField = "createdAt") => {
	const match: Record<string, unknown> = { isDeleted: { $ne: true } };

	if (filters.workspaceId) {
		match.workspaceId = { $oid: filters.workspaceId };
	}
	if (filters.projectId) {
		match._id = { $oid: filters.projectId };
	}
	if (filters.startDate || filters.endDate) {
		const dateFilter: Record<string, Date> = {};
		if (filters.startDate) dateFilter.$gte = new Date(filters.startDate);
		if (filters.endDate) dateFilter.$lte = new Date(filters.endDate);
		match[dateField] = dateFilter;
	}

	return { $match: match };
};

// ============================================================================
// AGGREGATION FACTORY
// ============================================================================

export const createMetricAggregations = (prisma: PrismaClient) => {
	/**
	 * Get all project dashboard metrics in a single aggregation
	 * Replaces 9 separate queries with 1
	 */
	const getProjectDashboardMetrics = async (
		filters: MetricFilters = {}
	): Promise<DashboardMetrics> => {
		const pipeline = [
			{
				$match: {
					isDeleted: { $ne: true },
					...(filters.workspaceId && { workspaceId: { $oid: filters.workspaceId } }),
				},
			},
			{
				$group: {
					_id: null,
					totalProjects: { $sum: 1 },
					activeProjects: {
						$sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
					},
					completedProjects: {
						$sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
					},
					pendingProjects: {
						$sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
					},
					onHoldProjects: {
						$sum: { $cond: [{ $eq: ["$status", "ON_HOLD"] }, 1, 0] },
					},
					totalCapital: { $sum: { $ifNull: ["$capital", 0] } },
					totalActualExpenses: { $sum: { $ifNull: ["$actualExpenses", 0] } },
				},
			},
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Project",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<DashboardMetrics>;

		const data = result.cursor?.firstBatch?.[0];
		return {
			totalProjects: data?.totalProjects ?? 0,
			activeProjects: data?.activeProjects ?? 0,
			completedProjects: data?.completedProjects ?? 0,
			pendingProjects: data?.pendingProjects ?? 0,
			onHoldProjects: data?.onHoldProjects ?? 0,
			totalCapital: data?.totalCapital ?? 0,
			totalActualExpenses: data?.totalActualExpenses ?? 0,
		};
	};

	/**
	 * Get all transaction metrics in a single aggregation
	 * Replaces multiple queries with 1
	 */
	const getTransactionMetrics = async (
		filters: MetricFilters = {}
	): Promise<TransactionMetrics> => {
		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}
		if (filters.projectId) {
			matchStage.projectId = { $oid: filters.projectId };
		}
		if (filters.startDate || filters.endDate) {
			const dateFilter: Record<string, Date> = {};
			if (filters.startDate) dateFilter.$gte = new Date(filters.startDate);
			if (filters.endDate) dateFilter.$lte = new Date(filters.endDate);
			matchStage.transactionDate = dateFilter;
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$group: {
					_id: null,
					totalIncoming: {
						$sum: {
							$cond: [{ $eq: ["$transactionType", "INCOMING"] }, "$amount", 0],
						},
					},
					totalOutgoing: {
						$sum: {
							$cond: [{ $eq: ["$transactionType", "OUTGOING"] }, "$amount", 0],
						},
					},
					clearedIncoming: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$transactionType", "INCOMING"] },
										{ $eq: ["$status", "CLEARED"] },
									],
								},
								"$amount",
								0,
							],
						},
					},
					clearedOutgoing: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$transactionType", "OUTGOING"] },
										{ $eq: ["$status", "CLEARED"] },
									],
								},
								"$amount",
								0,
							],
						},
					},
					pendingIncoming: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$transactionType", "INCOMING"] },
										{ $eq: ["$status", "PENDING"] },
									],
								},
								"$amount",
								0,
							],
						},
					},
					pendingOutgoing: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$transactionType", "OUTGOING"] },
										{ $eq: ["$status", "PENDING"] },
									],
								},
								"$amount",
								0,
							],
						},
					},
				},
			},
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Transaction",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<TransactionMetrics>;

		const data = result.cursor?.firstBatch?.[0];
		const totalIncoming = data?.totalIncoming ?? 0;
		const totalOutgoing = data?.totalOutgoing ?? 0;

		return {
			totalIncoming,
			totalOutgoing,
			clearedIncoming: data?.clearedIncoming ?? 0,
			clearedOutgoing: data?.clearedOutgoing ?? 0,
			pendingIncoming: data?.pendingIncoming ?? 0,
			pendingOutgoing: data?.pendingOutgoing ?? 0,
			netBalance: totalIncoming - totalOutgoing,
		};
	};

	/**
	 * Get item metrics with type breakdown in a single aggregation
	 */
	const getItemMetrics = async (filters: MetricFilters = {}): Promise<ItemMetrics> => {
		// First get itemType IDs for CAPEX and OPEX
		const itemTypes = await prisma.itemType.findMany({
			where: { isDeleted: false },
			select: { id: true, name: true },
		});

		const capexTypeIds = itemTypes
			.filter((t) => t.name.toUpperCase() === "CAPEX")
			.map((t) => ({ $oid: t.id }));
		const opexTypeIds = itemTypes
			.filter((t) => t.name.toUpperCase() === "OPEX")
			.map((t) => ({ $oid: t.id }));

		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$group: {
					_id: null,
					totalItems: { $sum: 1 },
					completedItems: {
						$sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
					},
					inProgressItems: {
						$sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] },
					},
					pendingItems: {
						$sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
					},
					totalEstimated: { $sum: { $ifNull: ["$estimatedTotal", 0] } },
					totalActual: { $sum: { $ifNull: ["$actualTotal", 0] } },
					capexTotal: {
						$sum: {
							$cond: [
								{ $in: ["$itemTypeId", capexTypeIds] },
								{ $ifNull: ["$actualTotal", "$estimatedTotal"] },
								0,
							],
						},
					},
					opexTotal: {
						$sum: {
							$cond: [
								{ $in: ["$itemTypeId", opexTypeIds] },
								{ $ifNull: ["$actualTotal", "$estimatedTotal"] },
								0,
							],
						},
					},
				},
			},
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Item",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<ItemMetrics>;

		const data = result.cursor?.firstBatch?.[0];
		return {
			totalItems: data?.totalItems ?? 0,
			completedItems: data?.completedItems ?? 0,
			inProgressItems: data?.inProgressItems ?? 0,
			pendingItems: data?.pendingItems ?? 0,
			totalEstimated: data?.totalEstimated ?? 0,
			totalActual: data?.totalActual ?? 0,
			capexTotal: data?.capexTotal ?? 0,
			opexTotal: data?.opexTotal ?? 0,
		};
	};

	/**
	 * Get financial trends grouped by month in a single aggregation
	 * Replaces N*2 queries with 1
	 */
	const getFinancialTrendsByMonth = async (
		filters: MetricFilters = {},
		months = 12
	): Promise<Array<{ month: string; revenue: number; costs: number; profit: number }>> => {
		const now = new Date();
		const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
			transactionDate: { $gte: startDate },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}
		if (filters.projectId) {
			matchStage.projectId = { $oid: filters.projectId };
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$group: {
					_id: {
						year: { $year: "$transactionDate" },
						month: { $month: "$transactionDate" },
					},
					revenue: {
						$sum: {
							$cond: [{ $eq: ["$transactionType", "INCOMING"] }, "$amount", 0],
						},
					},
					expenses: {
						$sum: {
							$cond: [{ $eq: ["$transactionType", "OUTGOING"] }, "$amount", 0],
						},
					},
				},
			},
			{ $sort: { "_id.year": 1, "_id.month": 1 } },
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Transaction",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<FinancialTrendData>;

		const data = result.cursor?.firstBatch ?? [];

		// Build a map of results
		const dataMap = new Map<string, { revenue: number; expenses: number }>();
		for (const item of data) {
			const key = `${item._id.year}-${item._id.month}`;
			dataMap.set(key, { revenue: item.revenue, expenses: item.expenses });
		}

		// Build complete month array
		const trends: Array<{ month: string; revenue: number; costs: number; profit: number }> = [];
		for (let i = months - 1; i >= 0; i--) {
			const date = new Date();
			date.setMonth(date.getMonth() - i);
			const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
			const monthData = dataMap.get(key) || { revenue: 0, expenses: 0 };

			trends.push({
				month: date.toLocaleDateString("en-US", { month: "short" }),
				revenue: monthData.revenue,
				costs: monthData.expenses,
				profit: monthData.revenue - monthData.expenses,
			});
		}

		return trends;
	};

	/**
	 * Aggregate JSON metaData.financial fields from projects
	 */
	const aggregateProjectFinancialFromMetadata = async (
		filters: MetricFilters = {},
		field: "totalSales" | "totalCost"
	): Promise<number> => {
		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}
		if (filters.projectId) {
			matchStage._id = { $oid: filters.projectId };
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$group: {
					_id: null,
					total: {
						$sum: { $ifNull: [`$metaData.financial.${field}`, 0] },
					},
				},
			},
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Project",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<{ total: number }>;

		return result.cursor?.firstBatch?.[0]?.total ?? 0;
	};

	/**
	 * Aggregate JSON metaData fields from estimations
	 */
	const aggregateEstimationFromMetadata = async (
		filters: MetricFilters = {},
		field: "estimatedCost" | "actualCost" | "projectedWithMargin"
	): Promise<number> => {
		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}
		if (filters.projectId) {
			matchStage.projectId = { $oid: filters.projectId };
		}
		if (filters.estimationId) {
			matchStage._id = { $oid: filters.estimationId };
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$group: {
					_id: null,
					total: {
						$sum: { $ifNull: [`$metaData.${field}`, 0] },
					},
				},
			},
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Estimation",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<{ total: number }>;

		return result.cursor?.firstBatch?.[0]?.total ?? 0;
	};

	/**
	 * Get complete project analysis with collected revenue in a single aggregation
	 * Uses $lookup to join with transactions
	 */
	const getProjectAnalysisWithRevenue = async (
		filters: MetricFilters = {}
	): Promise<ProjectAnalysisData[]> => {
		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}
		if (filters.projectId) {
			matchStage._id = { $oid: filters.projectId };
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$lookup: {
					from: "Transaction",
					let: { projectId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ["$projectId", "$$projectId"] },
								isDeleted: { $ne: true },
								transactionType: "INCOMING",
								status: "CLEARED",
							},
						},
						{
							$group: {
								_id: null,
								collected: { $sum: "$amount" },
							},
						},
					],
					as: "revenue",
				},
			},
			{
				$project: {
					_id: 1,
					code: 1,
					name: 1,
					status: 1,
					totalSales: { $ifNull: ["$metaData.financial.totalSales", 0] },
					totalCost: { $ifNull: ["$metaData.financial.totalCost", 0] },
					collected: {
						$ifNull: [{ $arrayElemAt: ["$revenue.collected", 0] }, 0],
					},
				},
			},
			{ $sort: { totalSales: -1 } },
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Project",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<ProjectAnalysisData>;

		return result.cursor?.firstBatch ?? [];
	};

	/**
	 * Get milestone metrics in a single aggregation
	 */
	const getMilestoneMetrics = async (filters: MetricFilters = {}) => {
		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}
		if (filters.projectId) {
			matchStage.projectId = { $oid: filters.projectId };
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					completed: {
						$sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
					},
					inProgress: {
						$sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] },
					},
					pending: {
						$sum: { $cond: [{ $eq: ["$status", "NOT_STARTED"] }, 1, 0] },
					},
				},
			},
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Milestone",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<{ total: number; completed: number; inProgress: number; pending: number }>;

		const data = result.cursor?.firstBatch?.[0];
		return {
			total: data?.total ?? 0,
			completed: data?.completed ?? 0,
			inProgress: data?.inProgress ?? 0,
			pending: data?.pending ?? 0,
		};
	};

	/**
	 * Get estimation metrics in a single aggregation
	 */
	const getEstimationMetrics = async (filters: MetricFilters = {}) => {
		const matchStage: Record<string, unknown> = {
			isDeleted: { $ne: true },
		};

		if (filters.workspaceId) {
			matchStage.workspaceId = { $oid: filters.workspaceId };
		}
		if (filters.projectId) {
			matchStage.projectId = { $oid: filters.projectId };
		}

		const pipeline = [
			{ $match: matchStage },
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					approved: {
						$sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
					},
					pending: {
						$sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
					},
					draft: {
						$sum: { $cond: [{ $eq: ["$status", "DRAFT"] }, 1, 0] },
					},
					totalEstimatedCost: {
						$sum: { $ifNull: ["$metaData.estimatedCost", 0] },
					},
					totalProjectedWithMargin: {
						$sum: { $ifNull: ["$metaData.projectedWithMargin", 0] },
					},
				},
			},
		];

		const result = await prisma.$runCommandRaw({
			aggregate: "Estimation",
			pipeline: pipeline as Prisma.InputJsonValue,
			cursor: {},
		}) as unknown as RawCommandResult<{
			total: number;
			approved: number;
			pending: number;
			draft: number;
			totalEstimatedCost: number;
			totalProjectedWithMargin: number;
		}>;

		const data = result.cursor?.firstBatch?.[0];
		return {
			total: data?.total ?? 0,
			approved: data?.approved ?? 0,
			pending: data?.pending ?? 0,
			draft: data?.draft ?? 0,
			totalEstimatedCost: data?.totalEstimatedCost ?? 0,
			totalProjectedWithMargin: data?.totalProjectedWithMargin ?? 0,
		};
	};

	return {
		getProjectDashboardMetrics,
		getTransactionMetrics,
		getItemMetrics,
		getFinancialTrendsByMonth,
		aggregateProjectFinancialFromMetadata,
		aggregateEstimationFromMetadata,
		getProjectAnalysisWithRevenue,
		getMilestoneMetrics,
		getEstimationMetrics,
	};
};

export type MetricAggregations = ReturnType<typeof createMetricAggregations>;
