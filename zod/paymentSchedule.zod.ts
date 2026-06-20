import { z } from "zod";
import { isValidObjectId } from "mongoose";

// ============================================
// PAYMENT SCHEDULE SCHEMAS
// ============================================

// Payment Schedule Status
export const PaymentScheduleStatusSchema = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]);

// Payment Schedule Item Status (stored as String in MongoDB composite type)
export const PaymentScheduleItemStatusSchema = z.enum([
	"UPCOMING",
	"DUE",
	"PARTIAL",
	"PAID",
	"OVERDUE",
	"CANCELLED",
]);

// PaymentScheduleItem composite schema
export const PaymentScheduleItemSchema = z.object({
	sequence: z.number().int("Sequence must be a whole number").min(1, "Sequence must be at least 1"),
	description: z.string().min(1, "Description is required").max(200, "Description too long"),
	percentage: z.number().min(0, "Percentage cannot be negative").max(100, "Percentage cannot exceed 100"),
	amount: z.number().min(0, "Amount cannot be negative"),
	dueDate: z.coerce.date(),
	status: z.string().min(1, "Status is required"), // String for MongoDB composite compatibility
	paidAmount: z.number().min(0, "Paid amount cannot be negative").default(0),
	balance: z.number().min(0, "Balance cannot be negative"),
	transactionIds: z.array(z.string()).default([]),
});

export type PaymentScheduleItem = z.infer<typeof PaymentScheduleItemSchema>;

// Full PaymentSchedule Schema (including ID)
export const PaymentScheduleSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	organizationId: z.string().optional().nullable(),
	purchaseOrderId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid purchase order ID format" }),
	paymentTermId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid payment term ID format" })
		.optional()
		.nullable(),
	items: z.array(PaymentScheduleItemSchema),
	totalScheduled: z.number().min(0, "Total scheduled cannot be negative"),
	totalPaid: z.number().min(0, "Total paid cannot be negative").default(0),
	balance: z.number().min(0, "Balance cannot be negative"),
	status: PaymentScheduleStatusSchema,
	isDeleted: z.boolean().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type PaymentSchedule = z.infer<typeof PaymentScheduleSchema>;

// Create PaymentSchedule Schema
export const CreatePaymentScheduleSchema = PaymentScheduleSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	organizationId: true,
	paymentTermId: true,
	totalPaid: true,
	status: true,
});

export type CreatePaymentSchedule = z.infer<typeof CreatePaymentScheduleSchema>;

// Update PaymentSchedule Schema
export const UpdatePaymentScheduleSchema = PaymentScheduleSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdatePaymentSchedule = z.infer<typeof UpdatePaymentScheduleSchema>;

// Release Payment Request Schema (for POST /:id/release)
export const ReleasePaymentSchema = z.object({
	itemIndex: z.number().int("Item index must be a whole number").min(0, "Item index cannot be negative"),
	amount: z.number().positive("Amount must be positive"),
	paymentMethod: z.enum(["CHECK", "CASH", "BANK_TRANSFER", "ONLINE", "OTHER"]).optional(),
	payeeName: z.string().min(1, "Payee name is required").max(255, "Payee name too long").optional(),
	checkDetails: z
		.object({
			bankName: z.string().min(1),
			accountNumber: z.string().min(1),
			checkNumber: z.string().min(1),
			bouncedDate: z.coerce.date().optional().nullable(),
			bouncedReason: z.string().optional().nullable(),
		})
		.optional()
		.nullable(),
	cashDetails: z
		.object({
			receivedBy: z.string().optional().nullable(),
			notes: z.string().optional().nullable(),
		})
		.optional()
		.nullable(),
	bankTransferDetails: z
		.object({
			bankName: z.string().min(1),
			accountNumber: z.string().min(1),
			referenceNumber: z.string().min(1),
			transferType: z.string().optional().nullable(),
		})
		.optional()
		.nullable(),
	onlineDetails: z
		.object({
			referenceNumber: z.string().min(1),
			platform: z.string().optional().nullable(),
			gatewayName: z.string().optional().nullable(),
		})
		.optional()
		.nullable(),
	documentUrls: z.array(z.string()).optional(),
});

export type ReleasePayment = z.infer<typeof ReleasePaymentSchema>;
