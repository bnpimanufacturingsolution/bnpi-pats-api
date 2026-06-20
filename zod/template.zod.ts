import { z } from "zod";
import { isValidObjectId } from "mongoose";


// Template Schema (full, including ID)
export const TemplateSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	name: z.string().min(1, "Template name is required").max(255, "Template name too long (max 255 characters)"),
	description: z.string().max(5000, "Description too long (max 5000 characters)").optional(),
	type: z.string().max(100, "Type too long (max 100 characters)").optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Template = z.infer<typeof TemplateSchema>;

// Create Template Schema (excluding ID, workspaceId, createdAt, updatedAt, and computed fields)
export const CreateTemplateSchema = TemplateSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	description: true,
	type: true,
	isDeleted: true,
});

export type CreateTemplate = z.infer<typeof CreateTemplateSchema>;

// Update Template Schema (partial, excluding immutable fields and relations)
export const UpdateTemplateSchema = TemplateSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
}).partial();

export type UpdateTemplate = z.infer<typeof UpdateTemplateSchema>;
