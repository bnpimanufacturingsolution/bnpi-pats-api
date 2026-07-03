import { describe, it, before, after, afterEach } from "mocha";
import { expect } from "chai";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import verifyToken from "../middleware/verifyToken";
import { validateWorkspaceId } from "../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../middleware/workspaceAuth";

/**
 * Regression coverage for the cross-workspace access-control gap: a caller
 * authenticated for one workspace must not be able to reach another
 * workspace's data just by changing the x-workspace-id header.
 */
describe("Workspace authorization (cross-tenant access)", () => {
	const WORKSPACE_A = "507f1f77bcf86cd799439011";
	const WORKSPACE_B = "507f1f77bcf86cd799439022";
	const USER_ID = "507f1f77bcf86cd799439099";

	let app: express.Application;
	let originalFindFirst: typeof prisma.workspaceMember.findFirst;

	const signToken = () =>
		jwt.sign({ userId: USER_ID, role: "user" }, env.JWT_SECRET, {
			algorithm: "HS256",
			expiresIn: "1h",
		});

	before(() => {
		app = express();
		app.use(express.json());
		app.use(verifyToken);
		app.get(
			"/protected",
			validateWorkspaceId,
			requireWorkspaceRole(["OWNER", "ADMIN"]),
			(_req, res) => res.status(200).json({ ok: true }),
		);

		originalFindFirst = prisma.workspaceMember.findFirst;
		prisma.workspaceMember.findFirst = (async ({ where }: any) => {
			if (where.workspaceId === WORKSPACE_A && where.userId === USER_ID) {
				return { id: "member-a", role: "OWNER" } as any;
			}
			return null;
		}) as typeof prisma.workspaceMember.findFirst;
	});

	after(() => {
		prisma.workspaceMember.findFirst = originalFindFirst;
	});

	it("rejects requests with no token", async () => {
		await request(app).get("/protected").set("x-workspace-id", WORKSPACE_A).expect(401);
	});

	it("allows a member with a sufficient role into their own workspace", async () => {
		const token = signToken();
		const res = await request(app)
			.get("/protected")
			.set("Authorization", `Bearer ${token}`)
			.set("x-workspace-id", WORKSPACE_A)
			.expect(200);

		expect(res.body.ok).to.equal(true);
	});

	it("denies the same authenticated user access to a workspace they don't belong to", async () => {
		const token = signToken();
		const res = await request(app)
			.get("/protected")
			.set("Authorization", `Bearer ${token}`)
			.set("x-workspace-id", WORKSPACE_B)
			.expect(403);

		expect(res.body.message).to.match(/not a member of this workspace/i);
	});

	describe("insufficient role", () => {
		afterEach(() => {
			prisma.workspaceMember.findFirst = (async ({ where }: any) => {
				if (where.workspaceId === WORKSPACE_A && where.userId === USER_ID) {
					return { id: "member-a", role: "OWNER" } as any;
				}
				return null;
			}) as typeof prisma.workspaceMember.findFirst;
		});

		it("denies a member whose workspace role isn't in the allowed list", async () => {
			prisma.workspaceMember.findFirst = (async () => ({ id: "member-a", role: "VIEWER" }) as any) as typeof prisma.workspaceMember.findFirst;

			const token = signToken();
			const res = await request(app)
				.get("/protected")
				.set("Authorization", `Bearer ${token}`)
				.set("x-workspace-id", WORKSPACE_A)
				.expect(403);

			expect(res.body.message).to.match(/insufficient workspace role/i);
		});
	});
});
