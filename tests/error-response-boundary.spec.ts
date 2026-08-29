import assert from "assert";
import express from "express";
import request from "supertest";
import { createApp } from "../app/create-app";

describe("global error-response boundary", function () {
	this.timeout(15000);

	it("never echoes the underlying error onto the wire for an unexpected failure", async () => {
		const app = express();
		app.get("/boom", () => {
			throw new Error("sensitive global failure");
		});

		const response = await request(createApp({ enableLegacyRoutes: false, app }))
			.get("/boom")
			.expect(500);

		assert.strictEqual(response.body.status, "error");
		assert.strictEqual(response.body.message, "Internal server error");
		assert.strictEqual(response.body.code, 500);
		assert.match(response.body.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		assert.doesNotMatch(JSON.stringify(response.body), /sensitive global failure|stack/i);
	});

	it("returns a generic duplicate-constraint problem without leaking the target field", async () => {
		class PrismaClientKnownRequestError extends Error {
			code = "P2002";
			meta: { target: string[] };

			constructor(message: string, target: string[]) {
				super(message);
				this.name = "PrismaClientKnownRequestError";
				this.meta = { target };
			}
		}

		const app = express();
		app.get("/boom", () => {
			throw new PrismaClientKnownRequestError("Unique constraint failed on the columns", ["email"]);
		});

		const response = await request(createApp({ enableLegacyRoutes: false, app }))
			.get("/boom")
			.expect(409);

		assert.strictEqual(response.body.message, "A record with these details already exists.");
		assert.doesNotMatch(JSON.stringify(response.body), /email|Duplicate value|Unique constraint/i);
	});
});