/**
 * Calculation utilities for automatic financial computations
 */

import { PrismaClient, Prisma } from "../generated/prisma";
import { EstimationMetaData } from "../app/types/common.types";

/**
 * Type for item with selected fields
 */
type ItemSubset = {
	itemType?: { name: string } | null;
	category?: unknown;
	estimatedTotal: number;
	actualTotal: number | null;
	isNewAddition: boolean;
};

/**
 * Type for project progress item
 */
type ProgressItem = {
	status: string;
	estimationPoints: number | null;
	estimatedTotal: number;
};

/**
 * Type for estimation with id
 */
type EstimationWithId = {
	id: string;
};

/**
 * Calculate estimation points based on estimated total price
 * Uses Fibonacci sequence: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89
 *
 * Medium project ranges:
 * - 1 point:  $0 - $1,000
 * - 2 points: $1,000 - $5,000
 * - 3 points: $5,000 - $10,000
 * - 5 points: $10,000 - $25,000
 * - 8 points: $25,000 - $50,000
 * - 13 points: $50,000 - $100,000
 * - 21 points: $100,000 - $250,000
 * - 34 points: $250,000 - $500,000
 * - 55 points: $500,000 - $1,000,000
 * - 89 points: $1,000,000+
 */
export function calculateEstimationPoints(estimatedTotal: number): number {
	if (estimatedTotal < 0) return 1;
	if (estimatedTotal < 1000) return 1;
	if (estimatedTotal < 5000) return 2;
	if (estimatedTotal < 10000) return 3;
	if (estimatedTotal < 25000) return 5;
	if (estimatedTotal < 50000) return 8;
	if (estimatedTotal < 100000) return 13;
	if (estimatedTotal < 250000) return 21;
	if (estimatedTotal < 500000) return 34;
	if (estimatedTotal < 1000000) return 55;
	return 89;
}

/**
 * Calculate item status based on workflow rules
 *
 * Workflow:
 * 1. Just created + (project not active OR estimation not approved) → PENDING
 * 2. Project active + estimation approved → IN_PROGRESS
 * 3. Has actual amount and price → COMPLETED
 */
export function calculateItemStatus(params: {
	hasActualData: boolean;
	isProjectActive: boolean;
	isEstimationApproved: boolean;
}): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" {
	const { hasActualData, isProjectActive, isEstimationApproved } = params;

	// Rule 3: If item has actual data (actualTotal and actualUnitPrice), mark as COMPLETED
	if (hasActualData) {
		return "COMPLETED";
	}

	// Rule 2: If project is active AND estimation is approved, mark as IN_PROGRESS
	if (isProjectActive && isEstimationApproved) {
		return "IN_PROGRESS";
	}

	// Rule 1: Default to PENDING (project not active OR estimation not approved)
	return "PENDING";
}

/**
 * Calculate all estimation financials (margin and projected values)
 */
export function calculateEstimationFinancials(data: { estimatedCost: number; marginPercentage: number }) {
	const marginAmount = (data.estimatedCost * data.marginPercentage) / 100;
	const projectedWithMargin = data.estimatedCost + marginAmount;
	return { marginAmount, projectedWithMargin, projectedProjectNet: data.estimatedCost };
}

/**
 * Calculate budget metrics for a project
 * Returns budget utilization percentages and variance metrics
 */
