import {
	PrismaClient,
	DemandPlanStatus,
	DemandEstimateVersionStatus,
	ProjectConversionStatus,
	ProductStatus,
} from "../../generated/prisma";
import { buildProductSnapshot, generateDemandPlanCode } from "../../app/demand/demand.utils";

type WorkspaceInput = string | string[];

function normalizeWorkspaces(workspaceIds: WorkspaceInput): string[] {
	return Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];
}

const DEMO_PRODUCT_SPECS = [
	{
		id: "708f1f77bcf86cd799450201",
		code: "TOY-A",
		name: "Toy A",
		description: "Starter toy car for the July 2026 demand demo",
		brand: "Bandai PATS",
		category: "Toys",
		variant: "Starter",
		unitOfMeasure: "PCS",
		revision: "A",
		tags: ["toy", "demo", "demand"],
	},
	{
		id: "708f1f77bcf86cd799450202",
		code: "TOY-B",
		name: "Toy B",
		description: "Assembly-heavy toy robot for the July 2026 demand demo",
		brand: "Bandai PATS",
		category: "Toys",
		variant: "Assembly",
		unitOfMeasure: "PCS",
		revision: "A",
		tags: ["toy", "demo", "demand"],
	},
	{
		id: "708f1f77bcf86cd799450203",
		code: "TOY-C",
		name: "Toy C",
		description: "Premium toy set for the July 2026 demand demo",
		brand: "Bandai PATS",
		category: "Toys",
		variant: "Premium",
		unitOfMeasure: "PCS",
		revision: "A",
		tags: ["toy", "demo", "demand"],
	},
];

const DEMO_PLAN_ID = "708f1f77bcf86cd799460101";
const DEMO_LINE_IDS = [
	"708f1f77bcf86cd799460201",
	"708f1f77bcf86cd799460202",
	"708f1f77bcf86cd799460203",
];
const DEMO_VERSION_IDS = [
	"708f1f77bcf86cd799460301",
	"708f1f77bcf86cd799460302",
];
const DEMO_VERSION_LINE_IDS = [
	"708f1f77bcf86cd799460401",
	"708f1f77bcf86cd799460402",
	"708f1f77bcf86cd799460403",
	"708f1f77bcf86cd799460404",
	"708f1f77bcf86cd799460405",
	"708f1f77bcf86cd799460406",
];
const DEMO_MATERIAL_IDS = [
	"708f1f77bcf86cd799460501",
	"708f1f77bcf86cd799460502",
	"708f1f77bcf86cd799460503",
	"708f1f77bcf86cd799460504",
	"708f1f77bcf86cd799460505",
	"708f1f77bcf86cd799460506",
	"708f1f77bcf86cd799460507",
	"708f1f77bcf86cd799460508",
];
const DEMO_LABOR_IDS = [
	"708f1f77bcf86cd799460601",
	"708f1f77bcf86cd799460602",
	"708f1f77bcf86cd799460603",
	"708f1f77bcf86cd799460604",
	"708f1f77bcf86cd799460605",
	"708f1f77bcf86cd799460606",
];
const DEMO_CONVERSION_ID = "708f1f77bcf86cd799460701";

async function ensureDemoProducts(prisma: PrismaClient, workspaceId: string, organizationId?: string) {
	for (const spec of DEMO_PRODUCT_SPECS) {
		const existing = await prisma.product.findFirst({
			where: { workspaceId, code: spec.code, isDeleted: false },
			select: { id: true },
		});

		if (existing) continue;

		await prisma.product.create({
			data: {
				id: spec.id,
				workspaceId,
				organizationId,
				code: spec.code,
				name: spec.name,
				description: spec.description,
				brand: spec.brand,
				category: spec.category,
				variant: spec.variant,
				unitOfMeasure: spec.unitOfMeasure,
				revision: spec.revision,
				status: ProductStatus.ACTIVE,
				tags: spec.tags,
				metadata: {
					demoSeed: true,
					source: "demandSeeder",
				},
			},
		});
	}
}

