import express, { Router } from "express";
import { controller } from "./estimation.controller";
import { router } from "./estimation.router";
import { PrismaClient } from "../../generated/prisma";

export const estimationModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = estimationModule;
