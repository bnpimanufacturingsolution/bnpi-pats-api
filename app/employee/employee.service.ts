import { PrismaClient, Prisma } from "../../generated/prisma";
import { employeeRepository, EmployeeRepository } from "./employee.repository";
import {
  HRISEmployeeSchema,
  HRISApiResponseSchema,
  SyncConfig,
  HRISEmployee,
} from "../../zod/employee.zod";
import { Logger } from "winston";

interface SyncResult {
  success: boolean;
  source: "api" | "database";
  data: any[];
  total: number;
  synced?: number;
  created?: number;
  updated?: number;
  failed?: number;
  errors?: string[];
  message: string;
}

interface TransformOptions {
  externalSource: string;
  workspaceId: string;
}

export class EmployeeService {
  private repository: EmployeeRepository;
  private prisma: PrismaClient;
  private logger?: Logger;

  constructor(prisma: PrismaClient, logger?: Logger) {
    this.prisma = prisma;
    this.repository = employeeRepository(prisma);
    this.logger = logger;
  }

  /**
   * Main sync method - fetches from HRIS API, falls back to database on failure
   */
  async syncEmployees(
    workspaceId: string,
    config: SyncConfig
  ): Promise<SyncResult> {
    this.log("info", `Starting employee sync for organization: ${workspaceId}`);

    try {
      // Try to fetch from third-party HRIS API
      const apiResult = await this.fetchFromHRISApi(config);

      if (apiResult.success && apiResult.data.length > 0) {
        // Transform and save to database
        const saveResult = await this.saveHRISEmployees(
          apiResult.data,
          {
            externalSource: this.getSourceName(config.apiUrl),
            workspaceId,
          }
        );

        this.log("info", `Sync completed: ${saveResult.synced} employees synced`);

        return {
          success: true,
          source: "api",
          data: saveResult.employees,
          total: saveResult.employees.length,
          synced: saveResult.synced,
          created: saveResult.created,
          updated: saveResult.updated,
          failed: saveResult.failed,
          errors: saveResult.errors,
          message: `Successfully synced ${saveResult.synced} employees from HRIS API`,
        };
      }

      // API returned empty or failed - fall back to database
      throw new Error(apiResult.error || "No data returned from API");
    } catch (error) {
      this.log("warn", `API sync failed, falling back to database: ${error}`);

      // Fall back to database
      return this.getFromDatabase(workspaceId);
    }
  }

  /**
   * Fetch employees from HRIS API
   */
  private async fetchFromHRISApi(
    config: SyncConfig
  ): Promise<{ success: boolean; data: HRISEmployee[]; error?: string }> {
    const { apiUrl, authType, authToken, apiKey, headers, timeout, retryAttempts, retryDelay } =
      config;

    let lastError: string = "";

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        this.log("info", `HRIS API fetch attempt ${attempt}/${retryAttempts}`);

        const requestHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...headers,
        };

        // Add authentication
        switch (authType) {
          case "bearer":
            if (authToken) {
              requestHeaders["Authorization"] = `Bearer ${authToken}`;
            }
            break;
          case "api-key":
            if (apiKey) {
              requestHeaders["X-API-Key"] = apiKey;
            }
            break;
          case "basic":
            if (authToken) {
              requestHeaders["Authorization"] = `Basic ${authToken}`;
            }
            break;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: requestHeaders,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();

        // Validate response format
        const validated = HRISApiResponseSchema.safeParse(responseData);

        if (validated.success) {
          this.log("info", `Fetched ${validated.data.data.employees.length} employees from HRIS API`);
          return { success: true, data: validated.data.data.employees };
        }

        // Try to extract employees from generic response
        const employees = this.extractEmployeesFromResponse(responseData);
        if (employees.length > 0) {
          this.log("info", `Fetched ${employees.length} employees from HRIS API (generic format)`);
          return { success: true, data: employees };
        }

        throw new Error("Invalid API response format");
      } catch (error: any) {
        lastError = error.message || "Unknown error";
        this.log("warn", `API attempt ${attempt} failed: ${lastError}`);

        if (attempt < retryAttempts) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    return { success: false, data: [], error: lastError };
  }

  /**
   * Extract employees array from various API response formats
   */
  private extractEmployeesFromResponse(response: any): HRISEmployee[] {
    // Direct array
    if (Array.isArray(response)) {
      return response;
    }

    // Standard HRIS format: data.employees
    if (response.data?.employees && Array.isArray(response.data.employees)) {
      return response.data.employees;
    }

    // Common wrapper formats
    const possibleKeys = [
      "employees",
      "data",
      "results",
      "items",
      "records",
    ];

    for (const key of possibleKeys) {
      if (response[key] && Array.isArray(response[key])) {
        return response[key];
      }
    }

    this.log("warn", "Could not extract employees array from response");
    return [];
  }