export function calculateBudgetMetrics(data: {
	capital?: number | null;
	actualExpenses?: number | null;
}) {
	const { capital, actualExpenses } = data;

	// Calculate capital-based budget metrics
	const capitalUtilizationPercentage =
		capital && capital > 0 && actualExpenses !== null && actualExpenses !== undefined
			? Math.round((actualExpenses / capital) * 10000) / 100 // Round to 2 decimal places
			: 0;

	const capitalRemainingPercentage =
		capital && capital > 0 && actualExpenses !== null && actualExpenses !== undefined
			? Math.round(((capital - actualExpenses) / capital) * 10000) / 100 // Round to 2 decimal places
			: 100;

	// Determine budget status based on capital utilization
	let budgetStatus: "healthy" | "warning" | "critical" | "over_budget" = "healthy";
	if (capitalUtilizationPercentage >= 100) {
		budgetStatus = "over_budget";
	} else if (capitalUtilizationPercentage >= 86) {
		budgetStatus = "critical";
	} else if (capitalUtilizationPercentage >= 61) {
		budgetStatus = "warning";
	}

	return {
		capital: {
			utilizationPercentage: capitalUtilizationPercentage,
			remainingPercentage: capitalRemainingPercentage,
			amount: capital || 0,
			spent: actualExpenses || 0,
			remaining: (capital || 0) - (actualExpenses || 0),
		},
		budgetStatus,
		lastCalculated: new Date().toISOString(),
	};
}

/**
 * Update parent estimation with recalculated totals and metadata
 * Call this whenever items are created, updated, or deleted
 */
export async function updateEstimationTotalsAndMetadata(
	prisma: PrismaClient,
	estimationId: string,
) {
	// Fetch all non-deleted items for this estimation
	const items = await prisma.item.findMany({
		where: {
			estimationId: estimationId,
			isDeleted: false,
		},
		select: {
			itemType: {
				select: {
					name: true,
				},
			},
			category: true,
			estimatedTotal: true,
			actualTotal: true,
			isNewAddition: true,
		},
	});

	// Single-pass aggregation for all metrics (O(n) instead of O(12n))
	let estimatedCost = 0;
	let actualCost = 0;
	let totalItemCount = 0;
	let actualItemCount = 0;
	let newAdditionCount = 0;
	let originalContractSum = 0;
	let totalChangeOrders = 0;
	let actualsOriginalSum = 0;
	let actualsChangeOrdersSum = 0;

	// Type breakdown accumulators
	const typeBreakdownAccum = {
		CAPEX: { estimated: 0, actual: 0 },
		OPEX: { estimated: 0, actual: 0 },
		MISC: { estimated: 0, actual: 0 },
	};

	// Category subtotals accumulator
	const categorySubtotals: Record<string, { estimated: number; actual: number }> = {};

	// Single pass through all items
	for (const item of items) {
		totalItemCount++;
		estimatedCost += item.estimatedTotal;
		const itemActual = item.actualTotal || 0;
		actualCost += itemActual;

		// Count items with actuals
		if (item.actualTotal !== null && item.actualTotal !== undefined) {
			actualItemCount++;
		}

		// Track new additions vs original
		if (item.isNewAddition) {
			newAdditionCount++;
			totalChangeOrders += item.estimatedTotal;
			actualsChangeOrdersSum += itemActual;
		} else {
			originalContractSum += item.estimatedTotal;
			actualsOriginalSum += itemActual;
		}

		// Type breakdown (CAPEX/OPEX/MISC)
		const typeName = item.itemType?.name as "CAPEX" | "OPEX" | "MISC" | undefined;
		if (typeName && typeBreakdownAccum[typeName]) {
			typeBreakdownAccum[typeName].estimated += item.estimatedTotal;
			typeBreakdownAccum[typeName].actual += itemActual;
		}

		// Category subtotals
		if (item.category) {
			let categoryName: string | null = null;
			if (typeof item.category === "object" && item.category !== null && "name" in item.category) {
				categoryName = (item.category as { name: string }).name;
			} else if (typeof item.category === "string") {
				categoryName = item.category;
			}

			if (categoryName) {
				if (!categorySubtotals[categoryName]) {
					categorySubtotals[categoryName] = { estimated: 0, actual: 0 };
				}
				categorySubtotals[categoryName].estimated += item.estimatedTotal;
				categorySubtotals[categoryName].actual += itemActual;
			}
		}
	}

	// Extract type breakdown values
	const capexEstimated = typeBreakdownAccum.CAPEX.estimated;
	const capexActual = typeBreakdownAccum.CAPEX.actual;
	const opexEstimated = typeBreakdownAccum.OPEX.estimated;
	const opexActual = typeBreakdownAccum.OPEX.actual;
	const miscEstimated = typeBreakdownAccum.MISC.estimated;
	const miscActual = typeBreakdownAccum.MISC.actual;

	const revisedBudget = estimatedCost; // This matches the total estimated cost

	// Fetch current estimation to get margin percentage and projectId
	const estimation = await prisma.estimation.findUnique({
		where: { id: estimationId },
		select: { marginPercentage: true, projectId: true },
	});

	if (!estimation) {
		throw new Error(`Estimation ${estimationId} not found`);
	}

	// Calculate margin and projected values
	const { marginAmount, projectedWithMargin } = calculateEstimationFinancials({
		estimatedCost,
		marginPercentage: estimation.marginPercentage,
	});

	// Organize everything in metadata (all computed values stored here)
	const metadata: EstimationMetaData = {
		// Computed financial values
		estimatedCost,
		actualCost: actualCost > 0 ? actualCost : null,
		marginAmount,
		projectedWithMargin,
		allocatedAmount: null, // Will be computed from transactions
		remainingAmount: estimatedCost, // Will be updated when transactions exist

		// Category subtotals
		categorySubtotals,

		// Type breakdown
		typeBreakdown: {
			CAPEX: {
				estimated: capexEstimated,
				actual: capexActual,
			},
			OPEX: {
				estimated: opexEstimated,
				actual: opexActual,
			},
			MISC: {
				estimated: miscEstimated,
				actual: miscActual,
			},
		},

		// Item counts
		itemCounts: {
			total: totalItemCount,
			withActuals: actualItemCount,
			newAdditions: newAdditionCount,
		},

		// Budget breakdown
		budgetBreakdown: {
			originalContractSum,
			totalChangeOrders,
			revisedBudget,
			actualsOriginalSum,
			actualsChangeOrdersSum,
			changeOrderCount: newAdditionCount,
		},

		// Timestamp
		lastComputedAt: new Date().toISOString(),
	};

	// Update the estimation with all computed values in metaData
	await prisma.estimation.update({
		where: { id: estimationId },
		data: {
			metaData: metadata as unknown as Prisma.InputJsonValue,
		},
	});

	// Propagate changes to the project level if it exists
	if (estimation.projectId) {
		await updateProjectFinancialMetadata(prisma, estimation.projectId);
	}

	return {
		estimatedCost,
		actualCost: actualCost > 0 ? actualCost : null,
		marginAmount,
		projectedWithMargin,
		metadata,
	};
}

