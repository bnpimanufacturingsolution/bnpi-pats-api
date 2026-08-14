/**
 * Print a mm ruler + 80x40 / 100x50 / 100x75 boxes on the USB Glory-L.
 * Read the loaded die from which box fills the sticker face.
 *
 *   pnpm exec tsx scripts/glory-l-calibrate-print.ts
 *   pnpm exec tsx scripts/glory-l-calibrate-print.ts "HPRT Glory-L"
 */
import { spawnSync } from "node:child_process";
import { createWindowsSpoolerPort } from "../app/pats/print-ports";
import { renderCalibrationZpl } from "../app/pats/label-ir";

function listWindowsPrinters(): string[] {
	const result = spawnSync(
		"powershell.exe",
		["-NoProfile", "-NonInteractive", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"],
		{ encoding: "utf8", windowsHide: true },
	);
	if (result.status !== 0) return [];
	return result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

const names = process.platform === "win32" ? listWindowsPrinters() : [];
const requested = process.argv[2]?.trim() || process.env.PATS_PRINTER_WINDOWS_NAME?.trim();
const printerName = requested || names.find((name) => /glory|hprt/i.test(name));

if (!printerName) {
	console.error("No Glory-L Windows printer name given.");
	for (const name of names) console.error(`  - ${name}`);
	process.exit(1);
}

console.log(`Sending calibration sticker to "${printerName}"`);
const result = await createWindowsSpoolerPort().deliver({
	address: `winspool:${printerName}`,
	payload: renderCalibrationZpl(300),
});
if (result.status !== "SENT") {
	console.error(`Print failed: ${result.failureReason ?? result.status}`);
	process.exit(1);
}
console.log("Look at the paper:");
console.log("  - 4x6 102x152 fills the face → boxed Glory-L sample (PATS default)");
console.log("  - 100x75 or 100x50 is the last complete box → smaller die; tell us which");
console.log("  - Extra blank below the 4x6 box → measure leftover height");
