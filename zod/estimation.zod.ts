import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Enum definition matching Prisma
export enum EstimationStatus {
	DRAFT = "DRAFT",
	PENDING = "PENDING",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED",
	REVISED = "REVISED",
}

// Estimation Schema (full, including ID)
// Note: Computed financial values (estimatedCost, actualCost, marginAmount, etc.)
// are stored in metaData and not as separate fields
export const EstimationSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	estimationNumber: z.string().min(1, "Estimation number is required").max(100, "Estimation number too long"),
	name: z.string().min(1, "Name is required").max(255, "Name too long"),
	projectId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid project ID" }),
	// Financial Data (only source/input values)
	marginPercentage: z.number().min(0, "Margin must be at least 0%").max(100, "Margin cannot exceed 100%"), // 0-100%
	// Computed values stored in metaData (EstimationMetaData type)
	metaData: z.any().nullable().optional(),
	// Status
	status: z.nativeEnum(EstimationStatus),
	// Additional fields
	notes: z.string().max(5000, "Notes too long (max 5000 characters)").nullable().optional(),
	approvedBy: z.string().min(1).max(100).nullable().optional(),
	approvedAt: z.coerce.date().nullable().optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Estimation = z.infer<typeof EstimationSchema>;

// Create Estimation Schema (excluding ID, workspaceId, createdAt, updatedAt)
export const CreateEstimationSchema = EstimationSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	status: true,
	isDeleted: true,
	notes: true,
	approvedBy: true,
	approvedAt: true,
	estimationNumber: true,
	metaData: true,
});

export type CreateEstimation = z.infer<typeof CreateEstimationSchema>;

// Create Draft Estimation Schema (name and marginPercentage optional when copying from source)
export const CreateDraftEstimationSchema = EstimationSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	status: true,
	isDeleted: true,
	notes: true,
	approvedBy: true,
	approvedAt: true,
	estimationNumber: true,
	metaData: true,
	name: true,
	marginPercentage: true,
}).extend({
	sourceEstimationId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid source estimation ID" }).optional(),
	copyFromLatest: z.boolean().optional(),
});

export type CreateDraftEstimation = z.infer<typeof CreateDraftEstimationSchema>;

// Update Estimation Schema (partial, excluding immutable fields)
export const UpdateEstimationSchema = EstimationSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
	projectId: true,
	estimationNumber: true,
}).partial();

export type UpdateEstimation = z.infer<typeof UpdateEstimationSchema>;

// Approve Estimation Schema
export const ApproveEstimationSchema = z.object({
	approvedBy: z.string().min(1, "Approver is required").max(100, "Approver name too long"),
	notes: z.string().max(5000, "Notes too long (max 5000 characters)").optional(),
});

export type ApproveEstimation = z.infer<typeof ApproveEstimationSchema>;

// Reject Estimation Schema
export const RejectEstimationSchema = z.object({
	notes: z.string().min(1, "Rejection reason is required").max(5000, "Rejection reason too long (max 5000 characters)"),
});

export type RejectEstimation = z.infer<typeof RejectEstimationSchema>;
