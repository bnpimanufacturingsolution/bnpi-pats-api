import net from "node:net";

export type PrintPortResult = {
	status: "SENT" | "SIMULATED" | "FAILED";
	failureReason: string | null;
};

export type PrintPort = {
	deliver: (input: { address: string | null; payload: string }) => Promise<PrintPortResult>;
};

export const simulatedPrintPort: PrintPort = {
	async deliver() {
		return { status: "SIMULATED", failureReason: null };
	},
};

const DEFAULT_TIMEOUT_MS = 5_000;

export function parsePrinterAddress(address: string): { host: string; port: number } {
	const trimmed = address.trim();
	const [host, portText] = trimmed.includes(":")
		? [trimmed.slice(0, trimmed.lastIndexOf(":")), trimmed.slice(trimmed.lastIndexOf(":") + 1)]
		: [trimmed, "9100"];
	const port = Number(portText);
	if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("Printer address must be host:port.");
	}
	return { host, port };
}

export function createNetworkRawPort(timeoutMs = DEFAULT_TIMEOUT_MS): PrintPort {
	return {
		deliver({ address, payload }) {
			if (!address) {
				return Promise.resolve({
					status: "FAILED",
					failureReason: "Station has no printer address.",
				});
			}

			let target: { host: string; port: number };
			try {
				target = parsePrinterAddress(address);
			} catch (error) {
				return Promise.resolve({
					status: "FAILED",
					failureReason: error instanceof Error ? error.message : "Invalid printer address.",
				});
			}

			return new Promise((resolve) => {
				const socket = new net.Socket();
				let settled = false;
				const finish = (result: PrintPortResult) => {
					if (settled) return;
					settled = true;
					socket.destroy();
					resolve(result);
				};

				socket.setTimeout(timeoutMs);
				socket.once("timeout", () => finish({ status: "FAILED", failureReason: "Printer timed out." }));
				socket.once("error", (error) =>
					finish({ status: "FAILED", failureReason: error.message || "Printer connection failed." }),
				);
				socket.connect(target.port, target.host, () => {
					socket.write(payload, (error) => {
						if (error) {
							finish({ status: "FAILED", failureReason: error.message || "Printer write failed." });
							return;
						}
						finish({ status: "SENT", failureReason: null });
					});
				});
			});
		},
	};
}

export function parseWindowsPrinterName(address: string): string {
	const trimmed = address.trim();
	return trimmed.toLowerCase().startsWith("winspool:")
		? trimmed.slice("winspool:".length).trim()
		: trimmed;
}

export function createWindowsSpoolerPort(): PrintPort {
	return {
		async deliver({ address, payload }) {
			if (process.platform !== "win32") {
				return {
					status: "FAILED",
					failureReason: "USB/spooler print is Windows-only. Use Ethernet :9100 on other hosts.",
				};
			}
			if (!address?.trim()) {
				return { status: "FAILED", failureReason: "Station has no Windows printer name." };
			}

			const printerName = parseWindowsPrinterName(address);
			const { writeFile, unlink } = await import("node:fs/promises");
			const { tmpdir } = await import("node:os");
			const { join } = await import("node:path");
			const { spawn } = await import("node:child_process");

			const file = join(tmpdir(), `pats-glory-l-${Date.now()}.zpl`);
			const script = join(process.cwd(), "scripts/win-raw-print.ps1");

			try {
				await writeFile(file, payload, "utf8");
				const result = await new Promise<PrintPortResult>((resolve) => {
					const child = spawn(
						"powershell.exe",
						[
							"-NoProfile",
							"-NonInteractive",
							"-ExecutionPolicy",
							"Bypass",
							"-File",
							script,
							"-PrinterName",
							printerName,
							"-FilePath",
							file,
						],
						{ windowsHide: true },
					);
					let stderr = "";
					child.stderr.on("data", (chunk) => {
						stderr += String(chunk);
					});
					child.on("error", (error) =>
						resolve({
							status: "FAILED",
							failureReason: error.message || "Could not start Windows print helper.",
						}),
					);
					child.on("close", (code) => {
						if (code === 0) {
							resolve({ status: "SENT", failureReason: null });
							return;
						}
						resolve({
							status: "FAILED",
							failureReason: stderr.trim() || `Windows print helper exited ${code}.`,
						});
					});
				});
				return result;
			} catch (error) {
				return {
					status: "FAILED",
					failureReason: error instanceof Error ? error.message : "USB/spooler print failed.",
				};
			} finally {
				await unlink(file).catch(() => undefined);
			}
		},
	};
}

export function selectPrintPort(connection: string | null | undefined): PrintPort {
	if (connection === "NETWORK") return createNetworkRawPort();
	if (connection === "USB_AGENT") return createWindowsSpoolerPort();
	return simulatedPrintPort;
}