function buildMaterialRows(
	workspaceId: string,
	organizationId: string | undefined,
	demandPlanId: string,
	demandEstimateVersionId: string,
	lineBase: number,
	totalUnits: number,
	ids: string[],
) {
	const materialRows = [
		{
			lineNo: lineBase,
			materialCode: "PL-BODY",
			materialName: "Plastic body shell",
			materialType: "RAW_MATERIAL",
			quantityPerUnit: 1,
			totalRequiredQuantity: totalUnits,
			unitOfMeasure: "PCS",
			scrapRatePercentage: 2,
			isOptional: false,
			sourceLabel: "Demo aggregate",
		},
		{
			lineNo: lineBase + 1,
			materialCode: "WHL-SET",
			materialName: "Wheel set",
			materialType: "COMPONENT",
			quantityPerUnit: 4,
			totalRequiredQuantity: totalUnits * 4,
			unitOfMeasure: "PCS",
			scrapRatePercentage: 1,
			isOptional: false,
			sourceLabel: "Demo aggregate",
		},
		{
			lineNo: lineBase + 2,
			materialCode: "BOX-PRINT",
			materialName: "Printed box",
			materialType: "PACKAGING",
			quantityPerUnit: 1,
			totalRequiredQuantity: totalUnits,
			unitOfMeasure: "PCS",
			scrapRatePercentage: 0,
			isOptional: false,
			sourceLabel: "Demo aggregate",
		},
	];

	return materialRows.map((material, index) => ({
		id: ids[index],
		workspaceId,
		organizationId,
		demandPlanId,
		demandEstimateVersionId,
		...material,
		notes: "Seeded demo material requirement",
	}));
}

function buildLaborRows(
	workspaceId: string,
	organizationId: string | undefined,
	demandPlanId: string,
	demandEstimateVersionId: string,
	ids: string[],
) {
	return [
		{
			id: ids[0],
			workspaceId,
			organizationId,
			demandPlanId,
			demandEstimateVersionId,
			lineNo: 1,
			stepName: "Molding",
			workCenter: "Injection Molding",
			stepOrder: 1,
			laborHours: 84,
			crewSize: 3,
			ratePerHour: 150,
			totalLaborCost: 37800,
			sourceLabel: "Demo aggregate",
			laborSnapshot: {
				demoSeed: true,
				source: "demandSeeder",
			},
			notes: "Seeded demo labor requirement",
		},
		{
			id: ids[1],
			workspaceId,
			organizationId,
			demandPlanId,
			demandEstimateVersionId,
			lineNo: 2,
			stepName: "Assembly",
			workCenter: "Assembly",
			stepOrder: 2,
			laborHours: 126,
			crewSize: 4,
			ratePerHour: 145,
			totalLaborCost: 73080,
			sourceLabel: "Demo aggregate",
			laborSnapshot: {
				demoSeed: true,
				source: "demandSeeder",
			},
			notes: "Seeded demo labor requirement",
		},
		{
			id: ids[2],
			workspaceId,
			organizationId,
			demandPlanId,
			demandEstimateVersionId,
			lineNo: 3,
			stepName: "Packaging",
			workCenter: "QA / Packaging",
			stepOrder: 3,
			laborHours: 42,
			crewSize: 2,
			ratePerHour: 120,
			totalLaborCost: 10080,
			sourceLabel: "Demo aggregate",
			laborSnapshot: {
				demoSeed: true,
				source: "demandSeeder",
			},
			notes: "Seeded demo labor requirement",
		},
	];
}

