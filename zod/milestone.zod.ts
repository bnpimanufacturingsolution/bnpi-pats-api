import { z } from "zod";
import { isValidObjectId } from "mongoose";

// MilestoneStatus Enum
export const MilestoneStatusSchema = z.enum([
	"NOT_STARTED",
	"IN_PROGRESS",
	"COMPLETED",
	"CANCELLED",
	"ON_HOLD",
]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

// MilestonePriority Enum
export const MilestonePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type MilestonePriority = z.infer<typeof MilestonePrioritySchema>;

// MilestonePhase Enum
export const MilestonePhaseSchema = z.enum([
	"FOUNDATION",
	"CORE_MODULES",
	"ADVANCED_FEATURES",
	"ENHANCED_FEATURES",
	"INTEGRATION_OPTIMIZATION",
	"ENTERPRISE_FEATURES",
]);
export type MilestonePhase = z.infer<typeof MilestonePhaseSchema>;

// Milestone Schema (full, including ID)
export const MilestoneSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	title: z.string().min(1, "Title is required").max(255, "Title too long (max 255 characters)"),
	description: z.string().optional(),
	phase: MilestonePhaseSchema,
	status: MilestoneStatusSchema,
	priority: MilestonePrioritySchema,
	progressPercent: z.number().min(0).max(100).default(0),
	startDate: z.coerce.date().optional(),
	targetDate: z.coerce.date().optional(),
	completedDate: z.coerce.date().optional(),
	assignedTo: z.array(z.string()).default([]),
	projectId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid project ID format" })
		.optional(),
	estimationId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid estimation ID format" })
		.optional(),
	tags: z.array(z.string()).default([]),
	dependencies: z.array(z.string()).default([]),
	blockers: z.array(z.string()).default([]),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

// Create Milestone Schema (excluding ID, workspaceId, createdAt, updatedAt)
export const CreateMilestoneSchema = MilestoneSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	isDeleted: true,
	description: true,
	progressPercent: true,
	startDate: true,
	targetDate: true,
	completedDate: true,
	assignedTo: true,
	projectId: true,
	estimationId: true,
	tags: true,
	dependencies: true,
	blockers: true,
	status: true,
	priority: true,
});

export type CreateMilestone = z.infer<typeof CreateMilestoneSchema>;

// Update Milestone Schema (partial, excluding immutable fields)
export const UpdateMilestoneSchema = MilestoneSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateMilestone = z.infer<typeof UpdateMilestoneSchema>;
