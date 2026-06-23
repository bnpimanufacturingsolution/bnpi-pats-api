import { controller } from "../app/product/product.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Product Controller", () => {
	let productController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockProduct = {
		id: "507f1f77bcf86cd799439126",
		workspaceId: "507f1f77bcf86cd799439011",
		code: "TOY-A",
		name: "Toy A",
		description: "Starter toy car",
		brand: "Bandai PATS",
		category: "Toys",
		variant: "Starter",
		unitOfMeasure: "PCS",
		revision: "A",
		status: "ACTIVE",
		tags: ["toy", "starter"],
		metadata: { targetMarket: "Retail" },
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		productionSteps: [],
		materials: [],
		costAssumptions: [],
	};

	beforeEach(() => {
		prisma = {
			product: {
				findMany: async (_params: any) => [mockProduct],
				count: async (_params: any) => 1,
				findFirst: async (params: any) =>
					params.where?.id === mockProduct.id ? mockProduct : null,
				create: async (params: any) => ({ ...mockProduct, ...params.data }),
				update: async (params: any) => ({ ...mockProduct, ...params.data }),
			},
		};

		productController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/product",
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
					sentData = { status: "error", message: err.message || "Internal server error", code: 500 };
				}
			}
		}) as NextFunction;
	});

	describe(".getAll()", () => {
		it("should return paginated products", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await productController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});
	});

	describe(".getById()", () => {
		it("should return a product", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockProduct.id };
			await productController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockProduct.id });
		});
	});

	describe(".create()", () => {
		it("should create a new product", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Toy D",
				description: "Demo product",
				brand: "Bandai PATS",
			};
			await productController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
			expect(sentData.data).to.have.property("code");
		});
	});

	describe(".update()", () => {
		it("should update product details", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockProduct.id };
			req.body = { status: "INACTIVE" };
			await productController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});
	});

	describe(".remove()", () => {
		it("should delete a product", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockProduct.id };
			await productController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe(".generateCode()", () => {
		it("should generate a product code", async function () {
			this.timeout(TEST_TIMEOUT);
			await productController.generateCode(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("code");
		});
	});
});
