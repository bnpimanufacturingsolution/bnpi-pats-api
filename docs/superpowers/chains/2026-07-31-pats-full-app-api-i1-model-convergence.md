# PATS Full App-API Transition — I1 Model Convergence

Status: I1 DESIGN LOCK COMPLETE / I2 PERSISTENCE IMPLEMENTATION READY  
Date: 2026-07-31  
Depends on: `2026-07-31-full-app-api-integration-specification-discovery.md`

## Objective

Converge the existing PATS Prisma draft with the accepted Gate 0 target and the active app
journeys before creating migrations, seeds, or remaining endpoints.

## Decision: preserve physical tables, converge the domain boundary

The existing PATS database is a new/draft boundary, but its migrations already exist and its
generated client is used by identity, intake, catalog, BOM, and process-route code. The pragmatic
choice is:

- keep existing physical table names where possible;
- use Prisma `@@map`/`@map` or compatibility fields when a non-destructive bridge is required;
- expose canonical API nouns and domain behavior at the service boundary;
- add missing normalized relations and ledgers before seed data;
- remove compatibility columns only in a reviewed migration after the database audit;
- never create a second source of truth for the same plan, lot, batch, or event.

This avoids an unnecessary table reset while allowing the API contract to use `ProductionPlan`,
`LotPartAllocation`, immutable route versions, and append-only evidence.

## Canonical model decisions

### Identity and context

Keep `Subject`, `SubjectCredential`, `SubjectAssignment`, and `UserPreference` as the identity
boundary. Add stable subject references to every new operational command. The first release has one
server-resolved context; no new Workspace, membership, or ProductionLine persistence is introduced.

Existing `workspaceId` columns on source-intake and draft planning/configuration records are
compatibility evidence. They are not exposed as client-selected authorization scope. I2 must audit
their actual usage before dropping or nulling them.

### Catalog/configuration

Keep the working catalog hierarchy:

```text
Product -> Model -> ModelPart
Model -> BomDefinition -> BomLine
Model -> ProcessRoute -> ProcessRouteStage
WorkflowGroup -> Stage <-> SubStage
Station -> StationStep -> Stage/SubStage
```

Convergence rules:

- `ModelPart` remains the model-facing applicability record for this release. A future reusable
  `PartDefinition` may be added when source evidence requires shared part identity; do not duplicate
  part truth in the first integration pass.
- BOM lines remain relational and may carry nullable quantity/UOM/source representation because the
  client evidence is sparse. They are not route steps.
- Process route stages are catalog definitions. A released plan gets its own immutable executable
  route version.
- `WorkflowGroup` is deployment-owned. Its draft project ownership is compatibility-only and must
  not be required for new configuration writes.
- Station identity is physical endpoint identity; StationStep is the explicit stage/substage
  binding.

### Planning

The public model is `ProductionPlan`; the current Prisma `Project` table is retained as a physical
compatibility table until the migration audit is complete. New application services must never
expose `Project` as the API noun.

Canonical relations:

```text
ProductionPlan
  -> PlanDemandAllocation / model allocations
  -> ProductSpecification snapshot
  -> MaterialRequirement / PMRS reference
  -> PartsListVersion -> RouteStep -> PlanPart
  -> Lot -> LotPartAllocation -> Batch -> BatchPartLine
```

Required planning invariants:

- Plan totals are derived from active demand/allocation lines; no independently editable duplicate
  total becomes authoritative.
- Quantities use `numeric(18,6)` magnitude plus controlled UOM, usage basis, precision, and source
  representation. Existing integer columns are compatibility inputs until migrated.
- A released plan and its snapshots are immutable. Corrections create a new draft/version or an
  explicit compensating record.
- `PartsListVersion` and its `RouteStep` rows are immutable after publication.
- `LotPartAllocation` is required for new lot composition. The old singular lot `partId` is a
  compatibility bridge and is not used by new API commands.

### Execution/inventory/exceptions

```text
Batch -> StageEvent ledger -> BatchPositionProjection
Batch/Lot/PlanPart -> InventoryTransaction ledger
StageEvent -> RoutingViolation
StageEvent/Inventory/ProcessChange -> AuditRecord + OutboxMessage
```

