import { createHash } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import multer from "multer";
import { Prisma, PrismaClient as PatsPrismaClient, SourceArtifactType, SourceExtractionStatus, SourceRunStatus } from "../../generated/pats-client";
import { analyzePdf, formatPdfReport, type PdfAnalysis } from "./pdf-analyzer";
import { analyzeWorkbook, formatWorkbookReport, type WorkbookAnalysis } from "./workbook-analyzer";

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const MAX_RUN_BYTES = 50 * 1024 * 1024;
const MAX_ARTIFACTS = 20;

const sourceRunUpload = multer({
	storage: multer.memoryStorage(),
	limits: { files: MAX_ARTIFACTS, fileSize: MAX_ARTIFACT_BYTES },
});

type SupportedAnalysis = WorkbookAnalysis | PdfAnalysis;
type SourceRunPrisma = Pick<PatsPrismaClient, "sourceRun" | "sourceArtifact">;

interface ArtifactResult {
	artifactType: SourceArtifactType;
	analysis: Record<string, unknown> | SupportedAnalysis;
	productCode: string | null;
	reportMarkdown: string;
	extractionStatus: SourceExtractionStatus;
	issues: Array<{
		code: string;
		status: string;
		severity: string;
		message: string;
		sheet?: string | null;
		address?: string | null;
		value?: unknown;
		canonicalValue?: unknown;
	}>;
}

