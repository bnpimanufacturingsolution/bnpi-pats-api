// xlsx@0.18.5 carries known prototype-pollution/ReDoS advisories in its
// *parsing* path (XLSX.read/readFile). This module only ever writes
// server-generated data via XLSX.write — it must stay that way. Do not add
// XLSX.read/readFile calls against user-uploaded files without first
// upgrading past this advisory.
import * as XLSX from "xlsx";
import { Response } from "express";
import { createLogger } from "../helper/logger";

const exportLogger = createLogger("excel-export");

export interface ExcelExportOptions {
	/**
	 * The name of the sheet in the Excel file
	 */
	sheetName?: string;
	/**
	 * The filename for the exported file (without extension)
	 */
	filename: string;
	/**
	 * Optional: Column headers mapping (field name -> display name)
	 * If not provided, will use the object keys as headers
	 */
	columnHeaders?: Record<string, string>;
	/**
	 * Optional: Specify which fields to include in export (in order)
	 * If not provided, all fields will be exported
	 */
	fields?: string[];
}

/**
 * Converts data to Excel format and sends it as a response
 * @param res Express Response object
 * @param data Array of objects to export
 * @param options Export configuration options
 */
export const exportToExcel = (
	res: Response,
	data: Record<string, unknown>[],
	options: ExcelExportOptions
): void => {
	try {
		const {
			sheetName = "Sheet1",
			filename,
			columnHeaders,
			fields,
		} = options;

		exportLogger.info(`Exporting ${data.length} records to Excel: ${filename}`);

		// Prepare the data for export
		let exportData: Record<string, unknown>[] = data;

		// If specific fields are requested, filter and reorder
		if (fields && fields.length > 0) {
			exportData = data.map((item) => {
				const filtered: Record<string, unknown> = {};
				fields.forEach((field) => {
					// Handle nested fields (e.g., "user.name")
					const value = getNestedValue(item, field);
					filtered[field] = value;
				});
				return filtered;
			});
		}

		// If column headers mapping is provided, rename the keys
		if (columnHeaders) {
			exportData = exportData.map((item) => {
				const renamed: Record<string, unknown> = {};
				Object.keys(item).forEach((key) => {
					const displayName = columnHeaders[key] || key;
					renamed[displayName] = item[key];
				});
				return renamed;
			});
		}

		// Create a new workbook
		const workbook = XLSX.utils.book_new();

		// Convert data to worksheet
		const worksheet = XLSX.utils.json_to_sheet(exportData);

		// Add worksheet to workbook
		XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

		// Generate Excel file buffer
		const excelBuffer = XLSX.write(workbook, {
			type: "buffer",
			bookType: "xlsx",
		});

		// Set response headers
		res.setHeader(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		);
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="${filename}.xlsx"`
		);

		// Send the file
		res.send(excelBuffer);

		exportLogger.info(`Excel export completed: ${filename}.xlsx`);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		exportLogger.error(`Failed to export to Excel: ${errorMessage}`);
		throw error;
	}
};

/**
 * Helper function to get nested values from an object using dot notation
 * @param obj The object to get the value from
 * @param path The path to the value (e.g., "user.name")
 * @returns The value at the path, or undefined if not found
 */
const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
	return path.split(".").reduce((current: unknown, key) => {
		if (current !== null && current !== undefined && typeof current === "object") {
			return (current as Record<string, unknown>)[key];
		}
		return undefined;
	}, obj);
};

/**
 * Formats data for Excel export by handling special types
 * @param data Array of objects to format
 * @returns Formatted data ready for Excel export
 */
export const formatDataForExcel = (data: Record<string, unknown>[]): Record<string, unknown>[] => {
	return data.map((item) => {
		const formatted: Record<string, unknown> = {};
		Object.keys(item).forEach((key) => {
			const value = item[key];

			// Handle Date objects
			if (value instanceof Date) {
				formatted[key] = value.toISOString();
			}
			// Handle null/undefined
			else if (value === null || value === undefined) {
				formatted[key] = "";
			}
			// Handle objects (convert to JSON string)
			else if (typeof value === "object" && !Array.isArray(value)) {
				formatted[key] = JSON.stringify(value);
			}
			// Handle arrays (convert to comma-separated string)
			else if (Array.isArray(value)) {
				formatted[key] = value.join(", ");
			}
			// Handle boolean
			else if (typeof value === "boolean") {
				formatted[key] = value ? "Yes" : "No";
			}
			// Keep primitive values as-is
			else {
				formatted[key] = value;
			}
		});
		return formatted;
	});
};
