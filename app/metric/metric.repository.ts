/**
 * Metric Repository
 * Data access layer for metric calculations
 */

import { PrismaClient, Prisma } from "../../generated/prisma";
import {
	PROJECT_SELECT,
	ESTIMATION_SELECT,
	ITEM_SELECT,
	TRANSACTION_TYPE,
	TRANSACTION_STATUS,
	BASE_WHERE,
} from "./metric.config";
import type {
	MetricFilters,
	TransactionSummary,
	StatusDistribution,
} from "./metric.types";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const buildDateFilter = (filters: MetricFilters, field: string = "createdAt") => {
	if (!filters.startDate && !filters.endDate) return {};

	const dateFilter: Record<string, Date> = {};
	if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
	if (filters.endDate) dateFilter.lte = new Date(filters.endDate);

	return { [field]: dateFilter };
};

// ============================================================================
// REPOSITORY FACTORY
// ============================================================================

export const createMetricRepository = (prisma: PrismaClient) => {
	// ============================================
	// PROJECT QUERIES
	// ============================================

	const countProjects = async (filters: MetricFilters = {}, status?: string) => {
		const where: Prisma.ProjectWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { id: filters.projectId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			...buildDateFilter(filters),
		};

		if (status) {
			where.status = status as Prisma.ProjectWhereInput["status"];
		} else if (filters.status) {
			where.status = filters.status as Prisma.ProjectWhereInput["status"];
		}

		return prisma.project.count({ where });
	};

	const aggregateProjectField = async (filters: MetricFilters, field: "capital" | "actualExpenses") => {
		const where: Prisma.ProjectWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { id: filters.projectId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
		};

		const result = await prisma.project.aggregate({
			where,
			_sum: { [field]: true },
		});
		return (result._sum as Record<string, number | null>)[field] ?? 0;
	};

	const getProjectStatusDistribution = async (filters: MetricFilters = {}): Promise<StatusDistribution[]> => {
		const where: Prisma.ProjectWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
		};

		const results = await prisma.project.groupBy({
			by: ["status"],
			where,
			_count: { status: true },
		});

		return results.map((r) => ({
			status: r.status,
			count: r._count.status,
		}));
	};

	const findProjectById = async (projectId: string, workspaceId?: string) => {
		return prisma.project.findFirst({
			where: { id: projectId, ...BASE_WHERE.notDeleted, ...(workspaceId && { workspaceId: workspaceId }) },
			select: PROJECT_SELECT.report,
		});
	};

	// ============================================
	// ESTIMATION QUERIES
	// ============================================

	const countEstimations = async (filters: MetricFilters = {}, status?: string) => {
		const where: Prisma.EstimationWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { projectId: filters.projectId }),
			...(filters.estimationId && { id: filters.estimationId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
		};

		if (status) {
			where.status = status as Prisma.EstimationWhereInput["status"];
		} else if (filters.status) {
			where.status = filters.status as Prisma.EstimationWhereInput["status"];
		}

		return prisma.estimation.count({ where });
	};

	const getEstimationStatusDistribution = async (filters: MetricFilters): Promise<StatusDistribution[]> => {
		const where: Prisma.EstimationWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { projectId: filters.projectId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
		};

		const results = await prisma.estimation.groupBy({
			by: ["status"],
			where,
			_count: { status: true },
		});

		return results.map((r) => ({
			status: r.status,
			count: r._count.status,
		}));
	};

	const findCurrentEstimation = async (projectId: string, status?: string) => {
		const where: Prisma.EstimationWhereInput = {
			projectId,
			...BASE_WHERE.notDeleted,
		};

		if (status) {
			where.status = status as Prisma.EstimationWhereInput["status"];
		}

		return prisma.estimation.findFirst({
			where,
			orderBy: { createdAt: "desc" },
			select: ESTIMATION_SELECT.report,
		});
	};

	// ============================================
	// TRANSACTION QUERIES
	// ============================================

	const countTransactions = async (filters: MetricFilters = {}) => {
		const where: Prisma.TransactionWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { projectId: filters.projectId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			...buildDateFilter(filters, "transactionDate"),
		};

		return prisma.transaction.count({ where });
	};

	const aggregateTransactionAmount = async (filters: MetricFilters, type?: string, status?: string) => {
		const where: Prisma.TransactionWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { projectId: filters.projectId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			...buildDateFilter(filters, "transactionDate"),
		};

		if (type) where.transactionType = type as Prisma.TransactionWhereInput["transactionType"];
		if (status) where.status = status as Prisma.TransactionWhereInput["status"];

		const result = await prisma.transaction.aggregate({ where, _sum: { amount: true } });
		return result._sum?.amount ?? 0;
	};

	const getTransactionSummaryByType = async (projectId: string): Promise<TransactionSummary> => {
		const results = await prisma.transaction.groupBy({
			by: ["transactionType"],
			where: { projectId, ...BASE_WHERE.notDeleted },
			_sum: { amount: true },
		});

		const summary: TransactionSummary = { totalIncoming: 0, totalOutgoing: 0, netBalance: 0 };

		results.forEach((r) => {
			if (r.transactionType === TRANSACTION_TYPE.INCOMING) {
				summary.totalIncoming = r._sum?.amount ?? 0;
			} else if (r.transactionType === TRANSACTION_TYPE.OUTGOING) {
				summary.totalOutgoing = r._sum?.amount ?? 0;
			}
		});

		summary.netBalance = summary.totalIncoming - summary.totalOutgoing;
		return summary;
	};

	const getCollectedRevenueForProject = async (projectId: string) => {
		const result = await prisma.transaction.aggregate({
			where: {
				projectId,
				...BASE_WHERE.notDeleted,
				transactionType: TRANSACTION_TYPE.INCOMING,
				status: TRANSACTION_STATUS.CLEARED,
			},
			_sum: { amount: true },
		});
		return result._sum?.amount ?? 0;
	};

	// ============================================
	// ITEM QUERIES
	// ============================================

	const countItems = async (filters: MetricFilters = {}, status?: string) => {
		const where: Prisma.ItemWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.estimationId && { estimationId: filters.estimationId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
		};

		if (status) where.status = status as Prisma.ItemWhereInput["status"];
		if (filters.projectId) where.estimation = { projectId: filters.projectId };

		return prisma.item.count({ where });
	};

	const countItemsForApprovedEstimations = async (projectId: string, status?: string) => {
		const where: Prisma.ItemWhereInput = {
			...BASE_WHERE.notDeleted,
			estimation: { projectId, status: "APPROVED", ...BASE_WHERE.notDeleted },
		};

		if (status) where.status = status as Prisma.ItemWhereInput["status"];

		return prisma.item.count({ where });
	};

	const aggregateItemsByType = async (filters: MetricFilters, typeName: string): Promise<number> => {
		const where: Prisma.ItemWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.estimationId && { estimationId: filters.estimationId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			itemType: { name: { contains: typeName, mode: "insensitive" } },
		};

		if (filters.projectId) where.estimation = { projectId: filters.projectId };

		const result = await prisma.item.aggregate({
			where,
			_sum: { actualTotal: true, estimatedTotal: true },
		});

		return result._sum?.actualTotal ?? result._sum?.estimatedTotal ?? 0;
	};

	const aggregateItemEstimatedTotal = async (projectId: string): Promise<number> => {
		const result = await prisma.item.aggregate({
			where: {
				...BASE_WHERE.notDeleted,
				estimation: { projectId, status: "APPROVED", ...BASE_WHERE.notDeleted },
			},
			_sum: { estimatedTotal: true },
		});

		return result._sum?.estimatedTotal ?? 0;
	};

	const getProjectReportItems = async (projectId: string) => {
		const items = await prisma.item.findMany({
			where: {
				...BASE_WHERE.notDeleted,
				estimation: { projectId, status: "APPROVED", ...BASE_WHERE.notDeleted },
			},
			select: ITEM_SELECT.report,
			orderBy: { createdAt: "asc" },
		});

		return items.map((item) => ({
			id: item.id,
			itemName: item.itemName,
			type: (item.itemType?.name?.toUpperCase() as "CAPEX" | "OPEX" | "MISC") || "MISC",
			category: item.category ? { id: item.category.id, name: item.category.name } : null,
			estimatedTotal: item.estimatedTotal,
			actualTotal: item.actualTotal,
			status: item.status,
			createdAt: item.createdAt,
		}));
	};

	// ============================================
	// MILESTONE QUERIES
	// ============================================

	const countMilestones = async (filters: MetricFilters = {}, status?: string) => {
		const where: Prisma.MilestoneWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { projectId: filters.projectId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			...buildDateFilter(filters, status === "COMPLETED" ? "completedDate" : "createdAt"),
		};

		if (status) where.status = status as Prisma.MilestoneWhereInput["status"];

		return prisma.milestone.count({ where });
	};

	// ============================================
	// AGGREGATE JSON FIELD QUERIES
	// ============================================

	const aggregateProjectFinancialField = async (filters: MetricFilters, field: "totalSales" | "totalCost"): Promise<number> => {
		// Use MongoDB aggregation for efficiency (avoids loading all projects into memory)
		const matchStage = {
			isDeleted: false,
			...(filters.projectId && { _id: { $oid: filters.projectId } }),
			...(filters.workspaceId && { workspaceId: { $oid: filters.workspaceId } }),
		};

		try {
			const pipeline = [
				{ $match: matchStage },
				{
					$group: {
						_id: null,
						total: { $sum: { $ifNull: [`$metaData.financial.${field}`, 0] } },
					},
				},
			];

			const result = await prisma.$runCommandRaw({
				aggregate: "Project",
				pipeline: pipeline as Prisma.InputJsonValue,
				cursor: {},
			}) as unknown as { cursor: { firstBatch: Array<{ total: number }> } };

			return result.cursor.firstBatch[0]?.total || 0;
		} catch {
			// Fallback to in-memory if aggregation fails
			const where: Prisma.ProjectWhereInput = {
				...BASE_WHERE.notDeleted,
				...(filters.projectId && { id: filters.projectId }),
				...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			};
			const projects = await prisma.project.findMany({ where, select: { metaData: true } });
			return projects.reduce((total, project) => {
				const metaData = project.metaData as Record<string, unknown> | null;
				const financial = metaData?.financial as Record<string, number> | undefined;
				return total + (financial?.[field] || 0);
			}, 0);
		}
	};

	const aggregateEstimationFinancialField = async (
		filters: MetricFilters,
		field: "totalValue" | "estimatedCost" | "actualCost" | "projectedWithMargin"
	): Promise<number> => {
		const fieldMap: Record<string, string> = {
			totalValue: "projectedWithMargin",
			estimatedCost: "estimatedCost",
			actualCost: "actualCost",
			projectedWithMargin: "projectedWithMargin",
		};
		const metaDataField = fieldMap[field] || field;

		// Use MongoDB aggregation for efficiency
		const matchStage = {
			isDeleted: false,
			...(filters.projectId && { projectId: { $oid: filters.projectId } }),
			...(filters.estimationId && { _id: { $oid: filters.estimationId } }),
			...(filters.workspaceId && { workspaceId: { $oid: filters.workspaceId } }),
		};

		try {
			const pipeline = [
				{ $match: matchStage },
				{
					$group: {
						_id: null,
						total: { $sum: { $ifNull: [`$metaData.${metaDataField}`, 0] } },
					},
				},
			];

			const result = await prisma.$runCommandRaw({
				aggregate: "Estimation",
				pipeline: pipeline as Prisma.InputJsonValue,
				cursor: {},
			}) as unknown as { cursor: { firstBatch: Array<{ total: number }> } };

			return result.cursor.firstBatch[0]?.total || 0;
		} catch {
			// Fallback to in-memory if aggregation fails
			const where: Prisma.EstimationWhereInput = {
				...BASE_WHERE.notDeleted,
				...(filters.projectId && { projectId: filters.projectId }),
				...(filters.estimationId && { id: filters.estimationId }),
				...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			};
			const estimations = await prisma.estimation.findMany({ where, select: { metaData: true } });
			return estimations.reduce((total, est) => {
				const metaData = est.metaData as Record<string, unknown> | null;
				const value = metaData?.[metaDataField];
				return total + (typeof value === "number" ? value : 0);
			}, 0);
		}
	};

	const getProjectAnalysisAggregate = async (filters: MetricFilters): Promise<Array<{
		projectId: string;
		projectCode: string;
		projectName: string;
		status: string;
		totalSales: number;
		totalCost: number;
		netProfit: number;
		profitPercentage: number;
		collected: number;
		uncollected: number;
	}>> => {
		const where: Prisma.ProjectWhereInput = {
			...BASE_WHERE.notDeleted,
			...(filters.projectId && { id: filters.projectId }),
			...(filters.workspaceId && { workspaceId: filters.workspaceId }),
		};

		const [projects, collectedByProject] = await Promise.all([
			prisma.project.findMany({
				where,
				select: { id: true, code: true, name: true, status: true, metaData: true },
				orderBy: { createdAt: "desc" },
			}),
			prisma.transaction.groupBy({
				by: ["projectId"],
				where: {
					...BASE_WHERE.notDeleted,
					transactionType: TRANSACTION_TYPE.INCOMING,
					status: TRANSACTION_STATUS.CLEARED,
					...(filters.projectId && { projectId: filters.projectId }),
					...(filters.workspaceId && { workspaceId: filters.workspaceId }),
				},
				_sum: { amount: true },
			}),
		]);

		const collectedMap = new Map(collectedByProject.map((c) => [c.projectId, c._sum.amount ?? 0]));

		const analysis = projects.map((project) => {
			const metaData = project.metaData as Record<string, unknown> | null;
			const financial = metaData?.financial as Record<string, number> | undefined;

			const totalSales = financial?.totalSales || 0;
			const totalCost = financial?.totalCost || 0;
			const netProfit = totalSales - totalCost;
			const collected = collectedMap.get(project.id) || 0;

			return {
				projectId: project.id,
				projectCode: project.code,
				projectName: project.name,
				status: project.status,
				totalSales,
				totalCost,
				netProfit,
				profitPercentage: totalSales > 0 ? (netProfit / totalSales) * 100 : 0,
				collected,
				uncollected: totalSales - collected,
			};
		});

		return analysis.sort((a, b) => b.totalSales - a.totalSales);
	};

	// ============================================
	// PROJECT OVERVIEW QUERIES
	// ============================================

	const getProjectOverviewData = async (projectId: string, workspaceId?: string) => {
		const project = await prisma.project.findFirst({
			where: { id: projectId, ...BASE_WHERE.notDeleted, ...(workspaceId && { workspaceId: workspaceId }) },
			select: {
				id: true,
				name: true,
				code: true,
				status: true,
				startDate: true,
				endDate: true,
				metaData: true,
			},
		});
		return project;
	};

	const getProjectItemsAggregate = async (projectId: string) => {
		// Optimized: Use database aggregation instead of in-memory loop
		const baseWhere: Prisma.ItemWhereInput = {
			...BASE_WHERE.notDeleted,
			estimation: { projectId, status: "APPROVED", ...BASE_WHERE.notDeleted },
		};

		// Run aggregations in parallel
		const [totals, statusCounts] = await Promise.all([
			// Get sum of estimatedTotal and actualTotal
			prisma.item.aggregate({
				where: baseWhere,
				_sum: { estimatedTotal: true, actualTotal: true },
				_count: { id: true },
			}),
			// Get counts by status
			prisma.item.groupBy({
				by: ["status"],
				where: baseWhere,
				_count: { status: true },
			}),
		]);

		// Convert status counts to object
		const statusMap = new Map(statusCounts.map((s) => [s.status, s._count.status]));

		return {
			earnedValue: totals._sum.actualTotal ?? 0,
			targetValue: totals._sum.estimatedTotal ?? 0,
			total: totals._count.id,
			completed: statusMap.get("COMPLETED") ?? 0,
			inProgress: statusMap.get("IN_PROGRESS") ?? 0,
			pending: statusMap.get("PENDING") ?? 0,
		};
	};

	const getProjectCostMetrics = async (projectId: string) => {
		// Optimized: Use database aggregation instead of in-memory loop
		const result = await prisma.item.aggregate({
			where: {
				...BASE_WHERE.notDeleted,
				estimation: { projectId, status: "APPROVED", ...BASE_WHERE.notDeleted },
			},
			_sum: {
				actualTotal: true,
			},
		});

		const spent = result._sum.actualTotal ?? 0;

		return { spent };
	};

	return {
		countProjects,
		aggregateProjectField,
		getProjectStatusDistribution,
		findProjectById,
		countEstimations,
		getEstimationStatusDistribution,
		findCurrentEstimation,
		countTransactions,
		aggregateTransactionAmount,
		getTransactionSummaryByType,
		getCollectedRevenueForProject,
		countItems,
		countItemsForApprovedEstimations,
		aggregateItemsByType,
		aggregateItemEstimatedTotal,
		getProjectReportItems,
		countMilestones,
		aggregateProjectFinancialField,
		aggregateEstimationFinancialField,
		getProjectAnalysisAggregate,
		// Project Overview
		getProjectOverviewData,
		getProjectItemsAggregate,
		getProjectCostMetrics,
	};
};

export type MetricRepository = ReturnType<typeof createMetricRepository>;
