import assert from "assert";
import * as XLSX from "xlsx";
import {
	analyzeWorkbook,
	formatWorkbookReport,
	type WorkbookInput,
} from "../app/intake/workbook-analyzer";

describe("workbook intake analyzer", () => {
	it("normalizes spaced decoration codes and retains source evidence", () => {
		const input = workbookInput("B250 SHIMAJIROU MEJIRUSHI ACCESSORY.xlsx", [[
			"SUMMARY",
		], [
			"Model #", "Model Name", "Parts #", "Parts Name", "PMRS QTY JAPAN",
		], [
			1, "SHIMAJIRO", "B250 - 01 - 01", "BODY", 62421,
		], [
			"", "", "B250 - 01 - 02", "FEET", 62421,
		]]);

		const analysis = analyzeWorkbook(input);

		assert.strictEqual(analysis.productCode, "B250");
		assert.deepStrictEqual(analysis.partCodes.map((part) => part.canonicalCode), ["B250-01-01", "B250-01-02"]);
		assert.deepStrictEqual(analysis.partCodes.map((part) => part.status), ["CONFIRMED", "CONFIRMED"]);
		assert.strictEqual(analysis.metrics.nonEmptyCells, 16);
	});

	it("infers a duplicate-mold prefix correction while preserving the raw B224 code", () => {
		const input = workbookInput("B243 Sanrio Characters Fruits Mejirushi Accessory.xlsx", [
			["Product Code: B243"],
			["PART NUMBER", "PART NAME", "Formula"],
			["B243-01-02", "Hello Kitty Stem", "='[2]2843315-01'!$BY$30"],
			["B243-01-01A", "Hello Kitty Head duplicate", "=A3"],
			["B224-01-02A", "Hello Kitty Stem duplicate", "=A4"],
		]);

		const analysis = analyzeWorkbook(input);
		const correction = analysis.partCodes.find((part) => part.rawCode === "B224-01-02A");

		assert.ok(correction);
		assert.deepStrictEqual(correction, {
			rawCode: "B224-01-02A",
			canonicalCode: "B243-01-02A",
			status: "SOURCE_ANOMALY",
			occurrences: [{ sheet: "Sheet1", address: "A5" }],
			reason: "Duplicate/variant code follows the product sequence, but the source prefix differs; raw value is retained.",
		});
		assert.ok(analysis.issues.some((issue) => issue.code === "SOURCE_PREFIX_MISMATCH" && issue.canonicalValue === "B243-01-02A"));
		assert.ok(analysis.issues.some((issue) => issue.code === "UNAVAILABLE_DEPENDENCY"));
	});

	it("keeps unresolved prefix mismatches out of automatic canonical publication", () => {
		const input = workbookInput("B308 workbook.xlsx", [
			["Product Code: B308"],
			["B224-01-01", "Unrelated source code"],
		]);

		const analysis = analyzeWorkbook(input);
		const mismatch = analysis.partCodes[0];

		assert.strictEqual(mismatch.canonicalCode, "B224-01-01");
		assert.strictEqual(mismatch.status, "NEEDS_REVIEW");
		assert.strictEqual(analysis.issues[0]?.code, "SOURCE_PREFIX_MISMATCH");
	});

	it("renders a report that exposes metrics, crosswalks, and issues", () => {
		const analysis = analyzeWorkbook(workbookInput("B308 workbook.xlsx", [["Product Code: B308"], ["B308-01-01", "BODY"]]));
		const report = formatWorkbookReport(analysis);

		assert.match(report, /# Intake analysis - B308 workbook\.xlsx/);
		assert.match(report, /\| B308-01-01 \| B308-01-01 \| CONFIRMED \|/);
		assert.match(report, /## Issues/);
	});
});

function workbookInput(fileName: string, rows: unknown[][]): WorkbookInput {
	const sheet = XLSX.utils.aoa_to_sheet(rows);
	for (let row = 0; row < rows.length; row += 1) {
		for (let column = 0; column < rows[row].length; column += 1) {
			const value = rows[row][column];
			if (typeof value !== "string" || !value.startsWith("=")) continue;
			const address = XLSX.utils.encode_cell({ r: row, c: column });
			sheet[address] = { t: "n", f: value.slice(1), v: 0 };
		}
	}
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
	return {
		fileName,
		bytes: XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
	};
}