  /**
   * Transform and save HRIS employees to database
   */
  private async saveHRISEmployees(
    hrisEmployees: HRISEmployee[],
    options: TransformOptions
  ): Promise<{
    employees: any[];
    synced: number;
    created: number;
    updated: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      employees: [] as any[],
      synced: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const hrisEmp of hrisEmployees) {
      try {
        // Validate HRIS employee data
        const validated = HRISEmployeeSchema.safeParse(hrisEmp);
        if (!validated.success) {
          this.log("warn", `Validation failed for employee ${hrisEmp.employeeId}: ${JSON.stringify(validated.error.issues)}`);
          // Continue anyway with raw data, just log the warning
        }

        // Transform to internal format
        const transformed = this.transformHRISEmployee(hrisEmp, options);

        // Check if employee exists by externalId
        const existing = await this.repository.getByExternalId(
          hrisEmp.id,
          options.workspaceId,
          options.externalSource
        );

        let employee;
        if (existing) {
          // Update existing employee
          const { updatedEmployee } = await this.repository.update(existing.id, {
            ...transformed,
            syncStatus: "SYNCED",
            lastSyncAt: new Date(),
            syncError: null,
          } as Prisma.EmployeeUpdateInput, options.workspaceId);
          employee = updatedEmployee;
          results.updated++;
        } else {
          // Check by employeeId as well (in case externalId changed)
          const existingByEmpId = await this.repository.getByEmployeeNumber(
            hrisEmp.employeeId,
            options.workspaceId
          );

          if (existingByEmpId) {
            // Update existing employee found by employeeId
            const { updatedEmployee } = await this.repository.update(existingByEmpId.id, {
              ...transformed,
              externalId: hrisEmp.id, // Update externalId
              syncStatus: "SYNCED",
              lastSyncAt: new Date(),
              syncError: null,
            } as Prisma.EmployeeUpdateInput, options.workspaceId);
            employee = updatedEmployee;
            results.updated++;
          } else {
            // Create new employee
            employee = await this.repository.create({
              ...transformed,
              syncStatus: "SYNCED",
              lastSyncAt: new Date(),
            } as Prisma.EmployeeCreateInput);
            results.created++;
          }
        }

        if (employee) {
          results.employees.push(employee);
          results.synced++;
        }
      } catch (error: any) {
        results.failed++;
        const errorMsg = `Failed to save employee ${hrisEmp.employeeId}: ${error.message}`;
        results.errors.push(errorMsg);
        this.log("error", errorMsg);
      }
    }

