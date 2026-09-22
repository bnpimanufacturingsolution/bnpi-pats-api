# PATS data migration seeds (Excel -> PATS, ready-to-run, NOT executed)

Source workbooks live outside the repo under:

- `docs/REPORTS/MANUFACTURING DOCUMENTS/` (Assembly / Decoration / Injection / Warehouse + Mastersheet)
- `docs/REPORTS/PRODUCTION AND ASSEMBLY/Document/From Client/`

This folder contains **one runnable seed (`.seed.ts`) + one structure doc (`.seed.md`) per
logical workbook**, plus shared `helpers.ts` and a `run-all.ts` orchestrator.
Seeds live in subfolders mirroring the workbook source folders (`assembly/`,
`decoration/`, `injection/`, `warehouse/`); `00` (Mastersheet, from the
`MANUFACTURING DOCUMENTS` root) and `01` (From Client) stay at this level.
Nothing here runs on import. Every seed defaults to `dryRun: true` (plan only, zero writes).

## Safety

- Do NOT run against production. Seeds refuse to write unless BOTH hold:
  1. `SEED_MODE=demo|uat` is set, AND
  2. the caller passes `{ dryRun: false }`.
- Default invocation only prints the plan: `tsx scripts/datamigration/<file>.seed.ts`
- Real write (gated): `SEED_MODE=demo PATS_DATABASE_URL=... tsx scripts/datamigration/<file>.seed.ts --write`
- All writes are idempotent upserts with deterministic `stableId(namespace, profile, key)`.
- No fake data: quantities / codes / names come from the workbook cells quoted in each
  `.seed.md`. Empty monitoring cells stay `null` (never zero-filled). Formula errors
  (`#REF!`, `#ERROR!`) are recorded as `NEEDS_CONFIRMATION`, never silently dropped.

## Physical file -> seed module map

| # | Physical workbook(s) | Seed module | PATS target |
|---|---|---|---|
| 00 | `MANUFACTURING DOCUMENTS/BNPI (PATS) Mastersheet.xlsx` (Sheet1) | `00-mastersheet-line-config.seed.ts` | Station / WorkProcess / Booth line config (factory vocabulary) |
| 01 | `From Client/PL B251 Machibouke Hamburger Shop 3 (Rev 6.0).xlsx` | `01-pl-b251-catalog.seed.ts` | Thin wrapper over canonical `scripts/pats-seed-client-b251.mjs` (already the demo catalog) |
| 02 | `Warehouse/PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx` (+ identical `From Client/` copy) | `warehouse/02-pl-b248-catalog.seed.ts` | Product B248 + 5 Models + 16 inj ModelParts + deco/paint + capsule + Assy packaging |
| 03 | `Warehouse/B248_DECO_PMRS.xlsx` (+ identical `From Client/` copy, 21 sheets) | `warehouse/03-b248-deco-pmrs.seed.ts` | Pmrs + MaterialRequirement + PlanDemandAllocation per control no. (JP/ASIA/USA/CN + NG replacement) |
| 04 | `Decoration/B250 SHIMAJIROU MEJIRUSHI ACCESSORY.xlsx` (SUMMARY) | `decoration/04-b250-deco-monitoring.seed.ts` | Product B250 (5 models, 7 parts) + plan/lot skeleton + deco withdrawal monitoring encode |
| 05 | `Injection/B243 Sanrio Characters Fruits Mejirushi Accessory.xlsx` (6 sheets) | `injection/05-b243-injection-monitoring.seed.ts` | Product B243 (5 models, 22 parts + 22 duplicate-mold `*A` variants with `B224-` prefix anomaly) + mold output monitoring |
| 06 | `Injection/B308 Mobile Suit Gundam Narabundesu Narikiri Haro.xlsx` (4 sheets) | `injection/06-b308-injection-monitoring.seed.ts` | Product B308 (5 character groups, 31 parts across molds 2867508-01/-02) + output monitoring |
| 07 | `Assembly/B233 ... ( MAIN ASSY & SUB ASSY).xlsx` (SUB ASSY + MAIN ASSY + CODE + summary) | `assembly/07-b233-main-sub-assy.seed.ts` | Assembly scan log: SUB models `01S/04S`, MAIN models `01M-05M`, barcode `B233…SL…/ML…`, 1000 pcs/box |
| 08 | `Assembly/B233 ... ( HEATSEALING & CAPSULATION ).xlsx` (7 sheets) | `assembly/08-b233-heatseal-capsulation.seed.ts` | Heat-seal IN/OUT (1000 pcs) + Capsulation IN/OUT (250 pcs), models 1-5 |
| 09 | `Assembly/B233 ... (DECO OUTPUT).xlsx` (13 sheets) | `assembly/09-b233-deco-output.seed.ts` | Deco withdrawal monitoring per Dragon Ball model (01-05 active, 06-10 empty placeholders) + summary/KD/Min-Set |
| 10 | `Assembly/B233 ... - JAPAN 1ST OBS.xlsx` (Info + List + 13 pallet-tag sheets) | `assembly/10-b233-japan-1st-obs.seed.ts` | FG pallet list lot `260822`, 51 pallets / 1500 boxes (Mass Pro + QC) |
| 11 | `Assembly/B233 ... - Japan Advance.xlsx` + `... - Copy.xlsx` (identical, verified) + `... - SAMPLE.xlsx` (sample pull, NOT OKAY) | `assembly/11-b233-japan-advance.seed.ts` | FG pallet list lot `260822`: advance 11 pallets / 300 gross (OKAY) + sample pull 11 pallets / 242 (NOT OKAY). Copy seeds nothing |
| 12 | `Warehouse/B248 - Sanrio Characters Emokyun ... - JAPAN 1ST OBS.xlsx` (Info + List + 21 pallet-tag sheets) | `warehouse/12-b248-japan-1st-obs.seed.ts` | FG pallet list lot `260923`, 84 pallets / 2470 boxes |

