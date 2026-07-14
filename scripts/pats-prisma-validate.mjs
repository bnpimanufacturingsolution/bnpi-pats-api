import { requirePatsDatabaseUrl, runPrisma } from "./pats-prisma-runner.mjs";

requirePatsDatabaseUrl();
runPrisma(["validate", ...process.argv.slice(2)]);
