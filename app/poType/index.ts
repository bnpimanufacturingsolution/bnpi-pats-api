import express, { Router } from "express";
import { controller } from "./poType.controller";
import { router } from "./poType.router";
import { PrismaClient } from "../../generated/prisma";

export const poTypeModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = poTypeModule;
