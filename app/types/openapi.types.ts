/**
 * OpenAPI Schema Object
 */
export interface OpenAPISchema {
	type?: string;
	properties?: Record<string, OpenAPISchema>;
	items?: OpenAPISchema;
	required?: string[];
	enum?: unknown[];
	format?: string;
	description?: string;
	example?: unknown;
	[key: string]: unknown;
}

/**
 * OpenAPI Parameter Object
 */
export interface OpenAPIParameter {
	name: string;
	in: "query" | "path" | "header" | "cookie";
	required?: boolean;
	schema?: OpenAPISchema;
	description?: string;
	example?: unknown;
}

/**
 * OpenAPI Request Body Content
 */
export interface OpenAPIContent {
	schema?: OpenAPISchema;
	example?: unknown;
	examples?: Record<string, { value?: unknown; summary?: string; description?: string }>;
}

/**
 * OpenAPI Request Body
 */
export interface OpenAPIRequestBody {
	required?: boolean;
	content?: Record<string, OpenAPIContent>;
	description?: string;
}

/**
 * OpenAPI Response Object
 */
export interface OpenAPIResponse {
	description?: string;
	content?: Record<string, OpenAPIContent>;
	headers?: Record<string, OpenAPIParameter>;
}

/**
 * OpenAPI Operation Object
 */
export interface OpenAPIOperation {
	summary?: string;
	description?: string;
	operationId?: string;
	tags?: string[];
	parameters?: OpenAPIParameter[];
	requestBody?: OpenAPIRequestBody;
	responses?: Record<string, OpenAPIResponse>;
	deprecated?: boolean;
	security?: Array<Record<string, string[]>>;
	[key: string]: unknown;
}

/**
 * OpenAPI Path Item
 */
export interface OpenAPIPathItem {
	get?: OpenAPIOperation;
	post?: OpenAPIOperation;
	put?: OpenAPIOperation;
	patch?: OpenAPIOperation;
	delete?: OpenAPIOperation;
	options?: OpenAPIOperation;
	head?: OpenAPIOperation;
	[key: string]: unknown;
}

/**
 * OpenAPI Specification
 */
export interface OpenAPISpec {
	openapi?: string;
	info?: {
		title: string;
		version: string;
		description?: string;
	};
	servers?: Array<{ url: string; description?: string }>;
	paths?: Record<string, OpenAPIPathItem>;
	components?: {
		schemas?: Record<string, OpenAPISchema>;
		responses?: Record<string, OpenAPIResponse>;
		parameters?: Record<string, OpenAPIParameter>;
		securitySchemes?: Record<string, unknown>;
	};
	security?: Array<Record<string, string[]>>;
	tags?: Array<{ name: string; description?: string }>;
}

/**
 * Simplified Endpoint for Documentation
 */
export interface SimplifiedEndpoint {
	id: string;
	method: string;
	url: string;
	summary?: string;
	description?: string;
	tags?: string[];
	deprecated?: boolean;
	security?: Array<Record<string, string[]>>;
	contentTypes?: string[];
	pathParams?: Array<{
		name: string;
		required?: boolean;
		schema?: OpenAPISchema;
		description?: string;
	}>;
	queryParams?: Array<{
		name: string;
		required?: boolean;
		schema?: OpenAPISchema;
		description?: string;
	}>;
	requestBody?: {
		required?: boolean;
		schema?: OpenAPISchema;
		example?: unknown;
		contentTypes?: string[];
	};
	responses?: Record<
		string,
		{
			description?: string;
			schema?: OpenAPISchema;
			example?: unknown;
			contentTypes?: string[];
		}
	>;
	paginationHints?: {
		hasPaginationParams: boolean;
		hasSearchParam: boolean;
		hasSortParams: boolean;
	};
}

/**
 * Endpoint from App Instance
 */
export interface AppEndpoint {
	path: string;
	method: string;
	module?: string;
	handlers?: string[];
	middlewares?: string[];
	summary?: string;
	tags?: string[];
}
