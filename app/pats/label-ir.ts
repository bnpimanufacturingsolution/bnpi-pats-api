export type LabelIr = {
	barcodeValue: string;
	batchCode: string;
	lotCode: string;
	partName: string;
	partCode: string;
	quantity: number;
	fromStepLabel: string;
	toStepLabel: string;
	atLabel?: string;
	operatorName?: string;
	machineName?: string;
	productLine?: string;
	qrValue?: string;
	printedAt: string;
	sequence: number;
	widthMm: number;
	heightMm: number;
	dpi: number;
};

/** Glory-L printhead max width. Not a die / roll size. Never emit wider than this. */
export const GLORY_L_MAX_WIDTH_MM = 104;

export const GLORY_L_DEFAULTS = {
	widthMm: 100,
	heightMm: 150,
	dpi: 300,
	model: "HPRT_GLORY_L",
} as const;

/**
 * Positions copied from the Issuance BarcodePreview (100×150, p-4, 45% QR, footer at bottom).
 * Preview is the source of truth. Do not restyle the React card to match this file.
 */
export const LABEL_CARD = {
	pad: 4.2,
	headerY: 5,
	headerSize: 3.2,
	rule1Y: 11,
	qrY: 15,
	qrSize: 45,
	batchY: 64,
	batchSize: 4.2,
	fromY: 69,
	fromSize: 2.6,
	productY: 76,
	productSize: 2.6,
	partY: 81,
	partSize: 5.5,
	rule2Y: 124,
	qtyLabelY: 128,
	qtyValueY: 133,
	qtyValueSize: 5.5,
	metaLabelSize: 2.6,
	operatorValueSize: 3.7,
	machineLabelY: 142,
	machineValueY: 146.5,
	machineValueSize: 3.5,
	col2X: 52,
} as const;

export function clampGloryLWidthMm(widthMm: number): number {
	if (!Number.isFinite(widthMm) || widthMm <= 0) return GLORY_L_DEFAULTS.widthMm;
	return Math.min(Math.round(widthMm), GLORY_L_MAX_WIDTH_MM);
}

function dots(mm: number, dpi: number): number {
	return Math.round((mm * dpi) / 25.4);
}

function zplSafe(value: string): string {
	return value.replace(/[\^~\\]/g, " ").slice(0, 80);
}

function zplQrSafe(value: string): string {
	return value.replace(/[\^~]/g, " ").slice(0, 600);
}

