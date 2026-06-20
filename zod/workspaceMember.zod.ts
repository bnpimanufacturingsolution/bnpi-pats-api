import { z } from "zod";
import { isValidObjectId } from "mongoose";

export const WorkspaceRoleEnum = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

export const WorkspaceMemberSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	userId: z.string().min(1, "User ID is required"),
	role: WorkspaceRoleEnum,
	displayName: z.string().max(255).optional().nullable(),
	email: z.string().email("Invalid email format").max(255).optional().nullable(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const AddWorkspaceMemberSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	role: WorkspaceRoleEnum.default("MEMBER"),
	displayName: z.string().max(255).optional(),
	email: z.string().email("Invalid email format").max(255).optional(),
});

export type AddWorkspaceMember = z.infer<typeof AddWorkspaceMemberSchema>;

export const UpdateWorkspaceMemberRoleSchema = z.object({
	role: WorkspaceRoleEnum,
});

export type UpdateWorkspaceMemberRole = z.infer<typeof UpdateWorkspaceMemberRoleSchema>;