/**
 * Calculate project progress based on items
 * Returns progress percentage and breakdown by status
 * Includes three progress metrics:
 * - Item count progress (completed items / total items)
 * - Estimation points progress (complexity-based using Fibonacci)
 * - Value progress (weighted by estimated amount - higher cost = more value)
 *
 * Optimized: Single query with includes instead of two separate queries
 */
export async function calculateProjectProgress(prisma: PrismaClient, projectId: string) {
	// Single query: Get approved estimations with their items
	const approvedEstimations = await prisma.estimation.findMany({
		where: {
			projectId: projectId,
			status: "APPROVED",
			isDeleted: false,
		},
		select: {
			id: true,
			items: {
				where: { isDeleted: false },
				select: {
					status: true,
					estimationPoints: true,
					estimatedTotal: true,
				},
			},
		},
	});

	if (approvedEstimations.length === 0) {
		return {
			totalItems: 0,
			completedItems: 0,
			inProgressItems: 0,
			pendingItems: 0,
			cancelledItems: 0,
			progressPercentage: 0,
			totalPoints: 0,
			completedPoints: 0,
			pointsProgressPercentage: 0,
			totalValuePoints: 0,
			completedValuePoints: 0,
			valueProgressPercentage: 0,
		};
	}

	// Flatten items from all estimations
	const items = approvedEstimations.flatMap((e) => e.items);

	// Count items by status
	const statusCounts = {
		PENDING: 0,
		IN_PROGRESS: 0,
		COMPLETED: 0,
		CANCELLED: 0,
	};

	let totalPoints = 0;
	let completedPoints = 0;
	let totalValuePoints = 0;
	let completedValuePoints = 0;

	items.forEach((item: ProgressItem) => {
		// Count by status
		if (item.status in statusCounts) {
			statusCounts[item.status as keyof typeof statusCounts]++;
		}

		// Sum estimation points (complexity/effort)
		if (item.estimationPoints != null) {
			totalPoints += item.estimationPoints;
			if (item.status === "COMPLETED") {
				completedPoints += item.estimationPoints;
			}
		}

		// Sum value based on estimated amount (higher cost = higher value weight)
		if (item.estimatedTotal != null) {
			totalValuePoints += item.estimatedTotal;
			if (item.status === "COMPLETED") {
				completedValuePoints += item.estimatedTotal;
			}
		}
	});

	const totalItems = items.length;
	const completedItems = statusCounts.COMPLETED;
	const inProgressItems = statusCounts.IN_PROGRESS;
	const pendingItems = statusCounts.PENDING;
	const cancelledItems = statusCounts.CANCELLED;

	// Calculate progress percentage (excluding cancelled items)
	const activeItems = totalItems - cancelledItems;
	const progressPercentage =
		activeItems > 0 ? Math.round((completedItems / activeItems) * 100) : 0;

	// Calculate points-based progress (complexity/effort)
	const pointsProgressPercentage =
		totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

	// Calculate weighted value progress (cost-weighted - higher estimated cost = more value)
	const valueProgressPercentage =
		totalValuePoints > 0 ? Math.round((completedValuePoints / totalValuePoints) * 100) : 0;

	return {
		totalItems,
		completedItems,
		inProgressItems,
		pendingItems,
		cancelledItems,
		progressPercentage,
		totalPoints,
		completedPoints,
		pointsProgressPercentage,
		totalValuePoints,
		completedValuePoints,
		valueProgressPercentage,
	};
}

