/**
 * Metric Module Type Definitions
 */

import { METRIC_REGISTRY } from "./metric.config";

// ============================================
// FILTER TYPES
// ============================================

export interface MetricFilter {
	startDate?: string;
	endDate?: string;
	projectId?: string;
	estimationId?: string;
	status?: string;
	months?: number;
	limit?: number;
	workspaceId?: string;
}

export interface DateRange {
	startDate?: Date;
	endDate?: Date;
}

// Legacy alias for backward compatibility
export type MetricFilters = MetricFilter;

// ============================================
// REQUEST TYPES
// ============================================

export interface MetricRequest {
	model: string;
	metric: string[];
	filter?: MetricFilter[];
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface MetricResponse<T = unknown> {
	status: "success" | "error";
	data?: T;
	errors?: Record<string, string>;
	message?: string;
	metadata?: Record<string, unknown>;
}

export interface MetricResult {
	[metricName: string]: unknown;
}

// ============================================
// PROJECT REPORT TYPES
// ============================================

export interface ProjectReportProject {
	id: string;
	name: string;
	code: string;
	status: string;
	capital: number | null;
	actualExpenses: number | null;
	startDate: Date | null;
	endDate: Date | null;
	metaData: unknown;
}

export interface ProjectReportEstimation {
	id: string;
	estimationNumber: string;
	name: string;
	version: number;
	status: string;
	marginPercentage: number;
	// Computed values are in metaData (EstimationMetaData type)
	metaData: unknown;
	// Flattened from metaData for backward compatibility
	estimatedCost: number;
	actualCost: number | null;
	marginAmount: number;
	projectedWithMargin: number;
	projectedProjectNet: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface ProjectReportSummary {
	estimations: {
		total: number;
		approved: number;
	};
	items: {
		total: number;
		completed: number;
		inProgress: number;
		pending: number;
		progressPercentage: number;
	};
	transactions: {
		count: number;
		totalIncoming: number;
		totalOutgoing: number;
		netBalance: number;
	};
}

export interface ProjectReportData {
	project: ProjectReportProject;
	currentEstimation: ProjectReportEstimation | null;
	summary: ProjectReportSummary;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardSummary {
	projects: {
		total: number;
		active: number;
		completed: number;
	};
	estimations: {
		total: number;
	};
	transactions: {
		total: number;
	};
	financial: {
		revenue: number;
		expenses: number;
		profit: number;
		capital: number;
	};
}

export interface StatusDistribution {
	status: string;
	count: number;
}

export interface FinancialTrend {
	month: string;
	revenue: number;
	costs: number;
	profit: number;
}

export interface ProjectAnalysis {
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
}

export interface FinancialDashboard {
	revenueAndCollections: {
		collected: number;
		uncollected: number;
		totalSales: number;
		projectedCost: number;
	};
	expensesAndCosts: {
		runningCost: number;
		operationalExpenditures: number;
		capitalExpenditures: number;
		opex: number;
		remainingChecks: number;
	};
	profitability: {
		totalGrossProfit: number;
		totalNetProfit: number;
		realizedProfit: number;
		profitMargin: number;
	};
	capitalFunds: {
		totalFund: number;
		planned: number;
		available: number;
		utilization: number;
	};
	projectStatus: {
		totalProjects: number;
		distribution: StatusDistribution[];
	};
	collectionStatus: {
		percentage: number;
		collected: number;
		pending: number;
	};
	expenseBreakdown: {
		runningCostsPercentage: number;
		operationalPercentage: number;
		remainingBudgetPercentage: number;
		totalExpenses: number;
		remainingBudget: number;
	};
	financialTrends: FinancialTrend[];
	revenueVsCostAnalysis: {
		totalRevenue: number;
		totalCosts: number;
		totalProfit: number;
		projects: ProjectAnalysis[];
	};
	topProjects: ProjectAnalysis[];
}

// ============================================
// TRANSACTION SUMMARY TYPES
// ============================================

export interface TransactionSummary {
	totalIncoming: number;
	totalOutgoing: number;
	netBalance: number;
}

// ============================================
// REPORT ITEM TYPES (for charts)
// ============================================

export interface ReportItemCategory {
	id: string;
	name: string;
}

export interface ReportItem {
	id: string;
	itemName: string;
	type: "CAPEX" | "OPEX" | "MISC";
	category: ReportItemCategory | null;
	estimatedTotal: number;
	actualTotal: number | null;
	createdAt: Date;
	status: string;
}

// ============================================
// CHART DATA TYPES (pre-calculated on backend)
// ============================================

export interface CategorySubtotal {
	category: string;
	estimated: number;
	actual: number;
	variance: number;
	variancePercent: number;
}

export interface TypeBreakdown {
	type: "CAPEX" | "OPEX" | "MISC";
	estimated: number;
	actual: number;
	variance: number;
	variancePercent: number;
}

export interface CostTrendPoint {
	date: string;
	estimated: number;
	actual: number;
	cumulativeEstimated: number;
	cumulativeActual: number;
}

export interface ProjectReportChartData {
	// Summary totals
	totalEstimated: number;
	totalActual: number;
	totalVariance: number;
	totalVariancePercent: number;

	// Pre-calculated aggregations
	categorySubtotals: CategorySubtotal[];
	typeBreakdown: TypeBreakdown[];

	// Time series data for trend charts
	costTrend: CostTrendPoint[];

	// Raw items (for detailed views if needed)
	items: ReportItem[];
	itemCount: number;
}

// ============================================
// PROJECT OVERVIEW TYPES
// ============================================

export interface ProjectOverviewTimeline {
	startDate: Date | null;
	endDate: Date | null;
	totalDays: number;
	workingDays: number;
	elapsedDays: number;
	elapsedWorkingDays: number;
	remainingDays: number;
	remainingWorkingDays: number;
	percentElapsed: number;
}

export interface ProjectOverviewScope {
	earnedValue: number; // actualTotal sum from completed/in-progress items
	targetValue: number; // estimatedTotal sum from all items
	percentAchieved: number;
	workItemsTotal: number;
	workItemsCompleted: number;
	workItemsInProgress: number;
	workItemsPending: number;
}

export interface ProjectOverviewData {
	projectId: string;
	projectName: string;
	projectCode: string;
	status: string;
	timeline: ProjectOverviewTimeline;
	scope: ProjectOverviewScope;
}

// ============================================
// METRIC CATEGORY TYPE
// ============================================

export type MetricCategory = keyof typeof METRIC_REGISTRY;
export type MetricName = (typeof METRIC_REGISTRY)[MetricCategory][number];
