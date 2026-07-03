import { DMMF } from "@prisma/client/runtime/library";
import { Prisma } from "../generated/prisma";

const dmmf: DMMF.Document = Prisma.dmmf as unknown as DMMF.Document;

const OPERATORS = {
	// Comparison
	">": "gt",
	">=": "gte",
	"<": "lt",
	"<=": "lte",
	"!": "not",
	// String operations
	"^": "startsWith",
	$: "endsWith",
	"~": "contains",
	// Special
	":": "equals", // default
} as const;

interface ParsedFilter {
	field: string;
	operator: string;
	value: string;
	isNull: boolean;
	isRange: boolean;
	rangeStart?: string;
	rangeEnd?: string;
}

export const buildFindManyQuery = <T extends unknown | undefined>(
	whereClause: T,
	skip: number,
	limit: number,
	order: "asc" | "desc",
	sort?: string | object,
	fields?: string,
	modelName: string = "Project",
): Record<string, unknown> => {
	let orderBy: Record<string, unknown> = { id: order as Prisma.SortOrder };

	if (sort) {
		if (typeof sort === "string" && !sort.startsWith("{")) {
			if (isValidField(modelName, sort)) orderBy = { [sort]: order };
		} else {
			const parsed = typeof sort === "string" ? JSON.parse(sort) : sort;
			const sanitized = sanitizeSortObject(parsed, modelName);
			if (Object.keys(sanitized).length > 0) orderBy = sanitized;
		}
	}

	const query: Record<string, unknown> = {
		where: whereClause,
		skip,
		take: limit,
		orderBy,
	};

	query.select = getNestedFields(fields, modelName);

	return query;
};

/**
 * Validate if a field exists in the model schema
 */
function isValidField(modelName: string, fieldName: string): boolean {
	const model = dmmf.datamodel.models.find((m) => m.name === modelName);
	if (model && model.fields.some((f) => f.name === fieldName)) return true;

	const type = dmmf.datamodel.types.find((t) => t.name === modelName);
	if (type && type.fields.some((f) => f.name === fieldName)) return true;

	return false;
}

/**
 * Recursively strip any key from a parsed `orderBy` object that isn't a real
 * field (or nested relation field) on the model, so a raw JSON sort payload
 * can't reference fields outside the model's schema.
 */
function sanitizeSortObject(sortObj: unknown, modelName: string): Record<string, unknown> {
	if (typeof sortObj !== "object" || sortObj === null || Array.isArray(sortObj)) return {};

	const model = dmmf.datamodel.models.find((m) => m.name === modelName);
	if (!model) return {};

	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(sortObj as Record<string, unknown>)) {
		const field = model.fields.find((f) => f.name === key);
		if (!field) continue;

		if (value === "asc" || value === "desc") {
			sanitized[key] = value;
		} else if (field.kind === "object") {
			const nested = sanitizeSortObject(value, field.type);
			if (Object.keys(nested).length > 0) sanitized[key] = nested;
		}
	}
	return sanitized;
}

/**
 * Parse fields string with parentheses notation into Prisma select object
 * Supports recursive nesting: category(id,name,parent(id,name))
 *
 * @example
 * Input: "id,name,category(id,name,isDeleted)"
 * Output: { id: true, name: true, category: { select: { id: true, name: true, isDeleted: true } } }
 *
 * @example
 * Input: "id,estimation(id,items(id,name,category(id,name)))"
 * Output: {
 *   id: true,
 *   estimation: {
 *     select: {
 *       id: true,
 *       items: { select: { id: true, name: true, category: { select: { id: true, name: true } } } }
 *     }
 *   }
 * }
 */
function parseFieldsWithParentheses(fieldsStr: string, modelName: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	// Tokenize: split by comma but respect parentheses nesting
	const tokens = tokenizeFields(fieldsStr);

	for (const token of tokens) {
		const trimmed = token.trim();
		if (!trimmed) continue;

		// Check if this token has nested fields: fieldName(subfields)
		const parenIndex = trimmed.indexOf("(");

		if (parenIndex === -1) {
			// Simple field: just "fieldName"
			const fieldName = trimmed;

			// Validate field exists
			if (!isValidField(modelName, fieldName)) {
				console.warn(
					`Field "${fieldName}" does not exist in model "${modelName}", skipping...`,
				);
				continue;
			}

			result[fieldName] = true;
		} else {
			// Nested field: "fieldName(subfields)"
			const fieldName = trimmed.substring(0, parenIndex);
			const subfieldsStr = trimmed.substring(parenIndex + 1, trimmed.length - 1); // Remove surrounding parentheses

			// Validate field exists
			if (!isValidField(modelName, fieldName)) {
				console.warn(
					`Field "${fieldName}" does not exist in model "${modelName}", skipping...`,
				);
				continue;
			}

			// Get the related model name for nested validation
			const fieldMeta = getFieldMeta(modelName, fieldName);
			const relatedModelName = fieldMeta?.type || modelName;

			// Recursively parse nested fields
			const nestedSelect = parseFieldsWithParentheses(subfieldsStr, relatedModelName);

			if (Object.keys(nestedSelect).length > 0) {
				result[fieldName] = { select: nestedSelect };
			}
		}
	}

	return result;
}

