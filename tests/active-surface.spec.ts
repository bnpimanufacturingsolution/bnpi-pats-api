import assert from "assert";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../app/create-app";

const workspaceId = "507f1f77bcf86cd799439011";
const token = jwt.sign(
	{
		userId: "507f1f77bcf86cd799439012",
		role: "admin",
		workspaceId,
	},
	process.env.JWT_SECRET || "change-me-for-local-dev",
);

describe("active API surface", function () {
	this.timeout(15000);

	it("serves health without starting a listener", async () => {
		const app = createApp({ enableLegacyRoutes: false });

		await request(app).get("/health").expect(200);
	});

	it("keeps the retained workspace route behind the existing auth boundary", async () => {
		const app = createApp({ enableLegacyRoutes: false });

		await request(app)
			.get("/api/workspace")
			.query({ workspaceId: "invalid" })
			.set("Authorization", `Bearer ${token}`)
			.expect(400);
	});

	it("does not expose quarantined project routes by default", async () => {
		const app = createApp({ enableLegacyRoutes: false });

		await request(app)
			.get("/api/project")
			.query({ workspaceId: "invalid" })
			.set("Authorization", `Bearer ${token}`)
			.expect(404);
	});

	it("does not expose the public template compatibility route by default", async () => {
		const app = createApp({ enableLegacyRoutes: false });

		await request(app).get("/api/template").expect(404);
	});

	it("mounts a quarantined route only in explicit compatibility mode", async () => {
		const app = createApp({ enableLegacyRoutes: true });
		const response = await request(app)
			.get("/api/project")
			.query({ workspaceId: "invalid" })
			.set("Authorization", `Bearer ${token}`);

		assert.strictEqual(response.status, 400);
	});
});
