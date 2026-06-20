import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Payslip Schema (full, including ID)
export const PayslipSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	payslipNumber: z.string().min(1, "Payslip number is required").max(100, "Payslip number too long"), // e.g., "PS-001"
	estimationId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid estimation ID" }),
	name: z.string().min(1, "Name is required").max(255, "Name too long (max 255 characters)"),
	amount: z.number().nonnegative("Amount must be non-negative").max(1000000000, "Amount too large"),
	paymentDate: z.coerce.date().optional(),
	notes: z.string().max(5000, "Notes too long (max 5000 characters)").optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Payslip = z.infer<typeof PayslipSchema>;

// Create Payslip Schema (excluding ID, workspaceId, createdAt, updatedAt, and computed fields)
export const CreatePayslipSchema = PayslipSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	paymentDate: true,
	notes: true,
});

export type CreatePayslip = z.infer<typeof CreatePayslipSchema>;

// Update Payslip Schema (partial, excluding immutable fields and relations)
export const UpdatePayslipSchema = PayslipSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdatePayslip = z.infer<typeof UpdatePayslipSchema>;
