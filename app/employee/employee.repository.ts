import { PrismaClient, Prisma } from "../../generated/prisma";

export const employeeRepository = (prisma: PrismaClient) => ({
  /**
   * Create a new employee
   */
  async create(data: Prisma.EmployeeCreateInput) {
    return prisma.employee.create({ data });
  },

  /**
   * Create multiple employees (bulk insert)
   */
  async createMany(data: Prisma.EmployeeCreateManyInput[]) {
    return prisma.employee.createMany({ data });
  },

  /**
   * Get all employees with query options
   */
  async getAll(
    findManyQuery: Prisma.EmployeeFindManyArgs,
    whereClause: Prisma.EmployeeWhereInput,
    options: { document: boolean; count: boolean }
  ) {
    const [data, total] = await Promise.all([
      options.document ? prisma.employee.findMany(findManyQuery) : [],
      options.count ? prisma.employee.count({ where: whereClause }) : 0,
    ]);
    return [data, total] as const;
  },

  /**
   * Get employee by ID with optional field selection
   */
  async getById(query: Prisma.EmployeeFindFirstArgs) {
    return prisma.employee.findFirst(query);
  },

  /**
   * Get employee by external ID (from third-party API)
   */
  async getByExternalId(externalId: string, workspaceId: string, externalSource?: string) {
    const where: Prisma.EmployeeWhereInput = {
      externalId,
      workspaceId,
      isDeleted: false,
    };
    if (externalSource) {
      where.externalSource = externalSource;
    }
    return prisma.employee.findFirst({ where });
  },

  /**
   * Get employee by email
   */
  async getByEmail(email: string, workspaceId: string) {
    return prisma.employee.findFirst({
      where: { email, workspaceId, isDeleted: false },
    });
  },

  /**
   * Get employee by employeeId (employee number)
   */
  async getByEmployeeNumber(employeeId: string, workspaceId: string) {
    return prisma.employee.findFirst({
      where: { employeeId, workspaceId, isDeleted: false },
    });
  },

  /**
   * Get employees with sync issues
   */
  async getWithSyncIssues(workspaceId: string) {
    return prisma.employee.findMany({
      where: {
        workspaceId,
        syncStatus: { in: ["FAILED", "PENDING"] },
        isDeleted: false,
      },
      orderBy: { lastSyncAt: "desc" },
    });
  },

  /**
   * Get all external IDs for an organization (for sync comparison)
   */
  async getExternalIds(workspaceId: string) {
    return prisma.employee.findMany({
      where: { workspaceId, isDeleted: false, externalId: { not: null } },
      select: { id: true, externalId: true, externalSource: true },
    });
  },

  /**
   * Update employee
   */
  async update(id: string, data: Prisma.EmployeeUpdateInput, workspaceId: string) {
    const existingEmployee = await prisma.employee.findFirst({
      where: { id, workspaceId, isDeleted: false },
    });

    if (!existingEmployee) {
      return { existingEmployee: null, updatedEmployee: null };
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });

    return { existingEmployee, updatedEmployee };
  },

  /**
   * Upsert employee (create or update based on external ID)
   */
  async upsertByExternalId(
    externalId: string,
    createData: Prisma.EmployeeCreateInput,
    updateData: Prisma.EmployeeUpdateInput
  ) {
    return prisma.employee.upsert({
      where: { externalId },
      create: createData,
      update: updateData,
    });
  },

  /**
   * Bulk upsert employees
   */
  async bulkUpsert(
    employees: Array<{
      externalId: string;
      data: Prisma.EmployeeCreateInput;
    }>
  ) {
    const results = await Promise.allSettled(
      employees.map((emp) =>
        prisma.employee.upsert({
          where: { externalId: emp.externalId },
          create: emp.data,
          update: {
            ...emp.data,
            updatedAt: new Date(),
            syncStatus: "SYNCED",
            lastSyncAt: new Date(),
            syncError: null,
          },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return { succeeded, failed, total: employees.length };
  },

  /**
   * Soft delete employee
   */
  async remove(id: string, workspaceId: string) {
    const existingEmployee = await prisma.employee.findFirst({
      where: { id, workspaceId, isDeleted: false },
    });

    if (!existingEmployee) {
      return null;
    }

    await prisma.employee.update({
      where: { id },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
        employmentStatus: "TERMINATED",
      },
    });

    return existingEmployee;
  },

  /**
   * Update sync status for multiple employees
   */
  async updateSyncStatus(
    ids: string[],
    syncStatus: "SYNCED" | "PENDING" | "FAILED" | "LOCAL_ONLY",
    syncError?: string
  ) {
    return prisma.employee.updateMany({
      where: { id: { in: ids } },
      data: {
        syncStatus,
        lastSyncAt: new Date(),
        syncError: syncError || null,
      },
    });
  },

  /**
   * Mark employees as terminated if not in external system
   */
  async markAsTerminated(externalIds: string[], workspaceId: string) {
    return prisma.employee.updateMany({
      where: {
        workspaceId,
        externalId: { notIn: externalIds },
        employmentStatus: { not: "TERMINATED" },
        isDeleted: false,
      },
      data: {
        employmentStatus: "TERMINATED",
        employmentTerminationDate: new Date(),
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Check for circular reporting reference
   * Returns true if assigning reportToId would create a circular reference
   */
  async hasCircularReference(
    employeeId: string | null,
    reportToId: string,
    workspaceId: string,
    maxDepth: number = 50
  ): Promise<boolean> {
    // If no employee ID (new employee), no circular reference possible
    if (!employeeId) return false;

    // If trying to report to self
    if (employeeId === reportToId) return true;

    // Traverse up the reporting chain to check for circular reference
    let currentId: string | null = reportToId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const manager: { id: string; reportToId: string | null } | null = await prisma.employee.findFirst({
        where: { id: currentId, workspaceId, isDeleted: false },
        select: { id: true, reportToId: true },
      });

      if (!manager) break;

      // Found circular reference - the chain leads back to the employee
      if (manager.reportToId === employeeId) {
        return true;
      }

      currentId = manager.reportToId;
      depth++;
    }

    return false;
  },

  /**
   * Get the reporting chain for an employee (for debugging/display)
   */
  async getReportingChain(
    employeeId: string,
    workspaceId: string,
    maxDepth: number = 20
  ): Promise<Array<{ id: string; name: string; position: string | null }>> {
    const chain: Array<{ id: string; name: string; position: string | null }> = [];
    let currentId: string | null = employeeId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const employee: { id: string; firstName: string; lastName: string; positionTitle: string | null; reportToId: string | null } | null = await prisma.employee.findFirst({
        where: { id: currentId, workspaceId, isDeleted: false },
        select: { id: true, firstName: true, lastName: true, positionTitle: true, reportToId: true },
      });

      if (!employee) break;

      chain.push({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        position: employee.positionTitle,
      });

      currentId = employee.reportToId;
      depth++;
    }

    return chain;
  },

  /**
   * Get employee statistics
   */
  async getStats(workspaceId: string) {
    const [total, byStatus, byDepartment, bySyncStatus] = await Promise.all([
      prisma.employee.count({
        where: { workspaceId, isDeleted: false },
      }),
      prisma.employee.groupBy({
        by: ["employmentStatus"],
        where: { workspaceId, isDeleted: false },
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ["departmentName"],
        where: { workspaceId, isDeleted: false },
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ["syncStatus"],
        where: { workspaceId, isDeleted: false },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.employmentStatus || "Unknown"] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byDepartment: byDepartment.reduce((acc, item) => {
        acc[item.departmentName || "Unassigned"] = item._count;
        return acc;
      }, {} as Record<string, number>),
      bySyncStatus: bySyncStatus.reduce((acc, item) => {
        acc[item.syncStatus] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  },
});

export type EmployeeRepository = ReturnType<typeof employeeRepository>;