    return results;
  }

  /**
   * Transform HRIS employee data to internal format
   */
  private transformHRISEmployee(
    hris: HRISEmployee,
    options: TransformOptions
  ): Partial<Prisma.EmployeeCreateInput> & { workspaceId: string } {
    // Extract personal info from user.metadata.employee.personalInfo
    const personalInfo = hris.user?.metadata?.employee?.personalInfo;
    const firstName = personalInfo?.firstName || "Unknown";
    const lastName = personalInfo?.lastName || "Unknown";

    // Extract department info
    const department = hris.user?.metadata?.employee?.department;

    // Extract position info
    const position = hris.user?.metadata?.employee?.position;

    // Extract level info
    const level = hris.user?.metadata?.employee?.level;

    // Extract reportTo info
    const reportTo = hris.user?.metadata?.employee?.reportTo;

    // Parse dates safely
    const parseDate = (value: any): Date | null => {
      if (!value || value === "1970-01-01T00:00:00.000Z") return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    };

    // Build user account object (without sensitive data)
    const userAccount = hris.user ? {
      id: hris.user.id,
      userName: hris.user.userName,
      email: hris.user.email,
      status: hris.user.status,
      lastLogin: hris.user.lastLogin,
      loginMethod: hris.user.loginMethod,
      roleId: hris.user.roleId,
      workspaceId: hris.user.workspaceId,
      // Don't store password!
    } : null;

    return {
      workspaceId: options.workspaceId,
      externalId: hris.id,
      externalSource: options.externalSource,

      // Employee Identification
      employeeId: hris.employeeId,
      userId: hris.userId,
      personId: hris.personId,
      role: hris.role,

      // Personal Info (from nested user.metadata.employee.personalInfo)
      firstName,
      lastName,
      email: hris.user?.email || `${hris.employeeId}@temp.local`,

      // Employment Details
      employmentStatus: hris.employmentStatus,
      employmentType: hris.employmentType,
      employmentHireDate: parseDate(hris.employmentHireDate),
      employmentStartDate: parseDate(hris.employmentStartDate),
      employmentTerminationDate: parseDate(hris.employmentTerminationDate),
      probationEndDate: parseDate(hris.probationEndDate),

      // Organization Structure - IDs and denormalized data
      departmentId: hris.departmentId,
      departmentName: department?.name || null,
      departmentCode: department?.code || null,

      positionId: hris.positionId,
      positionTitle: position?.title || null,
      positionCode: position?.code || null,

      levelId: hris.levelId,
      levelName: level?.name || null,
      levelRank: level?.rank || null,

      reportToId: hris.reportToId,
      reportToName: reportTo ? `${reportTo.firstName} ${reportTo.lastName}` : null,
      reportToEmail: reportTo?.email || null,

      // Work Details
      workLocation: hris.workLocation,
      isManager: hris.isManager,
      deviceId: hris.deviceId,
      deviceEmpId: hris.deviceEmpId,

      // Compensation
      basicSalary: hris.basicSalary,
      currency: hris.currency || "PHP",
      payFrequency: hris.payFrequency,

      // JSON fields - store complex nested data
      employer: hris.employer as any,
      schedule: hris.schedule as any,
      leaveBalances: hris.leaveBalances as any,
      leaveBalancesLastUpdated: parseDate(hris.leaveBalancesLastUpdated),
      documents: hris.documents as any,
      employmentHistory: hris.employmentHistory as any,
      userAccount: userAccount as any,

      // Flags
      isTour: hris.isTour,
      isDeleted: hris.isDeleted,

      // Store raw data for reference
      rawExternalData: hris as any,

      // Metadata from HRIS
      metadata: hris.metadata as any,
    };
  }

  /**
   * Get employees from database (fallback)
   */
  private async getFromDatabase(workspaceId: string): Promise<SyncResult> {
    try {
      const employees = await this.prisma.employee.findMany({
        where: { workspaceId, isDeleted: false },
        orderBy: { createdAt: "desc" },
      });

      return {
        success: true,
        source: "database",
        data: employees,
        total: employees.length,
        message: `Retrieved ${employees.length} employees from database (API unavailable)`,
      };
    } catch (error: any) {
      this.log("error", `Database fallback failed: ${error.message}`);

      return {
        success: false,
        source: "database",
        data: [],
        total: 0,
        message: `Failed to retrieve employees: ${error.message}`,
      };
    }
  }

  /**
   * Manual sync trigger - useful for scheduled jobs
   */
  async triggerSync(
    workspaceId: string,
    config: SyncConfig
  ): Promise<SyncResult> {
    // Mark all existing employees as pending sync
    const existing = await this.repository.getExternalIds(workspaceId);
    if (existing.length > 0) {
      await this.repository.updateSyncStatus(
        existing.map((e) => e.id),
        "PENDING"
      );
    }

    // Perform sync
    const result = await this.syncEmployees(workspaceId, config);

    // If sync was successful from API, mark employees not in response as potentially stale
    if (result.success && result.source === "api") {
      const syncedExternalIds = result.data
        .filter((e) => e.externalId)
        .map((e) => e.externalId);

      // Update employees that were not in the sync to mark them as potentially terminated
      if (syncedExternalIds.length > 0) {
        await this.repository.markAsTerminated(syncedExternalIds, workspaceId);
      }
    }

    return result;
  }

  /**
   * Get sync status/health
   */
  async getSyncStatus(workspaceId: string) {
    const stats = await this.repository.getStats(workspaceId);
    const issues = await this.repository.getWithSyncIssues(workspaceId);

    return {
      stats,
      syncIssues: issues.map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        name: `${e.firstName} ${e.lastName}`,
        syncStatus: e.syncStatus,
        lastSyncAt: e.lastSyncAt,
        syncError: e.syncError,
      })),
      healthy: issues.length === 0,
    };
  }

  /**
   * Extract source name from URL
   */
  private getSourceName(url: string): string {
    try {
      const urlObj = new URL(url);
      // Extract meaningful name from hostname
      const hostname = urlObj.hostname.replace("www.", "");
      if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.")) {
        return "hris-local";
      }
      return hostname.split(".")[0] || "hris";
    } catch {
      return "hris";
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Logging helper
   */
  private log(level: "info" | "warn" | "error", message: string) {
    if (this.logger) {
      this.logger[level](message);
    } else {
      console[level](`[EmployeeService] ${message}`);
    }
  }
}

export const createEmployeeService = (prisma: PrismaClient, logger?: Logger) => {
  return new EmployeeService(prisma, logger);
};
