import { PrismaClient, ProductStatus, ProductMaterialType, ProductCostBasis, ProductCostScope, ProductCostAssumptionType } from "../../generated/prisma";

type WorkspaceInput = string | string[];

function normalizeWorkspaces(workspaceIds: WorkspaceInput): string[] {
	return Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];
}

export async function seedProduct(prisma: PrismaClient, workspaceIds: WorkspaceInput) {
	console.log("🌱 Starting product seeding...");

	const ids = normalizeWorkspaces(workspaceIds);

	const productSeedData = [
		{
			id: "608f1f77bcf86cd799450101",
			code: "TOY-A",
			name: "Toy A",
			description: "Starter toy car with simple assembly and low material footprint",
			brand: "Bandai PATS",
			category: "Toys",
			variant: "Starter",
			unitOfMeasure: "PCS",
			revision: "A",
			status: ProductStatus.ACTIVE,
			tags: ["toy", "starter", "demo"],
			metadata: { targetMarket: "Retail", packSize: 1 },
			steps: [
				{
					stepOrder: 1,
					name: "Mold body shell",
					workCenter: "Injection Molding",
					laborHours: 0.4,
					setupMinutes: 15,
					cycleTimeMinutes: 3,
					outputQuantity: 1,
					isCritical: true,
				},
				{
					stepOrder: 2,
					name: "Assemble wheels and axle",
					workCenter: "Assembly",
					laborHours: 0.2,
					setupMinutes: 10,
					cycleTimeMinutes: 2,
					outputQuantity: 1,
					isCritical: true,
				},
				{
					stepOrder: 3,
					name: "Inspect and package",
					workCenter: "QA / Packaging",
					laborHours: 0.15,
					setupMinutes: 5,
					cycleTimeMinutes: 2,
					outputQuantity: 1,
					isCritical: false,
				},
			],
			materials: [
				{
					lineNo: 1,
					materialName: "Plastic body shell",
					materialCode: "PL-BODY",
					materialType: ProductMaterialType.RAW_MATERIAL,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 2,
					isOptional: false,
				},
				{
					lineNo: 2,
					materialName: "Wheel set",
					materialCode: "WHL-SET",
					materialType: ProductMaterialType.COMPONENT,
					quantityPerUnit: 4,
					uom: "PCS",
					scrapRatePercentage: 1,
					isOptional: false,
				},
				{
					lineNo: 3,
					materialName: "Axle pin",
					materialCode: "AXL-PIN",
					materialType: ProductMaterialType.COMPONENT,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 1,
					isOptional: false,
				},
				{
					lineNo: 4,
					materialName: "Printed box",
					materialCode: "BOX-PRINT",
					materialType: ProductMaterialType.PACKAGING,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 0,
					isOptional: false,
				},
			],
			costAssumptions: [
				{
					assumptionName: "Direct material cost",
					assumptionType: ProductCostAssumptionType.MATERIAL_COST,
					basis: ProductCostBasis.PER_UNIT,
					scope: ProductCostScope.PRODUCT,
					value: 35,
					currency: "PHP",
					isActive: true,
				},
				{
					assumptionName: "Labor rate",
					assumptionType: ProductCostAssumptionType.LABOR_RATE,
					basis: ProductCostBasis.PER_HOUR,
					scope: ProductCostScope.STEP,
					scopeRef: "Assembly",
					value: 120,
					currency: "PHP",
					isActive: true,
				},
				{
					assumptionName: "Packaging cost",
					assumptionType: ProductCostAssumptionType.PACKAGING,
					basis: ProductCostBasis.PER_UNIT,
					scope: ProductCostScope.MATERIAL,
					scopeRef: "BOX-PRINT",
					value: 8,
					currency: "PHP",
					isActive: true,
				},
			],
		},
		{
			id: "608f1f77bcf86cd799450102",
			code: "TOY-B",
			name: "Toy B",
			description: "Intermediate toy robot with more assembly steps and higher labor content",
			brand: "Bandai PATS",
			category: "Toys",
			variant: "Assembly",
			unitOfMeasure: "PCS",
			revision: "A",
			status: ProductStatus.ACTIVE,
			tags: ["toy", "assembly", "demo"],
			metadata: { targetMarket: "Retail", packSize: 1 },
			steps: [
				{
					stepOrder: 1,
					name: "Mold chassis",
					workCenter: "Injection Molding",
					laborHours: 0.5,
					setupMinutes: 20,
					cycleTimeMinutes: 4,
					outputQuantity: 1,
					isCritical: true,
				},
				{
					stepOrder: 2,
					name: "Install electronics module",
					workCenter: "Electronics Assembly",
					laborHours: 0.45,
					setupMinutes: 12,
					cycleTimeMinutes: 3,
					outputQuantity: 1,
					isCritical: true,
				},
				{
					stepOrder: 3,
					name: "Final assembly and testing",
					workCenter: "QA / Assembly",
					laborHours: 0.35,
					setupMinutes: 8,
					cycleTimeMinutes: 3,
					outputQuantity: 1,
					isCritical: true,
				},
			],
			materials: [
				{
					lineNo: 1,
					materialName: "Chassis shell",
					materialCode: "CHS-SHL",
					materialType: ProductMaterialType.RAW_MATERIAL,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 3,
					isOptional: false,
				},
				{
					lineNo: 2,
					materialName: "Motor kit",
					materialCode: "MTR-KIT",
					materialType: ProductMaterialType.COMPONENT,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 1,
					isOptional: false,
				},
				{
					lineNo: 3,
					materialName: "Circuit board",
					materialCode: "PCB-01",
					materialType: ProductMaterialType.COMPONENT,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 1,
					isOptional: false,
				},
				{
					lineNo: 4,
					materialName: "Printed box",
					materialCode: "BOX-PRINT",
					materialType: ProductMaterialType.PACKAGING,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 0,
					isOptional: false,
				},
			],
			costAssumptions: [
				{
					assumptionName: "Direct material cost",
					assumptionType: ProductCostAssumptionType.MATERIAL_COST,
					basis: ProductCostBasis.PER_UNIT,
					scope: ProductCostScope.PRODUCT,
					value: 58,
					currency: "PHP",
					isActive: true,
				},
				{
					assumptionName: "Labor rate",
					assumptionType: ProductCostAssumptionType.LABOR_RATE,
					basis: ProductCostBasis.PER_HOUR,
					scope: ProductCostScope.STEP,
					scopeRef: "Electronics Assembly",
					value: 150,
					currency: "PHP",
					isActive: true,
				},
				{
					assumptionName: "Overhead allowance",
					assumptionType: ProductCostAssumptionType.OVERHEAD,
					basis: ProductCostBasis.PERCENTAGE,
					scope: ProductCostScope.PRODUCT,
					value: 12,
					currency: "PHP",
					isActive: true,
				},
			],
		},
		{
			id: "608f1f77bcf86cd799450103",
			code: "TOY-C",
			name: "Toy C",
			description: "Premium play set with packaging, quality controls, and higher overhead",
			brand: "Bandai PATS",
			category: "Toys",
			variant: "Premium",
			unitOfMeasure: "PCS",
			revision: "A",
			status: ProductStatus.ACTIVE,
			tags: ["toy", "premium", "demo"],
			metadata: { targetMarket: "Retail", packSize: 1 },
			steps: [
				{
					stepOrder: 1,
					name: "Prep molded components",
					workCenter: "Molding",
					laborHours: 0.45,
					setupMinutes: 18,
					cycleTimeMinutes: 4,
					outputQuantity: 1,
					isCritical: true,
				},
				{
					stepOrder: 2,
					name: "Assemble play set",
					workCenter: "Assembly",
					laborHours: 0.55,
					setupMinutes: 14,
					cycleTimeMinutes: 4,
					outputQuantity: 1,
					isCritical: true,
				},
				{
					stepOrder: 3,
					name: "Detailed quality check",
					workCenter: "QA",
					laborHours: 0.25,
					setupMinutes: 10,
					cycleTimeMinutes: 2,
					outputQuantity: 1,
					isCritical: true,
				},
				{
					stepOrder: 4,
					name: "Premium packaging",
					workCenter: "Packaging",
					laborHours: 0.2,
					setupMinutes: 6,
					cycleTimeMinutes: 2,
					outputQuantity: 1,
					isCritical: false,
				},
			],
			materials: [
				{
					lineNo: 1,
					materialName: "Molded base set",
					materialCode: "BASE-SET",
					materialType: ProductMaterialType.SUBASSEMBLY,
					quantityPerUnit: 1,
					uom: "SET",
					scrapRatePercentage: 2,
					isOptional: false,
				},
				{
					lineNo: 2,
					materialName: "Accessory pack",
					materialCode: "ACC-PACK",
					materialType: ProductMaterialType.COMPONENT,
					quantityPerUnit: 1,
					uom: "SET",
					scrapRatePercentage: 1,
					isOptional: false,
				},
				{
					lineNo: 3,
					materialName: "Premium tray",
					materialCode: "TRAY-PREM",
					materialType: ProductMaterialType.PACKAGING,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 0,
					isOptional: false,
				},
				{
					lineNo: 4,
					materialName: "Shrink wrap",
					materialCode: "SHR-WRP",
					materialType: ProductMaterialType.PACKAGING,
					quantityPerUnit: 1,
					uom: "PCS",
					scrapRatePercentage: 0,
					isOptional: false,
				},
			],
			costAssumptions: [
				{
					assumptionName: "Direct material cost",
					assumptionType: ProductCostAssumptionType.MATERIAL_COST,
					basis: ProductCostBasis.PER_UNIT,
					scope: ProductCostScope.PRODUCT,
					value: 72,
					currency: "PHP",
					isActive: true,
				},
				{
					assumptionName: "Labor rate",
					assumptionType: ProductCostAssumptionType.LABOR_RATE,
					basis: ProductCostBasis.PER_HOUR,
					scope: ProductCostScope.STEP,
					scopeRef: "Assembly",
					value: 165,
					currency: "PHP",
					isActive: true,
				},
				{
					assumptionName: "Contingency",
					assumptionType: ProductCostAssumptionType.CONTINGENCY,
					basis: ProductCostBasis.PERCENTAGE,
					scope: ProductCostScope.PRODUCT,
					value: 10,
					currency: "PHP",
					isActive: true,
				},
			],
		},
	];

	const workspaceScopedProducts = ids.map((workspaceId, index) => {
		const product = productSeedData[index % productSeedData.length];
		return {
			...product,
			workspaceId,
			organizationId: workspaceId,
		};
	});

	try {
		console.log("🗑️  Clearing existing product records...");
		await prisma.productCostAssumption.deleteMany({});
		await prisma.productMaterial.deleteMany({});
		await prisma.productProductionStep.deleteMany({});
		await prisma.product.deleteMany({});

		console.log("📝 Creating product records...");
		for (const [index, product] of workspaceScopedProducts.entries()) {
			const createdProduct = await prisma.product.create({
				data: {
					id: product.id,
					workspaceId: product.workspaceId,
					organizationId: product.organizationId,
					code: product.code,
					name: product.name,
					description: product.description,
					brand: product.brand,
					category: product.category,
					variant: product.variant,
					unitOfMeasure: product.unitOfMeasure,
					revision: product.revision,
					status: product.status,
					tags: product.tags,
					metadata: product.metadata,
				},
			});

			await prisma.productProductionStep.createMany({
				data: (product.steps || []).map((step, stepIndex) => ({
					id: `${product.id}-step-${stepIndex + 1}`,
					workspaceId: product.workspaceId,
					organizationId: product.organizationId,
					productId: createdProduct.id,
					stepOrder: step.stepOrder,
					name: step.name,
					description: step.description,
					workCenter: step.workCenter,
					laborHours: step.laborHours,
					setupMinutes: step.setupMinutes,
					cycleTimeMinutes: step.cycleTimeMinutes,
					outputQuantity: step.outputQuantity ?? 1,
					isCritical: step.isCritical ?? false,
					notes: step.notes,
				})),
			});

			await prisma.productMaterial.createMany({
				data: (product.materials || []).map((material, materialIndex) => ({
					id: `${product.id}-material-${materialIndex + 1}`,
					workspaceId: product.workspaceId,
					organizationId: product.organizationId,
					productId: createdProduct.id,
					lineNo: material.lineNo,
					materialName: material.materialName,
					materialCode: material.materialCode,
					materialType: material.materialType,
					quantityPerUnit: material.quantityPerUnit,
					uom: material.uom,
					scrapRatePercentage: material.scrapRatePercentage ?? 0,
					isOptional: material.isOptional ?? false,
					preferredSupplierName: material.preferredSupplierName,
					notes: material.notes,
				})),
			});

			await prisma.productCostAssumption.createMany({
				data: (product.costAssumptions || []).map((assumption, assumptionIndex) => ({
					id: `${product.id}-assumption-${assumptionIndex + 1}`,
					workspaceId: product.workspaceId,
					organizationId: product.organizationId,
					productId: createdProduct.id,
					assumptionName: assumption.assumptionName,
					assumptionType: assumption.assumptionType,
					basis: assumption.basis,
					scope: assumption.scope,
					scopeRef: assumption.scopeRef,
					value: assumption.value,
					currency: assumption.currency,
					effectiveFrom: assumption.effectiveFrom,
					effectiveTo: assumption.effectiveTo,
					isActive: assumption.isActive ?? true,
					notes: assumption.notes,
				})),
			});

			console.log(`   ✓ Seeded ${index + 1}: ${product.code} (${product.name})`);
		}

		console.log(`✅ Successfully created ${workspaceScopedProducts.length} product records`);
		console.log("🎉 Product seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during product seeding:", error);
		throw error;
	}
}
