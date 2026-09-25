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
	projectName?: string;
	codename?: string;
	serialNumber?: string;
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
	dpi: 203,
	model: "HPRT_HD100",
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
	const barcode = zplSafe(ir.barcodeValue || ir.batchCode);
	const batch = zplSafe(ir.batchCode || ir.barcodeValue);
	const qrPayload = zplQrSafe(ir.qrValue || ir.barcodeValue);
	const lot = zplSafe(ir.lotCode || "").toUpperCase();
	const part = zplSafe(ir.partName || ir.partCode).toUpperCase();
	const rawHeader = ir.atLabel || ir.fromStepLabel || ir.toStepLabel || "STATION";
	const header = zplSafe(rawHeader.replace(/\s*[—–]\s*/g, " — ").trim()).toUpperCase();
	const projectName = zplSafe(ir.projectName || ir.productLine || "").toUpperCase();
	const from = zplSafe(ir.fromStepLabel || "EXTERNAL").toUpperCase();
	const codename = zplSafe(ir.codename || "").toUpperCase();
	const operator = zplSafe((ir.operatorName || "—").toUpperCase());
	const machine = zplSafe((ir.machineName || "—").toUpperCase());
	const qty = `${ir.quantity} PCS`;

	if (heightMm >= 100) {
		const labelWidth = mm(widthMm);
		const labelHeight = mm(heightMm);
		const ruleMargin = mm(10);
		const ruleWidth = labelWidth - (ruleMargin * 2);

		// Target ~35mm QR code (matching 35% in UI preview)
		const targetQrDots = mm(35);
		const qrModules = 29;
		const qrMag = Math.max(3, Math.min(10, Math.round(targetQrDots / qrModules)));
		const actualQrDots = qrModules * qrMag;
		const qrX = Math.max(0, Math.round((labelWidth - actualQrDots) / 2));

		const lines: string[] = [
			"^XA",
			`^PW${labelWidth}`,
			`^LL${labelHeight}`,
			"^CI28",
			"^LH0,0",
			// Header
			`^FO0,${mm(7)}^FB${labelWidth},1,0,C^A0N,${mm(3.5)},${mm(3.2)}^FD${header}^FS`,
			`^FO${ruleMargin},${mm(13)}^GB${ruleWidth},0,2^FS`,

			// QR Code (centered, 35mm)
			`^FO${qrX},${mm(21)}^BQN,2,${qrMag}^FDQA,${qrPayload}^FS`,
		];

		let currentY = 64;

		// 1. Primary Barcode Value (e.g. BC-BATCH-000021)
		lines.push(`^FO0,${mm(currentY)}^FB${labelWidth},1,0,C^A0N,${mm(4.5)},${mm(4.2)}^FD${barcode}^FS`);
		currentY += 6;

		// 2. Lot Code
		if (lot) {
			lines.push(`^FO0,${mm(currentY)}^FB${labelWidth},1,0,C^A0N,${mm(3.2)},${mm(3.0)}^FDLOT: ${lot}^FS`);
			currentY += 5.5;
		}

		// 3. Project Name
		if (projectName) {
			lines.push(`^FO0,${mm(currentY)}^FB${labelWidth},1,0,C^A0N,${mm(3.2)},${mm(3.0)}^FDPROJECT: ${projectName}^FS`);
			currentY += 6.5;
		}

		// 4. Part Name (prominent bold uppercase)
		currentY += 1.5;
		lines.push(`^FO0,${mm(currentY)}^FB${labelWidth},2,4,C^A0N,${mm(6.5)},${mm(6.0)}^FD${part}^FS`);

		// Bottom Grid Border & Metadata
		const isInjectionLabel =
			Boolean(ir.operatorName || ir.machineName) &&
			(/injection/i.test(ir.atLabel ?? "") ||
				/injection/i.test(ir.toStepLabel ?? "") ||
				/injection/i.test(ir.fromStepLabel ?? ""));

		if (isInjectionLabel) {
			const footerY = heightMm - 36;
			lines.push(
				`^FO${ruleMargin},${mm(footerY)}^GB${ruleWidth},0,2^FS`,
				`^FO${mm(10)},${mm(footerY + 3)}^A0N,${mm(2.8)},${mm(2.5)}^FDQUANTITY^FS`,
				`^FO${mm(10)},${mm(footerY + 7)}^A0N,${mm(6.5)},${mm(6.0)}^FD${qty}^FS`,
				`^FO${mm(54)},${mm(footerY + 3)}^A0N,${mm(2.8)},${mm(2.5)}^FDOPERATOR^FS`,
				`^FO${mm(54)},${mm(footerY + 7)}^A0N,${mm(4.0)},${mm(3.6)}^FD${operator}^FS`,
				`^FO${mm(10)},${mm(footerY + 17)}^A0N,${mm(2.8)},${mm(2.5)}^FDMACHINE^FS`,
				`^FO${mm(10)},${mm(footerY + 21)}^A0N,${mm(4.0)},${mm(3.6)}^FD${machine}^FS`,
			);
		} else {
			const footerY = heightMm - 26;
			lines.push(
				`^FO${ruleMargin},${mm(footerY)}^GB${ruleWidth},0,2^FS`,
				`^FO${mm(10)},${mm(footerY + 3)}^A0N,${mm(2.8)},${mm(2.5)}^FDQUANTITY^FS`,
				`^FO${mm(10)},${mm(footerY + 7.5)}^A0N,${mm(6.8)},${mm(6.2)}^FD${qty}^FS`,
			);
		}

		lines.push("^XZ");

		return lines.join("\n");
	}

	const width = mm(widthMm);
	const height = mm(heightMm);
	const margin = Math.max(20, mm(3));
	const qrMag = heightMm >= 50 ? 6 : 4;
	const textX = Math.round(width * 0.42);
	const title = Math.min(48, Math.max(24, Math.round(height * 0.12)));
	const body = Math.min(28, Math.max(18, Math.round(height * 0.08)));

	const smallCommands: string[] = [
		"^XA",
		`^PW${width}`,
		`^LL${height}`,
		"^CI28",
		`^FO${margin},${margin}^BQN,2,${qrMag}^FDQA,${qrPayload}^FS`,
		`^FO${textX},${margin}^A0N,${title},${title}^FD${barcode}^FS`,
	];

	let subY = margin + title + 4;
	if (lot) {
		smallCommands.push(`^FO${textX},${subY}^A0N,${body},${body}^FDLOT: ${lot}^FS`);
		subY += body + 4;
	}
	if (projectName) {
		smallCommands.push(`^FO${textX},${subY}^A0N,${body},${body}^FDPROJECT: ${projectName}^FS`);
		subY += body + 4;
	}
	if (codename) {
		smallCommands.push(`^FO${textX},${subY}^A0N,${body},${body}^FDCODE: ${codename}^FS`);
		subY += body + 4;
	}
	smallCommands.push(
		`^FO${textX},${subY}^A0N,${body},${body}^FD${from}^FS`,
		`^FO${textX},${subY + body + 4}^A0N,${body},${body}^FD${part}^FS`,
		`^FO${textX},${subY + body * 2 + 8}^A0N,${title},${title}^FD${qty}^FS`,
		"^XZ",
	);

	return smallCommands.join("\n");
}

