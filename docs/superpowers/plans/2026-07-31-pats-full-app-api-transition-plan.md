# PATS Full App–API Transition Plan

Status: IMPLEMENTATION IN PROGRESS — I11 release gate open
Date: 2026-07-31
Repositories: `bnpi-pats-api`, `bnpi-pats-app`

## Implementation status update

The design gate has been approved for bounded implementation passes. I1–I9 foundation, read/write,
seed, app transport, planning, line-operations, QC, reporting, and configuration-read slices are
implemented. I10 added the server-owned station-history projection and canonical app adoption. The
I11 release gate remains open: station support-card ownership, full configuration authoring, and
planning-editor parity are still incomplete. Disposable seeded API journey (**35/35 PASS**) and
Playwright unbiased path (**10 PASS / 1 DEFERRED**) were executed on 2026-07-31 with enriched seed.
Evidence:

- `docs/superpowers/chains/2026-07-31-full-app-api-test-acceptance.md`
- `docs/superpowers/chains/2026-07-31-app-api-integration-boundary-and-handoff.md` (API pointer)
- App: `.wwg/reports/2026-07-31-app-api-integration-boundary-and-handoff.md` (**primary resume**)

Those checks do not close the full-transition gate. DM/cutover, client-data migration/publication,
external system integration, hardware SDKs, and production deployment remain frozen.

Specification discovery: `docs/superpowers/reports/2026-07-31-full-app-api-integration-specification-discovery.md`

## Goal

Make the active Bandai PATS application API-backed end to end. The API becomes the source of
truth for domain data, seed data, lifecycle state, permissions, and operational evidence. The
frontend consumes API contracts and keeps only UI/session preferences locally.

This is broader than the merged Product Catalog/BOM slice. That slice proves the transport pattern
but does not complete the product goal.

## Current reality

| Area | Current state | Classification |
|---|---|---|
| PATS PostgreSQL schema | Exists and is migrated, but is a partial implementation of the earlier draft model | `CONFIRMED_IMPLEMENTATION` / incomplete |
| API runtime | PATS Prisma client and catalog/BOM foundations are mounted | `CONFIRMED_IMPLEMENTATION` |
| Canonical PATS seed | Does not exist; `prisma/seed.ts` is legacy Mongo compatibility/demo data | `CONFIRMED_GAP` |
| Product/catalog UI | API adapter exists, but demo/localStorage mode remains available | `CONFIRMED_IMPLEMENTATION` / transitional |
| Planning UI | Local fixture and localStorage-backed drafts | `CONFIRMED_IMPLEMENTATION` / prototype transport |
| Line configuration | Local Zustand persistence | `CONFIRMED_IMPLEMENTATION` / prototype transport |
| Dashboard/stage/reporting | Local fixtures plus browser session stores | `CONFIRMED_IMPLEMENTATION` / prototype transport |
| API domain writes | Catalog/BOM/process-route foundations only | `CONFIRMED_IMPLEMENTATION` / incomplete |
| Production migration/DM | Frozen | `CONFIRMED_BOUNDARY` |

The existing `prisma/pats/schema.prisma` is therefore not discarded, but it must be reconciled
against the frozen Gate 0 target before it is treated as the complete application model. In
particular, the current draft still has old `Project`/single-Part Lot assumptions and does not
fully represent controlled revisions, plan snapshots, append-only audit/outbox behavior, or
rebuildable projections.

## Senior engineering decision

Use one modular-monolith API and one PostgreSQL PATS database for the first fully integrated
release. Do not add microservices, a message broker, a second frontend state backend, or a
generic spreadsheet-shaped table.

The application release boundary is the current active product surface:

- local authentication and capability resolution;
- the server-resolved operational context used by the line shell;
- Product → Model → ModelPart → BOM/process configuration;
- Production Plans, model allocations, plan parts, route versions, Lots, and Batches;
- workflow groups, stages, substages, stations, and work instructions;
- stage events, receiving/issuance evidence, routing violations, and process-change records;
- dashboard, line reports, traceability, and stage detail projections.

Drive authorization, source-run ingestion, controlled source-revision publication, external ERP/
warehouse integration, hardware SDKs, DM/cutover, and production deployment remain separate
release boundaries. The app may display seeded evidence status, but it must not turn a seed or
fixture into approved client truth.

## Target data structure

### Identity and context

- `Subject`, `SubjectCredential`, `SubjectAssignment`, `UserPreference`, and walkthrough
  completion are API-owned.
