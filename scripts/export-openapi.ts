import fs from "fs";
import path from "path";

interface OpenAPISpec {
	paths?: Record<string, unknown>;
}

interface SimplifiedEndpoint {
	id: string;
	method: string;
	url: string;
	summary?: string;
	description?: string;
	tags?: string[];
	deprecated?: boolean;
	security?: unknown;
	contentTypes?: string[];
	pathParams?: Array<{
		name: string;
		required?: boolean;
		schema?: unknown;
		description?: string;
	}>;
	queryParams?: Array<{
		name: string;
		required?: boolean;
		schema?: unknown;
		description?: string;
	}>;
	requestBody?: {
		required?: boolean;
		schema?: unknown;
		example?: unknown;
		contentTypes?: string[];
	};
	responses?: Record<
		string,
		{
			description?: string;
			schema?: unknown;
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

function extractRequestBody(requestBody: unknown): SimplifiedEndpoint["requestBody"] | undefined {
	if (!requestBody || typeof requestBody !== 'object' || !('content' in requestBody)) return undefined;
	const reqBody = requestBody as Record<string, unknown>;
	const content = reqBody.content as Record<string, unknown> | undefined;
	const contentTypes = Object.keys(content || {});
	const json = content?.["application/json"] || content?.[contentTypes[0]];
	if (!json) {
		return { required: reqBody.required as boolean | undefined, contentTypes };
	}
	const jsonObj = json as Record<string, unknown>;
	let example: unknown | undefined = undefined;
	if (jsonObj.example) example = jsonObj.example;
	else if (jsonObj.examples) {
		const first = Object.values(jsonObj.examples as Record<string, unknown>)[0];
		if (first && typeof first === 'object' && 'value' in first) example = (first as Record<string, unknown>).value;
	}
	return {
		required: reqBody.required as boolean | undefined,
		schema: jsonObj.schema,
		example,
		contentTypes,
	};
}

function extractResponses(responses: unknown): SimplifiedEndpoint["responses"] {
	const result: SimplifiedEndpoint["responses"] = {};
	if (!responses || typeof responses !== "object") return result;
	for (const [status, resp] of Object.entries(responses)) {
		const respObj = resp as Record<string, unknown> | undefined;
		const content = (respObj?.content as Record<string, unknown>) || {};
		const contentTypes = Object.keys(content);
		const json = (content["application/json"] || content[contentTypes[0]] || {}) as Record<string, unknown>;
		let example: unknown | undefined = undefined;
		if (json.example) example = json.example;
		else if (json.examples) {
			const first = Object.values(json.examples as Record<string, unknown>)[0];
			if (first && typeof first === 'object' && 'value' in first) example = (first as Record<string, unknown>).value;
		}
		result[status] = {
			description: resp?.description,
			schema: json.schema,
			example,
			contentTypes,
		};
	}
	return result;
}

function resolveInputPath(): string {
	const swaggerPath = path.resolve(process.cwd(), "docs/generated/swagger.json");
	if (fs.existsSync(swaggerPath)) return swaggerPath;
	const openapiPath = path.resolve(process.cwd(), "docs/generated/openapi.json");
	if (fs.existsSync(openapiPath)) return openapiPath;
	return swaggerPath; // default path for error reporting
}

function run() {
	const inputPath = resolveInputPath();
	const outputDir = path.resolve(process.cwd(), "docs/generated");
	const outputPath = path.join(outputDir, "endpoints.json");

	if (!fs.existsSync(inputPath)) {
		console.error(`Spec file not found. Expected docs/generated/swagger.json or openapi.json`);
		process.exit(1);
	}

	const spec = JSON.parse(fs.readFileSync(inputPath, "utf8")) as OpenAPISpec;
	const result: SimplifiedEndpoint[] = [];

	const paths = spec.paths || {};
	for (const [rawPath, methods] of Object.entries(paths)) {
		// skip non-path keys accidentally placed under paths (like security)
		if (!rawPath.startsWith("/")) continue;
		for (const [method, op] of Object.entries<any>(methods)) {
			const methodUpper = method.toUpperCase();
			if (
				!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(methodUpper)
			) {
				continue;
			}
			const opId = op.operationId || `${methodUpper} ${rawPath}`;

			const allParams: Array<any> = Array.isArray(op.parameters) ? op.parameters : [];
			const pathParams = allParams
				.filter((p) => p.in === "path")
				.map((p) => ({
					name: p.name,
					required: p.required,
					schema: p.schema,
					description: p.description,
				}));
			const queryParams = allParams
				.filter((p) => p.in === "query")
				.map((p) => ({
					name: p.name,
					required: p.required,
					schema: p.schema,
					description: p.description,
				}));

			const requestBody = extractRequestBody(op.requestBody);
			const responses = extractResponses(op.responses);
			const contentTypes = requestBody?.contentTypes || [];

			const ep: SimplifiedEndpoint = {
				id: opId,
				method: methodUpper,
				url: rawPath,
				summary: op.summary,
				description: op.description,
				tags: op.tags,
				deprecated: Boolean(op.deprecated),
				security: op.security,
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

	if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

	// Also write per-tag endpoint files under docs/generated/endpoints/<tag>.endpoints.json
	const perTagDir = path.join(outputDir, "endpoints");
	if (!fs.existsSync(perTagDir)) fs.mkdirSync(perTagDir, { recursive: true });

	function toFileSlug(tag: string): string {
		return tag
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	const tagToEndpoints = new Map<string, SimplifiedEndpoint[]>();
	for (const ep of result) {
		const tags = (ep.tags && ep.tags.length > 0 ? ep.tags : ["_untagged"]) as string[];
		for (const tag of tags) {
			const key = toFileSlug(tag || "_untagged");
			if (!tagToEndpoints.has(key)) tagToEndpoints.set(key, []);
			tagToEndpoints.get(key)!.push(ep);
		}
	}

	for (const [tagSlug, endpoints] of tagToEndpoints.entries()) {
		const tagFile = path.join(perTagDir, `${tagSlug}.endpoints.json`);
		fs.writeFileSync(tagFile, JSON.stringify(endpoints, null, 2));
	}

	console.log(
		`Exported ${result.length} endpoints from ${path.basename(inputPath)} to ${outputPath} and ${perTagDir}`,
	);
}

run();
