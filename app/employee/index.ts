import express, { Router } from "express";
import { controller } from "./employee.controller";
import { router } from "./employee.router";
import { PrismaClient } from "../../generated/prisma";

export const employeeModule = (prisma: PrismaClient): Router => {
  return router(express.Router(), controller(prisma));
};

// Named exports for individual components
export { router } from "./employee.router";
export { controller } from "./employee.controller";
export { employeeRepository } from "./employee.repository";
export { EmployeeService, createEmployeeService } from "./employee.service";
export * from "../../zod/employee.zod";

// For backward compatibility / CommonJS require
module.exports = employeeModule;
