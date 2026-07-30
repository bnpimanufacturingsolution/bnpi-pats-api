# Full App-API Integration Specification Discovery

Status: SPECIFICATION GATE COMPLETE / IMPLEMENTATION NOT STARTED  
Date: 2026-07-31  
Repositories: `bnpi-pats-app`, `bnpi-pats-api`

## Executive decision

The previous Product Catalog/BOM slice proved that the app can call the API. It did not discover
or specify the complete application integration. This report closes that gap.

The next implementation unit is not a direct frontend-to-current-schema wiring exercise. The
current frontend types, fixtures, local stores, Prisma schema, migrations, routes, and frozen Gate
0 decisions are evidence. The canonical contract must be reconciled first, then persisted, seeded,
exposed, and consumed by the app.

The first fully integrated release will use one PATS modular-monolith API and one PostgreSQL
database. The API owns domain state, seed data, lifecycle transitions, capabilities, and
operational evidence. The app may cache API responses and retain UI/session preferences, but it
must not own production data in fixtures or domain localStorage.

## Authority order used for discovery

1. Frozen Gate 0 target decisions and API REST/security standards.
2. Existing API migrations, Prisma models, route handlers, tests, and runtime wiring.
3. Existing app routes, hooks, services, stores, fixtures, and user-facing actions.
4. Historical UI terminology and prototype shape, only where it does not conflict with the
   canonical target.

Where the sources disagree, the conflict is recorded instead of silently choosing the most
convenient implementation.

## What was discovered

### App route and runtime inventory

| Active surface | Current authority | Required API-owned contract | Discovery result |
|---|---|---|---|
| Login and capability state | Auth service plus session localStorage | `/api/v1/auth/login`, `/users/me`, `/users/me/capabilities`, preferences | Local PATS auth is the first-release boundary. Stored identity is a cache and must revalidate. |
| Workspace entry/select/create | Generic workspace service and local navigation | Server-resolved operational context | Conflict with the frozen no-Workspace-persistence target. Do not build new tenancy. Keep compatibility navigation only, or replace it with a fixed API-resolved context. |
| Product list/pack/detail | Catalog API in API mode; fixture/localStorage in demo mode | Product, Model, ModelPart, BOM revision/lines, process-route revision | Existing adapter is a valid transport pattern but incomplete for route/image/delete/duplicate behavior. |
| Planning list | `PlanningDeskRegistry` fixture plus localStorage | `ProductionPlan` collection and summary | Current `Project` terminology is a UI compatibility concern, not the public API noun. |
| Planning detail | Local reducer and localStorage | Plan allocations, plan parts, route version, material requirements, lots, batches | Every meaningful action is a server command; release is a lifecycle transition, not a local boolean. |
| Line admin | Zustand localStorage store | WorkflowGroup, Stage, SubStage, Station, StationStep, WorkInstruction | Current configuration is demo-only. Station must be a physical endpoint; stage membership is explicit through StationStep. |
| Line dashboard/shell | Fixtures, manufacturing snapshot, line stores | Dashboard projection, batch positions, open violations, inventory alerts | Dashboard values must be read-side projections derived from ledgers, not client calculations over fixtures. |
| Stage workstation/detail | Fixtures plus session-only line-ops store | Batches, stage events, inventory transactions, routing violations, positions | Scan, issue, handoff, receive, and completion require retry-safe API commands and append-only evidence. |
| QC screen | Four hardcoded component records and local status actions | Quality inspection/decision resource linked to batch/stage | Current screen has a real business action with no API model. Add a minimal quality contract before cutover, or explicitly remove the route from the release. Recommendation: add it. |
| Reports/traceability | Local fixture snapshot and derived alerts | Reports, traceability queries, dashboard summaries | Export may remain client-side, but the rows and totals must come from API read models. |

### Client-owned versus API-owned state

| State | Owner after integration | Allowed client behavior |
|---|---|---|
| Products, models, parts, BOMs, routes | API/PostgreSQL | Query cache only |
| Plans, lots, batches, releases | API/PostgreSQL | Query cache and optimistic form draft before command |
| Workflow and station configuration | API/PostgreSQL | Query cache |
| Stage events, inventory, violations, QC decisions | API/PostgreSQL append ledgers | No local domain persistence |
| Dashboard/report totals and current positions | API projections | Read cache; never authoritative local calculations |
| Auth token/session bootstrap | API plus browser session cache | Revalidate on load; no client-supplied authority |
| Selected navigation/context code | Client | Must not grant scope or authorization |
| Table layout, filters, walkthrough completion UI state | Client or API preference endpoint as appropriate | Never mixed with domain truth |
| Fixtures and demo handlers | Tests/offline preview only | No silent runtime fallback in integrated mode |

## Required canonical user journeys

### 1. Prepare a plan

