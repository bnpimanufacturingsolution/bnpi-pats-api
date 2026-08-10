import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const PART_CODE_PATTERN = /\b([A-Z]\d{3})\s*-\s*([A-Z0-9]+)\s*-\s*([A-Z0-9]+?)([A-Z]?)\b/i;
const PRODUCT_CODE_PATTERN = /\bProduct\s*Code\s*:\s*([A-Z]\d{3})\b/i;
const FILE_PRODUCT_CODE_PATTERN = /\b(B\d{3})\b/i;

export type WorkbookSourceValue = string | number | boolean | null;

export interface WorkbookInput {
	fileName: string;
	bytes: Uint8Array;
}

export interface SourceCellEvidence {
	sheet: string;
	address: string;
	rawValue: WorkbookSourceValue;
	formula: string | null;
	cachedValue: WorkbookSourceValue;
}

export interface SheetSummary {
	name: string;
	ref: string | null;
	hidden: boolean;
	nonEmptyCells: number;
	formulaCount: number;
	mergeCount: number;
}

export type InferenceStatus = "CONFIRMED" | "INFERRED" | "SOURCE_ANOMALY" | "NEEDS_REVIEW";

export interface PartCodeCrosswalk {
	rawCode: string;
	canonicalCode: string;
	status: InferenceStatus;
	occurrences: Array<{ sheet: string; address: string }>;
	reason: string;
}

export type DataIssueCode =
	| "SOURCE_PREFIX_MISMATCH"
	| "UNAVAILABLE_DEPENDENCY"
	| "FORMULA_CACHE_UNAVAILABLE"
	| "PART_SEQUENCE_GAP";

export interface DataIssue {
	code: DataIssueCode;
	severity: "INFO" | "WARNING" | "ERROR";
	status: "SOURCE_ANOMALY" | "UNAVAILABLE_DEPENDENCY" | "NEEDS_REVIEW";
	message: string;
	sheet: string | null;
	address: string | null;
	value: WorkbookSourceValue | null;
	canonicalValue: WorkbookSourceValue | null;
}

export interface WorkbookAnalysis {
	fileName: string;
	productCode: string | null;
	sheets: SheetSummary[];
	cells: SourceCellEvidence[];
	partCodes: PartCodeCrosswalk[];
	issues: DataIssue[];
	metrics: {
		nonEmptyCells: number;
		formulaCount: number;
		partCodeOccurrences: number;
		uniquePartCodes: number;
		anomalyCount: number;
		unavailableDependencyCount: number;
	};
}

export function analyzeWorkbook(input: WorkbookInput): WorkbookAnalysis {
	const workbook = XLSX.read(input.bytes, {
		cellDates: true,
		cellFormula: true,
		cellNF: false,
		cellStyles: false,
	});
	const sheetNames = workbook.SheetNames;
	const cells: SourceCellEvidence[] = [];
	const partOccurrences = new Map<string, Array<{ sheet: string; address: string }>>();
	const issues: DataIssue[] = [];
	let productCode = findProductCode(workbook, input.fileName);

	for (const sheetName of sheetNames) {
		const sheet = workbook.Sheets[sheetName];
		const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;

		if (!range) continue;

		for (let row = range.s.r; row <= range.e.r; row += 1) {
			for (let column = range.s.c; column <= range.e.c; column += 1) {
				const address = XLSX.utils.encode_cell({ r: row, c: column });
				const cell = sheet[address];
				if (!cell || (cell.v === undefined && cell.f === undefined)) continue;

				const rawValue = serializeValue(cell.v);
				const formula = typeof cell.f === "string" ? cell.f : null;
				const cachedValue = serializeValue(cell.v);
				cells.push({ sheet: sheetName, address, rawValue, formula, cachedValue });

				if (typeof rawValue === "string") {
					productCode ??= extractProductCode(rawValue);
					const partCode = normalizePartCode(rawValue);
					if (partCode) {
						const occurrences = partOccurrences.get(partCode.raw) ?? [];
						occurrences.push({ sheet: sheetName, address });
						partOccurrences.set(partCode.raw, occurrences);
					}
				}

				if (formula) {
					issues.push(...findFormulaIssues(formula, sheetName, address, cachedValue, sheetNames));
				}
			}
		}
	}

	const partCodes = buildPartCrosswalk(partOccurrences, productCode, partOccurrences);
	issues.push(...findCrosswalkIssues(partCodes));
	issues.push(...findSequenceGaps(partCodes));

	const sheets = sheetNames.map((name) => summarizeSheet(workbook, name));
	const formulaCount = sheets.reduce((total, sheet) => total + sheet.formulaCount, 0);
	const nonEmptyCells = sheets.reduce((total, sheet) => total + sheet.nonEmptyCells, 0);

	return {
		fileName: input.fileName,
		productCode: productCode?.toUpperCase() ?? null,
		sheets,
		cells,
		partCodes,
		issues,
		metrics: {
			nonEmptyCells,
			formulaCount,
			partCodeOccurrences: partCodes.reduce((total, part) => total + part.occurrences.length, 0),
			uniquePartCodes: partCodes.length,
			anomalyCount: issues.filter((issue) => issue.status === "SOURCE_ANOMALY").length,
			unavailableDependencyCount: issues.filter((issue) => issue.status === "UNAVAILABLE_DEPENDENCY").length,
		},
	};
}

