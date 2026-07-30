# PATS Full App-API Transition — I4 Read API Coverage

Status: I4 COMPLETE / I5 WRITE API COVERAGE READY  
Date: 2026-07-31  
Depends on: I1 model convergence, I2 canonical migration, and I3 deterministic seed

## Implemented

- Added the canonical PATS operational read router at `app/pats/domain-read.ts`.
- Mounted the router at `/api/v1` behind the provider-neutral canonical identity boundary,
  with capability checks per resource family.
- Added server-owned reads for:
  - configuration: workflow groups, stages, substages, stations, station steps, and work
    instructions;
  - planning: paginated production-plan summaries and an aggregate plan snapshot containing
    allocations, material requirements, route versions, lots, lot-part allocations, and batches;
  - execution: paginated batches, batch positions, and append-only stage events;
  - inventory and exceptions: paginated inventory transactions and routing violations;
  - quality: inspections with their decisions;
  - reporting: dashboard summary counts and a line report projection.
- Kept catalog product/BOM reads on the existing canonical catalog boundaries and documented the
  new operational read families in
  `docs/openapi/2026-07-31-pats-api-v1-domain-reads.yaml`.
- Regenerated `docs/generated/swagger.json` and `docs/generated/swagger.yaml` so the checked-in
  API artifacts contain the operational read paths.
- Added `tests/canonical-domain-read.spec.ts` covering pagination, batch filtering, configuration
  reads, capability denial, and rejection of unsupported query parameters.
- Preserved the canonical unknown-route 404 behavior after finding and fixing a middleware-scope
  regression during the first full-suite run.

## Contract decisions

- Collection responses use the existing offset envelope: `{ data, pagination }` for paginated
  resources and `{ data }` for bounded configuration/exception/quality collections.
- Decimal quantities are serialized as strings and dates as ISO-8601 strings at the read boundary;
  source ledgers remain authoritative and projections remain rebuildable.
- `batch_id` is the only supported operational filter on the current execution and inventory
  collections. Unknown query parameters fail with the canonical malformed-request problem.
- Reads are no-store and do not calculate business truth in the browser. Capability checks are
  assigned to the business family: `planning.read`, `execution.read`, `inventory.read`, and
  `quality.read`.
- The detail resource uses the public API noun `ProductionPlan` while reading the compatibility
  Prisma table `Project`.

## Validation

- `pnpm type-check` passed.
- `pnpm lint` passed.
- `pnpm exec ts-node scripts/generate-openapi.ts` passed and generated operational read paths.
- Full API suite passed: 201 tests.
- Existing unknown-route canonical HTTP tests passed after the identity-scope correction.

No production database, client Drive source, migration/cutover operation, or production deployment
was modified by this pass.

## I5 entry condition

The API now has a persisted, seeded read surface for every active app domain. The next pass adds
write commands for planning, configuration, stage execution, inventory, routing exceptions, and
quality with capability enforcement, `If-Match` concurrency, idempotency where retryable, audit
records, outbox messages, and forward-only lifecycle rules.
