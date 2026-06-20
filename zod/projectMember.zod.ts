import { z } from "zod";
import { isValidObjectId } from "mongoose";

export const ProjectRoleEnum = z.enum(["ADMIN", "EDITOR", "VIEWER"]);

export const ProjectMemberSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	projectId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid project ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	userId: z.string().min(1, "User ID is required"),
	role: ProjectRoleEnum,
	displayName: z.string().max(255).optional().nullable(),
	email: z.string().email("Invalid email format").max(255).optional().nullable(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

export const AddProjectMemberSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	projectId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid project ID format" }),
	role: ProjectRoleEnum.default("VIEWER"),
	displayName: z.string().max(255).optional(),
	email: z.string().email("Invalid email format").max(255).optional(),
});

export type AddProjectMember = z.infer<typeof AddProjectMemberSchema>;

export const UpdateProjectMemberRoleSchema = z.object({
	role: ProjectRoleEnum,
});

export type UpdateProjectMemberRole = z.infer<typeof UpdateProjectMemberRoleSchema>;
