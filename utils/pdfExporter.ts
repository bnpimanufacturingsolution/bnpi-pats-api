import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { createLogger } from "../helper/logger";
import path from "path";
import fs from "fs";

// pdfmake v0.3 exports a singleton instance, not a class
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require("pdfmake");

// Load font files into pdfmake virtual filesystem
const pdfmakeDir = path.dirname(require.resolve("pdfmake/package.json"));
const fontsDir = path.join(pdfmakeDir, "fonts", "Roboto");

pdfmake.virtualfs.writeFileSync(
	"Roboto-Regular.ttf",
	fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")),
);
pdfmake.virtualfs.writeFileSync(
	"Roboto-Medium.ttf",
	fs.readFileSync(path.join(fontsDir, "Roboto-Medium.ttf")),
);
pdfmake.virtualfs.writeFileSync(
	"Roboto-Italic.ttf",
	fs.readFileSync(path.join(fontsDir, "Roboto-Italic.ttf")),
);
pdfmake.virtualfs.writeFileSync(
	"Roboto-MediumItalic.ttf",
	fs.readFileSync(path.join(fontsDir, "Roboto-MediumItalic.ttf")),
);

pdfmake.setFonts({
	Roboto: {
		normal: "Roboto-Regular.ttf",
		bold: "Roboto-Medium.ttf",
		italics: "Roboto-Italic.ttf",
		bolditalics: "Roboto-MediumItalic.ttf",
	},
});

const pdfLogger = createLogger("pdf-export");

// Colors matching sample PO
const HEADER_BG = "#203764";
const SECTION_HEADER_BG = "#203764";
const SECTION_HEADER_TEXT = "#FFFFFF";
const TABLE_HEADER_BG = "#203764";
const BORDER_COLOR = "#FFFFFF";

export interface PurchaseOrderPdfData {
	// Workspace / Company
	companyName: string;
	companyAddress: string;
	companyPhone: string;
	companyEmail: string;
	companyLogoUrl?: string | null;

	// PO Header
	poNumber: string;
	orderDate: string;
	projectCode: string;

	// Vendor (Company Details)
	vendorName: string;
	vendorAddress: string;

	// Contact Details
	contactPerson: string;
	contactPhone: string;
	contactDesignation: string;
	contactMobile: string;
	contactDepartment: string;
	contactEmail: string;

	// Shipped To / Requisitioner
	deliveryAddress: string;
	requestedBy: string;
	requestedByTitle: string;
	requestedByDepartment: string;

	// Terms Row
	shippingTerms: string;
	leadTime: string;
	availability: string;
	deliveryTerms: string;

	// Items
	items: Array<{
		quantity: number;
		unit: string;
		itemCode: string;
		description: string;
		unitPrice: number;
		totalPrice: number;
	}>;

	// Totals
	currency: string;
	subtotal: number;
	totalAmount: number;

	// Signatures
	checkedBy: string;
	checkedByTitle: string;
	dateProcessed: string;
	approvedBy: string;
	approvedByTitle: string;
	dateApproved: string;

	// Acknowledged by
	acknowledgedBy: string;

	// Terms and conditions
	termsConditions: string;
}

