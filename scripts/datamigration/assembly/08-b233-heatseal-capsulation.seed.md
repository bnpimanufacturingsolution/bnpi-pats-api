# 08 — B233 HEATSEALING & CAPSULATION (B233 ... ( HEATSEALING & CAPSULATION ).xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 ( HEATSEALING & CAPSULATION ).xlsx`
Sheets (7): `HEAT SEALED OUT (280 scans) | HEAT SEALED IN (282) | CAPSULATION OUT (1436) |
CODE | MAIN ASSY (empty template) | CAPSULATION IN (1536) | summary`.
Item code `B233`. Destination `JAPAN`. Grids are oversized templates (1388/1371/2001/1903
rows) — only barcode rows are scans (verified by parse).

## Sheet inventory

All four movement sheets share header R3:
Destination / DATE / SCAN HERE / ITEM NUMBER / MODEL NUMBER / Lot No. / Qty/box / Qty.

| Sheet | Models | Barcode pattern | Qty | Scans | Scan dates |
|---|---|---|---|---|---|
| HEAT SEALED OUT | 1-5 | `B2330<M>ML<L>1000` e.g. `B23303ML031000` | 1000 | 280 | 2026-06-28 → 2026-07-28 |
| HEAT SEALED IN | 1-5 | same | 1000 | 282 | 2026-06-28 → 2026-07-28 |
| CAPSULATION OUT | 1-5 | `B2330<M>L<L>250` e.g. `B23301L32250` | 250 | 1436 | 2026-06-30 → 2026-07-24 |
| CAPSULATION IN | 1-5 | same | 250 | 1536 | 2026-06-29 → 2026-07-29 |

Notes:

- ITEM NUMBER mixes `B233` / `b233` (lowercase, late rows) — preserved verbatim, canonical upper.
- Duplicate barcodes (double scans, collapse to one Batch on upsert): HEAT SEALED OUT
  `B23304ML131000`x2; HEAT SEALED IN `B23305ML591000`x2, `B23303ML421000`x2;
  CAPSULATION OUT 7 dupes (e.g. `B23303L110250`x2).
- CAPSULATION OUT R482 `B23303ML401000` qty 0 — a heat-seal-format (ML) barcode on the
  capsulation sheet with zero qty. Data-entry error: the loader excludes zero-qty rows.
- CAPSULATION OUT R1388-R1392 `B23304L270251..255` qty 251..255 — running serials where
  qty echoes the barcode suffix (test/adjustment scans). Preserved verbatim.
- Heat-seal lot format `L03`/`L51`/`L71` vs capsulation `01`/`32` — different lot namespaces
  per process, kept distinct (`HS-` vs `CAP-` lot-code prefixes in the seed).
- `MAIN ASSY` in THIS file is an empty template (R3 header, zero scan rows) — do not
  confuse with the populated MAIN ASSY in file 07. `CODE` is empty. `summary` pivot is
  broken (`#VALUE!`) — recorded as unavailable, never re-seeded as transactions.

## PATS mapping

Requires 07 (B233 catalog) first. IN sheets -> `StageEvent` (STAGE_SCAN_RECORDED at
Assembly heat-seal / capsulation sub-stage) + `Batch` per barcode
(`labelPackSize` 1000 heat-seal / 250 capsulation). OUT sheets mirror IN (same barcodes);
the seed upserts one Batch per barcode and two directional StageEvents (IN then OUT).
All 3533 scans parsed at runtime (3534 barcode rows minus the R482 zero-qty exclusion);
SAMPLE_ROWS in the TS keeps the first rows.

## Run

```powershell
tsx scripts/datamigration/assembly/08-b233-heatseal-capsulation.seed.ts        # dry-run plan
```
