# Paint-Number Parts Detached Pending Per-Model Mapping Review

**Date:** 2026-09-24
**Status:** DETACHED — mapping review deferred by user, evidence retained
**Trigger:** `Paint PN-*` rows cluttered the Parts List and the `paintNumbers[].modelNumbers`
spread attaches paints to models they don't belong to (e.g. `PN-B251-01` on 01/02/03).

## What was done

- `scripts/pats-seed.mjs`: paint attach loop gated behind `SEED_PAINT_PARTS = false`.
  The m01 paint BOM lines self-skip on the empty lookup (`if (!modelPartId) continue`).
  No reseed can reintroduce the rows while the flag is false.
- Demo DB cleanup (2026-09-24, atomic transaction): deleted 8 m01 `DECORATION_INPUT`
  paint BOM lines first (FK `RESTRICT`), then all 25 `PN-*` ModelParts.
  B251 went 76 → 51 parts (model 01: 23 → 15). Inj/deco/capsule rows untouched;
  no `Part` (project) row ever referenced a paint part.

## Evidence retained (untouched)

- `scripts/pats-seed-client-b251.mjs:163-185` (`paintNumbers`: 22 workbook paint nos
  with color/feature/modelNumbers) and `paintPartDisplayName` (`:195-199`).
- Seed-contract spec locks both facts: fragment still declares the evidence, and the
  attach loop stays gated.

## Revisit checklist (for the deferred mapping discussion)

1. Confirm the true home model(s) per paint no. against the Rev 6.0 Deco tab.
2. Fix `paintNumbers[].modelNumbers` to the confirmed mapping.
3. Flip `SEED_PAINT_PARTS` to true, reseed (additive re-attaches; note reseed resets
   `routingSteps` to `[]` on the update path), and re-add m01 paint BOM lines if wanted.
4. Decide whether shared paints (e.g. `PN-B251-01`, `PN-B251-22`) stay multi-attached
   or become per-model rows.
