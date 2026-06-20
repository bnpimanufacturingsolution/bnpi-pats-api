import { controller } from "../app/field/field.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Field Controller", () => {
	let fieldController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockField = {
		id: "608f1f77bcf86cd799440001",
		name: "Project Code",
		type: "singletext",
		category: "common",
		value: null,
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockFields = [
		{
			id: "608f1f77bcf86cd799440001",
			name: "Project Code",
			type: "singletext",
			category: "common",
			value: null,
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "608f1f77bcf86cd799440002",
			name: "Priority Level",
			type: "number",
			category: "common",
			value: { min: 1, max: 5, default: 3 },
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "608f1f77bcf86cd799440003",
			name: "Technical Specifications",
			type: "multitext",
			category: "custom",
			value: null,
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			field: {
				findMany: async (_params: Prisma.FieldFindManyArgs) => mockFields,
				count: async (_params: Prisma.FieldCountArgs) => mockFields.length,
				findFirst: async (params: Prisma.FieldFindFirstArgs) =>
					params.where?.id === mockField.id ? mockField : null,
				create: async (params: Prisma.FieldCreateArgs) => ({
					...mockField,
					...params.data,
					id: "608f1f77bcf86cd799440999",
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
				update: async (params: Prisma.FieldUpdateArgs) => ({
					...mockField,
					...params.data,
					updatedAt: new Date(),
				}),
			},
		};

		fieldController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/field",
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

	describe(".create()", () => {
		it("should create a new field with valid data", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Custom Field",
				type: "singletext",
				category: "custom",
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("name", "Custom Field");
		});

		it("should create a field with value property", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Priority Level",
				type: "number",
				category: "common",
				value: { min: 1, max: 10 },
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("value");
		});

		it.skip("should return 400 for invalid field type (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Invalid Field",
				type: "invalidtype",
				category: "common",
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 for invalid category (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Invalid Field",
				type: "singletext",
				category: "invalidcategory",
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 when name is missing (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				type: "singletext",
				category: "common",
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getAll()", () => {
		it("should return all fields", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await fieldController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("fields");
			expect(sentData.data.fields).to.be.an("array");
		});

		it("should filter fields by category", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { filter: "category:common", document: "true" };
			await fieldController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should search fields by name", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { search: "Project", document: "true" };
			await fieldController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return paginated results with count", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", count: "true", document: "true", pagination: "true" };
			await fieldController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("pagination");
		});

		it("should sort fields by name", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { sort: "name", order: "asc", document: "true" };
			await fieldController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe(".getById()", () => {
		it("should return a field by ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440001" };
			await fieldController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("id", "608f1f77bcf86cd799440001");
		});

		it("should return 404 for non-existent field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440999" };
			await fieldController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData.message).to.include("Field not found");
		});
	});

	describe(".update()", () => {
		it("should update a field successfully", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440001" };
			req.body = { name: "Updated Field Name" };

			// Mock update to return existing and updated field
			prisma.field.findFirst = async () => mockField;
			prisma.field.update = async (params: Prisma.FieldUpdateArgs) => ({
				...mockField,
				...params.data,
				updatedAt: new Date(),
			});

			await fieldController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should update field value", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440001" };
			req.body = {
				value: { options: ["Option1", "Option2", "Option3"] },
			};

			prisma.field.findFirst = async () => mockField;
			prisma.field.update = async (params: Prisma.FieldUpdateArgs) => ({
				...mockField,
				...params.data,
				updatedAt: new Date(),
			});

			await fieldController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return 404 for non-existent field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440999" };
			req.body = { name: "Updated Name" };

			prisma.field.findFirst = async () => null;

			await fieldController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 for invalid data (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440001" };
			req.body = { type: "invalidtype" };

			await fieldController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".remove()", () => {
		it("should soft delete a field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440001" };

			prisma.field.findFirst = async () => mockField;
			prisma.field.update = async (params: Prisma.FieldUpdateArgs) => ({
				...mockField,
				isDeleted: true,
				updatedAt: new Date(),
			});

			await fieldController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("message", "Field deleted successfully");
		});

		it("should return 404 for non-existent field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799440999" };

			prisma.field.findFirst = async () => null;

			await fieldController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData.message).to.include("Field not found");
		});
	});

	describe("Field Types", () => {
		it("should create a singleselect field with options", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Risk Level",
				type: "singleselect",
				category: "common",
				value: { options: ["Low", "Medium", "High"] },
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});

		it("should create a calculated field with formula", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Performance Metric",
				type: "calculated",
				category: "custom",
				value: { formula: "actual / estimated * 100" },
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});

		it("should create an iteration field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Sprint Iteration",
				type: "iteration",
				category: "custom",
				value: { duration: 2, unit: "weeks" },
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});

		it("should create an object field with schema", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Configuration",
				type: "object",
				category: "custom",
				value: { schema: { cpu: "string", memory: "number" } },
			};
			await fieldController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});
	});
});
