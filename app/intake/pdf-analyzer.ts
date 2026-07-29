import zlib from "node:zlib";

export interface PdfInput {
	fileName: string;
	bytes: Uint8Array;
}

export interface PdfIssue {
	code: "PDF_PAGE_COUNT_UNRESOLVED" | "PDF_TEXT_UNAVAILABLE" | "PDF_TEXT_LOCATION_UNRESOLVED";
	status: "UNAVAILABLE_DEPENDENCY" | "NEEDS_REVIEW";
	severity: "INFO" | "WARNING";
	message: string;
}

export interface PdfTextBlock {
	streamIndex: number;
	text: string;
	pageNumber: number | null;
}

export interface PdfAnalysis {
	artifactType: "PDF";
	fileName: string;
	pageCount: number | null;
	productCode: string | null;
	textBlocks: PdfTextBlock[];
	text: string;
	issues: PdfIssue[];
	metrics: {
		textBlockCount: number;
		textCharacters: number;
	};
}

export function analyzePdf(input: PdfInput): PdfAnalysis {
	const bytes = Buffer.from(input.bytes);
	const pageCount = countPages(bytes);
	const textBlocks = extractTextBlocks(bytes);
	const text = textBlocks.map((block) => block.text).join("\n").trim();
	const issues: PdfIssue[] = [];

	if (pageCount === null) {
		issues.push({
			code: "PDF_PAGE_COUNT_UNRESOLVED",
			status: "NEEDS_REVIEW",
			severity: "WARNING",
			message: "The PDF page tree could not be counted from the captured bytes.",
		});
	}

	if (!text) {
		issues.push({
			code: "PDF_TEXT_UNAVAILABLE",
			status: "UNAVAILABLE_DEPENDENCY",
			severity: "WARNING",
			message: "No readable text was extracted; the document may be image-only or use unsupported encoding.",
		});
	} else {
		issues.push({
			code: "PDF_TEXT_LOCATION_UNRESOLVED",
			status: "NEEDS_REVIEW",
			severity: "INFO",
			message: "Text was extracted from PDF streams, but page-level coordinates are not yet resolved.",
		});
	}

	return {
		artifactType: "PDF",
		fileName: input.fileName,
		pageCount,
		productCode: text.match(/\b(B\d{3})\b/i)?.[1]?.toUpperCase() ?? null,
		textBlocks,
		text,
		issues,
		metrics: {
			textBlockCount: textBlocks.length,
			textCharacters: text.length,
		},
	};
}

export function formatPdfReport(analysis: PdfAnalysis): string {
	const lines = [
		`# PDF evidence analysis - ${analysis.fileName}`,
		"",
		`Product code: ${analysis.productCode ?? "UNRESOLVED"}`,
		`Page count: ${analysis.pageCount ?? "UNRESOLVED"}`,
		`Text blocks: ${analysis.metrics.textBlockCount}`,
		`Extracted characters: ${analysis.metrics.textCharacters}`,
		"",
		"## Extracted text",
		"",
		analysis.text || "No readable text extracted.",
		"",
		"## Issues",
		"",
		"| Code | Status | Severity | Message |",
		"|---|---|---|---|",
	];

	for (const issue of analysis.issues) {
		lines.push(`| ${issue.code} | ${issue.status} | ${issue.severity} | ${issue.message} |`);
	}

	return `${lines.join("\n")}\n`;
}

function countPages(bytes: Buffer): number | null {
	if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) return null;
	const source = bytes.toString("latin1");
	const matches = source.match(/\/Type\s*\/Page(?!s)\b/g);
	return matches && matches.length > 0 ? matches.length : null;
}

