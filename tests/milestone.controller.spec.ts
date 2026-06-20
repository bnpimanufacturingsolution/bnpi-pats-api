import { controller } from "../app/milestone/milestone.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Milestone Controller", () => {
	let milestoneController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockProject = {
		id: "507f1f77bcf86cd799439011",
		name: "Test Project",
		code: "PROJ-TEST-001",
	};

	const mockEstimation = {
		id: "607f1f77bcf86cd799439101",
		estimationNumber: "EST-TEST-001",
		name: "Test Estimation",
	};

	const mockMilestone = {
		id: "608f1f77bcf86cd799460001",
		title: "Project scaffolding and architecture setup",
		description: "Set up the foundational project structure",
		phase: "FOUNDATION",
		status: "COMPLETED",
		priority: "CRITICAL",
		progressPercent: 100,
		startDate: new Date(),
		targetDate: new Date(),
		completedDate: new Date(),
		assignedTo: [],
		projectId: mockProject.id,
		estimationId: mockEstimation.id,
		tags: [],
		dependencies: [],
		blockers: [],
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockMilestones = [
		{
			id: "608f1f77bcf86cd799460001",
			title: "Project scaffolding",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "608f1f77bcf86cd799460002",
			title: "MongoDB integration",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "608f1f77bcf86cd799460003",
			title: "User management",
			phase: "ENHANCED_FEATURES",
			status: "IN_PROGRESS",
			priority: "HIGH",
			progressPercent: 60,
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		prisma = {
			milestone: {
				findMany: async (_params: Prisma.MilestoneFindManyArgs) => mockMilestones,
				count: async (_params: Prisma.MilestoneCountArgs) => mockMilestones.length,
				findFirst: async (params: Prisma.MilestoneFindFirstArgs) =>
					params.where?.id === mockMilestone.id ? mockMilestone : null,
				create: async (params: Prisma.MilestoneCreateArgs) => ({
					...mockMilestone,
					...params.data,
					id: "608f1f77bcf86cd799460999",
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
				update: async (params: Prisma.MilestoneUpdateArgs) => ({
					...mockMilestone,
					...params.data,
					updatedAt: new Date(),
				}),
			},
		};

		milestoneController = controller(prisma as PrismaClient);
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
			originalUrl: "/api/milestone",
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
		it("should create a new milestone with valid data", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "New Feature Implementation",
				description: "Implement new advanced feature",
				phase: "ENHANCED_FEATURES",
				status: "NOT_STARTED",
				priority: "HIGH",
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("title", "New Feature Implementation");
		});

		it("should create a milestone with progressPercent", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Database Optimization",
				phase: "INTEGRATION_OPTIMIZATION",
				progressPercent: 45,
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});

		it.skip("should return 400 for invalid phase (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Invalid Milestone",
				phase: "INVALID_PHASE",
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 for invalid status (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Invalid Status Milestone",
				phase: "FOUNDATION",
				status: "INVALID_STATUS",
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 when title is missing (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				phase: "FOUNDATION",
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getAll()", () => {
		it("should return all milestones", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("milestones");
			expect(sentData.data.milestones).to.be.an("array");
		});

		it("should filter milestones by status", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { filter: "status:COMPLETED", document: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should filter milestones by phase", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { filter: "phase:FOUNDATION", document: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should search milestones by title", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { search: "Project", document: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return paginated results with count", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", count: "true", document: "true", pagination: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("pagination");
		});

		it("should sort milestones by title", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { sort: "title", order: "asc", document: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe(".getById()", () => {
		it("should return a milestone by ID", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };
			await milestoneController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("id", "608f1f77bcf86cd799460001");
		});

		it("should return 404 for non-existent milestone", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460999" };
			await milestoneController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData.message).to.include("Milestone not found");
		});
	});

	describe(".update()", () => {
		it("should update a milestone successfully", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };
			req.body = { title: "Updated Milestone Title" };

			prisma.milestone.findFirst = async () => mockMilestone;
			prisma.milestone.update = async (params: Prisma.MilestoneUpdateArgs) => ({
				...mockMilestone,
				...params.data,
				updatedAt: new Date(),
			});

			await milestoneController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should update milestone progressPercent", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };
			req.body = { progressPercent: 75 };

			prisma.milestone.findFirst = async () => mockMilestone;
			prisma.milestone.update = async (params: Prisma.MilestoneUpdateArgs) => ({
				...mockMilestone,
				...params.data,
				updatedAt: new Date(),
			});

			await milestoneController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should update milestone status to COMPLETED", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };
			req.body = { status: "COMPLETED", progressPercent: 100, completedDate: new Date() };

			prisma.milestone.findFirst = async () => mockMilestone;
			prisma.milestone.update = async (params: Prisma.MilestoneUpdateArgs) => ({
				...mockMilestone,
				...params.data,
				updatedAt: new Date(),
			});

			await milestoneController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should return 404 for non-existent milestone", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460999" };
			req.body = { title: "Updated Name" };

			prisma.milestone.findFirst = async () => null;

			await milestoneController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it.skip("should return 400 for invalid priority (requires Zod middleware)", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };
			req.body = { priority: "INVALID_PRIORITY" };

			await milestoneController.update(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".remove()", () => {
		it("should soft delete a milestone", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };

			prisma.milestone.findFirst = async () => mockMilestone;
			prisma.milestone.update = async (params: Prisma.MilestoneUpdateArgs) => ({
				...mockMilestone,
				isDeleted: true,
				updatedAt: new Date(),
			});

			await milestoneController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("message", "Milestone deleted successfully");
		});

		it("should return 404 for non-existent milestone", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460999" };

			prisma.milestone.findFirst = async () => null;

			await milestoneController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData.message).to.include("Milestone not found");
		});
	});

	describe("Milestone Phases", () => {
		it("should create a FOUNDATION phase milestone", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Core Setup",
				phase: "FOUNDATION",
				priority: "CRITICAL",
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});

		it("should create an ENTERPRISE_FEATURES phase milestone", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "AI Integration",
				phase: "ENTERPRISE_FEATURES",
				priority: "HIGH",
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe("Milestone Progress Tracking", () => {
		it("should accept progressPercent value between 0-100", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Progress Milestone",
				phase: "CORE_MODULES",
				progressPercent: 50,
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
		});
	});

	describe("Milestone Project & Estimation Relations", () => {
		it("should create milestone with projectId", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Project Milestone",
				phase: "FOUNDATION",
				priority: "HIGH",
				projectId: mockProject.id,
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("projectId", mockProject.id);
		});

		it("should create milestone with estimationId", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Estimation Milestone",
				phase: "CORE_MODULES",
				priority: "MEDIUM",
				estimationId: mockEstimation.id,
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("estimationId", mockEstimation.id);
		});

		it("should create milestone with both projectId and estimationId", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				title: "Full Context Milestone",
				phase: "ENHANCED_FEATURES",
				priority: "CRITICAL",
				projectId: mockProject.id,
				estimationId: mockEstimation.id,
			};
			await milestoneController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("projectId", mockProject.id);
			expect(sentData.data).to.have.property("estimationId", mockEstimation.id);
		});

		it("should filter milestones by projectId", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { filter: `projectId:${mockProject.id}`, document: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should filter milestones by estimationId", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { filter: `estimationId:${mockEstimation.id}`, document: "true" };
			await milestoneController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should update milestone projectId", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };
			req.body = { projectId: "507f1f77bcf86cd799439012" };

			prisma.milestone.findFirst = async () => mockMilestone;
			prisma.milestone.update = async (params: any) => ({
				...mockMilestone,
				...params.data,
				updatedAt: new Date(),
			});

			await milestoneController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should retrieve milestone with project and estimation relations", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "608f1f77bcf86cd799460001" };
			req.query = { include: "project,estimation" };

			const milestoneWithRelations = {
				...mockMilestone,
				project: mockProject,
				estimation: mockEstimation,
			};

			prisma.milestone.findFirst = async () => milestoneWithRelations;

			await milestoneController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("projectId", mockProject.id);
			expect(sentData.data).to.have.property("estimationId", mockEstimation.id);
		});
	});
});
