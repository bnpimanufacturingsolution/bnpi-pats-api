# Bandai PATS API Data Model Design

**Status:** PROPOSED DESIGN; not a migration specification

**Date:** 2026-07-14

## Relational design rules

- Use PostgreSQL relations, foreign keys, unique constraints, check constraints, and indexes for
  business relationships and invariants.
- Use Prisma migrations as the schema change mechanism.
- Use opaque immutable identifiers. Do not expose implementation-derived identity.
- Store timestamps in UTC using ISO 8601 at the API boundary.
- Use soft deletion only where business retention requires it; default deleted-resource behavior
  is `404` under the REST standard.
- Use JSON only for bounded metadata with a separately documented shape, such as source
  provenance, localized text, or a preserved external payload.
- Never store a derived dashboard metric as the only source of truth.

## Canonical conceptual model

```text
Workspace / Line
  ├── Memberships
  ├── Catalog: Product -> Model -> ModelPart
  ├── Workflow Catalog: WorkflowGroup -> Stage <-> SubStage
  ├── Stations and WorkInstructions
  ├── ProductionPlans
  │     ├── Product/Model Allocations
  │     ├── PartsListVersions -> RouteSteps
  │     ├── Parts
  │     └── Lots -> Batches -> BatchPartLines
  ├── StageEvents and InventoryTransactions
  ├── RoutingViolations and VarianceAlerts
  ├── ProcessChangeLogs and AuditRecords
  └── AssetReferences and OutboxMessages
```

## Core entity responsibilities

| Entity | Owns | Must not own |
|---|---|---|
| Workspace/Line | tenant boundary and operational identity | user-facing copy decisions only |
| Membership | subject-to-workspace role relationship | domain resource authorization rules in isolation |
| Product | product pack identity and stable code | a single model's display name |
| Model | variant identity within a Product | project-specific routing |
| ModelPart | reusable catalog part definition | execution quantity or event history |
| WorkflowGroup | configurable workflow grouping | project-specific route order |
| Stage/SubStage | valid operational locations and policy | batch current state as mutable UI data |
| Station | physical work location and hardware capabilities | business route definition |
| ProductionPlan | planning intent and selected product/models | live execution history |
| PartsListVersion | immutable route definition for a plan/project revision | current batch position |
| Part | project-specific tracked unit definition | global catalog identity |
| Lot | planning/traceability grouping and quantity | one fixed Part relationship unless confirmed |
| Batch | scannable execution/container unit | unbounded event history in a JSON blob |
| StageEvent | append record of stage activity | mutable current-state shortcut as sole truth |
| InventoryTransaction | append record of WIP movement and quantities | raw-material ERP ledger |
| RoutingViolation | detected route exception and preserved expected route | silent correction of source event |
| ProcessChangeLog | explicit authorized route/process change | generic application logging |
| AuditRecord | actor, action, resource, tenant, time, outcome | domain event replacement |
| Asset | private file metadata and object reference | public bucket or public object key |
| OutboxMessage | durable publication intent | business state itself |

## Relationships requiring design confirmation

### Workspace ownership

Catalog and workflow configuration should be explicitly classified as system-seeded, workspace
owned, or layered system-plus-workspace configuration. The current draft mixes project-scoped and
workspace-scoped concepts. This is `NEEDS_CONFIRMATION`.

### Product to model to project

`Product -> Model -> ModelPart` is the catalog hierarchy. A ProductionPlan selects a Product and
creates explicit model allocations. Project Parts are derived or copied from a selected catalog
version under a controlled command; they are not live aliases of mutable catalog rows.

### Parts List versioning

Every executable route must resolve to a specific Parts List version. Published versions become
immutable. A new route creates a new version; it must not mutate the route used by active batches.

### Lot and batch

A Lot groups planning quantity and traceability. A Batch is the barcode/scannable unit inside a
Lot. The Lot-to-Part cardinality in the current draft is not accepted as final; the next design
pass must reconcile whether a Lot is plan-wide, part-specific, or a controlled grouping of parts.

### Current position

The latest valid StageEvent is the evidence for a Batch position. A query projection may cache the
current position for performance, but the transition must be protected by the same transaction as
the event and must be rebuildable.

## State categories

State machines must be explicit for:

- production plan: draft, ready, released, paused, completed, cancelled;
- lot: planned, active, held, completed, cancelled;
- batch: planned, active, held, closed, scrapped;
- stage event: recorded, accepted, blocked, superseded only through an explicit correction rule;
- routing violation: open, acknowledged, resolved, waived if that policy is approved;
- asset/job/outbox records: lifecycle states with retry and terminal behavior.

No state transition may be inferred from a display label or a seed row.

## Current draft gaps to resolve before migration

- PMRS structure is a placeholder.
- Actor fields need a stable identity model and optional immutable actor snapshot.
- Audit and outbox models are missing from the draft.
- Asset ownership and durable image linkage need a first-class decision.
- WorkInstruction scoping and version uniqueness need a PostgreSQL-safe design.
- Quantity units, pack sizes, and variance policy need domain-level constraints.
- Deletion, retention, and correction policies need explicit rules.
