import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definitions matching Prisma
export enum POTypeStatus {
	ACTIVE = "ACTIVE",
	INACTIVE = "INACTIVE",
}

// POType Schema (full, including ID)
export const POTypeSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	organizationId: z.string().optional().nullable(),
	code: z.string().min(1, "Code is required").max(10, "Code too long"),
	name: z.string().min(1, "Name is required").max(100, "Name too long"),
	description: z.string().max(500, "Description too long").optional().nullable(),
	isDefault: z.boolean(),
	requiresDelivery: z.boolean(),
	requiresInspection: z.boolean(),
	allowsPartialDelivery: z.boolean(),
	autoCreateInvoice: z.boolean(),
	invoiceTrigger: z.enum(["ON_APPROVAL", "ON_DELIVERY", "ON_COMPLETION"]).optional().nullable(),
	status: z.nativeEnum(POTypeStatus),
	isDeleted: z.boolean().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type POType = z.infer<typeof POTypeSchema>;

// Create POType Schema
export const CreatePOTypeSchema = POTypeSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	organizationId: true,
	description: true,
	isDefault: true,
	requiresDelivery: true,
	requiresInspection: true,
	allowsPartialDelivery: true,
	autoCreateInvoice: true,
	invoiceTrigger: true,
	status: true,
});

export type CreatePOType = z.infer<typeof CreatePOTypeSchema>;

// Update POType Schema
export const UpdatePOTypeSchema = POTypeSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdatePOType = z.infer<typeof UpdatePOTypeSchema>;
