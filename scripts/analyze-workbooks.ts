import fs from "node:fs";
import path from "node:path";
import { analyzeWorkbookFile, formatWorkbookReport } from "../app/intake/workbook-analyzer";

const input = readOption("--input");
const output = readOption("--output") ?? path.resolve(process.cwd(), "reports", `intake-analysis-${new Date().toISOString().replace(/[:.]/g, "-")}`);

if (!input) {
	console.error("Usage: pnpm analyze:intake --input <workbook-or-folder> [--output <folder>]");
	process.exit(1);
}

const files = collectWorkbookFiles(path.resolve(input));
if (files.length === 0) {
	console.error(`No workbook files found under ${input}`);
	process.exit(1);
}

fs.mkdirSync(output, { recursive: true });
const analyses = files.map((filePath) => analyzeWorkbookFile(filePath));

for (const analysis of analyses) {
	const stem = path.basename(analysis.fileName).replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-");
	fs.writeFileSync(path.join(output, `${stem}.analysis.json`), `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
	fs.writeFileSync(path.join(output, `${stem}.report.md`), formatWorkbookReport(analysis), "utf8");
}

const summary = [
	"# Workbook intake analysis",
	"",
	`Input: ${path.resolve(input)}`,
	`Files analyzed: ${analyses.length}`,
	`Non-empty cells: ${analyses.reduce((total, analysis) => total + analysis.metrics.nonEmptyCells, 0)}`,
	`Formulas: ${analyses.reduce((total, analysis) => total + analysis.metrics.formulaCount, 0)}`,
	`Source anomalies: ${analyses.reduce((total, analysis) => total + analysis.metrics.anomalyCount, 0)}`,
	`Unavailable dependencies: ${analyses.reduce((total, analysis) => total + analysis.metrics.unavailableDependencyCount, 0)}`,
	"",
	"| File | Product | Sheets | Parts | Anomalies | Unavailable dependencies |",
	"|---|---|---:|---:|---:|---:|",
];

for (const analysis of analyses) {
	summary.push(`| ${analysis.fileName} | ${analysis.productCode ?? "UNRESOLVED"} | ${analysis.sheets.length} | ${analysis.metrics.uniquePartCodes} | ${analysis.metrics.anomalyCount} | ${analysis.metrics.unavailableDependencyCount} |`);
}

fs.writeFileSync(path.join(output, "README.md"), `${summary.join("\n")}\n`, "utf8");
console.log(`Analyzed ${analyses.length} workbook(s). Reports written to ${output}`);

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function collectWorkbookFiles(inputPath: string): string[] {
	if (fs.statSync(inputPath).isFile()) return isWorkbook(inputPath) ? [inputPath] : [];

	return fs.readdirSync(inputPath, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(inputPath, entry.name);
		if (entry.isDirectory()) return collectWorkbookFiles(entryPath);
		return isWorkbook(entryPath) ? [entryPath] : [];
	});
}

function isWorkbook(filePath: string): boolean {
	return /\.(xlsx|xlsm|xls)$/i.test(filePath);
}
