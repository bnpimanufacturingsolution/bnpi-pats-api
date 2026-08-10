import { runPrisma } from "./pats-prisma-runner.mjs";

runPrisma(["format", ...process.argv.slice(2)]);
