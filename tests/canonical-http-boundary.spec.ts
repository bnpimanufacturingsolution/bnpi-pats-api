import assert from "assert";
import express from "express";
import request from "supertest";
import { createApp } from "../app/create-app";
import { canonicalRouter } from "../app/canonical/router";

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
		assert.strictEqual(response.headers["x-powered-by"], undefined);
	});

	it("serves process health for HEAD without a response body", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.head("/api/v1/health")
			.expect("Content-Type", /application\/json/)
			.expect(200);

		assert.strictEqual(response.text ?? "", "");
	});

	it("answers browser preflight before the canonical method boundary", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.options("/api/v1/auth/login")
			.set("Origin", "http://localhost:5173")
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "content-type,authorization")
			.expect(204);

		assert.strictEqual(response.headers["access-control-allow-origin"], "http://localhost:5173");
		assert.match(response.headers["access-control-allow-methods"], /POST/);
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

	it("accepts the application wildcard media range for a JSON success response", async () => {
		await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "application/*")
			.expect("Content-Type", /application\/json/)
			.expect(200);
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

	it("rejects Problem Details-only Accept for a successful JSON response", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "application/problem+json")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(406);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:not-acceptable");
		assert.strictEqual(response.body.status, 406);
	});

	it("gives a specific JSON exclusion precedence over a wildcard acceptance", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "application/json;q=0, */*;q=1")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(406);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:not-acceptable");
		assert.strictEqual(response.body.status, 406);
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

	it("does not propagate a traceparent containing uppercase hexadecimal", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "application/json")
			.set("traceparent", "00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01")
			.expect(200);

		assert.strictEqual(response.headers.traceparent, undefined);
	});

	it("propagates valid future-version traceparent extension fields", async () => {
		const traceparent = "01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-a1b2";
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "application/json")
			.set("traceparent", traceparent)
			.expect(200);

		assert.strictEqual(response.headers.traceparent, traceparent);
	});

	it("preserves opaque non-hex fields on a valid future-version traceparent", async () => {
		const traceparent = "01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-opaque-future-extension";
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("Accept", "application/json")
			.set("traceparent", traceparent)
			.expect(200);

		assert.strictEqual(response.headers.traceparent, traceparent);
	});

	it("discards invalid tracestate while preserving a valid traceparent", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("traceparent", validTraceparent)
			.set("tracestate", "bandai")
			.expect(200);

		assert.strictEqual(response.headers.traceparent, validTraceparent);
		assert.strictEqual(response.headers.tracestate, undefined);
	});

	it("discards a tracestate member with an empty value", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("traceparent", validTraceparent)
			.set("tracestate", "bandai=")
			.expect(200);

		assert.strictEqual(response.headers.traceparent, validTraceparent);
		assert.strictEqual(response.headers.tracestate, undefined);
	});

	it("discards a tracestate header with duplicate keys", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("traceparent", validTraceparent)
			.set("tracestate", "bandai=first,bandai=second")
			.expect(200);

		assert.strictEqual(response.headers.traceparent, validTraceparent);
		assert.strictEqual(response.headers.tracestate, undefined);
	});

	it("propagates a valid digit-start multi-tenant tracestate key", async () => {
		const tracestate = "1tenant@system=opaque";
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("traceparent", validTraceparent)
			.set("tracestate", tracestate)
			.expect(200);

		assert.strictEqual(response.headers.tracestate, tracestate);
	});

	it("preserves surrounding OWS and leading opaque value content in valid tracestate", async () => {
		const tracestate = "vendor=first, \ttenant@system= leading opaque value";
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("traceparent", validTraceparent)
			.set("tracestate", tracestate)
			.expect(200);

		assert.strictEqual(response.headers.tracestate, tracestate);
	});

	it("accepts empty and whitespace-only tracestate list members", async () => {
		const tracestate = "vendor=opaque,, \t,other=value";
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.get("/api/v1/health")
			.set("traceparent", validTraceparent)
			.set("tracestate", tracestate)
			.expect(200);

		assert.strictEqual(response.headers.tracestate, tracestate);
	});

	it("returns a canonical method-not-allowed problem and Allow header", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.post("/api/v1/health")
			.expect("Content-Type", /application\/problem\+json/)
			.expect("Allow", "GET, HEAD")
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

	it("returns a canonical payload-too-large problem for oversized JSON", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.post("/api/v1/health")
			.send({ payload: "x".repeat(1024 * 1024) })
			.expect("Content-Type", /application\/problem\+json/)
			.expect(413);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:payload-too-large");
		assert.strictEqual(response.body.instance, "/api/v1/health");
	});

	it("returns a canonical unsupported-media-type problem for an unsupported JSON charset", async () => {
		const response = await request(createApp({ enableLegacyRoutes: false }))
			.post("/api/v1/health")
			.set("Content-Type", "application/json; charset=madeup")
			.send('{"status":"healthy"}')
			.expect("Content-Type", /application\/problem\+json/)
			.expect(415);

		assert.strictEqual(response.body.type, "urn:bandai:pats:problem:unsupported-media-type");
		assert.strictEqual(response.body.instance, "/api/v1/health");
	});

	it("returns a generic canonical internal-error problem for unexpected handler failures", async () => {
		const app = express();
		app.use("/api/v1", canonicalRouter({ healthHandler: () => { throw new Error("sensitive test failure"); } }));

		const response = await request(app)
			.get("/api/v1/health")
			.expect("Content-Type", /application\/problem\+json/)
			.expect(500);

		assert.deepStrictEqual(response.body, {
			type: "urn:bandai:pats:problem:internal-error",
			title: "Internal Server Error",
			status: 500,
			detail: "An unexpected canonical error occurred.",
			instance: "/api/v1/health",
		});
		assert.doesNotMatch(JSON.stringify(response.body), /sensitive test failure|stack/i);
	});
});
