import { z } from "zod";
import { isValidObjectId } from "mongoose";

// FieldType Enum
export const FieldTypeSchema = z.enum([
	"singletext",
	"multitext",
	"number",
	"date",
	"singleselect",
	"multipleselect",
	"iteration",
	"user",
	"employee",    // Reference to Employee entity
	"calculated",
	"item",
	"object",
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

// FieldCategory Enum
export const FieldCategorySchema = z.enum(["common", "custom"]);
export type FieldCategory = z.infer<typeof FieldCategorySchema>;

// ObjectId validation helper
const objectIdString = z.string().refine((val) => isValidObjectId(val), { message: "Invalid ObjectId format" });
const optionalObjectId = z.string().refine((val) => !val || isValidObjectId(val), { message: "Invalid ObjectId format" }).optional().nullable();

// Field Schema (full, including ID)
export const FieldSchema = z.object({
	id: objectIdString,
	workspaceId: objectIdString,
	name: z.string().min(1, "Name is required").max(255, "Name too long (max 255 characters)"),
	label: z.string().max(255).optional().nullable(),
	type: FieldTypeSchema,
	category: FieldCategorySchema,
	value: z.any().optional().nullable(),
	placeholder: z.string().max(255).optional().nullable(),
	required: z.boolean().default(false),
	sortOrder: z.number().int().default(0),
	itemTypeId: optionalObjectId,
	categoryId: optionalObjectId,
	isDeleted: z.boolean().default(false),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Field = z.infer<typeof FieldSchema>;

// Create Field Schema
export const CreateFieldSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	label: z.string().max(255).optional().nullable(),
	type: FieldTypeSchema,
	category: FieldCategorySchema.default("custom"),
	value: z.any().optional().nullable(),
	placeholder: z.string().max(255).optional().nullable(),
	required: z.boolean().optional().default(false),
	sortOrder: z.number().int().optional().default(0),
	itemTypeId: optionalObjectId,
	categoryId: optionalObjectId,
	isDeleted: z.boolean().optional().default(false),
});

export type CreateField = z.infer<typeof CreateFieldSchema>;

// Update Field Schema (all fields optional)
export const UpdateFieldSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	label: z.string().max(255).optional().nullable(),
	type: FieldTypeSchema.optional(),
	category: FieldCategorySchema.optional(),
	value: z.any().optional().nullable(),
	placeholder: z.string().max(255).optional().nullable(),
	required: z.boolean().optional(),
	sortOrder: z.number().int().optional(),
	itemTypeId: optionalObjectId,
	categoryId: optionalObjectId,
	isDeleted: z.boolean().optional(),
});

export type UpdateField = z.infer<typeof UpdateFieldSchema>;
