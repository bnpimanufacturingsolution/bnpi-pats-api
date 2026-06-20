import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definitions matching Prisma
export enum DeliveryOrderStatus {
	PENDING = "PENDING",
	IN_TRANSIT = "IN_TRANSIT",
	DELIVERED = "DELIVERED",
	PARTIAL = "PARTIAL",
	REJECTED = "REJECTED",
	CANCELLED = "CANCELLED",
}

export enum DeliveryItemCondition {
	GOOD = "GOOD",
	DAMAGED = "DAMAGED",
	DEFECTIVE = "DEFECTIVE",
	MISSING = "MISSING",
}

// DeliveryOrderItem composite type schema
export const DeliveryOrderItemSchema = z.object({
	itemId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid item ID format" }).optional().nullable(),
	poItemIndex: z.number().int().min(0).optional().nullable(),
	description: z.string().min(1, "Description is required").max(500, "Description too long"),
	orderedQuantity: z.number().int("Ordered quantity must be a whole number").min(0, "Ordered quantity cannot be negative"),
	deliveredQuantity: z.number().int("Delivered quantity must be a whole number").min(0, "Delivered quantity cannot be negative"),
	receivedQuantity: z.number().int("Received quantity must be a whole number").min(0, "Received quantity cannot be negative").optional().nullable(),
	condition: z.nativeEnum(DeliveryItemCondition),
	remarks: z.string().max(1000, "Remarks too long").optional().nullable(),
});

export type DeliveryOrderItem = z.infer<typeof DeliveryOrderItemSchema>;

// DeliveryOrder Schema (full, including ID)
export const DeliveryOrderSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	organizationId: z.string().optional().nullable(),
	doNumber: z.string().min(1, "DO number is required").max(100, "DO number too long"),
	purchaseOrderId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid purchase order ID format" }),
	vendorId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid vendor ID format" }),
	deliveryDate: z.coerce.date(),
	receivedDate: z.coerce.date().optional().nullable(),
	dispatchDate: z.coerce.date().optional().nullable(),
	deliveryAddress: z.string().max(500, "Delivery address too long").optional().nullable(),
	trackingNumber: z.string().max(100, "Tracking number too long").optional().nullable(),
	carrier: z.string().max(100, "Carrier name too long").optional().nullable(),
	receivedBy: z.string().max(100, "Received by name too long").optional().nullable(),
	receiverContact: z.string().max(50, "Receiver contact too long").optional().nullable(),
	receiverSignature: z.string().url("Invalid signature URL").optional().nullable(),
	items: z.array(DeliveryOrderItemSchema),
	inspectedBy: z.string().max(100, "Inspected by name too long").optional().nullable(),
	inspectionDate: z.coerce.date().optional().nullable(),
	inspectionNotes: z.string().max(2000, "Inspection notes too long").optional().nullable(),
	status: z.nativeEnum(DeliveryOrderStatus),
	remarks: z.string().max(2000, "Remarks too long").optional().nullable(),
	documentUrls: z.array(z.string().url("Invalid document URL")).optional(),
	isDeleted: z.boolean().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type DeliveryOrder = z.infer<typeof DeliveryOrderSchema>;

// Create DeliveryOrder Schema
export const CreateDeliveryOrderSchema = DeliveryOrderSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	organizationId: true,
	deliveryDate: true,
	receivedDate: true,
	dispatchDate: true,
	deliveryAddress: true,
	trackingNumber: true,
	carrier: true,
	receivedBy: true,
	receiverContact: true,
	receiverSignature: true,
	items: true,
	inspectedBy: true,
	inspectionDate: true,
	inspectionNotes: true,
	status: true,
	remarks: true,
	documentUrls: true,
});

export type CreateDeliveryOrder = z.infer<typeof CreateDeliveryOrderSchema>;

// Update DeliveryOrder Schema
export const UpdateDeliveryOrderSchema = DeliveryOrderSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateDeliveryOrder = z.infer<typeof UpdateDeliveryOrderSchema>;
