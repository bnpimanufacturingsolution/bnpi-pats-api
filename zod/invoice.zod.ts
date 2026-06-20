import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definitions matching Prisma
export enum InvoiceStatus {
	DRAFT = "DRAFT",
	SENT = "SENT",
	PARTIAL = "PARTIAL",
	PAID = "PAID",
	OVERDUE = "OVERDUE",
	CANCELLED = "CANCELLED",
	DISPUTED = "DISPUTED",
}

export enum InvoiceType {
	PAYABLE = "PAYABLE",
	RECEIVABLE = "RECEIVABLE",
}

// InvoiceItem composite type schema
export const InvoiceItemSchema = z.object({
	itemId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid item ID format" }).optional().nullable(),
	description: z.string().min(1, "Description is required").max(500, "Description too long"),
	quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
	unitPrice: z.number().min(0, "Unit price cannot be negative"),
	totalPrice: z.number().min(0, "Total price cannot be negative"),
	taxable: z.boolean(),
	remarks: z.string().max(1000, "Remarks too long").optional().nullable(),
});

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

// InvoicePayment composite type schema
export const InvoicePaymentSchema = z.object({
	paymentId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid payment ID format" }).optional().nullable(),
	paymentDate: z.coerce.date(),
	amount: z.number().min(0, "Amount cannot be negative"),
	paymentMethod: z.string().max(50, "Payment method too long").optional().nullable(),
	referenceNumber: z.string().max(100, "Reference number too long").optional().nullable(),
	remarks: z.string().max(500, "Remarks too long").optional().nullable(),
});

export type InvoicePayment = z.infer<typeof InvoicePaymentSchema>;

// Invoice Schema (full, including ID)
export const InvoiceSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	organizationId: z.string().optional().nullable(),
	invoiceNumber: z.string().min(1, "Invoice number is required").max(100, "Invoice number too long"),
	invoiceType: z.nativeEnum(InvoiceType),
	purchaseOrderId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid purchase order ID format" }).optional().nullable(),
	deliveryOrderId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid delivery order ID format" }).optional().nullable(),
	vendorId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid vendor ID format" }).optional().nullable(),
	projectId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid project ID format" }).optional().nullable(),
	partyName: z.string().max(200, "Party name too long").optional().nullable(),
	partyAddress: z.string().max(500, "Party address too long").optional().nullable(),
	partyContact: z.string().max(50, "Party contact too long").optional().nullable(),
	partyEmail: z.string().email("Invalid email format").max(100, "Email too long").optional().nullable(),
	invoiceDate: z.coerce.date(),
	dueDate: z.coerce.date().optional().nullable(),
	paidDate: z.coerce.date().optional().nullable(),
	items: z.array(InvoiceItemSchema),
	subtotal: z.number().min(0, "Subtotal cannot be negative"),
	taxPercentage: z.number().min(0, "Tax percentage cannot be negative").max(100, "Tax percentage cannot exceed 100").optional().nullable(),
	taxAmount: z.number().min(0, "Tax amount cannot be negative"),
	discountAmount: z.number().min(0, "Discount amount cannot be negative"),
	totalAmount: z.number().min(0, "Total amount cannot be negative"),
	currency: z.string().max(10, "Currency code too long"),
	paidAmount: z.number().min(0, "Paid amount cannot be negative"),
	balanceDue: z.number().min(0, "Balance due cannot be negative"),
	paymentTerms: z.string().max(200, "Payment terms too long").optional().nullable(),
	paymentRecords: z.array(InvoicePaymentSchema).optional(),
	status: z.nativeEnum(InvoiceStatus),
	remarks: z.string().max(2000, "Remarks too long").optional().nullable(),
	documentUrls: z.array(z.string().url("Invalid document URL")).optional(),
	sentAt: z.coerce.date().optional().nullable(),
	acknowledgedAt: z.coerce.date().optional().nullable(),
	acknowledgedBy: z.string().max(100, "Acknowledged by name too long").optional().nullable(),
	isDeleted: z.boolean().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

// Create Invoice Schema
export const CreateInvoiceSchema = InvoiceSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	organizationId: true,
	invoiceType: true,
	purchaseOrderId: true,
	deliveryOrderId: true,
	vendorId: true,
	projectId: true,
	partyName: true,
	partyAddress: true,
	partyContact: true,
	partyEmail: true,
	invoiceDate: true,
	dueDate: true,
	paidDate: true,
	items: true,
	subtotal: true,
	taxPercentage: true,
	taxAmount: true,
	discountAmount: true,
	totalAmount: true,
	currency: true,
	paidAmount: true,
	balanceDue: true,
	paymentTerms: true,
	paymentRecords: true,
	status: true,
	remarks: true,
	documentUrls: true,
	sentAt: true,
	acknowledgedAt: true,
	acknowledgedBy: true,
});

export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;

// Update Invoice Schema
export const UpdateInvoiceSchema = InvoiceSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;
