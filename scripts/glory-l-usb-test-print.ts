/**
 * Fire one raw ZPL sticker at a USB-attached HPRT Glory-L via the Windows spooler.
 * Floor install is still Ethernet :9100. This is the USB desk/lab adapter.
 *
 *   pnpm exec tsx scripts/glory-l-usb-test-print.ts
 *   pnpm exec tsx scripts/glory-l-usb-test-print.ts "HPRT Glory-L"
 */
import { spawnSync } from "node:child_process";
import { createWindowsSpoolerPort } from "../app/pats/print-ports";
import { GLORY_L_DEFAULTS, renderZpl, type LabelIr } from "../app/pats/label-ir";

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

function pickGloryL(names: string[]): string | undefined {
	return names.find((name) => /glory|hprt/i.test(name));
}

const names = process.platform === "win32" ? listWindowsPrinters() : [];
const requested = process.argv[2]?.trim() || process.env.PATS_PRINTER_WINDOWS_NAME?.trim();
const printerName = requested || pickGloryL(names);

if (!printerName) {
	console.error("No Glory-L Windows printer name given.");
	if (names.length > 0) {
		console.error("Installed printers:");
		for (const name of names) console.error(`  - ${name}`);
		console.error('Re-run: pnpm exec tsx scripts/glory-l-usb-test-print.ts "Exact Printer Name"');
	} else {
		console.error("Get-Printer returned none. Is the HPRT driver installed and the USB cable plugged in?");
	}
	process.exit(1);
}

const ir: LabelIr = {
	barcodeValue: "BC-PATS-TEST-001",
	batchCode: "BNI-TEST-001",
	lotCode: "MLT-TEST",
	partName: "PATS test sticker",
	partCode: "TEST",
	quantity: 240,
	fromStepLabel: "Injection",
	toStepLabel: "Decoration · Full Spray",
	printedAt: new Date().toISOString(),
	sequence: 1,
	widthMm: Number(process.env.PATS_LABEL_WIDTH_MM) || GLORY_L_DEFAULTS.widthMm,
	heightMm: Number(process.env.PATS_LABEL_HEIGHT_MM) || GLORY_L_DEFAULTS.heightMm,
	dpi: 300,
};

console.log(`Sending ZPL to Windows printer "${printerName}" (${ir.widthMm}x${ir.heightMm} mm @ 300 dpi)`);
const result = await createWindowsSpoolerPort().deliver({
	address: `winspool:${printerName}`,
	payload: renderZpl(ir),
});
if (result.status !== "SENT") {
	console.error(`Print failed: ${result.failureReason ?? result.status}`);
	process.exit(1);
}
console.log("Windows spooler accepted the job. Check the Glory-L.");
