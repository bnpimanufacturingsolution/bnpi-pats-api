import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function loadDotEnvIfMissing() {
	const envPath = path.join(root, ".env");
	if (!fs.existsSync(envPath)) return;
	const raw = fs.readFileSync(envPath, "utf8");
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
		const idx = trimmed.indexOf("=");
		const key = trimmed.slice(0, idx).trim();
		let value = trimmed.slice(idx + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

loadDotEnvIfMissing();

const envName = (process.env.ENV ?? process.env.NODE_ENV ?? "").toLowerCase();
if (envName === "production" || envName === "prod") {
	console.error("snap refuses to run in production.");
	process.exit(1);
}

if (!process.env.PATS_DATABASE_URL) {
	console.error("PATS_DATABASE_URL is missing (checked env + .env).");
	process.exit(1);
}

if (!process.env.PATS_SEED_PASSWORD || process.env.PATS_SEED_PASSWORD.trim().length < 12) {
	console.error("PATS_SEED_PASSWORD is missing or too short (checked env + .env).");
	process.exit(1);
}

if (!process.env.SEED_MODE || !["demo", "uat"].includes(process.env.SEED_MODE.trim().toLowerCase())) {
	process.env.SEED_MODE = "demo";
}

process.env.PATS_SEED_FRESH = "1";

const result = spawnSync(process.execPath, [path.join(root, "scripts", "pats-seed.mjs")], {
	stdio: "inherit",
	env: process.env,
});

process.exit(result.status ?? 1);
