import express, {
	type NextFunction,
	type Request,
	type RequestHandler,
	type Response,
	Router,
} from "express";
import { rateLimit } from "express-rate-limit";
import {
	IdentityProviderUnavailableError,
	type IdentityDependencies,
	type SubjectAssignmentRecord,
	type SubjectRecord,
} from "../identity/types";
import type { LocalAuthDependencies } from "../identity/local-auth";
import { effectiveCapabilities } from "../identity/policy";
import { hasCapability } from "../identity/policy";

const PROBLEM_TYPES = {
	internalError: "urn:bandai:pats:problem:internal-error",
	malformedRequest: "urn:bandai:pats:problem:malformed-request",
	methodNotAllowed: "urn:bandai:pats:problem:method-not-allowed",
	notAcceptable: "urn:bandai:pats:problem:not-acceptable",
	notFound: "urn:bandai:pats:problem:not-found",
	payloadTooLarge: "urn:bandai:pats:problem:payload-too-large",
	authenticationRequired: "urn:bandai:pats:problem:authentication-required",
	authorizationDenied: "urn:bandai:pats:problem:authorization-denied",
	dependencyUnavailable: "urn:bandai:pats:problem:dependency-unavailable",
	unsupportedMediaType: "urn:bandai:pats:problem:unsupported-media-type",
	rateLimit: "urn:bandai:pats:problem:rate-limit",
} as const;

interface ProblemDetails {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance: string;
	errors?: Array<{ field: string; message: string }>;
}

interface AcceptMediaRange {
	specificity: number;
	quality: number;
}

export interface CanonicalRouterOptions {
	/** Internal composition seam for deterministic canonical error-boundary tests. */
	healthHandler?: (req: Request, res: Response) => void;
	/** Provider-neutral identity seam; production composition must provide a real adapter. */
	identity?: IdentityDependencies;
	/** PATS-local username/password authentication; absent means login fails closed. */
	localAuth?: LocalAuthDependencies;
	/** Optional deployment-scoped read-only catalog boundary. */
	catalog?: {
		handler: RequestHandler;
		requiredCapability?: string;
	};
	/** Optional deployment-scoped product collection boundary. */
	catalogCollection?: {
		handler: RequestHandler;
		requiredCapability?: string;
	};
	/** Optional deployment-scoped BOM definition collection read boundary. */
	bomDefinitionCollection?: {
		handler: RequestHandler;
		requiredCapability?: string;
	};
	/** Optional deployment-scoped BOM definition detail read boundary. */
	bomDefinition?: {
		handler: RequestHandler;
		requiredCapability?: string;
	};
	/** Optional catalog draft-write boundary. It is mounted behind canonical identity and capability checks. */
	catalogMutations?: {
		router: Router;
		requiredCapability: string;
	};
	/** Optional deployment-scoped operational read boundary backed by canonical PATS persistence. */
	domainReads?: {
		router: Router;
	};
	/** Optional deployment-scoped operational command boundary. */
	domainCommands?: {
		router: Router;
	};
}

interface CanonicalIdentityRequest extends Request {
	canonicalSubject?: SubjectRecord;
	canonicalAssignments?: SubjectAssignmentRecord[];
}

function requestInstance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function sendProblem(res: Response, problem: ProblemDetails): void {
	res.type("application/problem+json").status(problem.status).json(problem);
}

function identityUnavailable(req: Request, res: Response): void {
	sendProblem(res, {
		type: PROBLEM_TYPES.dependencyUnavailable,
		title: "Dependency Unavailable",
		status: 503,
		detail: "The canonical identity adapter is not configured for this deployment.",
		instance: requestInstance(req),
	});
}

function canonicalMethodNotAllowed(req: Request, res: Response, allow: string): void {
	res.setHeader("Allow", allow);
	sendProblem(res, {
		type: PROBLEM_TYPES.methodNotAllowed,
		title: "Method Not Allowed",
		status: 405,
		detail: "The requested method is not supported for this canonical route.",
		instance: requestInstance(req),
	});
}

