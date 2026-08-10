import fs from "node:fs";
import path from "node:path";
import { expect } from "chai";
import { parse } from "yaml";

const repositoryRoot = path.resolve(__dirname, "..");
const compose = parse(
	fs.readFileSync(path.join(repositoryRoot, "docker-compose.yml"), "utf8"),
) as {
	services: Record<string, any>;
	volumes: Record<string, unknown>;
};

describe("on-prem Compose contract", () => {
	it("defines the PATS base services", () => {
		expect(Object.keys(compose.services)).to.include.members([
			"postgres",
			"minio",
			"minio-init",
			"app",
		]);
	});

	it("defines pinned PostgreSQL persistence and readiness", () => {
		const postgres = compose.services.postgres;

		expect(postgres.image).to.match(/^postgres:16\.\d+-alpine$/);
		expect(postgres.volumes).to.deep.include("pats-postgres-data:/var/lib/postgresql/data");
		expect(postgres.healthcheck.test.join(" ")).to.include("pg_isready");
	});

	it("defines pinned private MinIO storage and readiness", () => {
		const minio = compose.services.minio;
		const initializer = compose.services["minio-init"];

		expect(minio.image).to.match(/^minio\/minio:RELEASE\./);
		expect(minio.volumes).to.deep.include("pats-minio-data:/data");
		expect(minio.ports).to.include("${MINIO_API_PORT:-9000}:9000");
		expect(minio.ports).to.include("${MINIO_CONSOLE_PORT:-9001}:9001");
		expect(minio.healthcheck.test.join(" ")).to.match(/minio\/health\/live/);
		expect(initializer.depends_on.minio.condition).to.equal("service_healthy");
		expect(String(initializer.command)).to.include("mb --ignore-existing");
		expect(String(initializer.command)).to.include("anonymous set private");
	});

	it("keeps the API on internal port 3000 and waits for PATS dependencies", () => {
		const app = compose.services.app;

		expect(app.ports).to.include("${PORT:-3000}:3000");
		expect(app.profiles).to.include("pats");
		expect(app.depends_on.postgres.condition).to.equal("service_healthy");
		expect(app.depends_on.minio.condition).to.equal("service_healthy");
	});

	it("keeps Redis opt-in and declares named persistence", () => {
		const redis = compose.services.redis;

		expect(redis.profiles).to.include("redis");
		expect(redis.volumes).to.deep.include("pats-redis-data:/data");
		expect(Object.keys(compose.volumes)).to.include.members([
			"pats-postgres-data",
			"pats-minio-data",
			"pats-redis-data",
		]);
	});
});
