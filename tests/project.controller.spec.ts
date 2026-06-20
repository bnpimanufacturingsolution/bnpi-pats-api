import { controller } from "../app/project/project.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Project Controller", () => {
	let projectController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;
	const mockProject = {
		id: "507f1f77bcf86cd799439026",
		name: "Website Redesign Project",
		description: "Complete redesign of company website",
		type: "Web Development",
		isDeleted: false,
		code: "PROJ-001",
		status: "ACTIVE",
		capital: 100000.00,
		actualExpenses: 0,
		startDate: new Date("2024-01-01"),
		endDate: new Date("2024-12-31"),
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockProjects = [
		{
			id: "507f1f77bcf86cd799439026",
			name: "Website Redesign Project",
			description: "Complete redesign of company website",
			type: "Web Development",
			isDeleted: false,
			code: "PROJ-001",
			status: "ACTIVE",
			capital: 100000.00,
			actualExpenses: 0,
			startDate: new Date("2024-01-01"),
			endDate: new Date("2024-12-31"),
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439027",
			name: "Mobile App Development",
			description: "iOS and Android mobile application",
			type: "Mobile Development",
			isDeleted: false,
			code: "PROJ-002",
			status: "PENDING",
			capital: 150000.00,
			actualExpenses: 0,
			startDate: new Date("2024-02-01"),
			endDate: new Date("2024-11-30"),
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "507f1f77bcf86cd799439028",
			name: "Infrastructure Upgrade",
			description: "Server and network infrastructure upgrade",
			type: "Infrastructure",
			isDeleted: false,
			code: "PROJ-003",
			status: "COMPLETED",
			capital: 80000.00,
			actualExpenses: 82000.00,
			startDate: new Date("2023-06-01"),
			endDate: new Date("2023-12-31"),
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			project: {
				findMany: async (_params: Prisma.ProjectFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockProjects;
					}
					return [mockProject];
				},
				count: async (_params: Prisma.ProjectCountArgs) => {
					if (req.query?.groupBy) {
						return mockProjects.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.ProjectFindFirstArgs) =>
					params.where?.id === mockProject.id ? mockProject : null,
				findUnique: async (params: Prisma.ProjectFindUniqueArgs) =>
					params.where?.id === mockProject.id ? mockProject : null,
				create: async (params: Prisma.ProjectCreateArgs) => ({
					...mockProject,
					...params.data,
				}),
				update: async (params: Prisma.ProjectUpdateArgs) => ({
					...mockProject,
					...params.data,
				}),
				delete: async (params: Prisma.ProjectDeleteArgs) => ({
					...mockProject,
					id: params.where.id,
				}),
			},
			estimation: {
				findMany: async (params: any) => [{ id: "est-1" }, { id: "est-2" }],
				updateMany: async (params: any) => ({ count: 2 }),
			},
			item: {
				updateMany: async (params: any) => ({ count: 5 }),
			},
			order: {
				updateMany: async (params: any) => ({ count: 3 }),
			},
			payslip: {
				updateMany: async (params: any) => ({ count: 1 }),
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		projectController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/project",
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
		it("should return paginated projects", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await projectController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group projects by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await projectController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("projects");
			expect(sentData.data).to.have.property("groupedBy", "status");
			expect(sentData.data.projects).to.be.an("object");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await projectController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return a project", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockProject.id };
			await projectController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockProject.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await projectController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent project", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await projectController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new project", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				name: "E-commerce Platform",
				description: "New online shopping platform",
				code: "PROJ-004",
				estimatedCost: 200000.00,
				marginPercentage: 35.00,
				marginAmount: 70000.00,
				projectedWithMargin: 270000.00,
			};
			req.body = createData;
			await projectController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});

		it.skip("should handle validation errors (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				name: "",
				code: "PROJ-005",
			};
			req.body = createData;
			await projectController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".update()", () => {
		it("should update project details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "COMPLETED",
				actualCost: 98000.00,
			};
			req.params = { id: mockProject.id };
			req.body = updateData;
			await projectController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("project");
			expect(sentData.data.project).to.have.property("id");
		});

		it("should handle non-existent project update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "ON_HOLD",
			};
			req.params = { id: "507f1f77bcf86cd799439099" };
			req.body = updateData;
			await projectController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete a project", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockProject.id };
			await projectController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent project deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await projectController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