/**
 * Update project progress metadata
 * Call this whenever items are created, updated, or deleted
 */
export async function updateProjectProgress(prisma: PrismaClient, projectId: string) {
	const progress = await calculateProjectProgress(prisma, projectId);

	// Fetch current project to get existing metadata
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { metaData: true },
	});

	// Merge progress data with existing metadata
	const existingMetaData = (project?.metaData as Record<string, unknown>) || {};
	const updatedMetaData = {
		...existingMetaData,
		progress,
		lastProgressUpdate: new Date().toISOString(),
	};

	// Update project with merged progress metadata
	await prisma.project.update({
		where: { id: projectId },
		data: {
			metaData: updatedMetaData,
		},
	});

	return progress;
}

/**
 * Update project budget metadata with percentage calculations
 * Call this whenever items are created, updated, or deleted
 * to keep budget percentages in sync
 */
export async function updateProjectBudgetMetadata(prisma: PrismaClient, projectId: string) {
	// Fetch current project with all budget-related fields
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: {
			capital: true,
			actualExpenses: true,
			metaData: true,
		},
	});

	if (!project) {
		throw new Error(`Project ${projectId} not found`);
	}

	// Calculate budget metrics
	const budgetMetrics = calculateBudgetMetrics({
		capital: project.capital,
		actualExpenses: project.actualExpenses,
	});

	// Merge budget metrics with existing metadata
	const existingMetaData = (project.metaData as Record<string, unknown>) || {};
	const updatedMetaData = {
		...existingMetaData,
		budgetMetrics,
	};

	// Update project with merged budget metadata
	await prisma.project.update({
		where: { id: projectId },
		data: {
			metaData: updatedMetaData,
		},
	});

	return budgetMetrics;
}

