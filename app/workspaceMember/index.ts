import express, { Router } from "express";
import { controller } from "./workspace-member.controller";
import { router } from "./workspace-member.router";
import { PrismaClient } from "../../generated/prisma";

export const workspaceMemberModule = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};

module.exports = workspaceMemberModule;
