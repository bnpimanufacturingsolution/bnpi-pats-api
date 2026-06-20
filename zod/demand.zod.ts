import { z } from "zod";
import { isValidObjectId } from "mongoose";

const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
	message: "Invalid ID format",
});

const jsonValueSchema = z.any().nullable().optional();
const dateSchema = z.coerce.date();

export const DemandPlanStatusSchema = z.enum([
	"DRAFT",
	"SUBMITTED",
	"APPROVED",
	"REJECTED",
	"REVISED",
	"CONVERTED_TO_PROJECT",
	"ARCHIVED",
]);
export type DemandPlanStatus = z.infer<typeof DemandPlanStatusSchema>;

export const DemandEstimateVersionStatusSchema = z.enum([
	"DRAFT",
	"CALCULATED",
	"APPROVED",
	"REJECTED",
	"REVISED",
	"ARCHIVED",
]);
export type DemandEstimateVersionStatus = z.infer<typeof DemandEstimateVersionStatusSchema>;

export const ProjectConversionStatusSchema = z.enum([
	"PENDING",
	"READY",
	"COMPLETED",
	"FAILED",
	"CANCELLED",
]);
export type ProjectConversionStatus = z.infer<typeof ProjectConversionStatusSchema>;

export const DemandLineSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	demandPlanId: objectIdSchema,
	productId: objectIdSchema,
	lineNo: z.number().int().nonnegative(),
	productCode: z.string().min(1, "Product code is required").max(50, "Product code too long"),
	productName: z.string().min(1, "Product name is required").max(255, "Product name too long"),
	productRevision: z.string().max(50).optional(),
	unitOfMeasure: z.string().min(1, "Unit of measure is required").max(50),
	quantity: z.number().int().nonnegative(),
	targetDeliveryDate: dateSchema.optional(),
	priority: z.number().int().nonnegative().optional(),
	productSnapshot: jsonValueSchema,
	notes: z.string().max(5000, "Notes too long").optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type DemandLine = z.infer<typeof DemandLineSchema>;

export const CreateDemandLineSchema = z.object({
	productId: objectIdSchema,
	lineNo: z.number().int().nonnegative().optional(),
	productCode: z.string().min(1).max(50).optional(),
	productName: z.string().min(1).max(255).optional(),
	productRevision: z.string().max(50).optional(),
	unitOfMeasure: z.string().min(1).max(50).optional(),
	quantity: z.number().int().nonnegative(),
	targetDeliveryDate: dateSchema.optional(),
	priority: z.number().int().nonnegative().optional(),
	productSnapshot: jsonValueSchema,
	notes: z.string().max(5000).optional(),
});
export type CreateDemandLine = z.infer<typeof CreateDemandLineSchema>;

export const UpdateDemandLineSchema = CreateDemandLineSchema.partial();
export type UpdateDemandLine = z.infer<typeof UpdateDemandLineSchema>;

export const DemandEstimateLineSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	demandPlanId: objectIdSchema,
	demandEstimateVersionId: objectIdSchema,
	demandLineId: objectIdSchema,
	productId: objectIdSchema,
	lineNo: z.number().int().nonnegative(),
	productCode: z.string().min(1).max(50),
	productName: z.string().min(1).max(255),
	productRevision: z.string().max(50).optional(),
	unitOfMeasure: z.string().min(1).max(50),
	requestedQuantity: z.number().int().nonnegative(),
	estimatedQuantity: z.number().int().nonnegative().optional(),
	productSnapshot: jsonValueSchema,
	notes: z.string().max(5000).optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type DemandEstimateLine = z.infer<typeof DemandEstimateLineSchema>;

export const CreateDemandEstimateLineSchema = z.object({
	demandLineId: objectIdSchema,
	productId: objectIdSchema,
	lineNo: z.number().int().nonnegative().optional(),
	productCode: z.string().min(1).max(50).optional(),
	productName: z.string().min(1).max(255).optional(),
	productRevision: z.string().max(50).optional(),
	unitOfMeasure: z.string().min(1).max(50).optional(),
	requestedQuantity: z.number().int().nonnegative(),
	estimatedQuantity: z.number().int().nonnegative().optional(),
	productSnapshot: jsonValueSchema,
	notes: z.string().max(5000).optional(),
});
export type CreateDemandEstimateLine = z.infer<typeof CreateDemandEstimateLineSchema>;

