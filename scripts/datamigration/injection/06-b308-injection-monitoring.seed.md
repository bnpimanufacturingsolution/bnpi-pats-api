# 06 — B308 injection monitoring (B308 Mobile Suit Gundam Narabundesu Narikiri Haro.xlsx)

Source: `docs/REPORTS/MANUFACTURING DOCUMENTS/Injection/B308 Mobile Suit Gundam Narabundesu Narikiri Haro.xlsx`
Sheets (4): `2867508-01 | 2867508-02 | On going Qc Monitoring | Output Summary`.
Form `BNPI-F-IMS-029-2/-1`. Product `B308 Mobile Suit Gundam Narabundesu Narikiri Haro`.

## Sheet inventory

### 2867508-01 (mold 1, 10 parts)

Header R9 identical family to B243. Order qty 47394 each (Japan 33668 / Asia 9225 /
USA 2234 / China 2267), machine output 37002:

| Part | Name | Transfer | Balance |
|---|---|---:|---:|
| B308-01-01 | Gundam Upper Body | 33640 | 13754 |
| B308-01-02 | Gundam Lower Body | 33215 | 14179 |
| B308-01-03 | Zaku Upper Body | 33585 | 13809 |
| B308-01-04 | Zaku Lower Body | 33600 | 13794 |
| B308-01-05 | Char Zaku II Upper Body | 31200 | 16194 |
| B308-01-06 | Char Zaku II Lower Body | 33200 | 14194 |
| B308-01-07 | V Gundam Upper Body | 32020 | 15374 |
| B308-01-08 | V Gundam Lower Body | 31625 | 15769 |
| B308-01-09 | Sazabi Upper Body | 33355 | 14039 |
| B308-01-10 | Sazabi Lower Body | 33265 | 14129 |

Character groups: Gundam / Zaku II / Char Zaku II / V Gundam / Sazabi (2 parts each).

### 2867508-02 (mold 2, 21 parts)

Same order qty 47394, output 24951. Horn/backpack/stand/pillar family:

- Gundam: B308-02-01 Horn / 02 Backpack / 03 Stand
- Zaku II: 04 Backpack / 05 Stand / 06 Pillar Left / 07 Pillar Right
- Char Zaku II: 08 Horn / 09 Backpack / 10 Stand / 11 Pilar Left(sic) / 12 Pillar Right
- V Gundam: 13 Horn / 14 Weapon on Backpack / 15 Backpack / 16 Stand
- Sazabi: 17 Horn / 18 Backpack / 19 Pillar Left / 20 Pillar Right / 21 Stand

(Transfers 14400-22600, balances 24794-32994 — full table in the seed TS.)

### On going Qc Monitoring + Output Summary

Remaining-balance grids + Jul 23-26 set quantities. All shift actual cells blank at
capture — seed creates monitoring shells with null slots only.

## PATS mapping

Product B308 + 5 Models (character groups) + 31 ModelParts (mold-tagged sourceReference)
-> Project (order shots 47394.297) -> Lot per character group -> monitoring shells.
Note: the app's old fabricated B308 family (`pats-seed.mjs` comment: "v1.0 fabricated B308
family is dropped") is superseded by this workbook evidence — run this seed instead of
any hand-written B308 fixture.

## Anomalies

- `B308-02-11` name `Char Zaku II Pilar Left` (missing second `l`) — preserved verbatim.
- No capsule sheet for B308 in this workbook (capsule evidence lives in B243/B248 files).

## Run

```powershell
tsx scripts/datamigration/injection/06-b308-injection-monitoring.seed.ts        # dry-run plan
```