function extractTextBlocks(bytes: Buffer): PdfTextBlock[] {
	const blocks: PdfTextBlock[] = [];
	let streamIndex = 0;
	let searchOffset = 0;

	while (searchOffset < bytes.length) {
		const streamStart = bytes.indexOf(Buffer.from("stream"), searchOffset);
		if (streamStart < 0) break;
		const contentStart = skipStreamLineBreak(bytes, streamStart + "stream".length);
		const streamEnd = bytes.indexOf(Buffer.from("endstream"), contentStart);
		if (streamEnd < 0) break;

		const rawStream = bytes.subarray(contentStart, streamEnd);
		const dictionary = bytes.subarray(Math.max(0, streamStart - 320), streamStart);
		if (isImageStream(dictionary)) {
			streamIndex += 1;
			searchOffset = streamEnd + "endstream".length;
			continue;
		}

		const decodedStream = decodeStream(rawStream, dictionary);
		const text = isTextContentStream(decodedStream)
			? extractLiteralStrings(decodedStream).join(" ").replace(/\s+/g, " ").trim()
			: "";
		if (text) blocks.push({ streamIndex, text, pageNumber: null });

		streamIndex += 1;
		searchOffset = streamEnd + "endstream".length;
	}

	return blocks;
}

function skipStreamLineBreak(bytes: Buffer, start: number): number {
	if (bytes[start] === 0x0d && bytes[start + 1] === 0x0a) return start + 2;
	if (bytes[start] === 0x0a || bytes[start] === 0x0d) return start + 1;
	return start;
}

function decodeStream(rawStream: Buffer, dictionary: Buffer): Buffer {
	if (!dictionary.toString("latin1").includes("/FlateDecode")) return rawStream;

	for (const inflate of [zlib.inflateSync, zlib.inflateRawSync]) {
		try {
			return inflate(rawStream);
		} catch {
			// Try the other zlib framing before preserving the raw stream.
		}
	}

	return rawStream;
}

function isImageStream(dictionary: Buffer): boolean {
	const source = dictionary.toString("latin1");
	return /\/Subtype\s*\/Image\b|\/DCTDecode\b|\/JPXDecode\b|\/CCITTFaxDecode\b|\/JBIG2Decode\b/.test(source);
}

function isTextContentStream(bytes: Buffer): boolean {
	const source = bytes.toString("latin1");
	return /\bBT\b|\bTj\b|\bTJ\b/.test(source);
}

function extractLiteralStrings(bytes: Buffer): string[] {
	const strings: string[] = [];

	for (let index = 0; index < bytes.length; index += 1) {
		if (bytes[index] !== 0x28) continue;
		const result = readLiteralString(bytes, index);
		if (!result) continue;
		strings.push(result.text);
		index = result.endIndex;
	}

	return strings.filter((value) => /[A-Za-z0-9]/.test(value));
}

function readLiteralString(bytes: Buffer, startIndex: number): { text: string; endIndex: number } | null {
	let depth = 1;
	let escaped = false;
	let text = "";
	const maxStringBytes = 1_000_000;

	for (let index = startIndex + 1; index < bytes.length; index += 1) {
		if (index - startIndex > maxStringBytes) return null;
		const value = bytes[index];

		if (escaped) {
			text += decodeEscape(bytes, value, index);
			if (value >= 0x30 && value <= 0x37) {
				while (index + 1 < bytes.length && index - startIndex < 3 && bytes[index + 1] >= 0x30 && bytes[index + 1] <= 0x37) index += 1;
			}
			escaped = false;
			continue;
		}

		if (value === 0x5c) {
			escaped = true;
			continue;
		}
		if (value === 0x28) {
			depth += 1;
			text += "(";
			continue;
		}
		if (value === 0x29) {
			depth -= 1;
			if (depth === 0) return { text, endIndex: index };
			text += ")";
			continue;
		}

		text += String.fromCharCode(value);
	}

	return null;
}

function decodeEscape(bytes: Buffer, value: number, index: number): string {
	const escapes: Record<number, string> = {
		0x6e: "\n",
		0x72: "\r",
		0x74: "\t",
		0x62: "\b",
		0x66: "\f",
		0x28: "(",
		0x29: ")",
		0x5c: "\\",
	};
	if (escapes[value]) return escapes[value];
	if (value >= 0x30 && value <= 0x37) {
		let octal = String.fromCharCode(value);
		for (let offset = 1; offset < 3 && index + offset < bytes.length; offset += 1) {
			const next = bytes[index + offset];
			if (next < 0x30 || next > 0x37) break;
			octal += String.fromCharCode(next);
		}
		return String.fromCharCode(Number.parseInt(octal, 8));
	}
	return String.fromCharCode(value);
}
