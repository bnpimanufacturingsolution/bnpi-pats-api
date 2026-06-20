/**
 * Metric Module
 * Exports route factory and public types/configs
 */

import { PrismaClient } from "../../generated/prisma";
import { metricRoute } from "./metric.route";

// Export route factory
module.exports = (prisma: PrismaClient) => {
	return metricRoute(prisma);
};

// Export types for external use
export type {
	MetricFilters,
	MetricRequest,
	MetricResponse,
	ProjectReportData,
	DashboardSummary,
	FinancialDashboard,
	FinancialTrend,
	ProjectAnalysis,
	StatusDistribution,
} from "./metric.types";

// Export config constants for external use
export {
	METRIC_REGISTRY,
	PROJECT_STATUS,
	ESTIMATION_STATUS,
	ITEM_STATUS,
	TRANSACTION_TYPE,
	TRANSACTION_STATUS,
	DEFAULTS,
} from "./metric.config";

// Export service for direct use if needed
export { MetricService } from "./metric.service";
export { MetricRepository } from "./metric.repository";
