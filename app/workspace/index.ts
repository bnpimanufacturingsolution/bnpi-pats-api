import express, { Router } from "express";
import { controller } from "./workspace.controller";
import { router } from "./workspace.router";
import { PrismaClient } from "../../generated/prisma";

export const workspaceModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = workspaceModule;