/**
 * Tokenize fields string, splitting by comma but respecting parentheses nesting
 * @example "id,name,category(id,name)" => ["id", "name", "category(id,name)"]
 * @example "id,category(id,parent(id,name)),status" => ["id", "category(id,parent(id,name))", "status"]
 */
function tokenizeFields(fieldsStr: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let depth = 0;

	for (const char of fieldsStr) {
		if (char === "(") {
			depth++;
			current += char;
		} else if (char === ")") {
			depth--;
			current += char;
		} else if (char === "," && depth === 0) {
			// Only split on comma when not inside parentheses
			if (current.trim()) {
				tokens.push(current.trim());
			}
			current = "";
		} else {
			current += char;
		}
	}

	// Don't forget the last token
	if (current.trim()) {
		tokens.push(current.trim());
	}

	return tokens;
}

export const getNestedFields = (
	fields?: string,
	modelName: string = "Project",
): Record<string, unknown> | undefined => {
	if (!fields) {
		// Return undefined to use Prisma's default behavior (all scalar fields)
		return undefined;
	}

	// Check if using parentheses notation (new format)
	if (fields.includes("(")) {
		return parseFieldsWithParentheses(fields, modelName);
	}

	// Legacy dot notation support: category.id,category.name
	const fieldSelections = fields.split(",").reduce(
		(acc, field) => {
			const parts = field.trim().split(".");

			// Validate the first field name against the model
			if (!isValidField(modelName, parts[0])) {
				console.warn(
					`Field "${parts[0]}" does not exist in model "${modelName}", skipping...`,
				);
				return acc;
			}

			if (parts.length > 1) {
				const [parent, ...children] = parts;
				acc[parent] = acc[parent] || { select: {} };
				let current = (acc[parent] as Record<string, unknown>).select as Record<
					string,
					Record<string, unknown>
				>;
				for (let i = 0; i < children.length - 1; i++) {
					current[children[i]] = current[children[i]] || { select: {} };
					current = (current[children[i]] as Record<string, unknown>).select as Record<
						string,
						Record<string, unknown>
					>;
				}
				(current as Record<string, unknown>)[children[children.length - 1]] = true;
			} else {
				acc[parts[0]] = true;
			}
			return acc;
		},
		{} as Record<string, unknown>,
	);

	return fieldSelections;
};

/**
 * Look up field metadata in Prisma DMMF for a single field
 */
function getFieldMeta(modelName: string, field: string): DMMF.Field | undefined {
	const model = dmmf.datamodel.models.find((m) => m.name === modelName);
	if (model) {
		return model.fields.find((f) => f.name === field);
	}
	const type = dmmf.datamodel.types.find((t) => t.name === modelName);
	if (type) {
		return type.fields.find((f) => f.name === field);
	}
	return undefined;
}
/**
 * Parse value based on field type with proper error handling
 */
function parseValue(field: DMMF.Field, val: string): unknown {
	// Handle null values
	if (val.toLowerCase() === "null" || val.toLowerCase() === "undefined") {
		return null;
	}

	switch (field.type) {
		case "String":
			return val;
		case "Int":
		case "BigInt": {
			const parsed = parseInt(val, 10);
			if (isNaN(parsed)) {
				throw new Error(`Invalid integer value: "${val}" for field "${field.name}"`);
			}
			return parsed;
		}
		case "Float":
		case "Decimal": {
			const parsed = parseFloat(val);
			if (isNaN(parsed)) {
				throw new Error(`Invalid float value: "${val}" for field "${field.name}"`);
			}
			return parsed;
		}
		case "Boolean":
			return val.toLowerCase() === "true" || val.toLowerCase() === "yes" || val === "1";
		case "DateTime": {
			const date = new Date(val);
			if (isNaN(date.getTime())) {
				throw new Error(`Invalid date value: "${val}" for field "${field.name}"`);
			}
			return date;
		}
		case "Json":
			try {
				return JSON.parse(val);
			} catch {
				return val;
			}
		default:
			// Handle enums and other types as strings
			return val;
	}
}

