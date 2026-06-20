import { controller } from "../app/deliveryOrder/deliveryOrder.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("DeliveryOrder Controller", () => {
	let deliveryOrderController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockDeliveryOrder = {
		id: "507f1f77bcf86cd799439201",
		doNumber: "DO-2025-001",
		workspaceId: "507f1f77bcf86cd799439001",
		purchaseOrderId: "507f1f77bcf86cd799439101",
		vendorId: "507f1f77bcf86cd799439051",
		deliveryDate: new Date("2025-02-15"),
		receivedDate: new Date("2025-02-15"),
		dispatchDate: new Date("2025-02-14"),
		deliveryAddress: "123 Main St, Manila",
		trackingNumber: "TRK-2025-001234",
		carrier: "LBC Express",
		receivedBy: "John Smith",
		receiverContact: "+63-917-123-4567",
		receiverSignature: null,
		items: [
			{
				itemId: "507f1f77bcf86cd799439201",
				poItemIndex: 0,
				description: "Dell Latitude 7430 Laptop",
				orderedQuantity: 10,
				deliveredQuantity: 10,
				receivedQuantity: 10,
				condition: "GOOD",
				remarks: "All items in good condition"
			}
		],
		inspectedBy: "Jane Doe",
		inspectionDate: new Date("2025-02-15"),
		inspectionNotes: "All items checked and verified",
		status: "DELIVERED",
		remarks: "Delivery completed successfully",
		documentUrls: [],
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockDeliveryOrders = [
		mockDeliveryOrder,
		{
			...mockDeliveryOrder,
			id: "507f1f77bcf86cd799439202",
			doNumber: "DO-2025-002",
			status: "PENDING",
		},
		{
			...mockDeliveryOrder,
			id: "507f1f77bcf86cd799439203",
			doNumber: "DO-2025-003",
			status: "IN_TRANSIT",
		},
	];

	beforeEach(() => {
		prisma = {
			deliveryOrder: {
				findMany: async (_params: Prisma.DeliveryOrderFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockDeliveryOrders;
					}
					return [mockDeliveryOrder];
				},
				count: async (_params: Prisma.DeliveryOrderCountArgs) => {
					if (req.query?.groupBy) {
						return mockDeliveryOrders.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.DeliveryOrderFindFirstArgs) =>
					params.where?.id === mockDeliveryOrder.id ? mockDeliveryOrder : null,
				findUnique: async (params: Prisma.DeliveryOrderFindUniqueArgs) =>
					params.where?.id === mockDeliveryOrder.id ? mockDeliveryOrder : null,
				create: async (params: Prisma.DeliveryOrderCreateArgs) => ({
					...mockDeliveryOrder,
					...params.data,
				}),
				update: async (params: Prisma.DeliveryOrderUpdateArgs) => ({
					...mockDeliveryOrder,
					...params.data,
				}),
				delete: async (params: Prisma.DeliveryOrderDeleteArgs) => ({
					...mockDeliveryOrder,
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

		deliveryOrderController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/delivery-order",
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
		it("should return paginated delivery orders", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await deliveryOrderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group delivery orders by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await deliveryOrderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("deliveryOrders");
			expect(sentData.data).to.have.property("groupedBy", "status");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await deliveryOrderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a delivery order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockDeliveryOrder.id };
			await deliveryOrderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockDeliveryOrder.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await deliveryOrderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent delivery order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await deliveryOrderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new delivery order", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				doNumber: "DO-2025-004",
				purchaseOrderId: "507f1f77bcf86cd799439101",
				vendorId: "507f1f77bcf86cd799439051",
				items: [
					{
						description: "HP Monitor 27\"",
						orderedQuantity: 5,
						deliveredQuantity: 5,
						condition: "GOOD",
					}
				],
			};
			req.body = createData;
			await deliveryOrderController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});
	});

	describe(".update()", () => {
		it("should update delivery order details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "DELIVERED",
				receivedBy: "Updated Receiver",
			};
			req.params = { id: mockDeliveryOrder.id };
			req.body = updateData;
			await deliveryOrderController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("deliveryOrder");
		});

		it("should handle non-existent delivery order update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = { status: "CANCELLED" };
			req.params = { id: "507f1f77bcf86cd799439999" };
			req.body = updateData;
			await deliveryOrderController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete a delivery order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockDeliveryOrder.id };
			await deliveryOrderController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent delivery order deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await deliveryOrderController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
