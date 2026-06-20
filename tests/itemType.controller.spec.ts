import { controller } from "../app/itemType/itemType.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("ItemType Controller", () => {
	let itemTypeController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockItemType = {
		id: "608f1f77bcf86cd799450001",
		name: "Task",
		description: "Standard task item for project activities",
		icon: "task",
		defaultFields: [],
		status: "ACTIVE",
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockItemTypes = [
		{
			id: "608f1f77bcf86cd799450001",
			name: "Task",
			description: "Standard task item for project activities",
			icon: "task",
			defaultFields: [],
			status: "ACTIVE",
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "608f1f77bcf86cd799450002",
			name: "Bug",
			description: "Bug or issue tracking item",
			icon: "bug",
			defaultFields: [],
			status: "ACTIVE",
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "608f1f77bcf86cd799450003",
			name: "Feature",
			description: "New feature development item",
			icon: "feature",
			defaultFields: [],
			status: "ACTIVE",
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			itemType: {
				findMany: async (_params: Prisma.ItemTypeFindManyArgs) => mockItemTypes,
				count: async (_params: Prisma.ItemTypeCountArgs) => mockItemTypes.length,
				findFirst: async (params: Prisma.ItemTypeFindFirstArgs) =>
					params.where?.id === mockItemType.id ? mockItemType : null,
				create: async (params: Prisma.ItemTypeCreateArgs) => ({
					...mockItemType,
					...params.data,
					id: "608f1f77bcf86cd799450999",
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
				update: async (params: Prisma.ItemTypeUpdateArgs) => ({
					...mockItemType,
					...params.data,
					updatedAt: new Date(),
				}),
			},
		};

		itemTypeController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/item-type",
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
		it("should create a new itemType with valid data", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Epic",
				description: "Large body of work",
				icon: "epic",
				status: "ACTIVE",
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("name", "Epic");
		});

		it("should create an itemType without optional fields", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Story",
				status: "ACTIVE",
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("name", "Story");
		});

		it.skip("should return 400 for invalid status (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Invalid ItemType",
				status: "INVALID_STATUS",
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 when name is missing (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				description: "Missing name",
				status: "ACTIVE",
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 when status is missing (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Missing Status",
				description: "No status provided",
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getAll()", () => {
		it("should return all itemTypes", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await itemTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("itemTypes");
			expect(sentData.data.itemTypes).to.be.an("array");
		});

		it("should filter itemTypes by status", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { filter: "status:ACTIVE", document: "true" };
			await itemTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should search itemTypes by name", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { search: "Task", document: "true" };
			await itemTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return paginated results with count", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", count: "true", document: "true", pagination: "true" };
			await itemTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("pagination");
		});

		it("should sort itemTypes by name", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { sort: "name", order: "asc", document: "true" };
			await itemTypeController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe(".getById()", () => {
		it("should return an itemType by ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450001" };
			await itemTypeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("id", "608f1f77bcf86cd799450001");
		});

		it("should return 404 for non-existent itemType", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450999" };
			await itemTypeController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData.message).to.include("ItemType not found");
		});
	});

	describe(".update()", () => {
		it("should update an itemType successfully", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450001" };
			req.body = { name: "Updated Task" };

			// Mock update to return existing and updated itemType
			prisma.itemType.findFirst = async () => mockItemType;
			prisma.itemType.update = async (params: Prisma.ItemTypeUpdateArgs) => ({
				...mockItemType,
				...params.data,
				updatedAt: new Date(),
			});

			await itemTypeController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should update itemType description", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450001" };
			req.body = {
				description: "Updated description for task item",
			};

			prisma.itemType.findFirst = async () => mockItemType;
			prisma.itemType.update = async (params: Prisma.ItemTypeUpdateArgs) => ({
				...mockItemType,
				...params.data,
				updatedAt: new Date(),
			});

			await itemTypeController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should update itemType status to INACTIVE", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450001" };
			req.body = { status: "INACTIVE" };

			prisma.itemType.findFirst = async () => mockItemType;
			prisma.itemType.update = async (params: Prisma.ItemTypeUpdateArgs) => ({
				...mockItemType,
				...params.data,
				updatedAt: new Date(),
			});

			await itemTypeController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return 404 for non-existent itemType", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450999" };
			req.body = { name: "Updated Name" };

			prisma.itemType.findFirst = async () => null;

			await itemTypeController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 for invalid status (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450001" };
			req.body = { status: "INVALID_STATUS" };

			await itemTypeController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".remove()", () => {
		it("should soft delete an itemType", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450001" };

			prisma.itemType.findFirst = async () => mockItemType;
			prisma.itemType.update = async (params: Prisma.ItemTypeUpdateArgs) => ({
				...mockItemType,
				isDeleted: true,
				updatedAt: new Date(),
			});

			await itemTypeController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("message", "Item type deleted successfully");
		});

		it("should return 404 for non-existent itemType", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799450999" };

			prisma.itemType.findFirst = async () => null;

			await itemTypeController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData.message).to.include("ItemType not found");
		});
	});

	describe("ItemType Status", () => {
		it("should create an ACTIVE itemType", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Active Item",
				description: "This is an active item type",
				status: "ACTIVE",
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});

		it("should create an INACTIVE itemType", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Inactive Item",
				description: "This is an inactive item type",
				status: "INACTIVE",
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe("ItemType with defaultFields", () => {
		it("should create an itemType with defaultFields", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				name: "Task with Fields",
				description: "Task type with default fields",
				status: "ACTIVE",
				defaultFields: [
					{ fieldId: "608f1f77bcf86cd799440001", required: true },
					{ fieldId: "608f1f77bcf86cd799440002", required: false },
				],
			};
			await itemTypeController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});
	});
});
