import { controller } from "../app/paymentSchedule/paymentSchedule.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("PaymentSchedule Controller", () => {
	let paymentScheduleController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockSchedule = {
		id: "b07f1f77bcf86cd799439501",
		workspaceId: "507f1f77bcf86cd799439001",
		organizationId: "507f1f77bcf86cd799439001",
		purchaseOrderId: "507f1f77bcf86cd799439101",
		paymentTermId: "a07f1f77bcf86cd799439405",
		items: [
			{
				sequence: 1,
				description: "Deposit (50%)",
				percentage: 50,
				amount: 6720.0,
				dueDate: new Date("2025-01-16"),
				status: "DUE",
				paidAmount: 0,
				balance: 6720.0,
				transactionIds: [],
			},
			{
				sequence: 2,
				description: "Balance on Delivery (50%)",
				percentage: 50,
				amount: 6720.0,
				dueDate: new Date("2025-02-15"),
				status: "UPCOMING",
				paidAmount: 0,
				balance: 6720.0,
				transactionIds: [],
			},
		],
		totalScheduled: 13440.0,
		totalPaid: 0,
		balance: 13440.0,
		status: "ACTIVE",
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockSchedules = [
		mockSchedule,
		{
			...mockSchedule,
			id: "b07f1f77bcf86cd799439502",
			purchaseOrderId: "507f1f77bcf86cd799439102",
			status: "COMPLETED",
		},
	];

	beforeEach(() => {
		prisma = {
			paymentSchedule: {
				findMany: async (_params: Prisma.PaymentScheduleFindManyArgs) => {
					return [mockSchedule];
				},
				count: async (_params: Prisma.PaymentScheduleCountArgs) => {
					return 1;
				},
				findFirst: async (params: Prisma.PaymentScheduleFindFirstArgs) => {
					if (params.where?.purchaseOrderId) {
						return params.where.purchaseOrderId === mockSchedule.purchaseOrderId
							? mockSchedule
							: null;
					}
					return params.where?.id === mockSchedule.id ? mockSchedule : null;
				},
				findUnique: async (params: Prisma.PaymentScheduleFindUniqueArgs) =>
					params.where?.id === mockSchedule.id ? mockSchedule : null,
				create: async (params: Prisma.PaymentScheduleCreateArgs) => ({
					...mockSchedule,
					...params.data,
				}),
				update: async (params: Prisma.PaymentScheduleUpdateArgs) => ({
					...mockSchedule,
					...params.data,
				}),
			},
			purchaseOrder: {
				findFirst: async () => ({
					id: "507f1f77bcf86cd799439101",
					poNumber: "PO-2025-001",
					projectId: "507f1f77bcf86cd799439010",
					totalAmount: 13440.0,
					status: "APPROVED",
					vendor: { name: "Test Vendor" },
				}),
				update: async (params: any) => ({
					id: params.where.id,
					...params.data,
				}),
			},
			transaction: {
				findUnique: async () => null,
				findFirst: async () => null,
				create: async (params: any) => ({
					id: "c07f1f77bcf86cd799439601",
					transactionNumber: "TXN-001",
					...params.data,
				}),
				update: async (params: any) => ({
					id: params.where.id,
					...params.data,
				}),
			},
			sequential: {
				upsert: async (params: any) => ({
					name: params.where.name,
					code: params.create.code,
					pattern: params.create.pattern,
					current: 1,
				}),
			},
			project: {
				findUnique: async () => ({
					id: "507f1f77bcf86cd799439010",
					workspaceId: "507f1f77bcf86cd799439001",
					code: "PRJ-001",
					status: "ACTIVE",
					metaData: {},
				}),
				update: async (params: any) => ({
					id: params.where.id,
					...params.data,
				}),
			},
			item: {
				findUnique: async () => null,
				findMany: async () => [],
				update: async (params: any) => ({ id: params.where.id }),
			},
			estimation: {
				findMany: async () => [],
				findUnique: async () => null,
				update: async (params: any) => ({ id: params.where.id, ...params.data }),
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		paymentScheduleController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
			get: (header: string) => {
				if (header === "Content-Type") return "application/json";
				return undefined;
			},
			originalUrl: "/api/payment-schedule",
		} as Request;
		res = {
			send: (data: any) => { sentData = data; return res; },
			status: (code: number) => { statusCode = code; return res; },
			json: (data: any) => { sentData = data; return res; },
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
		it("should return paginated payment schedules", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await paymentScheduleController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await paymentScheduleController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a payment schedule", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockSchedule.id };
			await paymentScheduleController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockSchedule.id });
		});

		it("should handle non-existent payment schedule", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "b07f1f77bcf86cd799439999" };
			await paymentScheduleController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".getByPurchaseOrderId()", () => {
		it("should return payment schedule for a PO", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { purchaseOrderId: mockSchedule.purchaseOrderId };
			await paymentScheduleController.getByPurchaseOrderId(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should handle non-existent PO schedule", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { purchaseOrderId: "507f1f77bcf86cd799439999" };
			await paymentScheduleController.getByPurchaseOrderId(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".releasePayment()", () => {
		it("should release a payment for a DUE schedule item", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockSchedule.id };
			req.body = {
				itemIndex: 0,
				amount: 6720.0,
				paymentMethod: "BANK_TRANSFER",
				payeeName: "Test Vendor",
			};
			await paymentScheduleController.releasePayment(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should reject payment exceeding balance", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockSchedule.id };
			req.body = {
				itemIndex: 0,
				amount: 99999.0,
			};
			await paymentScheduleController.releasePayment(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it("should reject payment on UPCOMING item", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockSchedule.id };
			req.body = {
				itemIndex: 1,
				amount: 1000,
			};
			await paymentScheduleController.releasePayment(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".remove()", () => {
		it("should delete a payment schedule", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockSchedule.id };
			await paymentScheduleController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent payment schedule deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "b07f1f77bcf86cd799439999" };
			await paymentScheduleController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
