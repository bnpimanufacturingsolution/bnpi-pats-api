import express, { Router } from "express";
import { controller } from "./usageCode.controller";
import { router } from "./usageCode.router";
import { PrismaClient } from "../../generated/prisma";

export const usageCodeModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = usageCodeModule;
