/**
 * Metric Module Configuration
 * Centralized configuration for metric calculations, field selections, and constants
 */

// ============================================
// FIELD SELECTIONS - Optimized queries
// ============================================

export const PROJECT_SELECT = {
	minimal: {
		id: true,
		name: true,
		code: true,
		status: true,
	},
	financial: {
		id: true,
		name: true,
		code: true,
		status: true,
		capital: true,
		actualExpenses: true,
	},
	report: {
		id: true,
		name: true,
		code: true,
		status: true,
		capital: true,
		actualExpenses: true,
		startDate: true,
		endDate: true,
		metaData: true,
	},
	full: {
		id: true,
		name: true,
		code: true,
		status: true,
		capital: true,
		actualExpenses: true,
		startDate: true,
		endDate: true,
		metaData: true,
		createdAt: true,
		updatedAt: true,
	},
} as const;

export const ESTIMATION_SELECT = {
	minimal: {
		id: true,
		estimationNumber: true,
		name: true,
		status: true,
	},
	financial: {
		id: true,
		estimationNumber: true,
		name: true,
		version: true,
		status: true,
		marginPercentage: true,
		metaData: true, // Contains: estimatedCost, actualCost, marginAmount, projectedWithMargin, etc.
	},
	report: {
		id: true,
		estimationNumber: true,
		name: true,
		version: true,
		status: true,
		marginPercentage: true,
		metaData: true, // Contains all computed financial values
		createdAt: true,
		updatedAt: true,
	},
} as const;

export const ITEM_SELECT = {
	minimal: {
		id: true,
		itemName: true,
		status: true,
	},
	financial: {
		id: true,
		itemName: true,
		estimatedTotal: true,
		actualTotal: true,
		status: true,
	},
	report: {
		id: true,
		itemName: true,
		estimatedTotal: true,
		actualTotal: true,
		status: true,
		createdAt: true,
		itemType: {
			select: {
				id: true,
				name: true,
			},
		},
		category: {
			select: {
				id: true,
				name: true,
			},
		},
	},
} as const;

// ============================================
// STATUS ENUMS
// ============================================

export const PROJECT_STATUS = {
	ACTIVE: "ACTIVE",
	PENDING: "PENDING",
	COMPLETED: "COMPLETED",
	CANCELLED: "CANCELLED",
	ON_HOLD: "ON_HOLD",
} as const;

export const ESTIMATION_STATUS = {
	DRAFT: "DRAFT",
	PENDING: "PENDING",
	APPROVED: "APPROVED",
	REJECTED: "REJECTED",
	REVISED: "REVISED",
} as const;

export const ITEM_STATUS = {
	PENDING: "PENDING",
	IN_PROGRESS: "IN_PROGRESS",
	COMPLETED: "COMPLETED",
	CANCELLED: "CANCELLED",
} as const;

export const TRANSACTION_TYPE = {
	INCOMING: "INCOMING",
	OUTGOING: "OUTGOING",
} as const;

export const TRANSACTION_STATUS = {
	PENDING: "PENDING",
	CLEARED: "CLEARED",
	BOUNCED: "BOUNCED",
	VOIDED: "VOIDED",
} as const;

// ============================================
// METRIC REGISTRY - Available metrics by category
// ============================================

export const METRIC_REGISTRY = {
	project: [
		"totalProjects",
		"activeProjects",
		"completedProjects",
		"pendingProjects",
		"onHoldProjects",
		"totalCapital",
		"totalActualExpenses",
		"projectStatusDistribution",
	],
	estimation: [
		"totalEstimations",
		"approvedEstimations",
		"pendingEstimations",
		"totalEstimationValue",
		"estimationStatusDistribution",
	],
	transaction: [
		"totalTransactions",
		"totalTransactionAmount",
		"totalRevenue",
		"totalExpenses",
	],
	milestone: [
		"totalMilestones",
		"completedMilestones",
		"pendingMilestones",
		"inProgressMilestones",
		"milestoneProgress",
	],
	item: [
		"totalItems",
		"completedItems",
		"itemProgress",
		"totalCapex",
		"totalOpex",
	],
	dashboard: ["dashboardSummary"],
	financial: [
		"collectedRevenue",
		"uncollectedRevenue",
		"totalSales",
		"projectedCost",
		"totalGrossProfit",
		"totalNetProfit",
		"profitMargin",
		"runningCost",
		"operationalExpenditures",
		"capitalExpenditures",
		"operatingExpenditures",
		"remainingChecks",
		"totalFund",
		"collectionPercentage",
		"financialTrends",
		"revenueVsCostAnalysis",
		"topProjectsByRevenue",
		"financialDashboard",
	],
	report: ["projectReport", "projectReportItems", "projectReportChartData", "projectOverview"],
} as const;

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULTS = {
	FINANCIAL_TRENDS_MONTHS: 6,
	TOP_PROJECTS_LIMIT: 10,
	PAGINATION_LIMIT: 25,
} as const;

// ============================================
// BASE WHERE CLAUSE
// ============================================

export const BASE_WHERE = {
	notDeleted: { isDeleted: false },
} as const;

// ============================================
// ERROR MESSAGES
// ============================================

export const METRIC_ERRORS = {
	METRICS_REQUIRED: "Metrics array is required and cannot be empty",
	GROUPS_REQUIRED: "Groups array is required and cannot be empty",
	PROJECT_ID_REQUIRED: "Project ID is required",
	PROJECT_NOT_FOUND: "Project not found",
	METRIC_NOT_FOUND: "Metric not found or not callable",
	CALCULATION_FAILED: "Failed to calculate metric",
	BATCH_FAILED: "Failed to calculate batch metrics",
	REPORT_FAILED: "Failed to generate project report",
	AVAILABLE_FAILED: "Failed to get available metrics",
} as const;

// ============================================
// SUCCESS MESSAGES
// ============================================

export const METRIC_SUCCESS = {
	METRICS_CALCULATED: "Metrics calculated successfully",
	BATCH_CALCULATED: "Batch metrics calculated successfully",
	REPORT_GENERATED: "Project report generated successfully",
	AVAILABLE_RETRIEVED: "Available metrics retrieved successfully",
} as const;

// ============================================
// HTTP STATUS CODES
// ============================================

export const HTTP_STATUS = {
	OK: 200,
	BAD_REQUEST: 400,
	NOT_FOUND: 404,
	INTERNAL_ERROR: 500,
} as const;
