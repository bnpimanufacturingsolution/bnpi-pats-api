# PATS Full App–API Transition — I8 Server-Owned Line Overview

Status: IMPLEMENTED / bounded configuration and seed correction
Date: 2026-07-31

## Decision

The existing canonical reads are sufficient for the Stages launcher and station navigation. A new
aggregate endpoint would add no business evidence, so the app composes one cached directory query
from the existing stages, stations, station-step, batch-position, and routing-violation resources.

## Implemented

- The app adapter preserves server station and stage identity, derives queue/blocked counts from
  server position and exception records, and carries server workflow-group labels.
- Canonical navigation accepts the opaque station ID emitted by the API. Compatible stage keys and
  station codes remain resolvable for existing links, but are not used as persisted identity.
- The deterministic `demo`/`uat` seed now creates separate Injection, Decoration, and Assembly
  stations with one correctly scoped station-step binding each. The seeded quality inspection is
  bound to Assembly.
- No migration is required; no API route shape changed.

## Evidence and boundary

The seed values remain synthetic/provisional. The route only exposes stages and stations actually
present in server configuration. It does not manufacture a Warehouse station when the selected
seed profile has no Warehouse stage/route evidence. That missing configuration is a data/profile
gap to resolve through the source-backed configuration workflow, not a frontend fallback.

The API does not perform production seeding, client-data publication, Drive ingestion, migration,
DM/cutover, or external ERP/warehouse synchronization in this pass.

## Validation

- `node --check scripts/pats-seed.mjs`: passed.
- App integration validation: 4 files / 18 tests passed; app lint and type-check passed.
- The API route contract and generated OpenAPI surface are unchanged, so no regeneration was
  needed for this seed-only correction.

## Next

The next implementation slice is route/allocation authoring. It must be designed around server
plan parts, parts-list revisions, and ordered route steps before canonical mode exposes edits.
