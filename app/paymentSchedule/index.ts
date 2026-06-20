import express, { Router } from "express";
import { controller } from "./paymentSchedule.controller";
import { router } from "./paymentSchedule.router";
import { PrismaClient } from "../../generated/prisma";

export const paymentScheduleModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = paymentScheduleModule;
