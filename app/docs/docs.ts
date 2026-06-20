import express, { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ExpressApp } from "../types";
import { controller } from "./docs.controller";
import { router as docsRouter } from "./docs.router";

export const docsModule = (prisma?: PrismaClient, appInstance?: ExpressApp): Router => {
	return docsRouter(express.Router(), controller(appInstance));
};

// For backward compatibility
module.exports = docsModule;
