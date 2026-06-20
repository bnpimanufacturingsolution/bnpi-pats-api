import express, { Router } from "express";
import { controller } from "./project-member.controller";
import { router } from "./project-member.router";
import { PrismaClient } from "../../generated/prisma";

export const projectMemberModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = projectMemberModule;