export const UpdateDemandEstimateLineSchema = CreateDemandEstimateLineSchema.partial();
export type UpdateDemandEstimateLine = z.infer<typeof UpdateDemandEstimateLineSchema>;

export const DemandMaterialRequirementSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	demandPlanId: objectIdSchema,
	demandEstimateVersionId: objectIdSchema,
	lineNo: z.number().int().nonnegative(),
	materialCode: z.string().max(100).optional(),
	materialName: z.string().min(1, "Material name is required").max(255),
	materialType: z.string().max(100).optional(),
	quantityPerUnit: z.number().nonnegative(),
	totalRequiredQuantity: z.number().nonnegative(),
	unitOfMeasure: z.string().min(1, "Unit of measure is required").max(50),
	scrapRatePercentage: z.number().nonnegative().default(0),
	isOptional: z.boolean().default(false),
	sourceLabel: z.string().max(255).optional(),
	materialSnapshot: jsonValueSchema,
	notes: z.string().max(5000).optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type DemandMaterialRequirement = z.infer<typeof DemandMaterialRequirementSchema>;

export const CreateDemandMaterialRequirementSchema = z.object({
	lineNo: z.number().int().nonnegative().optional(),
	materialCode: z.string().max(100).optional(),
	materialName: z.string().min(1, "Material name is required").max(255),
	materialType: z.string().max(100).optional(),
	quantityPerUnit: z.number().nonnegative(),
	totalRequiredQuantity: z.number().nonnegative(),
	unitOfMeasure: z.string().min(1, "Unit of measure is required").max(50),
	scrapRatePercentage: z.number().nonnegative().optional(),
	isOptional: z.boolean().optional(),
	sourceLabel: z.string().max(255).optional(),
	materialSnapshot: jsonValueSchema,
	notes: z.string().max(5000).optional(),
});
export type CreateDemandMaterialRequirement = z.infer<typeof CreateDemandMaterialRequirementSchema>;

export const UpdateDemandMaterialRequirementSchema = CreateDemandMaterialRequirementSchema.partial();
export type UpdateDemandMaterialRequirement = z.infer<typeof UpdateDemandMaterialRequirementSchema>;

export const DemandLaborRequirementSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	demandPlanId: objectIdSchema,
	demandEstimateVersionId: objectIdSchema,
	lineNo: z.number().int().nonnegative(),
	stepName: z.string().min(1, "Step name is required").max(255),
	workCenter: z.string().max(255).optional(),
	stepOrder: z.number().int().nonnegative().optional(),
	laborHours: z.number().nonnegative(),
	crewSize: z.number().int().nonnegative().optional(),
	ratePerHour: z.number().nonnegative().optional(),
	totalLaborCost: z.number().nonnegative().optional(),
	sourceLabel: z.string().max(255).optional(),
	laborSnapshot: jsonValueSchema,
	notes: z.string().max(5000).optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type DemandLaborRequirement = z.infer<typeof DemandLaborRequirementSchema>;

export const CreateDemandLaborRequirementSchema = z.object({
	lineNo: z.number().int().nonnegative().optional(),
	stepName: z.string().min(1, "Step name is required").max(255),
	workCenter: z.string().max(255).optional(),
	stepOrder: z.number().int().nonnegative().optional(),
	laborHours: z.number().nonnegative(),
	crewSize: z.number().int().nonnegative().optional(),
	ratePerHour: z.number().nonnegative().optional(),
	totalLaborCost: z.number().nonnegative().optional(),
	sourceLabel: z.string().max(255).optional(),
	laborSnapshot: jsonValueSchema,
	notes: z.string().max(5000).optional(),
});
export type CreateDemandLaborRequirement = z.infer<typeof CreateDemandLaborRequirementSchema>;

export const UpdateDemandLaborRequirementSchema = CreateDemandLaborRequirementSchema.partial();
export type UpdateDemandLaborRequirement = z.infer<typeof UpdateDemandLaborRequirementSchema>;

export const ProjectConversionSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	demandPlanId: objectIdSchema,
	demandEstimateVersionId: objectIdSchema,
	projectId: objectIdSchema.optional(),
	conversionCode: z.string().max(100).optional(),
	status: ProjectConversionStatusSchema,
	convertedAt: dateSchema.optional(),
	metadata: jsonValueSchema,
	notes: z.string().max(5000).optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type ProjectConversion = z.infer<typeof ProjectConversionSchema>;

