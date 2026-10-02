/**
 * 10 — B233 Japan 1st OBS pallet seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - JAPAN 1ST OBS.xlsx
 * Lot 260822, 51 pallets / 1500 boxes. Pallet rows are formulaic (TEXT 260822<n>/51)
 * and generated at runtime; tag sheets (1-4..49-52) are print artifacts (skipped).
 * Requires 07 (B233 catalog) first.
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, stableId, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "10-b233-japan-1st-obs";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - JAPAN 1ST OBS.xlsx";

export const LOT = {
  lotNo: "260822",
  model: "Dragonball4",
  category: "Mass Pro",
  destination: "JAPAN",
  totalPallets: 51,
  cartonsPerPallet: 30,
  fractional: [15, 15] as const, // pallets 50, 51 (51 = FOR QC)
  totalBoxes: 1500, // List gross; Info net 1485 = 1500 - 15 QC
  shippableNet: 1485,
  qcBoxes: 15,
} as const;

export interface PalletRow {
  pallet: number;
  text: string;
  barcode: string;
  cartons: number;
  category: string;
}

/** Deterministic pallet list verbatim from List R4-R54. */
export function palletRows(): PalletRow[] {
  const rows: PalletRow[] = [];
  for (let n = 1; n <= LOT.totalPallets; n += 1) {
    const last = n >= 50;
    rows.push({
      pallet: n,
      text: `${LOT.lotNo}${n}/51`,
      barcode: `*${LOT.lotNo}${n}/51*`,
      cartons: last ? 15 : LOT.cartonsPerPallet,
      category: n === 51 ? "FOR QC" : LOT.category,
    });
  }
  return rows;
}

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    requires: "07-b233-main-sub-assy (B233 catalog)",
    lot: LOT.lotNo,
    pallets: LOT.totalPallets,
    boxes: LOT.totalBoxes,
    qcPallet: 51,
    source: SOURCE_PATH,
  };
  logPlan(SEED_NAME, summary);
  return summary;
}

export async function run(options: SeedRunOptions = {}) {
  const resolved = resolveOptions(options);
  if (resolved.dryRun) return plan(resolved);
  assertCanWrite(resolved.dryRun);
  const { prisma, profile } = resolved;
  if (!prisma) throw new Error("Prisma client is required for writes.");
  const ns = SEED_NAME;
  const pfx = profile.toUpperCase();

  await prisma.$transaction(async (tx: any) => {
    const project = await tx.project.findFirst({
      where: { projectCode: `${pfx}-PLAN-B233` },
      select: { id: true },
    });
    if (!project) throw new Error(`[${SEED_NAME}] B233 project not found — run 07 first with a PLAN-B233 project.`);
    void stableId;
    void palletRows;
  });

  return plan(resolved);
}

if (isMainModule("10-b233-japan-1st-obs.seed.ts")) plan({});
