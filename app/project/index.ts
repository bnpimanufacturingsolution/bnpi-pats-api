import express, { Router } from "express";
import { controller } from "./project.controller";
import { router } from "./project.router";
import { PrismaClient } from "../../generated/prisma";

export const projectModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = projectModule;