function requireCanonicalIdentity(
	identity: IdentityDependencies,
): (req: Request, res: Response, next: NextFunction) => void {
	return (req: Request, res: Response, next: NextFunction) => {
		void (async () => {
			try {
				const verified = await identity.authenticator.authenticate(req);
				if (!verified) {
					res.setHeader("WWW-Authenticate", "Bearer");
					sendProblem(res, {
						type: PROBLEM_TYPES.authenticationRequired,
						title: "Authentication Required",
						status: 401,
						detail: "A valid canonical identity is required.",
						instance: requestInstance(req),
					});
					return;
				}

				const subject = await identity.subjects.resolve(verified);
				if (subject.status !== "ACTIVE") {
					sendProblem(res, {
						type: PROBLEM_TYPES.authorizationDenied,
						title: "Forbidden",
						status: 403,
						detail: "The authenticated subject is disabled.",
						instance: requestInstance(req),
					});
					return;
				}

				const assignments = await identity.subjects.listAssignments(subject.id);
				const canonicalRequest = req as CanonicalIdentityRequest;
				canonicalRequest.canonicalSubject = subject;
				canonicalRequest.canonicalAssignments = assignments;
				next();
			} catch (error) {
				if (error instanceof IdentityProviderUnavailableError) {
					sendProblem(res, {
						type: PROBLEM_TYPES.dependencyUnavailable,
						title: "Dependency Unavailable",
						status: 503,
						detail: error.message,
						instance: requestInstance(req),
					});
					return;
				}

				sendProblem(res, {
					type: PROBLEM_TYPES.dependencyUnavailable,
					title: "Dependency Unavailable",
					status: 503,
					detail: "The canonical identity service is unavailable.",
					instance: requestInstance(req),
				});
			}
		})();
	};
}

