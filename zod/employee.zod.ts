import { z } from "zod";

// Enums
export const SyncStatusEnum = z.enum([
  "SYNCED",
  "PENDING",
  "FAILED",
  "LOCAL_ONLY",
]);

export const EmploymentStatusEnum = z.enum([
  "ACTIVE",
  "INACTIVE",
  "ON_LEAVE",
  "TERMINATED",
  "SUSPENDED",
]);

export const EmploymentTypeEnum = z.enum([
  "PROBATIONARY",
  "REGULAR",
  "CONTRACTUAL",
  "PART_TIME",
  "INTERN",
]);

export const WorkLocationEnum = z.enum([
  "ONSITE",
  "REMOTE",
  "HYBRID",
]);

export const PayFrequencyEnum = z.enum([
  "MONTHLY",
  "SEMI_MONTHLY",
  "BI_WEEKLY",
  "WEEKLY",
]);

// Nested JSON Schemas for validation
export const EmployerSchema = z.object({
  name: z.string().optional(),
  tin: z.string().optional(),
  rdoCode: z.string().optional(),
  branchCode: z.string().optional(),
  address: z.string().optional(),
  isVerified: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
}).passthrough();

export const TimeSlotSchema = z.object({
  type: z.string(), // "work" | "break"
  label: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export const ShiftSchema = z.object({
  label: z.string(), // "Mon", "Tue", etc.
  isRestDay: z.boolean(),
  timeSlots: z.array(TimeSlotSchema),
});

export const ScheduleSchema = z.object({
  scheduleCode: z.string().optional(),
  scheduleName: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  shifts: z.array(ShiftSchema).optional(),
}).passthrough();

export const LeaveBalanceSchema = z.object({
  leaveType: z.string(), // "VACATION", "SICK", "PERSONAL"
  totalEntitled: z.number(),
  used: z.number(),
  pending: z.number(),
  available: z.number(),
  carriedOver: z.number().nullable().optional(),
  maxCarryOver: z.number().nullable().optional(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
});

export const DocumentSchema = z.object({
  name: z.string(),
  type: z.string(), // "TIN", "SSS", "PhilHealth", "Pag-IBIG"
  number: z.string(),
  issueDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  ext: z.string().nullable().optional(),
});

export const UserAccountSchema = z.object({
  id: z.string().optional(),
  userName: z.string().optional(),
  email: z.string().email().optional(),
  status: z.string().optional(),
  lastLogin: z.string().nullable().optional(),
  loginMethod: z.string().optional(),
  roleId: z.string().nullable().optional(),
  workspaceId: z.string().optional(),
  metadata: z.any().optional(),
}).passthrough();

// Base Employee Schema (internal model)
export const EmployeeSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.string(),

  // External API reference
  externalId: z.string().optional().nullable(),
  externalSource: z.string().optional().nullable(),

  // Employee Identification
  employeeId: z.string().min(1, "Employee ID is required"),
  userId: z.string().optional().nullable(),
  personId: z.string().optional().nullable(),
  role: z.string().optional().nullable(),

  // Personal Info
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  gender: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),

  // Employment Details
  employmentStatus: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  employmentHireDate: z.coerce.date().optional().nullable(),
  employmentStartDate: z.coerce.date().optional().nullable(),
  employmentTerminationDate: z.coerce.date().optional().nullable(),
  probationEndDate: z.coerce.date().optional().nullable(),

  // Organization Structure
  departmentId: z.string().optional().nullable(),
  departmentName: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  positionTitle: z.string().optional().nullable(),
  positionCode: z.string().optional().nullable(),
  levelId: z.string().optional().nullable(),
  levelName: z.string().optional().nullable(),
  levelRank: z.number().optional().nullable(),
  reportToId: z.string().optional().nullable(),
  reportToName: z.string().optional().nullable(),
  reportToEmail: z.string().optional().nullable(),

  // Work Details
  workLocation: z.string().optional().nullable(),
  isManager: z.boolean().default(false),
  deviceId: z.string().optional().nullable(),
  deviceEmpId: z.string().optional().nullable(),

  // Compensation
  basicSalary: z.number().optional().nullable(),
  currency: z.string().default("PHP"),
  payFrequency: z.string().optional().nullable(),

  // JSON fields
  employer: EmployerSchema.optional().nullable(),
  schedule: ScheduleSchema.optional().nullable(),
  leaveBalances: z.array(LeaveBalanceSchema).optional().nullable(),
  leaveBalancesLastUpdated: z.coerce.date().optional().nullable(),
  documents: z.array(DocumentSchema).optional().nullable(),
  employmentHistory: z.array(z.any()).optional().nullable(),
  userAccount: UserAccountSchema.optional().nullable(),

  // Sync Metadata
  syncStatus: SyncStatusEnum.default("SYNCED"),
  lastSyncAt: z.coerce.date().optional().nullable(),
  syncError: z.string().optional().nullable(),
  rawExternalData: z.any().optional().nullable(),

  // Flags
  isTour: z.boolean().default(false),
  isDeleted: z.boolean().default(false),

  // Audit
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  createdBy: z.string().optional().nullable(),
  updatedBy: z.string().optional().nullable(),

  // Metadata
  metadata: z.record(z.any()).optional().nullable(),
});

// Create Employee Schema (for manual creation)
export const CreateEmployeeSchema = EmployeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
  syncError: true,
  rawExternalData: true,
});

// Update Employee Schema
export const UpdateEmployeeSchema = EmployeeSchema.partial().omit({
  id: true,
  workspaceId: true,
  createdAt: true,
});

// Types
export type Employee = z.infer<typeof EmployeeSchema>;
export type CreateEmployee = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof UpdateEmployeeSchema>;
export type SyncStatus = z.infer<typeof SyncStatusEnum>;
export type Employer = z.infer<typeof EmployerSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;
export type Document = z.infer<typeof DocumentSchema>;