Required invariants:

- Current position is rebuildable from accepted stage events; mutable current-stage fields are
  projections/compatibility only.
- New stage and inventory records reference stable `Subject` identity and canonical decimal
  quantity fields.
- Event and inventory records are append-only. A correction references the original record and
  records actor, reason, and time.
- Retry-safe commands use a general idempotency record, not only the catalog-specific record.
- Dashboard/report rows are projections, never write-side business truth.

### Quality

Add the smallest model that can persist the current active QC screen:

- `QualityInspection`: batch, stage/station, inspected quantity/UOM, inspector, lifecycle, and
  bounded evidence reference.
- `QualityDecision`: inspection, decision (`PASSED`, `FAILED`, `HOLD`), reason when required,
  actor, and immutable decision history.

This is deliberately not a full QMS. Sampling plans, defects/CAPA, laboratories, and NCR workflows
remain out of scope.

## Compatibility-to-canonical mapping

| Existing Prisma draft | Canonical boundary | Treatment |
|---|---|---|
| `Project` | `ProductionPlan` | Preserve table during bridge; canonical API/service noun is ProductionPlan |
| `ProjectModelAllocation` | Plan demand/model allocation | Preserve physical table initially; add explicit quantity/UOM/lifecycle/source fields |
| `ProductSpecification` | Product specification snapshot | Retain plan relation; immutable after release |
| `Pmrs` | PMRS reference/projection | Do not treat it as PATS inventory or issue truth |
| `PartsList` | `PartsListVersion` | Preserve table; add lifecycle/publication/source revision semantics |
| `RoutingStep` | `RouteStep` | Preserve table; enforce ordered executable route relation |
| `Part` | `PlanPart` | Preserve table; it is a plan snapshot, not the reusable catalog part |
| `Lot.partId` | `LotPartAllocation` | Add normalized allocation; old field is compatibility-only |
| `Batch.currentStageId/currentSubStageId` | `BatchPositionProjection` | Keep until projection cutover; never accept client edits |
| `StageEvent.actor` | `Subject` relation | New writes use stable subject ID; old string retained as evidence snapshot |
| `InventoryTransaction.*Quantity` | Decimal quantity specification | Add canonical fields; old integer fields are legacy bridge values |
| `CatalogIdempotencyRecord` | General `IdempotencyRecord` | Catalog record remains compatible; new command families use general record |
| No audit/outbox/projection records | `AuditRecord`, `OutboxMessage`, `BatchPositionProjection` | Add before write command implementation |

## I2 migration shape

I2 must be additive-first and isolated to the PATS PostgreSQL schema:

1. Add enums and canonical nullable/required fields needed by new records.
2. Add `LotPartAllocation`, `PlanDemandAllocation`, `MaterialRequirement`, quality records,
   `BatchPositionProjection`, `AuditRecord`, `OutboxMessage`, and general `IdempotencyRecord`.
3. Add indexes and checks for positive sequence, quantity precision/UOM, and stable lookup paths.
4. Backfill compatibility data only when the source value is unambiguous; otherwise leave the
   canonical field null and create an evidence/status record.
5. Do not drop `workspaceId`, singular lot part fields, mutable position fields, or legacy integer
   quantities until a database audit proves they are unused by active commands and no retained data
   would be lost.
6. Validate with a disposable PostgreSQL target, migration status, schema validation, generated
   client, and rollback/read-only inspection. Production migration is outside this pass.

## I1 exit evidence

- Full app/API specification discovery is complete.
- Current schema gaps are classified and mapped to canonical treatment.
- No model requires a second source of truth.
- Quality behavior has a persistence boundary.
- I2 migration scope and safety rules are explicit.
- Existing API tests remain green after documentation-only I1 work.

## I2 entry condition

I2 may begin with the user-approved transition plan, but it must not apply a production or
irreversible migration. The next implementation action is to update the PATS Prisma schema and
create an isolated migration for the additive canonical model.
