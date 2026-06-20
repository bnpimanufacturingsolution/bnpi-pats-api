/**
 * Metric Service
 * Business logic for metric calculations
 */

import { PrismaClient } from "../../generated/prisma";
import { createMetricRepository } from "./metric.repository";
import { createMetricAggregations } from "./metric.aggregations";
import {
	PROJECT_STATUS,
	ESTIMATION_STATUS,
	ITEM_STATUS,
	TRANSACTION_TYPE,
	TRANSACTION_STATUS,
	METRIC_REGISTRY,
	DEFAULTS,
	METRIC_ERRORS,
} from "./metric.config";
import type {
	MetricFilters,
	DashboardSummary,
	FinancialDashboard,
	FinancialTrend,
	ProjectAnalysis,
	ProjectReportData,
	ReportItem,
	ProjectReportChartData,
	CategorySubtotal,
	TypeBreakdown,
	CostTrendPoint,
	StatusDistribution,
	ProjectOverviewData,
	ProjectOverviewTimeline,
	ProjectOverviewScope,
} from "./metric.types";

// ============================================================================
// SERVICE FACTORY
// ============================================================================

export const createMetricService = (prisma: PrismaClient) => {
	const repo = createMetricRepository(prisma);
	const agg = createMetricAggregations(prisma);

	// ============================================
	// PROJECT METRICS
	// ============================================

	const totalProjects = (filters: MetricFilters = {}): Promise<number> => repo.countProjects(filters);
	const activeProjects = (filters: MetricFilters = {}): Promise<number> => repo.countProjects(filters, PROJECT_STATUS.ACTIVE);
	const completedProjects = (filters: MetricFilters = {}): Promise<number> => repo.countProjects(filters, PROJECT_STATUS.COMPLETED);
	const pendingProjects = (filters: MetricFilters = {}): Promise<number> => repo.countProjects(filters, PROJECT_STATUS.PENDING);
	const onHoldProjects = (filters: MetricFilters = {}): Promise<number> => repo.countProjects(filters, PROJECT_STATUS.ON_HOLD);
	const totalCapital = (filters: MetricFilters = {}): Promise<number> => repo.aggregateProjectField(filters, "capital");
	const totalActualExpenses = (filters: MetricFilters = {}): Promise<number> => repo.aggregateProjectField(filters, "actualExpenses");
	const projectStatusDistribution = (filters: MetricFilters = {}): Promise<StatusDistribution[]> => repo.getProjectStatusDistribution(filters);

	// ============================================
	// ESTIMATION METRICS
	// ============================================

	const totalEstimations = (filters: MetricFilters = {}): Promise<number> => repo.countEstimations(filters);
	const approvedEstimations = (filters: MetricFilters = {}): Promise<number> => repo.countEstimations(filters, ESTIMATION_STATUS.APPROVED);
	const pendingEstimations = (filters: MetricFilters = {}): Promise<number> => repo.countEstimations(filters, ESTIMATION_STATUS.PENDING);
	const totalEstimationValue = (filters: MetricFilters = {}): Promise<number> => repo.aggregateEstimationFinancialField(filters, "totalValue");
	const estimationStatusDistribution = (filters: MetricFilters = {}): Promise<StatusDistribution[]> => repo.getEstimationStatusDistribution(filters);

	// ============================================
	// TRANSACTION METRICS
	// ============================================

	const totalTransactions = (filters: MetricFilters = {}): Promise<number> => repo.countTransactions(filters);
	const totalTransactionAmount = (filters: MetricFilters = {}): Promise<number> => repo.aggregateTransactionAmount(filters);
	const totalRevenue = (filters: MetricFilters = {}): Promise<number> => repo.aggregateTransactionAmount(filters, TRANSACTION_TYPE.INCOMING);
	const totalExpenses = (filters: MetricFilters = {}): Promise<number> => repo.aggregateTransactionAmount(filters, TRANSACTION_TYPE.OUTGOING);

	// ============================================
	// MILESTONE METRICS
	// ============================================

	const totalMilestones = (filters: MetricFilters = {}): Promise<number> => repo.countMilestones(filters);
	const completedMilestones = (filters: MetricFilters = {}): Promise<number> => repo.countMilestones(filters, "COMPLETED");
	const pendingMilestones = (filters: MetricFilters = {}): Promise<number> => repo.countMilestones(filters, "PENDING");
	const inProgressMilestones = (filters: MetricFilters = {}): Promise<number> => repo.countMilestones(filters, "IN_PROGRESS");

	const milestoneProgress = async (filters: MetricFilters = {}): Promise<number> => {
		const [total, completed] = await Promise.all([totalMilestones(filters), completedMilestones(filters)]);
		return total > 0 ? (completed / total) * 100 : 0;
	};

	// ============================================
	// ITEM METRICS
	// ============================================

	const totalItems = (filters: MetricFilters = {}): Promise<number> => repo.countItems(filters);
	const completedItems = (filters: MetricFilters = {}): Promise<number> => repo.countItems(filters, ITEM_STATUS.COMPLETED);

	const itemProgress = async (filters: MetricFilters = {}): Promise<number> => {
		const [total, completed] = await Promise.all([totalItems(filters), completedItems(filters)]);
		return total > 0 ? (completed / total) * 100 : 0;
	};

	const totalCapex = (filters: MetricFilters = {}): Promise<number> => repo.aggregateItemsByType(filters, "CAPEX");
	const totalOpex = (filters: MetricFilters = {}): Promise<number> => repo.aggregateItemsByType(filters, "OPEX");

	// ============================================
	// DASHBOARD SUMMARY
	// ============================================

	const dashboardSummary = async (filters: MetricFilters = {}): Promise<DashboardSummary> => {
		const [
			total,
			active,
			completed,
			estimations,
			transactions,
			revenue,
			expenses,
			capital,
		] = await Promise.all([
			totalProjects(filters),
			activeProjects(filters),
			completedProjects(filters),
			totalEstimations(filters),
			totalTransactions(filters),
			totalRevenue(filters),
			totalExpenses(filters),
			totalCapital(filters),
		]);

		return {
			projects: { total, active, completed },
			estimations: { total: estimations },
			transactions: { total: transactions },
			financial: {
				revenue,
				expenses,
				profit: revenue - expenses,
				capital,
			},
		};
	};

	// ============================================
	// FINANCIAL METRICS
	// ============================================

	const collectedRevenue = (filters: MetricFilters = {}): Promise<number> =>
		repo.aggregateTransactionAmount(filters, TRANSACTION_TYPE.INCOMING, TRANSACTION_STATUS.CLEARED);

	const totalSales = (filters: MetricFilters = {}): Promise<number> =>
		repo.aggregateProjectFinancialField(filters, "totalSales");

	const projectedCost = (filters: MetricFilters = {}): Promise<number> =>
		repo.aggregateProjectFinancialField(filters, "totalCost");

	const uncollectedRevenue = async (filters: MetricFilters = {}): Promise<number> => {
		const [sales, collected] = await Promise.all([totalSales(filters), collectedRevenue(filters)]);
		return sales - collected;
	};

	const totalGrossProfit = async (filters: MetricFilters = {}): Promise<number> => {
		const [sales, cost] = await Promise.all([totalSales(filters), projectedCost(filters)]);
		return sales - cost;
	};

	const operationalExpenditures = (filters: MetricFilters = {}): Promise<number> =>
		repo.aggregateTransactionAmount(filters, TRANSACTION_TYPE.OUTGOING);

	const totalNetProfit = async (filters: MetricFilters = {}): Promise<number> => {
		const [grossProfit, opEx] = await Promise.all([totalGrossProfit(filters), operationalExpenditures(filters)]);
		return grossProfit - opEx;
	};

	const profitMargin = async (filters: MetricFilters = {}): Promise<number> => {
		const [netProfit, sales] = await Promise.all([totalNetProfit(filters), totalSales(filters)]);
		return sales > 0 ? (netProfit / sales) * 100 : 0;
	};

	const runningCost = (filters: MetricFilters = {}): Promise<number> => totalActualExpenses(filters);
	const capitalExpenditures = (filters: MetricFilters = {}): Promise<number> => totalCapex(filters);
	const operatingExpenditures = (filters: MetricFilters = {}): Promise<number> => totalOpex(filters);

	const remainingChecks = (filters: MetricFilters = {}): Promise<number> =>
		repo.aggregateTransactionAmount(filters, undefined, TRANSACTION_STATUS.PENDING);

	const totalFund = (filters: MetricFilters = {}): Promise<number> => totalCapital(filters);

	const collectionPercentage = async (filters: MetricFilters = {}): Promise<number> => {
		const [sales, collected] = await Promise.all([totalSales(filters), collectedRevenue(filters)]);
		return sales > 0 ? (collected / sales) * 100 : 0;
	};

	// ============================================
	// FINANCIAL TRENDS
	// ============================================

	const financialTrends = async (filters: MetricFilters = {}): Promise<FinancialTrend[]> => {
		const months = filters.months || DEFAULTS.FINANCIAL_TRENDS_MONTHS;

		// Calculate date range for entire period
		const now = new Date();
		const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
		const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

		// Fetch all transactions in a single query (2 queries instead of 24)
		const transactions = await prisma.transaction.findMany({
			where: {
				isDeleted: false,
				transactionDate: { gte: startDate, lte: endDate },
				...(filters.projectId && { projectId: filters.projectId }),
				...(filters.workspaceId && { workspaceId: filters.workspaceId }),
			},
			select: {
				transactionDate: true,
				transactionType: true,
				amount: true,
			},
		});

		// Initialize month buckets
		const monthData = new Map<string, { revenue: number; costs: number }>();
		for (let i = months - 1; i >= 0; i--) {
			const date = new Date();
			date.setMonth(date.getMonth() - i);
			const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
			monthData.set(monthKey, { revenue: 0, costs: 0 });
		}

		// Aggregate transactions by month (in-memory - fast)
		for (const txn of transactions) {
			const txnDate = new Date(txn.transactionDate);
			const monthKey = `${txnDate.getFullYear()}-${txnDate.getMonth()}`;
			const bucket = monthData.get(monthKey);
			if (bucket) {
				if (txn.transactionType === TRANSACTION_TYPE.INCOMING) {
					bucket.revenue += txn.amount;
				} else if (txn.transactionType === TRANSACTION_TYPE.OUTGOING) {
					bucket.costs += txn.amount;
				}
			}
		}

		// Build trends array in order
		const trends: FinancialTrend[] = [];
		for (let i = months - 1; i >= 0; i--) {
			const date = new Date();
			date.setMonth(date.getMonth() - i);
			const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
			const { revenue, costs } = monthData.get(monthKey) || { revenue: 0, costs: 0 };

			trends.push({
				month: date.toLocaleDateString("en-US", { month: "short" }),
				revenue,
				costs,
				profit: revenue - costs,
			});
		}

		return trends;
	};

	// ============================================
	// REVENUE VS COST ANALYSIS
	// ============================================

	const revenueVsCostAnalysis = (filters: MetricFilters = {}): Promise<ProjectAnalysis[]> =>
		repo.getProjectAnalysisAggregate(filters);

	const topProjectsByRevenue = async (filters: MetricFilters = {}): Promise<ProjectAnalysis[]> => {
		const limit = filters.limit || DEFAULTS.TOP_PROJECTS_LIMIT;
		const analysis = await revenueVsCostAnalysis(filters);
		return analysis.slice(0, limit);
	};

	// ============================================
	// FINANCIAL DASHBOARD
	// ============================================

	const financialDashboard = async (filters: MetricFilters = {}): Promise<FinancialDashboard> => {
		const [
			collected,
			uncollected,
			sales,
			cost,
			running,
			opExpenditures,
			capEx,
			opex,
			checks,
			grossProfit,
			netProfit,
			margin,
			projectCount,
			statusDist,
			collection,
			trends,
			projectAnalysis,
			realizedExpenses,
			realizedIncoming,
			realizedPlanned,
		] = await Promise.all([
			collectedRevenue(filters),
			uncollectedRevenue(filters),
			totalSales(filters),
			projectedCost(filters),
			runningCost(filters),
			operationalExpenditures(filters),
			capitalExpenditures(filters),
			operatingExpenditures(filters),
			remainingChecks(filters),
			totalGrossProfit(filters),
			totalNetProfit(filters),
			profitMargin(filters),
			totalProjects(filters),
			projectStatusDistribution(filters),
			collectionPercentage(filters),
			financialTrends(filters),
			revenueVsCostAnalysis(filters),
			repo.aggregateTransactionAmount(filters, TRANSACTION_TYPE.OUTGOING),
			repo.aggregateTransactionAmount(filters, TRANSACTION_TYPE.INCOMING, TRANSACTION_STATUS.CLEARED),
			filters.projectId ? repo.aggregateItemEstimatedTotal(filters.projectId) : Promise.resolve(0),
		]);

		const expenses = realizedExpenses;
		const totalRealizedCapital = realizedIncoming;
		const plannedBudget = realizedPlanned;
		const realizedProfit = totalRealizedCapital - expenses;
		const unallocatedReserves = Math.max(0, totalRealizedCapital - plannedBudget);
		const remainingPlannedBudget = plannedBudget - expenses;

		return {
			revenueAndCollections: { collected, uncollected, totalSales: sales, projectedCost: cost },
			expensesAndCosts: {
				runningCost: running,
				operationalExpenditures: opExpenditures,
				capitalExpenditures: capEx,
				opex,
				remainingChecks: checks,
			},
			profitability: { totalGrossProfit: grossProfit, totalNetProfit: netProfit, realizedProfit, profitMargin: margin },
			capitalFunds: {
				totalFund: totalRealizedCapital,
				planned: plannedBudget,
				available: unallocatedReserves,
				utilization: totalRealizedCapital > 0 ? (plannedBudget / totalRealizedCapital) * 100 : 0,
			},
			projectStatus: { totalProjects: projectCount, distribution: statusDist },
			collectionStatus: { percentage: collection, collected, pending: uncollected },
			expenseBreakdown: {
				runningCostsPercentage: totalRealizedCapital > 0 ? (running / totalRealizedCapital) * 100 : 0,
				operationalPercentage: totalRealizedCapital > 0 ? (opExpenditures / totalRealizedCapital) * 100 : 0,
				remainingBudgetPercentage: totalRealizedCapital > 0 ? (remainingPlannedBudget / totalRealizedCapital) * 100 : 0,
				totalExpenses: expenses,
				remainingBudget: remainingPlannedBudget,
			},
			financialTrends: trends,
			revenueVsCostAnalysis: {
				totalRevenue: sales,
				totalCosts: cost,
				totalProfit: netProfit,
				projects: projectAnalysis,
			},
			topProjects: projectAnalysis.slice(0, DEFAULTS.TOP_PROJECTS_LIMIT),
		};
	};

	// ============================================
	// PROJECT REPORT
	// ============================================

	const projectReport = async (filters: MetricFilters = {}): Promise<ProjectReportData> => {
		const { projectId } = filters;

		if (!projectId) throw new Error(METRIC_ERRORS.PROJECT_ID_REQUIRED);

		const project = await repo.findProjectById(projectId);
		if (!project) throw new Error(METRIC_ERRORS.PROJECT_NOT_FOUND);

		let currentEstimation = await repo.findCurrentEstimation(projectId, ESTIMATION_STATUS.APPROVED);
		if (!currentEstimation) currentEstimation = await repo.findCurrentEstimation(projectId);

		let flattenedEstimation = null;
		if (currentEstimation) {
			const metaData = currentEstimation.metaData as Record<string, unknown> | null;
			flattenedEstimation = {
				...currentEstimation,
				estimatedCost: metaData?.estimatedCost ?? 0,
				actualCost: metaData?.actualCost ?? null,
				marginAmount: metaData?.marginAmount ?? 0,
				projectedWithMargin: metaData?.projectedWithMargin ?? 0,
				projectedProjectNet: metaData?.estimatedCost ?? 0,
			};
		}

		const [
			totalEst,
			approvedEst,
			itemsTotal,
			itemsCompleted,
			itemsInProgress,
			itemsPending,
			txnCount,
			txnSummary,
		] = await Promise.all([
			repo.countEstimations({ projectId }),
			repo.countEstimations({ projectId }, ESTIMATION_STATUS.APPROVED),
			repo.countItemsForApprovedEstimations(projectId),
			repo.countItemsForApprovedEstimations(projectId, ITEM_STATUS.COMPLETED),
			repo.countItemsForApprovedEstimations(projectId, ITEM_STATUS.IN_PROGRESS),
			repo.countItemsForApprovedEstimations(projectId, ITEM_STATUS.PENDING),
			repo.countTransactions({ projectId }),
			repo.getTransactionSummaryByType(projectId),
		]);

		const progressPercentage = itemsTotal > 0 ? Math.round((itemsCompleted / itemsTotal) * 100) : 0;

		return {
			project: project as ProjectReportData["project"],
			currentEstimation: flattenedEstimation as ProjectReportData["currentEstimation"],
			summary: {
				estimations: { total: totalEst, approved: approvedEst },
				items: {
					total: itemsTotal,
					completed: itemsCompleted,
					inProgress: itemsInProgress,
					pending: itemsPending,
					progressPercentage,
				},
				transactions: { count: txnCount, ...txnSummary },
			},
		};
	};

	const projectReportItems = async (filters: MetricFilters = {}): Promise<ReportItem[]> => {
		const { projectId } = filters;
		if (!projectId) throw new Error(METRIC_ERRORS.PROJECT_ID_REQUIRED);
		return repo.getProjectReportItems(projectId);
	};

	// ============================================
	// PROJECT OVERVIEW
	// ============================================

	/**
	 * Calculate working days between two dates (excludes weekends)
	 */
	const calculateWorkingDays = (start: Date, end: Date): number => {
		if (start > end) return 0;

		let count = 0;
		const current = new Date(start);

		while (current <= end) {
			const dayOfWeek = current.getDay();
			if (dayOfWeek !== 0 && dayOfWeek !== 6) {
				count++;
			}
			current.setDate(current.getDate() + 1);
		}

		return count;
	};

	const projectOverview = async (filters: MetricFilters = {}): Promise<ProjectOverviewData> => {
		const { projectId } = filters;

		if (!projectId) throw new Error(METRIC_ERRORS.PROJECT_ID_REQUIRED);

		const [project, itemsAggregate] = await Promise.all([
			repo.getProjectOverviewData(projectId),
			repo.getProjectItemsAggregate(projectId),
		]);

		if (!project) throw new Error(METRIC_ERRORS.PROJECT_NOT_FOUND);

		// Calculate timeline
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const startDate = project.startDate ? new Date(project.startDate) : null;
		const endDate = project.endDate ? new Date(project.endDate) : null;

		let totalDays = 0;
		let workingDays = 0;
		let elapsedDays = 0;
		let elapsedWorkingDays = 0;
		let remainingDays = 0;
		let remainingWorkingDays = 0;
		let percentElapsed = 0;

		if (startDate && endDate) {
			startDate.setHours(0, 0, 0, 0);
			endDate.setHours(0, 0, 0, 0);

			totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
			workingDays = calculateWorkingDays(startDate, endDate);

			if (today >= startDate) {
				const effectiveEnd = today < endDate ? today : endDate;
				elapsedDays = Math.ceil((effectiveEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
				elapsedWorkingDays = calculateWorkingDays(startDate, effectiveEnd);
			}

			if (today < endDate) {
				const effectiveStart = today > startDate ? today : startDate;
				remainingDays = Math.ceil((endDate.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
				remainingWorkingDays = calculateWorkingDays(effectiveStart, endDate);
			}

			percentElapsed = workingDays > 0 ? Math.round((elapsedWorkingDays / workingDays) * 100) : 0;
		}

		const timeline: ProjectOverviewTimeline = {
			startDate: project.startDate,
			endDate: project.endDate,
			totalDays,
			workingDays,
			elapsedDays,
			elapsedWorkingDays,
			remainingDays,
			remainingWorkingDays,
			percentElapsed,
		};

		// Calculate scope
		const percentAchieved = itemsAggregate.targetValue > 0
			? Math.round((itemsAggregate.earnedValue / itemsAggregate.targetValue) * 1000) / 10
			: 0;

		const scope: ProjectOverviewScope = {
			earnedValue: itemsAggregate.earnedValue,
			targetValue: itemsAggregate.targetValue,
			percentAchieved,
			workItemsTotal: itemsAggregate.total,
			workItemsCompleted: itemsAggregate.completed,
			workItemsInProgress: itemsAggregate.inProgress,
			workItemsPending: itemsAggregate.pending,
		};

		return {
			projectId: project.id,
			projectName: project.name,
			projectCode: project.code,
			status: project.status,
			timeline,
			scope,
		};
	};

	const projectReportChartData = async (filters: MetricFilters = {}): Promise<ProjectReportChartData> => {
		const { projectId } = filters;
		if (!projectId) throw new Error(METRIC_ERRORS.PROJECT_ID_REQUIRED);

		const items = await repo.getProjectReportItems(projectId);

		let totalEstimated = 0;
		let totalActual = 0;
		const categoryMap = new Map<string, { estimated: number; actual: number }>();
		const typeMap = new Map<string, { estimated: number; actual: number }>([
			["CAPEX", { estimated: 0, actual: 0 }],
			["OPEX", { estimated: 0, actual: 0 }],
			["MISC", { estimated: 0, actual: 0 }],
		]);
		const trendMap = new Map<string, { estimated: number; actual: number }>();

		for (const item of items) {
			const estimated = item.estimatedTotal || 0;
			const actual = item.actualTotal || 0;

			totalEstimated += estimated;
			totalActual += actual;

			const categoryName = item.category?.name || "Uncategorized";
			const categoryData = categoryMap.get(categoryName) || { estimated: 0, actual: 0 };
			categoryData.estimated += estimated;
			categoryData.actual += actual;
			categoryMap.set(categoryName, categoryData);

			const typeName = item.type || "MISC";
			const typeData = typeMap.get(typeName) || { estimated: 0, actual: 0 };
			typeData.estimated += estimated;
			typeData.actual += actual;
			typeMap.set(typeName, typeData);

			const dateKey = new Date(item.createdAt).toISOString().split("T")[0];
			const trendData = trendMap.get(dateKey) || { estimated: 0, actual: 0 };
			trendData.estimated += estimated;
			trendData.actual += actual;
			trendMap.set(dateKey, trendData);
		}

		const categorySubtotals: CategorySubtotal[] = Array.from(categoryMap.entries())
			.map(([category, data]) => ({
				category,
				estimated: data.estimated,
				actual: data.actual,
				variance: data.actual - data.estimated,
				variancePercent: data.estimated > 0 ? ((data.actual - data.estimated) / data.estimated) * 100 : 0,
			}))
			.sort((a, b) => b.estimated - a.estimated);

		const typeBreakdown: TypeBreakdown[] = Array.from(typeMap.entries()).map(([type, data]) => ({
			type: type as "CAPEX" | "OPEX" | "MISC",
			estimated: data.estimated,
			actual: data.actual,
			variance: data.actual - data.estimated,
			variancePercent: data.estimated > 0 ? ((data.actual - data.estimated) / data.estimated) * 100 : 0,
		}));

		const sortedDates = Array.from(trendMap.keys()).sort();
		let cumulativeEstimated = 0;
		let cumulativeActual = 0;

		const costTrend: CostTrendPoint[] = sortedDates.map((date) => {
			const data = trendMap.get(date)!;
			cumulativeEstimated += data.estimated;
			cumulativeActual += data.actual;
			return {
				date,
				estimated: data.estimated,
				actual: data.actual,
				cumulativeEstimated,
				cumulativeActual,
			};
		});

		const totalVariance = totalActual - totalEstimated;
		const totalVariancePercent = totalEstimated > 0 ? (totalVariance / totalEstimated) * 100 : 0;

		return {
			totalEstimated,
			totalActual,
			totalVariance,
			totalVariancePercent,
			categorySubtotals,
			typeBreakdown,
			costTrend,
			items,
			itemCount: items.length,
		};
	};

	// ============================================
	// OPTIMIZED DASHBOARD (MongoDB Raw Aggregation)
	// ============================================

	/**
	 * Get complete dashboard summary using MongoDB raw aggregation
	 * Reduces 20+ queries to 5-6 aggregated queries
	 */
	const dashboardSummaryOptimized = async (filters: MetricFilters = {}) => {
		const [
			projectMetrics,
			transactionMetrics,
			itemMetrics,
			milestoneMetrics,
			estimationMetrics,
			trends,
		] = await Promise.all([
			agg.getProjectDashboardMetrics(filters),
			agg.getTransactionMetrics(filters),
			agg.getItemMetrics(filters),
			agg.getMilestoneMetrics(filters),
			agg.getEstimationMetrics(filters),
			agg.getFinancialTrendsByMonth(filters, filters.months || DEFAULTS.FINANCIAL_TRENDS_MONTHS),
		]);

		return {
			projects: projectMetrics,
			transactions: transactionMetrics,
			items: itemMetrics,
			milestones: milestoneMetrics,
			estimations: estimationMetrics,
			financialTrends: trends,
		};
	};

	/**
	 * Get financial trends using MongoDB raw aggregation (optimized)
	 * Single query instead of N*2 queries
	 */
	const financialTrendsOptimized = async (filters: MetricFilters = {}): Promise<FinancialTrend[]> => {
		const months = filters.months || DEFAULTS.FINANCIAL_TRENDS_MONTHS;
		return agg.getFinancialTrendsByMonth(filters, months);
	};

	/**
	 * Get project analysis with revenue using MongoDB $lookup
	 * Single aggregation with join instead of 2 separate queries
	 */
	const projectAnalysisOptimized = async (filters: MetricFilters = {}): Promise<ProjectAnalysis[]> => {
		const data = await agg.getProjectAnalysisWithRevenue(filters);

		return data.map((p) => ({
			projectId: p._id,
			projectCode: p.code,
			projectName: p.name,
			status: p.status,
			totalSales: p.totalSales,
			totalCost: p.totalCost,
			netProfit: p.totalSales - p.totalCost,
			profitPercentage: p.totalSales > 0 ? ((p.totalSales - p.totalCost) / p.totalSales) * 100 : 0,
			collected: p.collected,
			uncollected: p.totalSales - p.collected,
		}));
	};

	// ============================================
	// METRIC REGISTRY
	// ============================================

	const getAvailableMetrics = (): Record<string, readonly string[]> => METRIC_REGISTRY;

	return {
		// Project metrics
		totalProjects,
		activeProjects,
		completedProjects,
		pendingProjects,
		onHoldProjects,
		totalCapital,
		totalActualExpenses,
		projectStatusDistribution,
		// Estimation metrics
		totalEstimations,
		approvedEstimations,
		pendingEstimations,
		totalEstimationValue,
		estimationStatusDistribution,
		// Transaction metrics
		totalTransactions,
		totalTransactionAmount,
		totalRevenue,
		totalExpenses,
		// Milestone metrics
		totalMilestones,
		completedMilestones,
		pendingMilestones,
		inProgressMilestones,
		milestoneProgress,
		// Item metrics
		totalItems,
		completedItems,
		itemProgress,
		totalCapex,
		totalOpex,
		// Dashboard
		dashboardSummary,
		// Financial metrics
		collectedRevenue,
		uncollectedRevenue,
		totalSales,
		projectedCost,
		totalGrossProfit,
		totalNetProfit,
		profitMargin,
		runningCost,
		operationalExpenditures,
		capitalExpenditures,
		operatingExpenditures,
		remainingChecks,
		totalFund,
		collectionPercentage,
		// Financial trends
		financialTrends,
		// Analysis
		revenueVsCostAnalysis,
		topProjectsByRevenue,
		financialDashboard,
		// Project reports
		projectReport,
		projectReportItems,
		projectReportChartData,
		// Project overview
		projectOverview,
		// Optimized (MongoDB Raw Aggregation)
		dashboardSummaryOptimized,
		financialTrendsOptimized,
		projectAnalysisOptimized,
		// Raw aggregation access
		aggregations: agg,
		// Registry
		getAvailableMetrics,
	};
};

export type MetricService = ReturnType<typeof createMetricService>;
