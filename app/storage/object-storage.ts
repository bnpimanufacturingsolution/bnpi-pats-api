import { createHash } from "node:crypto";

export const APPROVED_OBJECT_PREFIX = "pats/";

export interface PutObjectInput {
	key: string;
	body: Uint8Array;
	contentType: string;
	checksumSha256?: string;
	metadata?: Record<string, string>;
}

export interface ReadUrlOptions {
	expiresInSeconds?: number;
}

export interface StoredObject {
	key: string;
	body: Uint8Array;
	contentType: string;
	size: number;
	checksumSha256: string;
	metadata: Record<string, string>;
}

export interface ObjectStorage {
	putObject(input: PutObjectInput): Promise<StoredObject>;
	getObject(key: string): Promise<StoredObject>;
	deleteObject(key: string): Promise<void>;
	createReadUrl(key: string, options?: ReadUrlOptions): Promise<string>;
}

export class ObjectStorageError extends Error {
	public constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
		this.name = "ObjectStorageError";
	}
}

export class ObjectStorageConfigurationError extends ObjectStorageError {
	public constructor(message: string) {
		super(message, "OBJECT_STORAGE_CONFIGURATION_ERROR");
		this.name = "ObjectStorageConfigurationError";
	}
}

export class ObjectStorageValidationError extends ObjectStorageError {
	public constructor(message: string) {
		super(message, "OBJECT_STORAGE_VALIDATION_ERROR");
		this.name = "ObjectStorageValidationError";
	}
}

export class ObjectStorageNotFoundError extends ObjectStorageError {
	public constructor(key: string) {
		super(`Object not found: ${key}`, "OBJECT_NOT_FOUND");
		this.name = "ObjectStorageNotFoundError";
	}
}

export function assertApprovedObjectKey(key: string): asserts key is `${typeof APPROVED_OBJECT_PREFIX}${string}` {
	if (
		typeof key !== "string" ||
		!key.startsWith(APPROVED_OBJECT_PREFIX) ||
		key.length <= APPROVED_OBJECT_PREFIX.length ||
		key.includes("\\") ||
		key.includes("\0") ||
		key.split("/").some((segment) => segment === "." || segment === "..")
	) {
		throw new ObjectStorageValidationError(
			`Object key must be a relative path under the ${APPROVED_OBJECT_PREFIX} prefix`,
		);
	}
}

export function calculateSha256(body: Uint8Array): string {
	return createHash("sha256").update(body).digest("hex");
}