export function sourceRunRouter(patsPrisma: SourceRunPrisma, workspaceAccess: RequestHandler): Router {
	const router = Router();

	/**
	 * @openapi
	 * /api/pats/intake/runs:
	 *   post:
	 *     summary: Persist a traceable source analysis run
	 *     description: Analyzes uploaded workbooks and PDFs, then persists artifact hashes, normalized analysis JSON, reports, and issue records. Raw file bytes are not stored in PostgreSQL.
	 *     tags: [PATS Intake]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               sourceLabel:
	 *                 type: string
	 *               files:
	 *                 type: array
	 *                 maxItems: 20
	 *                 items:
	 *                   type: string
	 *                   format: binary
	 *     responses:
	 *       201:
	 *         description: Persisted source-run summary
	 *       400:
	 *         description: Missing files or workspace context
	 *       413:
	 *         description: Upload exceeds per-file or source-run limits
	 */
	router.post("/pats/intake/runs", workspaceAccess, (req, res, next) => {
		sourceRunUpload.array("files", MAX_ARTIFACTS)(req, res, (error: unknown) => {
			if (error) {
				if (error instanceof multer.MulterError && (error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT")) {
					res.status(413).json({ success: false, code: 413, message: "Source run exceeds the 20-file or 10 MB per-file upload limit." });
					return;
				}
				next(error);
				return;
			}

			const files = Array.isArray(req.files) ? req.files : [];
			if (files.length === 0) {
				res.status(400).json({ success: false, code: 400, message: "At least one source file is required in the files field." });
				return;
			}

			const totalBytes = files.reduce((total, file) => total + file.size, 0);
			if (totalBytes > MAX_RUN_BYTES) {
				res.status(413).json({ success: false, code: 413, message: "Source run exceeds the 50 MB total upload limit." });
				return;
			}

			const workspaceId = getWorkspaceId(req);
			if (!workspaceId) {
				res.status(400).json({ success: false, code: 400, message: "Workspace context is required for source runs." });
				return;
			}

			void persistSourceRun(patsPrisma, workspaceId, getSourceLabel(req), files)
				.then((result) => res.status(201).json({ success: true, data: result }))
				.catch(next);
		});
	});

	/**
	 * @openapi
	 * /api/pats/intake/runs/{runId}:
	 *   get:
	 *     summary: Read a persisted source analysis run
	 *     description: Returns artifact-level analysis, reports, hashes, and issue records scoped to the requested workspace.
	 *     tags: [PATS Intake]
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: runId
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Source-run detail
	 *       404:
	 *         description: Source run not found in the workspace
 	*/
	router.get("/pats/intake/runs/:runId", workspaceAccess, async (req, res, next) => {
		try {
			const workspaceId = getWorkspaceId(req);
			if (!workspaceId) {
				res.status(400).json({ success: false, code: 400, message: "Workspace context is required for source runs." });
				return;
			}

			const run = await patsPrisma.sourceRun.findFirst({
				where: { id: req.params.runId, workspaceId },
				include: {
					artifacts: {
						orderBy: { createdAt: "asc" },
						include: { issues: { orderBy: { createdAt: "asc" } } },
					},
				},
			});

			if (!run) {
				res.status(404).json({ success: false, code: 404, message: "Source run not found." });
				return;
			}

			res.status(200).json({ success: true, data: run });
		} catch (error) {
			next(error);
		}
	});

	return router;
}

async function persistSourceRun(
	patsPrisma: SourceRunPrisma,
	workspaceId: string,
	sourceLabel: string,
	files: Express.Multer.File[],
): Promise<{
	sourceRunId: string;
	status: SourceRunStatus;
	artifacts: Array<{
		id: string;
		fileName: string;
		artifactType: SourceArtifactType;
		extractionStatus: SourceExtractionStatus;
		productCode: string | null;
		issueCount: number;
		sha256: string;
	}>;
}> {
	const run = await patsPrisma.sourceRun.create({
		data: { workspaceId, sourceLabel, status: SourceRunStatus.RUNNING },
	});
	const persistedArtifacts: Array<{
		id: string;
		fileName: string;
		artifactType: SourceArtifactType;
		extractionStatus: SourceExtractionStatus;
		productCode: string | null;
		issueCount: number;
		sha256: string;
	}> = [];
	const extractionStatuses: SourceExtractionStatus[] = [];

	try {
		for (const file of files) {
			const sha256 = createHash("sha256").update(file.buffer).digest("hex");
			const result = analyzeSourceArtifact(file);
			const artifact = await patsPrisma.sourceArtifact.create({
			data: {
				sourceRunId: run.id,
				fileName: file.originalname,
				artifactType: result.artifactType,
				mimeType: file.mimetype || guessMimeType(file.originalname),
				sizeBytes: file.size,
				sha256,
				productCode: result.productCode,
				extractionStatus: result.extractionStatus,
				analysis: result.analysis as Prisma.InputJsonValue,
				reportMarkdown: result.reportMarkdown,
				issues: {
					create: result.issues.map((issue) => ({
						code: issue.code,
						status: issue.status,
						severity: issue.severity,
						message: issue.message,
						sheet: issue.sheet,
						address: issue.address,
						value: issue.value === undefined ? undefined : toJsonValue(issue.value),
						canonicalValue: issue.canonicalValue === undefined ? undefined : toJsonValue(issue.canonicalValue),
					})),
				},
			},
			});

			extractionStatuses.push(result.extractionStatus);
			persistedArtifacts.push({
				id: artifact.id,
				fileName: file.originalname,
				artifactType: result.artifactType,
				extractionStatus: result.extractionStatus,
				productCode: result.productCode,
				issueCount: result.issues.length,
				sha256,
			});
		}

		const status = deriveRunStatus(extractionStatuses);
		await patsPrisma.sourceRun.update({
			where: { id: run.id },
			data: { status, completedAt: new Date() },
		});

		return { sourceRunId: run.id, status, artifacts: persistedArtifacts };
	} catch (error) {
		try {
			await patsPrisma.sourceRun.update({
				where: { id: run.id },
				data: { status: SourceRunStatus.FAILED, completedAt: new Date() },
			});
		} catch {
			// Preserve the original persistence error; the failed-run update is best effort.
		}
		throw error;
	}
}

function analyzeSourceArtifact(file: Express.Multer.File): ArtifactResult {
	const artifactType = getArtifactType(file.originalname);

	try {
		if (artifactType === SourceArtifactType.WORKBOOK) {
			const analysis = analyzeWorkbook({ fileName: file.originalname, bytes: file.buffer });
			return {
				artifactType,
				analysis,
				productCode: analysis.productCode,
				reportMarkdown: formatWorkbookReport(analysis),
				extractionStatus: SourceExtractionStatus.COMPLETED,
				issues: analysis.issues.map((issue) => ({
					code: issue.code,
					status: issue.status,
					severity: issue.severity,
					message: issue.message,
					sheet: issue.sheet,
					address: issue.address,
					value: issue.value,
					canonicalValue: issue.canonicalValue,
				})),
			};
		}

		if (artifactType === SourceArtifactType.PDF) {
			const analysis = analyzePdf({ fileName: file.originalname, bytes: file.buffer });
			return {
				artifactType,
				analysis,
				productCode: analysis.productCode,
				reportMarkdown: formatPdfReport(analysis),
				extractionStatus: analysis.issues.length > 0 ? SourceExtractionStatus.PARTIAL : SourceExtractionStatus.COMPLETED,
				issues: analysis.issues,
			};
		}

		const issue = {
			code: "UNSUPPORTED_ARTIFACT_TYPE",
			status: "UNAVAILABLE_DEPENDENCY",
			severity: "WARNING",
			message: "This source-run endpoint currently persists only workbook and PDF analyzers; the artifact type is retained for follow-up handling.",
		};
		return {
			artifactType,
			analysis: { artifactType: "OTHER", fileName: file.originalname, issues: [issue] },
			productCode: null,
			reportMarkdown: `# Source evidence analysis - ${file.originalname}\n\nUnsupported artifact type.\n\nIssue: ${issue.message}\n`,
			extractionStatus: SourceExtractionStatus.FAILED,
			issues: [issue],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown analyzer error.";
		const issue = {
			code: "SOURCE_ANALYSIS_FAILED",
			status: "NEEDS_REVIEW",
			severity: "WARNING",
			message,
		};
		return {
			artifactType,
			analysis: { artifactType, fileName: file.originalname, issues: [issue] },
			productCode: null,
			reportMarkdown: `# Source evidence analysis - ${file.originalname}\n\nAnalysis failed: ${message}\n`,
			extractionStatus: SourceExtractionStatus.FAILED,
			issues: [issue],
		};
	}
}

function deriveRunStatus(statuses: SourceExtractionStatus[]): SourceRunStatus {
	if (statuses.length > 0 && statuses.every((status) => status === SourceExtractionStatus.FAILED)) return SourceRunStatus.FAILED;
	if (statuses.some((status) => status !== SourceExtractionStatus.COMPLETED)) return SourceRunStatus.PARTIAL;
	return SourceRunStatus.COMPLETED;
}

function getArtifactType(fileName: string): SourceArtifactType {
	if (/\.(xlsx|xlsm|xls)$/i.test(fileName)) return SourceArtifactType.WORKBOOK;
	if (/\.pdf$/i.test(fileName)) return SourceArtifactType.PDF;
	return SourceArtifactType.OTHER;
}

function guessMimeType(fileName: string): string {
	if (/\.pdf$/i.test(fileName)) return "application/pdf";
	if (/\.(xlsx|xlsm)$/i.test(fileName)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
	if (/\.xls$/i.test(fileName)) return "application/vnd.ms-excel";
	return "application/octet-stream";
}

function getWorkspaceId(req: Request): string | undefined {
	const requestWorkspaceId = (req as Request & { workspaceId?: string }).workspaceId;
	if (requestWorkspaceId) return requestWorkspaceId;
	const header = req.headers["x-workspace-id"];
	return typeof header === "string" ? header : undefined;
}

function getSourceLabel(req: Request): string {
	const value = typeof req.body?.sourceLabel === "string" ? req.body.sourceLabel.trim() : "";
	return value || "Drive source intake";
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
	if (value === null || value === undefined) return Prisma.JsonNull;
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
