import { expect } from "chai";
import { analyzePdf, formatPdfReport } from "../app/intake/pdf-analyzer";

describe("PDF evidence analyzer", () => {
	it("extracts readable literal text and product code while preserving location limits", () => {
		const analysis = analyzePdf({ fileName: "B243-evidence.pdf", bytes: readablePdf() });

		expect(analysis.pageCount).to.equal(1);
		expect(analysis.productCode).to.equal("B243");
		expect(analysis.text).to.contain("B243 PDF evidence");
		expect(analysis.issues.map((issue) => issue.code)).to.include("PDF_TEXT_LOCATION_UNRESOLVED");
		expect(analysis.issues.map((issue) => issue.code)).to.not.include("PDF_TEXT_UNAVAILABLE");
		expect(formatPdfReport(analysis)).to.contain("# PDF evidence analysis - B243-evidence.pdf");
	});

	it("marks image-only or structurally incomplete evidence as unresolved", () => {
		const analysis = analyzePdf({ fileName: "scan.pdf", bytes: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF") });

		expect(analysis.pageCount).to.equal(1);
		expect(analysis.text).to.equal("");
		expect(analysis.issues).to.deep.include({
			code: "PDF_TEXT_UNAVAILABLE",
			status: "UNAVAILABLE_DEPENDENCY",
			severity: "WARNING",
			message: "No readable text was extracted; the document may be image-only or use unsupported encoding.",
		});
	});

	it("does not mistake image stream bytes for extracted text", () => {
		const analysis = analyzePdf({
			fileName: "embedded-image.pdf",
			bytes: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Subtype /Image /Filter /DCTDecode >>\nstream\n(B243 false text bytes)\nendstream\nendobj\n%%EOF"),
		});

		expect(analysis.text).to.equal("");
		expect(analysis.issues.map((issue) => issue.code)).to.include("PDF_TEXT_UNAVAILABLE");
	});
});

function readablePdf(): Buffer {
	return Buffer.from([
		"%PDF-1.4",
		"1 0 obj",
		"<< /Type /Page >>",
		"endobj",
		"2 0 obj",
		"stream",
		"BT",
		"(B243 PDF evidence) Tj",
		"ET",
		"endstream",
		"endobj",
		"%%EOF",
	].join("\n"));
}
