import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Sequential Schema (full, including ID)
export const SequentialSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	name: z.string().min(1, "Name is required").max(100, "Name too long (max 100 characters)"),
	code: z.string().min(1, "Code is required").max(50, "Code too long (max 50 characters)"),
	pattern: z.string().min(1, "Pattern is required").max(100, "Pattern too long (max 100 characters)"),
	module: z.string().max(50, "Module too long (max 50 characters)").nullable().optional(),
	current: z.number().int("Current must be a whole number").min(0, "Current must be non-negative").max(999999999, "Current value too large"),
	updatedAt: z.coerce.date(),
	createdAt: z.coerce.date(),
	isDeleted: z.boolean(),
});

export type Sequential = z.infer<typeof SequentialSchema>;

// Create Sequential Schema (excluding ID, workspaceId, createdAt, updatedAt)
export const CreateSequentialSchema = SequentialSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	module: true,
	current: true,
	isDeleted: true,
});

export type CreateSequential = z.infer<typeof CreateSequentialSchema>;

// Update Sequential Schema (partial, excluding immutable fields)
export const UpdateSequentialSchema = SequentialSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateSequential = z.infer<typeof UpdateSequentialSchema>;
