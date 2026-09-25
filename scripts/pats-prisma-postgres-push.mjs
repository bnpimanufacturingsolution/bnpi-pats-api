import { requirePatsDatabaseUrl, runPrisma } from "./pats-prisma-runner.mjs";

// Schema-only push for appliance Postgres (PATS schema).
// Never passes --accept-data-loss: destructive drift must fail closed so a
// db-init job cannot wipe UAT/PROD timesheet/attendance data. No seeding here;
// seed paths are DEV-style local clones only.
requirePatsDatabaseUrl();
runPrisma(["db", "push"]);
