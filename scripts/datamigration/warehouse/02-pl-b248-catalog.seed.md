# 02 — PL B248 catalog (PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06)

Sources (byte-duplicate pair, single logical seed):

- `docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx`
- `docs/REPORTS/PRODUCTION AND ASSEMBLY/Document/From Client/PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx`

Sheets: `Partslist | Inj | Inj Shot | Deco | Assy`. Form code `BNPI-F-PES-018-1`
(same family form as B251). Revision history Ø..5 (2026-02-16 .. 2026-05-10).

## Sheet inventory

### Partslist (B3:Q62)

Cover only: product `B248 SANRIO CHARACTERS EMOKYUN MEJIRUSHI ACCESSORY`, model `ALL`,
version `JAPAN`, page `1/5`, plus revision table R49-R55. No part rows — the parts live in
Inj/Deco/Assy. Do NOT parse parts from here.

### Inj (A1:Q47)

`INJECTION PARTS LIST`. Header R3: No. / Mold No. / Part No. / Part Name /
Model No.-Model Name / Cavity / Qty./Model / No. of Ups / Material / Description /
Colorant No. / Mixing Ratio / Decoration / Remarks.

| Mold | Part No. | Part Name | Model |
|---|---|---|---|
| 2849226-01 | B248-01-01 | Hello Kitty Ribbon | 1 - Hello Kitty |
|  | B248-01-02 | Hello Kitty Heart |  |
|  | B248-01-03 | Pompompurin Hat | 2 - Pompompurin |
|  | B248-01-04 | Pompompurin Heart |  |
|  | B248-01-05 | Kurousa Heart | 3 - Kurousa |
|  | B248-01-06 | Shirousa Heart | 4 - Shirousa |
|  | B248-01-07 | Kuririn Leaf | 5 - Kuririn |
|  | B248-01-08 | Kuririn Heart |  |
| 2849226-02 | B248-02-01 | Hello Kitty Head | 1 - Hello Kitty |
|  | B248-02-02 | Hello Kitty Body |  |
|  | B248-02-03 | Pompompurin Body | 2 - Pompompurin |
|  | B248-02-04 | Kurousa Body | 3 - Kurousa |
|  | B248-02-05 | Shirousa Head | 4 - Shirousa |
|  | B248-02-06 | Shirousa Body |  |
|  | B248-02-07 | Kuririn Hat | 5 - Kuririn |
|  | B248-02-08 | Kuririn Body |  |
| CAP-PH02-01/02 | C002-01-25 | O 48 mm Transparent Pink Capsule | All Models |

Material: `PVC 90 Degree Transparent (KW-90AA)` throughout; capsule `PP K4515`.
Cavity 2, Qty/Model 1, Ups 2 for all inj parts. Decoration flag `Yes` for all inj parts.

### Inj Shot (B1:T28)

Shot-mold membership, same 16 parts grouped under `2849226-01` (8 rows) and `2849226-02`
(8 rows). No new codes — confirms mold grouping only.

### Deco (A1:M113)

`DECO PARTS LIST`. Header R3: No. / Model No.-Model Name / DECO PART NO. /
DECO Process (S/ST/T) / INJ. PART NO. / PART NAME / PROCESS (FS/FS(d)/FS(M)/Tampo/
Book/Injected) / PAINT COLOR / PAINT NO. / QTY./PRODUCT / REMARKS.

Deco part nos (16, one per inj part, with a 17th ST duplicate on B248-01-08):

`B248-01-01S, B248-01-02S, B248-02-01T, B248-02-02S, B248-01-03S, B248-01-04S,
B248-02-03ST, B248-01-05S, B248-02-04ST, B248-01-06S, B248-02-05T, B248-02-06S,
B248-01-07S, B248-01-08S, B248-02-07S, B248-01-08ST`

Paint nos (31 distinct codes, 38 per-model usages — the seed stores one row per
model+code because color/feature can differ per model):

- 01 Hello Kitty (8): PN-B248-01 Pink/Ribbon, 02 Transparent Pink Orange/Heart,
  03A Black/Eyes L/R, 04A Pink/Eye spark (L&R), 05A Yellow/Nose,
  06A Light Pink/Blush L & R, 07 Blue/Shirt (Book — sits in the merged model-01
  block R19, belongs to Hello Kitty Body), 31A Black Brown/Whiskers L + Whiskers R
