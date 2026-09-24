# Demo Product Packs B252–B256 (Mirror App Fixtures)

**Date:** 2026-09-24
**Owner approval:** user (explicit; identities = app fixtures, depth = catalog + planning links)
**Trigger:** every project used the single B251 pack; at least 5 packs needed.

## Decision

Seed five demo packs mirroring `bnpi-pats-app/app/lib/product-catalog.ts`
(`ADDITIONAL_PRODUCT_DEFINITIONS`) exactly — codes B252–B256, names, model
numbers/names, part names and `${productCode}-${modelNumber}-${NN}` derivation:

- B252 Street Food Friends · B253 Mini Market Neighbors · B254 Cozy Cafe Counter
- B255 Playground Pals · B256 Night Market Charms (3 models × 3 parts each)

Labeled demo data only: `MANUAL` source status, `NEEDS_CONFIRMATION` evidence,
`DRAFT` lifecycle, `sourceReference.origin: "demo-fixture"`. Never client
publication. Depth: catalog rows plus one DRAFT pilot project per pack
(`PRJ-<CODE>-PILOT`) with spec, `COMMITTED` model/demand allocations (1 tray per
model), and `PUBLISHED` plan part snapshots — mirroring the B251 planning
pattern. No lots/batches/prints; execution realism stays B251.

## B308-ban distinction (seed-contract test updated)

The `pats-seed-contract` ban on the fabricated B308 client-publication family
(`CLIENT_B308`, `B308-*-*` codes) stands and still passes. Demo pack names are a
separate, explicitly labeled category, so the name-level ban was narrowed with
this rationale recorded here — not a weakening of the no-fabricated-client-data rule.

## Verification (2026-09-24)

- Reseed (additive, `SEED_MODE=demo`): demoProducts 5, demoModels 15, demoParts 45,
  demoProjects 5, demoPlanParts 45; paintParts 0 (detach gate holds).
- DB read-back: 6/6 packs DRAFT with 3 models + 9 parts each; 5 pilots DRAFT with
  3 allocations + 9 plan parts each.
- Live `GET /api/v1/catalog/products`: `totalItems=6`, codes B251–B256.
- `tsc` clean; mocha **447 passing, 0 failing**.
- Zero pre-existing configured route steps at reseed time (verified), so the
  reseed's `routingSteps: []` reset destroyed nothing.
