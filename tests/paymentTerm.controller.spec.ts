import { controller } from "../app/paymentTerm/paymentTerm.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("PaymentTerm Controller", () => {
	let paymentTermController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockPaymentTerm = {
		id: "507f1f77bcf86cd799439401",
		workspaceId: "507f1f77bcf86cd799439001",
		code: "NET30",
		name: "Net 30 Days",
		description: "Payment due within 30 days of invoice date",
		dueDays: 30,
		discountDays: 10,
		discountRate: 2,
		lateFeeRate: 1.5,
		lateFeeType: "PERCENTAGE",
		lateFeeGraceDays: 5,
		isDefault: true,
		requiresDeposit: false,
		depositPercentage: null,
		notes: "Standard payment term",
		status: "ACTIVE",
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockPaymentTerms = [
		mockPaymentTerm,
		{
			...mockPaymentTerm,
			id: "507f1f77bcf86cd799439402",
			code: "COD",
			name: "Cash on Delivery",
			dueDays: 0,
			isDefault: false,
		},
		{
			...mockPaymentTerm,
			id: "507f1f77bcf86cd799439403",
			code: "NET60",
			name: "Net 60 Days",
			dueDays: 60,
			isDefault: false,
		},
	];

	beforeEach(() => {
		prisma = {
			paymentTerm: {
				findMany: async (_params: Prisma.PaymentTermFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockPaymentTerms;
					}
					return [mockPaymentTerm];
				},
				count: async (_params: Prisma.PaymentTermCountArgs) => {
					if (req.query?.groupBy) {
						return mockPaymentTerms.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.PaymentTermFindFirstArgs) =>
					params.where?.id === mockPaymentTerm.id ? mockPaymentTerm : null,
				findUnique: async (params: Prisma.PaymentTermFindUniqueArgs) =>
					params.where?.id === mockPaymentTerm.id ? mockPaymentTerm : null,
				create: async (params: Prisma.PaymentTermCreateArgs) => ({
					...mockPaymentTerm,
					...params.data,
				}),
				update: async (params: Prisma.PaymentTermUpdateArgs) => ({
					...mockPaymentTerm,
					...params.data,
				}),
				delete: async (params: Prisma.PaymentTermDeleteArgs) => ({
					...mockPaymentTerm,
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

		paymentTermController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/payment-term",
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
				if (err.message && err.message.includes("not found")) {
					statusCode = 404;
					sentData = { status: "error", message: err.message, code: 404 };
				} else if (err.message && (err.message.includes("Missing") || err.message.includes("Invalid") || err.message.includes("required"))) {
					statusCode = 400;
					sentData = { status: "error", message: err.message, code: 400 };
				} else {
					statusCode = 500;
					sentData = { status: "error", message: err.message || "Internal server error", code: 500 };
				}
			}
		}) as NextFunction;
	});

	describe(".getAll()", () => {
		it("should return paginated payment terms", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await paymentTermController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group payment terms by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await paymentTermController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("paymentTerms");
			expect(sentData.data).to.have.property("groupedBy", "status");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await paymentTermController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a payment term", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPaymentTerm.id };
			await paymentTermController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockPaymentTerm.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await paymentTermController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent payment term", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await paymentTermController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new payment term", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				code: "NET15",
				name: "Net 15 Days",
				dueDays: 15,
			};
			req.body = createData;
			await paymentTermController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});
	});

	describe(".update()", () => {
		it("should update payment term details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				name: "Net 30 Days (Updated)",
				discountRate: 3,
			};
			req.params = { id: mockPaymentTerm.id };
			req.body = updateData;
			await paymentTermController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("paymentTerm");
		});

		it("should handle non-existent payment term update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = { status: "INACTIVE" };
			req.params = { id: "507f1f77bcf86cd799439999" };
			req.body = updateData;
			await paymentTermController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete a payment term", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPaymentTerm.id };
			await paymentTermController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent payment term deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await paymentTermController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
