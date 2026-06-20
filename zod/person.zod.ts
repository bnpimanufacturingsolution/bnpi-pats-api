import { z } from "zod";
import { isValidObjectId } from "mongoose";

import type { User } from "./user.zod";


// GenderType Enum
export const GenderType = z.enum(["male", "female", "other", "prefer_not_to_say", "unknown", "not_applicable"]);

export type GenderType = z.infer<typeof GenderType>;

// PhoneType Enum
export const PhoneType = z.enum(["mobile", "home", "work", "emergency", "fax", "pager", "main", "other"]);

export type PhoneType = z.infer<typeof PhoneType>;

// IdentificationType Enum
export const IdentificationType = z.enum(["passport", "drivers_license", "national_id", "postal_id", "voters_id", "senior_citizen_id", "company_id", "school_id"]);

export type IdentificationType = z.infer<typeof IdentificationType>;

// PersonalInfo Schema
export const PersonalInfoSchema = z.object({
	prefix: z.string().max(20, "Prefix too long").optional(),
	firstName: z.string().min(1, "First name is required").max(100, "First name too long (max 100 characters)"),
	middleName: z.string().max(100, "Middle name too long (max 100 characters)").optional(),
	lastName: z.string().min(1, "Last name is required").max(100, "Last name too long (max 100 characters)"),
	dateOfBirth: z.coerce.date().optional(),
	placeOfBirth: z.string().max(200, "Place of birth too long").optional(),
	age: z.number().int("Age must be a whole number").min(0, "Age must be non-negative").max(150, "Invalid age").optional(),
	nationality: z.string().max(100, "Nationality too long").optional(),
	primaryLanguage: z.string().max(50, "Language too long").optional(),
	gender: z.enum(["male", "female", "other", "prefer_not_to_say", "unknown", "not_applicable"]).optional(),
	currency: z.string().max(10, "Currency code too long").optional(),
	vipCode: z.string().max(50, "VIP code too long").optional(),
});

export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;

// Phone Schema
export const PhoneSchema = z.object({
	type: z.enum(["mobile", "home", "work", "emergency", "fax", "pager", "main", "other"]).optional(),
	countryCode: z.string().max(5, "Country code too long").optional(),
	number: z.string().min(1).max(20, "Phone number too long").optional(),
	isPrimary: z.boolean().optional(),
});

export type Phone = z.infer<typeof PhoneSchema>;

// ContactAddress Schema
export const ContactAddressSchema = z.object({
	street: z.string().max(200, "Street too long").optional(),
	address2: z.string().max(200, "Address line 2 too long").optional(),
	city: z.string().max(100, "City too long").optional(),
	state: z.string().max(100, "State too long").optional(),
	country: z.string().max(100, "Country too long").optional(),
	postalCode: z.string().max(20, "Postal code too long").optional(),
	zipCode: z.string().max(20, "Zip code too long").optional(),
	houseNumber: z.string().max(50, "House number too long").optional(),
});

export type ContactAddress = z.infer<typeof ContactAddressSchema>;

// ContactInfo Schema
export const ContactInfoSchema = z.object({
	email: z.string().email("Invalid email format").max(255, "Email too long").optional(),
	phones: z.array(PhoneSchema).max(10, "Too many phone numbers (max 10)"),
	fax: z.string().max(20, "Fax number too long").optional(),
	address: z.array(ContactAddressSchema).max(5, "Too many addresses (max 5)"),
});

export type ContactInfo = z.infer<typeof ContactInfoSchema>;

// Identification Schema
export const IdentificationSchema = z.object({
	type: z.enum(["passport", "drivers_license", "national_id", "postal_id", "voters_id", "senior_citizen_id", "company_id", "school_id"]).optional(),
	number: z.string().max(100, "ID number too long").optional(),
	issuingCountry: z.string().max(100, "Country too long").optional(),
	expiryDate: z.coerce.date().optional(),
});

export type Identification = z.infer<typeof IdentificationSchema>;

// Metadata Schema
export const MetadataSchema = z.object({
	isActive: z.boolean(),
	status: z.string().max(50, "Status too long").optional(),
	createdBy: z.string().refine((val) => isValidObjectId(val), { message: "Invalid creator ID" }).optional(),
	updatedBy: z.string().refine((val) => isValidObjectId(val), { message: "Invalid updater ID" }).optional(),
	lastLoginAt: z.coerce.date().optional(),
	isDeleted: z.boolean(),
});

export type Metadata = z.infer<typeof MetadataSchema>;

// Person Schema (full, including ID)
export const PersonSchema = z.object({
	id: z.string().refine((val) => isValidObjectId(val), { message: "Invalid ID format" }),
	workspaceId: z.string().refine((val) => isValidObjectId(val), { message: "Invalid workspace ID" }).optional(),
	personalInfo: PersonalInfoSchema.optional(),
	contactInfo: ContactInfoSchema,
	identification: IdentificationSchema.optional(),
	metadata: MetadataSchema.optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	isDeleted: z.boolean(),
});

export type Person = z.infer<typeof PersonSchema>;

// Create Person Schema (excluding ID, createdAt, updatedAt, and computed fields)
export const CreatePersonSchema = PersonSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
}).partial({
	workspaceId: true,
	personalInfo: true,
	identification: true,
	metadata: true,
	isDeleted: true,
});

export type CreatePerson = z.infer<typeof CreatePersonSchema>;

// Update Person Schema (partial, excluding immutable fields and relations)
export const UpdatePersonSchema = PersonSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
}).partial();

export type UpdatePerson = z.infer<typeof UpdatePersonSchema>;

export type PersonWithRelations = Person & {
	users: User[];
};
