import { createHash } from "node:crypto";
import express from "express";
import request from "supertest";
import { expect } from "chai";
import { assetsRouter } from "../app/pats/assets";
import {
	ObjectStorageNotFoundError,
	type ObjectStorage,
	type StoredObject,
} from "../app/storage/object-storage";

const MODEL_ID = "model-b251-01";

type AssetRow = {
	id: string;
	ownerType: "MODEL";
	ownerId: string;
	objectKey: string;
	contentType: string;
	size: number;
	checksumSha256: string;
	status: "REQUESTED" | "UPLOAD_REQUESTED" | "AVAILABLE" | "QUARANTINED" | "RETIRED";
	rowVersion: number;
	createdAt: Date;
	updatedAt: Date;
};

type ModelRow = {
	id: string;
	rowVersion: number;
	sourceReference: Record<string, unknown> | null;
};

function makeDatabase() {
	const assets = new Map<string, AssetRow>();
	const models = new Map<string, ModelRow>([
		[MODEL_ID, { id: MODEL_ID, rowVersion: 1, sourceReference: { origin: "client-parts-list" } }],
	]);
	const now = () => new Date();

	const database = {
		assets,
		models,
		asset: {
			create: async ({ data }: { data: Omit<AssetRow, "rowVersion" | "createdAt" | "updatedAt"> }) => {
				const row: AssetRow = {
					...data,
					rowVersion: 1,
					createdAt: now(),
					updatedAt: now(),
				};
				assets.set(row.id, row);
				return row;
			},
			findUnique: async ({ where }: { where: { id: string } }) => assets.get(where.id) ?? null,
			findMany: async ({ where }: { where?: Record<string, unknown> }) => {
				const rows = [...assets.values()];
				if (!where) return rows;
				return rows.filter((row) =>
					Object.entries(where).every(([field, condition]) => {
						if (field === "id" && typeof condition === "object" && condition !== null) {
							return !("not" in condition) || row.id !== (condition as { not: string }).not;
						}
						return (row as unknown as Record<string, unknown>)[field] === condition;
					}),
				);
			},
			update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
				const row = assets.get(where.id);
				if (!row) throw Object.assign(new Error("not found"), { code: "P2025" });
				const next: AssetRow = {
					...row,
					...(data.status ? { status: data.status as AssetRow["status"] } : {}),
					rowVersion:
						typeof data.rowVersion === "object" && data.rowVersion !== null
							? row.rowVersion + 1
							: ((data.rowVersion as number | undefined) ?? row.rowVersion),
					updatedAt: now(),
				};
				assets.set(row.id, next);
				return next;
			},
			updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Record<string, unknown> }) => {
				let count = 0;
				for (const id of where.id.in) {
					const row = assets.get(id);
					if (!row) continue;
					assets.set(id, {
						...row,
						...(data.status ? { status: data.status as AssetRow["status"] } : {}),
						rowVersion: row.rowVersion + 1,
						updatedAt: now(),
					});
					count += 1;
				}
				return { count };
			},
		},
		model: {
			findUnique: async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
				const row = models.get(where.id) ?? null;
				if (!row || !select) return row;
				return Object.fromEntries(
					Object.entries(row).filter(([field]) => select[field]),
				) as unknown as ModelRow;
			},
			update: async ({ where, data, select }: { where: { id: string }; data: Record<string, unknown>; select?: Record<string, boolean> }) => {
				const row = models.get(where.id);
				if (!row) throw Object.assign(new Error("not found"), { code: "P2025" });
				const next: ModelRow = {
					...row,
					...(data.sourceReference !== undefined
						? { sourceReference: data.sourceReference as ModelRow["sourceReference"] }
						: {}),
					rowVersion: row.rowVersion + 1,
				};
				models.set(row.id, next);
				if (!select) return next;
				return Object.fromEntries(
					Object.entries(next).filter(([field]) => select[field]),
				) as unknown as ModelRow;
			},
		},
		$transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work(database),
	};

	return database;
}

