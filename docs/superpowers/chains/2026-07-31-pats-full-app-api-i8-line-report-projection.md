# PATS Full App–API Transition — I8 Line Report Projection

Date: 2026-07-31

Status: COMPLETE

## Decision

The line shell and Reports tab need a server-owned display projection assembled from the durable
execution ledgers. The projection may join and label evidence, but it must not fabricate planned
output or lifecycle timestamps that the canonical model does not store.

## Implementation

- Expanded `GET /api/v1/reports/line` with:
  - recent stage-event activity with stage, batch, and actor labels;
  - seven UTC day throughput buckets from accepted terminal-stage events;
  - closed/held/scrapped batch rows with nullable closure timestamps;
  - routing-violation rows with part, lot, attempted-stage, and expected-stage labels;
  - inventory rows with part/lot/stage labels and server-calculated variance flags.
- Preserved the aggregate production, quality, exception, and traceability totals.
- Kept expected throughput nullable when no schedule evidence exists and kept closed timestamps
  nullable because no `closedAt` field exists on the canonical Batch model.
- Updated the OpenAPI source and generated JSON/YAML/endpoint artifacts.
- Added a contract test for the joined projection and variance behavior.

## Validation

- Targeted ESLint and TypeScript checks passed.
- Canonical line-report contract passed.
- Full API suite is the release validation gate for this increment.

## Boundary

This is a rebuildable read projection, not a second source of truth. Stage-shell configuration,
route/allocation authoring, DM/cutover, client-data migration, and production deployment remain
separate boundaries.
