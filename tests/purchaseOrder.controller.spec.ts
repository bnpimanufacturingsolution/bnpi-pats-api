import { controller } from "../app/purchaseOrder/purchaseOrder.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("PurchaseOrder Controller", () => {
	let purchaseOrderController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockPurchaseOrder = {
		id: "507f1f77bcf86cd799439101",
		poNumber: "PO-2025-001",
		workspaceId: "507f1f77bcf86cd799439001",
		vendorId: "507f1f77bcf86cd799439051",
		estimationId: "507f1f77bcf86cd799439025",
		projectId: "507f1f77bcf86cd799439010",
		orderDate: new Date("2025-01-15"),
		expectedDeliveryDate: new Date("2025-02-15"),
		approvalDate: new Date("2025-01-16"),
		requestedBy: "John Smith",
		approvedBy: "Jane Doe",
		items: [
			{
				description: "Dell Latitude 7430 Laptop",
				quantity: 10,
				unitPrice: 1200.00,
				totalPrice: 12000.00,
				remarks: "For IT department"
			}
		],
		subtotal: 12000.00,
		taxPercentage: 12,
		taxAmount: 1440.00,
		discountAmount: 0,
		totalAmount: 13440.00,
		currency: "PHP",
		paymentTermId: "a07f1f77bcf86cd799439405",
		shippingTerms: "FOB Destination",
		deliveryAddress: "123 Main St, Manila",
		termsConditions: "Standard terms apply",
		status: "APPROVED",
		remarks: "Urgent order",
		documentUrls: [],
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockPurchaseOrders = [
		mockPurchaseOrder,
		{
			...mockPurchaseOrder,
			id: "507f1f77bcf86cd799439103",
			poNumber: "PO-2025-003",
			status: "COMPLETED",
		},
	];

	beforeEach(() => {
		prisma = {
			purchaseOrder: {
				findMany: async (_params: Prisma.PurchaseOrderFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockPurchaseOrders;
					}
					return [mockPurchaseOrder];
				},
				count: async (_params: Prisma.PurchaseOrderCountArgs) => {
					if (req.query?.groupBy) {
						return mockPurchaseOrders.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.PurchaseOrderFindFirstArgs) =>
					params.where?.id === mockPurchaseOrder.id ? mockPurchaseOrder : null,
				findUnique: async (params: Prisma.PurchaseOrderFindUniqueArgs) =>
					params.where?.id === mockPurchaseOrder.id ? mockPurchaseOrder : null,
				create: async (params: Prisma.PurchaseOrderCreateArgs) => ({
					...mockPurchaseOrder,
					...params.data,
				}),
				update: async (params: Prisma.PurchaseOrderUpdateArgs) => ({
					...mockPurchaseOrder,
					...params.data,
				}),
				delete: async (params: Prisma.PurchaseOrderDeleteArgs) => ({
					...mockPurchaseOrder,
					id: params.where.id,
				}),
			},
			paymentSchedule: {
				findFirst: async () => null,
				create: async (params: any) => ({
					id: "b07f1f77bcf86cd799439501",
					...params.data,
				}),
				update: async (params: any) => ({
					id: params.where.id,
					...params.data,
				}),
			},
			paymentTerm: {
				findFirst: async () => null,
			},
			item: {
				findMany: async () => [],
				findUnique: async () => null,
				update: async (params: any) => ({ id: params.where.id }),
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		purchaseOrderController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/purchase-order",
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
		it("should return paginated purchase orders", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await purchaseOrderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group purchase orders by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await purchaseOrderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("purchaseOrders");
			expect(sentData.data).to.have.property("groupedBy", "status");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await purchaseOrderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a purchase order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPurchaseOrder.id };
			await purchaseOrderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockPurchaseOrder.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await purchaseOrderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent purchase order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await purchaseOrderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new purchase order", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				poNumber: "PO-2025-004",
				vendorId: "507f1f77bcf86cd799439051",
				items: [
					{
						description: "HP Monitor 27\"",
						quantity: 5,
						unitPrice: 500,
						totalPrice: 2500,
					}
				],
				subtotal: 2500,
				totalAmount: 2500,
			};
			req.body = createData;
			await purchaseOrderController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});
	});

	describe(".update()", () => {
		it("should update purchase order details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "SENT",
				remarks: "Updated remarks",
			};
			req.params = { id: mockPurchaseOrder.id };
			req.body = updateData;
			await purchaseOrderController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("purchaseOrder");
		});

		it("should handle non-existent purchase order update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = { status: "CANCELLED" };
			req.params = { id: "507f1f77bcf86cd799439999" };
			req.body = updateData;
			await purchaseOrderController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete a purchase order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPurchaseOrder.id };
			await purchaseOrderController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent purchase order deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await purchaseOrderController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
