import { controller } from "../app/estimation/estimation.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, EstimationStatus } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Estimation Controller", () => {
	let estimationController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockEstimation = {
		id: "607f1f77bcf86cd799439101",
		estimationNumber: "EST-2025-001",
		projectId: "507f1f77bcf86cd799439011",
		marginPercentage: 25.0,
		status: EstimationStatus.APPROVED,
		approvedBy: "user_001",
		approvedAt: new Date("2025-01-15"),
		notes: "Initial estimation approved",
		metaData: {
			estimatedCost: 150000.0,
			actualCost: 125000.0,
			marginAmount: 37500.0,
			projectedWithMargin: 187500.0,
			allocatedAmount: null,
			remainingAmount: 150000.0,
			categorySubtotals: {},
			typeBreakdown: {
				CAPEX: { estimated: 0, actual: 0 },
				OPEX: { estimated: 0, actual: 0 },
				MISC: { estimated: 0, actual: 0 },
			},
			itemCounts: { total: 0, withActuals: 0, newAdditions: 0 },
			budgetBreakdown: {
				originalContractSum: 0,
				totalChangeOrders: 0,
				revisedBudget: 0,
				actualsOriginalSum: 0,
				actualsChangeOrdersSum: 0,
				changeOrderCount: 0,
			},
			lastComputedAt: new Date().toISOString(),
		},
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockEstimations = [
		{
			id: "607f1f77bcf86cd799439101",
			estimationNumber: "EST-2025-001",
			projectId: "507f1f77bcf86cd799439011",
			marginPercentage: 25.0,
			status: EstimationStatus.APPROVED,
			approvedBy: "user_001",
			approvedAt: new Date("2025-01-15"),
			notes: "Initial estimation approved",
			metaData: {
				estimatedCost: 150000.0,
				actualCost: 125000.0,
				marginAmount: 37500.0,
				projectedWithMargin: 187500.0,
				allocatedAmount: null,
				remainingAmount: 150000.0,
			},
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "607f1f77bcf86cd799439102",
			estimationNumber: "EST-2025-002",
			projectId: "507f1f77bcf86cd799439012",
			marginPercentage: 30.0,
			status: EstimationStatus.PENDING,
			approvedBy: null,
			approvedAt: null,
			notes: null,
			metaData: {
				estimatedCost: 250000.0,
				actualCost: 180000.0,
				marginAmount: 75000.0,
				projectedWithMargin: 325000.0,
				allocatedAmount: null,
				remainingAmount: 250000.0,
			},
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	const mockProject = {
		id: "507f1f77bcf86cd799439011",
		name: "Test Project",
		code: "PROJ-2025-001",
		status: "ACTIVE",
		isDeleted: false,
	};

	beforeEach(() => {
		prisma = {
			estimation: {
				create: async (params: any) => mockEstimation,
				findMany: async (params: any) => mockEstimations,
				findFirst: async (params: any) => mockEstimation,
				update: async (params: any) => ({ ...mockEstimation, ...params.data }),
				delete: async (params: any) => mockEstimation,
				count: async (params: any) => mockEstimations.length,
			},
			item: {
				updateMany: async (params: any) => ({ count: 1 }),
			},
			order: {
				updateMany: async (params: any) => ({ count: 1 }),
			},
			payslip: {
				updateMany: async (params: any) => ({ count: 1 }),
			},
			project: {
				findFirst: async (params: any) => mockProject,
			},
		};

		estimationController = controller(prisma as PrismaClient);

		req = {
			body: {},
			params: {},
			query: {},
			get: (headerName: string): string | undefined => {
				const headers: Record<string, string> = {
					"Content-Type": "application/json",
				};
				return headers[headerName];
			},
		} as any;

		sentData = null;
		statusCode = 200;

		res = {
			status: function (code: number) {
				statusCode = code;
				return this;
			},
			json: function (data: any) {
				sentData = data;
				return this;
			},
		} as Response;

		next = ((err: any) => {
			if (err) {
				// Handle errors like Express error middleware would
				if (err.message && err.message.includes("not found")) {
					statusCode = 404;
					sentData = { status: "error", message: err.message, code: 404 };
				} else if (err.message && err.message.includes("Missing")) {
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

	describe("create", () => {
		it("should create a new estimation successfully", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationNumber: "EST-2025-001",
				name: "Test Estimation",
				projectId: "507f1f77bcf86cd799439011",
				marginPercentage: 25.0,
				status: EstimationStatus.DRAFT,
			};

			await estimationController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("estimationNumber");
		});

		it("should return 404 if project not found", async function () {
			this.timeout(TEST_TIMEOUT);

			prisma.project.findFirst = async () => null;

			req.body = {
				estimationNumber: "EST-2025-001",
				name: "Test Estimation",
				projectId: "507f1f77bcf86cd799439999",
				marginPercentage: 25.0,
			};

			await estimationController.create(req as Request, res, next);

			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 for invalid data (requires Zod middleware)", async function () {
			// Note: This test is skipped because it tests validation middleware (Zod),
			// which is not present in unit tests. In production, validation happens
			// in middleware before reaching the controller.
			this.timeout(TEST_TIMEOUT);

			req.body = {
				// Missing required fields
				estimationNumber: "EST-2025-001",
			};

			await estimationController.create(req as Request, res, next);

			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe("getAll", () => {
		it("should retrieve all estimations with default pagination", async function () {
			this.timeout(TEST_TIMEOUT);

			req.query = {
				document: "true",
				pagination: "true",
				count: "true",
			};

			await estimationController.getAll(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("estimations");
			expect(sentData.data.estimations).to.be.an("array");
		});

		it("should handle search query", async function () {
			this.timeout(TEST_TIMEOUT);

			req.query = {
				query: "EST-2025",
				document: "true",
			};

			await estimationController.getAll(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe("getById", () => {
		it("should retrieve estimation by id", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = { id: "607f1f77bcf86cd799439101" };

			await estimationController.getById(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("estimationNumber");
		});

		it("should return 404 if estimation not found", async function () {
			this.timeout(TEST_TIMEOUT);

			prisma.estimation.findFirst = async () => null;
			req.params = { id: "nonexistent_id" };

			await estimationController.getById(req as Request, res, next);

			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should return 500 if id is missing", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = {};
			req.query = { document: "true" };

			await estimationController.getById(req as Request, res, next);

			expect(statusCode).to.equal(500);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe("update", () => {
		it("should update estimation successfully", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = { id: "607f1f77bcf86cd799439101" };
			req.body = {
				marginPercentage: 30.0,
				notes: "Updated margin percentage",
			};

			await estimationController.update(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return 404 if estimation not found", async function () {
			this.timeout(TEST_TIMEOUT);

			prisma.estimation.findFirst = async () => null;
			req.params = { id: "nonexistent_id" };
			req.body = { marginPercentage: 30.0 };

			await estimationController.update(req as Request, res, next);

			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe("remove", () => {
		it("should delete estimation successfully", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = { id: "607f1f77bcf86cd799439101" };

			await estimationController.remove(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return 404 if estimation not found", async function () {
			this.timeout(TEST_TIMEOUT);

			prisma.estimation.findFirst = async () => null;
			req.params = { id: "nonexistent_id" };

			await estimationController.remove(req as Request, res, next);

			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});
	});
});
