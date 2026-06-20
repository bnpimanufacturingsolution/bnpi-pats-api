import { z } from "zod";
import { isValidObjectId } from "mongoose";

// ItemTypeStatus Enum
export const ItemTypeStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type ItemTypeStatus = z.infer<typeof ItemTypeStatusSchema>;

// ItemType Schema (full, including ID)
export const ItemTypeSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	name: z.string().min(1, "Name is required").max(255, "Name too long (max 255 characters)"),
	description: z.string().optional(),
	icon: z.string().optional(),
	defaultFields: z.array(z.any()).default([]),
	status: ItemTypeStatusSchema,
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type ItemType = z.infer<typeof ItemTypeSchema>;

// Create ItemType Schema (excluding ID, workspaceId, createdAt, updatedAt)
export const CreateItemTypeSchema = ItemTypeSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	isDeleted: true,
	description: true,
	icon: true,
	defaultFields: true,
});

export type CreateItemType = z.infer<typeof CreateItemTypeSchema>;

// Update ItemType Schema (partial, excluding immutable fields)
export const UpdateItemTypeSchema = ItemTypeSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateItemType = z.infer<typeof UpdateItemTypeSchema>;
