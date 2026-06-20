import { Request, Response, NextFunction } from "express";

/**
 * Async handler wrapper to catch errors in async route handlers
 * Eliminates the need for try-catch in every controller method
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getAll();
 *   res.json(users);
 * }));
 */
export const asyncHandler = (
	fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		return Promise.resolve(fn(req, res, next)).catch(next);
	};
};

export default asyncHandler;
