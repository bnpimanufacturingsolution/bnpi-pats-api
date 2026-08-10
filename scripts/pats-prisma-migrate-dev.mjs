import { requirePatsDatabaseUrl, runPrisma } from "./pats-prisma-runner.mjs";

requirePatsDatabaseUrl();
runPrisma(["migrate", "dev", ...process.argv.slice(2)]);