export function renderTspl(ir: LabelIr): string {
	const barcode = tsplSafe(ir.barcodeValue);
	const batch = tsplSafe(ir.batchCode);
	const lot = tsplSafe(ir.lotCode);
	const part = tsplSafe(ir.partName || ir.partCode);
	const from = tsplSafe(ir.fromStepLabel);
	const to = tsplSafe(ir.toStepLabel);
	const projectName = tsplSafe(ir.projectName || ir.productLine || "");
	const codename = tsplSafe(ir.codename || "");
	const serial = tsplSafe(ir.serialNumber || ir.barcodeValue || "");

	const widthMm = clampGloryLWidthMm(ir.widthMm);
	const lines = [
		`SIZE ${widthMm} mm, ${ir.heightMm} mm`,
		"GAP 2 mm, 0",
		"DENSITY 8",
		"DIRECTION 1",
		"CLS",
		`QRCODE 20,20,L,6,A,0,"${barcode}"`,
		`TEXT 220,20,"3",0,1,1,"${batch}"`,
		lot ? `TEXT 220,48,"2",0,1,1,"LOT: ${lot}"` : "",
		serial && serial !== batch ? `TEXT 220,68,"2",0,1,1,"S/N: ${serial}"` : "",
		projectName ? `TEXT 220,88,"2",0,1,1,"PROJECT: ${projectName}"` : "",
		codename ? `TEXT 220,108,"2",0,1,1,"CODENAME: ${codename}"` : "",
		`TEXT 220,128,"2",0,1,1,"${part}"`,
		`TEXT 220,155,"3",0,1,1,"${ir.quantity} PCS"`,
		`TEXT 20,160,"2",0,1,1,"${from}"`,
		`TEXT 20,190,"2",0,1,1,"${to}"`,
		"PRINT 1",
		"",
	];
	return lines.filter(Boolean).join("\n");
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
