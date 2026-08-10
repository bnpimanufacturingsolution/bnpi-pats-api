const PRECONDITION_FAILED = "urn:bandai:pats:problem:precondition-failed";
const SAFE_VERSION_TOKEN = /^[!#-~]+$/;
const STRONG_ETAG = /^"[!#-~]*"$/;

export interface PreconditionFailed {
	ok: false;
	problemType: typeof PRECONDITION_FAILED;
	status: 412;
}

function preconditionFailed(): PreconditionFailed {
	return { ok: false, problemType: PRECONDITION_FAILED, status: 412 };
}

export function createStrongEtag(versionToken: string): string {
	if (!SAFE_VERSION_TOKEN.test(versionToken)) {
		throw new TypeError("ETag version tokens must be safe opaque values.");
	}
	return `"${versionToken}"`;
}

export function validateIfMatch(
	ifMatch: string | undefined,
	currentEtag: string,
	allowWildcard = true,
): { ok: true } | PreconditionFailed {
	if (!STRONG_ETAG.test(currentEtag)) return preconditionFailed();
	if (ifMatch === currentEtag || (allowWildcard && ifMatch === "*")) return { ok: true };
	return preconditionFailed();
}
