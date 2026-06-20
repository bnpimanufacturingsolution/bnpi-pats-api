import express, { Router } from "express";
import { controller } from "./sequential.controller";
import { router } from "./sequential.router";
import { PrismaClient } from "../../generated/prisma";

export const sequentialModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = sequentialModule;
