import { controller } from "../app/transaction/transaction.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Transaction Controller", () => {
	let transactionController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockTransaction = {
		id: "a08f1f77bcf86cd799440001",
		transactionNumber: "PRJ-001-TOUT-2025-0001",
		transactionDate: new Date("2025-01-15"),
		projectId: "507f1f77bcf86cd799439025",
		itemId: "608f1f77bcf86cd799450001",
		transactionType: "OUTGOING",
		payeeName: "ABC Construction Inc.",
		amount: 15000.0,
		bankName: "First National Bank",
		accountNumber: "****1234",
		status: "CLEARED",
		clearedDate: new Date("2025-01-18"),
		bouncedDate: null,
		bouncedReason: null,
		paymentScheduleId: null,
		paymentScheduleItemIndex: null,
		documentUrls: [],
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockTransactions = [
		{
			id: "a08f1f77bcf86cd799440001",
			transactionNumber: "PRJ-001-TOUT-2025-0001",
			transactionDate: new Date("2025-01-15"),
			projectId: "507f1f77bcf86cd799439025",
			itemId: "608f1f77bcf86cd799450001",
			transactionType: "OUTGOING",
			payeeName: "ABC Construction Inc.",
			amount: 15000.0,
			bankName: "First National Bank",
			accountNumber: "****1234",
			status: "CLEARED",
			clearedDate: new Date("2025-01-18"),
			bouncedDate: null,
			bouncedReason: null,
			documentUrls: [],
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "a08f1f77bcf86cd799440002",
			transactionNumber: "PRJ-001-TIN-2025-0001",
			transactionDate: new Date("2025-01-20"),
			projectId: "507f1f77bcf86cd799439025",
			itemId: null,
			transactionType: "INCOMING",
			payeeName: "Client ABC Corp",
			amount: 50000.0,
			bankName: "Metro Bank",
			accountNumber: "****5678",
			status: "CLEARED",
			clearedDate: new Date("2025-01-22"),
			bouncedDate: null,
			bouncedReason: null,
			documentUrls: [],
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "a08f1f77bcf86cd799440003",
			transactionNumber: "PRJ-002-TOUT-2025-0001",
			transactionDate: new Date("2025-01-25"),
			projectId: "507f1f77bcf86cd799439026",
			itemId: "608f1f77bcf86cd799450002",
			transactionType: "OUTGOING",
			payeeName: "Tech Solutions Pro",
			amount: 12000.0,
			bankName: "City Bank",
			accountNumber: "****9012",
			status: "BOUNCED",
			clearedDate: null,
			bouncedDate: new Date("2025-01-28"),
			bouncedReason: "Insufficient funds",
			documentUrls: [],
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			transaction: {
				findMany: async (_params: Prisma.TransactionFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockTransactions;
					}
					return [mockTransaction];
				},
				count: async (_params: Prisma.TransactionCountArgs) => {
					if (req.query?.groupBy) {
						return mockTransactions.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.TransactionFindFirstArgs) =>
					params.where?.id === mockTransaction.id ? mockTransaction : null,
				findUnique: async (params: Prisma.TransactionFindUniqueArgs) =>
					params.where?.id === mockTransaction.id ? mockTransaction : null,
				create: async (params: Prisma.TransactionCreateArgs) => ({
					...mockTransaction,
					...params.data,
				}),
				update: async (params: Prisma.TransactionUpdateArgs) => ({
					...mockTransaction,
					...params.data,
				}),
				delete: async (params: Prisma.TransactionDeleteArgs) => ({
					...mockTransaction,
					id: params.where.id,
				}),
			},
			item: {
				findUnique: async (params: any) => {
					const itemId = params.where?.id;
					const mockItems: Record<string, any> = {
						"608f1f77bcf86cd799450001": {
							id: "608f1f77bcf86cd799450001",
							itemName: "Test Item 1",
							status: "ACTIVE",
							estimatedTotal: 100000,
							estimatedQuantity: 1,
							estimatedUnitPrice: 100000,
							estimation: { status: "APPROVED" },
							childItems: [],
							version: 1,
						},
						"608f1f77bcf86cd799450002": {
							id: "608f1f77bcf86cd799450002",
							itemName: "Test Item 2",
							status: "ACTIVE",
							estimatedTotal: 80000,
							estimatedQuantity: 1,
							estimatedUnitPrice: 80000,
							estimation: { status: "APPROVED" },
							childItems: [],
							version: 1,
						},
						"608f1f77bcf86cd799450003": {
							id: "608f1f77bcf86cd799450003",
							itemName: "Test Item 3",
							status: "ACTIVE",
							estimatedTotal: 50000,
							estimatedQuantity: 1,
							estimatedUnitPrice: 50000,
							estimation: { status: "APPROVED" },
							childItems: [],
							version: 1,
						},
					};
					return mockItems[itemId] || null;
				},
				findMany: async (params: any) => {
					const itemIds = params.where?.id?.in || [];
					const allItems = [
						{
							id: "608f1f77bcf86cd799450001",
							itemName: "Test Item 1",
							status: "ACTIVE",
							estimatedTotal: 100000,
							estimatedQuantity: 1,
							estimatedUnitPrice: 100000,
							estimation: { status: "APPROVED" },
							childItems: [],
							version: 1,
						},
						{
							id: "608f1f77bcf86cd799450002",
							itemName: "Test Item 2",
							status: "ACTIVE",
							estimatedTotal: 80000,
							estimatedQuantity: 1,
							estimatedUnitPrice: 80000,
							estimation: { status: "APPROVED" },
							childItems: [],
							version: 1,
						},
						{
							id: "608f1f77bcf86cd799450003",
							itemName: "Test Item 3",
							status: "ACTIVE",
							estimatedTotal: 50000,
							estimatedQuantity: 1,
							estimatedUnitPrice: 50000,
							estimation: { status: "APPROVED" },
							childItems: [],
							version: 1,
						},
					];
					if (itemIds.length > 0) {
						return allItems.filter((item: any) => itemIds.includes(item.id));
					}
					return allItems;
				},
				updateMany: async () => ({ count: 1 }),
				update: async (params: any) => ({
					id: params.where.id,
					actualTotal: 100,
				}),
			},
			project: {
				findUnique: async () => ({
					id: "507f1f77bcf86cd799439025",
					code: "PRJ-001",
					status: "ACTIVE",
					startDate: new Date("2025-01-01"),
					endDate: new Date("2026-01-01"),
					metaData: {},
				}),
				update: async (params: any) => ({
					id: params.where.id,
					...params.data,
				}),
			},
			estimation: {
				findMany: async () => [],
				findUnique: async () => ({
					id: "607f1f77bcf86cd799439001",
					marginPercentage: 15,
					projectId: "507f1f77bcf86cd799439025",
					metaData: {},
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
					current: (params.update.current?.increment || 0) + 1,
				}),
			},
			$transaction: async (operations: any, options?: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		transactionController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/transaction",
			user: { id: "user123", role: "ADMIN" },
		} as any;
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
		next = (err?: any) => {
			if (err) {
				statusCode = err.message && err.message.includes("not found") ? 404 : 400;
				sentData = { status: "error", message: err.message, code: statusCode };
			}
		};
	});

	describe(".getAll()", () => {
		it("should return paginated transactions", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await transactionController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group transactions by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await transactionController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("transactions");
			expect(sentData.data).to.have.property("groupedBy", "status");
			expect(sentData.data.transactions).to.be.an("object");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await transactionController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a transaction", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockTransaction.id };
			await transactionController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockTransaction.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await transactionController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent transaction", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "a08f1f77bcf86cd799440099" };
			await transactionController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new transaction", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				transactionNumber: "PRJ-001-TOUT-2025-015",
				transactionDate: new Date("2025-02-01"),
				projectId: "507f1f77bcf86cd799439025",
				itemId: "608f1f77bcf86cd799450003",
				transactionType: "OUTGOING",
				payeeName: "New Vendor Inc.",
				amount: 10000.0,
				bankName: "Trust Bank",
				accountNumber: "****3456",
				status: "PENDING",
			};
			req.body = createData;
			await transactionController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data.transaction).to.have.property("id");
		});

		it("should handle validation errors", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				transactionNumber: "",
				projectId: "507f1f77bcf86cd799439025",
				payeeName: "Test Vendor",
			};
			req.body = createData;
			await transactionController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".update()", () => {
		it("should update transaction status to CLEARED", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "CLEARED",
				clearedDate: new Date("2025-01-20"),
			};
			req.params = { id: mockTransaction.id };
			req.body = updateData;
			await transactionController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("transaction");
			expect(sentData.data.transaction).to.have.property("id");
		});

		it("should update transaction status to BOUNCED with reason", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "BOUNCED",
				bouncedDate: new Date("2025-01-22"),
				bouncedReason: "Insufficient funds",
			};
			req.params = { id: mockTransaction.id };
			req.body = updateData;
			await transactionController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent transaction update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "CLEARED",
			};
			req.params = { id: "a08f1f77bcf86cd799440099" };
			req.body = updateData;
			await transactionController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should soft delete a transaction", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockTransaction.id };
			await transactionController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent transaction deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "a08f1f77bcf86cd799440099" };
			await transactionController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
