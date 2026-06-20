import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Full UsageCode Schema
export const UsageCodeSchema = z.object({
  id: z.string().refine((val) => isValidObjectId(val), {
    message: "Invalid ObjectId format",
  }),
  workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
  name: z.string().min(1, "Name is required").max(120, "Name must not exceed 120 characters"),
  code: z.string().min(1, "Code is required").max(50, "Code must not exceed 50 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  isDeleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Create UsageCode Schema (excludes id, workspaceId, createdAt, updatedAt)
export const CreateUsageCodeSchema = UsageCodeSchema.omit({
  id: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  description: true,
  isDeleted: true,
});

// Update UsageCode Schema (all fields optional except timestamps and id)
export const UpdateUsageCodeSchema = UsageCodeSchema.omit({
  id: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

// Type exports
export type UsageCode = z.infer<typeof UsageCodeSchema>;
export type CreateUsageCode = z.infer<typeof CreateUsageCodeSchema>;
export type UpdateUsageCode = z.infer<typeof UpdateUsageCodeSchema>;
