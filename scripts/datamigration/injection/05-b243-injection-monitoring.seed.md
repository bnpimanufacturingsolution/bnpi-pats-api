# 05 — B243 injection monitoring (B243 Sanrio Characters Fruits Mejirushi Accessory.xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Injection/B243 Sanrio Characters Fruits Mejirushi Accessory.xlsx`
Sheets (6): `2843315-01 | 2843315-01A | Small Capsule | On Going Qc Monitoring | Output Summary | Capsule`.
Form `BNPI-F-IMS-029-2/-1`. Product `B243 Sanrio Characters Fruits Mejirushi Accessory`.

## Sheet inventory

### 2843315-01 (mold 1, R1-R37)

Header R9: MOLD NO. / MODEL NO.-MODEL NAME / PART NUMBER / PART NAME /
Individual Plan (Japan/Asia/USA/China + 3% NG) / Total Order Qty / Machine Output /
Total Transfer / Remaining Balance / Stock / Discrepancy.

22 parts, 5 models (order qty 145335 each, output 108506):

- Hello Kitty Apple: B243-01-01 Head / 02 Stem / 03 Ribbon / 04 Body / 05 Feet'
- Keroppi Avocado: 06 Head / 07 Stem / 08 Body / 09 Feet
- My Melody Peach: 10 Head / 11 Ribbomn(sic) / 12 Body / 13 Feet
- Kuromi Black Cherry: 14 Head / 15 Stem / 16 Body / 17 Feet
- Pompompurin Pineapple: 18 Head / 19 Face / 20 Stem / 21 Body / 22 Feet

Individual plan per part: Japan 128698 / Asia 6198 / USA 1030 / China 1175 (+3% NG 7728/506).
Transfers/stocks differ per part (see seed TS for the full per-part table; e.g. 01 Head
transfer 108000 / balance 37335, 02 Stem transfer 127000 / balance 18335).

### 2843315-01A (duplicate mold, R1-R37)

Same 22 positions with `A` suffix — BUT the source writes prefix `B224-` (not `B243-`)
for rows 2-22 (only R12 keeps `B243-01-01A`). Order qty 137098, output 113838.
This is a `SOURCE_PREFIX_MISMATCH`: seed preserves raw `B224-01-0xA` and canonical
`B243-01-0xA`, evidence NEEDS_CONFIRMATION. Never silently rewrite.

### Small Capsule

Row R12: mold `PH02-01/02`, part `C002-01-42` O 48 mm Transparent Capsule, plan 1367470,
transfer 420900. Row R16: `PH02-01/03`, `C002-01-43`, transfer 232100. Shared-capsule
family (same `-42` as B251's capsule — shared packaging part, not a copy).

### On Going Qc Monitoring + Output Summary

Per-part Remaining Balance + shift grid (Shift A/B, Jul 25-26 2026 — all actual cells
blank in the capture) and set-quantity snapshots (Jul 23/24). Seed creates the monitoring
shell (lots/batches + empty slots), never fake actuals.

### Capsule (empty template)

All-zero template (no product/part rows). Documents that capsule monitoring had not
started at capture — seed creates nothing from this sheet.

## PATS mapping

Product B243 + 5 Models + 22 ModelParts (+22 `*A` duplicate-mold variants flagged) +
2 capsule parts -> Project (order shots 130057.6) -> Lot per model -> Batches per transfer.
Monitoring sheets -> `MonitoringStationBoard`/`MonitoringDailySheet` shells with null slots.

## Run

```powershell
tsx scripts/datamigration/injection/05-b243-injection-monitoring.seed.ts        # dry-run plan
```
