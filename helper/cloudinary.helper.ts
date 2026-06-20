import { v2 as cloudinary } from "cloudinary";
import { getLogger } from "./logger";

const logger = getLogger();

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAIN_FOLDER = "pms-assets";

const isTestEnvironment =
	process.env.NODE_ENV === "test" ||
	process.argv.some((arg) => arg.includes("mocha")) ||
	process.argv.some((arg) => arg.includes(".spec.")) ||
	(typeof global !== "undefined" &&
		typeof (global as unknown as Record<string, unknown>).describe === "function" &&
		typeof (global as unknown as Record<string, unknown>).it === "function");

export interface UploadResult {
	url: string;
	publicId: string;
	filename: string;
	filetype: string;
	size: number;
}

const createMockUploadResult = (file: Express.Multer.File, subfolder?: string): UploadResult => ({
	url: `https://mock-cloudinary.com/${subfolder}/${file.originalname}`,
	publicId: `mock_${Date.now()}`,
	filename: file.originalname,
	filetype: file.mimetype,
	size: file.size,
});

const bufferToDataURI = (file: Express.Multer.File): string => {
	const b64 = Buffer.from(file.buffer).toString("base64");
	return `data:${file.mimetype};base64,${b64}`;
};

const getFolderPath = (subfolder?: string): string => {
	return subfolder ? `${MAIN_FOLDER}/${subfolder}` : MAIN_FOLDER;
};

const uploadToCloudinary = async (
	file: Express.Multer.File,
	subfolder?: string,
): Promise<UploadResult> => {
	if (isTestEnvironment) {
		return createMockUploadResult(file, subfolder);
	}

	const dataURI = bufferToDataURI(file);
	const folderPath = getFolderPath(subfolder);

	const result = (await cloudinary.uploader.upload(dataURI, {
		resource_type: "auto",
		folder: folderPath,
		use_filename: true,
		unique_filename: true,
		overwrite: true,
	})) as Record<string, unknown>;

	logger.info("File uploaded successfully", {
		publicId: result.public_id,
		url: result.secure_url,
	});

	return {
		url: result.secure_url as string,
		publicId: result.public_id as string,
		filename: file.originalname,
		filetype: file.mimetype,
		size: file.size,
	};
};

const getFullPublicId = (publicId: string, subfolder?: string): string => {
	if (publicId.includes(MAIN_FOLDER)) {
		return publicId;
	}

	return subfolder ? `${MAIN_FOLDER}/${subfolder}/${publicId}` : `${MAIN_FOLDER}/${publicId}`;
};

const deleteFromCloudinary = async (publicId: string, subfolder?: string): Promise<void> => {
	if (isTestEnvironment) {
		return Promise.resolve();
	}

	try {
		const fullPublicId = getFullPublicId(publicId, subfolder);
		await cloudinary.uploader.destroy(fullPublicId);

		logger.info("File deleted successfully", { publicId: fullPublicId });
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : "Delete failed";
		logger.error("Delete error", { error: errorMessage, publicId });
		throw new Error("Error deleting file from cloud storage");
	}
};

export const uploadFile = async (
	file: Express.Multer.File,
	subfolder?: string,
): Promise<UploadResult> => {
	if (!file?.buffer) {
		throw new Error("File buffer is required");
	}

	return uploadToCloudinary(file, subfolder);
};

export const uploadFiles = async (
	files: Express.Multer.File[],
	subfolder?: string,
): Promise<UploadResult[]> => {
	return Promise.all(files.map((file) => uploadFile(file, subfolder)));
};

export const deleteFile = async (publicId: string, subfolder?: string): Promise<void> => {
	return deleteFromCloudinary(publicId, subfolder);
};

/**
 * Extract publicId from Cloudinary URL
 * Example: https://res.cloudinary.com/cloud/image/upload/v123/pms-assets/folder/file.jpg
 * Returns: pms-assets/folder/file
 */
export const extractPublicIdFromUrl = (url: string): string | null => {
	try {
		// Match Cloudinary URL pattern and extract everything after /upload/vXXXXXXXXXX/
		const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
		if (match && match[1]) {
			return match[1];
		}
		return null;
	} catch (error: unknown) {
		logger.error("Error extracting publicId from URL", { url, error });
		return null;
	}
};

/**
 * Delete file by URL
 */
export const deleteFileByUrl = async (url: string): Promise<void> => {
	const publicId = extractPublicIdFromUrl(url);
	if (!publicId) {
		throw new Error(`Invalid Cloudinary URL: ${url}`);
	}
	return deleteFromCloudinary(publicId);
};

const cloudinaryService = {
	uploadFile,
	uploadFiles,
	deleteFile,
	deleteFileByUrl,
	extractPublicIdFromUrl,
};

export default cloudinaryService;
