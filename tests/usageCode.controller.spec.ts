import { controller } from "../app/usageCode/usageCode.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("UsageCode Controller", () => {
	let usageCodeController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;
	const mockUsageCode = {
		id: "507f1f77bcf86cd799439026",
		name: "Office Supplies",
		code: "OFF-SUP",
		description: "General office supplies and materials",
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockUsageCodes = [
		{
			id: "507f1f77bcf86cd799439026",
			name: "Office Supplies",
			code: "OFF-SUP",
			description: "General office supplies and materials",
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439027",
			name: "Equipment",
			code: "EQUIP",
			description: "IT and office equipment",
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439028",
			name: "Furniture",
			code: "FURN",
			description: null,
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			usageCode: {
				findMany: async (_params: Prisma.UsageCodeFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockUsageCodes;
					}
					return [mockUsageCode];
				},
				count: async (_params: Prisma.UsageCodeCountArgs) => {
					if (req.query?.groupBy) {
						return mockUsageCodes.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.UsageCodeFindFirstArgs) =>
					params.where?.id === mockUsageCode.id ? mockUsageCode : null,
				findUnique: async (params: Prisma.UsageCodeFindUniqueArgs) =>
					params.where?.id === mockUsageCode.id ? mockUsageCode : null,
				create: async (params: Prisma.UsageCodeCreateArgs) => ({
					...mockUsageCode,
					...params.data,
				}),
				update: async (params: Prisma.UsageCodeUpdateArgs) => ({
					...mockUsageCode,
					...params.data,
				}),
				delete: async (params: Prisma.UsageCodeDeleteArgs) => ({
					...mockUsageCode,
					id: params.where.id,
				}),
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		usageCodeController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
			get: (header: string) => {
				if (header === "Content-Type") {
					return "application/json";
				}
				return undefined;
			},
			originalUrl: "/api/usageCode",
		} as Request;
		res = {
			send: (data: any) => {
				sentData = data;
				return res;
			},
			status: (code: number) => {
				statusCode = code;
				return res;
			},
			json: (data: any) => {
				sentData = data;
				return res;
			},
			end: () => res,
		} as Response;
		next = ((err: any) => {
			if (err) {
				// Handle errors like Express error middleware would
				if (err.message && err.message.includes("not found")) {
					statusCode = 404;
					sentData = { status: "error", message: err.message, code: 404 };
				} else if (
					err.message &&
					(err.message.includes("Missing") ||
						err.message.includes("Invalid") ||
						err.message.includes("required") ||
						err.message.includes("combination"))
				) {
					statusCode = 400;
					sentData = { status: "error", message: err.message, code: 400 };
				} else {
					statusCode = 500;
					sentData = {
						status: "error",
						message: err.message || "Internal server error",
						code: 500,
					};
				}
			}
		}) as NextFunction;
	});

	describe(".getAll()", () => {
		it("should return paginated usageCodes", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await usageCodeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group usageCodes by code field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "code", document: "true" };
			await usageCodeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("usageCodes");
			expect(sentData.data).to.have.property("groupedBy", "code");
			expect(sentData.data.usageCodes).to.be.an("object");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await usageCodeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it("should search usageCodes by name or code", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { query: "Office", document: "true" };
			await usageCodeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});
	});

	describe(".getById()", () => {
		it("should return a usageCode", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUsageCode.id };
			req.query = { document: "true" };
			await usageCodeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockUsageCode.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			req.query = { document: "true" };
			await usageCodeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent usageCode", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			req.query = { document: "true" };
			await usageCodeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});

		it("should return usageCode with specific fields", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUsageCode.id };
			req.query = { fields: "id,name,code", document: "true" };
			await usageCodeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});
	});

	describe(".create()", () => {
		it("should create a new usageCode", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				name: "Software Licenses",
				code: "SW-LIC",
				description: "Software licensing and subscriptions",
			};
			req.body = createData;
			await usageCodeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});

		it("should create a usageCode without optional description", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				name: "Travel",
				code: "TRVL",
			};
			req.body = createData;
			await usageCodeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it.skip("should handle validation errors for missing name (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				code: "TEST",
			};
			req.body = createData;
			await usageCodeController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should handle validation errors for missing code (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				name: "Test Usage Code",
			};
			req.body = createData;
			await usageCodeController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should handle validation errors for name exceeding max length (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				name: "a".repeat(121),
				code: "TEST",
			};
			req.body = createData;
			await usageCodeController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".update()", () => {
		it("should update usageCode details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				name: "Office Supplies Updated",
				description: "Updated description for office supplies",
			};
			req.params = { id: mockUsageCode.id };
			req.body = updateData;
			await usageCodeController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});

		it("should update only the code field", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				code: "OFF-SUP-V2",
			};
			req.params = { id: mockUsageCode.id };
			req.body = updateData;
			await usageCodeController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should handle non-existent usageCode update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				name: "Non-existent",
			};
			req.params = { id: "507f1f77bcf86cd799439099" };
			req.body = updateData;
			await usageCodeController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});

		it.skip("should handle validation errors during update (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				name: "a".repeat(121),
			};
			req.params = { id: mockUsageCode.id };
			req.body = updateData;
			await usageCodeController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".remove()", () => {
		it("should delete a usageCode", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUsageCode.id };
			await usageCodeController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
		});

		it("should handle non-existent usageCode deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await usageCodeController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
