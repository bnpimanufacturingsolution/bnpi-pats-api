/**
 * 11 — B233 Japan Advance + sample-pull seed (DRY-RUN by default, never auto-executes).
 *
 * Covers 3 physical files:
 *   Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - Japan Advance.xlsx
 *     -> advance split of lot 260822: 11 pallets /11, List gross 300 boxes
 *        (Info net 290 = 300 - 10 QC), OKAY.
 *   Assembly/... - Japan Advance - Copy.xlsx
 *     -> byte-identical Info + List (verified row-for-row): duplicate, seeds nothing.
 *   Assembly/... - Japan Advance - SAMPLE.xlsx
 *     -> sample pull from the same lot: 11 pallets /2, 242 boxes, NOT OKAY.
 *        Pallets 1-2 reduced to 1 carton each (tag categories
 *        SALES/DEVELOPMENT/PROMO/OVERSEAS SALES and REPLACEMENT SAMPLE).
 * Advance pallets reference the Lot from seed 10 (no duplicate Lot).
 * Requires 07 + 10 first.
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "11-b233-japan-advance";
export const SOURCE_PATHS = [
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - Japan Advance.xlsx",
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - Japan Advance - Copy.xlsx",
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - Japan Advance - SAMPLE.xlsx",
] as const;

export const ADVANCE = {
  lotNo: "260822",
  totalPallets: 11,
  totalBoxes: 300, // List gross; Info net 290 = 300 - 10 QC
  shippableNet: 290,
  qcBoxes: 10,
  cartonsPerPallet: 30,
  fractional: { 10: 20, 11: 10 } as Record<number, number>,
} as const;

// SAMPLE file: same lot + pallets, /2 barcode namespace, post-pull counts.
export const SAMPLE = {
  lotNo: "260822",
  totalPallets: 11,
  totalBoxes: 242, // 1 + 1 + 7x30 + 20 + 10; Info records the 2-carton pull
  status: "NOT OKAY",
  cartons: { 1: 1, 2: 1, 10: 20, 11: 10 } as Record<number, number>,
  tagCategory: {
    1: "SALES/DEVELOPMENT/PROMO/OVERSEAS SALES",
    2: "REPLACEMENT SAMPLE",
  } as Record<number, string>,
} as const;

export function palletRows() {
  const rows = [];
  for (let n = 1; n <= ADVANCE.totalPallets; n += 1) {
    rows.push({
      pallet: n,
      text: `${ADVANCE.lotNo}${n}/11`,
      barcode: `*${ADVANCE.lotNo}${n}/11*`,
      cartons: ADVANCE.fractional[n] ?? ADVANCE.cartonsPerPallet,
      category: n === 11 ? "FOR QC" : "Mass Pro",
    });
  }
  return rows;
}

/** SAMPLE pull rows verbatim from the SAMPLE List (R4-R14, /2 namespace). */
export function samplePalletRows() {
  const rows = [];
  for (let n = 1; n <= SAMPLE.totalPallets; n += 1) {
    rows.push({
      pallet: n,
      text: `${SAMPLE.lotNo}${n}/2`,
      barcode: `*${SAMPLE.lotNo}${n}/2*`,
      cartons: SAMPLE.cartons[n] ?? ADVANCE.cartonsPerPallet,
      category: n === 11 ? "FOR QC" : "Mass Pro",
      tagCategory: SAMPLE.tagCategory[n] ?? null,
    });
  }
  return rows;
}

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    requires: "07-b233-main-sub-assy + 10-b233-japan-1st-obs (shared Lot 260822)",
    physicalFilesCovered: SOURCE_PATHS.length,
    advancePallets: ADVANCE.totalPallets,
    advanceBoxesGross: ADVANCE.totalBoxes,
    advanceShippableNet: ADVANCE.shippableNet,
    samplePallets: SAMPLE.totalPallets,
    sampleBoxes: SAMPLE.totalBoxes,
    sampleStatus: SAMPLE.status,
    duplicateNote: "Copy.xlsx verified identical to Advance (seeds nothing additional)",
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

if (isMainModule("11-b233-japan-advance.seed.ts")) plan({});
