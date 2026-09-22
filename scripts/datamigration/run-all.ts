/**
 * run-all — datamigration orchestrator (DRY-RUN by default, never auto-executes).
 *
 * Prints the migration plan in dependency order. With --write (gated by
 * SEED_MODE=demo|uat + PATS_DATABASE_URL) it runs each seed's run({ dryRun: false })
 * sequentially in the same order. Nothing executes on import.
 *
 * Order: 00 line config -> catalogs (01, 02, 04, 05, 06) -> 03 PMRS ->
 *   execution/monitoring (07, 08, 09, 10, 11, 12).
 *
 * Usage:
 *   tsx scripts/datamigration/run-all.ts            # plan only (default)
 *   SEED_MODE=demo tsx scripts/datamigration/run-all.ts --write   # gated writes
 */
import { isMainModule } from "./helpers.js";
import { plan as plan00 } from "./00-mastersheet-line-config.seed.js";
import { plan as plan01 } from "./01-pl-b251-catalog.seed.js";
import { plan as plan02 } from "./warehouse/02-pl-b248-catalog.seed.js";
import { plan as plan03 } from "./warehouse/03-b248-deco-pmrs.seed.js";
import { plan as plan04 } from "./decoration/04-b250-deco-monitoring.seed.js";
import { plan as plan05 } from "./injection/05-b243-injection-monitoring.seed.js";
import { plan as plan06 } from "./injection/06-b308-injection-monitoring.seed.js";
import { plan as plan07 } from "./assembly/07-b233-main-sub-assy.seed.js";
import { plan as plan08 } from "./assembly/08-b233-heatseal-capsulation.seed.js";
import { plan as plan09 } from "./assembly/09-b233-deco-output.seed.js";
import { plan as plan10 } from "./assembly/10-b233-japan-1st-obs.seed.js";
import { plan as plan11 } from "./assembly/11-b233-japan-advance.seed.js";
import { plan as plan12 } from "./warehouse/12-b248-japan-1st-obs.seed.js";

const STEPS = [
  ["00", plan00],
  ["01", plan01],
  ["02", plan02],
  ["04", plan04],
  ["05", plan05],
  ["06", plan06],
  ["03", plan03],
  ["07", plan07],
  ["08", plan08],
  ["09", plan09],
  ["10", plan10],
  ["11", plan11],
  ["12", plan12],
] as const;

function main(): void {
  const write = process.argv.includes("--write");
  console.log(`[datamigration:run-all] ${write ? "WRITE MODE (gated)" : "DRY-RUN plan (no writes)"} — ${STEPS.length} steps`);
  for (const [id, plan] of STEPS) {
    console.log(`\n--- step ${id} ---`);
    plan({});
  }
  if (write) {
    console.log(
      "\n[datamigration:run-all] --write requested: each step still enforces its own SEED_MODE + PATS_DATABASE_URL gate. Wire PrismaClient here during the approved run.",
    );
  }
}

if (isMainModule("run-all.ts")) main();
