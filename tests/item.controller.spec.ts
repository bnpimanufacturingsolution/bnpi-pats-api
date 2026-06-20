import { controller } from "../app/item/item.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, EstimationStatus } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Item Controller", () => {
	let itemController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockItem = {
		id: "607f1f77bcf86cd799439201",
		estimationId: "607f1f77bcf86cd799439102",
		type: "CAPEX",
		category: "Hardware",
		itemName: "Laptop",
		estimatedQuantity: 10,
		actualQuantity: 10,
		estimatedUnitPrice: 1500.0,
		estimatedTotal: 15000.0,
		actualUnitPrice: 1450.0,
		actualTotal: 14500.0,
		documentUrls: [],
		orderId: null,
		status: "PENDING",
		startDate: null,
		endDate: null,
		estimationPoints: 8,
		isNewAddition: false,
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockProject = {
		id: "507f1f77bcf86cd799439011",
		projectName: "Test Project",
		status: "ACTIVE",
		isDeleted: false,
	};

	const mockEstimationDraft = {
		id: "607f1f77bcf86cd799439101",
		estimationNumber: "EST-2025-001",
		status: EstimationStatus.DRAFT,
		isDeleted: false,
		project: mockProject,
	};

	const mockEstimationApproved = {
		id: "607f1f77bcf86cd799439102",
		estimationNumber: "EST-2025-002",
		status: EstimationStatus.APPROVED,
		isDeleted: false,
		project: mockProject,
	};

	const mockEstimationPending = {
		id: "607f1f77bcf86cd799439103",
		estimationNumber: "EST-2025-003",
		status: EstimationStatus.PENDING,
		isDeleted: false,
		project: mockProject,
	};

	const mockEstimationRejected = {
		id: "607f1f77bcf86cd799439104",
		estimationNumber: "EST-2025-004",
		status: EstimationStatus.REJECTED,
		isDeleted: false,
		project: mockProject,
	};

	const mockEstimationRevised = {
		id: "607f1f77bcf86cd799439105",
		estimationNumber: "EST-2025-005",
		status: EstimationStatus.REVISED,
		isDeleted: false,
		project: mockProject,
	};

	beforeEach(() => {
		prisma = {
			item: {
				create: async (params: any) => ({ ...mockItem, ...params.data }),
				findMany: async (params: any) => [mockItem],
				findFirst: async (params: any) => mockItem,
				update: async (params: any) => ({ ...mockItem, ...params.data }),
				count: async (params: any) => 1,
			},
			estimation: {
				findFirst: async (params: any) => {
					// Return different mock based on the ID
					if (params.where?.id === mockEstimationDraft.id) return mockEstimationDraft;
					if (params.where?.id === mockEstimationApproved.id) return mockEstimationApproved;
					if (params.where?.id === mockEstimationPending.id) return mockEstimationPending;
					if (params.where?.id === mockEstimationRejected.id) return mockEstimationRejected;
					if (params.where?.id === mockEstimationRevised.id) return mockEstimationRevised;
					return mockEstimationDraft;
				},
				findUnique: async (params: any) => {
					// Return different mock based on the ID
					if (params.where?.id === mockEstimationDraft.id) return mockEstimationDraft;
					if (params.where?.id === mockEstimationApproved.id) return mockEstimationApproved;
					if (params.where?.id === mockEstimationPending.id) return mockEstimationPending;
					if (params.where?.id === mockEstimationRejected.id) return mockEstimationRejected;
					if (params.where?.id === mockEstimationRevised.id) return mockEstimationRevised;
					return mockEstimationDraft;
				},
				update: async (params: any) => mockEstimationDraft,
			},
			order: {
				update: async (params: any) => ({ id: "order_id", isDeleted: true }),
			},
		};

		itemController = controller(prisma as PrismaClient);

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

	describe("create", () => {
		it("should create item with isNewAddition=false when estimation status is DRAFT", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationDraft.id,
				type: "CAPEX",
				category: "Hardware",
				itemName: "Laptop",
				estimatedQuantity: 10,
				estimatedUnitPrice: 1500.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("isNewAddition", false);
		});

		it("should create item with isNewAddition=true when estimation status is APPROVED", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationApproved.id,
				type: "CAPEX",
				category: "Hardware",
				itemName: "Monitor",
				estimatedQuantity: 20,
				estimatedUnitPrice: 500.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("isNewAddition", true);
		});

		it("should create item with isNewAddition=false when estimation status is PENDING", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationPending.id,
				type: "OPEX",
				category: "Human Resource",
				itemName: "Developer",
				estimatedQuantity: 5,
				estimatedUnitPrice: 8000.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("isNewAddition", false);
		});

		it("should create item with isNewAddition=false when estimation status is REJECTED", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationRejected.id,
				type: "MISC",
				itemName: "Miscellaneous",
				estimatedQuantity: 1,
				estimatedUnitPrice: 1000.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("isNewAddition", false);
		});

		it("should create item with isNewAddition=false when estimation status is REVISED", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationRevised.id,
				type: "CAPEX",
				category: "Hardware",
				itemName: "Server",
				estimatedQuantity: 2,
				estimatedUnitPrice: 5000.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("isNewAddition", false);
		});

		it("should allow manual override of isNewAddition field", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationApproved.id,
				type: "CAPEX",
				itemName: "Custom Item",
				estimatedQuantity: 1,
				estimatedUnitPrice: 100.0,
				isNewAddition: false, // Manual override
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("isNewAddition", false);
		});

		it("should calculate estimatedTotal correctly", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationDraft.id,
				type: "CAPEX",
				itemName: "Keyboard",
				estimatedQuantity: 15,
				estimatedUnitPrice: 50.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("estimatedTotal", 750.0);
		});

		it("should return 404 if parent estimation not found", async function () {
			this.timeout(TEST_TIMEOUT);

			prisma.estimation.findFirst = async () => null;

			req.body = {
				estimationId: "607f1f77bcf86cd799439999",
				type: "CAPEX",
				itemName: "Item",
				estimatedQuantity: 1,
				estimatedUnitPrice: 100.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 for invalid data (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				// Missing required fields
				estimationId: mockEstimationDraft.id,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe("getAll", () => {
		it("should retrieve all items", async function () {
			this.timeout(TEST_TIMEOUT);

			req.query = {
				document: "true",
				count: "true",
			};

			await itemController.getAll(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("items");
		});
	});

	describe("getById", () => {
		it("should retrieve item by id", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = { id: "607f1f77bcf86cd799439201" };

			await itemController.getById(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("itemName");
		});

		it("should return 404 if item not found", async function () {
			this.timeout(TEST_TIMEOUT);

			prisma.item.findFirst = async () => null;
			req.params = { id: "nonexistent_id" };

			await itemController.getById(req as Request, res, next);

			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe("update", () => {
		it("should update item successfully", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = { id: "607f1f77bcf86cd799439201" };
			req.body = {
				estimatedQuantity: 15,
				actualUnitPrice: 1400.0,
			};

			await itemController.update(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should recalculate totals on update", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = { id: "607f1f77bcf86cd799439201" };
			req.body = {
				estimatedQuantity: 20,
				estimatedUnitPrice: 1600.0,
			};

			await itemController.update(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData.data.item).to.have.property("estimatedTotal", 32000.0);
		});
	});

	describe("remove", () => {
		it("should soft delete item successfully", async function () {
			this.timeout(TEST_TIMEOUT);

			req.params = { id: "607f1f77bcf86cd799439201" };

			await itemController.remove(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return 404 if item not found", async function () {
			this.timeout(TEST_TIMEOUT);

			prisma.item.findFirst = async () => null;
			req.params = { id: "nonexistent_id" };

			await itemController.remove(req as Request, res, next);

			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe("fields property", () => {
		it("should create item with fields", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationDraft.id,
				type: "CAPEX",
				category: "Hardware",
				itemName: "Server",
				estimatedQuantity: 5,
				estimatedUnitPrice: 3000.0,
				fields: {
					common: [
						{ fieldId: "608f1f77bcf86cd799440003", value: 4 }, // Priority Level
						{ fieldId: "608f1f77bcf86cd799440007", value: "Medium" }, // Risk Level
					],
					custom: [
						{
							fieldId: "608f1f77bcf86cd799440015",
							value: "Dell PowerEdge R750, 128GB RAM, Dual Xeon",
						},
					],
				},
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data.item).to.have.property("fields");
		});

		it("should update item fields", async function () {
			this.timeout(TEST_TIMEOUT);

			const itemWithFields = {
				...mockItem,
				fields: {
					common: [{ fieldId: "608f1f77bcf86cd799440003", value: 3 }],
					custom: [],
				},
			};

			prisma.item.findFirst = async () => itemWithFields;
			prisma.item.update = async (params: any) => ({
				...itemWithFields,
				...params.data,
			});

			req.params = { id: mockItem.id };
			req.body = {
				fields: {
					common: [
						{ fieldId: "608f1f77bcf86cd799440003", value: 5 }, // Updated priority
						{ fieldId: "608f1f77bcf86cd799440009", value: ["Urgent", "Important"] }, // Tags
					],
					custom: [
						{
							fieldId: "608f1f77bcf86cd799440015",
							value: "Updated technical specifications",
						},
					],
				},
			};

			await itemController.update(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should retrieve item with fields", async function () {
			this.timeout(TEST_TIMEOUT);

			const itemWithFields = {
				...mockItem,
				fields: {
					common: [
						{ fieldId: "608f1f77bcf86cd799440002", value: "Tech Corp" }, // Vendor Name
						{ fieldId: "608f1f77bcf86cd799440003", value: 4 }, // Priority Level
					],
					custom: [
						{
							fieldId: "608f1f77bcf86cd799440015",
							value: "High-performance workstation with RTX 4090",
						},
					],
				},
			};

			prisma.item.findFirst = async () => itemWithFields;
			req.params = { id: mockItem.id };

			await itemController.getById(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("fields");
			expect(sentData.data.fields).to.have.property("common");
			expect(sentData.data.fields).to.have.property("custom");
			expect(sentData.data.fields.common).to.be.an("array").with.lengthOf(2);
			expect(sentData.data.fields.custom).to.be.an("array").with.lengthOf(1);
		});

		it("should create item without fields (optional)", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationDraft.id,
				type: "OPEX",
				category: "Software",
				itemName: "License",
				estimatedQuantity: 10,
				estimatedUnitPrice: 100.0,
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});

		it.skip("should validate field structure (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);

			req.body = {
				estimationId: mockEstimationDraft.id,
				type: "CAPEX",
				category: "Hardware",
				itemName: "Workstation",
				estimatedQuantity: 3,
				estimatedUnitPrice: 2500.0,
				fields: {
					common: [
						{ fieldId: "invalid_id", value: "test" }, // Invalid ObjectId
					],
					custom: [],
				},
			};

			await itemController.create(req as Request, res, next);

			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});
});
