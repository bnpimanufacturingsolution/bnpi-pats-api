const MALFORMED_REQUEST = "urn:bandai:pats:problem:malformed-request";
const CONFLICT = "urn:bandai:pats:problem:conflict";
const MAXIMUM_KEY_LENGTH = 255;

export interface IdempotencyResponse {
	status: number;
	body: unknown;
	headers: Record<string, string>;
}

export interface IdempotencyRecord extends IdempotencyResponse {
	requestHash: string;
}

export interface IdempotencyScope {
	actorId: string;
	operation: string;
	key: string | undefined;
	requestHash: string;
}

export interface IdempotencyStore {
	reserve(scope: Required<IdempotencyScope>): Promise<
		| { kind: "reserved"; reservation: unknown }
		| { kind: "existing"; record: IdempotencyRecord }
	>;
	persist(reservation: unknown, record: IdempotencyRecord): Promise<void>;
}

export type IdempotencyResult =
	| (IdempotencyResponse & { replayed: boolean })
	| { ok: false; problemType: typeof MALFORMED_REQUEST | typeof CONFLICT; status: 400 | 409 };

function malformedRequest(): IdempotencyResult {
	return { ok: false, problemType: MALFORMED_REQUEST, status: 400 };
}

function conflict(): IdempotencyResult {
	return { ok: false, problemType: CONFLICT, status: 409 };
}

function isValidKey(key: string | undefined): key is string {
	return key !== undefined && key.trim().length > 0 && key.length <= MAXIMUM_KEY_LENGTH;
}

export async function executeIdempotently(
	store: IdempotencyStore,
	scope: IdempotencyScope,
	execute: () => Promise<IdempotencyResponse>,
): Promise<IdempotencyResult> {
	if (!isValidKey(scope.key)) return malformedRequest();

	const normalizedScope: Required<IdempotencyScope> = { ...scope, key: scope.key };
	const reservation = await store.reserve(normalizedScope);
	if (reservation.kind === "existing") {
		if (reservation.record.requestHash !== normalizedScope.requestHash) return conflict();
		const { requestHash: _requestHash, ...response } = reservation.record;
		return { ...response, replayed: true };
	}

	const response = await execute();
	await store.persist(reservation.reservation, { ...response, requestHash: normalizedScope.requestHash });
	return { ...response, replayed: false };
}
