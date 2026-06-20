import { Request } from "express";

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		email?: string;
		role?: string;
		[key: string]: unknown;
	};
}

/**
 * Express Application instance with router
 */
export interface ExpressApp extends Express.Application {
	router: {
		stack: RouterLayer[];
	};
}

/**
 * Express Router Layer
 */
export interface RouterLayer {
	name?: string;
	regexp?: RegExp;
	route?: {
		path: string;
		stack: RouteHandler[];
		methods: Record<string, boolean>;
	};
	handle?: {
		name?: string;
		stack?: RouterLayer[];
	};
	keys?: string[] | Array<{ name: string; optional?: boolean }>;
	path?: string;
}

/**
 * Express Route Handler
 */
export interface RouteHandler {
	name?: string;
	method?: string;
	handle?: Function;
	[key: string]: unknown;
}
