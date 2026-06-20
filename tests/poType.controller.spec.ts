import { controller } from "../app/poType/poType.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("POType Controller", () => {
	let poTypeController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockPOType = {
		id: "507f1f77bcf86cd799439501",
		workspaceId: "507f1f77bcf86cd799439001",
		code: "S",
		name: "Service",
		description: "Service-based purchase orders for professional services",
		isDefault: false,
		requiresDelivery: false,
		requiresInspection: false,
		allowsPartialDelivery: true,
		autoCreateInvoice: true,
		invoiceTrigger: "ON_COMPLETION",
		status: "ACTIVE",
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockPOTypes = [
		mockPOType,
		{
			...mockPOType,
			id: "507f1f77bcf86cd799439502",
			code: "P",
			name: "Product",
			description: "Product-based purchase orders for physical goods",
			requiresDelivery: true,
			requiresInspection: true,
			autoCreateInvoice: false,
			invoiceTrigger: "ON_DELIVERY",
		},
		{
			...mockPOType,
			id: "507f1f77bcf86cd799439503",
			code: "M",
			name: "Mixed",
			description: "Mixed purchase orders combining services and products",
			requiresDelivery: true,
			isDefault: true,
		},
	];

	beforeEach(() => {
		prisma = {
			pOType: {
				findMany: async (_params: Prisma.POTypeFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockPOTypes;
					}
					return [mockPOType];
				},
				count: async (_params: Prisma.POTypeCountArgs) => {
					if (req.query?.groupBy) {
						return mockPOTypes.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.POTypeFindFirstArgs) =>
					params.where?.id === mockPOType.id ? mockPOType : null,
				findUnique: async (params: Prisma.POTypeFindUniqueArgs) =>
					params.where?.id === mockPOType.id ? mockPOType : null,
				create: async (params: Prisma.POTypeCreateArgs) => ({
					...mockPOType,
					...params.data,
				}),
				update: async (params: Prisma.POTypeUpdateArgs) => ({
					...mockPOType,
					...params.data,
				}),
				delete: async (params: Prisma.POTypeDeleteArgs) => ({
					...mockPOType,
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

		poTypeController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/po-type",
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
		it("should return paginated PO types", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await poTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group PO types by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await poTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("poTypes");
			expect(sentData.data).to.have.property("groupedBy", "status");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await poTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a PO type", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPOType.id };
			await poTypeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockPOType.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await poTypeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent PO type", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await poTypeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new PO type", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				code: "C",
				name: "Consumables",
				description: "For consumable items",
				requiresDelivery: true,
			};
			req.body = createData;
			await poTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});
	});

	describe(".update()", () => {
		it("should update PO type details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				name: "Service (Updated)",
				autoCreateInvoice: false,
			};
			req.params = { id: mockPOType.id };
			req.body = updateData;
			await poTypeController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("poType");
		});

		it("should handle non-existent PO type update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = { status: "INACTIVE" };
			req.params = { id: "507f1f77bcf86cd799439999" };
			req.body = updateData;
			await poTypeController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete a PO type", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockPOType.id };
			await poTypeController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent PO type deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await poTypeController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