/**
 * Update project financial metadata with aggregated values from estimations
 * Call this whenever estimations are created, updated, or their status changes
 */
export async function updateProjectFinancialMetadata(prisma: PrismaClient, projectId: string) {
	// Fetch all approved estimations for this project
	const approvedEstimations = await prisma.estimation.findMany({
		where: {
			projectId: projectId,
			status: "APPROVED",
			isDeleted: false,
		},
		select: {
			metaData: true,
		},
	});

	// Calculate total sales and total cost from metaData
	let totalSales = 0;
	let totalCost = 0;

	approvedEstimations.forEach((est: any) => {
		const meta = est.metaData as EstimationMetaData | null;
		if (meta) {
			totalSales += meta.projectedWithMargin || 0;
			totalCost += meta.estimatedCost || 0;
		}
	});

	// Aggregate change order metrics and subtotals across all approved estimations
	let totalOriginalContractSum = 0;
	let totalChangeOrdersValue = 0;
	let totalChangeOrderCount = 0;
	let totalActualsOriginalSum = 0;
	let totalActualsChangeOrdersSum = 0;

	const projectCategorySubtotals: Record<string, { estimated: number; actual: number }> = {};
	const projectTypeBreakdown: Record<string, { estimated: number; actual: number }> = {
		CAPEX: { estimated: 0, actual: 0 },
		OPEX: { estimated: 0, actual: 0 },
		MISC: { estimated: 0, actual: 0 },
	};

	approvedEstimations.forEach((est: any) => {
		const meta = est.metaData as EstimationMetaData | null;
		if (!meta) {
			// Skip estimations without metaData (legacy or not computed yet)
			return;
		}

		// 1. Budget Breakdown
		const budget = meta.budgetBreakdown;
		if (budget) {
			totalOriginalContractSum += budget.originalContractSum || 0;
			totalChangeOrdersValue += budget.totalChangeOrders || 0;
			totalChangeOrderCount += budget.changeOrderCount || 0;
			totalActualsOriginalSum += budget.actualsOriginalSum || 0;
			totalActualsChangeOrdersSum += budget.actualsChangeOrdersSum || 0;
		}

		// 2. Category Subtotals
		const categories = meta.categorySubtotals;
		if (categories) {
			Object.entries(categories).forEach(([name, totals]: [string, any]) => {
				if (!projectCategorySubtotals[name]) {
					projectCategorySubtotals[name] = { estimated: 0, actual: 0 };
				}
				projectCategorySubtotals[name].estimated += totals.estimated || 0;
				projectCategorySubtotals[name].actual += totals.actual || 0;
			});
		}

		// 3. Type Breakdown
		const types = meta.typeBreakdown;
		if (types) {
			Object.entries(types).forEach(([name, totals]: [string, any]) => {
				if (projectTypeBreakdown[name]) {
					projectTypeBreakdown[name].estimated += totals.estimated || 0;
					projectTypeBreakdown[name].actual += totals.actual || 0;
				}
			});
		}
	});

	// Fetch current project to get existing metadata
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { metaData: true },
	});

	// Merge financial data with existing metadata
	const existingMetaData = (project?.metaData as Record<string, unknown>) || {};
	const updatedMetaData = {
		...existingMetaData,
		financial: {
			totalSales,
			totalCost,
			categorySubtotals: projectCategorySubtotals,
			typeBreakdown: projectTypeBreakdown,
			budgetBreakdown: {
				originalContractSum: totalOriginalContractSum,
				totalChangeOrders: totalChangeOrdersValue,
				revisedBudget: totalCost,
				actualsOriginalSum: totalActualsOriginalSum,
				actualsChangeOrdersSum: totalActualsChangeOrdersSum,
				changeOrderCount: totalChangeOrderCount,
			},
			lastFinancialUpdate: new Date().toISOString(),
		},
	};

	// Update project with merged financial metadata
	await prisma.project.update({
		where: { id: projectId },
		data: {
			metaData: updatedMetaData,
		},
	});

	return {
		totalSales,
		totalCost,
	};
}

