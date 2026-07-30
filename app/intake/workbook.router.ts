import { Router, type RequestHandler } from "express";
import multer from "multer";
import { analyzeWorkbook, formatWorkbookReport } from "./workbook-analyzer";

const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
const workbookUpload = multer({
	storage: multer.memoryStorage(),
	limits: { files: 1, fileSize: MAX_WORKBOOK_BYTES },
});

export function workbookIntakeRouter(workspaceAccess: RequestHandler): Router {
	const router = Router();

	/**
	 * @openapi
	 * /api/pats/intake/workbooks/analyze:
	 *   post:
	 *     summary: Analyze a workbook without persisting it
	 *     description: Extracts source cells, formulas, part-code crosswalks, and anomaly/dependency issues. The uploaded bytes are held in memory only.
	 *     tags: [PATS Intake]
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         multipart/form-data:
	 *           schema:
	 *             type: object
	 *             required: [file]
	 *             properties:
	 *               file:
	 *                 type: string
	 *                 format: binary
	 *     responses:
	 *       200:
	 *         description: Read-only workbook analysis
	 *       400:
	 *         description: Missing or unsupported workbook
	 *       413:
	 *         description: Workbook exceeds the 10 MB analysis limit
	 */
	router.post(
		"/pats/intake/workbooks/analyze",
		workspaceAccess,
		(req, res, next) => {
			workbookUpload.single("file")(req, res, (error: unknown) => {
				if (error) {
					if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
						res.status(413).json({ success: false, code: 413, message: "Workbook exceeds the 10 MB analysis limit." });
						return;
					}
					next(error);
					return;
				}

				if (!req.file) {
					res.status(400).json({ success: false, code: 400, message: "A workbook file is required." });
					return;
				}

				if (!/\.(xlsx|xlsm|xls)$/i.test(req.file.originalname)) {
					res.status(400).json({ success: false, code: 400, message: "Only XLSX, XLSM, and XLS workbooks are supported." });
					return;
				}

				try {
					const analysis = analyzeWorkbook({ fileName: req.file.originalname, bytes: req.file.buffer });
					res.status(200).json({ success: true, data: analysis, report: formatWorkbookReport(analysis) });
				} catch (analysisError) {
					next(analysisError);
				}
			});
		},
	);

	return router;
}
