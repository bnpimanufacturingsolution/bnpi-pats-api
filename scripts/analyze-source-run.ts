import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { analyzePdf, formatPdfReport } from "../app/intake/pdf-analyzer";
import { analyzeWorkbook, formatWorkbookReport } from "../app/intake/workbook-analyzer";

const inputOption = readOption("--input");
const outputOption = readOption("--output");

if (!inputOption) {
	console.error("Usage: pnpm analyze:source --input <folder-or-file> [--output <folder>]");
	process.exit(1);
}

const inputPath = path.resolve(inputOption);
const outputPath = path.resolve(outputOption ?? path.resolve(process.cwd(), "reports", `source-run-${new Date().toISOString().replace(/[:.]/g, "-")}`));
const startedAt = new Date().toISOString();
const files = collectSourceFiles(inputPath);

if (files.length === 0) {
	console.error(`No supported workbook or PDF files found under ${inputPath}`);
	process.exit(1);
}

fs.mkdirSync(outputPath, { recursive: true });
const artifacts = files.map((filePath) => analyzeSourceFile(filePath, inputPath, outputPath));
const completedCount = artifacts.filter((artifact) => artifact.extractionStatus === "COMPLETED").length;
const failedCount = artifacts.filter((artifact) => artifact.extractionStatus === "FAILED").length;
const status = failedCount === artifacts.length ? "FAILED" : failedCount > 0 || completedCount < artifacts.length ? "PARTIAL" : "COMPLETED";
const run = {
	input: inputPath,
	status,
	startedAt,
	completedAt: new Date().toISOString(),
	artifactCount: artifacts.length,
	artifacts,
};

fs.writeFileSync(path.join(outputPath, "source-run.json"), `${JSON.stringify(run, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outputPath, "README.md"), formatSummary(run), "utf8");
console.log(`Analyzed ${artifacts.length} source artifact(s) with status ${status}. Reports written to ${outputPath}`);

function analyzeSourceFile(filePath: string, inputRoot: string, reportRoot: string) {
	const bytes = fs.readFileSync(filePath);
	const relativePath = path.relative(inputRoot, filePath) || path.basename(filePath);
	const fileName = path.basename(filePath);
	const artifactType = isPdf(filePath) ? "PDF" : "WORKBOOK";
	const prefix = slugify(relativePath);
	const sha256 = createHash("sha256").update(bytes).digest("hex");

	try {
		const analysis = artifactType === "PDF"
			? analyzePdf({ fileName, bytes })
			: analyzeWorkbook({ fileName, bytes });
		const reportMarkdown = artifactType === "PDF" ? formatPdfReport(analysis) : formatWorkbookReport(analysis);
		const issues = analysis.issues.map((issue) => ({ code: issue.code, status: issue.status, severity: issue.severity, message: issue.message }));
		const extractionStatus = artifactType === "PDF" && issues.length > 0 ? "PARTIAL" : "COMPLETED";
		const analysisPath = `${prefix}.analysis.json`;
		const reportPath = `${prefix}.report.md`;
		fs.writeFileSync(path.join(reportRoot, analysisPath), `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
		fs.writeFileSync(path.join(reportRoot, reportPath), reportMarkdown, "utf8");
		return {
			fileName,
			relativePath,
			artifactType,
			sizeBytes: bytes.length,
			sha256,
			productCode: analysis.productCode,
			extractionStatus,
			issues,
			analysisPath,
			reportPath,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown analyzer error.";
		const analysisPath = `${prefix}.analysis.json`;
		const reportPath = `${prefix}.report.md`;
		const issue = { code: "SOURCE_ANALYSIS_FAILED", status: "NEEDS_REVIEW", severity: "WARNING", message };
		fs.writeFileSync(path.join(reportRoot, analysisPath), `${JSON.stringify({ artifactType, fileName, issues: [issue] }, null, 2)}\n`, "utf8");
		fs.writeFileSync(path.join(reportRoot, reportPath), `# Source evidence analysis - ${fileName}\n\nAnalysis failed: ${message}\n`, "utf8");
		return { fileName, relativePath, artifactType, sizeBytes: bytes.length, sha256, productCode: null, extractionStatus: "FAILED", issues: [issue], analysisPath, reportPath };
	}
}

function formatSummary(run: { input: string; status: string; artifactCount: number; artifacts: Array<{ fileName: string; artifactType: string; productCode: string | null; extractionStatus: string; issues: Array<{ code: string }> }> }): string {
	const lines = [
		"# Source-run analysis",
		"",
		`Input: ${run.input}`,
		`Status: ${run.status}`,
		`Artifacts: ${run.artifactCount}`,
		"",
		"| File | Type | Product | Extraction | Issues |",
		"|---|---|---|---|---:|",
	];
	for (const artifact of run.artifacts) {
		lines.push(`| ${artifact.fileName} | ${artifact.artifactType} | ${artifact.productCode ?? "UNRESOLVED"} | ${artifact.extractionStatus} | ${artifact.issues.length} |`);
	}
	return `${lines.join("\n")}\n`;
}

function readOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function collectSourceFiles(input: string): string[] {
	if (fs.statSync(input).isFile()) return isSupported(input) ? [input] : [];
	return fs.readdirSync(input, { withFileTypes: true }).flatMap((entry) => {
		if (entry.name === "node_modules" || entry.name === ".git") return [];
		const entryPath = path.join(input, entry.name);
		if (entry.isDirectory()) return collectSourceFiles(entryPath);
		return isSupported(entryPath) ? [entryPath] : [];
	}).sort();
}

function isSupported(filePath: string): boolean {
	return /\.(xlsx|xlsm|xls|pdf)$/i.test(filePath);
}

function isPdf(filePath: string): boolean {
	return /\.pdf$/i.test(filePath);
}

function slugify(value: string): string {
	return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
}
