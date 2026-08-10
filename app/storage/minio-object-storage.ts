import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	APPROVED_OBJECT_PREFIX,
	assertApprovedObjectKey,
	calculateSha256,
	ObjectStorage,
	ObjectStorageConfigurationError,
	ObjectStorageError,
	ObjectStorageNotFoundError,
	ObjectStorageValidationError,
	PutObjectInput,
	ReadUrlOptions,
	StoredObject,
} from "./object-storage";

export {
	APPROVED_OBJECT_PREFIX,
	assertApprovedObjectKey,
	calculateSha256,
	ObjectStorageConfigurationError,
	ObjectStorageError,
	ObjectStorageNotFoundError,
	ObjectStorageValidationError,
};
export type { ObjectStorage, PutObjectInput, ReadUrlOptions, StoredObject } from "./object-storage";

const CHECKSUM_METADATA_KEY = "pats-checksum-sha256";
const SIZE_METADATA_KEY = "pats-content-length";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_URL_EXPIRY_SECONDS = 300;
const MAX_URL_EXPIRY_SECONDS = 900;

export interface MinioObjectStorageConfig {
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	region?: string;
	tls?: boolean;
	maxReadUrlExpirySeconds?: number;
}

export class MinioObjectStorage implements ObjectStorage {
	private readonly client: S3Client;
	private readonly bucket: string;
	private readonly maxReadUrlExpirySeconds: number;

	public constructor(config: MinioObjectStorageConfig) {
		const endpoint = validateEndpoint(config.endpoint, config.tls);
		validateCredential(config.accessKeyId, "accessKeyId");
		validateCredential(config.secretAccessKey, "secretAccessKey");
		validateBucket(config.bucket);

		const maxReadUrlExpirySeconds = config.maxReadUrlExpirySeconds ?? MAX_URL_EXPIRY_SECONDS;
		if (
			!Number.isInteger(maxReadUrlExpirySeconds) ||
			maxReadUrlExpirySeconds < 1 ||
			maxReadUrlExpirySeconds > MAX_URL_EXPIRY_SECONDS
		) {
			throw new ObjectStorageConfigurationError(
				`maxReadUrlExpirySeconds must be an integer between 1 and ${MAX_URL_EXPIRY_SECONDS}`,
			);
		}

		this.bucket = config.bucket;
		this.maxReadUrlExpirySeconds = maxReadUrlExpirySeconds;
		this.client = new S3Client({
			endpoint,
			region: config.region ?? DEFAULT_REGION,
			forcePathStyle: true,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
		});
	}

	public async putObject(input: PutObjectInput): Promise<StoredObject> {
		assertApprovedObjectKey(input.key);
		validateContentType(input.contentType);
		validateMetadata(input.metadata);

		const body = new Uint8Array(input.body);
		const checksumSha256 = calculateSha256(body);
		if (input.checksumSha256 && input.checksumSha256 !== checksumSha256) {
			throw new ObjectStorageValidationError("checksumSha256 does not match the object body");
		}

		const metadata = {
			...(input.metadata ?? {}),
			[CHECKSUM_METADATA_KEY]: checksumSha256,
			[SIZE_METADATA_KEY]: String(body.byteLength),
		};

		try {
			await this.client.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: input.key,
					Body: body,
					ContentLength: body.byteLength,
					ContentType: input.contentType,
					Metadata: metadata,
				}),
			);
		} catch (error) {
			throw toStorageError(error, input.key);
		}

		return {
			key: input.key,
			body,
			contentType: input.contentType,
			size: body.byteLength,
			checksumSha256,
			metadata: input.metadata ?? {},
		};
	}

	public async getObject(key: string): Promise<StoredObject> {
		assertApprovedObjectKey(key);

		try {
			const response = await this.client.send(
				new GetObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);
			if (!response.Body) {
				throw new ObjectStorageError("Object storage returned an empty body", "EMPTY_OBJECT_BODY");
			}

			const body = await response.Body.transformToByteArray();
			const metadata = withoutInternalMetadata(response.Metadata ?? {});
			const checksumSha256 = calculateSha256(body);
			const storedChecksum = response.Metadata?.[CHECKSUM_METADATA_KEY];
			if (storedChecksum && storedChecksum !== checksumSha256) {
				throw new ObjectStorageError("Object checksum validation failed", "CHECKSUM_MISMATCH");
			}

			return {
				key,
				body,
				contentType: response.ContentType ?? "application/octet-stream",
				size: body.byteLength,
				checksumSha256,
				metadata,
			};
		} catch (error) {
			throw toStorageError(error, key);
		}
	}

	public async deleteObject(key: string): Promise<void> {
		assertApprovedObjectKey(key);

		try {
			await this.client.send(
				new DeleteObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);
		} catch (error) {
			throw toStorageError(error, key);
		}
	}

	public async createReadUrl(key: string, options: ReadUrlOptions = {}): Promise<string> {
		assertApprovedObjectKey(key);
		const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_URL_EXPIRY_SECONDS;
		if (
			!Number.isInteger(expiresInSeconds) ||
			expiresInSeconds < 1 ||
			expiresInSeconds > this.maxReadUrlExpirySeconds
		) {
			throw new ObjectStorageValidationError(
				`expiresInSeconds must be an integer between 1 and ${this.maxReadUrlExpirySeconds}`,
			);
		}

		try {
			await this.client.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);
			return getSignedUrl(
				this.client,
				new GetObjectCommand({ Bucket: this.bucket, Key: key }),
				{ expiresIn: expiresInSeconds },
			);
		} catch (error) {
			throw toStorageError(error, key);
		}
	}
}

