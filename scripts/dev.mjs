/**
 * API local entry: Docker foundation (Desktop + Postgres + MinIO), then API watch.
 *
 *   pnpm dev              → infra + dotenv tsx watch index.ts
 *   pnpm dev:api          → API only (skip Docker)
 *   pnpm dev:infra        → Docker only
 *   SKIP_DOCKER=1 pnpm dev
 *   REQUIRE_DOCKER=1 pnpm dev
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDockerInfra } from "./ensure-docker-infra.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, "..");

function stamp() {
	return new Date().toISOString().slice(11, 19);
}

function log(message) {
	console.log(`[dev ${stamp()}] ${message}`);
}

async function main() {
	console.log("");
	console.log("╔══════════════════════════════════════════════════════╗");
	console.log("║  bnpi-pats-api  ·  pnpm dev                          ║");
	console.log("║  1) Docker foundation   2) API (tsx watch)           ║");
	console.log("╚══════════════════════════════════════════════════════╝");
	console.log("");

	log("Phase 1/2 — Docker foundation (Desktop + Postgres + MinIO)");
	const infra = await ensureDockerInfra();
	log(
		`Phase 1/2 complete — ok=${infra.ok} skipped=${Boolean(infra.skipped)} reason=${infra.reason ?? "-"}`,
	);

	if (!infra.ok && !infra.skipped) {
		log("Infra had problems (see WARN lines above). Starting the API anyway.");
		log("Tip: REQUIRE_DOCKER=1 pnpm dev  → stop if Docker fails.");
	}

	console.log("");
	log("Phase 2/2 — starting API (`dotenv tsx watch index.ts`)…");
	log(`cwd=${API_ROOT}`);
	console.log("");

	// Same command package.json used to run directly: dotenv tsx watch index.ts
	const child = spawn(
		"pnpm",
		["exec", "dotenv", "tsx", "watch", "index.ts", ...process.argv.slice(2)],
		{
			cwd: API_ROOT,
			stdio: "inherit",
			shell: process.platform === "win32",
			env: process.env,
		},
	);

	const forward = (signal) => {
		log(`signal ${signal} → forwarding to API child`);
		if (!child.killed) child.kill(signal);
	};

	process.on("SIGINT", () => forward("SIGINT"));
	process.on("SIGTERM", () => forward("SIGTERM"));

	child.on("error", (error) => {
		console.error(`[dev ${stamp()}] failed to spawn API:`, error);
		process.exit(1);
	});

	child.on("exit", (code, signal) => {
		log(`API exited code=${code} signal=${signal ?? "-"}`);
		if (signal) process.exit(1);
		process.exit(code ?? 0);
	});
}

main().catch((error) => {
	console.error("[dev] uncaught:", error);
	process.exit(1);
});
