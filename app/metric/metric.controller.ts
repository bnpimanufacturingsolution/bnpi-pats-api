/**
 * Metric Controller
 * HTTP request handlers for metric endpoints
 */

import { Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { createMetricService } from "./metric.service";
import {
	METRIC_ERRORS,
	METRIC_SUCCESS,
	HTTP_STATUS,
} from "./metric.config";
import type {
	MetricRequest,
	MetricFilter,
	MetricResponse,
	MetricResult,
} from "./metric.types";
import { METRIC_REGISTRY } from "./metric.config";
import { AuthRequest } from "../../middleware/verifyToken";

// ============================================
// RESPONSE HELPERS
// ============================================

const successResponse = <T>(
	res: Response,
	data: T,
	metadata?: Record<string, unknown>
): Response => {
	return res.status(HTTP_STATUS.OK).json({
		status: "success",
		data,
		...(metadata && { metadata }),
	});
};

const errorResponse = (
	res: Response,
	status: number,
	message: string,
	error?: string
): Response => {
	return res.status(status).json({
		status: "error",
		message,
		...(error && { error }),
	});
};

// ============================================
// CONTROLLER FACTORY
// ============================================

export const controller = (prisma: PrismaClient) => {
	const metricService = createMetricService(prisma);

	/**
	 * POST /api/metric
	 * Calculate requested metrics
	 *
	 * @body {
	 *   model: string        - Model name (e.g., "project", "financial", "estimation")
	 *   metric: string[]     - Array of metric names to calculate
	 *   filter?: Array<{     - Optional array of filters
	 *     startDate?: string
	 *     endDate?: string
	 *     projectId?: string
	 *     status?: string
	 *   }>
	 * }
	 */
	const calculateMetrics = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction
	): Promise<Response | void> => {
		try {
			const workspaceId = req.workspaceId!;
			const { model, metric = [], filter = [] }: MetricRequest = req.body;

			// Validate model is provided
			if (!model) {
				return errorResponse(
					res,
					HTTP_STATUS.BAD_REQUEST,
					"Model is required"
				);
			}

			// Validate model exists in registry
			const availableModels = Object.keys(METRIC_REGISTRY);
			if (!availableModels.includes(model)) {
				return errorResponse(
					res,
					HTTP_STATUS.BAD_REQUEST,
					`Invalid model. Available models: ${availableModels.join(", ")}`
				);
			}

			// Validate metric array
			if (!Array.isArray(metric) || metric.length === 0) {
				return errorResponse(
					res,
					HTTP_STATUS.BAD_REQUEST,
					METRIC_ERRORS.METRICS_REQUIRED
				);
			}

			// Validate requested metrics exist for the model
			const modelMetrics = METRIC_REGISTRY[model as keyof typeof METRIC_REGISTRY];
			const invalidMetrics = metric.filter(m => !modelMetrics.includes(m as never));
			if (invalidMetrics.length > 0) {
				return errorResponse(
					res,
					HTTP_STATUS.BAD_REQUEST,
					`Invalid metrics for model "${model}": ${invalidMetrics.join(", ")}. Available: ${modelMetrics.join(", ")}`
				);
			}

			// Merge filters into single filter object (use first filter or empty object)
			// Always include workspaceId for data isolation
			const mergedFilter: MetricFilter = filter.length > 0
				? { ...filter.reduce((acc, f) => ({ ...acc, ...f }), {}), workspaceId }
				: { workspaceId };

			const results: MetricResult = {};
			const errors: Record<string, string> = {};

			// Process only requested metrics in parallel
			const metricPromises = metric.map(async (metricName) => {
				try {
					const method = (metricService as unknown as Record<string, unknown>)[metricName];
					if (typeof method === "function") {
						const result = await (method as (f: MetricFilter) => Promise<unknown>).call(
							metricService,
							mergedFilter
						);
						return { metricName, result, error: null };
					}
					return { metricName, result: null, error: METRIC_ERRORS.METRIC_NOT_FOUND };
				} catch (err) {
					const error = err instanceof Error ? err.message : METRIC_ERRORS.CALCULATION_FAILED;
					return { metricName, result: null, error };
				}
			});

			const resolved = await Promise.all(metricPromises);

			// Only include successfully calculated metrics in results
			resolved.forEach(({ metricName, result, error }) => {
				if (error) {
					errors[metricName] = error;
				} else {
					results[metricName] = result;
				}
			});

			return successResponse(res, results, {
				model,
				requestedMetrics: metric.length,
				successfulMetrics: Object.keys(results).length,
				failedMetrics: Object.keys(errors).length,
				filter: mergedFilter,
				...(Object.keys(errors).length > 0 && { errors }),
			});
		} catch (error) {
			console.error("Metric calculation error:", error);
			const message = error instanceof Error ? error.message : METRIC_ERRORS.CALCULATION_FAILED;
			return errorResponse(res, HTTP_STATUS.INTERNAL_ERROR, METRIC_ERRORS.CALCULATION_FAILED, message);
		}
	};

	/**
	 * GET /api/metric/available
	 * Get list of available metrics per model
	 */
	const getAvailableMetrics = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction
	): Promise<Response | void> => {
		try {
			const availableMetrics = metricService.getAvailableMetrics();

			return successResponse(res, availableMetrics, {
				models: Object.keys(availableMetrics),
				totalMetrics: Object.values(availableMetrics).flat().length,
			});
		} catch (error) {
			console.error("Get available metrics error:", error);
			const message = error instanceof Error ? error.message : METRIC_ERRORS.AVAILABLE_FAILED;
			return errorResponse(res, HTTP_STATUS.INTERNAL_ERROR, METRIC_ERRORS.AVAILABLE_FAILED, message);
		}
	};

	/**
	 * GET /api/metric/project/:projectId/report
	 * Get comprehensive project report data
	 */
	const getProjectReport = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction
	): Promise<Response | void> => {
		try {
			const workspaceId = req.workspaceId!;
			const { projectId } = req.params;

			if (!projectId) {
				return errorResponse(
					res,
					HTTP_STATUS.BAD_REQUEST,
					METRIC_ERRORS.PROJECT_ID_REQUIRED
				);
			}

			const reportData = await metricService.projectReport({ projectId, workspaceId });

			return successResponse(res, reportData, {
				projectId,
				generatedAt: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Project report error:", error);

			if (error instanceof Error && error.message === METRIC_ERRORS.PROJECT_NOT_FOUND) {
				return errorResponse(res, HTTP_STATUS.NOT_FOUND, METRIC_ERRORS.PROJECT_NOT_FOUND);
			}

			const message = error instanceof Error ? error.message : METRIC_ERRORS.REPORT_FAILED;
			return errorResponse(res, HTTP_STATUS.INTERNAL_ERROR, METRIC_ERRORS.REPORT_FAILED, message);
		}
	};

	/**
	 * GET /api/metric/project/:projectId/overview
	 * Get project overview metrics (timeline, scope, cost)
	 */
	const getProjectOverview = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction
	): Promise<Response | void> => {
		try {
			const workspaceId = req.workspaceId!;
			const { projectId } = req.params;

			if (!projectId) {
				return errorResponse(
					res,
					HTTP_STATUS.BAD_REQUEST,
					METRIC_ERRORS.PROJECT_ID_REQUIRED
				);
			}

			const overviewData = await metricService.projectOverview({ projectId, workspaceId });

			return successResponse(res, overviewData, {
				projectId,
				generatedAt: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Project overview error:", error);

			if (error instanceof Error && error.message === METRIC_ERRORS.PROJECT_NOT_FOUND) {
				return errorResponse(res, HTTP_STATUS.NOT_FOUND, METRIC_ERRORS.PROJECT_NOT_FOUND);
			}

			const message = error instanceof Error ? error.message : "Failed to generate project overview";
			return errorResponse(res, HTTP_STATUS.INTERNAL_ERROR, "Failed to generate project overview", message);
		}
	};

	return {
		calculateMetrics,
		getAvailableMetrics,
		getProjectReport,
		getProjectOverview,
	};
};
