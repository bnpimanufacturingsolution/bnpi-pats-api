/**
 * Ensures Docker Desktop is open/running and brings up this repo's foundation
 * stack (PostgreSQL + MinIO) from ./docker-compose.yml.
 *
 * Env:
 *   SKIP_DOCKER=1      Skip entirely (exit 0)
 *   REQUIRE_DOCKER=1   Fail hard if Docker/compose cannot start (default: soft fail)
 *   DOCKER_WAIT_MS     Max wait for Docker engine (default 180000)
 *   DEV_INFRA_QUIET=1  Less chatter (default is verbose)
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, "..");

const RUNTIME_SERVICES = ["postgres", "minio"];
const INIT_SERVICES = ["minio-init"];

const STARTED_AT = Date.now();

function quietMode() {
	return truthy(process.env.DEV_INFRA_QUIET);
}

function elapsed() {
	const ms = Date.now() - STARTED_AT;
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return m > 0 ? `${m}m${String(rem).padStart(2, "0")}s` : `${s}s`;
}

function stamp() {
	return new Date().toISOString().slice(11, 19);
}

function log(message) {
	console.log(`[dev-infra ${stamp()} +${elapsed()}] ${message}`);
}

function step(n, total, message) {
	console.log("");
	console.log(`[dev-infra ${stamp()} +${elapsed()}] ── Step ${n}/${total}: ${message}`);
}

function detail(message) {
	if (quietMode()) return;
	console.log(`[dev-infra ${stamp()} +${elapsed()}]    · ${message}`);
}

function warn(message) {
	console.warn(`[dev-infra ${stamp()} +${elapsed()}] WARN: ${message}`);
}

function ok(message) {
	console.log(`[dev-infra ${stamp()} +${elapsed()}] OK  ${message}`);
}

function fail(message, code = 1) {
	console.error(`[dev-infra ${stamp()} +${elapsed()}] FAIL: ${message}`);
	process.exit(code);
}

function banner(title) {
	const line = "═".repeat(Math.max(48, title.length + 8));
	console.log("");
	console.log(line);
	console.log(`  ${title}`);
	console.log(line);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function truthy(value) {
	return value === "1" || value === "true" || value === "yes";
}

function run(command, args, options = {}) {
	const { verboseCmd, ...spawnOptions } = options;
	const showCmd = verboseCmd !== false && !quietMode();
	if (showCmd) {
		detail(`$ ${command} ${args.join(" ")}`);
	}
	return spawnSync(command, args, {
		encoding: "utf8",
		shell: process.platform === "win32",
		env: process.env,
		...spawnOptions,
	});
}

function commandSucceeded(result) {
	return result.status === 0;
}

function capture(command, args, options = {}) {
	const result = run(command, args, {
		stdio: ["ignore", "pipe", "pipe"],
		verboseCmd: options.verboseCmd,
		cwd: options.cwd,
	});
	return {
		ok: commandSucceeded(result),
		status: result.status,
		stdout: (result.stdout ?? "").trim(),
		stderr: (result.stderr ?? "").trim(),
		error: result.error,
	};
}

function dockerEngineReady() {
	return capture("docker", ["info", "--format", "{{.ServerVersion}}"], {
		verboseCmd: false,
	}).ok;
}

function dockerCliPresent() {
	return capture("docker", ["version", "--format", "{{.Client.Version}}"], {
		verboseCmd: false,
	});
}

function dockerComposeOk(cwd) {
	return capture("docker", ["compose", "version"], { cwd, verboseCmd: false });
}

function dockerDesktopStatus() {
	return capture("docker", ["desktop", "status"], { verboseCmd: false });
}

function parseDesktopStatus(stdout) {
	const match = stdout.match(/Status\s+(\S+)/i);
	if (match) return match[1].toLowerCase();
	if (/running/i.test(stdout)) return "running";
	if (/stopped/i.test(stdout)) return "stopped";
	if (/starting/i.test(stdout)) return "starting";
	return stdout ? "unknown" : "unavailable";
}

function windowsDockerDesktopExeCandidates() {
	return [
		path.join(
			process.env.ProgramFiles ?? "C:\\Program Files",
			"Docker",
			"Docker",
			"Docker Desktop.exe",
		),
		path.join(
			process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
			"Docker",
			"Docker",
			"Docker Desktop.exe",
		),
		path.join(process.env.LOCALAPPDATA ?? "", "Docker", "Docker Desktop.exe"),
	].filter((p) => p && p.length > 3);
}

function launchDockerDesktopUi() {
	if (process.platform === "win32") {
		const candidates = windowsDockerDesktopExeCandidates();
		detail(`Looking for Docker Desktop.exe in ${candidates.length} locations…`);
		for (const exe of candidates) {
			const exists = fs.existsSync(exe);
			detail(`${exists ? "found" : "missing"}  ${exe}`);
			if (!exists) continue;

			log(`Opening Docker Desktop UI: ${exe}`);
			const psPath = exe.replace(/'/g, "''");
			const ps = spawnSync(
				"powershell.exe",
				[
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					`Start-Process -FilePath '${psPath}'`,
				],
				{
					encoding: "utf8",
					shell: false,
					stdio: ["ignore", "pipe", "pipe"],
				},
			);
			detail(
				`Start-Process → exit ${ps.status}${ps.stderr ? ` stderr=${ps.stderr.trim()}` : ""}`,
			);
			if (ps.status === 0) {
				ok("Docker Desktop launch issued (Start-Process).");
				return { ok: true, method: "start-process", path: exe };
			}

			warn(`Start-Process failed (status=${ps.status}); trying detached spawn…`);
			try {
				const child = spawn(exe, [], {
					detached: true,
					stdio: "ignore",
					windowsHide: false,
					shell: false,
				});
				child.on("error", (error) => warn(`spawn error: ${error.message}`));
				child.unref();
				ok("Docker Desktop launch issued (detached spawn).");
				return { ok: true, method: "spawn-exe", path: exe };
			} catch (error) {
				warn(`spawn threw: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return { ok: false, method: "none", path: null };
	}

	if (process.platform === "darwin") {
		log("Opening Docker Desktop via `open -a Docker`…");
		const result = run("open", ["-a", "Docker"], { stdio: "inherit" });
		return { ok: commandSucceeded(result), method: "open-app", path: "Docker" };
	}

	return { ok: false, method: "unsupported", path: null };
}

function dockerDesktopStartCli() {
	log("Running `docker desktop start` (official Desktop CLI)…");
	const result = run("docker", ["desktop", "start"], {
		stdio: "inherit",
		verboseCmd: true,
	});
	detail(`docker desktop start → exit ${result.status}`);
	return commandSucceeded(result);
}

async function waitForDockerEngine(timeoutMs) {
	const started = Date.now();
	let attempt = 0;
	while (Date.now() - started < timeoutMs) {
		attempt += 1;
		const desktop = dockerDesktopStatus();
		const status = desktop.ok ? parseDesktopStatus(desktop.stdout) : "cli-unavailable";
		const engine = dockerEngineReady();
		const waited = Math.floor((Date.now() - started) / 1000);
		const total = Math.floor(timeoutMs / 1000);
		log(
			`Waiting for engine… attempt=${attempt} waited=${waited}s/${total}s desktop=${status} engine=${engine ? "ready" : "not-ready"}`,
		);
		if (engine) return true;
		await sleep(3000);
	}
	return false;
}

function printComposePs(apiDir) {
	log("Container status (`docker compose ps`):");
	run("docker", ["compose", "ps", "-a"], {
		cwd: apiDir,
		stdio: "inherit",
		verboseCmd: true,
	});
}

function composeUp(apiDir) {
	step(4, 5, `Compose up runtime services (${RUNTIME_SERVICES.join(", ")})`);
	detail(`cwd = ${apiDir}`);

	let runtime = run(
		"docker",
		["compose", "up", "-d", "--wait", ...RUNTIME_SERVICES],
		{ cwd: apiDir, stdio: "inherit", verboseCmd: true },
	);
	detail(`compose up --wait → exit ${runtime.status}`);

	if (!commandSucceeded(runtime)) {
		warn("`docker compose up --wait` failed; retrying without --wait…");
		runtime = run("docker", ["compose", "up", "-d", ...RUNTIME_SERVICES], {
			cwd: apiDir,
			stdio: "inherit",
			verboseCmd: true,
		});
		detail(`compose up -d → exit ${runtime.status}`);
		if (!commandSucceeded(runtime)) {
			warn(`compose up failed: ${runtime.stderr || runtime.stdout || "no output"}`);
			return false;
		}
	}

	step(5, 5, `Compose one-shot init (${INIT_SERVICES.join(", ")})`);
	const init = run("docker", ["compose", "up", "--no-deps", ...INIT_SERVICES], {
		cwd: apiDir,
		stdio: "inherit",
		verboseCmd: true,
	});
	detail(`compose up minio-init → exit ${init.status}`);
	if (!commandSucceeded(init)) {
		warn("MinIO bucket init reported a non-zero exit (bucket may already exist).");
	}
	return true;
}

async function waitForPostgres(apiDir, timeoutMs = 60_000) {
	const started = Date.now();
	let attempt = 0;
	while (Date.now() - started < timeoutMs) {
		attempt += 1;
		const result = capture(
			"docker",
			[
				"compose",
				"exec",
				"-T",
				"postgres",
				"pg_isready",
				"-U",
				"pats",
				"-d",
				"pats",
			],
			{ cwd: apiDir, verboseCmd: false },
		);
		if (result.ok) {
			ok(`Postgres ready (pg_isready, attempt ${attempt}).`);
			return true;
		}
		detail(
			`pg_isready not ready yet (attempt ${attempt}): ${result.stdout || result.stderr || "no output"}`,
		);
		await sleep(2000);
	}
	return false;
}

async function ensureDockerRunning(timeoutMs) {
	step(2, 5, "Ensure Docker Desktop is open and the engine is ready");

	const cli = dockerCliPresent();
	if (!cli.ok) {
		warn(
			`docker CLI not on PATH (status=${cli.status}, err=${cli.error?.message ?? "n/a"}).`,
		);
		warn("Install Docker Desktop and ensure `docker` is available in this terminal.");
		return false;
	}
	ok(`docker client ${cli.stdout || "present"}`);

	const before = dockerDesktopStatus();
	if (before.ok) {
		detail(
			`docker desktop status:\n${before.stdout
				.split("\n")
				.map((l) => `      ${l}`)
				.join("\n")}`,
		);
	} else {
		detail("docker desktop status CLI not available — will use engine probe + Desktop.exe.");
	}

	const engineAlready = dockerEngineReady();
	const desktopStatus = before.ok ? parseDesktopStatus(before.stdout) : null;

	// Always open the Desktop UI. If status is not "running", also run the official start CLI
	// (engine can answer `docker info` while Desktop UI reports stopped).
	if (desktopStatus !== "running") {
		warn(
			`Docker Desktop status is "${desktopStatus ?? "unknown"}" — starting Desktop…`,
		);
		const cliStart = dockerDesktopStartCli();
		if (!cliStart) {
			warn("`docker desktop start` did not exit 0 — will still open Desktop.exe and wait.");
		}
	} else {
		ok("Docker Desktop reports running.");
	}

	const ui = launchDockerDesktopUi();
	if (!ui.ok) {
		warn("Could not locate Docker Desktop.exe. Is Docker Desktop installed?");
		for (const p of windowsDockerDesktopExeCandidates()) {
			warn(`  - ${p}`);
		}
	}

	if (engineAlready && desktopStatus === "running") {
		ok("Docker engine already ready.");
		return true;
	}

	if (engineAlready) {
		ok("Docker engine already answers `docker info` (Desktop was starting/opening).");
		return true;
	}

	warn("Docker engine is NOT ready yet — polling…");
	log(`Polling until engine is ready (timeout ${Math.floor(timeoutMs / 1000)}s)…`);
	const ready = await waitForDockerEngine(timeoutMs);
	if (!ready) {
		const after = dockerDesktopStatus();
		if (after.ok) warn(`Final desktop status:\n${after.stdout}`);
		return false;
	}

	ok("Docker engine is ready.");
	return true;
}

export async function ensureDockerInfra(options = {}) {
	const requireDocker = truthy(process.env.REQUIRE_DOCKER) || options.requireDocker;
	const skip = truthy(process.env.SKIP_DOCKER) || options.skip;
	const waitMs = Number(process.env.DOCKER_WAIT_MS ?? options.waitMs ?? 180_000);

	banner("PATS API local foundation (Docker)");
	log(`platform=${process.platform} arch=${process.arch} cwd=${process.cwd()}`);
	log(`repo=${API_ROOT}`);
	log(`SKIP_DOCKER=${skip} REQUIRE_DOCKER=${requireDocker} DOCKER_WAIT_MS=${waitMs}`);

	if (skip) {
		warn("SKIP_DOCKER set — leaving Docker alone.");
		return { ok: true, skipped: true };
	}

	step(1, 5, "Locate compose project (this repo)");
	const apiDir = API_ROOT;
	const composeFile = path.join(apiDir, "docker-compose.yml");
	detail(`compose file → ${composeFile}`);
	detail(`exists → ${fs.existsSync(composeFile)}`);

	if (!fs.existsSync(composeFile)) {
		const message = `docker-compose.yml not found at ${composeFile}`;
		if (requireDocker) fail(message);
		warn(message);
		return { ok: false, skipped: false, reason: "missing-compose" };
	}
	ok("Found docker-compose.yml");

	const dockerReady = await ensureDockerRunning(waitMs);
	if (!dockerReady) {
		const message =
			"Docker engine did not become ready in time. Open Docker Desktop manually, wait until it says Running, then re-run. Or set SKIP_DOCKER=1.";
		if (requireDocker) fail(message);
		warn(message);
		warn("Continuing without foundation containers (soft fail). Set REQUIRE_DOCKER=1 to hard-fail.");
		return { ok: false, skipped: false, reason: "docker-not-ready" };
	}

	step(3, 5, "Verify docker compose");
	const compose = dockerComposeOk(apiDir);
	if (!compose.ok) {
		const message = "docker compose is not available on PATH.";
		if (requireDocker) fail(message);
		warn(message);
		return { ok: false, skipped: false, reason: "compose-missing" };
	}
	ok(compose.stdout || "docker compose available");

	const upOk = composeUp(apiDir);
	if (!upOk) {
		printComposePs(apiDir);
		const message = "docker compose up failed for foundation services.";
		if (requireDocker) fail(message);
		warn(message);
		return { ok: false, skipped: false, reason: "compose-up-failed" };
	}

	log("Checking Postgres readiness…");
	const pgReady = await waitForPostgres(apiDir);
	if (!pgReady) {
		warn("Postgres did not report ready; API may fail until it does.");
	}

	printComposePs(apiDir);

	banner("Foundation ready — starting API next");
	ok("Postgres host port: 55432 (default)");
	ok("MinIO API :9000  ·  console :9001");
	console.log("");
	return { ok: true, skipped: false, apiDir };
}

const isMain =
	process.argv[1] &&
	path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
	ensureDockerInfra()
		.then((result) => {
			log(
				`done ok=${result.ok} skipped=${Boolean(result.skipped)} reason=${result.reason ?? "-"}`,
			);
			process.exit(result.ok || result.skipped ? 0 : 1);
		})
		.catch((error) => {
			console.error("[dev-infra] uncaught:", error);
			process.exit(1);
		});
}
