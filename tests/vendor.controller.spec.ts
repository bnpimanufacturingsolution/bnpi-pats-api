import { controller } from "../app/vendor/vendor.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Vendor Controller", () => {
	let vendorController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;
	const mockVendor = {
		id: "507f1f77bcf86cd799439026",
		vendorId: "V001",
		name: "Tech Solutions Inc.",
		contactPerson: "John Smith",
		email: "john@techsolutions.com",
		phone: "+1-555-0123",
		address: "123 Main St, Tech City, TC 12345",
		notes: "Preferred vendor for hardware equipment",
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockVendors = [
		{
			id: "507f1f77bcf86cd799439026",
			vendorId: "V001",
			name: "Tech Solutions Inc.",
			contactPerson: "John Smith",
			email: "john@techsolutions.com",
			phone: "+1-555-0123",
			address: "123 Main St, Tech City, TC 12345",
			notes: "Preferred vendor for hardware equipment",
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439027",
			vendorId: "V002",
			name: "Office Supplies Co.",
			contactPerson: "Jane Doe",
			email: "jane@officesupplies.com",
			phone: "+1-555-0456",
			address: null,
			notes: null,
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439028",
			vendorId: "V003",
			name: "Furniture Warehouse Ltd.",
			contactPerson: null,
			email: null,
			phone: "+1-555-0789",
			address: "456 Oak Ave, Furniture Town, FT 67890",
			notes: "Bulk discount available",
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			vendor: {
				findMany: async (_params: Prisma.VendorFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockVendors;
					}
					return [mockVendor];
				},
				count: async (_params: Prisma.VendorCountArgs) => {
					if (req.query?.groupBy) {
						return mockVendors.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.VendorFindFirstArgs) =>
					params.where?.id === mockVendor.id ? mockVendor : null,
				findUnique: async (params: Prisma.VendorFindUniqueArgs) =>
					params.where?.id === mockVendor.id ? mockVendor : null,
				create: async (params: Prisma.VendorCreateArgs) => ({
					...mockVendor,
					...params.data,
				}),
				update: async (params: Prisma.VendorUpdateArgs) => ({
					...mockVendor,
					...params.data,
				}),
				delete: async (params: Prisma.VendorDeleteArgs) => ({
					...mockVendor,
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

		vendorController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/vendor",
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
		it("should return paginated vendors", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await vendorController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group vendors by vendorId field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "vendorId", document: "true" };
			await vendorController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("vendors");
			expect(sentData.data).to.have.property("groupedBy", "vendorId");
			expect(sentData.data.vendors).to.be.an("object");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await vendorController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a vendor", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockVendor.id };
			await vendorController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockVendor.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await vendorController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent vendor", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await vendorController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new vendor", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				vendorId: "V004",
				name: "Software Systems LLC",
				contactPerson: "Bob Johnson",
				email: "bob@softwaresystems.com",
				phone: "+1-555-1234",
			};
			req.body = createData;
			await vendorController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});

		it.skip("should handle validation errors (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				vendorId: "",
				name: "Test Vendor",
			};
			req.body = createData;
			await vendorController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".update()", () => {
		it("should update vendor details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				contactPerson: "John Smith Jr.",
				email: "johnsmith@techsolutions.com",
			};
			req.params = { id: mockVendor.id };
			req.body = updateData;
			await vendorController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("vendor");
			expect(sentData.data.vendor).to.have.property("id");
		});

		it("should handle non-existent vendor update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				phone: "+1-555-9999",
			};
			req.params = { id: "507f1f77bcf86cd799439099" };
			req.body = updateData;
			await vendorController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete a vendor", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockVendor.id };
			await vendorController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent vendor deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await vendorController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
