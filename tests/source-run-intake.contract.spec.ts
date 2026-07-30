import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { expect } from "chai";
import * as XLSX from "xlsx";
import { patsModule } from "../app/pats";
import type { ObjectStorage } from "../app/storage/object-storage";

describe("PATS source-run intake contract", () => {
	it("persists workbook and PDF analysis, hashes, reports, and issue records", async () => {
		const calls = makePersistenceDouble();
		const response = await request(makeApp(calls))
			.post("/pats/intake/runs")
			.set("x-workspace-id", WORKSPACE_ID)
			.field("sourceLabel", "Drive 07/28")
			.attach("files", workbookBytes(), "B243-reference.xlsx")
			.attach("files", readablePdf(), "B243-evidence.pdf");

		expect(response.status).to.equal(201);
		expect(response.body.data).to.include({ sourceRunId: "run-1", status: "PARTIAL" });
		expect(response.body.data.artifacts).to.have.length(2);
		expect(calls.runCreate.data).to.include({ workspaceId: WORKSPACE_ID, sourceLabel: "Drive 07/28", status: "RUNNING" });
		expect(calls.artifactCreates).to.have.length(2);
		expect(calls.artifactCreates[0].data.sha256).to.match(/^[a-f0-9]{64}$/);
		expect(calls.artifactCreates[0].data.analysis).to.have.property("productCode", "B243");
		expect(calls.artifactCreates[1].data.reportMarkdown).to.contain("PDF evidence analysis");
		expect(calls.runUpdate.data).to.include({ status: "PARTIAL" });
	});

	it("reads a source run only within the supplied workspace", async () => {
		const calls = makePersistenceDouble();
		const response = await request(makeApp(calls))
			.get("/pats/intake/runs/run-1")
			.set("x-workspace-id", WORKSPACE_ID);

		expect(response.status).to.equal(200);
		expect(response.body.data).to.deep.include({ id: "run-1", workspaceId: WORKSPACE_ID });
		expect(calls.runFindFirst.where).to.deep.equal({ id: "run-1", workspaceId: WORKSPACE_ID });
	});

	it("rejects a run without files before creating persistence records", async () => {
		const calls = makePersistenceDouble();
		const response = await request(makeApp(calls))
			.post("/pats/intake/runs")
			.set("x-workspace-id", WORKSPACE_ID)
			.field("sourceLabel", "Empty run");

		expect(response.status).to.equal(400);
		expect(calls.runCreate).to.equal(null);
	});
});

const WORKSPACE_ID = "507f1f77bcf86cd799439011";

function makeApp(calls: ReturnType<typeof makePersistenceDouble>) {
	const workspaceAccess = (req: Request, _res: Response, next: NextFunction) => {
		expect(req.headers["x-workspace-id"]).to.equal(WORKSPACE_ID);
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
		patsPrisma: {
			product: { findFirst: async () => null },
			sourceRun: calls.sourceRun,
			sourceArtifact: calls.sourceArtifact,
		} as never,
		objectStorage: storage,
		workspaceAccess,
	}));
	return app;
}

function makePersistenceDouble() {
	const calls = {
		runCreate: null as { data: Record<string, unknown> } | null,
		runUpdate: null as { data: Record<string, unknown> } | null,
		runFindFirst: { where: null as Record<string, unknown> | null },
		artifactCreates: [] as Array<{ data: Record<string, any> }>,
	};
	const sourceRun = {
		create: async ({ data }: { data: Record<string, unknown> }) => {
			calls.runCreate = { data };
			return { id: "run-1" };
		},
		update: async ({ data }: { data: Record<string, unknown> }) => {
			calls.runUpdate = { data };
			return { id: "run-1" };
		},
		findFirst: async ({ where }: { where: Record<string, unknown> }) => {
			calls.runFindFirst.where = where;
			return {
				id: "run-1",
				workspaceId: WORKSPACE_ID,
				sourceLabel: "Drive 07/28",
				status: "PARTIAL",
				artifacts: [],
			};
		},
	};
	const sourceArtifact = {
		create: async ({ data }: { data: Record<string, any> }) => {
			calls.artifactCreates.push({ data });
			return { id: `artifact-${calls.artifactCreates.length}` };
		},
	};
	return Object.assign(calls, { sourceRun, sourceArtifact });
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
