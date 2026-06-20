import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definitions matching Prisma (simplified)
export enum PurchaseOrderStatus {
	DRAFT = "DRAFT",
	APPROVED = "APPROVED",
	COMPLETED = "COMPLETED",
	CANCELLED = "CANCELLED",
}

// PurchaseOrderItem composite type schema (additional line item details)
export const PurchaseOrderItemSchema = z.object({
	itemCode: z.string().max(100, "Item code too long").optional().nullable(),
	description: z.string().min(1, "Description is required").max(500, "Description too long"),
	quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
	unit: z.string().max(50, "Unit too long").optional().nullable(),
	unitPrice: z.number().min(0, "Unit price cannot be negative"),
	totalPrice: z.number().min(0, "Total price cannot be negative"),
	remarks: z.string().max(1000, "Remarks too long").optional().nullable(),
});

export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema>;

// PurchaseOrder Schema (full, including ID)
export const PurchaseOrderSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	organizationId: z.string().optional().nullable(),
	poNumber: z.string().min(1, "PO number is required").max(100, "PO number too long"),
	vendorId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid vendor ID format" }),
	estimationId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid estimation ID format" }).optional().nullable(),
	projectId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid project ID format" }).optional().nullable(),
	poTypeId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid PO type ID format" }).optional().nullable(),
	orderDate: z.coerce.date(),
	expectedDeliveryDate: z.coerce.date().optional().nullable(),
	approvalDate: z.coerce.date().optional().nullable(),
	requestedBy: z.string().max(100, "Requested by name too long").optional().nullable(),
	requestedByTitle: z.string().max(100, "Requested by title too long").optional().nullable(),
	requestedByDepartment: z.string().max(100, "Requested by department too long").optional().nullable(),
	checkedBy: z.string().max(100, "Checked by name too long").optional().nullable(),
	checkedByTitle: z.string().max(100, "Checked by title too long").optional().nullable(),
	approvedBy: z.string().max(100, "Approved by name too long").optional().nullable(),
	approvedByTitle: z.string().max(100, "Approved by title too long").optional().nullable(),
	acknowledgedBy: z.string().max(100, "Acknowledged by name too long").optional().nullable(),
	items: z.array(PurchaseOrderItemSchema),
	subtotal: z.number().min(0, "Subtotal cannot be negative"),
	taxPercentage: z.number().min(0, "Tax percentage cannot be negative").max(100, "Tax percentage cannot exceed 100").optional().nullable(),
	taxAmount: z.number().min(0, "Tax amount cannot be negative"),
	discountAmount: z.number().min(0, "Discount amount cannot be negative"),
	totalAmount: z.number().min(0, "Total amount cannot be negative"),
	currency: z.string().max(10, "Currency code too long"),
	paymentTermId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid payment term ID format" }).optional().nullable(),
	shippingTerms: z.string().max(200, "Shipping terms too long").optional().nullable(),
	leadTime: z.string().max(200, "Lead time too long").optional().nullable(),
	availability: z.string().max(200, "Availability too long").optional().nullable(),
	deliveryTerms: z.string().max(200, "Delivery terms too long").optional().nullable(),
	deliveryAddress: z.string().max(500, "Delivery address too long").optional().nullable(),
	termsConditions: z.string().max(5000, "Terms and conditions too long").optional().nullable(),
	status: z.nativeEnum(PurchaseOrderStatus),
	remarks: z.string().max(2000, "Remarks too long").optional().nullable(),
	documentUrls: z.array(z.string().url("Invalid document URL")).optional(),
	isDeleted: z.boolean().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

// Create PurchaseOrder Schema
export const CreatePurchaseOrderSchema = PurchaseOrderSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	organizationId: true,
	estimationId: true,
	projectId: true,
	poTypeId: true,
	orderDate: true,
	expectedDeliveryDate: true,
	approvalDate: true,
	requestedBy: true,
	requestedByTitle: true,
	requestedByDepartment: true,
	checkedBy: true,
	checkedByTitle: true,
	approvedBy: true,
	approvedByTitle: true,
	items: true,
	subtotal: true,
	taxPercentage: true,
	taxAmount: true,
	discountAmount: true,
	totalAmount: true,
	currency: true,
	paymentTermId: true,
	shippingTerms: true,
	leadTime: true,
	availability: true,
	deliveryTerms: true,
	deliveryAddress: true,
	termsConditions: true,
	status: true,
	remarks: true,
	documentUrls: true,
});

export type CreatePurchaseOrder = z.infer<typeof CreatePurchaseOrderSchema>;

// Update PurchaseOrder Schema
export const UpdatePurchaseOrderSchema = PurchaseOrderSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdatePurchaseOrder = z.infer<typeof UpdatePurchaseOrderSchema>;
