import { z } from "zod";
import { isValidObjectId } from "mongoose";

const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
	message: "Invalid ID format",
});

export const ProductStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductMaterialTypeSchema = z.enum([
	"RAW_MATERIAL",
	"PACKAGING",
	"COMPONENT",
	"SUBASSEMBLY",
	"CONSUMABLE",
]);
export type ProductMaterialType = z.infer<typeof ProductMaterialTypeSchema>;

export const ProductCostBasisSchema = z.enum([
	"PER_UNIT",
	"PER_BATCH",
	"PER_HOUR",
	"PERCENTAGE",
	"FIXED",
]);
export type ProductCostBasis = z.infer<typeof ProductCostBasisSchema>;

export const ProductCostScopeSchema = z.enum(["PRODUCT", "STEP", "MATERIAL"]);
export type ProductCostScope = z.infer<typeof ProductCostScopeSchema>;

export const ProductCostAssumptionTypeSchema = z.enum([
	"MATERIAL_COST",
	"LABOR_RATE",
	"OVERHEAD",
	"PACKAGING",
	"LOGISTICS",
	"SCRAP",
	"CONTINGENCY",
	"OTHER",
]);
export type ProductCostAssumptionType = z.infer<typeof ProductCostAssumptionTypeSchema>;

export const ProductProductionStepSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	productId: objectIdSchema,
	stepOrder: z.number().int().nonnegative(),
	name: z.string().min(1, "Step name is required").max(255, "Step name too long"),
	description: z.string().optional(),
	workCenter: z.string().max(255).optional(),
	laborHours: z.number().nonnegative().optional(),
	setupMinutes: z.number().int().nonnegative().optional(),
	cycleTimeMinutes: z.number().int().nonnegative().optional(),
	outputQuantity: z.number().int().positive().default(1),
	isCritical: z.boolean().default(false),
	notes: z.string().optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type ProductProductionStep = z.infer<typeof ProductProductionStepSchema>;

export const CreateProductProductionStepSchema = ProductProductionStepSchema.omit({
	id: true,
	workspaceId: true,
	organizationId: true,
	productId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	description: true,
	workCenter: true,
	laborHours: true,
	setupMinutes: true,
	cycleTimeMinutes: true,
	notes: true,
	isDeleted: true,
	outputQuantity: true,
	isCritical: true,
});

export type CreateProductProductionStep = z.infer<typeof CreateProductProductionStepSchema>;

export const ProductMaterialSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	productId: objectIdSchema,
	lineNo: z.number().int().nonnegative(),
	materialName: z.string().min(1, "Material name is required").max(255, "Material name too long"),
	materialCode: z.string().max(100).optional(),
	materialType: ProductMaterialTypeSchema,
	quantityPerUnit: z.number().nonnegative(),
	uom: z.string().min(1, "UOM is required").max(50, "UOM too long"),
	scrapRatePercentage: z.number().nonnegative().default(0),
	isOptional: z.boolean().default(false),
	preferredSupplierName: z.string().max(255).optional(),
	notes: z.string().optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type ProductMaterial = z.infer<typeof ProductMaterialSchema>;

export const CreateProductMaterialSchema = ProductMaterialSchema.omit({
	id: true,
	workspaceId: true,
	organizationId: true,
	productId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	materialCode: true,
	preferredSupplierName: true,
	notes: true,
	isDeleted: true,
	scrapRatePercentage: true,
	isOptional: true,
});

export type CreateProductMaterial = z.infer<typeof CreateProductMaterialSchema>;

export const ProductCostAssumptionSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	productId: objectIdSchema,
	assumptionName: z.string().min(1, "Assumption name is required").max(255, "Assumption name too long"),
	assumptionType: ProductCostAssumptionTypeSchema,
	basis: ProductCostBasisSchema,
	scope: ProductCostScopeSchema,
	scopeRef: z.string().max(255).optional(),
	value: z.number().nonnegative(),
	currency: z.string().min(1, "Currency is required").max(10, "Currency too long"),
	effectiveFrom: z.coerce.date().optional(),
	effectiveTo: z.coerce.date().optional(),
	isActive: z.boolean().default(true),
	notes: z.string().optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type ProductCostAssumption = z.infer<typeof ProductCostAssumptionSchema>;

export const CreateProductCostAssumptionSchema = ProductCostAssumptionSchema.omit({
	id: true,
	workspaceId: true,
	organizationId: true,
	productId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	scopeRef: true,
	effectiveFrom: true,
	effectiveTo: true,
	notes: true,
	isDeleted: true,
	isActive: true,
});

export type CreateProductCostAssumption = z.infer<typeof CreateProductCostAssumptionSchema>;

export const ProductSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	code: z.string().min(1, "Code is required").max(50, "Code too long"),
	name: z.string().min(1, "Name is required").max(255, "Name too long"),
	description: z.string().optional(),
	brand: z.string().max(255).optional(),
	category: z.string().max(255).optional(),
	variant: z.string().max(255).optional(),
	unitOfMeasure: z.string().min(1, "Unit of measure is required").max(50, "Unit of measure too long"),
	revision: z.string().min(1, "Revision is required").max(50, "Revision too long"),
	status: ProductStatusSchema,
	tags: z.array(z.string().min(1).max(50)).default([]),
	metadata: z.record(z.string(), z.any()).optional(),
	productionSteps: z.array(ProductProductionStepSchema).optional(),
	materials: z.array(ProductMaterialSchema).optional(),
	costAssumptions: z.array(ProductCostAssumptionSchema).optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = ProductSchema.omit({
	id: true,
	workspaceId: true,
	organizationId: true,
	createdAt: true,
	updatedAt: true,
	productionSteps: true,
	materials: true,
	costAssumptions: true,
}).partial({
	description: true,
	brand: true,
	category: true,
	variant: true,
	unitOfMeasure: true,
	revision: true,
	status: true,
	tags: true,
	metadata: true,
	isDeleted: true,
	code: true,
});

export type CreateProduct = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();

export type UpdateProduct = z.infer<typeof UpdateProductSchema>;
