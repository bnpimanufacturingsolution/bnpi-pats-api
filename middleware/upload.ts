import multer from "multer";
import { Request } from "express";
import { sanitizeFilename } from "./fileValidation";
import { getLogger } from "../helper/logger";

const logger = getLogger();

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Enhanced file filter function with magic number validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
	try {
		// Sanitize filename
		file.originalname = sanitizeFilename(file.originalname);

		// Check if file is an image
		if (file.mimetype.startsWith("image/")) {
			// Additional validation will be done after buffer is available
			cb(null, true);
		} else {
			logger.warn("File upload rejected - not an image", {
				filename: file.originalname,
				mimetype: file.mimetype,
				ip: req.ip,
			});
			cb(new Error("Only image files are allowed!"));
		}
	} catch (error) {
		logger.error("File filter error", {
			error: error instanceof Error ? error.message : "Unknown error",
			filename: file.originalname,
		});
		cb(new Error("File validation failed"));
	}
};

// Create multer instance
const upload = multer({
	storage: storage,
	fileFilter: fileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit per file
		files: 10, // Maximum 10 files
	},
});

// Export different upload configurations
export const uploadSingle = upload.single("image");
export const uploadMultiple = upload.array("images", 10); // Maximum 10 images
export const uploadFields = upload.fields([
	{ name: "images", maxCount: 10 },
	{ name: "thumbnails", maxCount: 5 },
]);
export const uploadOrganizationFiles = upload.fields([
	{ name: "logo", maxCount: 1 },
	{ name: "background", maxCount: 1 },
]);

export const uploadUserFiles = upload.fields([{ name: "avatar", maxCount: 1 }]);

// New upload configuration for facility images (1-5 images)
export const uploadFacilityImages = upload.array("images", 5);

// Upload configuration for room type images (multiple images)
export const uploadRoomTypeImages = upload.array("images", 10); // Maximum 10 images for room types

export const uploadFacilityTypeImages = upload.array("images", 10); // Maximum 10 images for facility types

// Upload configuration for CSV files
export const uploadCSV = multer({
	storage: storage,
	fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
		// Check if file is a CSV
		if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
			cb(null, true);
		} else {
			cb(new Error("Only CSV files are allowed!"));
		}
	},
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB limit for CSV files
		files: 1, // Maximum 1 CSV file
	},
}).single("file");

// Upload configuration for documents (PDFs, images, etc.)
export const uploadDocuments = multer({
	storage: storage,
	fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
		try {
			file.originalname = sanitizeFilename(file.originalname);

			// Allow documents (PDF, images, Word, Excel)
			const allowedMimeTypes = [
				"application/pdf",
				"image/jpeg",
				"image/jpg",
				"image/png",
				"image/webp",
				"application/msword",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"application/vnd.ms-excel",
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			];

			if (allowedMimeTypes.includes(file.mimetype)) {
				cb(null, true);
			} else {
				logger.warn("File upload rejected - unsupported file type", {
					filename: file.originalname,
					mimetype: file.mimetype,
					ip: req.ip,
				});
				cb(new Error("Unsupported file type. Allowed: PDF, images, Word, Excel"));
			}
		} catch (error) {
			logger.error("File filter error", {
				error: error instanceof Error ? error.message : "Unknown error",
				filename: file.originalname,
			});
			cb(new Error("File validation failed"));
		}
	},
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit per file
		files: 10, // Maximum 10 files
	},
}).array("documents", 10);

// Flexible upload for submissions - accepts any field name
export const uploadSubmissionFiles = upload.any();

export default upload;