/**
 * Parse filter string into structured format
 * Supports: field:value, field>value, field^value, field:start-end, etc.
 */
function parseFilterExpression(expr: string): ParsedFilter {
	// Check for range (e.g., price:100-500)
	const rangeMatch = expr.match(/^([^:><!^$~]+):(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
	if (rangeMatch) {
		return {
			field: rangeMatch[1].trim(),
			operator: "range",
			value: "",
			isNull: false,
			isRange: true,
			rangeStart: rangeMatch[2],
			rangeEnd: rangeMatch[3],
		};
	}

	// Find operator - check multi-char first (>=, <=)
	let operator = "equals";
	let operatorSymbol = ":";

	for (const [symbol, op] of Object.entries(OPERATORS)) {
		if (symbol === ":") continue; // Handle default separately

		// For multi-char operators like >=, <=
		if (symbol.length === 2 && expr.includes(symbol)) {
			operator = op;
			operatorSymbol = symbol;
			break;
		}
	}

	// If no multi-char operator found, check single char
	if (operator === "equals") {
		for (const [symbol, op] of Object.entries(OPERATORS)) {
			if (symbol.length === 1 && symbol !== ":" && expr.includes(symbol)) {
				operator = op;
				operatorSymbol = symbol;
				break;
			}
		}
	}

	const [field, ...valueParts] = expr.split(operatorSymbol);
	const value = valueParts.join(operatorSymbol).trim(); // Rejoin in case value contains operator

	const isNull = value.toLowerCase() === "null" || value.toLowerCase() === "undefined";

	return {
		field: field.trim(),
		operator,
		value,
		isNull,
		isRange: false,
	};
}

/**
 * Build Prisma condition for a single filter with operator support
 */
function buildConditionWithOperator(
	modelName: string,
	path: string[],
	parsed: ParsedFilter,
): Record<string, unknown> {
	if (path.length === 0) return {};

	const fieldMeta = getFieldMeta(modelName, path[0]);
	if (!fieldMeta) {
		throw new Error(`Field "${path[0]}" not found in model "${modelName}"`);
	}

	// Terminal field (scalar or enum)
	if (path.length === 1) {
		if (fieldMeta.kind === "scalar" || fieldMeta.kind === "enum") {
			// Handle null checks
			if (parsed.isNull) {
				return { [path[0]]: null };
			}

			// Handle range queries
			if (parsed.isRange && parsed.rangeStart && parsed.rangeEnd) {
				const start = parseValue(fieldMeta, parsed.rangeStart);
				const end = parseValue(fieldMeta, parsed.rangeEnd);
				return {
					AND: [{ [path[0]]: { gte: start } }, { [path[0]]: { lte: end } }],
				};
			}

			const parsedValue = parseValue(fieldMeta, parsed.value);

			// Handle list fields
			if (fieldMeta.isList) {
				switch (parsed.operator) {
					case "contains":
						return { [path[0]]: { has: parsedValue } };
					case "not":
						return { NOT: { [path[0]]: { has: parsedValue } } };
					default:
						return { [path[0]]: { has: parsedValue } };
				}
			}

			// String-specific operators
			if (fieldMeta.type === "String") {
				switch (parsed.operator) {
					case "startsWith":
					case "endsWith":
					case "contains":
						return {
							[path[0]]: {
								[parsed.operator]: parsedValue,
								mode: "insensitive" as Prisma.QueryMode,
							},
						};
					case "not":
						return { [path[0]]: { not: parsedValue } };
					case "equals":
					default:
						return { [path[0]]: parsedValue };
				}
			}

			// Numeric/Date comparison operators
			if (["Int", "BigInt", "Float", "Decimal", "DateTime"].includes(fieldMeta.type)) {
				switch (parsed.operator) {
					case "gt":
					case "gte":
					case "lt":
					case "lte":
						return { [path[0]]: { [parsed.operator]: parsedValue } };
					case "not":
						return { [path[0]]: { not: parsedValue } };
					case "equals":
					default:
						return { [path[0]]: parsedValue };
				}
			}

			// Default equality for other types
			if (parsed.operator === "not") {
				return { [path[0]]: { not: parsedValue } };
			}
			return { [path[0]]: parsedValue };
		}
		throw new Error(`Field "${path[0]}" is not a scalar or enum type`);
	}

	// Non-terminal field: recurse
	if (fieldMeta.kind !== "object") {
		throw new Error(`Field "${path[0]}" cannot be traversed (not an object type)`);
	}

	const nextModelName = fieldMeta.type;
	const nestedCondition = buildConditionWithOperator(nextModelName, path.slice(1), parsed);

	if (Object.keys(nestedCondition).length === 0) return {};

	if (fieldMeta.isList) {
		// For to-many relations or list composites
		return {
			[path[0]]: {
				some: fieldMeta.relationName ? nestedCondition : { is: nestedCondition },
			},
		};
	}
	// For to-one relations or composites
	return {
		[path[0]]: fieldMeta.relationName ? nestedCondition : { is: nestedCondition },
	};
}

/**
 * Parse filter parameter and build Prisma conditions with enhanced operators
 *
 * Supported syntax:
 * - field:value          - Exact match
 * - field>value          - Greater than
 * - field>=value         - Greater than or equal
 * - field<value          - Less than
 * - field<=value         - Less than or equal
 * - field!value          - Not equals
 * - field^value          - Starts with (strings)
 * - field$value          - Ends with (strings)
 * - field~value          - Contains (strings)
 * - field:null           - Is null
 * - field:100-500        - Range (numeric/date)
 * - field:val1,field:val2 - Multiple values (OR)
 *
 * @param modelName - Prisma model name
 * @param filterParam - Filter query string
 * @returns Array of Prisma where conditions
 * @throws Error if filter syntax is invalid or fields don't exist
 */
export function buildFilterConditions(
	modelName: string,
	filterParam?: string,
): Record<string, unknown>[] {
	if (!filterParam) return [];

	// Validate model exists
	const model = dmmf.datamodel.models.find((m) => m.name === modelName);
	if (!model) {
		throw new Error(`Model "${modelName}" not found in Prisma schema`);
	}

	// Try to detect and handle JSON format
	if (filterParam.trim().startsWith("[") || filterParam.trim().startsWith("{")) {
		try {
			const jsonFilter = JSON.parse(filterParam) as unknown;
			// If it's a JSON array of filter objects, convert to simple format
			if (Array.isArray(jsonFilter)) {
				const convertedFilter = jsonFilter
					.map((f: unknown) => {
						const filterObj = f as Record<string, unknown>;
						if (filterObj.field && filterObj.value !== undefined) {
							const operator = filterObj.operator || "equals";
							// Convert operator to symbol
							const operatorSymbol =
								operator === "equals"
									? ":"
									: operator === "gt"
										? ">"
										: operator === "gte"
											? ">="
											: operator === "lt"
												? "<"
												: operator === "lte"
													? "<="
													: operator === "not"
														? "!"
														: operator === "startsWith"
															? "^"
															: operator === "endsWith"
																? "$"
																: operator === "contains"
																	? "~"
																	: ":";
							return `${filterObj.field}${operatorSymbol}${filterObj.value}`;
						}
						return null;
					})
					.filter(Boolean)
					.join(",");

				if (convertedFilter) {
					filterParam = convertedFilter;
				} else {
					// No valid filters in JSON, return empty
					return [];
				}
			} else {
				// Single object or other JSON format, ignore
				return [];
			}
		} catch (error) {
			// Invalid JSON, return empty conditions instead of throwing
			console.warn(`Invalid JSON filter format, ignoring: ${filterParam}`);
			return [];
		}
	}

	const items = filterParam
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const groups = new Map<string, ParsedFilter[]>();

	// Parse and group filters
	for (const item of items) {
		try {
			const parsed = parseFilterExpression(item);
			const key = parsed.field;

			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(parsed);
		} catch (error) {
			// Log warning but continue instead of throwing
			console.warn(`Invalid filter expression "${item}": ${(error as Error).message}`);
			continue;
		}
	}

	const conditions: Record<string, unknown>[] = [];

	for (const [rawKey, parsedFilters] of groups) {
		const path = rawKey.split(".");

		try {
			if (parsedFilters.length === 1) {
				// Single filter for this field
				const parsed = parsedFilters[0];

				const condition = buildConditionWithOperator(modelName, path, parsed);
				if (Object.keys(condition).length > 0) {
					conditions.push(condition);
				}
			} else {
				// Multiple filters for same field - combine with OR
				const orConditions = parsedFilters
					.map((parsed) => buildConditionWithOperator(modelName, path, parsed))
					.filter((c) => Object.keys(c).length > 0);

				if (orConditions.length > 0) {
					conditions.push({ OR: orConditions });
				}
			}
		} catch (error) {
			// Log warning but continue instead of throwing
			console.warn(
				`Error building filter for field "${rawKey}": ${(error as Error).message}`,
			);
			continue;
		}
	}

	return conditions;
}

/**
 * Build Prisma search conditions for specified String scalar or enum fields (including nested) in a model
 * @throws Error if any provided field is invalid
 */
export function buildSearchConditions(
	modelName: string,
	searchTerm?: string,
	searchFields?: string[],
): Record<string, unknown>[] {
	if (!searchTerm || !searchFields || searchFields.length === 0) return [];

	const model = dmmf.datamodel.models.find((m) => m.name === modelName);
	if (!model) {
		throw new Error(`Model "${modelName}" not found in Prisma schema`);
	}

	const conditions: Record<string, unknown>[] = [];
	const invalidFields: string[] = [];

	for (const field of searchFields) {
		const path = field.split(".");
		const isValid = validateFieldPath(modelName, path);
		if (!isValid) {
			invalidFields.push(field);
		} else {
			const condition = buildConditionForSearch(modelName, path, searchTerm);
			if (Object.keys(condition).length > 0) {
				conditions.push(condition);
			}
		}
	}

	if (invalidFields.length > 0) {
		throw new Error(
			`Invalid fields found for model "${modelName}": ${invalidFields.join(
				", ",
			)}. Fields must be scalar String or enum types.`,
		);
	}

	if (conditions.length === 0) {
		throw new Error(
			`No valid scalar String or enum fields found for model "${modelName}" among provided fields: ${searchFields.join(
				", ",
			)}`,
		);
	}

	return conditions;
}

/**
 * Helper to validate a field path
 */
function validateFieldPath(modelName: string, path: string[]): boolean {
	if (path.length === 0) return false;

	const fieldMeta = getFieldMeta(modelName, path[0]);
	if (!fieldMeta) return false;

	if (path.length === 1) {
		return (
			(fieldMeta.kind === "scalar" && fieldMeta.type === "String" && !fieldMeta.isList) ||
			fieldMeta.kind === "enum"
		);
	}

	if (fieldMeta.kind === "object") {
		const nextModelName = fieldMeta.type;
		return validateFieldPath(nextModelName, path.slice(1));
	}

	return false;
}

/**
 * Helper to build search condition for a single field path
 */
function buildConditionForSearch(
	modelName: string,
	path: string[],
	searchTerm: string,
): Record<string, unknown> {
	if (path.length === 0) return {};

	// Get metadata for the current (first) field
	const fieldMeta = getFieldMeta(modelName, path[0]);
	if (!fieldMeta) return {};

	// Terminal field (scalar String or enum)
	if (path.length === 1) {
		if (
			(fieldMeta.kind === "scalar" && fieldMeta.type === "String" && !fieldMeta.isList) ||
			fieldMeta.kind === "enum"
		) {
			return { [path[0]]: { contains: searchTerm, mode: "insensitive" } };
		}
		return {}; // Non-scalar String or non-enum fields are not supported
	}

	// Non-terminal field: recurse
	const nextModelName = fieldMeta.kind === "object" ? fieldMeta.type : modelName;
	const nestedCondition = buildConditionForSearch(nextModelName, path.slice(1), searchTerm);

	if (Object.keys(nestedCondition).length === 0) return {};

	if (fieldMeta.kind === "object") {
		if (fieldMeta.isList) {
			// For to-many relations or list composites (e.g., contactInfo.phones)
			return {
				[path[0]]: {
					some: fieldMeta.relationName ? nestedCondition : { is: nestedCondition },
				},
			};
		}
		// For to-one relations or composites (e.g., contactInfo, contactInfo.address)
		return { [path[0]]: fieldMeta.relationName ? nestedCondition : { is: nestedCondition } };
	}

	return {};
}

// Helper function to safely access nested values for groupBy function
function getNestedValue(obj: unknown, path: string): unknown {
	return path.split(".").reduce((acc, key) => {
		if (acc && typeof acc === "object" && key in acc) {
			return (acc as Record<string, unknown>)[key];
		}
		return undefined;
	}, obj);
}

// Helper function to group data by specified (possibly nested) field
export const groupDataByField = (data: unknown[], groupBy: string): Record<string, unknown[]> => {
	const grouped: Record<string, unknown[]> = {};

	data.forEach((item) => {
		const groupValue = getNestedValue(item, groupBy) ?? "unassigned";
		if (!grouped[groupValue as string]) {
			grouped[groupValue as string] = [];
		}
		grouped[groupValue as string].push(item);
	});

	return grouped;
};
