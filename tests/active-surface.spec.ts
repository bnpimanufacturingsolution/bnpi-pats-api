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

	// Retired 2026-07-15: these route groups had no active frontend, demo, or
	// external consumer (docs/superpowers/reports/2026-07-13-api-consumer-audit.md)
	// and no relation to the canonical PATS schema. Their route registration,
	// source, Prisma schema, seeders, and tests were removed entirely, so they
	// 404 unconditionally now rather than behind the legacy compatibility switch.
	const retiredRoutePrefixes = [
		"/api/template",
		"/api/project",
		"/api/estimation",
		"/api/sequential",
		"/api/item",
		"/api/order",
		"/api/vendor",
		"/api/payslip",
		"/api/transaction",
		"/api/metric",
		"/api/category",
		"/api/field",
		"/api/item-type",
		"/api/demand-plan",
		"/api/milestone",
		"/api/usageCode",
		"/api/purchase-order",
		"/api/delivery-order",
		"/api/invoice",
		"/api/payment-term",
		"/api/po-type",
		"/api/payment-schedule",
	];

	for (const prefix of retiredRoutePrefixes) {
		it(`returns 404 for retired route ${prefix}`, async () => {
			const app = createApp({ enableLegacyRoutes: false });

			await request(app).get(prefix).set("Authorization", `Bearer ${token}`).expect(404);
		});

		it(`returns 404 for retired route ${prefix} even with the legacy compatibility switch on`, async () => {
			const app = createApp({ enableLegacyRoutes: true });

			await request(app).get(prefix).set("Authorization", `Bearer ${token}`).expect(404);
		});
	}
});
