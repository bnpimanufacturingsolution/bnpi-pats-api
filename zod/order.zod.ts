import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definitions matching Prisma
export enum ItemCondition {
	GOOD = "GOOD",
	DAMAGED = "DAMAGED",
	LICENSE = "LICENSE",
	NA = "NA",
}

export enum OrderStatus {
	PENDING = "PENDING",
	RECEIVED = "RECEIVED",
	CANCELLED = "CANCELLED",
	PARTIAL = "PARTIAL",
}

// Order Schema (full, including ID)
export const OrderSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	orderNumber: z.string().min(1, "Order number is required").max(100, "Order number too long"), // e.g., "OR-001"
	estimationId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid estimation ID" }),
	vendorId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid vendor ID" }).optional(),
	itemName: z.string().min(1, "Item name is required").max(255, "Item name too long (max 255 characters)"),
	quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(1000000, "Quantity too large"),
	deliveryDate: z.coerce.date().optional(),
	receivedBy: z.string().max(100, "Received by name too long").optional(),
	condition: z.nativeEnum(ItemCondition),
	hasWarranty: z.boolean(),
	warrantyDetails: z.string().max(2000, "Warranty details too long (max 2000 characters)").optional(),
	status: z.nativeEnum(OrderStatus),
	remarks: z.string().max(5000, "Remarks too long (max 5000 characters)").optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Order = z.infer<typeof OrderSchema>;

// Create Order Schema (excluding ID, workspaceId, createdAt, updatedAt, and computed fields)
export const CreateOrderSchema = OrderSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	vendorId: true,
	deliveryDate: true,
	receivedBy: true,
	condition: true,
	hasWarranty: true,
	warrantyDetails: true,
	status: true,
	remarks: true,
});

export type CreateOrder = z.infer<typeof CreateOrderSchema>;

// Update Order Schema (partial, excluding immutable fields and relations)
export const UpdateOrderSchema = OrderSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateOrder = z.infer<typeof UpdateOrderSchema>;
