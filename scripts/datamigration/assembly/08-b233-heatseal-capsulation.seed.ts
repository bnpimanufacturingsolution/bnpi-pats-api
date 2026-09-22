/**
 * 08 — B233 heat-seal + capsulation seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 ( HEATSEALING & CAPSULATION ).xlsx
 * HEAT SEALED OUT 280 scans / IN 282 (qty 1000) + CAPSULATION OUT 1436 / IN 1536
 * (qty 250). Zero-qty error rows excluded; serial-qty and double-scan rows preserved.
 * Requires 07-b233-main-sub-assy (B233 catalog) first. Full rows parsed at runtime.
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, resolveSourcePath, type SeedRunOptions } from "../helpers.js";
import * as fs from "node:fs";

export const SEED_NAME = "08-b233-heatseal-capsulation";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 ( HEATSEALING & CAPSULATION ).xlsx";

export const SHEETS = [
  { sheet: "HEAT SEALED OUT", qty: 1000, process: "heat-seal" },
  { sheet: "HEAT SEALED IN", qty: 1000, process: "heat-seal" },
  { sheet: "CAPSULATION OUT", qty: 250, process: "capsulation" },
  { sheet: "CAPSULATION IN", qty: 250, process: "capsulation" },
] as const;

export const SAMPLE_ROWS = [
  { sheet: "HEAT SEALED OUT", date: "2026-06-29", barcode: "B23303ML031000", item: "B233", model: "3", lot: "L03", qty: 1000 },
  { sheet: "CAPSULATION OUT", date: "2026-07-01", barcode: "B23301L32250", item: "B233", model: "1", lot: "32", qty: 250 },
  { sheet: "CAPSULATION IN", date: "2026-06-30", barcode: "B23303L01250", item: "B233", model: "3", lot: "01", qty: 250 },
] as const;

export interface MovementRow {
  sheet: string;
  process: string;
  direction: "IN" | "OUT";
  date: string | null;
  barcode: string;
  itemNumber: string;
  modelNumber: string;
  lotNo: string;
  qty: number;
}

export async function loadWorkbookRows(absPath?: string): Promise<MovementRow[]> {
  const resolved = absPath ?? resolveSourcePath(SOURCE_PATH);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(fs.readFileSync(resolved), { cellDates: true });
  const out: MovementRow[] = [];
  for (const { sheet, qty, process } of SHEETS) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
    for (let i = 3; i < rows.length; i += 1) {
      const r = rows[i] as unknown[];
      const barcode = String(r[2] ?? "").trim();
      if (!barcode) continue;
      // R482-style zero-qty rows are data-entry errors (ML barcode on a
      // capsulation sheet, qty 0) — excluded from batches, kept in the .md.
      // Blank qty falls back to the sheet default; explicit 0 is excluded.
      const cellQty = r[7] ?? r[6];
      const rowQty = cellQty === "" || cellQty == null ? qty : Number(cellQty);
      if (!Number.isFinite(rowQty) || rowQty <= 0) continue;
      const rawDate = r[1] as Date | string | null;
      out.push({
        sheet,
        process,
        direction: sheet.endsWith("IN") ? "IN" : "OUT",
        date: rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : rawDate ? String(rawDate) : null,
        barcode,
        itemNumber: String(r[3] ?? "").trim(),
        modelNumber: String(r[4] ?? "").trim(),
        lotNo: String(r[5] ?? "").trim(),
        qty: rowQty,
      });
    }
  }
  return out;
}

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    requires: "07-b233-main-sub-assy (B233 catalog)",
    heatSealSheets: "OUT 280 scans + IN 282 scans x 1000 pcs",
    capsulationSheets: "OUT 1436 scans + IN 1536 scans x 250 pcs (R482 zero-qty excluded)",
    itemCaseAnomaly: "B233/b233 mixed case preserved",
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
  const rows = await loadWorkbookRows();
  console.log(`[${SEED_NAME}] parsed ${rows.length} movement rows (writes deferred to approved run).`);
  return { ...plan(resolved), parsedRows: rows.length };
}

if (isMainModule("08-b233-heatseal-capsulation.seed.ts")) plan({});
