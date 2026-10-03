# 01 — PL B251 catalog (PL B251 Machibouke Hamburger Shop 3 Rev 6.0)

Source: `docs/REPORTS/PRODUCTION AND ASSEMBLY/Document/From Client/PL B251 Machibouke Hamburger Shop 3 (Rev 6.0).xlsx`
Sheets: `Partslist | Inj | Inj Shot | Deco | Assy` (same 5-tab family as PL B248).
Form code: `BNPI-F-PES-018-1` (stamped on all 5 sheets: Partslist R58, Inj R35,
Inj Shot R33, Deco R77, Assy R46). Partslist R5: product `B251 Machibouke Hamburger
Shop 3`, `All Models`, page `1/5`.

Revision history, Partslist R51-R57 (verbatim):

| Rev | Date | Change | Prepared | Checked | Approved |
|---|---|---|---|---|---|
| Ø | --- | Initial Release | C. Motilla | H. Tanaka | H. Ryou |
| 1 | 2026-04-15 | Updated Assy Parts List | A. Marquez | M. Andal | H. Ryou |
| 2 | 2026-04-16 | Updated Inj Parts List | V. Yanga | M. Andal | H. Ryou |
| 3 | 2026-04-27 | Updated Assy Parts List | V. Yanga | M. Andal | H. Ryou |
| 4 | 2026-04-29 | Updated Assy Parts List (Minibook & Carton Box) | V. Yanga | M. Andal | H. Ryou |
| 5 | 2026-05-06 | Updated Paint Color (Deco Partslist - Model 2) | J. Sadiwa | M. Andal | H. Ryou |
| 6 | 2026-05-12 | Updated Assy Parts List (Missing Part) | V. Yanga | M. Andal | H. Ryou |

Current rev 6 matches the filename (`Rev 6.0`) and the canonical fragment (`Rev. 6.0`).
No tray-quantity cell exists in this workbook — the 240 tray standard lives only in
the canonical fragment and is therefore NOT asserted by this seed.

## Why this seed is a thin wrapper

The canonical B251 catalog is already seeded from client evidence in
`scripts/pats-seed-client-b251.mjs` (`CLIENT_B251`: 6 models, 24 inj parts `B251-01-01..24`,
deco `*S/*ST` variants, 22 paint nos `PN-B251-*`, shared capsule `C002-01-42`) and applied by
`scripts/pats-seed.mjs`. Duplicating those 24+ parts here would create two competing sources
of truth. This module therefore:

- re-exports the canonical fragment for migration review,
- asserts the workbook identity (title/revision/form code) matches the fragment,
- upserts NOTHING new — it delegates to the canonical seed path.

If the From-Client workbook ever diverges from `CLIENT_B251`, the mismatch surfaces as a
`NEEDS_CONFIRMATION` plan diff instead of a silent overwrite.

## PATS mapping (canonical, unchanged)

Product `B251 Machibouke Hamburger Shop 3` -> 6 Models (01 Avocado Burger ... 06 Tray) ->
ModelParts (inj + deco + paint + shared capsule) -> BomDefinition r1 (model 01) ->
ProcessRoute r1 (Injection -> Decoration/Full Spray -> Assembly/Sub-Assembly ->
Warehouse/Main Packing) -> Project/PartsList/Lot/Batch (July production, 18 trays x 240).

## Run

```powershell
tsx scripts/datamigration/01-pl-b251-catalog.seed.ts        # dry-run: identity check only
```
