import { controller } from "../app/payslip/payslip.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Payslip Controller", () => {
	let payslipController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;
	const mockPayslip = {
		id: "507f1f77bcf86cd799439026",
		payslipNumber: "PS-001",
		estimationId: "507f1f77bcf86cd799439025",
		name: "John Smith",
		amount: 5000.0,
		paymentDate: new Date("2024-12-01"),
		notes: "Monthly salary for November 2024",
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockPayslips = [
		{
			id: "507f1f77bcf86cd799439026",
			payslipNumber: "PS-001",
			estimationId: "507f1f77bcf86cd799439025",
			name: "John Smith",
			amount: 5000.0,
			paymentDate: new Date("2024-12-01"),
			notes: "Monthly salary for November 2024",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439027",
			payslipNumber: "PS-002",
			estimationId: "507f1f77bcf86cd799439025",
			name: "Sarah Johnson",
			amount: 4500.0,
			paymentDate: null,
			notes: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439028",
			payslipNumber: "PS-003",
			estimationId: "507f1f77bcf86cd799439026",
			name: "Mike Chen",
			amount: 6000.0,
			paymentDate: new Date("2024-12-05"),
			notes: "Includes overtime pay",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			payslip: {
				findMany: async (_params: Prisma.PayslipFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockPayslips;
					}
					return [mockPayslip];
				},
				count: async (_params: Prisma.PayslipCountArgs) => {
					if (req.query?.groupBy) {
						return mockPayslips.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.PayslipFindFirstArgs) =>
					params.where?.id === mockPayslip.id ? mockPayslip : null,
				findUnique: async (params: Prisma.PayslipFindUniqueArgs) =>
					params.where?.id === mockPayslip.id ? mockPayslip : null,
				create: async (params: Prisma.PayslipCreateArgs) => ({
					...mockPayslip,
					...params.data,
				}),
				update: async (params: Prisma.PayslipUpdateArgs) => ({
					...mockPayslip,
					...params.data,
				}),
				delete: async (params: Prisma.PayslipDeleteArgs) => ({
					...mockPayslip,
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

		payslipController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/payslip",
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
						err.message.includes("required"))
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
		it("should return paginated payslips", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await payslipController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group payslips by name field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "name", document: "true" };
			await payslipController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("payslips");
			expect(sentData.data).to.have.property("groupedBy", "name");
			expect(sentData.data.payslips).to.be.an("object");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await payslipController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a payslip", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPayslip.id };
			await payslipController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockPayslip.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await payslipController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent payslip", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await payslipController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new payslip", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				payslipNumber: "PS-004",
				estimationId: "507f1f77bcf86cd799439025",
				name: "Emily Davis",
				amount: 5500.0,
			};
			req.body = createData;
			await payslipController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});

		it.skip("should handle validation errors (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				payslipNumber: "",
				estimationId: "507f1f77bcf86cd799439025",
				name: "Emily Davis",
			};
			req.body = createData;
			await payslipController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".update()", () => {
		it("should update payslip details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				paymentDate: new Date("2024-12-10"),
				notes: "Updated payment date",
			};
			req.params = { id: mockPayslip.id };
			req.body = updateData;
			await payslipController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("payslip");
			expect(sentData.data.payslip).to.have.property("id");
		});

		it("should handle non-existent payslip update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				amount: 6000.0,
			};
			req.params = { id: "507f1f77bcf86cd799439099" };
			req.body = updateData;
			await payslipController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete a payslip", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPayslip.id };
			await payslipController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent payslip deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await payslipController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
