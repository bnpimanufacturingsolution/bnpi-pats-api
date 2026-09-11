import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { expect } from "chai";

const execFileAsync = promisify(execFile);

const repositoryRoot = path.resolve(__dirname, "..");
const scriptPath = path.resolve(repositoryRoot, "scripts", "ensure-docker-infra.mjs");
const scriptUrl = pathToFileURL(scriptPath).href;

/**
 * `npm test` runs specs as CommonJS (ts-node/register), and Node 20 (the CI
 * engine) rejects require() of .mjs modules. Executing a tiny ESM snippet in a
 * child process imports the helpers natively on every supported engine.
 */
async function runHelpers(payload: unknown): Promise<any> {
	const code = `
		import {
			parseNetshExcludedPortRanges,
			resolveComposeHostPorts,
			findDynamicPortConflicts,
		} from ${JSON.stringify(scriptUrl)};
		process.stdout.write(JSON.stringify(await (async () => (${payload}))()));
	`;
	const { stdout } = await execFileAsync(
		process.execPath,
		["--input-type=module", "-e", code],
		{ encoding: "utf8" },
	);
	return JSON.parse(stdout);
}

describe("dev-infra Windows host-port guard helpers", () => {
	it("parses netsh excluded port ranges including administered rows", async () => {
		const { parsed } = await runHelpers(`
			(() => {
				const sample = [
					"",
					"Protocol tcp Port Exclusion Ranges",
					"",
					"Start Port    End Port",
					"----------    --------",
					"     28385       28385",
					"     50000       50059     *",
					"     55422       55521",
					"garbage line",
					"     99999       70000",
					"",
				].join("\\n");
				return { parsed: parseNetshExcludedPortRanges(sample) };
			})()
		`);
		expect(parsed).to.deep.equal([
			{ start: 28385, end: 28385, administered: false },
			{ start: 50000, end: 50059, administered: true },
			{ start: 55422, end: 55521, administered: false },
		]);
	});

	it("returns no ranges for empty or header-only netsh output", async () => {
		const { empty, headers } = await runHelpers(`
			(() => ({
				empty: parseNetshExcludedPortRanges(""),
				headers: parseNetshExcludedPortRanges("Protocol tcp Port Exclusion Ranges\\n\\nStart Port    End Port\\n"),
			}))()
		`);
		expect(empty).to.deep.equal([]);
		expect(headers).to.deep.equal([]);
	});

	it("resolves compose host ports with process env winning over .env file over defaults", async () => {
		const { defaults, fileOnly, envWins, invalidIgnored } = await runHelpers(`
			(() => ({
				defaults: resolveComposeHostPorts({ env: {}, envFile: "" }),
				fileOnly: resolveComposeHostPorts({
					env: {},
					envFile: ["POSTGRES_PORT=56000", "", "# comment", "MINIO_API_PORT=9002"].join("\\n"),
				}),
				envWins: resolveComposeHostPorts({
					env: { POSTGRES_PORT: "56001" },
					envFile: "POSTGRES_PORT=56000\\n",
				}),
				invalidIgnored: resolveComposeHostPorts({
					env: {},
					envFile: "POSTGRES_PORT=not-a-port\\nMINIO_CONSOLE_PORT=99999",
				}),
			}))()
		`);
		expect(defaults).to.deep.equal([
			{ service: "postgres", variable: "POSTGRES_PORT", port: 55432 },
			{ service: "minio", variable: "MINIO_API_PORT", port: 9000 },
			{ service: "minio", variable: "MINIO_CONSOLE_PORT", port: 9001 },
		]);
		expect(fileOnly.map((mapping: { port: number }) => mapping.port)).to.deep.equal([56000, 9002, 9001]);
		expect(envWins.map((mapping: { port: number }) => mapping.port)).to.deep.equal([56001, 9000, 9001]);
		expect(invalidIgnored.map((mapping: { port: number }) => mapping.port)).to.deep.equal([55432, 9000, 9001]);
	});

	it("flags ports inside dynamic ranges but not administered or free ports", async () => {
		const { conflicts } = await runHelpers(`
			(() => {
				const mappings = resolveComposeHostPorts({ env: {}, envFile: "POSTGRES_PORT=55432\\n" });
				const ranges = [
					{ start: 50000, end: 50059, administered: true },
					{ start: 55422, end: 55521, administered: false },
					{ start: 28385, end: 28385, administered: false },
				];
				return { conflicts: findDynamicPortConflicts(mappings, ranges) };
			})()
		`);
		expect(conflicts).to.have.lengthOf(1);
		expect(conflicts[0]).to.include({
			service: "postgres",
			variable: "POSTGRES_PORT",
			port: 55432,
		});
		expect(conflicts[0].range).to.deep.equal({
			start: 55422,
			end: 55521,
			administered: false,
		});
	});

	it("reports no conflicts when ports are inside administered ranges or outside all ranges", async () => {
		const { conflicts, emptyRanges } = await runHelpers(`
			(() => {
				const mappings = resolveComposeHostPorts({
					env: {},
					envFile: "POSTGRES_PORT=55432\\nMINIO_API_PORT=50010",
				});
				const ranges = [{ start: 50000, end: 50059, administered: true }];
				return {
					conflicts: findDynamicPortConflicts(mappings, ranges),
					emptyRanges: findDynamicPortConflicts(mappings, null),
				};
			})()
		`);
		expect(conflicts).to.deep.equal([]);
		expect(emptyRanges).to.deep.equal([]);
	});
});
