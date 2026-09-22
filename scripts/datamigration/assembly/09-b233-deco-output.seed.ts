/**
 * 09 — B233 deco-output seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 (DECO OUTPUT).xlsx
 * 5 active model sheets + 5 empty placeholders (model 6-10 seed nothing) + summary/KD/Min-Set.
 * Requires 07 (B233 catalog) first.
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "09-b233-deco-output";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 (DECO OUTPUT).xlsx";

// Verbatim PMRS block per active model sheet (R4-R9).
export const MODEL_SHEETS = [
  { sheet: "01 Hoi-Poi Capsule", model: "01", pmrs: 133096, orderSqci: 132720, rq: 1996, minSet: 83400, discrepancy: -51692, parts: ["BODY"] },
  { sheet: "02 Bulma's Bike", model: "02", pmrs: 133096, orderSqci: 132720, rq: 1996, minSet: 83200, discrepancy: -51892, parts: ["SUNSHADE", "MOTOR", "CONSOLE"] },
  { sheet: "03 Senzu Bean", model: "03", pmrs: 133096, orderSqci: 132720, rq: 1996, minSet: 99800, discrepancy: -35292, parts: ["BEAN", "BODY"] },
  { sheet: "04 Master Karin", model: "04", pmrs: 133096, orderSqci: 132720, rq: 1996, minSet: 88200, discrepancy: -46892, parts: ["HEAD&body", "LEFT HAND & CRUTCH", "TAIL"] },
  { sheet: "05 Great Ape", model: "05", pmrs: 133096, orderSqci: 132720, rq: 1996, minSet: 85600, discrepancy: -49492, parts: ["HEAD", "LOWER MOUTH", "BODY", "TAIL"] },
] as const;

export const PLACEHOLDER_SHEETS = ["model 6", "Model 7", "Model 8", "Model 9", "Model 10"] as const;

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    requires: "07-b233-main-sub-assy (B233 catalog)",
    activeModels: MODEL_SHEETS.length,
    placeholderSheetsSkipped: PLACEHOLDER_SHEETS.length,
    pmrsPerModel: 133096,
    source: SOURCE_PATH,
  };
  logPlan(SEED_NAME, summary);
  return summary;
}

export async function run(options: SeedRunOptions = {}) {
  const resolved = resolveOptions(options);
  if (resolved.dryRun) return plan(resolved);
  assertCanWrite(resolved.dryRun);
  if (!resolved.prisma) throw new Error("Prisma client is required for writes.");
  console.log(`[${SEED_NAME}] writes deferred to approved run (plan only).`);
  return plan(resolved);
}

if (isMainModule("09-b233-deco-output.seed.ts")) plan({});