- Authorization is capability-first using the frozen capability vocabulary; the client never
  supplies role, workspace, line, or capability authority.
- The first release has one server-resolved deployment context. The URL's `workspaceCode` is a
  compatibility/navigation value, not a tenant selector or authorization boundary.

### Catalog and configuration

```text
Product
  └─ Model
      └─ ModelPart
          └─ BOM definition (revision) ── BOM lines ── ModelPart
          └─ Process route (revision) ── ordered route stages

WorkflowGroup ── Stage ── SubStage
Station ── StationStep ── Stage/SubStage
WorkInstruction ── immutable versions/assets
```

Catalog records are deployment-owned. Effective revisions are immutable. Source evidence,
crosswalks, and unresolved status remain attached to the record or revision; missing client
quantities remain nullable and visible.

### Planning

The public resource is `ProductionPlan`; `Project` is compatibility terminology only.

```text
ProductionPlan
  ├─ Product/model allocations (demand dimensions and quantities)
  ├─ Product specification snapshot
  ├─ Plan parts (copy/snapshot of catalog ModelParts)
  ├─ PartsListVersion (immutable executable route)
  │    └─ RouteSteps ── PlanPart ── Stage/SubStage
  ├─ MaterialRequirements / PMRS reference projection
  └─ Lots
       └─ LotPartAllocations
            └─ Batches ── BatchPartLines
```

Released plans, parts-list versions, lot allocations, and batch composition are snapshots. Later
catalog edits cannot rewrite active production history.

### Execution and traceability

```text
Batch ── StageEvent (append-only) ── RoutingViolation (when detected)
Batch/Lot/PlanPart ── InventoryTransaction (append-only)
ProcessChangeLog (authorized compensating change)
AuditRecord + OutboxMessage + IdempotencyRecord
BatchPositionProjection (rebuildable read model)
```

The event/transaction ledgers are source truth. Current stage, dashboard counts, and report rows
are projections and must be rebuildable. First release is forward-only with holds and
compensating corrections; reopening completed work and generic rework are deferred.

## API contract families

All new routes follow the approved REST standard: `/api/v1`, plural lowercase kebab-case nouns,
shallow relationships, `snake_case` query parameters, camelCase JSON, standard pagination,
RFC 9457 errors, capability checks, ETags/`If-Match` for mutable resources, and
`Idempotency-Key` for retryable commands.

| Context | Initial canonical families |
|---|---|
| Identity | `/users/me`, `/users/me/capabilities`, `/users/me/preferences` |
| Catalog | `/catalog/products`, `/catalog/models`, `/catalog/model-parts`, `/catalog/bom-definitions`, `/catalog/bom-lines`, `/catalog/process-routes`, `/catalog/route-stages` |
| Configuration | `/workflow-groups`, `/stages`, `/sub-stages`, `/stations`, `/station-steps`, `/work-instructions` |
| Planning | `/production-plans`, `/plan-model-allocations`, `/plan-parts`, `/parts-list-versions`, `/route-steps`, `/lots`, `/lot-part-allocations` |
| Execution | `/batches`, `/batch-part-lines`, `/stage-events`, `/batch-positions` |
| Inventory | `/inventory-transactions`, `/traceability` |
| Exceptions | `/routing-violations`, `/process-change-logs`, `/audit-records` |
| Reporting | `/reports`, `/dashboard-summaries` as read-side projections only |

Commands that affect multiple owned records use one PostgreSQL transaction. No endpoint writes a
dashboard projection as business truth.

## Seed design

Create a separate PATS seed orchestrator and leave the legacy `prisma/seed.ts` explicitly
compatibility-only.

Required behavior:

1. `SEED_MODE=none` performs no seed writes.
2. `SEED_MODE=demo` creates deterministic, idempotent development records through the PATS
   Prisma client and the same constraints used by the API.
3. `SEED_MODE=uat` uses the same schema and seed keys but a separately reviewed data profile.
4. Re-running a seed updates only records owned by the selected seed profile; it never clears the
   database and never deletes client/source evidence.
5. Seed identity uses stable seed keys/business codes and deterministic UUIDs or upserts. Names,
   initials, image filenames, and generated display values are never primary identity.
6. Seeded client-aligned values are marked `PROVISIONAL`, `INFERRED`, or `NEEDS_CONFIRMATION` as
   appropriate. Synthetic data is explicitly `MANUAL`/demo data.