1. User authenticates and receives capabilities from the API.
2. App resolves the server operational context.
3. User reads catalog products, models, model parts, effective BOM, and effective process route.
4. User creates a `ProductionPlan` with model allocations and required quantities.
5. API creates immutable plan snapshots for parts and executable route data.
6. User adds or edits plan parts, material requirement references, lots, and batches through
   capability-checked commands.
7. User releases the plan. The API validates the release checklist and records the lifecycle
   transition with audit evidence.

### 2. Execute work

1. App reads configured workflow, stations, station steps, released batches, and current positions.
2. A station command records a stage event with stable actor identity, station, route step, batch,
   quantity, UOM, and source representation.
3. Issuance/receiving commands append inventory transactions and link the evidence to the batch,
   lot, or plan part.
4. Invalid sequencing creates a routing violation; it cannot be repaired by rewriting history.
5. Holds and authorized compensating changes are explicit. Generic rework and reversal are not
   first-release behavior.

### 3. Review quality and visibility

1. QC records an inspection and a pass/fail/hold decision against the relevant batch and stage.
2. Dashboard and reports query API projections built from events, inventory, violations, and QC.
3. Traceability follows plan -> lot -> lot-part allocation -> batch -> event/inventory/quality
   evidence.
4. Refreshing the browser or opening a second browser shows the same persisted state.

## Canonical model reconciliation

The current Prisma schema is a useful foundation, but it is not yet the complete release model.

| Current evidence | Required correction before seed | Reason |
|---|---|---|
| `Project` with `workspaceId` | Converge public API to `ProductionPlan`; remove workspace ownership from the PATS domain boundary | Frozen target uses one server-resolved context and reserves `Project` as compatibility terminology. |
| `WorkflowGroup.projectId` | Make workflow/configuration deployment-owned | A line configuration must not be accidentally scoped to a planning record. |
| `Lot.partId` and `partName` | Add `LotPartAllocation` and make lot composition explicit | A lot can group multiple controlled parts; a singular part silently loses traceability. |
| Mutable `Batch.currentStageId/currentSubStageId` | Derive current position from append-only `StageEvent` data and expose a rebuildable projection | A mutable shortcut can diverge from the event history. |
| Free-form `StageEvent.actor` | Link to stable `Subject` identity and retain only a bounded actor snapshot when needed | Audit and authorization require a stable identity, not a display string. |
| Integer inventory quantities | Use controlled UOM, usage basis, precision, and `numeric(18,6)` representation | Manufacturing evidence must preserve fractional and source-represented quantities. |
| `ModelPart.routingSteps` JSON | Keep catalog parts separate from executable plan route steps | Catalog identity and released execution snapshots have different lifecycle rules. |
| Minimal `Pmrs` placeholder | Treat PMRS as a controlled reference/projection or add the minimum material-requirement relation | PATS must not infer a complete client planning system from a header-only placeholder. |
| No general audit/outbox/idempotency/projection records | Add cross-cutting persistence seams before command implementation | Retry safety, auditability, and rebuildable reads are release requirements. |
| No quality model | Add minimal `QualityInspection` and `QualityDecision` records, or remove/hold the QC route | The active UI exposes a business decision that cannot be represented as a generic scan. |
| `WorkInstruction.steps` and violation expected steps as JSON | Bound them as versioned snapshots/content, never as canonical route truth | Embedded evidence is useful, but unbounded JSON cannot govern route behavior. |

This reconciliation is a migration design gate. It does not authorize a destructive reset or
production migration.

## Minimal quality contract recommended for first release

The current QC route is not a harmless mock: it lets a user pass, fail, or hold an item. The
pragmatic design is a small resource rather than a broad quality-management subsystem:

- `QualityInspection`: batch, stage/station, inspection type, status, inspected quantity/UOM,
  inspector, started/completed timestamps, and bounded evidence reference.
- `QualityDecision`: inspection, decision (`PASSED`, `FAILED`, `HOLD`), reason/code when required,
  actor, timestamp, and immutable decision history.
- Failed or held decisions may create a batch hold or exception; they do not rewrite stage events.
- Sampling plans, defect taxonomies, CAPA, laboratory workflows, and advanced NCR workflows are
  out of scope until evidence requires them.

## API contract shape

All new resources follow the approved `/api/v1` REST standard: plural kebab-case nouns, camelCase
JSON, standard pagination, RFC 9457 errors, capability checks, ETags/`If-Match` for mutable
resources, and `Idempotency-Key` for retryable commands.

| Capability area | Resource families |
|---|---|
| Identity/context | `/users/me`, `/users/me/capabilities`, `/users/me/preferences`, resolved context |
| Catalog | `/catalog/products`, `/catalog/models`, `/catalog/model-parts`, `/catalog/bom-definitions`, `/catalog/bom-lines`, `/catalog/process-routes`, `/catalog/route-stages` |
| Configuration | `/workflow-groups`, `/stages`, `/sub-stages`, `/stations`, `/station-steps`, `/work-instructions` |
| Planning | `/production-plans`, allocations, plan parts, parts-list versions, route steps, lots, lot-part allocations, batches |
| Execution | `/stage-events`, `/batch-positions`, receiving/issuance commands |
| Inventory/exceptions | `/inventory-transactions`, `/routing-violations`, `/process-change-logs`, traceability |
| Quality | `/quality-inspections`, `/quality-decisions` |
| Reporting | `/dashboard-summaries`, `/reports` and traceability read models |

