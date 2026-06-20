import { AuthenticatedRequest, ErrorWithCode } from "../types";
import { Request, Response, NextFunction } from "express";
import { createLogger } from "../../helper/logger";
import {
	OpenAPISpec,
	SimplifiedEndpoint,
	OpenAPIRequestBody,
	OpenAPIResponse,
	OpenAPISchema,
	ExpressApp,
} from "../types";

import { generateEndpointsFromApp, generateEndpointsFromAppInstance, Endpoint } from "./endpointGenerator";
import * as fs from "fs";
import * as path from "path";
import buildSpec from "../../docs/openApiSpecs";

const docsLogger = createLogger("docs");

function extractRequestBody(
	requestBody: OpenAPIRequestBody,
): SimplifiedEndpoint["requestBody"] | undefined {
	if (!requestBody || !requestBody.content) return undefined;
	const contentTypes = Object.keys(requestBody.content || {});
	const json = requestBody.content["application/json"] || requestBody.content[contentTypes[0]];
	if (!json) {
		return { required: requestBody.required, contentTypes };
	}
	let example: unknown | undefined = undefined;
	if (json.example) example = json.example;
	else if (json.examples) {
		const first = Object.values(json.examples)[0];
		if (first && typeof first === "object" && first !== null && "value" in first) {
			example = first.value;
		}
	}
	return {
		required: requestBody.required,
		schema: json.schema,
		example,
		contentTypes,
	};
}

function extractResponses(
	responses?: Record<string, OpenAPIResponse>,
): SimplifiedEndpoint["responses"] {
	const result: SimplifiedEndpoint["responses"] = {};
	if (!responses || typeof responses !== "object") return result;
	for (const [status, resp] of Object.entries(responses)) {
		const content = resp?.content || {};
		const contentTypes = Object.keys(content);
		const json = content["application/json"] || content[contentTypes[0]] || {};
		let example: unknown | undefined = undefined;
		if (json.example) example = json.example;
		else if (json.examples) {
			const first = Object.values(json.examples)[0];
			if (first && typeof first === "object" && first !== null && "value" in first) {
				example = first.value;
			}
		}
		result[status] = {
			description: resp?.description,
			schema: json.schema as OpenAPISchema | undefined,
			example,
			contentTypes,
		};
	}
	return result;
}