- 02 Pompompurin (7): 08 Brown/Hat, 09 Yellow/body, 10A White/Highlights (L&R),
  11A Pink/Heart, 12A Pink Orange/Blush (L&R), 13 Transparent Orange/Heart,
  22A Dark Brown/Eyes (L&R) + Butt
- 03 Kurousa (7): 06A Light Pink/Blush, 11A White/Snout & Eye reflection,
  14 Brown/Head/Body, 15A Pink/L Ear + R ear, 16A Pink/Heart,
  17 Transparent Pink/Heart, 31A Black Brown/Nose,Mouth, Eyes & Eyebrow L & R
- 04 Shirousa (7): 18 Transparent Blue/Heart, 19A Pink/L Ear + R Ear,
  20A Cream/Snout, 21A Pink/Heart, 22A Brown/Eyes, Nose, Mouth,
  23A Light Pink/Blush L & R, 24 Pink/Ribbon (Book)
- 05 Kuririn (9): 06A Light Pink/Blush, 11A White/Glance,
  22A Brown/Eyes, Nose & Mouth, 25 Transparent Green/Heart, 26 Green/Leaf,
  27 Brown/Ears L & R + Head & Tail (Book), 28 Pink/Feet L & R (Book),
  29A Pink/Heart, 30A Brown/Whiskers L + Whisker R

Note the DECO PART NO. column (D) is formula-derived (`CONCATENATE(F,E)`) and the
INJ. PART NO. column (F) pulls from `Inj Shot` — cached values are used throughout.

### Assy (B1:J33)

`ASSY PARTS LIST`. 16 Toy Assembly rows (the 16 deco codes above, qty 1 each), then:

- Toy Accessories (All models): `ES-14-54-14` Eyebolt Screw / `LH-002` Lobster Hook /
  `MR-008` Metal Ring / `TY171-70C-8` Silicon O-Ring / `PB-075` Small PE bag /
  `MB- 248` Minibook / `C002-01-25` capsule.
- Assortment/Box: `PB-012` PE Bag (1/40) / `PS-B248` Pera Sheet / `CB-1009` Carton Box
  (1/200) / `PT-006` Transparent Tape (Japan) / `PT-007` Black Tape (Asia).

## PATS mapping

Product `B248` -> 5 Models (01 Hello Kitty, 02 Pompompurin, 03 Kurousa, 04 Shirousa,
05 Kuririn) -> ModelParts: 16 inj + 16 deco (incl. the ST duplicate on B248-01-08) +
38 paint usages (31 codes) + capsule +
accessories/packaging (Assy-only rows seed as `PACKAGING_COMPONENT`/`OTHER` BOM lines,
not ModelParts) -> BomDefinition r1 + ProcessRoute r1
(Injection -> Decoration/Full Spray -> Assembly/Sub-Assembly -> Warehouse/Main Packing).

## Anomalies (NEEDS_CONFIRMATION, preserved verbatim)

- `Kuririn` (Inj part names + model header) vs `Kururin` (Deco part names R57+ and
  Assy R15-17) — the Deco sheet itself mixes both spellings.
- Same paint no., different paint per model: 11A Pink/Heart (02) vs White/Snout (03)
  vs White/Glance (05); 22A Dark Brown (02) vs Brown (04/05); 31A Whiskers (01) vs
  Nose/Mouth/Eyes (03); 06A "Blush L & R" (01) vs "Blush" (03/05). The seed keeps
  one row per model+code so no variant is lost.
- `B248-01-08` maps to TWO deco codes (`B248-01-08S` Heart, `B248-01-08ST` Body).
- `MB- 248` contains an embedded space in the source.
- Capsule `C002-01-25` (pink, B248) vs `C002-01-42` (transparent, B243/B251) — distinct parts.
- Row R18 `0 / 0` placeholder Assy line — skipped, not seeded.

## Run

```powershell
tsx scripts/datamigration/warehouse/02-pl-b248-catalog.seed.ts        # dry-run plan
SEED_MODE=demo tsx scripts/datamigration/warehouse/02-pl-b248-catalog.seed.ts --write  # gated write
```
