import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATTERNS = Object.freeze([
	"@react-router+dev",
	"@react-router/dev",
	"@react-router\\dev",
	"react-router dev",
	"serve-spa.mjs",
	"tsx watch index.ts",
	"dotenv tsx watch",
	"pats-api",
]);

function uniqueSortedNumbers(values) {
	return [...new Set(values)].sort((left, right) => left - right);
}

function uniqueStrings(values) {
	return [...new Set(values)];
}

function parseCommaSeparatedPorts(value) {
	return value
		.split(",")
		.map((entry) => Number(entry.trim()))
		.filter((port) => Number.isInteger(port) && port > 0);
}

export function parseTargets(argv = process.argv.slice(2)) {
	const args = argv.filter((arg) => arg !== "--");
	const ports = [];
	let mode = null;

	for (const arg of args) {
		if (arg === "--all" || arg === "-a" || arg === "all") {
			mode = "all";
			continue;
		}

		if (arg === "--port" || arg === "-p" || arg === "--ports") {
			mode = "port";
			continue;
		}

		if (arg.startsWith("--port=")) {
			mode = "port";
			ports.push(...parseCommaSeparatedPorts(arg.slice("--port=".length)));
			continue;
		}

		if (arg.startsWith("--ports=")) {
			mode = "port";
			ports.push(...parseCommaSeparatedPorts(arg.slice("--ports=".length)));
			continue;
		}

		ports.push(...parseCommaSeparatedPorts(arg));
		if (ports.length > 0) {
			mode = "port";
		}
	}

	if (mode === "all") {
		return { mode: "all" };
	}

	const normalizedPorts = uniqueSortedNumbers(ports);
	if (normalizedPorts.length > 0) {
		return { mode: "port", ports: normalizedPorts };
	}

	// bare `pnpm end` -> treat as --all for api ergonomics
	if (argv.length === 0) return { mode: "all" };

	throw new Error("Usage: pnpm end:all or pnpm end:port 5173");
}

export function buildProcessPatterns(repoRoot = process.cwd()) {
	const resolvedRoot = path.resolve(repoRoot);
	const normalizedRoot = resolvedRoot.replace(/\\/g, "/");

	return uniqueStrings(
		[...DEFAULT_PATTERNS, resolvedRoot, normalizedRoot].filter(
			(pattern) => pattern.length > 0,
		),
	);
}

export function extractMatchingPidsFromSnapshot(
	snapshot,
	patterns,
	excludedPids = new Set([process.pid]),
) {
	const excludedPidSet = excludedPids instanceof Set ? excludedPids : new Set([excludedPids]);
	const pids = [];

	for (const line of snapshot.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		const match = trimmed.match(/^(\d+)\s+(.*)$/);
		if (!match) {
			continue;
		}

		const pid = Number(match[1]);
		if (excludedPidSet.has(pid)) {
			continue;
		}

		const commandLine = match[2];
		if (patterns.some((pattern) => commandLine.includes(pattern))) {
			pids.push(pid);
		}
	}

	return uniqueSortedNumbers(pids);
}

function collectAncestorPidsFromSnapshot(snapshot, currentPid = process.pid) {
	const parentByPid = new Map();

	for (const line of snapshot.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		const match = trimmed.match(/^(\d+)\s+(\d+)/);
		if (!match) {
			continue;
		}

		parentByPid.set(Number(match[1]), Number(match[2]));
	}

	const ancestors = new Set([currentPid]);
	let nextPid = parentByPid.get(currentPid);

	while (Number.isInteger(nextPid) && !ancestors.has(nextPid)) {
		ancestors.add(nextPid);
		nextPid = parentByPid.get(nextPid);
	}

	return ancestors;
}

function collectAncestorPidsWindows() {
	const output = readCommandOutput("powershell.exe", [
		"-NoProfile",
		"-Command",
		'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.ParentProcessId)" }',
	]);

	return collectAncestorPidsFromSnapshot(output);
}

function collectAncestorPidsUnix() {
	const output = readCommandOutput("ps", ["-axo", "pid=,ppid="]);
	return collectAncestorPidsFromSnapshot(output);
}

function readCommandOutput(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0 && !result.stdout.trim() && result.stderr.trim()) {
		throw new Error(result.stderr.trim());
	}

	return result.stdout.trim();
}

function findMatchingPidsWindows(patterns) {
	const output = readCommandOutput("powershell.exe", [
		"-NoProfile",
		"-Command",
		'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.CommandLine)" }',
	]);

	return extractMatchingPidsFromSnapshot(output, patterns, collectAncestorPidsWindows());
}

function findMatchingPidsUnix(patterns) {
	const output = readCommandOutput("ps", ["-axo", "pid=,args="]);
	return extractMatchingPidsFromSnapshot(output, patterns, collectAncestorPidsUnix());
}

function findPortPidsWindows(ports) {
	const command = [
		`$ports = @(${ports.join(", ")})`,
		"Get-NetTCPConnection | Where-Object {",
		"  $_.State -eq 'Listen' -and $ports -contains $_.LocalPort",
		"} | Select-Object -ExpandProperty OwningProcess",
	].join("\n");

	const output = readCommandOutput("powershell.exe", ["-NoProfile", "-Command", command]);
	return uniqueSortedNumbers(
		output
			.split(/\r?\n/)
			.map((line) => Number(line.trim()))
			.filter((pid) => Number.isInteger(pid) && pid !== process.pid),
	);
}

function findPortPidsUnix(ports) {
	const pids = [];

	for (const port of ports) {
		const result = spawnSync("lsof", ["-nP", "-iTCP:" + port, "-sTCP:LISTEN", "-t"], {
			encoding: "utf8",
		});

		if (result.error) {
			throw result.error;
		}

		const output = `${result.stdout}\n${result.stderr}`.trim();
		if (result.status !== 0 && !output) {
			continue;
		}

		for (const line of result.stdout.split(/\r?\n/)) {
			const pid = Number(line.trim());
			if (Number.isInteger(pid) && pid !== process.pid) {
				pids.push(pid);
			}
		}
	}

	return uniqueSortedNumbers(pids);
}

function killPidsWindows(pids) {
	for (const pid of pids) {
		const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
			encoding: "utf8",
		});

		if (result.error) {
			throw result.error;
		}
	}
}

function killPidsUnix(pids) {
	for (const pid of pids) {
		try {
			process.kill(pid, "SIGKILL");
		} catch (error) {
			if (error?.code !== "ESRCH") {
				throw error;
			}
		}
	}
}

function formatPidList(pids) {
	return pids.join(", ");
}

export async function main(argv = process.argv.slice(2)) {
	const targets = parseTargets(argv);
	const patterns = buildProcessPatterns();

	let pids = [];
	if (targets.mode === "all") {
		pids =
			process.platform === "win32"
				? findMatchingPidsWindows(patterns)
				: findMatchingPidsUnix(patterns);
	} else {
		pids =
			process.platform === "win32"
				? findPortPidsWindows(targets.ports)
				: findPortPidsUnix(targets.ports);
	}

	if (pids.length === 0) {
		console.log("No matching processes found.");
		return;
	}

	if (process.platform === "win32") {
		killPidsWindows(pids);
	} else {
		killPidsUnix(pids);
	}

	const label =
		targets.mode === "all" ? "workspace processes" : `ports ${formatPidList(targets.ports)}`;
	console.log(`Stopped ${pids.length} process(es) for ${label}: ${formatPidList(pids)}`);
}

const isMainModule =
	process.argv[1] !== undefined &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
