import assert from "assert";
import {
	buildCursorPage,
	buildOffsetPage,
	parseCursorPagination,
	parseOffsetPagination,
	parseSort,
	type CursorCodec,
} from "../app/canonical/collection";
import { createStrongEtag, validateIfMatch } from "../app/canonical/preconditions";
import {
	executeIdempotently,
	type IdempotencyRecord,
	type IdempotencyStore,
} from "../app/canonical/idempotency";

describe("canonical transport primitives", () => {
	it("parses bounded offset pagination and creates the exact offset envelope", () => {
		assert.deepStrictEqual(parseOffsetPagination({}), { page: 1, limit: 50 });
		assert.deepStrictEqual(parseOffsetPagination({ page: "2", limit: "100" }), { page: 2, limit: 100 });
		assert.deepStrictEqual(buildOffsetPage(["a"], { page: 2, limit: 50 }, 51), {
			data: ["a"],
			pagination: { page: 2, pageSize: 50, totalItems: 51, totalPages: 2 },
		});
	});

	it("rejects malformed, unsupported, and mixed pagination query parameters", () => {
		for (const query of [
			{ page: "1.5" },
			{ page: "0" },
			{ limit: "0" },
			{ limit: "101" },
			{ pageSize: "50" },
			{ page: "1", starting_after: "cursor" },
		]) {
			assert.deepStrictEqual(parseOffsetPagination(query), {
				ok: false,
				problemType: "urn:bandai:pats:problem:malformed-request",
				status: 400,
			});
		}
	});

	it("validates opaque cursor pagination through the injected codec and creates its exact envelope", () => {
		const codec: CursorCodec<string> = { decode: (cursor) => (cursor === "signed-cursor" ? "position" : undefined) };
		assert.deepStrictEqual(parseCursorPagination({ starting_after: "signed-cursor", limit: "3" }, codec), {
			limit: 3,
			startingAfter: "position",
		});
		assert.deepStrictEqual(parseCursorPagination({ starting_after: "unsigned" }, codec), {
			ok: false,
			problemType: "urn:bandai:pats:problem:malformed-request",
			status: 400,
		});
		assert.deepStrictEqual(buildCursorPage(["a"], "next-signed-cursor", true), {
			data: ["a"],
			pagination: { nextCursor: "next-signed-cursor", hasMore: true },
		});
	});

	it("parses documented snake_case sort fields and appends the immutable id tie-breaker", () => {
		assert.deepStrictEqual(parseSort("created_at,-name", ["created_at", "name"]), [
			{ field: "created_at", direction: "asc" },
			{ field: "name", direction: "desc" },
			{ field: "id", direction: "asc" },
		]);
		assert.deepStrictEqual(parseSort("-id", ["name"]), [{ field: "id", direction: "desc" }]);
		assert.deepStrictEqual(parseSort("createdAt", ["created_at"]), {
			ok: false,
			problemType: "urn:bandai:pats:problem:malformed-request",
			status: 400,
		});
	});

	it("creates strong ETags and accepts only exact or wildcard If-Match validators", () => {
		const etag = createStrongEtag("version-42");
		assert.strictEqual(etag, '"version-42"');
		assert.deepStrictEqual(validateIfMatch(etag, etag), { ok: true });
		assert.deepStrictEqual(validateIfMatch("*", etag), { ok: true });
		for (const ifMatch of [undefined, 'W/"version-42"', '"version-41"', '"version-42", "version-41"', "version-42"]) {
			assert.deepStrictEqual(validateIfMatch(ifMatch, etag), {
				ok: false,
				problemType: "urn:bandai:pats:problem:precondition-failed",
				status: 412,
			});
		}
	});

	it("rejects unsafe version tokens", () => {
		assert.throws(() => createStrongEtag('version"42'));
		assert.throws(() => createStrongEtag("version\n42"));
	});

	it("replays stored idempotent responses and conflicts only within the same actor and operation scope", async () => {
		const store = new FakeIdempotencyStore();
		let runs = 0;
		const request = { actorId: "actor-a", operation: "create-batch", key: "key-1", requestHash: "hash-a" };
		const execute = async () => {
			runs += 1;
			return { status: 201, body: { id: "batch-1" }, headers: { location: "/batches/batch-1" } };
		};

		const first = await executeIdempotently(store, request, execute);
		const replay = await executeIdempotently(store, request, execute);
		const differentPayload = await executeIdempotently(store, { ...request, requestHash: "hash-b" }, execute);
		const otherActor = await executeIdempotently(store, { ...request, actorId: "actor-b" }, execute);
		const otherOperation = await executeIdempotently(store, { ...request, operation: "create-stage-event" }, execute);

		assert.deepStrictEqual(first, { status: 201, body: { id: "batch-1" }, headers: { location: "/batches/batch-1" }, replayed: false });
		assert.deepStrictEqual(replay, { status: 201, body: { id: "batch-1" }, headers: { location: "/batches/batch-1" }, replayed: true });
		assert.deepStrictEqual(differentPayload, { ok: false, problemType: "urn:bandai:pats:problem:conflict", status: 409 });
		assert.strictEqual(otherActor.replayed, false);
		assert.strictEqual(otherOperation.replayed, false);
		assert.strictEqual(runs, 3);
	});

	it("rejects missing, blank, and overlong idempotency keys", async () => {
		const store = new FakeIdempotencyStore();
		for (const key of [undefined, "", "   ", "x".repeat(256)]) {
			assert.deepStrictEqual(
				await executeIdempotently(store, { actorId: "actor-a", operation: "create-batch", key, requestHash: "hash-a" }, async () => ({ status: 201, body: {}, headers: {} })),
				{ ok: false, problemType: "urn:bandai:pats:problem:malformed-request", status: 400 },
			);
		}
	});
});

class FakeIdempotencyStore implements IdempotencyStore {
	private readonly records = new Map<string, IdempotencyRecord>();

	async reserve(request: { actorId: string; operation: string; key: string; requestHash: string }) {
		const scopeKey = `${request.actorId}:${request.operation}:${request.key}`;
		const existing = this.records.get(scopeKey);
		if (existing) return { kind: "existing" as const, record: existing };
		return { kind: "reserved" as const, reservation: scopeKey };
	}

	async persist(reservation: string, record: IdempotencyRecord): Promise<void> {
		this.records.set(reservation, record);
	}
}