export function analyzeWorkbookFile(filePath: string): WorkbookAnalysis {
	return analyzeWorkbook({
		fileName: path.basename(filePath),
		bytes: fs.readFileSync(filePath),
	});
}

export function formatWorkbookReport(analysis: WorkbookAnalysis): string {
	const lines = [
		`# Intake analysis - ${analysis.fileName}`,
		"",
		`Product code: ${analysis.productCode ?? "UNRESOLVED"}`,
		`Sheets: ${analysis.sheets.length}`,
		`Non-empty cells: ${analysis.metrics.nonEmptyCells}`,
		`Formulas: ${analysis.metrics.formulaCount}`,
		`Unique part codes: ${analysis.metrics.uniquePartCodes}`,
		`Part-code occurrences: ${analysis.metrics.partCodeOccurrences}`,
		`Source anomalies: ${analysis.metrics.anomalyCount}`,
		`Unavailable dependencies: ${analysis.metrics.unavailableDependencyCount}`,
		"",
		"## Part-code crosswalk",
		"",
		"| Raw code | Canonical code | Status | Occurrences | Reason |",
		"|---|---|---|---:|---|",
	];

	for (const part of analysis.partCodes) {
		lines.push(`| ${part.rawCode} | ${part.canonicalCode} | ${part.status} | ${part.occurrences.length} | ${part.reason} |`);
	}

	lines.push("", "## Issues", "", "| Code | Status | Severity | Location | Message |", "|---|---|---|---|---|");
	for (const issue of analysis.issues) {
		const location = issue.sheet && issue.address ? `${issue.sheet}!${issue.address}` : "workbook";
		lines.push(`| ${issue.code} | ${issue.status} | ${issue.severity} | ${location} | ${issue.message} |`);
	}

	return `${lines.join("\n")}\n`;
}

interface NormalizedPartCode {
	raw: string;
	prefix: string;
	variant: string;
	sequence: string;
	suffix: string;
	canonical: string;
}

function normalizePartCode(value: string): NormalizedPartCode | null {
	const match = value.trim().match(PART_CODE_PATTERN);
	if (!match) return null;

	const prefix = match[1].toUpperCase();
	const variant = match[2].toUpperCase();
	const sequence = match[3].toUpperCase();
	const suffix = match[4].toUpperCase();

	return {
		raw: match[0].trim(),
		prefix,
		variant,
		sequence,
		suffix,
		canonical: `${prefix}-${variant}-${sequence}${suffix}`,
	};
}

function findProductCode(workbook: XLSX.WorkBook, fileName: string): string | null {
	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		for (const address of Object.keys(sheet)) {
			if (address.startsWith("!")) continue;
			const value = serializeValue(sheet[address]?.v);
			if (typeof value !== "string") continue;
			const code = extractProductCode(value);
			if (code) return code;
		}
	}

	return fileName.match(FILE_PRODUCT_CODE_PATTERN)?.[1]?.toUpperCase() ?? null;
}

function extractProductCode(value: string): string | null {
	return value.match(PRODUCT_CODE_PATTERN)?.[1]?.toUpperCase() ?? null;
}

function buildPartCrosswalk(
	occurrencesByRawCode: Map<string, Array<{ sheet: string; address: string }>>,
	productCode: string | null,
	allOccurrences: Map<string, Array<{ sheet: string; address: string }>>,
): PartCodeCrosswalk[] {
	const normalizedParts = [...occurrencesByRawCode.entries()]
		.map(([raw, occurrences]) => ({ raw, parsed: normalizePartCode(raw), occurrences }))
		.filter((part): part is { raw: string; parsed: NormalizedPartCode; occurrences: Array<{ sheet: string; address: string }> } => Boolean(part.parsed));
	const canonicalCodes = new Set(normalizedParts.map((part) => part.parsed.canonical));

	return normalizedParts.map(({ raw, parsed, occurrences }) => {
		if (!productCode || parsed.prefix === productCode.toUpperCase()) {
			return {
				rawCode: raw,
				canonicalCode: parsed.canonical,
				status: "CONFIRMED",
				occurrences,
				reason: "Product prefix and code structure match the workbook context.",
			};
		}

		const candidate = `${productCode.toUpperCase()}-${parsed.variant}-${parsed.sequence}${parsed.suffix}`;
		const baseCandidate = `${productCode.toUpperCase()}-${parsed.variant}-${parsed.sequence}`;
		const hasBaseEvidence = canonicalCodes.has(baseCandidate) || allOccurrences.has(baseCandidate);

		if (hasBaseEvidence && parsed.suffix === "A") {
			return {
				rawCode: raw,
				canonicalCode: candidate,
				status: "SOURCE_ANOMALY",
				occurrences,
				reason: "Duplicate/variant code follows the product sequence, but the source prefix differs; raw value is retained.",
			};
		}

		return {
			rawCode: raw,
			canonicalCode: parsed.canonical,
			status: "NEEDS_REVIEW",
			occurrences,
			reason: "Source prefix differs from the workbook product and lacks enough sequence evidence for automatic normalization.",
		};
	});
}

