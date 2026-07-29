import { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import type { IdempotencyRecord, IdempotencyScope, IdempotencyStore } from "./idempotency";

type IdempotencyDatabase = Pick<PatsPrismaClient, "catalogIdempotencyRecord">;

function isUniqueConstraint(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function responseHeaders(value: unknown): Record<string, string> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const entries = Object.entries(value);
	if (!entries.every(([, item]) => typeof item === "string")) return null;
	return Object.fromEntries(entries) as Record<string, string>;
}

/**
 * PostgreSQL-backed idempotency claims. A unique claim is inserted before the business write;
 * incomplete claims make concurrent reuse a conflict and are released when the business write
 * fails. The catalog routers may inject this store without changing their contract behavior.
 */
export class PrismaCatalogIdempotencyStore implements IdempotencyStore {
	public constructor(private readonly database: IdempotencyDatabase) {}

	public async reserve(
		scope: Required<IdempotencyScope>,
	): Promise<
		| { kind: "reserved"; reservation: string }
		| { kind: "existing"; record: IdempotencyRecord }
		| { kind: "pending" }
		| { kind: "conflict" }
	> {
		const idempotencyKey = scope.key as string;
		try {
			const created = await this.database.catalogIdempotencyRecord.create({
				data: {
					actorId: scope.actorId,
					operation: scope.operation,
					idempotencyKey,
					requestHash: scope.requestHash,
				},
			});
			return { kind: "reserved", reservation: created.id };
		} catch (error) {
			if (!isUniqueConstraint(error)) throw error;
		}

		const existing = await this.database.catalogIdempotencyRecord.findUnique({
			where: {
				actorId_operation_idempotencyKey: {
					actorId: scope.actorId,
					operation: scope.operation,
					idempotencyKey,
				},
			},
		});
		if (!existing || existing.requestHash !== scope.requestHash) return { kind: "conflict" };
		if (
			existing.status === null ||
			existing.responseBody === null ||
			existing.responseHeaders === null
		) {
			return { kind: "pending" };
		}

		const headers = responseHeaders(existing.responseHeaders);
		if (!headers) return { kind: "pending" };
		return {
			kind: "existing",
			record: {
				status: existing.status,
				body: existing.responseBody,
				headers,
				requestHash: existing.requestHash,
			},
		};
	}

	public async persist(reservation: unknown, record: IdempotencyRecord): Promise<void> {
		await this.database.catalogIdempotencyRecord.update({
			where: { id: String(reservation) },
			data: {
				status: record.status,
				responseBody: record.body as never,
				responseHeaders: record.headers as never,
				completedAt: new Date(),
			},
		});
	}

	public async release(reservation: unknown): Promise<void> {
		await this.database.catalogIdempotencyRecord.delete({ where: { id: String(reservation) } });
	}
}
