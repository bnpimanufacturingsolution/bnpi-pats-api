import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { expect } from "chai";
import * as XLSX from "xlsx";
import { patsModule } from "../app/pats";
import type { ObjectStorage } from "../app/storage/object-storage";

describe("PATS workbook intake contract", () => {
	it("analyzes an uploaded workbook without requiring persistence", async () => {
		const app = makeApp();
		const response = await request(app)
			.post("/pats/intake/workbooks/analyze")
			.set("x-workspace-id", "507f1f77bcf86cd799439011")
			.attach("file", workbookBytes(), "B243-reference.xlsx");

		expect(response.status).to.equal(200);
		expect(response.body).to.include({ success: true });
		expect(response.body.data).to.include({ fileName: "B243-reference.xlsx", productCode: "B243" });
		expect(response.body.data.partCodes[0]).to.include({ canonicalCode: "B243-01-01" });
		expect(response.body.report).to.contain("# Intake analysis - B243-reference.xlsx");
	});

	it("rejects missing and unsupported workbook uploads", async () => {
		const app = makeApp();
		const missing = await request(app)
			.post("/pats/intake/workbooks/analyze")
			.set("x-workspace-id", "507f1f77bcf86cd799439011");
		const unsupported = await request(app)
			.post("/pats/intake/workbooks/analyze")
			.set("x-workspace-id", "507f1f77bcf86cd799439011")
			.attach("file", Buffer.from("not a workbook"), "notes.txt");

		expect(missing.status).to.equal(400);
		expect(unsupported.status).to.equal(400);
	});
});

function makeApp() {
	const workspaceAccess = (req: Request, _res: Response, next: NextFunction) => {
		expect(req.headers["x-workspace-id"]).to.equal("507f1f77bcf86cd799439011");
		next();
	};
	const storage: ObjectStorage = {
		putObject: async () => undefined,
		getObject: async () => { throw new Error("not used"); },
		deleteObject: async () => undefined,
		createReadUrl: async () => "https://minio.invalid/read-url",
	};
	const app = express();
	app.use(patsModule({
		patsPrisma: { product: { findFirst: async () => null } } as never,
		objectStorage: storage,
		workspaceAccess,
	}));
	return app;
}

function workbookBytes(): Buffer {
	const sheet = XLSX.utils.aoa_to_sheet([
		["Product Code: B243"],
		["PART NUMBER", "PART NAME"],
		["B243-01-01", "Body"],
	]);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, sheet, "2843315-01");
	return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}
