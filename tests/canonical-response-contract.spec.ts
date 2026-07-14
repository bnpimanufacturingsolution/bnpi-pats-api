import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { setDeprecationHeaders, setRateLimitHeaders, type HeaderTarget } from "../app/canonical/response-headers";

class FakeResponse implements HeaderTarget {
	readonly headers = new Map<string, string>();

	setHeader(name: string, value: string): void {
		this.headers.set(name, value);
	}
}

describe("canonical response headers", () => {
	it("sets canonical rate-limit headers from non-negative integer values", () => {
		const response = new FakeResponse();

		setRateLimitHeaders(response, { retryAfter: 30, limit: 100, remaining: 0 });

		assert.deepStrictEqual(Object.fromEntries(response.headers), {
			"Retry-After": "30",
			"X-RateLimit-Limit": "100",
			"X-RateLimit-Remaining": "0",
		});
	});

	it("rejects invalid rate-limit values before emitting headers", () => {
		for (const values of [
			{ retryAfter: -1, limit: 100, remaining: 0 },
			{ retryAfter: 1.5, limit: 100, remaining: 0 },
			{ retryAfter: 1, limit: Number.NaN, remaining: 0 },
			{ retryAfter: 1, limit: 100, remaining: Number.POSITIVE_INFINITY },
		]) {
			const response = new FakeResponse();
			assert.throws(() => setRateLimitHeaders(response, values));
			assert.deepStrictEqual(Object.fromEntries(response.headers), {});
		}
	});

	it("sets exact deprecation and RFC 1123 sunset headers", () => {
		const response = new FakeResponse();

		setDeprecationHeaders(response, new Date("2026-12-31T00:00:00.000Z"));

		assert.deepStrictEqual(Object.fromEntries(response.headers), {
			Deprecation: "true",
			Sunset: "Thu, 31 Dec 2026 00:00:00 GMT",
		});
	});

	it("rejects invalid sunset dates before emitting headers", () => {
		const response = new FakeResponse();

		assert.throws(() => setDeprecationHeaders(response, new Date("not a date")));
		assert.throws(() => setDeprecationHeaders(response, new Date(Date.UTC(10_000, 0, 1))));
		assert.deepStrictEqual(Object.fromEntries(response.headers), {});
	});
});

describe("canonical OpenAPI common components", () => {
	const documentPath = path.resolve(
		__dirname,
		"..",
		"docs/openapi/2026-07-14-pats-api-v1-common-components.yaml",
	);
	const document = parse(fs.readFileSync(documentPath, "utf8")) as Record<string, any>;

	it("declares the canonical OpenAPI 3.1 /api/v1 source contract with no operations", () => {
		assert.strictEqual(document.openapi, "3.1.0");
		assert.deepStrictEqual(document.paths, {});
		assert.ok(document.servers.some((server: { url: string }) => server.url === "/api/v1"));
	});

	it("defines problem details, field errors, and camelCase pagination components", () => {
		const schemas = document.components.schemas;
		for (const name of [
			"ProblemDetails",
			"FieldError",
			"OffsetPagination",
			"CursorPagination",
			"OffsetPaginationEnvelope",
			"CursorPaginationEnvelope",
		]) {
			assert.ok(schemas[name], `missing ${name}`);
		}
		assert.ok(schemas.ProblemDetails.properties.errors);
		assert.deepStrictEqual(Object.keys(schemas.OffsetPagination.properties).sort(), [
			"page",
			"pageSize",
			"totalItems",
			"totalPages",
		]);
		assert.deepStrictEqual(Object.keys(schemas.CursorPagination.properties).sort(), ["hasMore", "nextCursor"]);
	});

	it("defines shared conditional, tracing, idempotency, and response-header components", () => {
		const { headers, parameters } = document.components;
		for (const name of ["IdempotencyKey", "IfMatch", "Traceparent", "Tracestate"]) {
			assert.strictEqual(parameters[name].in, "header");
		}
		for (const name of [
			"ETag",
			"XRequestId",
			"RetryAfter",
			"XRateLimitLimit",
			"XRateLimitRemaining",
			"Deprecation",
			"Sunset",
		]) {
			assert.ok(headers[name], `missing ${name}`);
		}
	});

	it("defines every required stable problem response with RFC 9457 media type", () => {
		const expected = {
			"400": "malformed-request",
			"401": "authentication-required",
			"403": "authorization-denied",
			"404": "not-found",
			"405": "method-not-allowed",
			"406": "not-acceptable",
			"409": "conflict",
			"412": "precondition-failed",
			"413": "payload-too-large",
			"415": "unsupported-media-type",
			"422": "validation-error",
			"429": "rate-limit",
			"500": "internal-error",
			"503": "dependency-unavailable",
		};

		for (const [status, problemType] of Object.entries(expected)) {
			const response = document.components.responses[`Problem${status}`];
			assert.ok(response, `missing ${status} response`);
			assert.ok(response.content["application/problem+json"]);
			assert.strictEqual(
				response.content["application/problem+json"].schema.allOf[1].properties.type.const,
				`urn:bandai:pats:problem:${problemType}`,
			);
		}
	});
});
