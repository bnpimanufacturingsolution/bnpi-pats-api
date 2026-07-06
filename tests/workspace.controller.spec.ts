import { describe, it, beforeEach } from "mocha";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../generated/prisma";
import { controller } from "../app/workspace/workspace.controller";

/**
 * Regression coverage for the removed global-role bypass in `getAll` (Phase 5 RBAC rebuild,
 * ADOPTED_AS_WORKING_DEFAULT row 7: no separate cross-line superadmin). Previously, a caller
 * whose `req.role === "superadmin"` skipped workspace-membership scoping entirely and could
 * browse every workspace in the system. `getAll` must now always scope to the caller's own
 * memberships, regardless of any role value.
 */
describe("Workspace Controller — getAll membership scoping", () => {
	const USER_ID = "507f1f77bcf86cd799439099";
	const OWNED_WORKSPACE_ID = "507f1f77bcf86cd799439011";
	const OTHER_WORKSPACE_ID = "507f1f77bcf86cd799439022";

	let workspaceController: any;
	let capturedWhere: any;
	let req: Partial<Request> & { userId?: string; role?: string };
	let res: Response;
	let next: NextFunction;
	let statusCode: number;
	let sentData: any;

	beforeEach(() => {
		capturedWhere = undefined;

		const prisma = {
			workspaceMember: {
				findMany: async (_params: any) => [{ workspaceId: OWNED_WORKSPACE_ID }],
			},
			workspace: {
				findMany: async (params: any) => {
					capturedWhere = params.where;
					return [];
				},
				count: async (params: any) => {
					capturedWhere = params.where;
					return 0;
				},
			},
		};

		workspaceController = controller(prisma as unknown as PrismaClient);
		statusCode = 200;
		sentData = undefined;
		req = { query: { document: "true" }, params: {}, userId: USER_ID };
		res = {
			status: (code: number) => {
				statusCode = code;
				return res;
			},
			json: (data: any) => {
				sentData = data;
				return res;
			},
		} as Response;
		next = (() => {}) as NextFunction;
	});

	it("scopes to the caller's own workspace memberships by default", async () => {
		await workspaceController.getAll(req as Request, res, next);

		expect(statusCode).to.equal(200);
		expect(capturedWhere.id).to.deep.equal({ in: [OWNED_WORKSPACE_ID] });
	});

	it("still scopes to the caller's own memberships even when req.role claims superadmin", async () => {
		req.role = "superadmin";

		await workspaceController.getAll(req as Request, res, next);

		expect(statusCode).to.equal(200);
		// The old bypass would have skipped the `id: { in: [...] }` filter entirely for a
		// superadmin role. It must not: membership scoping is unconditional now.
		expect(capturedWhere.id).to.deep.equal({ in: [OWNED_WORKSPACE_ID] });
		expect(capturedWhere.id?.in).to.not.include(OTHER_WORKSPACE_ID);
	});
});
