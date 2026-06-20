import express, { Router } from "express";
import { controller } from "./payslip.controller";
import { router } from "./payslip.router";
import { PrismaClient } from "../../generated/prisma";

export const payslipModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = payslipModule;
