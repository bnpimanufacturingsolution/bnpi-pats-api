# 12 — B248 JAPAN 1ST OBS pallets (B248 ... - JAPAN 1ST OBS.xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/B248 - Sanrio Characters Emokyun Mejirushi Accessory Volume 2 - JAPAN 1ST OBS.xlsx`
Sheets (23): `Info | List (88 rows) | 1-4 | 5-8 | ... | 77-80 | 82-84` (21 pallet-tag sheets).

## Sheet inventory

### Info

Product `B248 - Sanrio Characters Emokyun Mejirushi Accessory Volume 2`, lot `260923`,
model `Emokyun`, Mass Pro, destination JAPAN 2500 + QC 30 = 2470 net boxes.
Pallet capacity 30, 82 completed + 10 fractional = 83/84 pallets.

Info-vs-List rule (same as the B233 OBS files): Info TOTAL BOXES is net shippable
excluding the QC pallet (2500 − 30 = 2470); the List total is the gross including QC.

### List (FG PALLET BARCODE LIST, BNPI-F-ASS-024-2)

88 rows R4-R87: pallets 1-82 x 30 cartons, pallet 83 x 10, pallet 84 x 30 FOR QC
(verified tail: `26092383/84` x10 Mass Pro, `26092384/84` x30 FOR QC; gross 2500).
TEXT `260923<n>/84`, BARCODE `*260923<n>/84*`. (Final per-pallet counts verified at
migration runtime via `loadWorkbookRows()` — the seed never hard-codes the tail rows.)

### 1-4 .. 82-84 (FG PALLET TAG, BNPI-F-ASS-022-2)

Same 2-up print format as B233 OBS (tag `1ST OBS`). Print artifacts — skipped.
Note the jump `77-80 -> 82-84` (sheet `81` absent in source; pallet 81 still listed in
List — the tag sheet is missing, not the pallet).

## PATS mapping

Requires 02 (B248 catalog) + 03 (PMRS lot 601820/1410675 context — OBS lot `260923`
is the FG lot, distinct from DECO requisition lots). Lot `260923` -> `Lot`
(labelPackSize 30) + 84 `Batch` rows + QC pallet 84 -> `QualityInspection` OPEN shell.

## Run

```powershell
tsx scripts/datamigration/warehouse/12-b248-japan-1st-obs.seed.ts        # dry-run plan
```
