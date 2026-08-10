import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { expect } from "chai";
import {
	assertApprovedObjectKey,
	createMinioObjectStorage,
	ObjectStorage,
	ObjectStorageConfigurationError,
	ObjectStorageNotFoundError,
	ObjectStorageValidationError,
	PutObjectInput,
	StoredObject,
} from "../app/storage/minio-object-storage";

class FakeObjectStorage implements ObjectStorage {
	private readonly objects = new Map<string, StoredObject>();

	async putObject(input: PutObjectInput): Promise<StoredObject> {
		assertApprovedObjectKey(input.key);
		const body = new Uint8Array(input.body);
		const checksumSha256 = createHash("sha256").update(body).digest("hex");
		const object = {
			key: input.key,
			body,
			contentType: input.contentType,
			size: body.byteLength,
			checksumSha256,
			metadata: input.metadata ?? {},
		};

		this.objects.set(input.key, object);
		return object;
	}

	async getObject(key: string): Promise<StoredObject> {
		assertApprovedObjectKey(key);
		const object = this.objects.get(key);
		if (!object) throw new ObjectStorageNotFoundError(key);
		return object;
	}

	async deleteObject(key: string): Promise<void> {
		assertApprovedObjectKey(key);
		this.objects.delete(key);
	}

	async createReadUrl(key: string): Promise<string> {
		assertApprovedObjectKey(key);
		if (!this.objects.has(key)) throw new ObjectStorageNotFoundError(key);
		return `fake://storage/${key}`;
	}
}

describe("object-storage contract", () => {
	it("preserves bytes, content type, size, checksum, and metadata", async () => {
		const storage = new FakeObjectStorage();
		const body = Buffer.from("pats-storage-contract", "utf8");

		const stored = await storage.putObject({
			key: "pats/projects/project-1/specification.txt",
			body,
			contentType: "text/plain",
			metadata: { workspace: "line-a" },
		});
		const retrieved = await storage.getObject(stored.key);

		expect(retrieved.contentType).to.equal("text/plain");
		expect(retrieved.size).to.equal(body.byteLength);
		expect(retrieved.checksumSha256).to.equal(createHash("sha256").update(body).digest("hex"));
		expect(retrieved.metadata).to.deep.equal({ workspace: "line-a" });
		assert.deepEqual(Buffer.from(retrieved.body), body);
	});

	it("rejects keys outside the approved pats/ prefix", () => {
		expect(() => assertApprovedObjectKey("uploads/public/file.txt")).to.throw(
			ObjectStorageValidationError,
		);
		expect(() => assertApprovedObjectKey("pats/../private/file.txt")).to.throw(
			ObjectStorageValidationError,
		);
	});

	it("returns typed not-found errors and never exposes missing objects as URLs", async () => {
		const storage = new FakeObjectStorage();

		try {
			await storage.getObject("pats/missing/file.txt");
			assert.fail("expected a not-found error");
		} catch (error) {
			expect(error).to.be.instanceOf(ObjectStorageNotFoundError);
		}

		try {
			await storage.createReadUrl("pats/missing/file.txt");
			assert.fail("expected a not-found error");
		} catch (error) {
			expect(error).to.be.instanceOf(ObjectStorageNotFoundError);
		}
	});

	it("fails closed when MinIO configuration is incomplete", () => {
		expect(() =>
			createMinioObjectStorage({
				endpoint: "http://localhost:9000",
				accessKeyId: "",
				secretAccessKey: "",
				bucket: "pats-private",
			}),
		).to.throw(ObjectStorageConfigurationError);
	});
});

if (process.env.MINIO_SMOKE === "true") {
	describe("MinIO object-storage smoke path", function () {
		this.timeout(30000);

		it("puts, gets, signs, and deletes a private object", async () => {
			const storage = createMinioObjectStorage({
				endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
				accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
				secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
				bucket: process.env.MINIO_BUCKET ?? "pats-private",
				tls: process.env.MINIO_USE_TLS === "true",
			});
			const key = `pats/smoke/${Date.now()}.txt`;
			const body = Buffer.from("minio-smoke", "utf8");

			const stored = await storage.putObject({
				key,
				body,
				contentType: "text/plain",
			});
			const retrieved = await storage.getObject(key);
			const readUrl = await storage.createReadUrl(key, { expiresInSeconds: 60 });

			expect(stored.size).to.equal(body.byteLength);
			expect(Buffer.from(retrieved.body)).to.deep.equal(body);
			expect(readUrl).to.match(/^https?:\/\//);

			await storage.deleteObject(key);
			try {
				await storage.getObject(key);
				assert.fail("expected deleted object to be missing");
			} catch (error) {
				expect(error).to.be.instanceOf(ObjectStorageNotFoundError);
			}
		});
	});
}
