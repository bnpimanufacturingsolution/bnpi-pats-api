import express, { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { controller } from "./demand.controller";
import { router } from "./demand.router";

export const demandModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = demandModule;
