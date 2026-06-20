import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Workspace Status enum matching Prisma
export const WorkspaceStatusEnum = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

// Workspace Schema (full, including ID)
export const WorkspaceSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	organizationId: z.string().max(255, "Company ID too long (max 255 characters)").optional().nullable(),
	name: z.string().min(1, "Workspace name is required").max(255, "Workspace name too long (max 255 characters)"),
	code: z.string().min(1, "Workspace code is required").max(50, "Workspace code too long (max 50 characters)"),
	description: z.string().max(1000, "Description too long (max 1000 characters)").optional(),
	address: z.string().max(500, "Address too long").optional().nullable(),
	phone: z.string().max(20, "Phone number too long").optional().nullable(),
	email: z.string().email("Invalid email format").max(255, "Email too long").optional().nullable(),
	logoUrl: z.string().max(500, "Logo URL too long").optional().nullable(),
	status: WorkspaceStatusEnum,
	isPinned: z.boolean(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

// Create Workspace Schema (excluding ID, createdAt, updatedAt)
export const CreateWorkspaceSchema = WorkspaceSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	organizationId: true,
	description: true,
	address: true,
	phone: true,
	email: true,
	logoUrl: true,
	status: true,
	isPinned: true,
	isDeleted: true,
});

export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;

// Update Workspace Schema (partial, excluding immutable fields)
export const UpdateWorkspaceSchema = WorkspaceSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateWorkspace = z.infer<typeof UpdateWorkspaceSchema>;
