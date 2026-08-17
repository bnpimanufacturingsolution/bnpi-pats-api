/**
 * Fire one raw ZPL sticker at an HPRT Glory-L over Ethernet :9100.
 * Does not use the Windows driver or window.print().
 *
 *   pnpm exec tsx scripts/glory-l-test-print.ts 192.168.1.50:9100
 *   PATS_PRINTER_ADDRESS=192.168.1.50:9100 pnpm exec tsx scripts/glory-l-test-print.ts
 */
import { createNetworkRawPort } from "../app/pats/print-ports";
import { GLORY_L_DEFAULTS, renderZpl, type LabelIr } from "../app/pats/label-ir";

const address = process.argv[2]?.trim() || process.env.PATS_PRINTER_ADDRESS?.trim();
if (!address) {
	console.error("Usage: pnpm exec tsx scripts/glory-l-test-print.ts <host:9100>");
	console.error("The Glory-L must be on Ethernet (panel IP). USB/Windows driver will not work.");
	process.exit(1);
}

const widthMm = Number(process.env.PATS_LABEL_WIDTH_MM) || GLORY_L_DEFAULTS.widthMm;
const heightMm = Number(process.env.PATS_LABEL_HEIGHT_MM) || GLORY_L_DEFAULTS.heightMm;

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
	widthMm,
	heightMm,
	dpi: 300,
};

const payload = renderZpl(ir);
console.log(`Sending ${payload.length} bytes of ZPL to ${address} (${widthMm}x${heightMm} mm @ 300 dpi)`);

const result = await createNetworkRawPort().deliver({ address, payload });
if (result.status !== "SENT") {
	console.error(`Print failed: ${result.failureReason ?? result.status}`);
	console.error("If this PC only has USB to the Glory-L, plug Ethernet and set an IP on the printer panel.");
	process.exit(1);
}

console.log("Printer accepted the job.");