export const CreateProjectConversionSchema = z.object({
	demandEstimateVersionId: objectIdSchema,
	projectId: objectIdSchema.optional(),
	conversionCode: z.string().max(100).optional(),
	status: ProjectConversionStatusSchema.optional(),
	convertedAt: dateSchema.optional(),
	metadata: jsonValueSchema,
	notes: z.string().max(5000).optional(),
});
export type CreateProjectConversion = z.infer<typeof CreateProjectConversionSchema>;

export const UpdateProjectConversionSchema = CreateProjectConversionSchema.partial();
export type UpdateProjectConversion = z.infer<typeof UpdateProjectConversionSchema>;

export const DemandEstimateVersionSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	demandPlanId: objectIdSchema,
	versionNumber: z.number().int().positive(),
	versionLabel: z.string().max(255).optional(),
	status: DemandEstimateVersionStatusSchema,
	metadata: jsonValueSchema,
	notes: z.string().max(5000).optional(),
	demandEstimateLines: z.array(DemandEstimateLineSchema).optional(),
	demandMaterialRequirements: z.array(DemandMaterialRequirementSchema).optional(),
	demandLaborRequirements: z.array(DemandLaborRequirementSchema).optional(),
	projectConversion: ProjectConversionSchema.optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type DemandEstimateVersion = z.infer<typeof DemandEstimateVersionSchema>;

export const CreateDemandEstimateVersionSchema = z.object({
	versionNumber: z.number().int().positive().optional(),
	versionLabel: z.string().max(255).optional(),
	status: DemandEstimateVersionStatusSchema.optional(),
	metadata: jsonValueSchema,
	notes: z.string().max(5000).optional(),
	estimateLines: z.array(CreateDemandEstimateLineSchema).optional(),
	materialRequirements: z.array(CreateDemandMaterialRequirementSchema).optional(),
	laborRequirements: z.array(CreateDemandLaborRequirementSchema).optional(),
});
export type CreateDemandEstimateVersion = z.infer<typeof CreateDemandEstimateVersionSchema>;

export const UpdateDemandEstimateVersionSchema = z.object({
	versionLabel: z.string().max(255).optional(),
	status: DemandEstimateVersionStatusSchema.optional(),
	metadata: jsonValueSchema,
	notes: z.string().max(5000).optional(),
});
export type UpdateDemandEstimateVersion = z.infer<typeof UpdateDemandEstimateVersionSchema>;

export const DemandPlanSchema = z.object({
	id: objectIdSchema,
	workspaceId: objectIdSchema,
	organizationId: z.string().optional(),
	planCode: z.string().min(1, "Plan code is required").max(100, "Plan code too long"),
	name: z.string().min(1, "Name is required").max(255, "Name too long"),
	description: z.string().max(5000).optional(),
	periodLabel: z.string().max(100).optional(),
	periodStart: dateSchema,
	periodEnd: dateSchema,
	status: DemandPlanStatusSchema,
	metadata: jsonValueSchema,
	notes: z.string().max(5000).optional(),
	demandLines: z.array(DemandLineSchema).optional(),
	estimateVersions: z.array(DemandEstimateVersionSchema).optional(),
	projectConversions: z.array(ProjectConversionSchema).optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type DemandPlan = z.infer<typeof DemandPlanSchema>;

export const CreateDemandPlanSchema = z
	.object({
		planCode: z.string().min(1).max(100).optional(),
		name: z.string().min(1, "Name is required").max(255, "Name too long"),
		description: z.string().max(5000).optional(),
		periodLabel: z.string().max(100).optional(),
		periodStart: dateSchema,
		periodEnd: dateSchema,
		status: DemandPlanStatusSchema.optional(),
		metadata: jsonValueSchema,
		notes: z.string().max(5000).optional(),
	})
	.refine((data) => data.periodEnd >= data.periodStart, {
		message: "Period end must be on or after period start",
		path: ["periodEnd"],
	});
export type CreateDemandPlan = z.infer<typeof CreateDemandPlanSchema>;

export const UpdateDemandPlanSchema = z.object({
	planCode: z.string().min(1).max(100).optional(),
	name: z.string().min(1, "Name is required").max(255, "Name too long").optional(),
	description: z.string().max(5000).optional(),
	periodLabel: z.string().max(100).optional(),
	periodStart: dateSchema.optional(),
	periodEnd: dateSchema.optional(),
	status: DemandPlanStatusSchema.optional(),
	metadata: jsonValueSchema,
	notes: z.string().max(5000).optional(),
});
export type UpdateDemandPlan = z.infer<typeof UpdateDemandPlanSchema>;
