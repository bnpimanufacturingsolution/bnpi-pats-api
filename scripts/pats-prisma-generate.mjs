import { requirePatsDatabaseUrl, runPrisma } from "./pats-prisma-runner.mjs";

requirePatsDatabaseUrl();
runPrisma(["generate", ...process.argv.slice(2)]);
