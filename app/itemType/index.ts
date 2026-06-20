import express, { Router } from "express";
import { controller } from "./itemType.controller";
import { router } from "./itemType.router";
import { PrismaClient } from "../../generated/prisma";

export const itemTypeModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

// For backward compatibility
module.exports = itemTypeModule;
