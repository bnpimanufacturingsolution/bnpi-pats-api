const MALFORMED_REQUEST = "urn:bandai:pats:problem:malformed-request";

export interface TransportProblem {
	ok: false;
	problemType: typeof MALFORMED_REQUEST;
	status: 400;
}

export interface OffsetPagination {
	page: number;
	limit: number;
}

export interface CursorPagination<TCursor> {
	startingAfter?: TCursor;
	limit: number;
}

export interface CursorCodec<TCursor> {
	decode(cursor: string): TCursor | undefined;
}

export interface SortField {
	field: string;
	direction: "asc" | "desc";
}

type QueryValue = string | string[] | undefined;
type PaginationQuery = Record<string, QueryValue>;

function malformedRequest(): TransportProblem {
	return { ok: false, problemType: MALFORMED_REQUEST, status: 400 };
}

function hasOnlyKeys(query: PaginationQuery, allowedKeys: readonly string[]): boolean {
	return Object.keys(query).every((key) => allowedKeys.includes(key));
}

function parseBoundedInteger(value: QueryValue | undefined, defaultValue: number): number | undefined {
	if (value === undefined) return defaultValue;
	if (Array.isArray(value) || !/^[0-9]+$/.test(value)) return undefined;

	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseOffsetPagination(query: PaginationQuery): OffsetPagination | TransportProblem {
	if (!hasOnlyKeys(query, ["page", "limit"])) return malformedRequest();

	const page = parseBoundedInteger(query.page, 1);
	const limit = parseBoundedInteger(query.limit, 50);
	if (page === undefined || limit === undefined || page < 1 || limit < 1 || limit > 100) {
		return malformedRequest();
	}

	return { page, limit };
}

export function parseCursorPagination<TCursor>(
	query: PaginationQuery,
	codec: CursorCodec<TCursor>,
): CursorPagination<TCursor> | TransportProblem {
	if (!hasOnlyKeys(query, ["starting_after", "limit"])) return malformedRequest();

	const limit = parseBoundedInteger(query.limit, 50);
	if (limit === undefined || limit < 1 || limit > 100) return malformedRequest();
	if (query.starting_after === undefined) return { limit };
	if (Array.isArray(query.starting_after) || query.starting_after.length === 0) return malformedRequest();

	try {
		const startingAfter = codec.decode(query.starting_after);
		return startingAfter === undefined ? malformedRequest() : { limit, startingAfter };
	} catch {
		return malformedRequest();
	}
}

export function buildOffsetPage<T>(
	data: T[],
	pagination: OffsetPagination,
	totalItems: number,
): { data: T[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } } {
	return {
		data,
		pagination: {
			page: pagination.page,
			pageSize: pagination.limit,
			totalItems,
			totalPages: Math.ceil(totalItems / pagination.limit),
		},
	};
}

export function buildCursorPage<T>(
	data: T[],
	nextCursor: string | null,
	hasMore: boolean,
): { data: T[]; pagination: { nextCursor: string | null; hasMore: boolean } } {
	return { data, pagination: { nextCursor, hasMore } };
}

export function parseSort(sort: string | undefined, documentedFields: readonly string[]): SortField[] | TransportProblem {
	if (sort === undefined || sort === "") return [{ field: "id", direction: "asc" }];

	const fields: SortField[] = [];
	for (const entry of sort.split(",")) {
		if (entry.length === 0) return malformedRequest();
		const descending = entry.startsWith("-");
		const field = descending ? entry.slice(1) : entry;
		if (field.length === 0 || (field !== "id" && !documentedFields.includes(field))) {
			return malformedRequest();
		}
		fields.push({ field, direction: descending ? "desc" : "asc" });
	}

	if (!fields.some(({ field }) => field === "id")) fields.push({ field: "id", direction: "asc" });
	return fields;
}
