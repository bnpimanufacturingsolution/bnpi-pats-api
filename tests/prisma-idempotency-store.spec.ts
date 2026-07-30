import { expect } from "chai";
import { executeIdempotently } from "../app/canonical/idempotency";
import { PrismaCatalogIdempotencyStore } from "../app/canonical/prisma-idempotency-store";

function database() {
	const records = new Map<string, Record<string, any>>();
	let nextId = 1;
	const keyFor = (value: { actorId: string; operation: string; idempotencyKey: string }) =>
		`${value.actorId}:${value.operation}:${value.idempotencyKey}`;
	const db = {
		catalogIdempotencyRecord: {
			create: async ({ data }: { data: Record<string, any> }) => {
				const key = keyFor(
					data as { actorId: string; operation: string; idempotencyKey: string },
				);
				if (records.has(key)) {
					const error = Object.assign(new Error("duplicate"), { code: "P2002" });
					throw error;
				}
				const created = {
					id: `idempotency-${nextId++}`,
					...data,
					status: null,
					responseBody: null,
					responseHeaders: null,
					completedAt: null,
				};
				records.set(key, created);
				return created;
			},
			findUnique: async ({
				where,
			}: {
				where: {
					actorId_operation_idempotencyKey: {
						actorId: string;
						operation: string;
						idempotencyKey: string;
					};
				};
			}) => records.get(keyFor(where.actorId_operation_idempotencyKey)) ?? null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, any>;
			}) => {
				const record = [...records.values()].find((candidate) => candidate.id === where.id);
				if (!record) throw new Error("missing record");
				Object.assign(record, data);
				return record;
			},
			delete: async ({ where }: { where: { id: string } }) => {
				for (const [key, record] of records.entries()) {
					if (record.id === where.id) records.delete(key);
				}
				return { id: where.id };
			},
		},
	};
	return { db, records };
}

describe("Prisma catalog idempotency store", () => {
	it("claims atomically, replays completed responses, and conflicts on a different payload", async () => {
		const { db } = database();
		const store = new PrismaCatalogIdempotencyStore(db as never);
		const scope = {
			actorId: "subject-1",
			operation: "catalogProductCreate",
			key: "retry-1",
			requestHash: "hash-a",
		};

		const reservation = await store.reserve(scope);
		expect(reservation.kind).to.equal("reserved");
		if (reservation.kind !== "reserved") return;
		await store.persist(reservation.reservation, {
			status: 201,
			body: { id: "product-1" },
			headers: { ETag: '"1"' },
			requestHash: "hash-a",
		});

		const replay = await store.reserve(scope);
		expect(replay.kind).to.equal("existing");
		if (replay.kind === "existing") {
			expect(replay.record.body).to.deep.equal({ id: "product-1" });
			expect(replay.record.headers).to.deep.equal({ ETag: '"1"' });
		}

		const conflict = await store.reserve({ ...scope, requestHash: "hash-b" });
		expect(conflict.kind).to.equal("conflict");
	});

	it("marks concurrent reuse pending and releases failed claims", async () => {
		const { db, records } = database();
		const store = new PrismaCatalogIdempotencyStore(db as never);
		const scope = {
			actorId: "subject-1",
			operation: "catalogModelCreate",
			key: "retry-2",
			requestHash: "hash-a",
		};
		const reservation = await store.reserve(scope);
		expect(reservation.kind).to.equal("reserved");
		const pending = await store.reserve(scope);
		expect(pending.kind).to.equal("pending");

		const result = await executeIdempotently(store, scope, async () => {
			throw new Error("business write failed");
		});
		// The pending claim is surfaced as a retry conflict; the original holder owns cleanup.
		expect(result).to.deep.equal({
			ok: false,
			problemType: "urn:bandai:pats:problem:conflict",
			status: 409,
		});

		if (reservation.kind === "reserved") await store.release(reservation.reservation);
		expect(records.size).to.equal(0);
	});
});
