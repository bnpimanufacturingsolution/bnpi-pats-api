# PATS Full App–API Transition — I7 Dashboard Read Projection

Date: 2026-07-31

Status: COMPLETE

## Decision

The line dashboard requires active-project count, active-lot count, active batches, stage progress,
planned-versus-active quantity, and open routing state. These values are derived from lots, batches,
batch-position projections, stages, and routing-violation records. They belong in the API read model,
not in a React join over client fixtures.

## Implementation

- Expanded `GET /api/v1/dashboard-summaries` with:
  - distinct `activeProjects` and `activeLots`;
  - `productionProgress` rows with project/product identity, quantity totals, active batch count,
    ordered stage segments, blocked segments, and not-started quantity;
  - open routing state derived from the open violation ledger.
- Planned quantity is counted once per lot even when a lot has multiple active batches.
- Blocked quantity follows the current batch position while an unresolved routing violation exists,
  matching the operator dashboard semantics.
- Added an explicit OpenAPI `DashboardSummary` schema and regenerated Swagger JSON/YAML.
- Added contract coverage for distinct ownership counts, stage/blocked/remaining segments, and lot
  de-duplication.

## Boundaries

- This is a read-side projection only; no dashboard total is persisted as business truth.
- Decimal quantity fields in the projection are used for dashboard distribution and remain separate
  from the append-only quantity ledgers.
- Activity, throughput history, station queues, and closed-lot/report rows remain separate read-model
  work for the next integration pass.

## Validation

- `pnpm type-check` passed.
- `pnpm lint` passed.
- Canonical domain-read contract: 6 passing tests.
- Full API suite before this projection was 207 passing; the focused contract suite for this change
  passed after the projection update.
- OpenAPI generation passed.