function findFormulaIssues(
	formula: string,
	sheet: string,
	address: string,
	cachedValue: WorkbookSourceValue,
	sheetNames: string[],
): DataIssue[] {
	const issues: DataIssue[] = [];
	const dependencies = [...formula.matchAll(/(?:'([^']+)'|([A-Za-z0-9_][A-Za-z0-9 _().-]*))!/g)]
		.map((match) => (match[1] ?? match[2]).trim())
		.filter((value, index, values) => values.indexOf(value) === index);

	for (const dependency of dependencies) {
		const external = dependency.includes("[") || dependency.includes("]");
		const localSheet = sheetNames.includes(dependency);
		if (!external && localSheet) continue;

		issues.push({
			code: "UNAVAILABLE_DEPENDENCY",
			severity: "WARNING",
			status: "UNAVAILABLE_DEPENDENCY",
			message: `Formula depends on ${external ? "an external workbook" : "an uncaptured sheet"}: ${dependency}.`,
			sheet,
			address,
			value: formula,
			canonicalValue: cachedValue,
		});
	}

	if (dependencies.length > 0 && cachedValue === null) {
		issues.push({
			code: "FORMULA_CACHE_UNAVAILABLE",
			severity: "INFO",
			status: "UNAVAILABLE_DEPENDENCY",
			message: "Formula has no cached value in the captured workbook.",
			sheet,
			address,
			value: formula,
			canonicalValue: null,
		});
	}

	return issues;
}

function findSequenceGaps(partCodes: PartCodeCrosswalk[]): DataIssue[] {
	const issues: DataIssue[] = [];
	const sequencesByPrefix = new Map<string, number[]>();

	for (const part of partCodes) {
		const parsed = normalizePartCode(part.canonicalCode);
		if (!parsed || !/^\d+$/.test(parsed.sequence)) continue;
		const key = `${parsed.prefix}-${parsed.variant}${parsed.suffix}`;
		const sequences = sequencesByPrefix.get(key) ?? [];
		sequences.push(Number(parsed.sequence));
		sequencesByPrefix.set(key, sequences);
	}

	for (const [key, values] of sequencesByPrefix) {
		if (values.length < 3) continue;
		const sorted = [...new Set(values)].sort((a, b) => a - b);
		const missing = [];
		for (let value = sorted[0]; value <= sorted[sorted.length - 1]; value += 1) {
			if (!sorted.includes(value)) missing.push(value);
		}
		if (missing.length > 0) {
			issues.push({
				code: "PART_SEQUENCE_GAP",
				severity: "WARNING",
				status: "NEEDS_REVIEW",
				message: `Part sequence ${key} skips: ${missing.map((value) => String(value).padStart(2, "0")).join(", ")}.`,
				sheet: null,
				address: null,
				value: key,
				canonicalValue: missing.join(","),
			});
		}
	}

	return issues;
}

function findCrosswalkIssues(partCodes: PartCodeCrosswalk[]): DataIssue[] {
	return partCodes
		.filter((part) => part.status === "SOURCE_ANOMALY" || part.status === "NEEDS_REVIEW")
		.map((part) => ({
			code: "SOURCE_PREFIX_MISMATCH" as const,
			severity: part.status === "SOURCE_ANOMALY" ? "WARNING" as const : "ERROR" as const,
			status: part.status === "SOURCE_ANOMALY" ? "SOURCE_ANOMALY" as const : "NEEDS_REVIEW" as const,
			message: `${part.rawCode} does not match the inferred product prefix; canonical candidate is ${part.canonicalCode}.`,
			sheet: part.occurrences[0]?.sheet ?? null,
			address: part.occurrences[0]?.address ?? null,
			value: part.rawCode,
			canonicalValue: part.canonicalCode,
		}));
}

function summarizeSheet(workbook: XLSX.WorkBook, name: string): SheetSummary {
	const sheet = workbook.Sheets[name];
	let nonEmptyCells = 0;
	let formulaCount = 0;

	for (const address of Object.keys(sheet)) {
		if (address.startsWith("!")) continue;
		const cell = sheet[address];
		if (!cell || (cell.v === undefined && cell.f === undefined)) continue;
		nonEmptyCells += 1;
		if (typeof cell.f === "string") formulaCount += 1;
	}

	const workbookSheets = (workbook.Workbook as { Sheets?: Array<{ name?: string; Hidden?: number }> } | undefined)?.Sheets ?? [];
	const metadata = workbookSheets.find((entry) => entry.name === name);

	return {
		name,
		ref: typeof sheet["!ref"] === "string" ? sheet["!ref"] : null,
		hidden: metadata?.Hidden === 1 || metadata?.Hidden === 2,
		nonEmptyCells,
		formulaCount,
		mergeCount: Array.isArray(sheet["!merges"]) ? sheet["!merges"].length : 0,
	};
}

function serializeValue(value: unknown): WorkbookSourceValue {
	if (value === undefined || value === null) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	return String(value);
}
