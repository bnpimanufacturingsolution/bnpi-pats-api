/**
 * Metric Routes
 * API endpoint definitions for metric module
 */

import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { controller } from "./metric.controller";
import verifyToken from "../../middleware/verifyToken";
import { validateObjectId } from "../../middleware/validate";

export const metricRoute = (prisma: PrismaClient) => {
	const router = Router();
	const metricController = controller(prisma);

	// ============================================
	// METRIC CALCULATION ROUTES
	// ============================================

	/**
	 * POST /api/metric
	 * Calculate requested metrics for a specific model
	 *
	 * @body {
	 *   model: string         - Model name (e.g., "project", "financial", "estimation")
	 *   metric: string[]      - Array of metric function names to calculate
	 *   filter?: Array<{      - Optional array of filters (date range, etc.)
	 *     startDate?: string  - Start date for filtering (e.g., "2024-12-01")
	 *     endDate?: string    - End date for filtering (e.g., "2024-12-30")
	 *     projectId?: string
	 *     status?: string
	 *   }>
	 * }
	 *
	 * @example
	 * {
	 *   "model": "project",
	 *   "metric": ["totalProjects", "activeProjects"],
	 *   "filter": [{ "startDate": "2024-12-01", "endDate": "2024-12-30" }]
	 * }
	 *
	 * @returns Only the requested metrics - if a metric is not included, it won't be returned
	 */
	router.post("/", verifyToken, metricController.calculateMetrics);

	// ============================================
	// METRIC INFO ROUTES
	// ============================================

	/**
	 * GET /api/metric/available
	 * Get list of all available metrics organized by category
	 */
	router.get("/available", verifyToken, metricController.getAvailableMetrics);

	// ============================================
	// PROJECT REPORT ROUTES
	// ============================================

	/**
	 * GET /api/metric/project/:projectId/report
	 * Get comprehensive project report data
	 *
	 * Returns:
	 * - Project details
	 * - Current estimation with categorySubtotals and typeBreakdown
	 * - Summary metrics (items, transactions, progress)
	 */
	router.get(
		"/project/:projectId/report",
		verifyToken,
		validateObjectId("projectId"),
		metricController.getProjectReport
	);

	/**
	 * GET /api/metric/project/:projectId/overview
	 * Get project overview metrics for dashboard display
	 *
	 * Returns:
	 * - Timeline: startDate, endDate, workingDays, elapsed, remaining
	 * - Scope: earnedValue, targetValue, percentAchieved, workItems counts
	 * - Cost: spent, budget, remaining, percentSpent
	 */
	router.get(
		"/project/:projectId/overview",
		verifyToken,
		validateObjectId("projectId"),
		metricController.getProjectOverview
	);

	return router;
};
