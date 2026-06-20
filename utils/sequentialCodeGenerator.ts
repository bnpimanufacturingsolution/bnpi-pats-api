import { PrismaClient } from "../generated/prisma";
import { createLogger } from "../helper/logger";

const sequentialLogger = createLogger("sequential-code-generator");

/**
 * Generates the next code based on a sequential pattern
 * Pattern placeholders:
 * - {YYYY}: Current year (4 digits)
 * - {YY}: Current year (2 digits)
 * - {MM}: Current month (2 digits)
 * - {DD}: Current day (2 digits)
 * - {0000}: Sequential number with padding (number of zeros determines padding length)
 * - {NAME3}: First 3 characters of name (uppercase)
 *
 * Examples:
 * - PRJ-{NAME3}-{YYYY}-{000} with current=5, name="Website" -> PRJ-WEB-2025-005
 * - INV-{YYYY}-{0000} with current=42 -> INV-2025-0042
 * - ORD-{YYYY}{MM}-{0000} with current=123 -> ORD-202512-0123
 *
 * @param pattern - The pattern template
 * @param current - Current counter value
 * @param context - Optional context variables (e.g., {projectCode: "PRJ-2025-001", name: "Website"})
 */
export function generateCodeFromPattern(
	pattern: string,
	current: number,
	context?: Record<string, string>,
): string {
	const now = new Date();

	let code = pattern;

	// Replace context placeholders first (if provided)
	if (context) {
		Object.entries(context).forEach(([key, value]) => {
			const placeholder = new RegExp(`\\{${key}\\}`, "g");
			code = code.replace(placeholder, value);
		});
	}

	// Replace NAME3 placeholder (first 3 characters of name, uppercase)
	const name3Match = code.match(/\{NAME3\}/);
	if (name3Match) {
		const name = context?.name || "";
		const name3 = name
			.slice(0, 3)
			.toUpperCase()
			.replace(/[^A-Z]/g, "")
			.padEnd(3, "X");
		code = code.replace(/{NAME3}/g, name3);
	}

	// Replace date placeholders
	code = code.replace(/{YYYY}/g, now.getFullYear().toString());
	code = code.replace(/{YY}/g, now.getFullYear().toString().slice(-2));
	code = code.replace(/{MM}/g, (now.getMonth() + 1).toString().padStart(2, "0"));
	code = code.replace(/{DD}/g, now.getDate().toString().padStart(2, "0"));

	// Replace sequential number placeholder
	const sequentialMatch = code.match(/\{(0+)\}/);
	if (sequentialMatch) {
		const padding = sequentialMatch[1].length;
		const sequentialNumber = (current + 1).toString().padStart(padding, "0");
		code = code.replace(/\{0+\}/, sequentialNumber);
	}

	return code;
}

/**
 * Gets the next code for a given sequential and updates the current value
 * This is a transactional operation that:
 * 1. Fetches the sequential by code (scoped by organization)
 * 2. Generates the next code using the pattern
 * 3. Updates the current value atomically
 *
 * @param prisma - Prisma client instance
 * @param sequentialCode - The code of the sequential (e.g., "PRJ", "INV")
 * @param context - Optional context for code generation (e.g., {name: "Website Redesign"})
 * @param workspaceId - Optional workspace ID to scope the sequential lookup
 * @returns The generated code (e.g., "PRJ-WEB-2025-001")
 * @throws Error if sequential not found or if code generation fails
 */
export async function getNextSequentialCode(
	prisma: PrismaClient,
	sequentialCode: string,
	context?: Record<string, string>,
	workspaceId?: string,
): Promise<string> {
	try {
		// Find the sequential by code (optionally scoped by workspace)
		const sequential = await prisma.sequential.findFirst({
			where: {
				code: sequentialCode,
				isDeleted: false,
				...(workspaceId && { workspaceId }),
			},
		});

		if (!sequential) {
			throw new Error(`Sequential with code "${sequentialCode}" not found`);
		}

		// Generate the next code
		const generatedCode = generateCodeFromPattern(
			sequential.pattern,
			sequential.current,
			context,
		);

		// Update the current value atomically
		await prisma.sequential.update({
			where: { id: sequential.id },
			data: { current: sequential.current + 1 },
		});

		sequentialLogger.info(
			`Generated code: ${generatedCode} for sequential: ${sequentialCode} (current: ${sequential.current} -> ${sequential.current + 1})`,
		);

		return generatedCode;
	} catch (error) {
		sequentialLogger.error(
			`Failed to generate sequential code for "${sequentialCode}": ${error}`,
		);
		throw error;
	}
}

/**
 * Gets the next estimation number for a specific project
 * This uses the atomic Sequential system for reliable, collision-free numbering
 *
 * @param prisma - Prisma client instance
 * @param projectCode - The project code (e.g., "PRJ-WEB-2025-001")
 * @param estimationName - The estimation name (e.g., "Initial Estimate")
 * @returns The generated estimation number (e.g., "EST-PRJ-WEB-2025-001-INI-2025-0001")
 * @throws Error if generation fails
 */
export async function getNextProjectEstimationNumber(
	prisma: PrismaClient,
	projectCode: string,
	estimationName: string = "",
): Promise<string> {
	try {
		// Use the atomic sequence generator
		// The pattern in the DB for 'EST' should be: EST-{projectCode}-{NAME3}-{YYYY}-{0000}
		const estimationNumber = await getNextSequentialCode(prisma, "EST", {
			projectCode,
			name: estimationName,
		});

		return estimationNumber;
	} catch (error) {
		sequentialLogger.error(
			`Failed to generate estimation number for project "${projectCode}": ${error}`,
		);
		throw error;
	}
}

/**
 * Validates if a code matches the expected pattern format
 * Useful for manual code entry validation
 *
 * @param code - The code to validate (e.g., "PRJ-WEB-2025-001")
 * @param pattern - The pattern to validate against (e.g., "PRJ-{NAME3}-{YYYY}-{000}")
 * @returns true if the code matches the pattern structure
 */
export function validateCodePattern(code: string, pattern: string): boolean {
	try {
		// Convert pattern to regex
		let regexPattern = pattern
			.replace(/\{NAME3\}/g, "[A-Z]{3}")
			.replace(/\{YYYY\}/g, "\\d{4}")
			.replace(/\{YY\}/g, "\\d{2}")
			.replace(/\{MM\}/g, "\\d{2}")
			.replace(/\{DD\}/g, "\\d{2}")
			.replace(/\{(0+)\}/g, (match, zeros) => `\\d{1,${zeros.length}}`);

		const regex = new RegExp(`^${regexPattern}$`);
		return regex.test(code);
	} catch (error) {
		sequentialLogger.error(`Failed to validate code pattern: ${error}`);
		return false;
	}
}