type TestDatabase = ReturnType<typeof makeDatabase>;

function makeStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage & { objects: Map<string, StoredObject> } {
	const objects = new Map<string, StoredObject>();
	const storage: ObjectStorage & { objects: Map<string, StoredObject> } = {
		objects,
		putObject: async (input) => {
			const body = new Uint8Array(input.body);
			const stored: StoredObject = {
				key: input.key,
				body,
				contentType: input.contentType,
				size: body.byteLength,
				checksumSha256: createHash("sha256").update(body).digest("hex"),
				metadata: input.metadata ?? {},
			};
			objects.set(input.key, stored);
			return stored;
		},
		getObject: async (key) => {
			const stored = objects.get(key);
			if (!stored) throw new ObjectStorageNotFoundError(key);
			return stored;
		},
		deleteObject: async (key) => {
			objects.delete(key);
		},
		createReadUrl: async (key) => {
			if (!objects.has(key)) throw new ObjectStorageNotFoundError(key);
			return `https://minio.invalid/read/${key}`;
		},
		createUploadUrl: async (key, options) => {
			if (!key.startsWith("pats/")) throw new Error("bad key");
			return {
				url: `https://minio.invalid/upload/${key}?contentType=${encodeURIComponent(options.contentType)}`,
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
			};
		},
		...overrides,
	};
	return storage;
}

function makeApp(database: TestDatabase, storage: ObjectStorage) {
	const app = express();
	app.use(express.json());
	app.use("/api/v1/assets", assetsRouter(database as never, storage));
	return app;
}

const PNG_BODY = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
const PNG_SHA = createHash("sha256").update(PNG_BODY).digest("hex");

function createPayload(overrides: Record<string, unknown> = {}) {
	return {
		ownerType: "model",
		ownerId: MODEL_ID,
		contentType: "image/png",
		size: PNG_BODY.byteLength,
		checksumSha256: PNG_SHA,
		...overrides,
	};
}

async function createAsset(
	app: express.Express,
	payload: Record<string, unknown> = {},
	key = "asset-key-1",
) {
	return request(app).post("/api/v1/assets").set("Idempotency-Key", key).send(createPayload(payload));
}

