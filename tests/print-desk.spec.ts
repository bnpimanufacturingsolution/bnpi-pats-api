import { afterEach } from "mocha";
import { expect } from "chai";
import { deliverDeskLabel } from "../app/pats/print-desk";
import { GLORY_L_DEFAULTS } from "../app/pats/label-ir";

describe("deliverDeskLabel", () => {
	const previousWin = process.env.PATS_PRINTER_WINDOWS_NAME;
	const previousNet = process.env.PATS_PRINTER_ADDRESS;

	afterEach(() => {
		if (previousWin === undefined) delete process.env.PATS_PRINTER_WINDOWS_NAME;
		else process.env.PATS_PRINTER_WINDOWS_NAME = previousWin;
		if (previousNet === undefined) delete process.env.PATS_PRINTER_ADDRESS;
		else process.env.PATS_PRINTER_ADDRESS = previousNet;
	});

	it("fails closed when no desk printer is configured", async () => {
		delete process.env.PATS_PRINTER_WINDOWS_NAME;
		delete process.env.PATS_PRINTER_ADDRESS;
		const result = await deliverDeskLabel({
			barcodeValue: "BC-1",
			batchCode: "B-1",
			lotCode: "L-1",
			partName: "Body",
			partCode: "P",
			quantity: 240,
			fromStepLabel: "Injection",
			toStepLabel: "Decoration",
			printedAt: "2026-08-14T00:00:00.000Z",
			sequence: 1,
			widthMm: GLORY_L_DEFAULTS.widthMm,
			heightMm: GLORY_L_DEFAULTS.heightMm,
			dpi: 300,
		});
		expect(result.status).to.equal("FAILED");
		expect(result.failureReason).to.match(/PATS_PRINTER_WINDOWS_NAME/);
	});
});
