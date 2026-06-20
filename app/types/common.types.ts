/**
 * Generic object type for dynamic data structures
 */
export type GenericObject = Record<string, unknown>;

/**
 * JSON Value type
 */
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

/**
 * JSON Object type
 */
export interface JSONObject {
	[key: string]: JSONValue;
}

/**
 * JSON Array type
 */
export type JSONArray = JSONValue[];

/**
 * Metric Configuration
 */
export interface MetricConfig {
	pipeline: Array<Record<string, unknown>>;
	description?: string;
	category?: string;
}

/**
 * Postman Collection Item
 */
export interface PostmanItem {
	name: string;
	request: {
		method: string;
		url: string | { raw: string; protocol?: string; host?: string[]; path?: string[] };
		header?: Array<{ key: string; value: string }>;
		body?: {
			mode: string;
			raw?: string;
			urlencoded?: Array<{ key: string; value: string }>;
		};
	};
	response?: unknown[];
}

/**
 * Postman Collection Folder
 */
export interface PostmanFolder {
	name: string;
	item: (PostmanItem | PostmanFolder)[];
}

/**
 * Error with code property (Prisma errors)
 */
export interface ErrorWithCode extends Error {
	code?: string;
}

/**
 * Query fields parameter type
 */
export type QueryFields = "full" | "minimal" | "custom";

/**
 * Response data type for API responses
 */
export interface ResponseData {
	[key: string]: unknown;
}

/**
 * Estimation MetaData - Computed/cached values
 * These values are derived from transactions and items, not stored as separate fields
 * Recomputed on transaction/item changes
 */
export interface EstimationMetaData {
	// Index signature for Prisma JSON compatibility
	[key: string]: unknown;

	// Computed financial values
	estimatedCost: number; // SUM of item.estimatedTotal
	actualCost: number | null; // SUM of cleared transactions
	marginAmount: number; // estimatedCost * marginPercentage / 100
	projectedWithMargin: number; // estimatedCost + marginAmount
	allocatedAmount: number | null; // SUM of all transactions
	remainingAmount: number | null; // estimatedCost - allocatedAmount

	// Category subtotals
	categorySubtotals: Record<
		string,
		{
			estimated: number;
			actual: number;
		}
	>;

	// Type breakdown (CAPEX/OPEX/MISC)
	typeBreakdown: {
		CAPEX: { estimated: number; actual: number };
		OPEX: { estimated: number; actual: number };
		MISC: { estimated: number; actual: number };
	};

	// Item counts
	itemCounts: {
		total: number;
		withActuals: number;
		newAdditions: number;
	};

	// Budget breakdown
	budgetBreakdown: {
		originalContractSum: number;
		totalChangeOrders: number;
		revisedBudget: number;
		actualsOriginalSum: number;
		actualsChangeOrdersSum: number;
		changeOrderCount: number;
	};

	// Timestamp
	lastComputedAt: string;
}
