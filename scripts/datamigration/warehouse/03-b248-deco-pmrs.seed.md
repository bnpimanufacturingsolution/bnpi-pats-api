# 03 — B248 DECO PMRS (B248_DECO_PMRS.xlsx, 21 sheets)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/B248_DECO_PMRS.xlsx`
(+ identical `From Client/` copy). 21 sheets, form `BNPI-F-PCS-015-O`.

## Sheet inventory

PMRS control sheets (Decoration Production Material Requisition), each R11 header
`No. / PART NO. / PART NAME / DESCRIPTION / USAGE / UNIT / Order Qty / ISSUED / BALANCE / REMARKS`:

| Sheet (control no.) | Date | Lot Qty | Per-part qty | Note |
|---|---|---:|---:|---|
| B248-002J-00 (260923-DECO-002J/00) | 04-24-2026 | 601820 | 120364 | Rev.00 initial 600K |
| B248-002J-01 (260923-DECO-002J/01) | 05-08-2026 | 1410675 | 282135 (issued 120364, bal 161771) | Rev.01 final 1.4M |
| B248-002A-00 (260864-DECO-002A/00) | 05-08-2026 | 77060 | 15412 | Final Asia 76.8K |
| B248-002A-01 (260864-DECO-002A/01) | 06-22-2026 | 77060 | 15572 (issued 15412, bal 160) | Revised final Asia 77.6K |
| B248-002U-00 (260865-DECO-002U/00) | 05-08-2026 | 10300 | 2060 | Final USA 10.2K |
| B248-002C-00 (260866-DECO-002C/00) | 05-08-2026 | 6955 | 1391 | Final China 6.8K |
| B248-003J-00 (550532-DECO-003J/00) | 05-30-2026 | 1410675 | 8464 | 3% NG replacement |
| B248-003J-01 (550533-DECO-003J/01) | 05-30-2026 | 1410675 | 9030 (issued 8464, bal 566) | 3% NG replacement rev.01 |

Each sheet lists the same 16 inj parts (`B248-01-01..08`, `B248-02-01..08` with names
from PL B248) at usage 1 pc. Lot qty = 5 models x per-part qty (e.g. 5 x 120364 = 601820).

Order-summary sheets (each pairs with the control above): `600k - half forecast`
(total 601820) / `1.4M - Final Japan` (1410675) / `76.8k - final asia` (77060) /
`77.6k - revised final asia` (77860) / `10.2k - final usa` (10300) /
`6.8k - final china` (6955). Columns: ITEMS / DESCRIPTION / QTY / 01..05 model split
(Hello Kitty/Pompompurin/Kurousa/Shirousa/Kuririn) / # boxes / w-MB / w-Capsule.
Pack rule: 40/bag, 200/ctn throughout.

Reference sheet `Inj` is a copy of the PL B248 Inj tab (molds 2849226-01/02 + capsule
`C002-01-50` transparent — note suffix `-50` vs PL `-25`; preserved verbatim).

Cross-product sheets (same workbook, different products — seed as NEEDS_CONFIRMATION
stubs only, full catalog deferred): `Asia` (A402 HUGCOT SANRIO 3) / `25.5K`
(A301 DRAGON BALL UDM BEST 28) / `A267-002A-00`, `32.4K`, `A267-003J-00`,
`A267-003J-01` (A267). Their adhesive/packaging rows (C-018, PB-021, CB-402, MB-402...)
are packaging evidence, not B248 BOM.

## PATS mapping

| Source | Entity |
|---|---|
| Control sheet header (control no., date, lot qty) | `Pmrs` (one per control no., `externalControlNumber`, `revisionLabel` Rev.00/01) |
| Per-part Order/Issued/Balance row | `MaterialRequirement` (qty, uom `piece`, status APPROVED) + `InventoryTransaction` skeleton on write (ISSUANCE planned, actual null) |
| Order-summary model split (01..05) | `PlanDemandAllocation` per model (marketRegion JP/ASIA/USA/CN, demandPurpose production) |
| Cross-product sheets | `Product` stub only (`A402`, `A301`, `A267`, evidence NEEDS_CONFIRMATION) |

Sign-off block per sheet (Prepared Aubrey Yasmin Ayop / Checked Mark Joseph De Jesus /
Approved Marilyn Duatin / Received Decoration Ma. Cristina Plata / Warehouse Jonathan
Cabahug) is recorded in `Pmrs.sourceReference`, never as Subjects.

## Run

```powershell
tsx scripts/datamigration/warehouse/03-b248-deco-pmrs.seed.ts        # dry-run plan
SEED_MODE=demo tsx scripts/datamigration/warehouse/03-b248-deco-pmrs.seed.ts --write  # gated write
```
