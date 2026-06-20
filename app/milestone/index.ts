import express, { Router } from "express";
import { controller } from "./milestone.controller";
import { router } from "./milestone.router";
import { PrismaClient } from "../../generated/prisma";

export const milestoneModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = milestoneModule;
