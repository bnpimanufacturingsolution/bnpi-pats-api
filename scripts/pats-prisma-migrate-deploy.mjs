import { requirePatsDatabaseUrl, runPrisma } from "./pats-prisma-runner.mjs";

requirePatsDatabaseUrl();
runPrisma(["migrate", "deploy", ...process.argv.slice(2)]);
