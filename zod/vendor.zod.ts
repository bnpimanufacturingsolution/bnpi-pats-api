import { z } from "zod";
import { isValidObjectId } from "mongoose";

// Vendor Schema (full, including ID)
export const VendorSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	vendorId: z.string().min(1, "Vendor ID is required").max(50, "Vendor ID too long"), // e.g., "V001"
	name: z.string().min(1, "Vendor name is required").max(255, "Vendor name too long (max 255 characters)"),
	contactPerson: z.string().max(100, "Contact person name too long").optional(),
	contactDesignation: z.string().max(100, "Contact designation too long").optional(),
	contactDepartment: z.string().max(100, "Contact department too long").optional(),
	email: z.string().email("Invalid email format").max(255, "Email too long").optional(),
	phone: z.string().max(20, "Phone number too long").optional(),
	mobile: z.string().max(20, "Mobile number too long").optional(),
	address: z.string().max(500, "Address too long (max 500 characters)").optional(),
	notes: z.string().max(5000, "Notes too long (max 5000 characters)").optional(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Vendor = z.infer<typeof VendorSchema>;

// Create Vendor Schema (excluding ID, workspaceId, createdAt, updatedAt, and computed fields)
export const CreateVendorSchema = VendorSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	contactPerson: true,
	contactDesignation: true,
	contactDepartment: true,
	email: true,
	phone: true,
	mobile: true,
	address: true,
	notes: true,
	isDeleted: true,
});

export type CreateVendor = z.infer<typeof CreateVendorSchema>;

// Update Vendor Schema (partial, excluding immutable fields and relations)
export const UpdateVendorSchema = VendorSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateVendor = z.infer<typeof UpdateVendorSchema>;
