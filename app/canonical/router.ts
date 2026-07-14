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

function requestInstance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function sendProblem(res: Response, problem: ProblemDetails): void {
	res.type("application/problem+json").status(problem.status).json(problem);
}

function acceptsCanonicalJson(req: Request): boolean {
	const accept = req.header("Accept");
	if (!accept) return true;

	return accept.split(",").some((entry) => {
		const [mediaType, ...parameters] = entry.trim().toLowerCase().split(";");
		const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
		if (quality && Number(quality.trim().slice(2)) === 0) return false;

		return mediaType === "application/json" || mediaType === "*/*";
	});
}

function isValidTraceparent(value: string): boolean {
	const [version, traceId, parentId, flags, ...extensions] = value.split("-");
	if (
		!version ||
		!traceId ||
		!parentId ||
		!flags ||
		!/^[0-9a-f]{2}$/.test(version) ||
		!/^[0-9a-f]{32}$/.test(traceId) ||
		!/^[0-9a-f]{16}$/.test(parentId) ||
		!/^[0-9a-f]{2}$/.test(flags) ||
		version === "ff" ||
		(version === "00" && extensions.length > 0) ||
		extensions.some((extension) => !/^[0-9a-f]{2,}$/.test(extension))
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