7. Every seed profile must cover the active app journey: at least one product pack, models,
   model parts, sparse BOM, route/configuration, released plan, lot, batches, stage events,
   inventory evidence, one routing exception, and one reportable dashboard state.
8. The API health/readiness smoke must verify that the seeded context is usable before the app is
   considered integrated.

## Frontend transition rules

- Runtime domain reads/writes must go through typed API services and query/mutation hooks.
- `localStorage` may retain auth/session tokens, selected navigation context, table layout, and
  other non-domain UI preferences only.
- `pats-domain-fixtures.ts`, `product-catalog.ts`, demo API handlers, and line operation stores
  become test fixtures or explicit offline-preview tools; they must not be runtime fallbacks in
  the integrated build.
- API unavailability renders loading/error/retry states. It must not silently show stale demo
  records.
- React Query/cache state is allowed as a client read cache, but mutations always reload or
  reconcile from the API response and server version.
- The frontend must send idempotency keys for retryable POST commands and `If-Match` for mutable
  resources.

## Pass chain

Discovery and design are now explicit gates. The full transition has two completed discovery/design
passes followed by eleven dependency-ordered implementation passes, with a conditional schema
correction subpass if model convergence finds an active-screen invariant the current draft cannot
represent.

| Pass | Focus | Exit evidence |
|---|---|---|
| D0 | Scope and runtime inventory | Completed in the specification discovery report; active routes, state authorities, schema, and gaps are mapped |
| D1 | Integrated specification and model reconciliation | Completed in the specification discovery report; decisions, boundaries, confirmation gates, and acceptance are recorded |
| I1 | Canonical data-model convergence | Prisma/API model and migration design match the frozen target and active-screen invariants |
| I1A* | Conditional schema correction | Only if I1 finds an active-screen invariant the current model cannot represent |
| I2 | Migration and persistence boundary | Additive migration, constraints, transaction seams, and isolated PostgreSQL validation pass |
| I3 | Deterministic PATS seed | `none/demo/uat` modes, idempotent seed rerun, complete active journey data |
| I4 | Read API coverage | Catalog/configuration/planning/execution/quality/reporting reads documented and contract-tested |
| I5 | Write API coverage | Planning/configuration/event/inventory/quality commands with auth, concurrency, idempotency, audit |
| I6 | App transport foundation | Typed services/query hooks and API error/concurrency behavior cover all active domains |
| I7 | Planning and catalog integration | API-backed create/edit/release flow, lots, batches, and server snapshots |
| I8 | Line operations and QC integration | API-backed config, stage events, inventory, quality, exceptions, and traceability |
| I9 | Projections and reporting | Dashboard/reports derive from API read models; no local domain store remains |
| I10 | Runtime fixture/local-state removal | Station history is API-backed; support-card and configuration-authoring fixture/state boundaries remain open |
| I11 | Integrated acceptance/release gate | Open until remaining contracts and seeded API + app browser smoke pass; tests/docs are currently green/synced |

Passes are sequential because the next pass depends on the previous contract. We do not create
all implementation code up front: I1 may refine the exact migration and I4/I5 endpoint set, while
I3 seed data is created only after the persistence shape is stable.

## Release gates

Implementation must stop at these gates, not silently choose business policy:

- schema cannot represent released plan snapshots, controlled LotPartAllocation, or append-only
  evidence;
- a route or write requires an unaccepted station/rework/variance/actor policy;
- a client source conflict would be published as canonical data;
- migration would require destructive reset, data deletion, or production mutation;
- API authorization cannot prove deployment-scoped access;
- an active app screen still depends on a runtime fixture after Pass 9.

No DM or cutover work is part of this chain. Seeded development data is not a migration and is
not permission to publish client Drive data.

## Acceptance definition

The goal is met only when a clean environment can:

1. apply migrations and run the selected PATS seed without legacy seed dependencies;
2. authenticate a local user and resolve capabilities from the API;
3. load every active app screen from API data;
4. create/edit/release a plan and create/inspect its lot and batches through API commands;
5. record a stage event and receiving/issuance transaction with retry-safe behavior;
6. show routing exceptions, traceability, dashboard, and reports from API projections;
7. refresh the browser or use a second browser and observe the same persisted domain state;
8. fail visibly and safely when the API is unavailable or a stale write is rejected.

Until these are true, the project is API-connected by slice, not fully API-integrated.
