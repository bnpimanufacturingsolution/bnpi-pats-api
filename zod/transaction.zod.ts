import { z } from "zod";
import { isValidObjectId } from "mongoose";

// ============================================
// TRANSACTION SCHEMAS
// ============================================

// Transaction Status Enum
export const TransactionStatusSchema = z.enum([
	"PENDING",
	"CLEARED",
	"BOUNCED",
	"CANCELLED",
	"VOIDED",
]);

// Transaction Type Enum
export const TransactionTypeSchema = z.enum([
	"INCOMING", // Money coming into the project
	"OUTGOING", // Money going out of the project
]);

// Payment Method Enum
export const PaymentMethodSchema = z.enum([
	"CHECK", // Traditional bank check
	"CASH", // Cash payment
	"BANK_TRANSFER", // Bank transfer/wire
	"ONLINE", // Online payment
	"OTHER", // Other payment methods
]);

// Payment-specific details schemas (discriminator pattern)
export const CheckPaymentDetailsSchema = z.object({
	bankName: z.string().min(1, "Bank name is required for check payments"),
	accountNumber: z.string().min(1, "Account number is required for check payments"),
	checkNumber: z.string().min(1, "Check number is required for check payments"),
	bouncedDate: z.coerce.date().optional().nullable(),
	bouncedReason: z.string().max(1000, "Bounced reason too long").optional().nullable(),
});

export const CashPaymentDetailsSchema = z.object({
	receivedBy: z.string().max(255, "Received by too long").optional().nullable(),
	notes: z.string().max(1000, "Notes too long").optional().nullable(),
});

export const BankTransferPaymentDetailsSchema = z.object({
	bankName: z.string().min(1, "Bank name is required for bank transfers"),
	accountNumber: z.string().min(1, "Account number is required for bank transfers"),
	referenceNumber: z.string().min(1, "Reference number is required for bank transfers"),
	transferType: z.string().max(50, "Transfer type too long").optional().nullable(),
});

export const OnlinePaymentDetailsSchema = z.object({
	referenceNumber: z.string().min(1, "Reference number is required for online payments"),
	platform: z.string().max(100, "Platform name too long").optional().nullable(),
	gatewayName: z.string().max(100, "Gateway name too long").optional().nullable(),
});

export type CheckPaymentDetails = z.infer<typeof CheckPaymentDetailsSchema>;
export type CashPaymentDetails = z.infer<typeof CashPaymentDetailsSchema>;
export type BankTransferPaymentDetails = z.infer<typeof BankTransferPaymentDetailsSchema>;
export type OnlinePaymentDetails = z.infer<typeof OnlinePaymentDetailsSchema>;

// Transaction Schema (full, including ID)
export const TransactionSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	transactionNumber: z
		.string()
		.min(1, "Transaction number is required")
		.max(100, "Transaction number too long (max 100 characters)"),
	transactionDate: z.coerce.date(),
	projectId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid project ID" }),
	itemId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid item ID" })
		.optional()
		.nullable(),
	purchaseOrderId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid purchase order ID" })
		.optional()
		.nullable(),
	usageCodeId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid usage code ID" })
		.optional()
		.nullable(),
	paymentScheduleId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid payment schedule ID" })
		.optional()
		.nullable(),
	paymentScheduleItemIndex: z.number().int("Item index must be a whole number").min(0, "Item index cannot be negative").optional().nullable(),
	transactionType: TransactionTypeSchema,
	paymentMethod: PaymentMethodSchema.default("CHECK"),
	payeeName: z
		.string()
		.min(1, "Payee name is required")
		.max(255, "Payee name too long (max 255 characters)"),
	amount: z.number().positive("Amount must be positive").max(1000000000, "Amount too large"),
	// Payment-specific details (discriminated union pattern)
	checkDetails: CheckPaymentDetailsSchema.optional().nullable(),
	cashDetails: CashPaymentDetailsSchema.optional().nullable(),
	bankTransferDetails: BankTransferPaymentDetailsSchema.optional().nullable(),
	onlineDetails: OnlinePaymentDetailsSchema.optional().nullable(),
	status: TransactionStatusSchema,
	clearedDate: z.coerce.date().optional().nullable(),
	documentUrls: z.array(z.string().url("Invalid URL format")).optional().default([]),
	isDeleted: z.boolean().default(false),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// Create Transaction Schema (excluding ID, workspaceId, createdAt, updatedAt, and computed fields)
export const CreateTransactionSchema = TransactionSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
})
	.partial({
		transactionNumber: true,
		itemId: true,
		usageCodeId: true,
		paymentScheduleId: true,
		paymentScheduleItemIndex: true,
		checkDetails: true,
		cashDetails: true,
		bankTransferDetails: true,
		onlineDetails: true,
		status: true,
		transactionType: true,
		paymentMethod: true,
		clearedDate: true,
		documentUrls: true,
		isDeleted: true,
	});

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;

// Update Transaction Schema (partial, excluding immutable fields)
export const UpdateTransactionSchema = TransactionSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;
