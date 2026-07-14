import express, { type NextFunction, type Request, type Response, Router } from "express";

const PROBLEM_TYPES = {
	malformedRequest: "urn:bandai:pats:problem:malformed-request",
	methodNotAllowed: "urn:bandai:pats:problem:method-not-allowed",
	notAcceptable: "urn:bandai:pats:problem:not-acceptable",
	notFound: "urn:bandai:pats:problem:not-found",
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

function setTraceContext(req: Request, res: Response): void {
	const traceparent = req.header("traceparent");
	if (!traceparent || !isValidTraceparent(traceparent)) return;

	res.setHeader("traceparent", traceparent);
	const tracestate = req.header("tracestate");
	if (tracestate) res.setHeader("tracestate", tracestate);
}

function isMalformedJson(error: unknown): boolean {
	return error instanceof SyntaxError && "body" in error;
}

export function canonicalRouter(): Router {
	const router = Router();

	router.use((req: Request, res: Response, next: NextFunction) => {
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
		if (req.method === "GET") {
			res.type("application/json").status(200).json({ status: "healthy" });
			return;
		}

		res.setHeader("Allow", "GET");
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

	router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
		if (!isMalformedJson(error)) {
			next(error);
			return;
		}

		sendProblem(res, {
			type: PROBLEM_TYPES.malformedRequest,
			title: "Bad Request",
			status: 400,
			detail: "The request body contains malformed JSON.",
			instance: requestInstance(req),
		});
	});

	return router;
}
