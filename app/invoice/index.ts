import express, { Router } from "express";
import { controller } from "./invoice.controller";
import { router } from "./invoice.router";
import { PrismaClient } from "../../generated/prisma";

export const invoiceModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = invoiceModule;
