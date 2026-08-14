import { expect } from "chai";
import {
	clampGloryLWidthMm,
	GLORY_L_DEFAULTS,
	renderCalibrationZpl,
	renderTspl,
	renderZpl,
	type LabelIr,
} from "../app/pats/label-ir";
import { parseWindowsPrinterName, selectPrintPort } from "../app/pats/print-ports";

const ir: LabelIr = {
	barcodeValue: "BC-BATCH-000001",
	batchCode: "BNI-2606-001",
	lotCode: "MLT-001",
	partName: "Body",
	partCode: "P-BODY",
	quantity: 240,
	fromStepLabel: "Injection (Molding)",
	toStepLabel: "Decoration · Full Spray",
	printedAt: "2026-08-14T00:00:00.000Z",
	sequence: 1,
	widthMm: 100,
	heightMm: 50,
	dpi: 300,
};

describe("label IR renderers", () => {
	it("renders ZPL with barcode identity and quantity at 300 dpi", () => {
		const zpl = renderZpl(ir);
		expect(zpl).to.include("^XA");
		expect(zpl).to.include("^XZ");
		expect(zpl).to.include("BC-BATCH-000001");
		expect(zpl).to.include("240 PCS");
		expect(zpl).to.match(/\^PW11\d{2}/);
		expect(zpl).to.not.include("READY_FOR_RELEASE");
		expect(zpl).to.not.include("|");
	});

	it("selects the Windows spooler port for USB_AGENT", () => {
		expect(parseWindowsPrinterName("winspool:HPRT Glory-L")).to.equal("HPRT Glory-L");
		expect(selectPrintPort("USB_AGENT")).to.not.equal(selectPrintPort("NETWORK"));
	});

	it("defaults the boxed Glory-L sample to 100x150 mm", () => {
		expect(GLORY_L_DEFAULTS.widthMm).to.equal(100);
		expect(GLORY_L_DEFAULTS.heightMm).to.equal(150);
	});

	it("fills a 4x6 sticker with the issuance card fields", () => {
		const zpl = renderZpl({
			...ir,
			widthMm: 100,
			heightMm: 150,
			atLabel: "Injection (Molding)",
			operatorName: "Rico M.",
			machineName: "Injection Press (INJP-20441-JCX)",
		});
		expect(zpl).to.include("INJECTION-MOLDING MANUAL");
		expect(zpl).to.include("BNI-2606-001");
		expect(zpl).to.include("FROM: INJECTION (MOLDING)");
		expect(zpl).to.include("TAMAGOTCHI PARADISE MEJIRUSHI ACCESSORY");
		expect(zpl).to.include("QUANTITY");
		expect(zpl).to.include("240 PCS");
		expect(zpl).to.include("OPERATOR");
		expect(zpl).to.include("RICO M.");
		expect(zpl).to.include("MACHINE");
	});

	it("clamps requested width to the 104 mm Glory-L head", () => {
		expect(clampGloryLWidthMm(104)).to.equal(104);
		expect(clampGloryLWidthMm(120)).to.equal(104);
		expect(clampGloryLWidthMm(80)).to.equal(80);
	});

	it("includes the 4x6 boxed-sample outline on the calibration sticker", () => {
		const zpl = renderCalibrationZpl(300);
		expect(zpl).to.include("4x6 102x152");
		expect(zpl).to.include("^XA");
	});

	it("renders TSPL with the same barcode identity", () => {
		const tspl = renderTspl(ir);
		expect(tspl).to.include('QRCODE 20,20,L,6,A,0,"BC-BATCH-000001"');
		expect(tspl).to.include("240 PCS");
		expect(tspl).to.include("SIZE 100 mm, 50 mm");
	});
});