Multi-record commands must execute in one PostgreSQL transaction. Projections are rebuilt or
reconciled from source ledgers; no endpoint writes a dashboard total as business truth.

## Seed and evidence policy

There is no canonical PATS seed today. The existing root `prisma/seed.ts` is legacy compatibility
data and must not be used to claim full integration.

The new PATS seed must be deterministic and idempotent, with `none`, `demo`, and `uat` profiles;
stable seed keys; no clear/delete behavior; and explicit provenance/status for synthetic,
inferred, provisional, or unresolved values. It must cover the complete acceptance journey:
catalog, configuration, released plan, lot composition, batches, events, inventory, one exception,
quality evidence, and reportable projection state.

Client source files are evidence, not permission to publish uncertain values. Missing quantities,
ambiguous labels, and unresolved mappings stay nullable or visibly marked until a reviewed source
revision is approved.

## Decisions and boundaries

1. Reconcile and migrate the canonical model before writing the full seed.
2. Use `ProductionPlan` publicly; preserve old `Project` wording only as a temporary UI adapter.
3. Do not create new workspace/tenant persistence for this release; resolve one server context.
4. Add the minimal QC contract because the active screen performs a business decision.
5. Keep event and inventory ledgers append-only; build current position, dashboard, and reports as
   projections.
6. Remove runtime fixture/localStorage fallbacks after API coverage is complete; retain them for
   tests and explicit offline preview only.
7. Keep Drive ingestion/publication, DM/cutover, external ERP/warehouse, hardware integration,
   and production deployment outside this build chain.

## Known confirmation gates

These are narrow policy confirmations, not reasons to postpone discovery:

- Final QC reason/status vocabulary and whether a failed decision places a batch on hold. The
  recommended default is explicit hold on failed/held decisions, with a capability-controlled
  release command.
- Asset ownership/upload policy for product and work-instruction images. Until decided, store
  metadata/evidence references and do not make data-URL uploads part of the domain contract.
- The replacement UX for generic workspace select/create. The backend decision is fixed-context;
  the UI may keep compatibility navigation but must not present a false tenant boundary.
- Exact source-revision publication workflow for client-derived catalog values. The API must keep
  unresolved evidence visible and must not auto-approve it.

## Implementation chain

Discovery and design are now explicit passes. Implementation remains dependency ordered:

| Pass | Focus | Exit evidence |
|---|---|---|
| D0 | Repository, route, state, schema, migration, route, and evidence inventory | Completed in this report; every active screen has an authority and gap classification |
| D1 | Integrated specification and model reconciliation | Completed in this report; decisions, boundaries, and confirmation gates recorded |
| I1 | Canonical model convergence | Prisma/API model and migration design match the frozen target and active-screen invariants |
| I2 | Additive persistence migration | Migration, constraints, transaction seams, and isolated database validation pass |
| I3 | Deterministic PATS seed | `none/demo/uat` profiles rerun safely and cover the full active journey |
| I4 | Read API coverage | Catalog/config/planning/execution/quality/reporting reads are contract-tested |
| I5 | Write API coverage | Commands enforce capabilities, concurrency, idempotency, audit, and lifecycle rules |
| I6 | App transport foundation | Typed services/query hooks and error behavior are ready for all active domains |
| I7 | Catalog and planning cutover | Plan creation/edit/release, lots, batches, and snapshots use the API |
| I8 | Line execution and QC cutover | Configuration, station commands, events, inventory, exceptions, and quality use the API |
| I9 | Projections and reporting cutover | Dashboard, reports, traceability, and positions read API projections |
| I10 | Fixture/local-domain-state removal | No active route uses runtime domain fixtures or localStorage authority |
| I11 | Integrated acceptance and release gate | Clean migrate/seed/auth journey, cross-browser persistence, full tests, truth sync |

The passes are intentionally sequential. The exact migration and endpoint set are allowed to
change during I1 if a discovered invariant requires it; implementation must not begin by guessing
those boundaries.

## Acceptance definition

The goal is met only when a clean environment can migrate and seed without legacy seed dependency,
authenticate and resolve capabilities, load every active screen from API data, create/edit/release
a plan, create/inspect lots and batches, record stage/inventory/quality evidence with retry-safe
commands, show exceptions/traceability/reports from projections, preserve state across refresh and
second-browser use, and visibly handle API failure or stale writes.

Until then, the system is API-connected by slice, not fully API-integrated.
