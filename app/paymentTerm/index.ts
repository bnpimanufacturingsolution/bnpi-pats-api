import express, { Router } from "express";
import { controller } from "./paymentTerm.controller";
import { router } from "./paymentTerm.router";
import { PrismaClient } from "../../generated/prisma";

export const paymentTermModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = paymentTermModule;