export function createMinioObjectStorage(config: MinioObjectStorageConfig): ObjectStorage {
	return new MinioObjectStorage(config);
}

function validateEndpoint(endpoint: string, tls?: boolean): string {
	let parsed: URL;
	try {
		parsed = new URL(endpoint);
	} catch {
		throw new ObjectStorageConfigurationError("endpoint must be a valid http or https URL");
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new ObjectStorageConfigurationError("endpoint must use http or https");
	}
	if (tls === true && parsed.protocol !== "https:") {
		throw new ObjectStorageConfigurationError("TLS configuration requires an https endpoint");
	}
	if (!parsed.hostname) {
		throw new ObjectStorageConfigurationError("endpoint must include a hostname");
	}

	return parsed.toString().replace(/\/$/, "");
}

function validateCredential(value: string, field: string): void {
	if (typeof value !== "string" || value.trim().length < 3) {
		throw new ObjectStorageConfigurationError(`${field} is required`);
	}
}

function validateBucket(bucket: string): void {
	if (!/^[a-z0-9](?:[a-z0-9.-]{1,61}[a-z0-9])?$/.test(bucket)) {
		throw new ObjectStorageConfigurationError("bucket must be a valid S3-compatible bucket name");
	}
}

function validateContentType(contentType: string): void {
	if (typeof contentType !== "string" || !/^[^\s/]+\/[^\s]+$/.test(contentType)) {
		throw new ObjectStorageValidationError("contentType must be a valid media type");
	}
}

function validateMetadata(metadata: Record<string, string> | undefined): void {
	for (const [key, value] of Object.entries(metadata ?? {})) {
		if (key === CHECKSUM_METADATA_KEY || key === SIZE_METADATA_KEY || key.startsWith("pats-")) {
			throw new ObjectStorageValidationError(`metadata key is reserved: ${key}`);
		}
		if (typeof value !== "string") {
			throw new ObjectStorageValidationError(`metadata value must be a string: ${key}`);
		}
	}
}

function withoutInternalMetadata(metadata: Record<string, string>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(metadata).filter(
			([key]) => key !== CHECKSUM_METADATA_KEY && key !== SIZE_METADATA_KEY,
		),
	);
}

function toStorageError(error: unknown, key: string): ObjectStorageError {
	if (error instanceof ObjectStorageError) return error;

	const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
	if (
		candidate?.name === "NoSuchKey" ||
		candidate?.name === "NotFound" ||
		candidate?.$metadata?.httpStatusCode === 404
	) {
		return new ObjectStorageNotFoundError(key);
	}

	return new ObjectStorageError("Object storage operation failed", "OBJECT_STORAGE_OPERATION_FAILED");
}
