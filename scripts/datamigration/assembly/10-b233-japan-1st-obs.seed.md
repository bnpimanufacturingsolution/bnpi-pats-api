# 10 — B233 JAPAN 1ST OBS pallets (B233 ... - JAPAN 1ST OBS.xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - JAPAN 1ST OBS.xlsx`
Sheets (15): `Info | List (55 rows) | 1-4 | 5-8 | 9-12 | 13-16 | 17-20 | 21-24 |
25-28 | 29-32 | 33-36 | 37-40 | 41-44 | 45-48 | 49-52`.

## Sheet inventory

### Info

Product `B233 - Dragon Ball Mejirushi Accessory Vol. 4`, lot `260822`, model
`Dragonball4`, Mass Pro, destination JAPAN 1500 + QC 15 = 1485 net boxes... precisely:
`DESTINATION JAPAN 1500 / FOR QC 15 / TOTAL BOXES 1485`. Pallet capacity 30,
49 completed + 15 fractional = 50/51 pallets.

### List (FG PALLET BARCODE LIST, BNPI-F-ASS-024-2)

Header R3: TEXT / BARCODE / PALLET# / MODEL / Category / Lot No. / DESTINATION /
TOTAL PALLET / # OF CARTONS (+ Received/Loaded tracking, all blank at capture).

51 rows R4-R54: pallets 1-49 x 30 cartons, pallet 50 x 15, pallet 51 x 15 FOR QC.
TEXT `260822<n>/51`, BARCODE `*260822<n>/51*`. R55 totals: 1500 boxes.
Rows are verbatim-generatable: pallet n -> TEXT `260822{n}/51`.

### 1-4 .. 49-52 (FG PALLET TAG, BNPI-F-ASS-022-2)

Printable 2-up pallet tags (4 pallets per sheet): MODEL / Lot NO. / DESTINATION /
PALLET# / TOTAL PALLET / cartons / JAPAN / 1ST OBS. No new data beyond List —
seed skips tag sheets (print artifacts, not ledger).

## PATS mapping

Requires 07. Lot `260822` -> `Lot` (labelPackSize 30, requiredProductionQuantity 1485
+ 15 QC) + 51 `Batch` rows (`barcodeValue` = TEXT, `plannedQuantity` = cartons).
Received/Loaded columns blank -> no `StageEvent` beyond lot creation; QC pallet 51 ->
`QualityInspection` OPEN shell, never a PASSED decision.

## Run

```powershell
tsx scripts/datamigration/assembly/10-b233-japan-1st-obs.seed.ts        # dry-run plan
```
