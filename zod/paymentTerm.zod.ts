import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definitions matching Prisma
export enum PaymentTermStatus {
	ACTIVE = "ACTIVE",
	INACTIVE = "INACTIVE",
}

// PaymentTermInstallment Schema (for defining payment schedule structure)
export const PaymentTermInstallmentSchema = z.object({
	sequence: z.number().int("Sequence must be a whole number").min(1, "Sequence must be at least 1"),
	percentage: z.number().min(0, "Percentage cannot be negative").max(100, "Percentage cannot exceed 100"),
	dueDaysFromApproval: z.number().int("Due days must be a whole number").min(0, "Due days cannot be negative"),
	description: z.string().min(1, "Description is required").max(200, "Description too long"),
});

export type PaymentTermInstallment = z.infer<typeof PaymentTermInstallmentSchema>;

// PaymentTerm Schema (full, including ID)
export const PaymentTermSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	organizationId: z.string().optional().nullable(),
	projectId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid project ID format" }).optional().nullable(),
	estimationId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid estimation ID format" }).optional().nullable(),
	code: z.string().min(1, "Code is required").max(20, "Code too long"),
	name: z.string().min(1, "Name is required").max(100, "Name too long"),
	description: z.string().max(500, "Description too long").optional().nullable(),
	dueDays: z.number().int("Due days must be a whole number").min(0, "Due days cannot be negative"),
	discountDays: z.number().int("Discount days must be a whole number").min(0, "Discount days cannot be negative").optional().nullable(),
	discountRate: z.number().min(0, "Discount rate cannot be negative").max(100, "Discount rate cannot exceed 100").optional().nullable(),
	lateFeeRate: z.number().min(0, "Late fee rate cannot be negative").optional().nullable(),
	lateFeeType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
	lateFeeGraceDays: z.number().int("Grace days must be a whole number").min(0, "Grace days cannot be negative").optional().nullable(),
	isDefault: z.boolean(),
	requiresDeposit: z.boolean(),
	depositPercentage: z.number().min(0, "Deposit percentage cannot be negative").max(100, "Deposit percentage cannot exceed 100").optional().nullable(),
	notes: z.string().max(1000, "Notes too long").optional().nullable(),
	installments: z.array(PaymentTermInstallmentSchema).optional().default([]),
	status: z.nativeEnum(PaymentTermStatus),
	isDeleted: z.boolean().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type PaymentTerm = z.infer<typeof PaymentTermSchema>;

// Create PaymentTerm Schema
export const CreatePaymentTermSchema = PaymentTermSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	organizationId: true,
	projectId: true,
	estimationId: true,
	description: true,
	dueDays: true,
	discountDays: true,
	discountRate: true,
	lateFeeRate: true,
	lateFeeType: true,
	lateFeeGraceDays: true,
	isDefault: true,
	requiresDeposit: true,
	depositPercentage: true,
	notes: true,
	installments: true,
	status: true,
});

export type CreatePaymentTerm = z.infer<typeof CreatePaymentTermSchema>;

// Update PaymentTerm Schema
export const UpdatePaymentTermSchema = PaymentTermSchema.omit({
	id: true,
	workspaceId: true,
	isDeleted: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdatePaymentTerm = z.infer<typeof UpdatePaymentTermSchema>;
