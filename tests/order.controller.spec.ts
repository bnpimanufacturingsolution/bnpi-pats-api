import { controller } from "../app/order/order.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Order Controller", () => {
	let orderController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;
	const mockOrder = {
		id: "507f1f77bcf86cd799439026",
		orderNumber: "OR-001",
		estimationId: "507f1f77bcf86cd799439025",
		vendorId: "507f1f77bcf86cd799439030",
		itemName: "Laptops",
		quantity: 10,
		deliveryDate: new Date("2024-12-15"),
		receivedBy: "John Doe",
		condition: "GOOD",
		hasWarranty: true,
		warrantyDetails: "2 years manufacturer warranty",
		status: "RECEIVED",
		remarks: "All items received in good condition",
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockOrders = [
		{
			id: "507f1f77bcf86cd799439026",
			orderNumber: "OR-001",
			estimationId: "507f1f77bcf86cd799439025",
			vendorId: "507f1f77bcf86cd799439030",
			itemName: "Laptops",
			quantity: 10,
			deliveryDate: new Date("2024-12-15"),
			receivedBy: "John Doe",
			condition: "GOOD",
			hasWarranty: true,
			warrantyDetails: "2 years manufacturer warranty",
			status: "RECEIVED",
			remarks: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439027",
			orderNumber: "OR-002",
			estimationId: "507f1f77bcf86cd799439025",
			vendorId: null,
			itemName: "Office Chairs",
			quantity: 20,
			deliveryDate: null,
			receivedBy: null,
			condition: "GOOD",
			hasWarranty: false,
			warrantyDetails: null,
			status: "PENDING",
			remarks: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439028",
			orderNumber: "OR-003",
			estimationId: "507f1f77bcf86cd799439025",
			vendorId: "507f1f77bcf86cd799439031",
			itemName: "Monitors",
			quantity: 15,
			deliveryDate: new Date("2024-12-20"),
			receivedBy: "Jane Smith",
			condition: "DAMAGED",
			hasWarranty: true,
			warrantyDetails: "1 year warranty",
			status: "PARTIAL",
			remarks: "3 units damaged during shipping",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			order: {
				findMany: async (_params: Prisma.OrderFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockOrders;
					}
					return [mockOrder];
				},
				count: async (_params: Prisma.OrderCountArgs) => {
					if (req.query?.groupBy) {
						return mockOrders.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.OrderFindFirstArgs) =>
					params.where?.id === mockOrder.id ? mockOrder : null,
				findUnique: async (params: Prisma.OrderFindUniqueArgs) =>
					params.where?.id === mockOrder.id ? mockOrder : null,
				create: async (params: Prisma.OrderCreateArgs) => ({
					...mockOrder,
					...params.data,
				}),
				update: async (params: Prisma.OrderUpdateArgs) => ({
					...mockOrder,
					...params.data,
				}),
				delete: async (params: Prisma.OrderDeleteArgs) => ({
					...mockOrder,
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

		orderController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/order",
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
		it("should return paginated orders", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await orderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group orders by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await orderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("orders");
			expect(sentData.data).to.have.property("groupedBy", "status");
			expect(sentData.data.orders).to.be.an("object");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await orderController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return an order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockOrder.id };
			await orderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockOrder.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await orderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await orderController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new order", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				orderNumber: "OR-004",
				estimationId: "507f1f77bcf86cd799439025",
				itemName: "Desks",
				quantity: 5,
			};
			req.body = createData;
			await orderController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});

		it.skip("should handle validation errors (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				orderNumber: "",
				estimationId: "507f1f77bcf86cd799439025",
				itemName: "Desks",
			};
			req.body = createData;
			await orderController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".update()", () => {
		it("should update order details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "RECEIVED",
				receivedBy: "John Doe",
			};
			req.params = { id: mockOrder.id };
			req.body = updateData;
			await orderController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("order");
			expect(sentData.data.order).to.have.property("id");
		});

		it("should handle non-existent order update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "CANCELLED",
			};
			req.params = { id: "507f1f77bcf86cd799439099" };
			req.body = updateData;
			await orderController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete an order", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockOrder.id };
			await orderController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent order deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await orderController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
