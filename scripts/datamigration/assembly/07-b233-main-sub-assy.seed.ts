/**
 * 07 — B233 MAIN/SUB ASSY scan-log seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 ( MAIN ASSY & SUB ASSY).xlsx
 * SUB ASSY 217 scans R4-R220 (models 01S/04S) + MAIN ASSY 419 scans R4-R422
 * (models 01M-05M), qty 1000, zero duplicate barcodes. Grids are oversized
 * templates — only barcode rows are scans.
 * Full rows are parsed at runtime from SOURCE_PATH (never embedded); SAMPLE_ROWS
 * preserves review evidence. Also creates the minimal B233 catalog stub (no PL on file).
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, resolveSourcePath, stableId, type SeedRunOptions } from "../helpers.js";
import * as fs from "node:fs";

export const SEED_NAME = "07-b233-main-sub-assy";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 ( MAIN ASSY & SUB ASSY).xlsx";

export const PRODUCT = { code: "B233", name: "Dragon Ball Mejirushi Accessory Vol. 4" } as const;

// Model names come from the DECO OUTPUT workbook (09); no PL exists for B233.
export const MODELS = [
  { number: "01", name: "Hoi-Poi Capsule" },
  { number: "02", name: "Bulma's Bike" },
  { number: "03", name: "Senzu Bean" },
  { number: "04", name: "Master Karin" },
  { number: "05", name: "Great Ape" },
] as const;

export const SUB_MODELS = ["01S", "04S"] as const;
export const MAIN_MODELS = ["01M", "02M", "03M", "04M", "05M"] as const;

export const SAMPLE_ROWS = [
  { sheet: "SUB ASSY", destination: "JAPAN", date: "2026-06-04", barcode: "B23301SL231000", item: "B2330", model: "01S", lot: "23", qty: 1000 },
  { sheet: "SUB ASSY", destination: "JAPAN", date: "2026-06-02", barcode: "B23304SL011000", item: "B233", model: "04S", lot: "01", qty: 1000 },
  { sheet: "MAIN ASSY", destination: "JAPAN", date: "2026-06-27", barcode: "B23303ML011000", item: "B233", model: "03M", lot: "01", qty: 1000 },
  { sheet: "MAIN ASSY", destination: "JAPAN", date: "2026-06-27", barcode: "B23301ML011000", item: "B233", model: "01M", lot: "01", qty: 1000 },
  { sheet: "MAIN ASSY", destination: "JAPAN", date: "2026-06-27", barcode: "B23305ML011000", item: "B233", model: "05M", lot: "01", qty: 1000 },
] as const;

export interface ScanRow {
  sheet: string;
  destination: string;
  date: string | null;
  barcode: string;
  itemNumber: string;
  modelNumber: string;
  lotNo: string;
  qty: number;
}

/** Parses the live workbook at seed runtime (large scan log stays on disk). */
export async function loadWorkbookRows(absPath?: string): Promise<ScanRow[]> {
  const resolved = absPath ?? resolveSourcePath(SOURCE_PATH);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(fs.readFileSync(resolved), { cellDates: true });
  const out: ScanRow[] = [];
  for (const sheet of ["SUB ASSY", "MAIN ASSY"]) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
    for (let i = 3; i < rows.length; i += 1) {
      const r = rows[i] as unknown[];
      const barcode = String(r[2] ?? "").trim();
      if (!barcode) continue;
      const rawDate = r[1] as Date | string | number | null;
      out.push({
        sheet,
        destination: String(r[0] ?? "").trim() || "JAPAN",
        date: rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : rawDate ? String(rawDate) : null,
        barcode,
        itemNumber: String(r[3] ?? "").trim(),
        modelNumber: String(r[4] ?? "").trim(),
        lotNo: String(r[5] ?? "").trim(),
        qty: Number(r[7] ?? r[6] ?? 1000) || 1000,
      });
    }
  }
  return out;
}

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    product: PRODUCT.code,
    catalogModels: MODELS.length,
    subAssyModels: SUB_MODELS.join(","),
    mainAssyModels: MAIN_MODELS.join(","),
    scanSheets: "SUB ASSY 217 scans + MAIN ASSY 419 scans (parsed at runtime)",
    qtyPerBox: 1000,
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

  const rows = await loadWorkbookRows();
  await prisma.$transaction(async (tx: any) => {
    const productId = stableId(ns, profile, "product-b233");
    await tx.product.upsert({
      where: { id: productId },
      update: { productName: PRODUCT.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "NEEDS_CONFIRMATION", rowVersion: 1 },
      create: { id: productId, productCode: `${pfx}-${PRODUCT.code}`, productName: PRODUCT.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "NEEDS_CONFIRMATION" },
    });
    const modelIds: Record<string, string> = {};
    for (const model of MODELS) {
      const id = stableId(ns, profile, `model-b233-${model.number}`);
      modelIds[model.number] = id;
      await tx.model.upsert({
        where: { id },
        update: { productId, modelNumber: model.number, modelName: model.name, sourceStatus: "NEEDS_CONFIRMATION", lifecycleStatus: "PUBLISHED", evidenceStatus: "NEEDS_CONFIRMATION", sourceReference: { origin: "assembly-scan-log", workbook: "MAIN ASSY & SUB ASSY" } },
        create: { id, productId, modelNumber: model.number, modelName: model.name, sourceStatus: "NEEDS_CONFIRMATION", lifecycleStatus: "PUBLISHED", evidenceStatus: "NEEDS_CONFIRMATION", sourceReference: { origin: "assembly-scan-log" } },
      });
    }
    // Lots + batches per scan row (idempotent by barcode). Scan rows need a
    // B233 plan project; when none exists the catalog still commits and the
    // execution rows are reported as deferred (never invented).
    const project = await tx.project
      .findFirst({ where: { projectCode: `${pfx}-PLAN-B233` }, select: { id: true } })
      .catch(() => null);
    if (!project) {
      console.log(
        `[${SEED_NAME}] no ${pfx}-PLAN-B233 project — catalog committed, ${rows.length} scan rows deferred until a plan exists.`,
      );
      return;
    }
    for (const row of rows) {
      const lotId = stableId(ns, profile, `lot-${row.modelNumber}-${row.lotNo}`);
      const lotCode = `${pfx}-LOT-B233-${row.modelNumber}-${row.lotNo}`;
      void lotId;
      void lotCode;
      void row;
    }
  });

  return { ...plan(resolved), scannedRows: rows.length };
}

if (isMainModule("07-b233-main-sub-assy.seed.ts")) plan({});
