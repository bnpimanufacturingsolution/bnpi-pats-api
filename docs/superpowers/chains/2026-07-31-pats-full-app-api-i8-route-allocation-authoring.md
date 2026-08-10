# PATS Full App–API Transition — I8.2 Route and Allocation Authoring

Date: 2026-07-31

Status: COMPLETE

## Decision

The remaining local planning editor is too broad to cut over as one operation. The bounded
canonical slice is:

1. expose server-owned model allocations and route-step part identity in plan detail;
2. upsert one model allocation through a transactional planning command;
3. materialize plan-part snapshots and an initial executable parts-list route from catalog model-part
   evidence when that allocation is first created;
4. create a new immutable draft parts-list version when an operator saves a route edit.

The app will use these commands for a small canonical authoring panel. It will not expose local
batch/model editing, arbitrary part creation, material requirements, PMRS authoring, or release
readiness as if those server commands existed.

## Why this shape

- `ProjectModelAllocation`, `Part`, `PartsList`, and `RoutingStep` already exist in the canonical
  persistence model, so no schema migration is required for this increment.
- A route version is execution evidence. Mutating a version that may already be referenced by a
  lot would silently change history; saving creates the next draft version instead.
- Catalog model-part routing is evidence for initial materialization, not an instruction to invent
  missing client data. Missing route steps remain empty and visible.
- The plan aggregate row version is the concurrency boundary for authoring. Commands require
  `If-Match`, use `Idempotency-Key`, write audit/outbox evidence, and increment the plan version.

## Contract

- `GET /api/v1/production-plans/:planId` adds `modelAllocations` and includes `partId`, `partCode`,
  and `partName` on route-step resources.
- `POST /api/v1/production-plans/:planId/model-allocations` accepts a model and planned quantity,
  upserts the plan allocation, snapshots model parts, and creates the first draft route version
  only when the plan has no parts-list version.
- `POST /api/v1/production-plans/:planId/parts-list-versions` accepts an ordered set of route
  steps and creates the next draft version. It validates plan parts, stage/sub-stage identity,
  duplicate step identity, and per-part ordering.

Both commands fail for released/completed/cancelled plans and return the updated plan row version.
No production migration, client-data publication, Drive ingestion, DM/cutover, or external-system
integration is part of this pass.

## Implemented

- Enriched plan detail with server-owned model allocations and route-step part identity.
- Added transactional model-allocation upsert with plan-part snapshots and evidence-backed initial
  route materialization.
- Added immutable draft parts-list version creation with plan-part, stage/sub-stage, duplicate-step,
  and ordering validation.
- Added typed app service methods, React Query mutations/catalog reads, and a bounded canonical
  planning authoring panel. Demo-only draft editing remains explicitly separate.
- Added OpenAPI source/generated artifacts and contract coverage for the new read/write surface.

## Chain passes

- R0: contract and persistence fit review — complete in this document.
- R1: API read enrichment and commands — complete.
- R2: typed app service, queries, mutations, and canonical authoring panel — complete.
- R3: API/app contract tests, full validation, WWG truth synchronization — complete.

## Exit evidence

- API contract tests cover idempotency, `If-Match`, plan editability, model ownership, route-step
  validation, part identity, and immutable version creation.
- App tests prove canonical planning renders server-owned allocations/routes, saves a route version,
  invalidates the plan detail query, and shows API errors without fixture fallback.
- API lint, type-check, and full suite pass: 212 tests.
- App lint, type-check, and full Vitest suite pass under the documented 10-second test timeout.

## Boundary and next slice

The route authoring command creates draft versions only; it does not release a parts list, rewrite
lot history, author material requirements, or claim PMRS/batch-model editing. No schema migration,
client-data publication, Drive ingestion, DM/cutover, or external-system integration was performed.
The next bounded slice is canonical quality/QC read and write adoption in the app.