function toFileSlug(tag: string): string {
	return tag
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function convertToXML(data: unknown, rootName: string = "endpoints"): string {
	const convertObject = (obj: unknown, name: string = "item"): string => {
		if (Array.isArray(obj)) {
			return obj.map((item) => convertObject(item, name)).join("");
		}

		if (typeof obj === "object" && obj !== null) {
			const entries = Object.entries(obj);
			if (entries.length === 0) return `<${name}/>`;

			const content = entries
				.map(([key, value]) => {
					if (Array.isArray(value)) {
						return value.map((item) => convertObject(item, key)).join("");
					}
					return `<${key}>${convertObject(value)}</${key}>`;
				})
				.join("");

			return `<${name}>${content}</${name}>`;
		}

		const escaped = String(obj)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");

		return `<${name}>${escaped}</${name}>`;
	};

	return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>${convertObject(data)}</${rootName}>`;
}

const generateSwaggerPaths = (endpoints: Endpoint[]) => {
	const paths: Record<string, Record<string, unknown>> = {};

	endpoints.forEach((endpoint) => {
		const path = endpoint.url;
		const method = endpoint.method.toLowerCase();

		if (!paths[path]) {
			paths[path] = {};
		}

		paths[path][method] = {
			summary: endpoint.summary,
			description: endpoint.description,
			tags: endpoint.tags,
			responses: {
				"200": {
					description: "Success",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: { type: "string" },
									message: { type: "string" },
									data: { type: "object" },
									timestamp: { type: "string", format: "date-time" },
								},
							},
						},
					},
				},
				"400": {
					description: "Bad Request",
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/Error" },
						},
					},
				},
				"500": {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/Error" },
						},
					},
				},
			},
		};
	});

	return paths;
};

export const controller = (appInstance?: ExpressApp) => {
	const generatePostmanItems = (endpoints: Endpoint[], baseUrl: string) => {
		const items: Array<{
			name: string;
			item: Array<{
				name: string;
				request: {
					method: string;
					header: Array<{ key: string; value: string; type: string }>;
					url: { raw: string; host: string[]; path: string[] };
					description?: string;
				};
				response: unknown[];
			}>;
		}> = [];
		const groupedEndpoints: Record<string, Endpoint[]> = {};

		endpoints.forEach((endpoint) => {
			const tag = endpoint.tags[0] || "API";
			if (!groupedEndpoints[tag]) {
				groupedEndpoints[tag] = [];
			}
			groupedEndpoints[tag].push(endpoint);
		});

		Object.keys(groupedEndpoints).forEach((tag) => {
			const groupItems = groupedEndpoints[tag].map((endpoint) => ({
				name: endpoint.summary,
				request: {
					method: endpoint.method,
					header: [
						{
							key: "Content-Type",
							value: "application/json",
							type: "text",
						},
					],
					url: {
						raw: `{{baseUrl}}${endpoint.url}`,
						host: ["{{baseUrl}}"],
						path: endpoint.url.split("/").filter((p: string) => p),
					},
					description: endpoint.description,
				},
				response: [],
			}));

			items.push({
				name: tag,
				item: groupItems,
			});
		});

		return items;
	};

	const sendError = (
		res: Response,
		status: number,
		message: string,
		code: string,
		errors: unknown[] = [],
	) => {
		res.status(status).json({
			status: "error",
			message,
			code,
			errors,
			timestamp: new Date().toISOString(),
		});
	};

	const sendSuccess = (res: Response, message: string, data?: unknown, status: number = 200) => {
		res.status(status).json({
			status: "success",
			message,
			...(data !== undefined && { data }),
			timestamp: new Date().toISOString(),
		});
	};

	const exportDocs = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
		const { format = "json", tag, method } = req.query;

		try {
			const endpoints = appInstance
				? await generateEndpointsFromAppInstance(appInstance)
				: await generateEndpointsFromApp(req);

			let filteredEndpoints = endpoints;
			if (tag && typeof tag === "string") {
				const tagFilter = tag.toLowerCase();
				filteredEndpoints = filteredEndpoints.filter((e) =>
					(e.tags || []).some((t: string) => t.toLowerCase() === tagFilter),
				);
			}

			if (method && typeof method === "string") {
				const methodFilter = method.toUpperCase();
				filteredEndpoints = filteredEndpoints.filter(
					(e) => (e.method || "").toUpperCase() === methodFilter,
				);
			}

			if (format === "json") {
				res.status(200).json({
					endpoints: filteredEndpoints,
					total: filteredEndpoints.length,
					filters: {
						tag: tag || null,
						method: method || null,
					},
					generatedAt: new Date().toISOString(),
				});
				return;
			} else if (format === "text") {
				const longestMethod = Math.max(
					6,
					...filteredEndpoints.map((e) => (e.method ? e.method.length : 0)),
				);
				const textOutput = filteredEndpoints
					.map((e) => {
						const method = (e.method || "").toUpperCase().padEnd(longestMethod, " ");
						const line = `${method}  ${e.url}`;
						return e.summary ? `${line}  - ${e.summary}` : line;
					})
					.join("\n");

				res.setHeader("Content-Type", "text/plain");
				res.status(200).send(textOutput);
				return;
			} else {
				sendError(
					res,
					400,
					"Invalid format. Supported formats: json, text",
					"VALIDATION_ERROR",
				);
				return;
			}
		} catch (error: unknown) {
			docsLogger.error(`Error generating docs: ${error}`);
			sendError(res, 500, "Failed to generate documentation", "INTERNAL_ERROR");
			return;
		}
	};

	const getSwagger = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
		try {
			const endpoints = appInstance
				? await generateEndpointsFromAppInstance(appInstance)
				: await generateEndpointsFromApp(req);

			const swagger = {
				openapi: "3.1.0",
				info: {
					title: "Bandai PATS API",
					version: "1.0.0",
					description:
						"Welcome to the Bandai PATS API documentation. This REST API powers Bandai PATS backend services.",
					contact: {
						name: "Bandai PATS Support",
						email: "support@bnpi-pats.example",
						url: "https://bnpi-pats.example/support",
					},
					license: {
						name: "MIT",
						url: "https://opensource.org/licenses/MIT",
					},
					termsOfService: "https://bnpi-pats.example/terms",
				},
				servers: [
					{
						url: `${req.protocol}://${req.get("host")}/api`,
						description: "Development server",
					},
					{
						url: "https://api.bnpi-pats.example/api",
						description: "Production server",
					},
				],
				paths: generateSwaggerPaths(endpoints),
				components: {
					securitySchemes: {
						bearerAuth: {
							type: "http",
							scheme: "bearer",
							bearerFormat: "JWT",
							description:
								"JWT Authorization header using the Bearer scheme. Example: 'Authorization: Bearer {token}'",
						},
						apiKey: {
							type: "apiKey",
							in: "header",
							name: "X-API-Key",
							description: "API Key for authentication",
						},
					},
					schemas: {
						Error: {
							type: "object",
							required: ["status", "message", "timestamp"],
							properties: {
								status: {
									type: "string",
									enum: ["error", "fail"],
									description: "Status of the response",
								},
								message: {
									type: "string",
									description: "Error message",
								},
								code: {
									type: "string",
									description: "Error code",
								},
								timestamp: {
									type: "string",
									format: "date-time",
									description: "Timestamp when the error occurred",
								},
								details: {
									type: "object",
									description: "Additional error details",
								},
							},
						},
						Success: {
							type: "object",
							required: ["status", "message", "timestamp"],
							properties: {
								status: {
									type: "string",
									enum: ["success"],
									description: "Status of the response",
								},
								message: {
									type: "string",
									description: "Success message",
								},
								data: {
									type: "object",
									description: "Response data",
								},
								timestamp: {
									type: "string",
									format: "date-time",
									description: "Timestamp of the response",
								},
							},
						},
						Template: {
							type: "object",
							required: ["id", "name"],
							properties: {
								id: {
									type: "string",
									pattern: "^[0-9a-fA-F]{24}$",
									description: "Unique identifier for the template",
									example: "507f1f77bcf86cd799439011",
								},
								name: {
									type: "string",
									minLength: 1,
									description: "Name of the template",
									example: "Email Welcome Template",
								},
								description: {
									type: "string",
									description: "Description of the template",
									example: "Welcome email template for new users",
								},
								type: {
									type: "string",
									enum: ["email", "sms", "push", "form"],
									description: "Type of the template",
									example: "email",
								},
								isDeleted: {
									type: "boolean",
									description: "Soft delete flag",
									default: false,
								},
								createdAt: {
									type: "string",
									format: "date-time",
									description: "Creation timestamp",
								},
								updatedAt: {
									type: "string",
									format: "date-time",
									description: "Last update timestamp",
								},
							},
						},
						Pagination: {
							type: "object",
							properties: {
								currentPage: {
									type: "integer",
									minimum: 1,
									description: "Current page number",
								},
								totalPages: {
									type: "integer",
									minimum: 0,
									description: "Total number of pages",
								},
								totalItems: {
									type: "integer",
									minimum: 0,
									description: "Total number of items",
								},
								itemsPerPage: {
									type: "integer",
									minimum: 1,
									description: "Number of items per page",
								},
								hasNext: {
									type: "boolean",
									description: "Whether there is a next page",
								},
								hasPrev: {
									type: "boolean",
									description: "Whether there is a previous page",
								},
							},
						},
					},
					responses: {
						BadRequest: {
							description: "Bad Request - Invalid input data",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
						Unauthorized: {
							description: "Unauthorized - Invalid or missing authentication",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
						Forbidden: {
							description: "Forbidden - Insufficient permissions",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
						NotFound: {
							description: "Not Found - Resource not found",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
						InternalServerError: {
							description: "Internal Server Error",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
					},
				},
				security: [
					{
						bearerAuth: [],
					},
				],
				tags: [
					{
						name: "Template",
						description: "Template management operations",
						externalDocs: {
							description: "Find out more about templates",
							url: "https://bnpi-pats.example/docs/templates",
						},
					},
					{
						name: "Documentation",
						description: "API documentation endpoints",
					},
				],
			};

			res.setHeader("Content-Type", "application/json");
			res.status(200).json(swagger);
			return;
		} catch (error: unknown) {
			docsLogger.error(`Error generating swagger: ${error}`);
			sendError(res, 500, "Failed to generate swagger documentation", "INTERNAL_ERROR");
			return;
		}
	};

	const getPostman = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
		try {
			const endpoints = appInstance
				? await generateEndpointsFromAppInstance(appInstance)
				: await generateEndpointsFromApp(req);

			const baseUrl = `${req.protocol}://${req.get("host")}`;

			const postman = {
				info: {
					name: "Bandai PATS API",
					description: "API collection for Bandai PATS backend services",
					schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
					version: "1.0.0",
				},
				item: generatePostmanItems(endpoints, baseUrl),
				variable: [
					{
						key: "baseUrl",
						value: baseUrl,
						type: "string",
					},
				],
			};

			res.setHeader("Content-Type", "application/json");
			res.status(200).json(postman);
			return;
		} catch (error: unknown) {
			docsLogger.error(`Error generating postman collection: ${error}`);
			sendError(res, 500, "Failed to generate postman collection", "INTERNAL_ERROR");
			return;
		}
	};

	const generateIml = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
		try {
			const { tag, includeContent = "true", format = "json" } = req.query;

			const spec = buildSpec();

			const result: SimplifiedEndpoint[] = [];
			const openApiSpec = spec as OpenAPISpec;
			const paths = openApiSpec.paths || {};

			for (const [rawPath, methods] of Object.entries(paths)) {
				if (!rawPath.startsWith("/")) continue;
				for (const [method, op] of Object.entries(methods)) {
					if (!op || typeof op !== "object") continue;
					const methodUpper = method.toUpperCase();
					if (
						!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(
							methodUpper,
						)
					) {
						continue;
					}
					const opId =
						"operationId" in op && typeof op.operationId === "string"
							? op.operationId
							: `${methodUpper} ${rawPath}`;

					const allParams: Array<{
						in?: string;
						name?: string;
						required?: boolean;
						schema?: unknown;
						description?: string;
					}> = ("parameters" in op && Array.isArray(op.parameters)) ? op.parameters : [];
					const pathParams = allParams
						.filter((p) => p.in === "path" && typeof p.name === "string")
						.map((p) => ({
							name: p.name!,
							required: p.required,
							schema: p.schema as OpenAPISchema | undefined,
							description: p.description,
						}));
					const queryParams = allParams
						.filter((p) => p.in === "query" && typeof p.name === "string")
						.map((p) => ({
							name: p.name!,
							required: p.required,
							schema: p.schema as OpenAPISchema | undefined,
							description: p.description,
						}));

					const requestBody =
						"requestBody" in op && op.requestBody ? extractRequestBody(op.requestBody) : undefined;
					const responses =
						("responses" in op && op.responses ? extractResponses(op.responses as Record<string, OpenAPIResponse>) : extractResponses()) as Record<string, { description?: string; schema?: OpenAPISchema | undefined; example?: unknown; contentTypes?: string[]; }>;
					const contentTypes = requestBody?.contentTypes || [];

					const ep: SimplifiedEndpoint = {
						id: opId,
						method: methodUpper,
						url: rawPath,
						summary: "summary" in op && typeof op.summary === "string" ? op.summary : undefined,
						description:
							"description" in op && typeof op.description === "string"
								? op.description
								: undefined,
						tags: "tags" in op && Array.isArray(op.tags) ? op.tags : undefined,
						deprecated: "deprecated" in op ? Boolean(op.deprecated) : false,
						security: ("security" in op && Array.isArray(op.security)) ? op.security as Array<Record<string, string[]>> : undefined,
						contentTypes,
						pathParams,
						queryParams,
						requestBody,
						responses,
						paginationHints: {
							hasPaginationParams: queryParams.some((p) =>
								["page", "limit"].includes((p.name || "").toLowerCase()),
							),
							hasSearchParam: queryParams.some(
								(p) => (p.name || "").toLowerCase() === "query",
							),
							hasSortParams: queryParams.some((p) =>
								["sort", "order"].includes((p.name || "").toLowerCase()),
							),
						},
					};
					result.push(ep);
				}
			}

			const tagToEndpoints = new Map<string, SimplifiedEndpoint[]>();

			for (const ep of result) {
				const tags = (ep.tags && ep.tags.length > 0 ? ep.tags : ["_untagged"]) as string[];
				for (const tagName of tags) {
					const key = toFileSlug(tagName || "_untagged");
					if (!tagToEndpoints.has(key)) {
						tagToEndpoints.set(key, []);
					}
					tagToEndpoints.get(key)!.push(ep);
				}
			}

			const tagFiles: Record<string, SimplifiedEndpoint[]> = {};
			let filteredTagFiles: Record<string, SimplifiedEndpoint[]> = {};

			for (const [tagSlug, tagEndpoints] of tagToEndpoints.entries()) {
				if (includeContent === "true") {
					tagFiles[tagSlug] = tagEndpoints;
				}
			}

			if (tag && typeof tag === "string") {
				const requestedTag = toFileSlug(tag.toLowerCase());
				if (tagToEndpoints.has(requestedTag)) {
					filteredTagFiles[requestedTag] =
						includeContent === "true" ? tagToEndpoints.get(requestedTag)! : [];
				} else {
					filteredTagFiles = {};
				}
			} else {
				filteredTagFiles = tagFiles;
			}

			let responseData:
				| Record<string, SimplifiedEndpoint[]>
				| { availableTagFiles: string[] };

			if (includeContent === "true") {
				responseData = filteredTagFiles;
			} else {
				if (tag && typeof tag === "string") {
					const requestedTag = toFileSlug(tag.toLowerCase());
					if (tagToEndpoints.has(requestedTag)) {
						responseData = { availableTagFiles: [`${requestedTag}.endpoints.json`] };
					} else {
						responseData = { availableTagFiles: [] };
					}
				} else {
					responseData = {
						availableTagFiles: Array.from(tagToEndpoints.keys()).map(
							(key) => `${key}.endpoints.json`,
						),
					};
				}
			}

			docsLogger.info(`Generated ${result.length} endpoints in memory`);

			if (format === "xml") {
				const xmlData = convertToXML(responseData, "endpoints");
				res.setHeader("Content-Type", "application/xml");
				res.status(200).send(xmlData);
				return;
			} else if (format === "json") {
				res.status(200).json(responseData);
				return;
			} else {
				sendError(
					res,
					400,
					"Invalid format. Supported formats: json, xml",
					"VALIDATION_ERROR",
				);
				return;
			}
		} catch (error: unknown) {
			docsLogger.error(`Error generating endpoints: ${error}`);
			sendError(res, 500, "Failed to generate endpoints", "INTERNAL_ERROR");
			return;
		}
	};

	return { exportDocs, getSwagger, getPostman, generateIml };
};

