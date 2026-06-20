import express, { Router } from "express";
import { controller } from "./deliveryOrder.controller";
import { router } from "./deliveryOrder.router";
import { PrismaClient } from "../../generated/prisma";

export const deliveryOrderModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = deliveryOrderModule;
