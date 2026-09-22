# 07 — B233 MAIN/SUB ASSY scan log (B233 ... ( MAIN ASSY & SUB ASSY).xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 ( MAIN ASSY & SUB ASSY).xlsx`
Sheets: `CODE | SUB ASSY (grid 1392, 217 scans R4-R220) | MAIN ASSY (grid 1397, 419 scans R4-R422) | summary`.
Item code `B233`. Destination `JAPAN` throughout. Grids are oversized templates — only
rows with a SCAN HERE barcode are scans (verified by parse: 217 + 419, zero duplicate
barcodes in either sheet).

## Sheet inventory

### CODE (A1:E1000)

Empty template (`CODE / MODEL NAME / LAST LOT / BROKEN LOT`, all blank). No seed rows.

### SUB ASSY (A1:AB1392)

Header R3: Destination / DATE / SCAN HERE (barcode) / ITEM NUMBER / MODEL NUMBER /
Lot No. / Qty/box / Qty.

- Distinct MODEL NUMBER: `01S`, `04S` only (2 sub-assembly models).
- ITEM NUMBER: `B2330` (01S rows) / `B233` (04S rows) — preserved verbatim.
- Barcode pattern: `B23301SL<LL>1000` (01S) / `B23304SL<LL>1000` (04S), LL = 2-digit lot.
- Qty/box = Qty = 1000 on every row. Scan dates 2026-06-01 → 2026-07-29 (217 scans).
- Sample R4: `JAPAN | 2026-06-04 | B23301SL231000 | B2330 | 01S | 23 | 1000 | 1000`.

### MAIN ASSY (A1:AB1397)

Same header. Distinct MODEL NUMBER: `01M, 02M, 03M, 04M, 05M` (5 main models).
Barcode pattern: `B233<MM>ML<LL>1000` (MM = 01-05 without letter in barcode body,
e.g. `B23303ML011000` = model 03M lot 01). Qty 1000. Scan dates 2026-06-26 → 2026-07-29
(419 scans, zero duplicate barcodes in either sheet).
Sample R4: `JAPAN | 2026-06-27 | B23303ML011000 | B233 | 03M | 01 | 1000 | 1000`.

### summary (B1:AW1000)

Two pivot blocks: SUB ASSY daily totals per MODEL NUMBER x DATE, MAIN ASSEMBLY daily
totals per MODEL NUMBER x DATE. NOTE: the SUB pivot grand total (44000) does NOT match
the scan rows (217000) — the pivot is stale/unrefreshed (or filtered) at capture.
Scans are the ledger; the pivot is evidence only and is never re-seeded.

## PATS mapping

This seed also creates the minimal B233 catalog stub (no PL exists for B233 in the
provided files): Product `B233 Dragon Ball Mejirushi Accessory Vol. 4` + 5 Models
(01 Hoi-Poi Capsule, 02 Bulma's Bike, 03 Senzu Bean, 04 Master Karin, 05 Great Ape —
names from the DECO OUTPUT workbook) with evidence NEEDS_CONFIRMATION, plus sub-model
tags `01S/04S` (Sub-Assembly) and `01M-05M` (Main Assembly) recorded in
`ModelPart.sourceReference`/routing, not as separate Models.

Scan rows -> `Lot` (per MODEL NUMBER + Lot No.) + `Batch` (`barcodeValue` = SCAN HERE,
`plannedQuantity` = Qty, `labelPackSize` = Qty/box) + `StageEvent` (STAGE_SCAN_RECORDED
at Assembly/Sub-Assembly). All 636 scans are parsed at runtime from SOURCE_PATH;
SAMPLE_ROWS in the TS preserves the first rows for review. No rows are embedded in full.

## Run

```powershell
tsx scripts/datamigration/assembly/07-b233-main-sub-assy.seed.ts        # dry-run plan
```
