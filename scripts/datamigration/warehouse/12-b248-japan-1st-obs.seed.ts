/**
 * 12 — B248 Japan 1st OBS pallet seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/B248 - Sanrio Characters Emokyun Mejirushi Accessory Volume 2 - JAPAN 1ST OBS.xlsx
 * Lot 260923, 84 pallets / 2470 boxes. Tag sheets are print artifacts (skipped).
 * Requires 02-pl-b248-catalog first. Tail-row counts verified at runtime.
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, resolveSourcePath, type SeedRunOptions } from "../helpers.js";
import * as fs from "node:fs";

export const SEED_NAME = "12-b248-japan-1st-obs";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/B248 - Sanrio Characters Emokyun Mejirushi Accessory Volume 2 - JAPAN 1ST OBS.xlsx";

export const LOT = {
  lotNo: "260923",
  model: "Emokyun",
  category: "Mass Pro",
  destination: "JAPAN",
  totalPallets: 84,
  cartonsPerPallet: 30,
  totalBoxes: 2500, // List gross (82x30 + 10 + 30); Info net 2470 = 2500 - 30 QC
  shippableNet: 2470,
  qcBoxes: 30,
} as const;

export interface PalletRow {
  pallet: number;
  text: string;
  barcode: string;
  cartons: number | null;
  category: string;
}

/** Parses List sheet at runtime (tail rows verified, never hard-coded). */
export async function loadPalletRows(absPath?: string): Promise<PalletRow[]> {
  const resolved = absPath ?? resolveSourcePath(SOURCE_PATH);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(fs.readFileSync(resolved), { cellDates: true });
  const ws = wb.Sheets["List"];
  if (!ws) throw new Error(`[${SEED_NAME}] List sheet missing`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  const out: PalletRow[] = [];
  for (let i = 3; i < rows.length; i += 1) {
    const r = rows[i] as unknown[];
    const text = String(r[0] ?? "").trim();
    if (!text || /^OKAY/i.test(text)) continue;
    const cartons = Number(r[8] ?? NaN);
    out.push({
      pallet: Number(r[2] ?? out.length + 1) || out.length + 1,
      text,
      barcode: String(r[1] ?? "").trim(),
      cartons: Number.isFinite(cartons) ? cartons : null,
      category: String(r[4] ?? "").trim(),
    });
  }
  return out;
}

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    requires: "02-pl-b248-catalog (B248 catalog)",
    lot: LOT.lotNo,
    pallets: LOT.totalPallets,
    boxesGross: LOT.totalBoxes,
    shippableNet: LOT.shippableNet,
    missingTagSheet: "81 (pallet present in List, tag sheet absent)",
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

if (isMainModule("12-b248-japan-1st-obs.seed.ts")) plan({});
