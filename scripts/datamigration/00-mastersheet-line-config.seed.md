# 00 — Mastersheet line config (BNPI (PATS) Mastersheet.xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/BNPI (PATS) Mastersheet.xlsx`
Sheets: `Sheet1` only, ref `B1:H25`, 73 non-empty cells, 0 formulas.

## Sheet inventory

`Sheet1` columns (R1 header):

| Col | Header | Meaning |
|---|---|---|
| B | Section | Injection / Decoration / Assembly (+ Assortment under Assembly) |
| C | Supervisor/s | Section supervisor (e.g. Decoration: Melroshelle) |
| D | Production Lines | Line count + line labels (Injection: 3 lines; Decoration: 3+8+5+1; Assembly: 10 lines) |
| E | Line Leader/s | Leader per line |
| F | Process | Work process vocabulary per line |
| G | Operators | Operator staffing per process |
| H | Notes | Free text (e.g. scrubber, SB-2A/SB-2B/SB-3-5) |

Verbatim rows (R2-R12, R15-R25):

- Injection: Total 3 lines, Total 5 processes — Line 1 Machine Operator / Line 2 Gate Cutting /
  Line 3 Offline Operator / IQC (Injection QC) / MH (Material Handler). Supervisor cell: `Sheila?`
  (uncertain spelling -> NEEDS_CONFIRMATION).
- Decoration (supervisor Melroshelle, `melroshelle-d@bandainamcoasia.com`): 3 Line Full Spray
  (Manual, Drum, 2 leaders) / 8 Line Line Spray (Mask, 8 leaders) / 5 Lines Tampo (5 leaders) /
  1 Line Mimaki machine printing (1 leader, 4 machines). Total 17 lines / 17 leaders.
- Assembly: 10 lines (Line 1-10), 35-40 operators per line, "processes may vary".
  `Assortment` appears as a row label beside Line 8 (eligibility hint, not a separate section).

## PATS mapping

| Workbook concept | PATS entity | Notes |
|---|---|---|
| Section (Injection/Decoration/Assembly) | `Stage` | System-seed stages; reuse ids from `pats-seed.mjs` when present |
| Process (Machine Operator, Gate Cutting, Full Spray, Mask, Tampo, Mimaki, IQC, MH) | `WorkProcess` under matching `SubStage` | `labelledCycleTimeSec` stays null (no cycle times in source) |
| Production Line (Line 1..N) | `Station` | `stationCode` pattern `ST-<SEC>-<NN>`; displayOrder = line index |
| Booth capacity | `Booth` | Mastersheet gives NO booth rows -> seed creates zero booths; booth detail comes from deco/injection workbooks |
| Supervisor / Leader / Operator names | `Subject` display-name hints only | `Leader 1..N` / `Operator 1..3` are placeholders, NOT real users -> never seed as Subjects |

## Anomalies (stay NEEDS_CONFIRMATION)

- `Sheila?` — trailing question mark = uncertain supervisor spelling.
- `Operato 1` (truncated, missing `r`) in every Injection operator cell.
- Decoration Full Spray "Manual, Drum" vs Mimaki "machine process printing" — two spray
  technologies share one SubStage in the current seed; keep eligible under Decoration only.
- Assortment label placement (Assembly Line 8) suggests Assembly/Warehouse shared eligibility;
  do NOT create a second Assortment stage — use existing `SubStageEligibility`.

## Run

```powershell
tsx scripts/datamigration/00-mastersheet-line-config.seed.ts        # dry-run plan
SEED_MODE=demo tsx scripts/datamigration/00-mastersheet-line-config.seed.ts --write  # gated write
```
