import express, { Router } from "express";
import { controller } from "./product.controller";
import { router } from "./product.router";
import { PrismaClient } from "../../generated/prisma";

export const productModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = productModule;