/**
 * Update all item statuses when estimation is approved
 * Call this when estimation status changes to APPROVED
 *
 * Optimized: Uses bulk updateMany instead of individual updates (N+1 → max 4 queries)
 */
export async function updateItemStatuses(prisma: PrismaClient, estimationId: string) {
	// Get estimation with project
	const estimation = await prisma.estimation.findUnique({
		where: { id: estimationId },
		include: { project: true },
	});

	if (!estimation) {
		throw new Error(`Estimation ${estimationId} not found`);
	}

	const isProjectActive = estimation.project.status === "ACTIVE";
	const isEstimationApproved = estimation.status === "APPROVED";

	// Get all non-deleted items for this estimation
	const items = await prisma.item.findMany({
		where: {
			estimationId: estimationId,
			isDeleted: false,
		},
		select: {
			id: true,
			status: true,
			actualUnitPrice: true,
			actualTotal: true,
		},
	});

	// Group items by their target status
	const statusGroups: Record<string, string[]> = {
		PENDING: [],
		IN_PROGRESS: [],
		COMPLETED: [],
	};

	for (const item of items) {
		const hasActualData =
			item.actualUnitPrice !== null &&
			item.actualUnitPrice !== undefined &&
			item.actualTotal !== null;

		const newStatus = calculateItemStatus({
			hasActualData,
			isProjectActive,
			isEstimationApproved,
		});

		// Only include if status changed
		if (item.status !== newStatus) {
			statusGroups[newStatus].push(item.id);
		}
	}

	// Bulk update each status group (max 3 queries instead of N)
	const updatePromises = Object.entries(statusGroups)
		.filter(([_, ids]) => ids.length > 0)
		.map(([status, ids]) =>
			prisma.item.updateMany({
				where: { id: { in: ids } },
				data: { status: status as "PENDING" | "IN_PROGRESS" | "COMPLETED" },
			})
		);

	await Promise.all(updatePromises);
}

/**
 * Calculate milestone status based on item statuses
 *
 * Rules (based on ACTIVE items only - excludes CANCELLED):
 * - No items or all CANCELLED → NOT_STARTED
 * - All active items COMPLETED → COMPLETED
 * - Any active item IN_PROGRESS, or mix of COMPLETED/IN_PROGRESS/PENDING → IN_PROGRESS
 * - All active items PENDING → NOT_STARTED
 */
export function calculateMilestoneStatus(items: Array<{ status: string }>):
	"NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ON_HOLD" {

	if (items.length === 0) {
		return "NOT_STARTED";
	}

	const statusCounts = {
		PENDING: 0,
		IN_PROGRESS: 0,
		COMPLETED: 0,
		CANCELLED: 0,
	};

	items.forEach((item) => {
		if (item.status in statusCounts) {
			statusCounts[item.status as keyof typeof statusCounts]++;
		}
	});

	const total = items.length;
	const activeItems = total - statusCounts.CANCELLED;

	// All items are cancelled
	if (statusCounts.CANCELLED === total) {
		return "CANCELLED";
	}

	// No active items (shouldn't happen if above check passes, but safety)
	if (activeItems === 0) {
		return "NOT_STARTED";
	}

	// All active items are completed
	if (statusCounts.COMPLETED === activeItems) {
		return "COMPLETED";
	}

	// Any active item in progress OR some completed (but not all)
	if (statusCounts.IN_PROGRESS > 0 || statusCounts.COMPLETED > 0) {
		return "IN_PROGRESS";
	}

	// All active items are pending
	if (statusCounts.PENDING === activeItems) {
		return "NOT_STARTED";
	}

	// Default to IN_PROGRESS for any other mixed states
	return "IN_PROGRESS";
}

