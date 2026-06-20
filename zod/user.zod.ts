import { z } from "zod";
import { isValidObjectId } from "mongoose";

import type { Person } from "./person.zod";


// Status Enum
export const Status = z.enum(["active", "inactive", "suspended", "archived"]);

export type Status = z.infer<typeof Status>;

// User Schema (full, including ID)
export const UserSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	personId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid person ID" }),
	avatar: z.string().max(500, "Avatar URL too long").optional(),
	userName: z.string().min(3, "Username must be at least 3 characters").max(50, "Username too long (max 50 characters)").optional(),
	email: z.string().min(1, "Email is required").max(255, "Email too long").email("Invalid email format"),
	password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long").optional(),
	status: z.enum(["active", "inactive", "suspended", "archived"]),
	isDeleted: z.boolean(),
	lastLogin: z.coerce.date().optional(),
	loginMethod: z.string().min(1, "Login method is required").max(50, "Login method too long"),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

// Create User Schema (excluding ID, createdAt, updatedAt, and computed fields)
export const CreateUserSchema = UserSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	avatar: true,
	userName: true,
	password: true,
	isDeleted: true,
	lastLogin: true,
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

// Update User Schema (partial, excluding immutable fields and relations)
export const UpdateUserSchema = UserSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
}).partial();

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export type UserWithRelations = User & {
	person: Person;
};
