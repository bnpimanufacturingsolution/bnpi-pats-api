import { afterEach } from "mocha";
import { expect } from "chai";
import { deliverDeskLabel, deskStationFromEnv } from "../app/pats/print-desk";
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

	it("uses GLORY_L_DEFAULTS for default paper dimensions", () => {
		const station = deskStationFromEnv();
		expect(station.labelWidthMm).to.equal(GLORY_L_DEFAULTS.widthMm);
		expect(station.labelHeightMm).to.equal(GLORY_L_DEFAULTS.heightMm);
		expect(station.labelWidthMm).to.equal(100);
		expect(station.labelHeightMm).to.equal(150);
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
