# PATS Full App-API Transition — I5 Write API Coverage

Status: I5 COMPLETE / I6 APP TRANSPORT FOUNDATION READY  
Date: 2026-07-31  
Depends on: I1 model convergence, I2 canonical migration, I3 deterministic seed, and I4 read API coverage

## Implemented

- Added the canonical command boundary at `app/pats/command-router.ts` and mounted it under
  `/api/v1` behind canonical identity and capability gates.
- Added the shared command/idempotency/audit/outbox support in `app/pats/command-support.ts`.
- Added retry-safe planning commands:
  - create a draft Production Plan;
  - edit a draft plan with `If-Match` row-version protection;
  - release a draft/ready plan as an explicit lifecycle transition;
  - create a Lot with a `LotPartAllocation` and server-validated plan references;
  - create a planned Batch with part lines and an initial rebuildable position projection.
- Added configuration commands for new workflow stages, substages, physical stations, station-step
  bindings, and versioned work instructions. These commands are create-only foundations; edit,
  retire, reorder, and delete policies remain explicit follow-up work for the configuration cutover.
- Added execution/inventory/quality commands:
  - record a forward-only stage event;
  - record a blocked event plus `RoutingViolation` when the attempted step is not the next route
    step;
  - record receiving or issuance evidence with expected/actual quantity status;
  - open a quality inspection and record a quality decision;
  - resolve a routing violation with a required note.
- Every retryable command requires `Idempotency-Key`. The durable `IdempotencyRecord` claim and
  completion update are co-located with the business transaction, and response headers are stored
  for exact replay.
- Successful commands append `AuditRecord` and `OutboxMessage` rows in the same PostgreSQL
  transaction. No dashboard or position value is written as business truth by a client command.
- Added the additive migration
  `20260731170000_pats_idempotency_response_headers` and regenerated the PATS Prisma client.
- Added OpenAPI source `docs/openapi/2026-07-31-pats-api-v1-domain-writes.yaml` and regenerated
  Swagger JSON/YAML artifacts.
- Added command contract tests covering idempotent replay, `If-Match`, capability denial, forward
  route acceptance, and quality authorization.

## Capability and lifecycle decisions

- Planning commands require `planning.manage`.
- Stage commands require `execution.write`; inventory commands require `inventory.issue`;
  quality commands require `quality.resolve`; violation resolution requires
  `reconciliation.resolve`; configuration creation requires `operations.manage`.
- Released, completed, and cancelled plans cannot be edited. Release is forward-only.
- Stage execution advances only to the next ordered route step. Out-of-order scans remain visible
  as blocked evidence and do not advance the batch projection.
- Quantity values retain both legacy integer compatibility fields and normalized decimal/UOM fields;
  the command boundary does not invent a conversion basis.

## Validation

- `pnpm type-check` passed.
- `pnpm lint` passed.
- Full API suite passed: 206 tests.
- Disposable PostgreSQL migration deploy passed across all 9 migrations.
- `prisma migrate diff` after deployment reported `-- This is an empty migration.`
- Demo seed completed twice with stable IDs; `SEED_MODE=none` remained a no-write mode.
- Authenticated runtime smoke passed against the disposable database:
  - local planner login returned 200;
  - `/api/v1/production-plans` returned seeded data;
  - plan-create returned 201 and replayed the same `Location`/`ETag` response without creating a
    duplicate plan.

No production database, client Drive source, migration/cutover operation, or production deployment
was modified by this pass. The disposable smoke plan is test data only.

## I6 entry condition

The API now exposes persisted reads and retry-safe write commands for the active business journey.
The next pass builds the app transport/query layer around these contracts, with one API mode that
owns server state and an explicit offline/demo mode retained only for tests and preview.

## Remaining command boundary work

This pass establishes the first command set needed for app integration. Exact UI-specific edit/
reorder/retire commands for configuration, richer traceability filters, and any source-revision
publication workflow remain separate because they need the app transport and evidence/publication
decisions rather than being guessed into this foundation.