export async function seedDemand(prisma: PrismaClient, workspaceIds: WorkspaceInput) {
	console.log("🌱 Starting demand seeding...");

	const ids = normalizeWorkspaces(workspaceIds);
	const workspaces = ids.length
		? await prisma.workspace.findMany({
				where: { id: { in: ids }, isDeleted: false },
				select: { id: true, name: true, organizationId: true },
			})
		: [];

	if (workspaces.length === 0) {
		console.log("⚠️  No workspaces found for demand seeding.");
		return;
	}

	const workspace = workspaces[0];
	const workspaceId = workspace.id;
	const organizationId = workspace.organizationId ?? workspace.id;

	await ensureDemoProducts(prisma, workspaceId, organizationId);

	console.log("🗑️  Clearing existing demand records...");
	await prisma.projectConversion.deleteMany({});
	await prisma.demandLaborRequirement.deleteMany({});
	await prisma.demandMaterialRequirement.deleteMany({});
	await prisma.demandEstimateLine.deleteMany({});
	await prisma.demandEstimateVersion.deleteMany({});
	await prisma.demandLine.deleteMany({});
	await prisma.demandPlan.deleteMany({});

	const existingPlans = await prisma.demandPlan.findMany({
		where: { workspaceId, isDeleted: false },
		select: { planCode: true },
	});
	const planCode = generateDemandPlanCode(
		existingPlans.map((plan) => plan.planCode),
		new Date("2026-07-01T00:00:00.000Z"),
	).code;

	const [toyA, toyB, toyC] = await Promise.all(
		DEMO_PRODUCT_SPECS.map((spec) =>
			prisma.product.findFirst({
				where: { workspaceId, code: spec.code, isDeleted: false },
			}),
		),
	);

	if (!toyA || !toyB || !toyC) {
		throw new Error("Demand seeder requires the Toy A, Toy B, and Toy C demo products");
	}

	const periodStart = new Date("2026-07-01T00:00:00.000Z");
	const periodEnd = new Date("2026-07-31T23:59:59.000Z");

	const plan = await prisma.demandPlan.create({
		data: {
			id: DEMO_PLAN_ID,
			workspaceId,
			organizationId,
			planCode,
			name: "July 2026 Toy Demand",
			description: "Demo demand plan for the July 2026 toy batch",
			periodLabel: "July 2026",
			periodStart,
			periodEnd,
			status: DemandPlanStatus.APPROVED,
			metadata: {
				demoSeed: true,
				source: "demandSeeder",
				scenario: "July 2026 Toy Demand",
			},
			notes: "Seeded demand demo data for Phase 3",
		},
	});

	const demandLines = [
		{
			id: DEMO_LINE_IDS[0],
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			productId: toyA.id,
			lineNo: 1,
			productCode: toyA.code,
			productName: toyA.name,
			productRevision: toyA.revision,
			unitOfMeasure: toyA.unitOfMeasure,
			quantity: 120,
			targetDeliveryDate: new Date("2026-07-10T00:00:00.000Z"),
			priority: 1,
			productSnapshot: buildProductSnapshot(toyA),
			notes: "Base volume for Toy A",
		},
		{
			id: DEMO_LINE_IDS[1],
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			productId: toyB.id,
			lineNo: 2,
			productCode: toyB.code,
			productName: toyB.name,
			productRevision: toyB.revision,
			unitOfMeasure: toyB.unitOfMeasure,
			quantity: 80,
			targetDeliveryDate: new Date("2026-07-17T00:00:00.000Z"),
			priority: 2,
			productSnapshot: buildProductSnapshot(toyB),
			notes: "Base volume for Toy B",
		},
		{
			id: DEMO_LINE_IDS[2],
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			productId: toyC.id,
			lineNo: 3,
			productCode: toyC.code,
			productName: toyC.name,
			productRevision: toyC.revision,
			unitOfMeasure: toyC.unitOfMeasure,
			quantity: 40,
			targetDeliveryDate: new Date("2026-07-24T00:00:00.000Z"),
			priority: 3,
			productSnapshot: buildProductSnapshot(toyC),
			notes: "Base volume for Toy C",
		},
	];

	for (const line of demandLines) {
		await prisma.demandLine.create({ data: line });
	}

	const version1 = await prisma.demandEstimateVersion.create({
		data: {
			id: DEMO_VERSION_IDS[0],
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			versionNumber: 1,
			versionLabel: "Initial July 2026 estimate",
			status: DemandEstimateVersionStatus.CALCULATED,
			metadata: {
				demoSeed: true,
				source: "demandSeeder",
				version: 1,
			},
			notes: "Seeded first version for the July 2026 toy demand",
		},
	});

	const version2 = await prisma.demandEstimateVersion.create({
		data: {
			id: DEMO_VERSION_IDS[1],
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			versionNumber: 2,
			versionLabel: "July 2026 revised estimate",
			status: DemandEstimateVersionStatus.APPROVED,
			metadata: {
				demoSeed: true,
				source: "demandSeeder",
				version: 2,
			},
			notes: "Seeded revision for the July 2026 toy demand",
		},
	});

	const version1Lines = [
		{
			id: DEMO_VERSION_LINE_IDS[0],
			demandLineId: demandLines[0].id,
			productId: toyA.id,
			lineNo: 1,
			productCode: toyA.code,
			productName: toyA.name,
			productRevision: toyA.revision,
			unitOfMeasure: toyA.unitOfMeasure,
			requestedQuantity: 120,
			estimatedQuantity: 120,
			productSnapshot: buildProductSnapshot(toyA),
		},
		{
			id: DEMO_VERSION_LINE_IDS[1],
			demandLineId: demandLines[1].id,
			productId: toyB.id,
			lineNo: 2,
			productCode: toyB.code,
			productName: toyB.name,
			productRevision: toyB.revision,
			unitOfMeasure: toyB.unitOfMeasure,
			requestedQuantity: 80,
			estimatedQuantity: 80,
			productSnapshot: buildProductSnapshot(toyB),
		},
		{
			id: DEMO_VERSION_LINE_IDS[2],
			demandLineId: demandLines[2].id,
			productId: toyC.id,
			lineNo: 3,
			productCode: toyC.code,
			productName: toyC.name,
			productRevision: toyC.revision,
			unitOfMeasure: toyC.unitOfMeasure,
			requestedQuantity: 40,
			estimatedQuantity: 40,
			productSnapshot: buildProductSnapshot(toyC),
		},
	];

	const version2Lines = [
		{
			id: DEMO_VERSION_LINE_IDS[3],
			demandLineId: demandLines[0].id,
			productId: toyA.id,
			lineNo: 1,
			productCode: toyA.code,
			productName: toyA.name,
			productRevision: toyA.revision,
			unitOfMeasure: toyA.unitOfMeasure,
			requestedQuantity: 130,
			estimatedQuantity: 128,
			productSnapshot: buildProductSnapshot(toyA),
		},
		{
			id: DEMO_VERSION_LINE_IDS[4],
			demandLineId: demandLines[1].id,
			productId: toyB.id,
			lineNo: 2,
			productCode: toyB.code,
			productName: toyB.name,
			productRevision: toyB.revision,
			unitOfMeasure: toyB.unitOfMeasure,
			requestedQuantity: 75,
			estimatedQuantity: 76,
			productSnapshot: buildProductSnapshot(toyB),
		},
		{
			id: DEMO_VERSION_LINE_IDS[5],
			demandLineId: demandLines[2].id,
			productId: toyC.id,
			lineNo: 3,
			productCode: toyC.code,
			productName: toyC.name,
			productRevision: toyC.revision,
			unitOfMeasure: toyC.unitOfMeasure,
			requestedQuantity: 55,
			estimatedQuantity: 54,
			productSnapshot: buildProductSnapshot(toyC),
		},
	];

	await prisma.demandEstimateLine.createMany({
		data: version1Lines.map((line) => ({
			...line,
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			demandEstimateVersionId: version1.id,
			notes: "Seeded version 1 estimate line",
		})),
	});

	await prisma.demandEstimateLine.createMany({
		data: version2Lines.map((line) => ({
			...line,
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			demandEstimateVersionId: version2.id,
			notes: "Seeded version 2 estimate line",
		})),
	});

	await prisma.demandMaterialRequirement.createMany({
		data: [
			...buildMaterialRows(
				workspaceId,
				organizationId,
				plan.id,
				version1.id,
				1,
				240,
				DEMO_MATERIAL_IDS.slice(0, 3),
			),
			...buildMaterialRows(
				workspaceId,
				organizationId,
				plan.id,
				version2.id,
				4,
				260,
				DEMO_MATERIAL_IDS.slice(3, 6),
			),
		],
	});

	await prisma.demandLaborRequirement.createMany({
		data: [
			...buildLaborRows(workspaceId, organizationId, plan.id, version1.id, DEMO_LABOR_IDS.slice(0, 3)),
			...buildLaborRows(workspaceId, organizationId, plan.id, version2.id, DEMO_LABOR_IDS.slice(3, 6)),
		],
	});

	await prisma.projectConversion.create({
		data: {
			id: DEMO_CONVERSION_ID,
			workspaceId,
			organizationId,
			demandPlanId: plan.id,
			demandEstimateVersionId: version2.id,
			projectId: null,
			conversionCode: "CONV-2026-07-001",
			status: ProjectConversionStatus.PENDING,
			metadata: {
				demoSeed: true,
				source: "demandSeeder",
				version: 2,
			},
			notes: "Mock conversion record for the July 2026 toy demand demo",
		},
	});

	console.log(`✅ Seeded demand plan ${plan.planCode} with 3 lines and 2 versions`);
}
