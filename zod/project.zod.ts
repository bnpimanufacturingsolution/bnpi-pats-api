import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definition matching Prisma
export enum ProjectStatus {
	PENDING = "PENDING",
	ACTIVE = "ACTIVE",
	COMPLETED = "COMPLETED",
	CANCELLED = "CANCELLED",
	ON_HOLD = "ON_HOLD",
}

// Project Schema (full, including ID)
export const ProjectSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	name: z
		.string()
		.min(1, "Project name is required")
		.max(255, "Project name too long (max 255 characters)"),
	description: z.string().max(5000, "Description too long (max 5000 characters)").optional(),
	type: z.string().max(100, "Type too long (max 100 characters)").optional(),
	code: z
		.string()
		.min(1, "Project code is required")
		.max(50, "Project code too long (max 50 characters)"),
	notebookNo: z.string().max(100, "Notebook number too long (max 100 characters)").optional(),
	vatIncEx: z.string().max(50, "VAT INC/EX too long (max 50 characters)").optional(),
	form2307: z.number().int("Form 2307 must be an integer").optional(),
	status: z.nativeEnum(ProjectStatus),
	capital: z.number().optional(),
	actualExpenses: z.number().optional(),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	categoryIds: z.array(z.string().refine((val) => isValidObjectId(val), { message: "Invalid category ID format" })).optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Project = z.infer<typeof ProjectSchema>;

// Create Project Schema (excluding ID, createdAt, updatedAt)
export const CreateProjectSchema = z.object({
	name: z
		.string()
		.min(1, "Project name is required")
		.max(255, "Project name too long (max 255 characters)"),
	description: z.string().max(5000, "Description too long (max 5000 characters)").optional(),
	type: z.string().max(100, "Type too long (max 100 characters)").optional(),
	code: z
		.string()
		.min(1)
		.max(50, "Project code too long (max 50 characters)")
		.optional()
		.or(z.literal(""))
		.transform((val) => (val === "" ? undefined : val)), // Allow empty string, auto-generate if not provided
	notebookNo: z.string().max(100, "Notebook number too long (max 100 characters)").optional(),
	vatIncEx: z.string().max(50, "VAT INC/EX too long (max 50 characters)").optional(),
	form2307: z.number().int("Form 2307 must be an integer").optional(),
	status: z.nativeEnum(ProjectStatus).optional(),
	capital: z.number().nonnegative("Capital must be a non-negative number").optional(),
	actualExpenses: z.number().nonnegative("Actual expenses must be a non-negative number").optional(),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	categoryIds: z.array(z.string().refine((val) => isValidObjectId(val), { message: "Invalid category ID format" })).optional(),
	isDeleted: z.boolean().optional(),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;

// Update Project Schema (partial, excluding immutable fields and relations)
export const UpdateProjectSchema = ProjectSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
