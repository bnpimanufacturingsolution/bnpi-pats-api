/**
 * Sync B251 Machibouke model images to private MinIO + link them in Prisma.
 *
 * Source bytes: ../bnpi-pats-app/public/catalog/b251/model-01.png … model-06.png
 * (actual client Deco images, copied to the app's runtime public assets).
 *
 * What this does, idempotently:
 *  1. Uploads each PNG to the private bucket under `pats/models/b251/model-NN.png`
 *     (contentType image/png, sha256 checksum in object metadata, max 10MB).
 *  2. Merges `imageObjectKey` into each B251 Model's `sourceReference` JSON,
 *     preserving all existing keys. The catalog read resolves it server-side
 *     into a short-lived presigned `imageUrl` and never returns the key.
 *
 * Requires PATS_DATABASE_URL. MinIO config falls back to the same defaults
 * as app/create-app.ts (local MinIO via docker compose).
 *
 * Usage: node scripts/pats-sync-model-images.mjs [--dry-run]
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	CreateBucketCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "../generated/pats-client/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const IMAGE_DIR = path.resolve(repoRoot, "..", "bnpi-pats-app", "public", "catalog", "b251");

const MODEL_NUMBERS = ["01", "02", "03", "04", "05", "06"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAGIC_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const endpoint = process.env.MINIO_ENDPOINT ?? "http://localhost:9000";
const accessKeyId = process.env.MINIO_ACCESS_KEY ?? "pats-minio";
const secretAccessKey = process.env.MINIO_SECRET_KEY ?? "change-me-minio";
const bucket = process.env.MINIO_BUCKET ?? "pats-private";

const dryRun = process.argv.includes("--dry-run");

if (!process.env.PATS_DATABASE_URL) {
	throw new Error("PATS_DATABASE_URL is required.");
}

function keyFor(modelNumber) {
	return `pats/models/b251/model-${modelNumber}.png`;
}

const s3 = new S3Client({
	endpoint: endpoint.replace(/\/$/, ""),
	region: "us-east-1",
	forcePathStyle: true,
	credentials: { accessKeyId, secretAccessKey },
});

const prisma = new PrismaClient();

async function ensureBucket() {
	try {
		await s3.send(new HeadBucketCommand({ Bucket: bucket }));
		return;
	} catch (error) {
		if (error?.name !== "NotFound" && error?.$metadata?.httpStatusCode !== 404) throw error;
	}
	if (dryRun) {
		console.log(`[dry-run] would create bucket ${bucket}`);
		return;
	}
	await s3.send(new CreateBucketCommand({ Bucket: bucket }));
	console.log(`created bucket ${bucket}`);
}

async function uploadImage(modelNumber) {
	const filePath = path.join(IMAGE_DIR, `model-${modelNumber}.png`);
	const body = await readFile(filePath);
	if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
		throw new Error(`model-${modelNumber}.png has unexpected size ${body.byteLength}`);
	}
	if (!body.subarray(0, 8).equals(MAGIC_PNG)) {
		throw new Error(`model-${modelNumber}.png failed PNG magic-number validation`);
	}
	const checksumSha256 = createHash("sha256").update(body).digest("hex");
	const key = keyFor(modelNumber);
	if (dryRun) {
		console.log(`[dry-run] would upload ${key} (${body.byteLength} bytes, sha256 ${checksumSha256.slice(0, 12)}…)`);
		return { key, checksumSha256, size: body.byteLength };
	}
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentLength: body.byteLength,
			ContentType: "image/png",
			Metadata: {
				"pats-checksum-sha256": checksumSha256,
				"pats-content-length": String(body.byteLength),
			},
		}),
	);
	const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
	console.log(`uploaded ${key} (${body.byteLength} bytes, etag ${head.ETag})`);
	return { key, checksumSha256, size: body.byteLength };
}

async function linkModel(modelNumber, objectKey) {
	const product = await prisma.product.findUnique({
		where: { productCode: "B251" },
		select: { id: true },
	});
	if (!product) throw new Error('Product B251 not found — run SEED_MODE=demo "pnpm prisma:pats:seed" first.');
	const model = await prisma.model.findUnique({
		where: { productId_modelNumber: { productId: product.id, modelNumber } },
		select: { id: true, sourceReference: true },
	});
	if (!model) throw new Error(`Model B251/${modelNumber} not found.`);
	const current = model.sourceReference && typeof model.sourceReference === "object" ? model.sourceReference : {};
	if (current.imageObjectKey === objectKey) {
		console.log(`linked B251/${modelNumber} -> ${objectKey} (unchanged)`);
		return "unchanged";
	}
	if (dryRun) {
		console.log(`[dry-run] would link B251/${modelNumber} -> ${objectKey}`);
		return "dry-run";
	}
	await prisma.model.update({
		where: { id: model.id },
		data: { sourceReference: { ...current, imageObjectKey: objectKey } },
	});
	console.log(`linked B251/${modelNumber} -> ${objectKey}`);
	return "updated";
}

try {
	await ensureBucket();
	const summary = [];
	for (const modelNumber of MODEL_NUMBERS) {
		const { key } = await uploadImage(modelNumber);
		const link = await linkModel(modelNumber, key);
		summary.push({ modelNumber, key, link });
	}
	console.log(`done: ${summary.filter((s) => s.link === "updated").length} updated, ${summary.filter((s) => s.link === "unchanged").length} unchanged${dryRun ? " (dry-run)" : ""}.`);
} finally {
	await prisma.$disconnect();
}
