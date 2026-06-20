import { PrismaClient } from "../../generated/prisma";
import router from "./field.router";

const fieldModule = (prisma: PrismaClient) => router(prisma);

// For backward compatibility
module.exports = fieldModule;

export default fieldModule;
