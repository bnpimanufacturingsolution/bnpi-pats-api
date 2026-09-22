# 11 — B233 Japan Advance + sample pull (3 files)

Sources:

- `docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - Japan Advance.xlsx` — advance split, OKAY
- `docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - Japan Advance - Copy.xlsx` — verified row-for-row identical to Advance (duplicate, seeds nothing)
- `docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 - Japan Advance - SAMPLE.xlsx` — sample pull, NOT OKAY (separate dataset below)

Sheets (5 each): `Info | List | 1-4 | 5-8 | 9-12`.

## Advance (main + Copy)

### Info

Same lot `260822`, model `Dragonball4`, Mass Pro — the ADVANCE split:
`DESTINATION JAPAN 300 / FOR QC 10 / TOTAL BOXES 290`. Capacity 30, 9 completed +
20 fractional = 10/11 pallets. (Compare file 10: same lot, 1500/51 — the advance
shipment is a subset carved out of the 1st-OBS lot, not a second lot.)

### List (FG PALLET BARCODE LIST)

11 rows: pallets 1-9 x 30, pallet 10 x 20, pallet 11 x 10 FOR QC. TEXT `260822<n>/11`.
R15 totals 300 boxes gross with `OKAY`.

Info-vs-List rule (holds across all three OBS workbooks): Info TOTAL BOXES is the net
shippable total EXCLUDING the QC pallet (300 − 10 = 290 here; 1500 − 15 = 1485 in
file 10; 2500 − 30 = 2470 in file 12). The List total is the gross including QC.

### 1-4 / 5-8 / 9-12

Same 2-up FG PALLET TAG print format as file 10 (tag `JAPAN ADVANCE` instead of
`1ST OBS`). Print artifacts — skipped by the seed.

## SAMPLE (sample pull, NOT OKAY)

Same lot `260822`, same 11 pallets, but the `/2` barcode namespace:

- Info: `DESTINATION JAPAN 2 / FOR QC 0 / TOTAL BOXES 2` — the 2-carton pull itself.
- List R4-R14: pallets 1-2 x **1** carton, pallets 3-9 x 30, pallet 10 x 20,
  pallet 11 x 10 FOR QC. TEXT `260822<n>/2`. R15: `NOT OKAY`, TOTAL BOXES 242
  (= 1 + 1 + 7×30 + 20 + 10).
- Tag sheet 1-4 carries the sample reasons the List omits: pallet 1
  `SALES/DEVELOPMENT/PROMO/OVERSEAS SALES`, pallet 2 `REPLACEMENT SAMPLE`
  (recorded in the seed as `tagCategory`).

## PATS mapping

Requires 07 + 10. Both datasets reference the SAME Lot `260822` created by seed 10
(no second Lot — a duplicate Lot would double-count). The seed upserts `Batch` rows
keyed by barcode (`.../11` advance, `.../2` sample) with `sourceReference.origin`
`japan-advance` / `japan-advance-sample` so the subset and the pull stay traceable
without forking inventory. The Copy file seeds NOTHING additional (verified identical).

## Run

```powershell
tsx scripts/datamigration/assembly/11-b233-japan-advance.seed.ts        # dry-run plan
```
