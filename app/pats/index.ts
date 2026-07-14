import { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";
import { createMinioObjectStorage } from "../storage/minio-object-storage";
import type { ObjectStorage } from "../storage/object-storage";
import { catalogRouter } from "./catalog.router";
import type { RequestHandler, Router } from "express";

export interface PatsModuleDependencies {
	patsPrisma?: PatsPrismaClient;
	objectStorage?: ObjectStorage;
	workspaceAccess?: RequestHandler;
}

export function patsModule(dependencies: PatsModuleDependencies = {}): Router {
	const patsPrisma = dependencies.patsPrisma ?? new PatsPrismaClient();
	const objectStorage = dependencies.objectStorage ?? createMinioObjectStorage({
		endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
		accessKeyId: process.env.MINIO_ACCESS_KEY ?? "pats-minio",
		secretAccessKey: process.env.MINIO_SECRET_KEY ?? "change-me-minio",
		bucket: process.env.MINIO_BUCKET ?? "pats-private",
		tls: process.env.MINIO_USE_TLS === "true",
	});
	const workspaceAccess = dependencies.workspaceAccess ?? requireWorkspaceRole(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

	return catalogRouter(patsPrisma, objectStorage, workspaceAccess);
}
