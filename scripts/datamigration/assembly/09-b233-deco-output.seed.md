# 09 — B233 DECO OUTPUT withdrawal monitoring (B233 ... (DECO OUTPUT).xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Assembly/B233 - Dragon Ball Mejirushi Accessory Vol. 4 (DECO OUTPUT).xlsx`
Sheets (13): `01 Hoi-Poi Capsule | 02 Bulma's Bike | 03 Senzu Bean | 04 Master Karin |
05 Great Ape | model 6 | Model 7 | Model 8 | Model 9 | Model 10 | summary | KD parts | Min Set Summary`.

## Sheet inventory

Each model sheet (R1 `Withdrawal Monitoring`, R3 `MODEL <name>`, R4-R7 PMRS block):

| Model sheet | PMRS | Order+SQCI | RQ | Minimum Set | Withdrawal lot columns |
|---|---|---:|---:|---:|---|
| 01 Hoi-Poi Capsule | 133096 | 132720 | 1996 | 83400 | BODY: 260239_1..40+ |
| 02 Bulma's Bike | 133096 | 132720 | 1996 | 83200 | SUNSHADE/MOTOR/CONSOLE: 260239_x + 250934_x |
| 03 Senzu Bean | 133096 | 132720 | 1996 | 99800 | BEAN/BODY: 250934_x + 260239_x |
| 04 Master Karin | 133096 | 132720 | 1996 | 88200 | HEAD&body / LEFT HAND & CRUTCH / TAIL |
| 05 Great Ape | 133096 | 132720 | 1996 | 85600 | HEAD / LOWER MOUTH / BODY / TAIL |
| model 6 .. Model 10 | 88915/0 | 88500/0 | 1339/0 | 0 | empty (placeholders, zero rows) |

`summary` (203 rows): per-model/part PMRS-vs-order-vs-withdrawal-vs-output balance grid
(all Output Qty 0 at capture — withdrawal planned, output not yet recorded).
`KD parts`: empty 23-row template. `Min Set Summary`: minimum-set vs PMRS+RQ
discrepancies per model (01: -51692, 02: -51892, 03: -35292, 04: -46892, 05: -49492).

## PATS mapping

- Deco withdrawal lots (`260239_x`, `250934_x`) -> `Lot` per model/part + `Batch`
  per withdrawal row; PMRS/RQ/order/min-set numbers -> `MaterialRequirement` +
  `PlanDemandAllocation` (model 06-10 placeholders seed NOTHING — empty sheets are
  evidence of unassigned capacity, not zero-demand models).
- `summary` balance grid -> monitoring encode shells (output columns stay null where
  the workbook shows 0/blank at capture — 0 output with 0 withdrawal is "not started",
  not "zero yield").
- Min-Set discrepancies seed as `RoutingViolation`-free notes in `ProcessChangeLog`?
  No — they are plan gaps, recorded in `Pmrs.sourceReference` for planner review.

## Run

```powershell
tsx scripts/datamigration/assembly/09-b233-deco-output.seed.ts        # dry-run plan
```