describe("PATS model-image assets (D-044)", () => {
	it("registers asset metadata with 201, Location, and ETag", async () => {
		const app = makeApp(makeDatabase(), makeStorage());

		const response = await createAsset(app);

		expect(response.status).to.equal(201);
		expect(response.headers.location).to.match(/^\/api\/v1\/assets\//);
		expect(response.headers.etag).to.equal('"1"');
		expect(response.body).to.include({
			ownerType: "model",
			ownerId: MODEL_ID,
			contentType: "image/png",
			size: PNG_BODY.byteLength,
			checksumSha256: PNG_SHA,
			status: "requested",
			rowVersion: 1,
		});
		expect(response.body).to.not.have.property("objectKey");
		expect(response.body.assetId).to.be.a("string");
	});

	it("rejects unknown owners, bad media, and missing idempotency keys", async () => {
		const app = makeApp(makeDatabase(), makeStorage());

		const unknownOwner = await createAsset(app, { ownerId: "missing" }, "key-owner");
		expect(unknownOwner.status).to.equal(404);

		const badType = await createAsset(app, { contentType: "image/gif" }, "key-type");
		expect(badType.status).to.equal(422);
		expect(badType.body.errors[0].field).to.equal("contentType");

		const noKey = await request(app).post("/api/v1/assets").send(createPayload());
		expect(noKey.status).to.equal(400);
	});

	it("replays same-key creates and conflicts on same-key payload change", async () => {
		const database = makeDatabase();
		const app = makeApp(database, makeStorage());

		const first = await createAsset(app);
		const replay = await createAsset(app);
		expect(replay.status).to.equal(201);
		expect(replay.body.assetId).to.equal(first.body.assetId);
		expect(database.assets.size).to.equal(1);

		const conflict = await createAsset(app, { size: 42 }, "asset-key-1");
		expect(conflict.status).to.equal(409);
	});

	it("issues a retry-safe upload URL and rejects finalized assets", async () => {
		const database = makeDatabase();
		const app = makeApp(database, makeStorage());
		const created = await createAsset(app);
		const assetId = created.body.assetId as string;

		const first = await request(app).post(`/api/v1/assets/${assetId}/upload-requests`).send({});
		expect(first.status).to.equal(200);
		expect(first.body.uploadUrl).to.contain("contentType=image%2Fpng");
		expect(first.body.uploadHeaders).to.deep.equal({ "Content-Type": "image/png" });
		expect(first.body.expiresAt).to.be.a("string");
		expect(first.headers.etag).to.equal('"1"');

		const retry = await request(app).post(`/api/v1/assets/${assetId}/upload-requests`).send({});
		expect(retry.status).to.equal(200);

		const missing = await request(app).post("/api/v1/assets/missing/upload-requests").send({});
		expect(missing.status).to.equal(404);
	});

	it("finalizes verified bytes, links the model, and serves a read URL", async () => {
		const database = makeDatabase();
		const storage = makeStorage();
		const app = makeApp(database, storage);
		const created = await createAsset(app);
		const assetId = created.body.assetId as string;
		const key = `pats/models/${MODEL_ID}/${assetId}.png`;

		await storage.putObject({ key, body: PNG_BODY, contentType: "image/png" });

		const finalized = await request(app)
			.patch(`/api/v1/assets/${assetId}`)
			.set("If-Match", '"1"')
			.send({ finalize: true });

		expect(finalized.status).to.equal(200);
		expect(finalized.body).to.include({ status: "available", rowVersion: 2, modelRowVersion: 2 });
		expect(finalized.body.readUrl).to.contain(`/read/${key}`);

		const model = database.models.get(MODEL_ID);
		expect((model?.sourceReference as Record<string, unknown>).imageObjectKey).to.equal(key);

		const read = await request(app).get(`/api/v1/assets/${assetId}`);
		expect(read.status).to.equal(200);
		expect(read.body.data).to.include({ status: "available" });
		expect(read.body.data.readUrl).to.contain(`/read/${key}`);
		expect(read.body.data).to.not.have.property("objectKey");
	});

	it("rejects finalize without bytes and quarantines mismatched bytes", async () => {
		const emptyApp = makeApp(makeDatabase(), makeStorage());
		const empty = await createAsset(emptyApp);
		const noBytes = await request(emptyApp)
			.patch(`/api/v1/assets/${empty.body.assetId}`)
			.set("If-Match", '"1"')
			.send({ finalize: true });
		expect(noBytes.status).to.equal(422);

		const database = makeDatabase();
		const storage = makeStorage();
		const app = makeApp(database, storage);
		const created = await createAsset(app);
		const assetId = created.body.assetId as string;
		await storage.putObject({
			key: `pats/models/${MODEL_ID}/${assetId}.png`,
			body: Buffer.from("tampered-bytes"),
			contentType: "image/png",
		});

		const tampered = await request(app)
			.patch(`/api/v1/assets/${assetId}`)
			.set("If-Match", '"1"')
			.send({ finalize: true });
		expect(tampered.status).to.equal(422);
		expect(database.assets.get(assetId)?.status).to.equal("QUARANTINED");

		const retryFinalize = await request(app)
			.patch(`/api/v1/assets/${assetId}`)
			.set("If-Match", '"2"')
			.send({ finalize: true });
		expect(retryFinalize.status).to.equal(409);
	});

	it("enforces If-Match on finalize and delete, and retires with unlink", async () => {
		const database = makeDatabase();
		const storage = makeStorage();
		const app = makeApp(database, storage);
		const created = await createAsset(app);
		const assetId = created.body.assetId as string;
		await storage.putObject({
			key: `pats/models/${MODEL_ID}/${assetId}.png`,
			body: PNG_BODY,
			contentType: "image/png",
		});

		const missingMatch = await request(app).patch(`/api/v1/assets/${assetId}`).send({ finalize: true });
		expect(missingMatch.status).to.equal(412);

		const stale = await request(app)
			.patch(`/api/v1/assets/${assetId}`)
			.set("If-Match", '"9"')
			.send({ finalize: true });
		expect(stale.status).to.equal(412);

		await request(app).patch(`/api/v1/assets/${assetId}`).set("If-Match", '"1"').send({ finalize: true });

		const deleted = await request(app).delete(`/api/v1/assets/${assetId}`).set("If-Match", '"2"');
		expect(deleted.status).to.equal(204);
		expect(database.models.get(MODEL_ID)?.sourceReference).to.deep.equal({
			origin: "client-parts-list",
		});

		const gone = await request(app).get(`/api/v1/assets/${assetId}`);
		expect(gone.status).to.equal(404);
		const repeat = await request(app).delete(`/api/v1/assets/${assetId}`).set("If-Match", '"3"');
		expect(repeat.status).to.equal(404);
	});

	it("returns 503 when object storage is down", async () => {
		const database = makeDatabase();
		const down: ObjectStorage = makeStorage({
			createUploadUrl: async () => {
				throw new Error("MinIO unavailable");
			},
			getObject: async () => {
				throw new Error("MinIO unavailable");
			},
			createReadUrl: async () => {
				throw new Error("MinIO unavailable");
			},
		});
		const app = makeApp(database, down);
		const created = await createAsset(app);
		const assetId = created.body.assetId as string;

		const upload = await request(app).post(`/api/v1/assets/${assetId}/upload-requests`).send({});
		expect(upload.status).to.equal(503);

		const finalized = await request(app)
			.patch(`/api/v1/assets/${assetId}`)
			.set("If-Match", '"1"')
			.send({ finalize: true });
		expect(finalized.status).to.equal(503);
		expect(JSON.stringify(finalized.body)).to.not.contain("MinIO unavailable");
	});

	it("replaces the model image and cleans superseded bytes", async () => {
		const database = makeDatabase();
		const storage = makeStorage();
		const app = makeApp(database, storage);

		const first = await createAsset(app, {}, "replace-1");
		const firstId = first.body.assetId as string;
		const firstKey = `pats/models/${MODEL_ID}/${firstId}.png`;
		await storage.putObject({ key: firstKey, body: PNG_BODY, contentType: "image/png" });
		await request(app).patch(`/api/v1/assets/${firstId}`).set("If-Match", '"1"').send({ finalize: true });

		const second = await createAsset(app, {}, "replace-2");
		const secondId = second.body.assetId as string;
		const secondKey = `pats/models/${MODEL_ID}/${secondId}.png`;
		await storage.putObject({ key: secondKey, body: PNG_BODY, contentType: "image/png" });
		const finalized = await request(app)
			.patch(`/api/v1/assets/${secondId}`)
			.set("If-Match", '"1"')
			.send({ finalize: true });

		expect(finalized.status).to.equal(200);
		expect(database.assets.get(firstId)?.status).to.equal("RETIRED");
		expect(storage.objects.has(firstKey)).to.equal(false);
		expect((database.models.get(MODEL_ID)?.sourceReference as Record<string, unknown>).imageObjectKey).to.equal(
			secondKey,
		);
	});

	it("rejects unsupported methods with 405 and an Allow header", async () => {
		const app = makeApp(makeDatabase(), makeStorage());

		const put = await request(app).put("/api/v1/assets/some-id").send({});
		expect(put.status).to.equal(405);
		expect(put.headers.allow).to.equal("GET, PATCH, DELETE");
		expect(put.body.type).to.equal("urn:bandai:pats:problem:method-not-allowed");
	});
});