/**
 * Update milestone progress and status based on its items
 * Call this whenever items are created, updated, or deleted that belong to a milestone
 *
 * Only updates the SPECIFIC milestone that the item belongs to, not all milestones
 *
 * @param prisma - PrismaClient instance
 * @param milestoneId - The ID of the milestone to update
 * @returns Updated milestone progress data or null if milestone not found
 */
export async function updateMilestoneProgress(
	prisma: PrismaClient,
	milestoneId: string,
): Promise<{
	progressPercent: number;
	status: string;
	itemCounts: {
		total: number;
		completed: number;
		inProgress: number;
		pending: number;
		cancelled: number;
	};
} | null> {
	// Verify milestone exists
	const milestone = await prisma.milestone.findFirst({
		where: {
			id: milestoneId,
			isDeleted: false
		},
	});

	if (!milestone) {
		return null;
	}

	// Get all non-deleted items for this milestone
	const items = await prisma.item.findMany({
		where: {
			milestoneId: milestoneId,
			isDeleted: false,
		},
		select: {
			status: true,
		},
	});

	// Count items by status
	const statusCounts = {
		PENDING: 0,
		IN_PROGRESS: 0,
		COMPLETED: 0,
		CANCELLED: 0,
	};

	items.forEach((item) => {
		if (item.status in statusCounts) {
			statusCounts[item.status as keyof typeof statusCounts]++;
		}
	});

	const totalItems = items.length;
	const completedItems = statusCounts.COMPLETED;
	const cancelledItems = statusCounts.CANCELLED;

	// Calculate progress percentage (excluding cancelled items)
	const activeItems = totalItems - cancelledItems;
	const progressPercentage = activeItems > 0
		? Math.round((completedItems / activeItems) * 100)
		: 0;

	// Calculate new milestone status
	const newStatus = calculateMilestoneStatus(items);

	// Determine completedDate
	let completedDate: Date | null = null;
	if (newStatus === "COMPLETED" && milestone.status !== "COMPLETED") {
		// Just completed - set the date
		completedDate = new Date();
	} else if (newStatus === "COMPLETED" && milestone.completedDate) {
		// Already completed - keep existing date
		completedDate = milestone.completedDate;
	}

	// Update the milestone
	await prisma.milestone.update({
		where: { id: milestoneId },
		data: {
			progressPercent: progressPercentage,
			status: newStatus,
			...(completedDate && { completedDate }),
			// Clear completedDate if no longer completed
			...(newStatus !== "COMPLETED" && milestone.completedDate && { completedDate: null }),
		},
	});

	return {
		progressPercent: progressPercentage,
		status: newStatus,
		itemCounts: {
			total: totalItems,
			completed: completedItems,
			inProgress: statusCounts.IN_PROGRESS,
			pending: statusCounts.PENDING,
			cancelled: cancelledItems,
		},
	};
}

/**
 * Update project's actualExpenses based on approved estimations
 * Call this whenever items are updated in an APPROVED estimation
 */
export async function updateProjectFinancials(prisma: PrismaClient, estimationId: string) {
	// Get the estimation to find the projectId
	const estimation = await prisma.estimation.findUnique({
		where: { id: estimationId },
		select: {
			projectId: true,
			status: true,
		},
	});

	if (!estimation) {
		throw new Error(`Estimation ${estimationId} not found`);
	}

	// Get all APPROVED estimations for this project
	const approvedEstimations = await prisma.estimation.findMany({
		where: {
			projectId: estimation.projectId,
			status: "APPROVED",
			isDeleted: false,
		},
		select: {
			metaData: true,
		},
	});

	// Sum up all actualCost from approved estimations (read from metaData)
	const totalActualExpenses = approvedEstimations.reduce((sum: number, est: any) => {
		const meta = est.metaData as EstimationMetaData | null;
		return sum + (meta?.actualCost || 0);
	}, 0);

	// Update the project
	await prisma.project.update({
		where: { id: estimation.projectId },
		data: {
			actualExpenses: totalActualExpenses,
		},
	});

	return {
		actualExpenses: totalActualExpenses,
	};
}