function formatCurrency(amount: number, currency: string = "PHP"): string {
	if (currency === "PHP") {
		return `\u20B1 ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}
	return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCurrencySymbol(currency: string = "PHP"): string {
	if (currency === "PHP") return "\u20B1";
	if (currency === "USD") return "$";
	return currency;
}

function formatAmount(amount: number): string {
	return amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sectionHeader(text: string, colSpan: number): TableCell {
	return {
		text,
		colSpan,
		fillColor: SECTION_HEADER_BG,
		color: SECTION_HEADER_TEXT,
		fontSize: 7,
		bold: true,
		margin: [4, 3, 4, 3],
	};
}

function labelCell(text: string): TableCell {
	return { text, bold: true, fontSize: 8, margin: [4, 3, 4, 3] };
}

function valueCell(text: string): TableCell {
	return { text: text || "", fontSize: 8, margin: [4, 3, 4, 3] };
}

const DEFAULT_TERMS = `Terms and Conditions:
1. Please send two copies of your invoice
2. Enter this order in accordance with the prices, terms, delivery method, and specifications listed above.
3. Please notify us immediately if you're unable to ship as specified
4. Standard Delivery Lead time: On-Stock - on the next business day or 2 days upon issuance of PO.
   Non-Stock: delivery within 30 days upon issuance of PO
5. For failure to comply to the delivery and installation lead time, the supplier shall shoulder the liquidated damages equivalent to one tenth of one percent (0.1%) of the contract amount per calendar day of delay.`;

export async function generatePurchaseOrderPdf(data: PurchaseOrderPdfData): Promise<Buffer> {
	pdfLogger.info(`Generating PDF for PO: ${data.poNumber}`);

	const content: Content[] = [];

	// ─── 1. HEADER ───
	content.push({
		columns: [
			// Left: Company info
			{
				width: "*",
				stack: [
					{
						text: data.companyName || "Company Name",
						fontSize: 16,
						bold: true,
						color: HEADER_BG,
						margin: [0, 0, 0, 4],
					},
					{ text: data.companyAddress || "", fontSize: 8, color: "#555555" },
					{
						text: [
							...(data.companyPhone
								? [
										{
											text: `Tel. No : ${data.companyPhone}`,
											fontSize: 8,
											color: "#555555",
										},
									]
								: []),
							...(data.companyPhone && data.companyEmail
								? [{ text: " | ", fontSize: 8, color: "#555555" }]
								: []),
							...(data.companyEmail
								? [
										{
											text: `Email : ${data.companyEmail}`,
											fontSize: 8,
											color: "#555555",
										},
									]
								: []),
						],
						margin: [0, 2, 0, 0],
					},
				],
			},
			// Right: PO title box
			{
				width: 220,
				stack: [
					{
						table: {
							widths: ["*"],
							body: [
								[
									{
										text: "PURCHASE ORDER",
										fillColor: HEADER_BG,
										color: SECTION_HEADER_TEXT,
										fontSize: 14,
										bold: true,
										alignment: "center" as const,
										margin: [0, 6, 0, 6],
									},
								],
							],
						},
						layout: "noBorders",
					},
					{
						table: {
							widths: [80, "*"],
							body: [
								[
									{
										text: "PO NO:",
										bold: true,
										fontSize: 9,
										alignment: "right" as const,
										margin: [0, 2, 4, 1],
									},
									{ text: data.poNumber, fontSize: 9, margin: [0, 2, 0, 1] },
								],
								[
									{
										text: "DATE :",
										bold: true,
										fontSize: 9,
										alignment: "right" as const,
										margin: [0, 1, 4, 1],
									},
									{ text: data.orderDate, fontSize: 9, margin: [0, 1, 0, 1] },
								],
								[
									{
										text: "PROJECT CODE:",
										bold: true,
										fontSize: 9,
										alignment: "right" as const,
										margin: [0, 1, 4, 2],
									},
									{
										text: data.projectCode || "",
										fontSize: 9,
										margin: [0, 1, 0, 2],
									},
								],
							],
						},
						layout: {
							hLineWidth: () => 0.3,
							vLineWidth: () => 0.3,
							hLineColor: () => BORDER_COLOR,
							vLineColor: () => BORDER_COLOR,
						},
					},
				],
			},
		],
		margin: [0, 0, 0, 12],
	});

	// ─── 2. COMPANY DETAILS / CONTACT DETAILS ───
	content.push({
		table: {
			widths: [45, 120, 65, 80, 60, "*"],
			body: [
				// Headers
				[
					sectionHeader("COMPANY DETAILS", 2),
					{},
					sectionHeader("CONTACT DETAILS", 4),
					{},
					{},
					{},
				],
				// Row 1: To / Name + Contact Number
				[
					labelCell("To:"),
					{ text: data.vendorName, fontSize: 8, margin: [4, 3, 4, 3], rowSpan: 1 },
					labelCell("Name:"),
					valueCell(data.contactPerson),
					labelCell("Contact\nNumber :"),
					valueCell(data.contactPhone),
				],
				// Row 2: Address / Designation + Contact Mobile
				[
					labelCell("Address:"),
					{ text: data.vendorAddress, fontSize: 8, margin: [4, 3, 4, 3], rowSpan: 2 },
					labelCell("Designation:"),
					valueCell(data.contactDesignation),
					labelCell("Contact\nMobile:"),
					valueCell(data.contactMobile),
				],
				// Row 3: (address continues) / Department + Email
				[
					{},
					{},
					labelCell("Department:"),
					valueCell(data.contactDepartment),
					labelCell("Email:"),
					valueCell(data.contactEmail),
				],
			],
		},
		layout: {
			hLineWidth: () => 0.3,
			vLineWidth: () => 0.3,
			hLineColor: () => BORDER_COLOR,
			vLineColor: () => BORDER_COLOR,
		},
		margin: [0, 0, 0, 0],
	});

	// ─── 3. SHIPPED TO / REQUISITIONER ───
	content.push({
		table: {
			widths: ["*", 120, 100, 90],
			body: [
				[
					sectionHeader("SHIPPED TO", 1),
					sectionHeader("REQUISITIONER", 1),
					sectionHeader("DESIGNATION", 1),
					sectionHeader("DEPARTMENT", 1),
				],
				[
					valueCell(data.deliveryAddress),
					valueCell(data.requestedBy),
					valueCell(data.requestedByTitle),
					valueCell(data.requestedByDepartment),
				],
			],
		},
		layout: {
			hLineWidth: () => 0.3,
			vLineWidth: () => 0.3,
			hLineColor: () => BORDER_COLOR,
			vLineColor: () => BORDER_COLOR,
		},
		margin: [0, 0, 0, 0],
	});

	// ─── 4. TERMS ROW ───
	content.push({
		table: {
			widths: ["*", "*", "*", "*"],
			body: [
				[
					sectionHeader("TERMS", 1),
					sectionHeader("LEAD TIME", 1),
					sectionHeader("AVAILABILITY", 1),
					sectionHeader("DELIVERY", 1),
				],
				[
					valueCell(data.shippingTerms),
					valueCell(data.leadTime),
					valueCell(data.availability),
					valueCell(data.deliveryTerms),
				],
			],
		},
		layout: {
			hLineWidth: () => 0.3,
			vLineWidth: () => 0.3,
			hLineColor: () => BORDER_COLOR,
			vLineColor: () => BORDER_COLOR,
		},
		margin: [0, 0, 0, 8],
	});

	// ─── 5. ITEMS TABLE ───
	const itemHeaderRow: TableCell[] = [
		{
			text: "QTY",
			bold: true,
			fontSize: 7,
			fillColor: TABLE_HEADER_BG,
			color: SECTION_HEADER_TEXT,
			alignment: "center" as const,
			margin: [2, 4, 2, 4],
		},
		{
			text: "UNIT",
			bold: true,
			fontSize: 7,
			fillColor: TABLE_HEADER_BG,
			color: SECTION_HEADER_TEXT,
			alignment: "center" as const,
			margin: [2, 4, 2, 4],
		},
		{
			text: "ITEM CODE",
			bold: true,
			fontSize: 7,
			fillColor: TABLE_HEADER_BG,
			color: SECTION_HEADER_TEXT,
			alignment: "center" as const,
			margin: [2, 4, 2, 4],
		},
		{
			text: "DESCRIPTION",
			bold: true,
			fontSize: 7,
			fillColor: TABLE_HEADER_BG,
			color: SECTION_HEADER_TEXT,
			alignment: "center" as const,
			margin: [2, 4, 2, 4],
		},
		{
			text: "UNIT PRICE",
			bold: true,
			fontSize: 7,
			fillColor: TABLE_HEADER_BG,
			color: SECTION_HEADER_TEXT,
			alignment: "center" as const,
			margin: [2, 4, 2, 4],
		},
		{
			text: "TOTAL",
			bold: true,
			fontSize: 7,
			fillColor: TABLE_HEADER_BG,
			color: SECTION_HEADER_TEXT,
			alignment: "center" as const,
			margin: [2, 4, 2, 4],
		},
	];

	const itemRows: TableCell[][] = data.items.map((item) => [
		{
			text: item.quantity.toLocaleString(),
			fontSize: 8,
			alignment: "center" as const,
			margin: [2, 6, 2, 6],
		},
		{ text: item.unit, fontSize: 8, alignment: "center" as const, margin: [2, 6, 2, 6] },
		{ text: item.itemCode, fontSize: 8, margin: [4, 6, 2, 6] },
		{ text: item.description, fontSize: 8, margin: [4, 6, 2, 6] },
		{
			text: formatCurrency(item.unitPrice, data.currency),
			fontSize: 8,
			alignment: "right" as const,
			margin: [2, 6, 4, 6],
		},
		{
			text: formatCurrency(item.totalPrice, data.currency),
			fontSize: 8,
			alignment: "right" as const,
			margin: [2, 6, 4, 6],
		},
	]);

	content.push({
		table: {
			headerRows: 1,
			widths: [40, 40, 70, "*", 85, 95],
			body: [itemHeaderRow, ...itemRows],
		},
		layout: {
			hLineWidth: (i: number, node: any) =>
				i === 0 || i === 1 || i === node.table.body.length ? 0.3 : 0.2,
			vLineWidth: () => 0.3,
			hLineColor: () => BORDER_COLOR,
			vLineColor: () => BORDER_COLOR,
		},
		margin: [0, 0, 0, 8],
	});

	// ─── 6. TOTALS ───
	const currencySymbol = getCurrencySymbol(data.currency);
	content.push({
		columns: [
			{ width: "*", text: "" },
			{
				width: 280,
				table: {
					widths: [110, 15, "*"],
					body: [
						[
							{
								text: "SUB-TOTAL",
								fontSize: 9,
								alignment: "right" as const,
								margin: [0, 3, 4, 3],
							},
							{
								text: currencySymbol,
								fontSize: 9,
								alignment: "left" as const,
								margin: [0, 3, 0, 3],
							},
							{
								text: formatAmount(data.subtotal),
								fontSize: 9,
								alignment: "right" as const,
								margin: [0, 3, 4, 3],
							},
						],
						[
							{
								text: "TOTAL VAT-INC",
								fontSize: 10,
								alignment: "right" as const,
								margin: [0, 3, 4, 3],
								bold: true,
							},
							{
								text: currencySymbol,
								fontSize: 11,
								alignment: "left" as const,
								margin: [0, 3, 0, 3],
								bold: true,
							},
							{
								text: formatAmount(data.totalAmount),
								fontSize: 11,
								alignment: "right" as const,
								margin: [0, 3, 4, 3],
								bold: true,
							},
						],
					],
				},
				layout: "noBorders",
			},
		],
		margin: [0, 0, 0, 20],
	});

	// ─── 7. SIGNATURES ───
	const sigPad = 20;
	const sigX2 = 185;
	const signatureBlock = (
		name: string,
		label: string,
		title: string,
		date: string,
		dateLabel: string,
	) => ({
		width: "*",
		stack: [
			{ text: "", margin: [0, 0, 0, 30] },
			// Name above the line
			{
				text: name,
				fontSize: 10,
				alignment: "center" as const,
				margin: [sigPad, 0, sigPad, 0],
			},
			// Signature underline
			{
				canvas: [
					{
						type: "line" as const,
						x1: sigPad,
						y1: 0,
						x2: sigX2,
						y2: 0,
						lineWidth: 0.5,
						lineColor: "#333333",
					},
				],
			},
			// Label below line
			{ text: label, fontSize: 7, color: "#666666", margin: [sigPad, 2, sigPad, 0] },
			// Title
			{
				text: title,
				fontSize: 8,
				bold: true,
				alignment: "center" as const,
				margin: [sigPad, 6, sigPad, 14],
			},
			// Date above the line
			{
				text: date,
				fontSize: 9,
				bold: true,
				alignment: "center" as const,
				margin: [sigPad, 0, sigPad, 0],
			},
			// Date underline
			{
				canvas: [
					{
						type: "line" as const,
						x1: sigPad,
						y1: 0,
						x2: sigX2,
						y2: 0,
						lineWidth: 0.5,
						lineColor: "#333333",
					},
				],
			},
			// Date label below line
			{
				text: dateLabel,
				fontSize: 7,
				color: "#666666",
				alignment: "center" as const,
				margin: [sigPad, 2, sigPad, 0],
			},
		],
	});

	content.push({
		columns: [
			{ width: 150, text: "" },
			signatureBlock(
				data.checkedBy,
				"CHECKED BY:",
				data.checkedByTitle,
				data.dateProcessed,
				"DATE PROCESSED",
			),
			signatureBlock(
				data.approvedBy,
				"APPROVED BY:",
				data.approvedByTitle,
				data.dateApproved,
				"DATE APPROVED",
			),
		],
		margin: [0, 0, 0, 20],
	} as Content);

	// ─── 8. TERMS AND CONDITIONS ───
	const termsText = data.termsConditions || DEFAULT_TERMS;
	content.push({
		stack: termsText.split("\n").map((line) => ({
			text: line,
			fontSize: 7,
			color: "#333333",
			margin: [0, 1, 0, 1] as [number, number, number, number],
		})),
		margin: [0, 0, 0, 20],
	});

	// ─── 9. ACKNOWLEDGED BY ───
	content.push({
		columns: [
			{ width: "*", text: "" },
			{
				width: 220,
				stack: [
					...(data.acknowledgedBy
						? [
								{
									text: data.acknowledgedBy,
									fontSize: 10,
									alignment: "center" as const,
									margin: [0, 0, 0, 0] as [number, number, number, number],
								},
							]
						: []),
					{
						canvas: [
							{
								type: "line" as const,
								x1: 20,
								y1: 0,
								x2: 200,
								y2: 0,
								lineWidth: 0.5,
							},
						],
					},
					{
						text: "Print Name and Signature",
						fontSize: 7,
						alignment: "center" as const,
						color: "#666666",
						italics: true,
						margin: [0, 2, 0, 0],
					},
					{
						text: "ACKNOWLEDGED BY:",
						fontSize: 8,
						bold: true,
						alignment: "center" as const,
						margin: [0, 2, 0, 0],
					},
				],
			},
		],
	});

	// ─── DOCUMENT DEFINITION ───
	const docDefinition: TDocumentDefinitions = {
		pageSize: "LETTER",
		pageMargins: [40, 30, 40, 30],
		defaultStyle: {
			fontSize: 9,
		},
		content,
	};

	try {
		const doc = pdfmake.createPdf(docDefinition);
		const buffer: Buffer = await doc.getBuffer();
		pdfLogger.info(
			`PDF generated successfully for PO: ${data.poNumber} (${buffer.length} bytes)`,
		);
		return buffer;
	} catch (error) {
		pdfLogger.error(`Failed to generate PDF for PO ${data.poNumber}:`, error);
		throw error;
	}
}
