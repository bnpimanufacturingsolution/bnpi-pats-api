import { controller } from "../app/demand/demand.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import {
	PrismaClient,
	DemandPlanStatus,
	DemandEstimateVersionStatus,
	ProductStatus,
	ProjectConversionStatus,
} from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Demand Controller", () => {
	let demandController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const workspaceId = "507f1f77bcf86cd799439011";
	const organizationId = workspaceId;

	const toyA = {
		id: "708f1f77bcf86cd799450201",
		workspaceId,
		code: "TOY-A",
		name: "Toy A",
		description: "Starter toy car",
		brand: "BNPI Play",
		category: "Toys",
		variant: "Starter",
		unitOfMeasure: "PCS",
		revision: "A",
		status: ProductStatus.ACTIVE,
		tags: ["toy", "demo"],
		metadata: { demoSeed: true },
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const toyB = {
		id: "708f1f77bcf86cd799450202",
		workspaceId,
		code: "TOY-B",
		name: "Toy B",
		description: "Assembly toy robot",
		brand: "BNPI Play",
		category: "Toys",
		variant: "Assembly",
		unitOfMeasure: "PCS",
		revision: "A",
		status: ProductStatus.ACTIVE,
		tags: ["toy", "demo"],
		metadata: { demoSeed: true },
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const toyC = {
		id: "708f1f77bcf86cd799450203",
		workspaceId,
		code: "TOY-C",
		name: "Toy C",
		description: "Premium toy set",
		brand: "BNPI Play",
		category: "Toys",
		variant: "Premium",
		unitOfMeasure: "PCS",
		revision: "A",
		status: ProductStatus.ACTIVE,
		tags: ["toy", "demo"],
		metadata: { demoSeed: true },
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const initialPlan = {
		id: "708f1f77bcf86cd799460101",
		workspaceId,
		organizationId,
		planCode: "DMD-202607-001",
		name: "July 2026 Toy Demand",
		description: "Seeded demand plan",
		periodLabel: "July 2026",
		periodStart: new Date("2026-07-01T00:00:00.000Z"),
		periodEnd: new Date("2026-07-31T00:00:00.000Z"),
		status: DemandPlanStatus.APPROVED,
		metadata: { demoSeed: true },
		notes: "Demo plan",
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	let plans: any[];
	let lines: any[];
	let versions: any[];
	let estimateLines: any[];
	let materials: any[];
	let labor: any[];
	let conversions: any[];

	const attachPlanRelations = (plan: any) => ({
		...plan,
		demandLines: lines.filter((line) => line.demandPlanId === plan.id && !line.isDeleted),
		estimateVersions: versions.filter((version) => version.demandPlanId === plan.id && !version.isDeleted),
		projectConversions: conversions.filter(
			(conversion) => conversion.demandPlanId === plan.id && !conversion.isDeleted,
		),
	});

	const attachVersionRelations = (version: any) => ({
		...version,
		demandEstimateLines: estimateLines.filter(
			(line) => line.demandEstimateVersionId === version.id && !line.isDeleted,
		),
		demandMaterialRequirements: materials.filter(
			(material) => material.demandEstimateVersionId === version.id && !material.isDeleted,
		),
		demandLaborRequirements: labor.filter(
			(item) => item.demandEstimateVersionId === version.id && !item.isDeleted,
		),
		projectConversion:
			conversions.find((conversion) => conversion.demandEstimateVersionId === version.id && !conversion.isDeleted) ||
			null,
	});

	const makePlanFilter = (where: any) =>
		(plan: any) =>
			(!where?.id || plan.id === where.id) &&
			(!where?.workspaceId || plan.workspaceId === where.workspaceId) &&
			(where?.isDeleted === undefined || plan.isDeleted === where.isDeleted);

	const makeLineFilter = (where: any) =>
		(line: any) =>
			(!where?.id || line.id === where.id) &&
			(!where?.workspaceId || line.workspaceId === where.workspaceId) &&
			(!where?.demandPlanId || line.demandPlanId === where.demandPlanId) &&
			(where?.isDeleted === undefined || line.isDeleted === where.isDeleted);

	const makeVersionFilter = (where: any) =>
		(version: any) =>
			(!where?.id || version.id === where.id) &&
			(!where?.workspaceId || version.workspaceId === where.workspaceId) &&
			(!where?.demandPlanId || version.demandPlanId === where.demandPlanId) &&
			(where?.isDeleted === undefined || version.isDeleted === where.isDeleted);

	const makeConversionFilter = (where: any) =>
		(conversion: any) =>
			(!where?.id || conversion.id === where.id) &&
			(!where?.workspaceId || conversion.workspaceId === where.workspaceId) &&
			(!where?.demandPlanId || conversion.demandPlanId === where.demandPlanId) &&
			(!where?.demandEstimateVersionId || conversion.demandEstimateVersionId === where.demandEstimateVersionId) &&
			(where?.isDeleted === undefined || conversion.isDeleted === where.isDeleted);

	const createMockPrisma = () => {
		const mock: any = {};
		const resolveId = (prefix: string, providedId: string | undefined, count: number) =>
			providedId || `${prefix}-${count + 1}`;

		mock.product = {
			findFirst: async (params: any) => {
				const { where } = params;
				const all = [toyA, toyB, toyC];
				return (
					all.find(
						(product) =>
							(!where?.id || product.id === where.id) &&
							(!where?.code || product.code === where.code) &&
							(!where?.workspaceId || product.workspaceId === where.workspaceId) &&
							(where?.isDeleted === undefined || product.isDeleted === where.isDeleted),
					) || null
				);
			},
		};

		mock.demandPlan = {
			findMany: async (params: any = {}) => plans.filter(makePlanFilter(params.where)).map(attachPlanRelations),
			count: async (params: any = {}) => plans.filter(makePlanFilter(params.where)).length,
			findFirst: async (params: any = {}) => {
				const plan = plans.find(makePlanFilter(params.where));
				return plan ? attachPlanRelations(plan) : null;
			},
			create: async (params: any) => {
				const id = resolveId("plan", params.data.id, plans.length);
				const record = {
					...params.data,
					id,
					isDeleted: params.data.isDeleted ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				plans.push(record);
				return attachPlanRelations(record);
			},
			update: async (params: any) => {
				const index = plans.findIndex((plan) => plan.id === params.where.id);
				if (index === -1) throw new Error("Plan not found");
				plans[index] = {
					...plans[index],
					...params.data,
					updatedAt: new Date(),
				};
				return attachPlanRelations(plans[index]);
			},
		};

		mock.demandLine = {
			findMany: async (params: any = {}) => lines.filter(makeLineFilter(params.where)),
			findFirst: async (params: any = {}) => lines.find(makeLineFilter(params.where)) || null,
			create: async (params: any) => {
				const id = resolveId("line", params.data.id, lines.length);
				const record = {
					...params.data,
					id,
					isDeleted: params.data.isDeleted ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				lines.push(record);
				return record;
			},
			update: async (params: any) => {
				const index = lines.findIndex((line) => line.id === params.where.id);
				if (index === -1) throw new Error("Line not found");
				lines[index] = {
					...lines[index],
					...params.data,
					updatedAt: new Date(),
				};
				return lines[index];
			},
		};

		mock.demandEstimateVersion = {
			findMany: async (params: any = {}) =>
				versions.filter(makeVersionFilter(params.where)).map(attachVersionRelations),
			findFirst: async (params: any = {}) => {
				const version = versions.find(makeVersionFilter(params.where));
				return version ? attachVersionRelations(version) : null;
			},
			create: async (params: any) => {
				const id = resolveId("version", params.data.id, versions.length);
				const record = {
					...params.data,
					id,
					isDeleted: params.data.isDeleted ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				versions.push(record);
				return record;
			},
			update: async (params: any) => {
				const index = versions.findIndex((version) => version.id === params.where.id);
				if (index === -1) throw new Error("Version not found");
				versions[index] = {
					...versions[index],
					...params.data,
					updatedAt: new Date(),
				};
				return versions[index];
			},
		};

		mock.demandEstimateLine = {
			create: async (params: any) => {
				const id = resolveId("estimate-line", params.data.id, estimateLines.length);
				const record = {
					...params.data,
					id,
					isDeleted: params.data.isDeleted ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				estimateLines.push(record);
				return record;
			},
		};

		mock.demandMaterialRequirement = {
			create: async (params: any) => {
				const id = resolveId("material", params.data.id, materials.length);
				const record = {
					...params.data,
					id,
					isDeleted: params.data.isDeleted ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				materials.push(record);
				return record;
			},
		};

		mock.demandLaborRequirement = {
			create: async (params: any) => {
				const id = resolveId("labor", params.data.id, labor.length);
				const record = {
					...params.data,
					id,
					isDeleted: params.data.isDeleted ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				labor.push(record);
				return record;
			},
		};

		mock.projectConversion = {
			findFirst: async (params: any = {}) => conversions.find(makeConversionFilter(params.where)) || null,
			findMany: async (params: any = {}) => conversions.filter(makeConversionFilter(params.where)),
			create: async (params: any) => {
				const id = resolveId("conversion", params.data.id, conversions.length);
				const record = {
					...params.data,
					id,
					isDeleted: params.data.isDeleted ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				conversions.push(record);
				return record;
			},
			update: async (params: any) => {
				const index = conversions.findIndex((conversion) => conversion.id === params.where.id);
				if (index === -1) throw new Error("Conversion not found");
				conversions[index] = {
					...conversions[index],
					...params.data,
					updatedAt: new Date(),
				};
				return conversions[index];
			},
		};

		mock.$transaction = async (fn: any) => fn(mock);

		return mock;
	};

	beforeEach(() => {
		plans = [
			{
				...initialPlan,
			},
		];
		lines = [
			{
				id: "708f1f77bcf86cd799460111",
				workspaceId,
				organizationId,
				demandPlanId: initialPlan.id,
				productId: toyA.id,
				lineNo: 1,
				productCode: toyA.code,
				productName: toyA.name,
				productRevision: toyA.revision,
				unitOfMeasure: toyA.unitOfMeasure,
				quantity: 120,
				targetDeliveryDate: new Date("2026-07-10T00:00:00.000Z"),
				priority: 1,
				productSnapshot: { id: toyA.id, code: toyA.code },
				notes: "Initial demo line",
				isDeleted: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];
		versions = [
			{
				id: "708f1f77bcf86cd799460301",
				workspaceId,
				organizationId,
				demandPlanId: initialPlan.id,
				versionNumber: 1,
				versionLabel: "Initial July 2026 estimate",
				status: DemandEstimateVersionStatus.CALCULATED,
				metadata: { demoSeed: true },
				notes: "Initial version",
				isDeleted: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];
		estimateLines = [];
		materials = [];
		labor = [];
		conversions = [];

		prisma = createMockPrisma();
		demandController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
			workspaceId,
			organizationId,
			originalUrl: "/api/demand-plan",
			get: (header: string) => {
				if (header === "Content-Type") {
					return "application/json";
				}
				return undefined;
			},
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

	describe(".create()", () => {
		it("should create a demand plan and normalize the code", async function () {
			this.timeout(TEST_TIMEOUT);
			req.body = {
				planCode: " dmd-202607-002 ",
				name: "July 2026 Follow-up Demand",
				periodLabel: "July 2026",
				periodStart: new Date("2026-07-01T00:00:00.000Z"),
				periodEnd: new Date("2026-07-31T00:00:00.000Z"),
				metadata: { demoSeed: true },
			};

			await demandController.create(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.include({ planCode: "DMD-202607-002" });
		});
	});

	describe(".getAll()", () => {
		it("should return demand plans", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { document: "true", count: "true", pagination: "true" };

			await demandController.getAll(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("demandPlans");
			expect(sentData.data).to.have.property("count");
		});
	});

	describe(".getById()", () => {
		it("should return a demand plan", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: initialPlan.id };

			await demandController.getById(req as Request, res, next);

			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.deep.include({ id: initialPlan.id });
		});
	});

	describe(".addLine()", () => {
		it("should add a demand line", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: initialPlan.id };
			req.body = {
				productId: toyB.id,
				quantity: 55,
				notes: "Added in test",
			};

			await demandController.addLine(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.include({ productCode: toyB.code, quantity: 55 });
		});
	});

	describe(".createVersion()", () => {
		it("should create a demand estimate version with nested rows", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: initialPlan.id };
			req.body = {
				versionLabel: "Revised estimate",
				metadata: { scenario: "revision" },
				estimateLines: [
					{
						demandLineId: lines[0].id,
						productId: toyA.id,
						requestedQuantity: 120,
						estimatedQuantity: 118,
						productSnapshot: { id: toyA.id, code: toyA.code },
					},
					{
						demandLineId: lines[0].id,
						productId: toyB.id,
						requestedQuantity: 80,
						estimatedQuantity: 82,
						productSnapshot: { id: toyB.id, code: toyB.code },
					},
				],
				materialRequirements: [
					{
						materialName: "Demo material",
						quantityPerUnit: 1,
						totalRequiredQuantity: 200,
						unitOfMeasure: "PCS",
					},
				],
				laborRequirements: [
					{
						stepName: "Demo labor",
						laborHours: 16,
					},
				],
			};

			await demandController.createVersion(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("versionNumber", 2);
			expect(sentData.data).to.have.property("demandEstimateLines");
			expect(sentData.data.demandEstimateLines).to.have.lengthOf(2);
		});
	});

	describe(".createProjectConversion()", () => {
		it("should create a project conversion record", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: initialPlan.id };
			req.body = {
				demandEstimateVersionId: versions[0].id,
				conversionCode: "CONV-2026-07-001",
				status: ProjectConversionStatus.PENDING,
				metadata: { demoSeed: true },
			};

			await demandController.createProjectConversion(req as Request, res, next);

			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.include({ conversionCode: "CONV-2026-07-001" });
		});
	});
});