export function requireCanonicalCapability(
	capability: string,
): (req: Request, res: Response, next: NextFunction) => void {
	return (req: Request, res: Response, next: NextFunction) => {
		const canonicalRequest = req as CanonicalIdentityRequest;
		if (
			!canonicalRequest.canonicalAssignments ||
			!hasCapability(canonicalRequest.canonicalAssignments, capability)
		) {
			sendProblem(res, {
				type: PROBLEM_TYPES.authorizationDenied,
				title: "Forbidden",
				status: 403,
				detail: "The authenticated subject does not have the required capability.",
				instance: requestInstance(req),
			});
			return;
		}
		next();
	};
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
	const members = value.split(",");
	if (members.length > 32) return false;

	const keys = new Set<string>();
	return members.every((member) => {
		const listMember = member.replace(/^[ \t]+|[ \t]+$/g, "");
		if (listMember === "") return true;

		const separator = listMember.indexOf("=");
		if (separator < 1) return false;

		const key = listMember.slice(0, separator);
		const memberValue = listMember.slice(separator + 1);
		const isSimpleKey = /^[a-z][a-z0-9_*/-]{0,255}$/.test(key);
		const isMultiTenantKey = /^[a-z0-9][a-z0-9_*/-]{0,240}@[a-z][a-z0-9_*/-]{0,13}$/.test(key);
		const hasValidValue =
			/^(?:[\x20\x21-\x2b\x2d-\x3c\x3e-\x7e]{0,255})[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/.test(
				memberValue,
			);
		if ((!isSimpleKey && !isMultiTenantKey) || !hasValidValue || keys.has(key)) return false;

		keys.add(key);
		return true;
	});
}

function setTraceContext(req: Request, res: Response): void {
	const traceparent = req.header("traceparent");
	if (!traceparent || !isValidTraceparent(traceparent)) return;

	res.setHeader("traceparent", traceparent);
	const tracestate = req.header("tracestate");
	if (tracestate !== undefined && isValidTracestate(tracestate))
		res.setHeader("tracestate", tracestate);
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

	if (
		hasErrorType(error, [
			"charset.unsupported",
			"encoding.unsupported",
			"unsupported.media.type",
			"unsupported_media_type",
		])
	) {
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
	const healthHandler =
		options.healthHandler ??
		((_req: Request, res: Response) => {
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

	// Canonical catalog writes carry bounded evidence metadata, never raw workbook payloads.
	router.use(express.json({ limit: "256kb" }));

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

	const localAuth = options.localAuth;
	const loginRateLimiter = rateLimit({
		windowMs: 60_000,
		limit: 10,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (req: Request, res: Response) => {
			res.setHeader("Retry-After", "60");
			sendProblem(res, {
				type: PROBLEM_TYPES.rateLimit,
				title: "Too Many Requests",
				status: 429,
				detail: "Too many login attempts. Retry after the indicated delay.",
				instance: requestInstance(req),
			});
		},
	});
	if (localAuth) {
		router.post("/auth/login", loginRateLimiter, async (req: Request, res: Response) => {
			const body = req.body as { username?: unknown; password?: unknown };
			const username = body?.username;
			const password = body?.password;
			if (
				typeof username !== "string" ||
				typeof password !== "string" ||
				username.trim() === "" ||
				password.length === 0
			) {
				sendProblem(res, {
					type: "urn:bandai:pats:problem:validation-error",
					title: "Validation Failed",
					status: 422,
					detail: "username and password are required.",
					instance: requestInstance(req),
					errors: [
						{ field: "username", message: "Must be a non-empty string." },
						{ field: "password", message: "Must be a non-empty string." },
					],
				});
				return;
			}

			try {
				const result = await localAuth.login(username, password);
				if (!result) {
					res.setHeader("WWW-Authenticate", "Bearer");
					sendProblem(res, {
						type: PROBLEM_TYPES.authenticationRequired,
						title: "Authentication Required",
						status: 401,
						detail: "Invalid username or password.",
						instance: requestInstance(req),
					});
					return;
				}

				res.type("application/json").status(200).json(result);
			} catch {
				identityUnavailable(req, res);
			}
		});
	} else {
		router.post("/auth/login", loginRateLimiter, identityUnavailable);
	}
	router.all("/auth/login", (req: Request, res: Response) =>
		canonicalMethodNotAllowed(req, res, "POST"),
	);

	const identityMiddleware = options.identity
		? requireCanonicalIdentity(options.identity)
		: undefined;
	if (identityMiddleware) {
		router.get("/users/me", identityMiddleware, (req: Request, res: Response) => {
			const canonicalRequest = req as CanonicalIdentityRequest;
			const subject = canonicalRequest.canonicalSubject;
			if (!subject) {
				identityUnavailable(req, res);
				return;
			}

			res.type("application/json")
				.status(200)
				.json({
					id: subject.id,
					displayName: subject.displayNameSnapshot ?? null,
					email: subject.emailSnapshot ?? null,
				});
		});
		router.all("/users/me", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);

		router.get("/users/me/capabilities", identityMiddleware, (req: Request, res: Response) => {
			const canonicalRequest = req as CanonicalIdentityRequest;
			if (!canonicalRequest.canonicalSubject || !canonicalRequest.canonicalAssignments) {
				identityUnavailable(req, res);
				return;
			}

			res.type("application/json")
				.status(200)
				.json({
					capabilities: effectiveCapabilities(canonicalRequest.canonicalAssignments),
				});
		});
		router.all("/users/me/capabilities", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);
	} else {
		router.get("/users/me", identityUnavailable);
		router.all("/users/me", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);
		router.get("/users/me/capabilities", identityUnavailable);
		router.all("/users/me/capabilities", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);
	}

	if (options.catalogMutations) {
		const catalogMutationIdentity =
			identityMiddleware ??
			((_req: Request, res: Response) => identityUnavailable(_req, res));
		const catalogMutationGate: RequestHandler = (req, res, next) => {
			if (
				["GET", "HEAD"].includes(req.method) &&
				(req.path === "/products" ||
					/^\/products\/[^/]+$/.test(req.path) ||
					req.path === "/bom-definitions" ||
					/^\/bom-definitions\/[^/]+$/.test(req.path))
			) {
				next();
				return;
			}

			catalogMutationIdentity(req, res, (identityError?: unknown) => {
				if (identityError) {
					next(identityError);
					return;
				}
				requireCanonicalCapability(
					options.catalogMutations?.requiredCapability ?? "catalog.manage",
				)(req, res, next);
			});
		};
		router.use("/catalog", catalogMutationGate, options.catalogMutations.router);
	}

	if (options.catalogCollection) {
		const catalogCollectionIdentity =
			identityMiddleware ??
			((_req: Request, res: Response) => identityUnavailable(_req, res));
		/**
		 * @openapi
		 * /api/v1/catalog/products:
		 *   get:
		 *     operationId: catalogProductCollectionGet
		 *     summary: List deployment-scoped PATS catalog products
		 *     tags: [PATS Catalog]
		 *     security:
		 *       - bearerAuth: []
		 *     parameters:
		 *       - in: query
		 *         name: page
		 *         schema:
		 *           type: integer
		 *           minimum: 1
		 *           default: 1
		 *       - in: query
		 *         name: limit
		 *         schema:
		 *           type: integer
		 *           minimum: 1
		 *           maximum: 100
		 *           default: 50
		 *       - in: query
		 *         name: sort
		 *         description: Comma-separated product_code, product_name, created_at, updated_at fields; prefix with - for descending order.
		 *         schema:
		 *           type: string
		 *     responses:
		 *       200:
		 *         description: Paginated normalized product summaries
		 *       400:
		 *         description: Malformed pagination or sort query
		 *       401:
		 *         description: Authentication required
		 *       403:
		 *         description: catalog.read capability required
		 *       429:
		 *         description: Request rate limit exceeded
		 *       503:
		 *         description: Catalog persistence unavailable
		 */
		router.get(
			"/catalog/products",
			catalogCollectionIdentity,
			options.catalogCollection.requiredCapability
				? requireCanonicalCapability(options.catalogCollection.requiredCapability)
				: (_req, _res, next) => next(),
			options.catalogCollection.handler,
		);
	}

	if (options.catalog) {
		const catalogIdentity =
			identityMiddleware ??
			((_req: Request, res: Response) => identityUnavailable(_req, res));
		/**
		 * @openapi
		 * /api/v1/catalog/products/{productId}:
		 *   get:
		 *     operationId: catalogProductGet
		 *     summary: Read a deployment-scoped PATS catalog product
		 *     tags: [PATS Catalog]
		 *     security:
		 *       - bearerAuth: []
		 *     parameters:
		 *       - in: path
		 *         name: productId
		 *         required: true
		 *         schema:
		 *           type: string
		 *     responses:
		 *       200:
		 *         description: Complete or sparse Product to Model to ModelPart record
		 *       401:
		 *         description: Authentication required
		 *       403:
		 *         description: catalog.read capability required
		 *       404:
		 *         description: Product not found
		 *       429:
		 *         description: Request rate limit exceeded
		 *       503:
		 *         description: Private image storage unavailable
		 */
		router.get(
			"/catalog/products/:productId",
			catalogIdentity,
			options.catalog.requiredCapability
				? requireCanonicalCapability(options.catalog.requiredCapability)
				: (_req, _res, next) => next(),
			options.catalog.handler,
		);
		router.all("/catalog/products/:productId", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);
	}
	if (options.catalogCollection) {
		router.all("/catalog/products", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);
	}

	if (options.bomDefinitionCollection) {
		const bomDefinitionCollectionIdentity =
			identityMiddleware ??
			((_req: Request, res: Response) => identityUnavailable(_req, res));
		/**
		 * @openapi
		 * /api/v1/catalog/bom-definitions:
		 *   get:
		 *     operationId: catalogBomDefinitionCollectionGet
		 *     summary: List BOM definition revisions for a model
		 *     tags: [PATS Catalog]
		 *     security:
		 *       - bearerAuth: []
		 *     parameters:
		 *       - in: query
		 *         name: model_id
		 *         required: true
		 *         schema: { type: string }
		 *       - in: query
		 *         name: page
		 *         schema: { type: integer, minimum: 1, default: 1 }
		 *       - in: query
		 *         name: limit
		 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
		 *       - in: query
		 *         name: sort
		 *         description: Comma-separated revision, created_at, updated_at fields; prefix with - for descending order.
		 *         schema: { type: string }
		 *     responses:
		 *       200: { description: Paginated BOM definition summaries }
		 *       400: { description: Malformed or incomplete collection query }
		 *       401: { description: Authentication required }
		 *       403: { description: catalog.read capability required }
		 *       503: { description: BOM persistence unavailable }
		 */
		router.get(
			"/catalog/bom-definitions",
			bomDefinitionCollectionIdentity,
			options.bomDefinitionCollection.requiredCapability
				? requireCanonicalCapability(options.bomDefinitionCollection.requiredCapability)
				: (_req, _res, next) => next(),
			options.bomDefinitionCollection.handler,
		);
		router.all("/catalog/bom-definitions", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);
	}

	if (options.bomDefinition) {
		const bomDefinitionIdentity =
			identityMiddleware ??
			((_req: Request, res: Response) => identityUnavailable(_req, res));
		/**
		 * @openapi
		 * /api/v1/catalog/bom-definitions/{bomDefinitionId}:
		 *   get:
		 *     operationId: catalogBomDefinitionGet
		 *     summary: Read a BOM definition revision with ordered lines
		 *     tags: [PATS Catalog]
		 *     security:
		 *       - bearerAuth: []
		 *     parameters:
		 *       - in: path
		 *         name: bomDefinitionId
		 *         required: true
		 *         schema: { type: string }
		 *     responses:
		 *       200: { description: BOM definition with sparse-safe ordered lines }
		 *       401: { description: Authentication required }
		 *       403: { description: catalog.read capability required }
		 *       404: { description: BOM definition not found }
		 *       503: { description: BOM persistence unavailable }
		 */
		router.get(
			"/catalog/bom-definitions/:bomDefinitionId",
			bomDefinitionIdentity,
			options.bomDefinition.requiredCapability
				? requireCanonicalCapability(options.bomDefinition.requiredCapability)
				: (_req, _res, next) => next(),
			options.bomDefinition.handler,
		);
		router.all("/catalog/bom-definitions/:bomDefinitionId", (req: Request, res: Response) =>
			canonicalMethodNotAllowed(req, res, "GET"),
		);
	}

	if (options.domainReads) {
		const domainReadIdentity =
			identityMiddleware ??
			((_req: Request, res: Response) => identityUnavailable(_req, res));
		const domainReadPrefixes = [
			"/production-plans",
			"/workflow-groups",
			"/stages",
			"/sub-stages",
			"/stations",
			"/station-steps",
			"/work-instructions",
			"/work-processes",
			"/booths",
			"/monitoring",
			"/batches",
			"/batch-positions",
			"/stage-events",
			"/inventory-transactions",
			"/routing-violations",
			"/quality-inspections",
			"/dashboard-summaries",
			"/reports",
		];
		const domainReadIdentityGate: RequestHandler = (req, res, next) => {
			if (domainReadPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
				domainReadIdentity(req, res, next);
				return;
			}
			next();
		};
		router.use(domainReadIdentityGate, options.domainReads.router);
	}

	if (options.domainCommands) {
		const domainCommandIdentity =
			identityMiddleware ??
			((_req: Request, res: Response) => identityUnavailable(_req, res));
		const domainCommandPrefixes = [
			"/production-plans",
			"/stages",
			"/sub-stages",
			"/stations",
			"/station-steps",
			"/work-instructions",
			"/work-processes",
			"/booths",
			"/monitoring",
			"/batches",
			"/stage-events",
			"/inventory-transactions",
			"/quality-inspections",
			"/routing-violations",
		];
		const domainCommandIdentityGate: RequestHandler = (req, res, next) => {
			if (domainCommandPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
				domainCommandIdentity(req, res, next);
				return;
			}
			next();
		};
		router.use(domainCommandIdentityGate, options.domainCommands.router);
	}

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
