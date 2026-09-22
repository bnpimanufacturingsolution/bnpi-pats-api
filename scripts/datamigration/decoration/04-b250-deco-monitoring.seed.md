# 04 — B250 deco monitoring (B250 SHIMAJIROU MEJIRUSHI ACCESSORY.xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Decoration/B250 SHIMAJIROU MEJIRUSHI ACCESSORY.xlsx`
Sheets: `SUMMARY` only, ref `A1:AO1000`. Title R2: `ITEM NAME; SHIMAJIRO MEJIRUSHI ACCESSORY`.

## Sheet inventory

Header R4 (21 tracked columns) + sub-header R5:

| Col | Header | Sample (R6, BODY Shimajiro) |
|---|---|---|
| A/B | Model # / Model Name | 1 / SHIMAJIRO |
| C/D | Parts # / Parts Name | `B250 - 01 - 01` / BODY |
| E-H | PMRS QTY JAPAN/ASIA/CHINA/USA | 62421 / 860 / 496 / (blank) |
| I | PMRS QTY ASSY RQ | 956.655 |
| J | PMRS QTY TOTAL | 64733.655 |
| K | PLAN PER DAY | 3300 |
| L | WITHDRAWAL PLAN | 65690.31 |
| M | DECO WITHDRAWAL (ACC.) | `#ERROR!` (formula, no cache) |
| N | BALANCE IN WHSE (WITHDRAWAL) | `#ERROR!` |
| O | DECO STOCK | `#ERROR!` |
| P-T | FULLSPRAY DRUM (withdrawal/output/WIP/staging/plan) | `#ERROR!` / `#REF!` mix |
| U-... | FULLSPRAY MANUAL (+ delay) | `n/a` for BODY rows, quantities for FEET |

Part rows R6-R12 (7 parts, 5 models — PMRS split identical on every row:
Japan 62421 / Asia 860 / China 496 / USA blank / Assy RQ 956.655 / Total 64733.655;
plan/day 3300, withdrawal plan 65690.31):

| Model | Part | Monitoring cells (verbatim, R6-R12 cols L-W) |
|---|---|---|
| 1 SHIMAJIRO | B250-01-01 BODY | Plan 60000; everything else `#ERROR!`/`#REF!`/`n/a` |
|  | B250-01-02 FEET | Drum withdrawal 84000, drum WIP 0, FS staging 60000, Plan 24000, Delay 84000; both OUTPUT cells `#ERROR!`/`#REF!`; manual `n/a`-family |
| 2 MIMI-LYNNE | B250-01-03 BODY | all `n/a` (no drum/manual tracking for this model) |
| 3 FLAPPIE | B250-01-04 BODY | Plan 60000; rest errors |
|  | B250-01-05 FEET | errors throughout |
| 4 NIKKI | B250-01-06 BODY | Plan 60000; rest errors |
| 5 HANNAH | B250-01-07 BODY | Plan 60000; rest errors |

R13+ empty (1000-row template, only 7 rows used). NOTE: the "Delay 84000" on the FEET
row is transcribed exactly as captured — its business meaning is unresolved
(NEEDS_CONFIRMATION), and no OUTPUT cell in the workbook holds a real number, so the
seed stores nulls everywhere except the PMRS/plan columns.

## PATS mapping

- Product `B250 SHIMAJIROU MEJIRUSHI ACCESSORY` + 5 Models + 7 ModelParts (canonical
  codes `B250-01-01..07`, spaces stripped).
- One `Project` (plan/day 3300, withdrawal plan 65690.31) + `Lot` per model +
  `MaterialRequirement` per part (PMRS TOTAL 64733.655).
- Monitoring encode: `MonitoringDailySheet` for Full Spray Drum/Manual with the
  workbook's real numbers where present (BODY Plan 60000; FEET drum withdrawal 84000,
  staging 60000, Plan 24000) and `null` slots everywhere the workbook shows `#ERROR!`/
  `#REF!`/`n/a` — errors are evidence of unavailable dependencies, not zeros.

## Anomalies

- Every computed column is `#ERROR!`/`#REF!` except the FEET row — the workbook's
  formulas point at an external/unshipped sheet. Seed stores nulls + NEEDS_CONFIRMATION.
- Part codes use spaced form `B250 - 01 - 01`; canonical strips spaces.
- `B250-01-05` name has trailing space (`FEET `).
- USA column blank = zero demand unresolved vs zero; kept null with note.

## Run

```powershell
tsx scripts/datamigration/decoration/04-b250-deco-monitoring.seed.ts        # dry-run plan
```
