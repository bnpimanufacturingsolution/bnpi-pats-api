import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Category Schema (full, including ID)
export const CategorySchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	name: z.string().min(1, "Category name is required").max(120, "Category name too long (max 120 characters)"),
	code: z.string().length(3, "Code must be exactly 3 characters").toUpperCase().optional().nullable(),
	description: z.string().max(500, "Description too long (max 500 characters)").optional(),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format").optional(),
	type: z.enum(["CAPEX", "OPEX"], { required_error: "Category type is required" }),
	isActive: z.boolean(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Category = z.infer<typeof CategorySchema>;

// Create Category Schema (excluding ID, workspaceId, createdAt, updatedAt)
export const CreateCategorySchema = CategorySchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	code: true,
	description: true,
	color: true,
	isActive: true,
	isDeleted: true,
});

export type CreateCategory = z.infer<typeof CreateCategorySchema>;

// Update Category Schema (partial, excluding immutable fields)
export const UpdateCategorySchema = CategorySchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
