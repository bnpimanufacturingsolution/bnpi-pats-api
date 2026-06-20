import { createLogger } from "../helper/logger";

const formDataLogger = createLogger("formDataHelper");

export interface ConversionOptions {
	numericFields?: string[];
	integerFields?: string[];
	jsonFields?: string[];
	booleanFields?: string[];
	debug?: boolean;
}

const cleanStringValue = (value: string): string => {
	let cleaned = value.trim();

	if (
		(cleaned.startsWith('"') && cleaned.endsWith('"')) ||
		(cleaned.startsWith("'") && cleaned.endsWith("'"))
	) {
		cleaned = cleaned.slice(1, -1);
	}

	return cleaned;
};

const convertToNumber = (value: string, fieldName: string, debug = false): number | string => {
	const cleaned = cleanStringValue(value);
	const numValue = parseFloat(cleaned);

	if (!isNaN(numValue)) {
		if (debug) {
			formDataLogger.info(`Converted ${fieldName} from "${value}" to number ${numValue}`);
		}
		return numValue;
	}

	if (debug) {
		formDataLogger.warn(`Failed to convert ${fieldName}: "${cleaned}" is not a valid number`);
	}
	return value;
};

const convertToInteger = (value: string, fieldName: string, debug = false): number | string => {
	const cleaned = cleanStringValue(value);
	const intValue = parseInt(cleaned, 10);

	if (!isNaN(intValue)) {
		if (debug) {
			formDataLogger.info(`Converted ${fieldName} from "${value}" to integer ${intValue}`);
		}
		return intValue;
	}

	if (debug) {
		formDataLogger.warn(`Failed to convert ${fieldName}: "${cleaned}" is not a valid integer`);
	}
	return value;
};

const convertToBoolean = (value: string, fieldName: string, debug = false): boolean | string => {
	const cleaned = cleanStringValue(value).toLowerCase();

	if (cleaned === "true" || cleaned === "1" || cleaned === "yes" || cleaned === "on") {
		if (debug) {
			formDataLogger.info(`Converted ${fieldName} from "${value}" to boolean true`);
		}
		return true;
	}

	if (
		cleaned === "false" ||
		cleaned === "0" ||
		cleaned === "no" ||
		cleaned === "off" ||
		cleaned === ""
	) {
		if (debug) {
			formDataLogger.info(`Converted ${fieldName} from "${value}" to boolean false`);
		}
		return false;
	}

	if (debug) {
		formDataLogger.warn(`Failed to convert ${fieldName}: "${cleaned}" is not a valid boolean`);
	}
	return value;
};

const parseJsonField = (value: string, fieldName: string, debug = false): unknown => {
	const cleaned = cleanStringValue(value);

	try {
		const parsed = JSON.parse(cleaned);
		if (debug) {
			formDataLogger.info(`Parsed ${fieldName} JSON successfully`);
		}
		return parsed;
	} catch (error: unknown) {
		if (debug) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			formDataLogger.warn(`Failed to parse ${fieldName} as JSON: ${errorMessage}`);
		}
		return value;
	}
};

export const convertFormDataTypes = (
	data: Record<string, unknown>,
	options: ConversionOptions = {},
): Record<string, unknown> => {
	const {
		numericFields = [],
		integerFields = [],
		jsonFields = [],
		booleanFields = [],
		debug = false,
	} = options;

	const converted: Record<string, unknown> = { ...data };

	for (const fieldName of numericFields) {
		if (
			converted[fieldName] !== undefined &&
			converted[fieldName] !== null &&
			converted[fieldName] !== "" &&
			typeof converted[fieldName] === "string"
		) {
			converted[fieldName] = convertToNumber(converted[fieldName], fieldName, debug);
		}
	}

	for (const fieldName of integerFields) {
		if (
			converted[fieldName] !== undefined &&
			converted[fieldName] !== null &&
			converted[fieldName] !== "" &&
			typeof converted[fieldName] === "string"
		) {
			converted[fieldName] = convertToInteger(converted[fieldName], fieldName, debug);
		}
	}

	for (const fieldName of booleanFields) {
		if (
			converted[fieldName] !== undefined &&
			converted[fieldName] !== null &&
			typeof converted[fieldName] === "string"
		) {
			converted[fieldName] = convertToBoolean(converted[fieldName], fieldName, debug);
		}
	}

	for (const fieldName of jsonFields) {
		if (converted[fieldName] && typeof converted[fieldName] === "string") {
			converted[fieldName] = parseJsonField(converted[fieldName], fieldName, debug);
		}
	}

	return converted;
};

export const ConversionPresets = {
	facility: {
		stringFields: ["name", "type", "description", "workspaceId", "facilityTypeId"],
		booleanFields: [],
		numericFields: [],
		jsonFields: ["location", "metadata"],
	},
	organization: {
		numericFields: [],
		integerFields: [],
		jsonFields: ["branding"],
		booleanFields: [],
	},
	user: {
		numericFields: ["age"],
		integerFields: [],
		jsonFields: ["preferences", "metadata"],
		booleanFields: ["isActive", "emailVerified"],
	},
};

export const convertWithPreset = (
	data: Record<string, unknown>,
	presetName: keyof typeof ConversionPresets,
	debug = false,
): Record<string, unknown> => {
	const preset = ConversionPresets[presetName];
	if (!preset) {
		throw new Error(`Unknown preset: ${presetName}`);
	}

	return convertFormDataTypes(data, { ...preset, debug });
};

export const filterDatabaseFields = (
	data: Record<string, unknown>,
	fieldsToRemove: string[],
): Record<string, unknown> => {
	const filtered: Record<string, unknown> = { ...data };

	for (const field of fieldsToRemove) {
		delete filtered[field];
	}

	return filtered;
};
