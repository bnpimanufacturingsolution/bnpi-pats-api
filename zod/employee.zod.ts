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

// ============================================================
// HRIS API Response Schema (Third-party format)
// ============================================================

// Personal info from user.metadata.employee.personalInfo
const HRISPersonalInfoSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),
});

// Department from user.metadata.employee.department
const HRISDepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});

// Position from user.metadata.employee.position
const HRISPositionSchema = z.object({
  id: z.string(),
  title: z.string(),
  code: z.string(),
});

// Level from user.metadata.employee.level
const HRISLevelSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.number(),
});

// ReportTo from user.metadata.employee.reportTo
const HRISReportToSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
}).nullable().optional();

// User metadata employee object
const HRISUserMetadataEmployeeSchema = z.object({
  id: z.string(),
  personalInfo: HRISPersonalInfoSchema,
  department: HRISDepartmentSchema.optional(),
  position: HRISPositionSchema.optional(),
  level: HRISLevelSchema.optional(),
  reportTo: HRISReportToSchema,
});

// User object from HRIS API
const HRISUserSchema = z.object({
  id: z.string(),
  userName: z.string(),
  email: z.string().email(),
  password: z.string().optional(), // We won't store this
  status: z.string(),
  isDeleted: z.boolean(),
  lastLogin: z.string().nullable(),
  loginMethod: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  roleId: z.string().nullable(),
  workspaceId: z.string(),
  metadata: z.object({
    employee: HRISUserMetadataEmployeeSchema.optional(),
    device: z.any().optional(),
  }).optional(),
});

// Main HRIS Employee Schema (external API response format)
export const HRISEmployeeSchema = z.object({
  // Core IDs
  id: z.string(),
  workspaceId: z.string(),
  employeeId: z.string(),
  userId: z.string(),
  personId: z.string(),
  role: z.string(),

  // Employment Details
  employmentStatus: z.string(),
  employmentType: z.string(),
  employmentHireDate: z.string().nullable(),
  employmentStartDate: z.string().nullable(),
  employmentTerminationDate: z.string().nullable(),
  probationEndDate: z.string().nullable(),

  // Organization Structure (IDs only)
  departmentId: z.string(),
  positionId: z.string(),
  levelId: z.string(),
  reportToId: z.string().nullable(),

  // Work Details
  workLocation: z.string(),
  isManager: z.boolean(),
  deviceId: z.string().nullable(),
  deviceEmpId: z.string().nullable(),

  // Compensation
  basicSalary: z.number(),
  currency: z.string(),
  payFrequency: z.string(),

  // Nested Objects
  employer: EmployerSchema,
  schedule: ScheduleSchema,
  leaveBalances: z.array(LeaveBalanceSchema),
  leaveBalancesLastUpdated: z.string(),
  documents: z.array(DocumentSchema),
  employmentHistory: z.array(z.any()),

  // User account with metadata containing personal info
  user: HRISUserSchema,

  // Flags
  isTour: z.boolean(),
  isDeleted: z.boolean(),

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),

  // Other
  metadata: z.any().nullable(),
}).passthrough();

// HRIS API Response wrapper
export const HRISApiResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  data: z.object({
    employees: z.array(HRISEmployeeSchema),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }).optional(),
  }),
  code: z.number(),
  timestamp: z.string(),
});

// Sync configuration schema
export const SyncConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().optional(),
  authToken: z.string().optional(),
  authType: z.enum(["bearer", "api-key", "basic", "none"]).default("bearer"),
  headers: z.record(z.string()).optional(),
  timeout: z.number().default(30000),
  retryAttempts: z.number().default(3),
  retryDelay: z.number().default(1000),
  batchSize: z.number().default(100),
  // Optional: override workspaceId matching
  syncAllOrganizations: z.boolean().default(false),
});

// Types
export type Employee = z.infer<typeof EmployeeSchema>;
export type CreateEmployee = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof UpdateEmployeeSchema>;
export type HRISEmployee = z.infer<typeof HRISEmployeeSchema>;
export type HRISApiResponse = z.infer<typeof HRISApiResponseSchema>;
export type SyncConfig = z.infer<typeof SyncConfigSchema>;
export type SyncStatus = z.infer<typeof SyncStatusEnum>;
export type Employer = z.infer<typeof EmployerSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;
export type Document = z.infer<typeof DocumentSchema>;
