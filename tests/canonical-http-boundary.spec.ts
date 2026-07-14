import assert from "assert";
import request from "supertest";
import { createApp } from "../app/create-app";

const validTraceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const validTracestate = "bandai=pats";

describe("canonical HTTP boundary", function () {
	this.timeout(15000);

	it("serves public process health as canonical JSON without infrastructure detail", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.expect("Content-Type", /application\/json/)
			.expect(200);

		assert.deepStrictEqual(response.body, { status: "healthy" });
	});

	it("accepts application/json and propagates request correlation and valid trace context", async () => {
		const requestId = "d54a0aa9-5259-4d24-9fec-3b3a1e98f77c";
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "application/json")
			.set("X-Request-ID", requestId)
			.set("traceparent", validTraceparent)
			.set("tracestate", validTracestate)
			.expect(200);

		assert.strictEqual(response.headers["x-request-id"], requestId);
		assert.strictEqual(response.headers.traceparent, validTraceparent);
		assert.strictEqual(response.headers.tracestate, validTracestate);
	});

	it("returns a canonical not-acceptable problem for an unsupported Accept header", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "text/html")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(406);

		assert.deepStrictEqual(response.body, {
			type: "urn:bandai:pats:problem:not-acceptable",
			title: "Not Acceptable",
			status: 406,
			detail: "The requested response media type is not supported.",
			instance: "/api/v1/health",
		});
	});

	it("returns canonical problem details for an unmatched route", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/not-a-route")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(404);

		assert.deepStrictEqual(response.body, {
			type: "urn:bandai:pats:problem:not-found",
			title: "Not Found",
			status: 404,
			detail: "The requested canonical route was not found.",
			instance: "/api/v1/not-a-route",
		});
	});

	it("returns a canonical method-not-allowed problem and Allow header", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.post("/api/v1/health")
			.expect("Content-Type", /application\/problem\+json/)
			.expect("Allow", "GET")
			.expect(405);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:method-not-allowed");
		assert.strictEqual(response.body.status, 405);
		assert.strictEqual(response.body.instance, "/api/v1/health");
	});

	it("returns a canonical unsupported-media-type problem before method handling", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.post("/api/v1/health")
			.set("Content-Type", "text/plain")
			.send("not-json")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(415);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:unsupported-media-type");
		assert.strictEqual(response.body.status, 415);
		assert.strictEqual(response.body.instance, "/api/v1/health");
	});

	it("returns a canonical malformed-request problem for malformed JSON", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.post("/api/v1/health")
			.set("Content-Type", "application/json")
			.send('{"broken":')
			.expect("Content-Type", /application\/problem\+json/)
			.expect(400);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:malformed-request");
		assert.strictEqual(response.body.status, 400);
		assert.strictEqual(response.body.instance, "/api/v1/health");
	});
});
