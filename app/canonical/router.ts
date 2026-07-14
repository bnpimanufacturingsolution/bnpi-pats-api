import express, { type NextFunction, type Request, type Response, Router } from "express";

const PROBLEM_TYPES = {
	internalError: "urn:bandai:pats:problem:internal-error",
	malformedRequest: "urn:bandai:pats:problem:malformed-request",
	methodNotAllowed: "urn:bandai:pats:problem:method-not-allowed",
	notAcceptable: "urn:bandai:pats:problem:not-acceptable",
	notFound: "urn:bandai:pats:problem:not-found",
	payloadTooLarge: "urn:bandai:pats:problem:payload-too-large",
	unsupportedMediaType: "urn:bandai:pats:problem:unsupported-media-type",
} as const;

interface ProblemDetails {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance: string;
}

interface AcceptMediaRange {
	specificity: number;
	quality: number;
}

export interface CanonicalRouterOptions {
	/** Internal composition seam for deterministic canonical error-boundary tests. */
	healthHandler?: (req: Request, res: Response) => void;
}

function requestInstance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function sendProblem(res: Response, problem: ProblemDetails): void {
	res.type("application/problem+json").status(problem.status).json(problem);
}

function acceptsCanonicalJson(req: Request): boolean {
	const accept = req.header("Accept");
	if (!accept) return true;

	const matchingRanges = accept.split(",").reduce<AcceptMediaRange[]>((ranges, entry) => {
		const [mediaType, ...parameters] = entry.trim().toLowerCase().split(";");
		const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
		const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
		if (!Number.isFinite(quality) || quality < 0 || quality > 1) return ranges;

		if (mediaType === "application/json") ranges.push({ specificity: 2, quality });
		if (mediaType === "application/*") ranges.push({ specificity: 1, quality });
		if (mediaType === "*/*") ranges.push({ specificity: 0, quality });
		return ranges;
	}, []);

	if (matchingRanges.length === 0) return false;
	const highestSpecificity = Math.max(...matchingRanges.map((range) => range.specificity));
	return matchingRanges.find((range) => range.specificity === highestSpecificity)?.quality !== 0;
}

function isValidTraceparent(value: string): boolean {
	const match = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(.*)$/.exec(value);
	if (!match) return false;

	const [, version, traceId, parentId, flags, suffix] = match;
	if (
		version === "ff" ||
		(version === "00" && suffix !== "") ||
		(suffix !== "" && !suffix.startsWith("-"))
	) {
		return false;
	}

	return !/^0+$/.test(traceId) && !/^0+$/.test(parentId);
}

function isValidTracestate(value: string): boolean {
	if (value.length > 512) return false;

	const members = value.split(",");
	if (members.length === 0 || members.length > 32) return false;

	return members.every((member) => {
		const listMember = member.trim();
		const separator = listMember.indexOf("=");
		if (separator < 1) return false;

		const key = listMember.slice(0, separator);
		const memberValue = listMember.slice(separator + 1);
		return (
			/^[a-z][a-z0-9_*/-]{0,255}(?:@[a-z][a-z0-9_*/-]{0,240})?$/.test(key) &&
			/^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,256}$/.test(memberValue) &&
			memberValue.trim() === memberValue
		);
	});
}

function setTraceContext(req: Request, res: Response): void {
	const traceparent = req.header("traceparent");
	if (!traceparent || !isValidTraceparent(traceparent)) return;

	res.setHeader("traceparent", traceparent);
	const tracestate = req.header("tracestate");
	if (tracestate && isValidTracestate(tracestate)) res.setHeader("tracestate", tracestate);
}

function isMalformedJson(error: unknown): boolean {
	return error instanceof SyntaxError && "body" in error;
}

function hasErrorType(error: unknown, expectedTypes: readonly string[]): boolean {
	if (!error || typeof error !== "object" || !("type" in error)) return false;
	const errorType = (error as { type?: unknown }).type;
	return typeof errorType === "string" && expectedTypes.includes(errorType);
}

function sendCanonicalError(error: unknown, req: Request, res: Response): void {
	if (isMalformedJson(error)) {
		sendProblem(res, {
			type: PROBLEM_TYPES.malformedRequest,
			title: "Bad Request",
			status: 400,
			detail: "The request body contains malformed JSON.",
			instance: requestInstance(req),
		});
		return;
	}

	if (hasErrorType(error, ["entity.too.large"])) {
		sendProblem(res, {
			type: PROBLEM_TYPES.payloadTooLarge,
			title: "Payload Too Large",
			status: 413,
			detail: "The request payload exceeds the canonical size limit.",
			instance: requestInstance(req),
		});
		return;
	}

	if (hasErrorType(error, ["charset.unsupported", "encoding.unsupported", "unsupported.media.type", "unsupported_media_type"])) {
		sendProblem(res, {
			type: PROBLEM_TYPES.unsupportedMediaType,
			title: "Unsupported Media Type",
			status: 415,
			detail: "The request media type, charset, or encoding is not supported.",
			instance: requestInstance(req),
		});
		return;
	}

	sendProblem(res, {
		type: PROBLEM_TYPES.internalError,
		title: "Internal Server Error",
		status: 500,
		detail: "An unexpected canonical error occurred.",
		instance: requestInstance(req),
	});
}

export function canonicalRouter(options: CanonicalRouterOptions = {}): Router {
	const router = Router();
	const healthHandler = options.healthHandler ?? ((_req: Request, res: Response) => {
		res.type("application/json").status(200).json({ status: "healthy" });
	});

	router.use((req: Request, res: Response, next: NextFunction) => {
		res.removeHeader("X-Powered-By");
		setTraceContext(req, res);

		if (!acceptsCanonicalJson(req)) {
			sendProblem(res, {
				type: PROBLEM_TYPES.notAcceptable,
				title: "Not Acceptable",
				status: 406,
				detail: "The requested response media type is not supported.",
				instance: requestInstance(req),
			});
			return;
		}

		if (
			!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
			req.header("Content-Type") &&
			!req.is("application/json")
		) {
			sendProblem(res, {
				type: PROBLEM_TYPES.unsupportedMediaType,
				title: "Unsupported Media Type",
				status: 415,
				detail: "Canonical JSON requests require Content-Type: application/json.",
				instance: requestInstance(req),
			});
			return;
		}

		next();
	});

	router.use(express.json());

	router.all("/health", (req: Request, res: Response) => {
		if (["GET", "HEAD"].includes(req.method)) {
			healthHandler(req, res);
			return;
		}

		res.setHeader("Allow", "GET, HEAD");
		sendProblem(res, {
			type: PROBLEM_TYPES.methodNotAllowed,
			title: "Method Not Allowed",
			status: 405,
			detail: "The requested method is not supported for this canonical route.",
			instance: requestInstance(req),
		});
	});

	router.use((req: Request, res: Response) => {
		sendProblem(res, {
			type: PROBLEM_TYPES.notFound,
			title: "Not Found",
			status: 404,
			detail: "The requested canonical route was not found.",
			instance: requestInstance(req),
		});
	});

	router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
		sendCanonicalError(error, req, res);
	});

	return router;
}