function tsplSafe(value: string): string {
	return value.replace(/"/g, "'").slice(0, 80);
}

export function renderZpl(ir: LabelIr): string {
	const widthMm = clampGloryLWidthMm(ir.widthMm);
	const heightMm = Math.max(ir.heightMm, 20);
	const mm = (value: number) => dots(value, ir.dpi);
	const barcode = zplSafe(ir.barcodeValue);
	const qrPayload = zplQrSafe(ir.qrValue || ir.barcodeValue);
	const batch = zplSafe(ir.batchCode || ir.barcodeValue);
	const part = zplSafe(ir.partName || ir.partCode).toUpperCase();
	const at = zplSafe(ir.atLabel || ir.toStepLabel || "STATION")
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
	const from = zplSafe(ir.fromStepLabel || "EXTERNAL").toUpperCase();
	const productLine = zplSafe(ir.productLine || "TAMAGOTCHI PARADISE MEJIRUSHI ACCESSORY");
	const operator = zplSafe((ir.operatorName || "—").toUpperCase());
	const machine = zplSafe((ir.machineName || "—").toUpperCase());
	const header = `${at} MANUAL`;
	const qty = `${ir.quantity} PCS`;
	const L = LABEL_CARD;

	if (heightMm >= 100) {
		const labelWidth = mm(widthMm);
		const labelHeight = mm(heightMm);
		// On HPRT Glory-L, qrMag=5 produces ~35mm QR code (matching 35% in UI preview)
		const qrMag = 7; 
		const qrX = Math.round((labelWidth - mm(35)) / 2); // Center a 35mm QR code

		return [
			"^XA",
			`^PW${labelWidth}`,
			`^LL${labelHeight}`,
			"^CI28",
			"^LH0,0",
			// Header
			`^FO0,${mm(8)}^FB${labelWidth},1,0,C^A0N,${mm(3)},${mm(3)}^FD${header}^FS`,
			`^FO${mm(6)},${mm(14)}^GB${mm(widthMm - 12)},${mm(0.3)},2^FS`,
			
			// QR Code (centered)
			`^FO${qrX},${mm(20)}^BQN,2,${qrMag}^FDQA,${qrPayload}^FS`,
			
			// Identity Block (Centered, matching UI flex layout Y-coordinates)
			`^FO0,${mm(60)}^FB${labelWidth},1,0,C^A0N,${mm(4)},${mm(4)}^FD${batch}^FS`,
			`^FO0,${mm(66)}^FB${labelWidth},1,0,C^A0N,${mm(3)},${mm(3)}^FDFROM: ${from}^FS`,
			`^FO0,${mm(72)}^FB${labelWidth},1,0,C^A0N,${mm(3)},${mm(3)}^FD${productLine}^FS`,
			
			// Part Name
			`^FO0,${mm(78)}^FB${labelWidth},2,5,C^A0N,${mm(5)},${mm(5)}^FD${part}^FS`,
			
			// Grid Border
			`^FO${mm(6)},${mm(125)}^GB${mm(widthMm - 12)},${mm(0.3)},2^FS`,
			
			// Bottom Grid Data (Restored)
			`^FO${mm(L.pad)},${mm(130)}^A0N,${mm(3)},${mm(3)}^FDQUANTITY^FS`,
			`^FO${mm(L.pad)},${mm(135)}^A0N,${mm(6)},${mm(6)}^FD${qty}^FS`,
			
			`^FO${mm(L.col2X)},${mm(130)}^A0N,${mm(3)},${mm(3)}^FDOPERATOR^FS`,
			`^FO${mm(L.col2X)},${mm(134)}^A0N,${mm(4)},${mm(4)}^FD${operator}^FS`,
			
			`^FO${mm(L.pad)},${mm(142)}^A0N,${mm(3)},${mm(3)}^FDMACHINE^FS`,
			`^FO${mm(L.pad)},${mm(146)}^A0N,${mm(4)},${mm(4)}^FD${machine}^FS`,
			"^XZ",
		].join("\n");
	}

	const width = mm(widthMm);
	const height = mm(heightMm);
	const margin = Math.max(20, mm(3));
	const qrMag = heightMm >= 50 ? 6 : 4;
	const textX = Math.round(width * 0.42);
	const title = Math.min(48, Math.max(24, Math.round(height * 0.12)));
	const body = Math.min(28, Math.max(18, Math.round(height * 0.08)));

	return [
		"^XA",
		`^PW${width}`,
		`^LL${height}`,
		"^CI28",
		`^FO${margin},${margin}^BQN,2,${qrMag}^FDQA,${barcode}^FS`,
		`^FO${textX},${margin}^A0N,${title},${title}^FD${batch}^FS`,
		`^FO${textX},${margin + title + 6}^A0N,${body},${body}^FD${from}^FS`,
		`^FO${textX},${margin + title + body + 12}^A0N,${body},${body}^FD${part}^FS`,
		`^FO${textX},${margin + title + body * 2 + 18}^A0N,${title},${title}^FD${qty}^FS`,
		"^XZ",
	].join("\n");
}

export function renderTspl(ir: LabelIr): string {
	const barcode = tsplSafe(ir.barcodeValue);
	const batch = tsplSafe(ir.batchCode);
	const lot = tsplSafe(ir.lotCode);
	const part = tsplSafe(ir.partName || ir.partCode);
	const from = tsplSafe(ir.fromStepLabel);
	const to = tsplSafe(ir.toStepLabel);

	const widthMm = clampGloryLWidthMm(ir.widthMm);
	return [
		`SIZE ${widthMm} mm, ${ir.heightMm} mm`,
		"GAP 2 mm, 0",
		"DENSITY 8",
		"DIRECTION 1",
		"CLS",
		`QRCODE 20,20,L,6,A,0,"${barcode}"`,
		`TEXT 220,20,"3",0,1,1,"${batch}"`,
		`TEXT 220,60,"2",0,1,1,"${lot}"`,
		`TEXT 220,90,"2",0,1,1,"${part}"`,
		`TEXT 220,120,"3",0,1,1,"${ir.quantity} PCS"`,
		`TEXT 20,160,"2",0,1,1,"${from}"`,
		`TEXT 20,190,"2",0,1,1,"${to}"`,
		"PRINT 1",
		"",
	].join("\n");
}

export function renderLabel(language: string, ir: LabelIr): string {
	return language.toUpperCase() === "TSPL" ? renderTspl(ir) : renderZpl(ir);
}

/** Lab-only: boxes at known mm so the loaded die can be read off the paper. */
export function renderCalibrationZpl(dpi = 300): string {
	const mm = (value: number) => dots(value, dpi);
	const box = (xMm: number, yMm: number, wMm: number, hMm: number) =>
		`^FO${mm(xMm)},${mm(yMm)}^GB${mm(wMm)},${mm(hMm)},4^FS`;
	const tick = (xMm: number, yMm: number, label: string) =>
		`^FO${mm(xMm)},${mm(yMm)}^A0N,22,22^FD${label}^FS`;

	return [
		"^XA",
		`^PW${mm(GLORY_L_MAX_WIDTH_MM)}`,
		`^LL${mm(168)}`,
		"^CI28",
		"^FO24,16^A0N,28,28^FDMEASURE THE BOX THAT FILLS THE STICKER^FS",
		box(4, 12, 102, 152),
		tick(8, 16, "4x6 102x152"),
		box(4, 12, 100, 75),
		tick(8, 40, "100x75"),
		box(4, 12, 100, 50),
		tick(8, 60, "100x50"),
		...[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(
			(x) => `^FO${mm(4 + x)},${mm(76)}^GB${mm(0.4)},${mm(3)},8^FS^FO${mm(2 + x)},${mm(70)}^A0N,18,18^FD${x}^FS`,
		),
		"^XZ",
	].join("\n");
}