PDFs (`.../Warehouse/*.pdf`, `.../From Client/*.pdf`) are intentionally out of scope (Excel-only task).

## How each seed is structured

Each `.seed.ts`:

1. Header comment: source path, sheet inventory, row counts, evidence status.
2. `SOURCE_*` constants: absolute-ish repo-relative source path + sheet names + column map.
3. `SAMPLE_ROWS`: first 3-5 verbatim rows from the workbook (review evidence without opening Excel).
4. `DATA` arrays: full structured extraction for small workbooks (catalog/PMRS), or a
   `loadWorkbookRows()` streaming parser for large scan logs (1000+ rows stay on disk).
5. `plan()` (dry-run): counts Products/Models/Parts/Lots/Batches that WOULD be upserted.
6. `run()` (gated write): Prisma `$transaction` with upserts only. Never `deleteMany`
   (unlike `pats-seed.mjs` fresh-reset, which these seeds never invoke).

Each `.seed.md`: sheet-by-sheet column inventory, PATS entity mapping, anomalies that must
stay `NEEDS_CONFIRMATION`, and the exact run command.

## Run order (when migration is eventually approved)

1. `00` line config (stations/processes/booths must exist first)
2. `01`, `02`, `04`, `05`, `06` catalogs (+ `09` B233 minimal catalog if B233 has no PL)
3. `03` PMRS/requirements (needs catalog part ids)
4. `07`, `08`, `09`, `10`, `11`, `12` execution/monitoring (needs lots/batches)

Orchestrator `run-all.ts` prints this plan in order; with `--write` it runs each step
transactionally in the same order (still gated by SEED_MODE + PATS_DATABASE_URL).

## Verification (no writes)

```powershell
# from bnpi-pats-api/
npx tsc --noEmit scripts/datamigration/helpers.ts scripts/datamigration/run-all.ts
tsx scripts/datamigration/warehouse/02-pl-b248-catalog.seed.ts
tsx scripts/datamigration/run-all.ts
```
