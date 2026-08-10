import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const schemaPath = "prisma/pats/schema.prisma";
const prismaCliPath = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

export function requirePatsDatabaseUrl() {
  if (!process.env.PATS_DATABASE_URL) {
    throw new Error("PATS_DATABASE_URL is required for PATS Prisma commands.");
  }
}

export function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCliPath, ...args, "--schema", schemaPath], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}
