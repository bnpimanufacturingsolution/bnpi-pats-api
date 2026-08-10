export interface HeaderTarget {
	setHeader(name: string, value: string): void;
}

export interface RateLimitValues {
	retryAfter: number;
	limit: number;
	remaining: number;
}

const IMF_FIXDATE = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

function assertNonNegativeInteger(value: number, name: string): void {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new TypeError(`${name} must be a non-negative safe integer.`);
	}
}

export function setRateLimitHeaders(target: HeaderTarget, values: RateLimitValues): void {
	assertNonNegativeInteger(values.retryAfter, "retryAfter");
	assertNonNegativeInteger(values.limit, "limit");
	assertNonNegativeInteger(values.remaining, "remaining");

	target.setHeader("Retry-After", String(values.retryAfter));
	target.setHeader("X-RateLimit-Limit", String(values.limit));
	target.setHeader("X-RateLimit-Remaining", String(values.remaining));
}

export function setDeprecationHeaders(target: HeaderTarget, sunset: Date): void {
	if (Number.isNaN(sunset.getTime())) {
		throw new TypeError("Sunset must be a valid date.");
	}
	const sunsetHeader = sunset.toUTCString();
	if (!IMF_FIXDATE.test(sunsetHeader)) {
		throw new TypeError("Sunset must be representable as an HTTP-date.");
	}

	target.setHeader("Deprecation", "true");
	target.setHeader("Sunset", sunsetHeader);
}
