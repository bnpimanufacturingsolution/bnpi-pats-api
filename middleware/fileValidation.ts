import { Request } from "express";
import multer from "multer";
import { getLogger } from "../helper/logger";

const logger = getLogger();

/**
 * File validation using magic numbers (file signatures)
 * This prevents MIME type spoofing attacks
 */

// Common file signatures (magic numbers) for validation
const FILE_SIGNATURES: Record<string, { magic: number[][]; ext: string[]; mime: string[] }> = {
	// Images
	jpeg: {
		magic: [
			[0xff, 0xd8, 0xff],
		],
		ext: ["jpg", "jpeg"],
		mime: ["image/jpeg"],
	},
	png: {
		magic: [
			[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
		],
		ext: ["png"],
		mime: ["image/png"],
	},
	gif: {
		magic: [
			[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
			[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
		],
		ext: ["gif"],
		mime: ["image/gif"],
	},
	webp: {
		magic: [
			[0x52, 0x49, 0x46, 0x46], // RIFF at start, WEBP at offset 8
		],
		ext: ["webp"],
		mime: ["image/webp"],
	},
	bmp: {
		magic: [
			[0x42, 0x4d],
		],
		ext: ["bmp"],
		mime: ["image/bmp"],
	},

	// Documents
	pdf: {
		magic: [
			[0x25, 0x50, 0x44, 0x46],
		],
		ext: ["pdf"],
		mime: ["application/pdf"],
	},

	// Archives
	zip: {
		magic: [
			[0x50, 0x4b, 0x03, 0x04],
			[0x50, 0x4b, 0x05, 0x06],
			[0x50, 0x4b, 0x07, 0x08],
		],
		ext: ["zip", "jar", "docx", "xlsx", "pptx"],
		mime: ["application/zip"],
	},
};

/**
 * Check if buffer matches any of the magic number patterns
 */
function checkMagicNumber(buffer: Buffer, signatures: number[][]): boolean {
	return signatures.some((signature) => {
		if (buffer.length < signature.length) {
			return false;
		}
		return signature.every((byte, index) => buffer[index] === byte);
	});
}

/**
 * Detect file type from buffer using magic numbers
 */
export function detectFileType(buffer: Buffer): { type: string; mime: string } | null {
	for (const [type, info] of Object.entries(FILE_SIGNATURES)) {
		if (checkMagicNumber(buffer, info.magic)) {
			return {
				type,
				mime: info.mime[0],
			};
		}
	}
	return null;
}

/**
 * Validate file against allowed types using magic numbers
 */
export function validateFileBuffer(
	buffer: Buffer,
	allowedTypes: string[],
): { valid: boolean; detectedType?: string; error?: string } {
	if (!buffer || buffer.length === 0) {
		return { valid: false, error: "Empty file buffer" };
	}

	const detected = detectFileType(buffer);

	if (!detected) {
		return { valid: false, error: "Unknown or unsupported file type" };
	}

	// Check if detected type is in allowed types
	const typeInfo = FILE_SIGNATURES[detected.type];
	const isAllowed =
		allowedTypes.some((allowed) => typeInfo.ext.includes(allowed.toLowerCase())) ||
		allowedTypes.some((allowed) => typeInfo.mime.includes(allowed.toLowerCase()));

	if (!isAllowed) {
		return {
			valid: false,
			detectedType: detected.type,
			error: `File type not allowed. Detected: ${detected.type}`,
		};
	}

	return { valid: true, detectedType: detected.type };
}

/**
 * Enhanced file filter for multer with magic number validation
 */
export function createSecureFileFilter(allowedTypes: string[]) {
	return async (
		req: Request,
		file: Express.Multer.File,
		cb: multer.FileFilterCallback,
	): Promise<void> => {
		try {
			// First check MIME type (quick check)
			const mimeAllowed = allowedTypes.some((type) => {
				if (type.includes("/")) {
					return file.mimetype === type;
				}
				return file.mimetype.startsWith(type + "/");
			});

			if (!mimeAllowed) {
				logger.warn("File rejected - MIME type not allowed", {
					filename: file.originalname,
					mimetype: file.mimetype,
					allowedTypes,
				});
				cb(new Error(`File type ${file.mimetype} is not allowed`));
				return;
			}

			// For multer memory storage, buffer is available
			// For disk storage, we'd need to read the file
			if ((file as any).buffer) {
				const buffer = (file as any).buffer as Buffer;
				const validation = validateFileBuffer(buffer.slice(0, 16), allowedTypes);

				if (!validation.valid) {
					logger.warn("File rejected - Magic number validation failed", {
						filename: file.originalname,
						mimetype: file.mimetype,
						detectedType: validation.detectedType,
						error: validation.error,
					});
					cb(new Error(validation.error || "Invalid file type"));
					return;
				}

				logger.debug("File validated successfully", {
					filename: file.originalname,
					detectedType: validation.detectedType,
				});
			}

			cb(null, true);
		} catch (error) {
			logger.error("File validation error", {
				error: error instanceof Error ? error.message : "Unknown error",
				filename: file.originalname,
			});
			cb(new Error("File validation failed"));
		}
	};
}

/**
 * Validate image dimensions and size
 */
export interface ImageValidationOptions {
	maxWidth?: number;
	maxHeight?: number;
	minWidth?: number;
	minHeight?: number;
	maxSizeBytes?: number;
}

/**
 * Get image dimensions from buffer (basic implementation)
 * For production, consider using a library like 'sharp' or 'image-size'
 */
export function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
	const detected = detectFileType(buffer);
	if (!detected) return null;

	try {
		switch (detected.type) {
			case "png":
				// PNG: width at bytes 16-19, height at bytes 20-23 (big-endian)
				if (buffer.length >= 24) {
					return {
						width: buffer.readUInt32BE(16),
						height: buffer.readUInt32BE(20),
					};
				}
				break;

			case "jpeg":
				// JPEG: more complex, would need full parsing
				// For now, return null and recommend using 'sharp' library
				return null;

			case "gif":
				// GIF: width at bytes 6-7, height at bytes 8-9 (little-endian)
				if (buffer.length >= 10) {
					return {
						width: buffer.readUInt16LE(6),
						height: buffer.readUInt16LE(8),
					};
				}
				break;
		}
	} catch (error) {
		logger.error("Error reading image dimensions", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}

	return null;
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
	// Remove any path components
	let sanitized = filename.replace(/^.*[\\\/]/, "");

	// Remove any non-alphanumeric characters except dots, hyphens, and underscores
	sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");

	// Prevent multiple dots (could be used for extension spoofing)
	sanitized = sanitized.replace(/\.+/g, ".");

	// Limit length
	if (sanitized.length > 255) {
		const ext = sanitized.split(".").pop() || "";
		sanitized = sanitized.substring(0, 255 - ext.length - 1) + "." + ext;
	}

	// Prevent files starting with dot (hidden files)
	if (sanitized.startsWith(".")) {
		sanitized = "_" + sanitized.substring(1);
	}

	return sanitized || "unnamed_file";
}

/**
 * Generate secure random filename
 */
export function generateSecureFilename(originalName: string): string {
	const ext = originalName.split(".").pop() || "bin";
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 15);
	return `${timestamp}_${random}.${ext}`;
}

export default {
	detectFileType,
	validateFileBuffer,
	createSecureFileFilter,
	getImageDimensions,
	sanitizeFilename,
	generateSecureFilename,
};
