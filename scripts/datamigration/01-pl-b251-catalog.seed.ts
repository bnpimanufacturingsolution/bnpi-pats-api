/**
 * 01 — PL B251 catalog identity seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/PRODUCTION AND ASSEMBLY/Document/From Client/PL B251 Machibouke Hamburger Shop 3 (Rev 6.0).xlsx
 * Canonical data lives in scripts/pats-seed-client-b251.mjs (CLIENT_B251) and is
 * applied by scripts/pats-seed.mjs. This module only verifies identity so the
 * migration folder has one entry per workbook without forking the catalog.
 */
import { isMainModule, logPlan, resolveOptions, type SeedRunOptions } from "./helpers.js";

export const SEED_NAME = "01-pl-b251-catalog";
export const SOURCE_PATH =
  "docs/REPORTS/PRODUCTION AND ASSEMBLY/Document/From Client/PL B251 Machibouke Hamburger Shop 3 (Rev 6.0).xlsx";
export const EXPECTED = {
  workbookTitle: "PL B251 Machibouke Hamburger Shop 3 (Rev 6.0).xlsx",
  revision: "Rev. 6.0",
  revisionRow: "6 | 2026-05-12 | Updated Assy Parts List (Missing Part)",
  formCode: "BNPI-F-PES-018-1",
  productCode: "B251",
  // NOTE: tray quantity standard (240) lives in the canonical fragment
  // (pats-seed-client-b251.mjs), not as a Partslist cell — intentionally absent here.
} as const;

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    mode: "identity-check-only (canonical seed owns B251 writes)",
    source: SOURCE_PATH,
    expectedProduct: EXPECTED.productCode,
    canonicalModule: "scripts/pats-seed-client-b251.mjs",
    writesPlanned: 0,
  };
  logPlan(SEED_NAME, summary);
  return summary;
}

export async function run(options: SeedRunOptions = {}) {
  const resolved = resolveOptions(options);
  if (resolved.dryRun) return plan(resolved);
  // No independent writes — delegate to pats-seed.mjs during the approved run.
  return plan({ ...resolved, dryRun: true });
}

if (isMainModule("01-pl-b251-catalog.seed.ts")) plan({});
