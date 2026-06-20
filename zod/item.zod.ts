import { z } from "zod";
import { isValidObjectId } from "mongoose";

// ItemType Enum
export const ItemTypeSchema = z.enum(["CAPEX", "OPEX", "MISC"]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

// ItemStatus Enum
export const ItemStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

// FieldValue composite type
export const FieldValueSchema = z.object({
	fieldId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid field ID" }),
	value: z.any(),
});
export type FieldValue = z.infer<typeof FieldValueSchema>;

// ItemFields composite type
export const ItemFieldsSchema = z.object({
	common: z.array(FieldValueSchema),
	custom: z.array(FieldValueSchema),
});
export type ItemFields = z.infer<typeof ItemFieldsSchema>;

// Item Schema (full, including ID)
export const ItemSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID format" }),
	estimationId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid estimation ID" }),
	type: ItemTypeSchema,
	// Project relationship (via Estimations) - implicit
	categoryId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid category ID" })
		.optional(),
	category: z.string().min(1).max(100, "Category too long").optional(), // Mainly for OPEX: "Human Resource", "Hardware", "Misc"
	milestoneId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid milestone ID" })
		.optional()
		.nullable(),
	itemName: z
		.string()
		.min(1, "Item name is required")
		.max(255, "Item name too long (max 255 characters)"), // "Laptop", "Van", "PM", "Monitor", etc.
	estimatedQuantity: z
		.number()
		.int("Quantity must be a whole number")
		.min(1, "Quantity must be at least 1")
		.max(1000000, "Quantity too large"),
	actualQuantity: z
		.number()
		.int("Actual quantity must be a whole number")
		.min(0, "Actual quantity must be non-negative")
		.max(1000000, "Actual quantity too large")
		.optional(),
	estimatedUnitPrice: z
		.number()
		.nonnegative("Unit price must be non-negative")
		.max(1000000000, "Unit price too large"),
	estimatedTotal: z
		.number()
		.nonnegative("Total must be non-negative")
		.max(1000000000, "Total too large"),
	actualUnitPrice: z
		.number()
		.nonnegative("Actual unit price must be non-negative")
		.max(1000000000, "Actual unit price too large")
		.optional(),
	actualTotal: z
		.number()
		.nonnegative("Actual total must be non-negative")
		.max(1000000000, "Actual total too large")
		.optional(),
	documentUrls: z.array(z.string().url("Invalid document URL")).default([]),
	fields: ItemFieldsSchema.optional(),
	orderId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid order ID" })
		.optional(),
	purchaseOrderId: z
		.string()
		.refine((val) => isValidObjectId(val), { message: "Invalid purchase order ID" })
		.optional()
		.nullable(),
	status: ItemStatusSchema,
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	estimationPoints: z
		.number()
		.int("Estimation points must be a whole number")
		.positive("Estimation points must be positive")
		.refine((val) => [1, 2, 3, 5, 8, 13, 21, 34, 55, 89].includes(val), {
			message:
				"Estimation points should be a Fibonacci number (1, 2, 3, 5, 8, 13, 21, 34, 55, 89)",
		})
		.optional(),
	isNewAddition: z.boolean(),
	isDeleted: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Item = z.infer<typeof ItemSchema>;

// Create Item Schema (excluding ID, workspaceId, createdAt, updatedAt, and computed fields)
export const CreateItemSchema = ItemSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	orderId: true,
	purchaseOrderId: true,
	isDeleted: true,
	isNewAddition: true,
	actualQuantity: true,
	actualUnitPrice: true,
	actualTotal: true,
	category: true,
	milestoneId: true,
	estimatedTotal: true, // Optional - will be calculated by background worker
	documentUrls: true,
	status: true, // Optional - defaults to PENDING
	startDate: true,
	endDate: true,
	estimationPoints: true, // Optional - Fibonacci complexity estimate
});

export type CreateItem = z.infer<typeof CreateItemSchema>;

// Update Item Schema (partial, excluding immutable fields and relations)
export const UpdateItemSchema = ItemSchema.omit({
	id: true,
	workspaceId: true,
	createdAt: true,
	updatedAt: true,
}).partial();

export type UpdateItem = z.infer<typeof UpdateItemSchema>;
