# Bandai PATS API Data Model Design

**Status:** PROPOSED CANONICAL CONCEPTUAL MODEL; not a migration specification

**Date:** 2026-07-15 (single-operational-context revision)

**Depends on:** Pass 1 evidence lock, Pass 2 bounded-context architecture, and the
2026-07-15 single-operational-context revision chain

## Model authority and notation

This document defines domain ownership, relational intent, and invariants for a future
PostgreSQL/Prisma implementation. It does not authorize a Prisma edit, migration, seed, or
runtime route. The existing `prisma/pats/schema.prisma` is implementation evidence only.

Labels in this document mean:

- `CONFIRMED_STANDARD`: required by the REST standard or endpoint checklist;
- `BUSINESS_EVIDENCE`: present in draft stakeholder-derived BRD/PRD material;
- `WORKING_DEFAULT`: a design recommendation used to keep the chain moving;
- `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`: not safe to encode in an implementation or
  write contract.

## Relational design rules

- Every resource identity is an opaque immutable UUID, ULID, or equivalent globally unique value.
  Business codes, names, initials, display names, filenames, and barcodes are attributes or
  lookup values, never primary identity.
- The first deployment owns records within one server-resolved operational context. No
  workspace/membership tenancy boundary is introduced. If multiple physical lines later share a
  database, a future `ProductionLine` identity and migration must be approved before line-scoped
  keys or selectors are added.
- Business relationships and invariants use PostgreSQL relations, foreign keys, unique/check
  constraints, and indexes. JSON is not a substitute for a relation.
- Published route definitions, execution ledgers, inventory ledgers, audit records, and outbox
  records are append-oriented or immutable. Corrections create explicit evidence rather than
  silently rewriting history.
- Timestamps are UTC at the API boundary and are stored with timezone-aware semantics. Actor and
  correlation references are retained on operational and audit records.
- Soft deletion is allowed only where retention or administrative lifecycle requires it. A deleted
  resource is normally hidden as `404` under the REST standard; operational evidence is not hard
  deleted by ordinary resource APIs.
- JSON fields must have a separately documented bounded schema, maximum size, and ownership.

## Canonical context model

### Operational context and identity

| Entity | Owner | Identity and key attributes | Operational ownership | Lifecycle/deletion |
|---|---|---|---|---|
| Subject | Identity and Authorization | Opaque internal subject ID plus provider/issuer subject pair | Deployment-wide identity | Active, disabled; provider identifiers are sensitive |
| SubjectAssignment | Identity and Authorization | Opaque assignment ID; subject + assignment kind/key unique within deployment | Deployment-scoped capability assignment | Active, suspended, revoked; revoke rather than delete for audit |
| Capability/role policy | Identity and Authorization | Stable capability key and policy version | Deployment capability vocabulary | Active/revoked; exact roles remain `NEEDS_CONFIRMATION` |
| ProductionLine (future) | Identity and Authorization / Catalog | Opaque line ID; immutable line code and display name | Only after D-001/D-029 confirms multiple lines share one database | Active, suspended, retired; no ordinary hard delete while evidence exists |

The first deployment has one server-resolved operational context. It does not persist a
`Workspace` tenant root, membership rows, or client-selected scope. `ProductionLine` remains a
future domain identity only if the physical line has meaningful business identity or a shared
database must serve multiple lines.

### Catalog and configuration

| Entity | Owner | Identity and key attributes | Operational ownership | Lifecycle/deletion |
|---|---|---|---|---|
| Product | Catalog | Opaque product ID; stable product code | Deployment-owned for first implementation; system/shared templates remain `NEEDS_CONFIRMATION` | Draft, published, retired; hide rather than erase referenced products |
| Model | Catalog | Opaque model ID; product relation; model number/code unique within product | Inherits product scope | Draft, published, retired |
| ModelPart | Catalog | Opaque model-part ID; part code unique within model | Inherits model scope | Draft, published, retired |
| WorkflowGroup | Catalog | Opaque ID; stable display order/version | Deployment-owned for first implementation; shared templates remain `NEEDS_CONFIRMATION` | Draft, published, retired |
| Stage | Catalog | Opaque stage ID; group relation; stable key/code | Inherits workflow scope | Draft, published, retired; historical references remain valid |
| SubStage | Catalog | Opaque substage ID; configurable attributes | Catalog scope | Draft, published, retired |
| SubStageEligibility | Catalog | Composite stage/substage relation identity | Inherits catalog scope | Exists while both definitions are valid |
| Station | Catalog | Opaque station ID; physical station code | Deployment-owned; future line ownership requires D-001/D-029 | Enabled, disabled, retired |
| StationStep | Catalog | Opaque binding ID; station + stage/substage relation | Deployment-owned | Active, disabled, retired |
| WorkInstruction | Catalog | Opaque instruction ID; stage/step + immutable version | Deployment-owned; shared templates remain `NEEDS_CONFIRMATION` | Draft, published, retired; published versions immutable |

The catalog hierarchy `Product -> Model -> ModelPart` is a reusable definition hierarchy. A
project plan copies or snapshots the selected definitions for execution; it does not hold live
aliases whose later catalog edits can change an active route. Catalog ownership/layering is D-005.

### Planning

The business materials call the top-level planning object `Project`, while the target endpoint
package uses `ProductionPlan`. This is a contract identity conflict, not a wording preference
(candidate D-024). The model uses `PlanningAggregate` below until that decision is accepted.

| Entity | Owner | Identity and key attributes | Operational ownership | Lifecycle/deletion |
|---|---|---|---|---|
| PlanningAggregate (`Project`/`ProductionPlan`) | Planning | Opaque plan ID; deployment-scoped business code | First deployment operational context | Draft, ready, released, paused, completed, cancelled |
| ProductSpecificationSnapshot | Planning | Opaque snapshot ID; plan unique | Inherits plan | Immutable after release; retained with plan |
| PMRSReference | Planning | Opaque reference ID; plan unique; external control/projection reference | Inherits plan | Draft, attached, superseded; never the PATS issue ledger |
| MaterialRequirement | Planning | Opaque requirement ID; plan/lot/model/part lineage; source revision | Inherits plan | Draft, approved, ordered, partially issued, fulfilled, cancelled |
| PlanModelAllocation | Planning | Opaque allocation ID; plan + model unique | Inherits plan | Draft, committed, superseded; planned quantity |
| PartsListVersion | Planning | Opaque version ID; plan + monotonically increasing version | Inherits plan | Draft, published, superseded; published versions immutable |
| RouteStep | Planning | Opaque step ID; parts-list version + plan part + positive order | Inherits route version | Immutable after version publication |
| PlanPart | Planning | Opaque part ID; plan + part code unique; optional catalog lineage | Inherits plan | Draft, committed, retired; no mutation when referenced by active execution |
| Lot | Planning | Opaque lot ID; immutable lot code; plan relation and route-version reference | Inherits plan | Planned, active, held, completed, cancelled |
| LotPartAllocation | Planning | Opaque allocation ID; lot + plan-part relation; quantity and unit | Inherits lot | Planned, committed, closed; decision-neutral cardinality boundary |

`LotPartAllocation` is the decision-neutral conceptual boundary for D-010. It permits a Lot to
group one or more planned Parts with explicit quantities without pretending that the current
draft's required `partId` is final. If stakeholders accept exactly one Part per Lot, the future
schema can enforce one allocation; if controlled multi-part grouping is accepted, the same
relation remains the source of truth. No write endpoint may expose either behavior as canonical
until D-010 is accepted.

### Execution

| Entity | Owner | Identity and key attributes | Operational ownership | Lifecycle/deletion |
|---|---|---|---|---|
| Batch | Execution | Opaque batch ID; immutable batch code and barcode/scan value unique within deployment | Inherits Lot operational context | Planned, active, held, closed, scrapped |
| BatchPartLine | Execution | Opaque line ID or stable batch + plan-part relation; quantity/unit | Inherits batch | Planned, active, closed; evidence retained |
| StageEvent | Execution | Opaque event ID; batch, lot, plan-part, route-version, stage/substage, occurrence, actor | Inherits batch | Recorded, accepted, blocked, superseded only via explicit correction |

A Batch is the scannable production/container unit. A barcode value can be rotated or represented
by a future QR encoding without changing the batch identity. The latest valid StageEvent is the
source evidence for position; a current-position projection is a cache that must be rebuildable.

### Inventory and traceability

| Entity | Owner | Identity and key attributes | Operational ownership | Lifecycle/deletion |
|---|---|---|---|---|
| InventoryTransaction | Inventory/Traceability | Opaque transaction ID; Receiving or Issuance type; batch/lot/part, source/target, expected/actual quantity | Inherits batch operational context | Recorded, accepted, voided only through explicit correction evidence |
| TraceProjection | Reporting/Projections | Opaque projection row identity; source version/freshness | Deployment/query scope | Rebuildable; may be discarded and rebuilt |

Raw-material consumption is outside PATS. Withdrawal Form references are external identifiers
until D-020 determines whether PATS validates or owns that process.

### Exceptions, audit, and platform records

| Entity | Owner | Identity and key attributes | Operational ownership | Lifecycle/deletion |
|---|---|---|---|---|
| RoutingViolation | Exceptions/Audit | Opaque violation ID; source StageEvent unique; expected-route snapshot | Inherits source event | Open, acknowledged, resolved, waived only if policy is accepted |
| VarianceAlert | Exceptions/Audit | Opaque alert ID; source transaction/event; observed threshold evidence | Inherits source | Open, acknowledged, resolved, waived only if policy is accepted |
| ProcessChangeLog | Exceptions/Audit | Opaque change ID; plan-part/batch, before/after route assignment, actor, reason | Inherits source | Recorded; append-only |
| AuditRecord | Exceptions/Audit | Opaque audit ID; deployment context, actor, action, resource, outcome, timestamp, correlation | Deployment/platform | Append-only and retention-controlled |
| IdempotencyRecord | Platform | Opaque record ID; actor, operation family, key hash, normalized payload hash, stored result | Actor + deployment context | Pending, completed, expired; bounded retention |
| OutboxMessage | Platform | Opaque message ID; aggregate/resource, event type, payload schema version | Deployment context | Pending, publishing, published, failed, dead-lettered |
| Job | Platform | Opaque job ID; owner, operation, progress, result/error reference | Deployment or platform scope | Queued, processing, completed, failed, cancelled |

### Assets and documents

| Entity | Owner | Identity and key attributes | Operational ownership | Lifecycle/deletion |
|---|---|---|---|---|
| Asset | Assets/Documents | Opaque asset ID; content type, byte size, checksum, private object reference, owner relation | Deployment or platform scope pending D-014 | Requested, uploading, verified, available, quarantined, retired |
| AssetLink | Assets/Documents | Opaque link ID; asset + typed target relation | Inherits target | Active, detached; detach does not erase evidence automatically |

MinIO object keys are private storage references, never public identity. The asset owner and
allowed target types remain D-014. `imageUrl` is a temporary transport representation, not a
stored canonical field.

## Relationship and constraint design

### Required relations

```text
Subject -> SubjectAssignments
Catalog Product -> Models -> ModelParts
WorkflowGroup -> Stages <-> SubStages
Deployment context -> Catalog and Stations -> StationSteps
PlanningAggregate -> allocations, specification snapshot, PMRS reference,
                     PartsListVersions -> RouteSteps -> PlanParts,
                     Lots -> LotPartAllocations
Lot -> Batches -> BatchPartLines and StageEvents
StageEvent -> RoutingViolation (zero or one source violation)
Batch/Lot/PlanPart -> InventoryTransactions
InventoryTransaction/StageEvent -> VarianceAlert (when detected)
StageEvent/Inventory/ProcessChange -> AuditRecords and OutboxMessages
Asset -> AssetLinks -> approved catalog/instruction targets
```

### Relational invariants

| Invariant | Preferred enforcement | Notes |
|---|---|---|
| IDs are immutable and globally unique | Database primary key + application immutability | Never derive identity from names, codes, files, or display labels |
| Business code uniqueness | Deployment-scoped unique constraint for first implementation | Catalog layering remains `NEEDS_CONFIRMATION` under D-005 |
| Foreign keys stay in the operational context | Ordinary foreign keys plus transaction validation | A future line-aware composite strategy requires D-001/D-029 |
| Published Parts List version cannot change | Database update guard + domain transition | New route means a new version |
| Route step order is unique and positive within a version/Part | Check + unique constraint | An unordered JSON array is insufficient as source of truth |
| Active Batch retains its route version | Required relation and domain guard | Later plan/catalog changes do not rewrite history |
| StageEvent references an allowed deployment/batch/route context | Transaction rule + FK constraints | Route evaluation uses the cited immutable version |
| Inventory quantities are non-negative and movement has valid endpoints | Check constraints + domain validation | Unit/scale and variance policy remain open |
| Ledger rows are not ordinary-updated/deleted | Repository policy + database privileges where practical | Correction creates a new record and audit evidence |
| Same idempotency key cannot represent two payloads | Unique actor/deployment/operation/key + payload hash check | Same payload replays stored result; different payload is `409` |
| Outbox publication intent is atomic with source mutation | Same database transaction | Delivery is retryable and at-least-once; consumers deduplicate |
| Projection rows are rebuildable | Source references + projection version/freshness | Projection loss does not lose business truth |

### Recommended indexes

- Deployment context plus stable code for every deployment-owned collection.
- Plan/route version and `(partsListVersionId, planPartId, stepOrder)` for route validation.
- Lot, batch, and batch-part relations for scan and trace lookups.
- `(batchId, occurredAt, id)` for StageEvent cursor pagination and latest-position rebuilds.
- `(batchId, recordedAt, id)` and `(lotId, recordedAt, id)` for inventory trace.
- `(sourceEventId)` for exception lookup and `(status, detectedAt, id)` for deployment queues.
- `(aggregateType, aggregateId, createdAt, id)` for outbox delivery and audit correlation.
- Asset checksum and lifecycle/owner indexes without exposing object keys.

## Metadata and sensitive-data boundary

Allowed bounded JSON shapes are:

- localized text with an explicit locale-key allowlist and required default locale;
- source provenance with provider/reference/status fields, excluding credentials;
- an immutable expected-route snapshot on a RoutingViolation;
- a preserved external payload only when its owner, schema version, size limit, and redaction
  policy are documented;
- bounded job error details that map to RFC 9457 problem fields.

JSON must not carry relational route steps, subject assignments, authorization rules, current batch
position, inventory balance, or asset ownership. Private object keys, tokens, credentials,
unredacted external payloads, and secrets are never API fields or audit detail.

## Deletion, retention, and correction boundary

- Catalog definitions may be retired but remain addressable to historical route snapshots.
- Planning definitions and published route versions are retained while any Lot/Batch references
  them.
- StageEvents, InventoryTransactions, ProcessChangeLogs, AuditRecords, and OutboxMessages are
  append-oriented. Deletion, retention period, and legal hold policy are `NEEDS_CONFIRMATION`.
- A correction references the original record, records actor/time/reason, and never makes the
  original evidence disappear. Rework/reversal semantics are deferred to Pass 4 and D-009.
- Assets are private and lifecycle-managed; object deletion cannot occur solely because a UI link
  disappeared. D-014 must define retention and orphan cleanup ownership.

## Data-model gaps and decisions carried forward

- `NEEDS_CONFIRMATION` D-001/D-029: whether a meaningful `ProductionLine` identity is required
  or the first deployment remains one implicit operational context.
- `NEEDS_CONFIRMATION` candidate D-024: Project versus ProductionPlan as planning aggregate noun.
- `NEEDS_CONFIRMATION` D-005: deployment-owned catalog only or future system/shared template
  layering.
- `NEEDS_CONFIRMATION` D-007: PMRS structure beyond a reference boundary.
- `NEEDS_CONFIRMATION` D-008: station-to-stage/substage mapping.
- `NEEDS_CONFIRMATION` D-009: rework, reversal, defect, and correction behavior.
- `NEEDS_CONFIRMATION` D-010: Lot cardinality and creation timing.
- `CONFLICTING` D-021: unit model, quantity scale, variance threshold, rounding, and override
  authority.
- `NEEDS_CONFIRMATION` D-014: Asset owner, linkable targets, retention, and object lifecycle.
- `NEEDS_CONFIRMATION` D-020: Withdrawal Form ownership and requiredness.
- `NEEDS_CONFIRMATION` D-017: audit retention and backup/recovery ownership.

## Migration-risk boundary

The existing draft's required `Lot.partId`, denormalized `partName`, mutable `Batch.currentStageId`,
JSON routing templates, `String actor`, and missing audit/outbox/asset records are not accepted as
the final model. They require a reviewed migration design after the decisions above are accepted.
No schema change is authorized by this document.

## Canonical naming reconciliation

For cross-document consistency, the following terms are used in the design package:

- The first deployment uses one server-resolved operational context. `Workspace` is not a
  canonical persistence or API entity. `ProductionLine` is product/domain language only when
  D-001/D-029 confirms its identity and scope.
- `PlanningAggregate` is the conceptual owner of plan/project records. The API route
  `production-plans` remains a working default pending D-024 and is not evidence that
  `ProductionPlan` has replaced the business `Project` noun.
- `PlanPart` is the execution-planning copy of a catalog `ModelPart`; it is not a live alias.
- `PartsListVersion` and its normalized `RouteStep` rows are the route source of truth for active
  execution. Catalog routing templates are inputs only.
- `LotPartAllocation` is the decision-neutral relation for D-010. No field, endpoint, or seed may
  silently enforce one-part Lots until the decision is accepted.

## Pass 2 client-evidence normalization design

The B248 artifacts show that the current `Product -> Model -> ModelPart` hierarchy and
`PartsListVersion -> RouteStep` route model do not fully represent the controlled product-content
domain. The following are candidate normalized concepts, not implementation approval.

### Controlled document and revision lineage (`NEEDS_CONFIRMATION`, candidate D-030)

Product Master, Parts List, and PMRS are distinct controlled artifacts. A bounded
`ControlledDocumentRevision` concept should retain, at minimum, document type, external control
number, revision label, document date, effective/superseded status, source asset/reference,
checksum, provenance, and approval references. The concept must not erase the owning domain's
meaning by turning all documents into one generic business aggregate.

`ProductSpecificationSnapshot` should reference the selected source revision and preserve an
immutable captured representation/checksum. `PartsListVersion` should reference the source Parts
List revision that supplied its content. `PMRSReference` may reference a PMRS revision/control
number while D-007 remains open; it must not imply that PATS owns the PMRS ledger.

Approval names/signatures are provenance until they can be mapped to accepted PATS subjects and
capabilities. They are not authorization identities by themselves.

### Part definition and applicability (`NEEDS_CONFIRMATION`, candidate D-031)

The evidence contains reusable parts shared across models, model-specific parts, accessories, and
packaging materials. A candidate `PartDefinition` should own stable internal identity, source part
code, name, kind/category, and lifecycle. A separate applicability relation should express
Product-wide, all-model, or model-specific applicability. The existing `ModelPart` concept may be
recast as that relation or retained as a compatibility term only after the business mapping is
accepted.

Part codes remain alternate business identifiers. The `B248-02-08` versus `B248-01-08ST`
Kuririn Body conflict prevents selecting one code as canonical for the affected source revision.

### BOM and material structure (`NEEDS_CONFIRMATION`, candidate D-031)

A candidate `BomDefinition`/revision and `BomLine` relation should represent parent part or
assembly, child part/material, applicability, quantity specification, unit, and relationship kind
such as component, decoration input, assembly component, or packaging component. BOM lines are
relational rows; they are not JSON arrays and are not `RouteStep` rows.

`No. of Ups` is treated as a process/mold parameter candidate, not as customer or execution
quantity. Packaging ratios such as `1/40` and `1/200` require explicit quantity/UOM policy and
must not be silently converted to pieces without an accepted denominator and rounding rule.

### Process specification versus execution route

Injection, decoration, assembly, and packaging evidence requires a candidate
`ProcessSpecification`/revision with typed process steps and bounded parameters. Examples include
mold/shot/cavity, material/colorant/mixing, decoration method, and packaging operation parameters.
The worksheet row order is evidence of document layout, not proof of executable route order.

`RouteStep` remains the plan-scoped execution route. A route step may reference an approved
process-specification step, but it must not contain the BOM tree or become the storage location for
all process parameters by default.

### Packaging hierarchy (`NEEDS_CONFIRMATION`, candidate D-031)

A candidate `PackagingSpecification`/revision and `PackagingLine` relation should represent
packaging levels and parent/child components, including small bags, capsules, assortment bags,
cartons, tape, and their applicable market/model scope. Ratios and usage basis belong to the line
quantity specification, not to a display-only label. The exact hierarchy and whether packaging is
planned, executed, or reference-only remain open.

### Safe publication rule (`NEEDS_CONFIRMATION`, candidate D-033)

An artifact with unresolved identifier, revision, or cross-reference conflicts may be captured as
draft evidence with its source and conflict record. It must not be marked effective, published as
an executable Parts List, or used to release a plan until the conflict-release policy and owner are
accepted. This is a safe working default, not an accepted business policy.

## Pass 3 PMRS, planning quantity, and lifecycle model

### PMRS ownership boundary — decisive target

The PMRS workbook is operational evidence of forecast, requisition, issue, balance, regional, and
demand-purpose activity. It does not establish whether PATS, Production Planning, Warehouse, or
another system owns the requisition or issue ledger.

The target boundary is decisive and implementation-shaped:

- PATS owns approved PATS-scope `MaterialRequirement` records and append-only issue evidence.
- PATS must not treat mutable PMRS `ISSUED` or `BALANCE` cells as canonical inventory truth.
- The existing append-oriented `InventoryTransaction` boundary records PATS-scope issues, with
  PMRS or Withdrawal Form references where applicable under D-020.
- External ERP/Warehouse remains the authority for physical stock and procurement. PMRS remains a
  controlled projection/reference, not a generic PATS spreadsheet table.

The `/00` and `/01` patterns are treated as external control/revision lineage candidates. They
must not be interpreted as a universal lifecycle until the business confirms whether `/01` is a
revision, supplemental requisition, issue cycle, or another document relationship.

### Planning demand dimensions

PMRS evidence distinguishes Japan, Asia, USA, and China allocations and demand purposes such as
sales, samples, inspection, replacement, promotion, development, overseas, and QC. A single
`PlanModelAllocation` quantity cannot preserve that meaning without losing planning evidence.

Candidate `PlanDemandAllocation` relation (`NEEDS_CONFIRMATION`, candidate D-034):

- planning aggregate and model lineage;
- market/region code;
- controlled demand purpose;
- planned quantity and explicit UOM/usage basis;
- source reference/revision and provenance;
- lifecycle and supersession evidence.

The relationship between dimensioned demand lines and the existing model total must be explicit:
the model total may be a validated sum/projection, or a separately committed quantity with a
reconciliation invariant. The API must not store two independently editable totals.

### Quantity and UOM invariants

The evidence requires a quantity specification richer than a bare decimal:

- magnitude and controlled UOM (`Pc`, length, or another accepted unit);
- optional usage basis/ratio, such as one component per 40 or one carton per 200;
- source value and source text where conversion is not accepted;
- precision, conversion, and rounding policy;
- whether the quantity is planned, ordered, issued, accepted, or derived.

Packaging ratios and tape usage must not be silently converted to pieces. `No. of Ups` remains a
process parameter, not a product quantity. D-021 remains `CONFLICTING` until the authoritative
quantity dimensions, scale, conversion, rounding, variance threshold, and override owner are
accepted.

### PMRS and quantity lifecycles

The PMRS reference lifecycle remains:

```text
draft -> attached -> superseded
```

Each supersession preserves the external control/revision and source snapshot; it does not update
the prior record in place. Candidate PATS-owned material requirements would use a separate
lifecycle such as:

```text
draft -> approved -> ordered -> partially-issued -> fulfilled
                         |                         |
                         v                         v
                      cancelled                 cancelled
```

This candidate lifecycle cannot authorize writes until D-007/D-020/D-021 are accepted. Accepted
issues remain append-oriented; corrections create linked evidence and derived balances are
rebuildable.

### Asia quantity discrepancy

The PMRS snapshot shows a 77,060 header quantity and evidence supporting a 77,860 revised/current
order total. These values must remain separate source observations in the reconciliation record.
Neither is selected as canonical by this pass. Any plan or requirement release depending on that
quantity is blocked by `CONFLICTING` source evidence until an owner confirms whether the document
is supplemental, revised, or stale.

## Pass 4 lifecycle and invariant design

These state machines are `WORKING_DEFAULT` design rules. A transition that depends on an
unresolved decision is shown as conditional and cannot authorize an implementation write.

### Planning aggregate

```text
draft -> ready -> released -> paused -> released
  |       |          |           |
  v       v          v           v
cancelled cancelled completed  cancelled
```

- `draft -> ready` requires a valid operational context, selected catalog snapshot, non-empty plan Parts,
  complete route definitions, and an available published Parts List version.
- `ready -> released` creates the immutable execution definition and its version. A released
  definition is what downstream Lots/Batches cite; post-release editing creates a new draft or
  version rather than mutating the released record.
- `released -> paused` is an administrative planning control only and does not rewrite active
  execution evidence. `paused -> released` requires an explicit resume decision and a new
  concurrency check.
- `released -> completed` requires the accepted completion rule for all owned Lots/Batches;
  because that rule is not yet ratified, completion validation remains `NEEDS_CONFIRMATION`.
- Cancellation requires an actor, reason, and an accepted rule that no irreversible execution
  evidence is invalidated. There is no implicit transition from completed/cancelled to draft.

### Lot

```text
planned -> active -> held -> active
    |        |       |
    v        v       v
 cancelled completed cancelled
```

- `planned -> active` occurs on the first accepted execution/receipt event under the final Lot
  creation policy; the exact trigger is `NEEDS_CONFIRMATION` with D-010.
- `active -> held` and `held -> active` require an authorized operational action, reason, actor,
  and audit record. A hold blocks new movements but does not erase history.
- `active -> completed` requires the accepted quantity and terminal-batch rule. `held` may be
  cancelled only under an explicit disposition policy.
- Lot cardinality remains represented by `LotPartAllocation`; no transition can infer a single
  Part from a display name or a current UI row.

### Batch

```text
planned -> active -> held -> active
    |        |       |
    v        v       v
 scrapped  closed  scrapped
```

- `planned -> active` occurs on the first accepted batch receipt or stage event.
- A held Batch cannot accept normal stage or inventory commands until resumed or scrapped.
- `active -> closed` requires the accepted terminal stage/completion rule. `active/held ->
  scrapped` requires an authorized disposition, reason, and audit evidence.
- Closed and scrapped Batches are terminal. Rework/reversal is not represented by reopening a
  Batch; D-009 must define whether a separate correction/rework record is later introduced.
- Current position is updated from the same transaction as the accepted StageEvent and can be
  rebuilt from valid events. A mutable position field must never be the sole source of truth.

### StageEvent

```text
recorded -> accepted
         \-> blocked
accepted/blocked -> superseded (explicit correction only)
```

- The command validates deployment context, Batch/Lot/Part linkage, cited route-version, stage eligibility,
  station policy, quantity, actor, and idempotency before committing the event.
- `accepted` means the event is valid under the cited route; `blocked` means the event is retained
  as evidence but cannot advance the Batch. A blocked route event may create a RoutingViolation.
- Supersession is not deletion. It requires a correction record, actor, reason, reference to the
  original, and an audit/outbox entry. The correction policy is `NEEDS_CONFIRMATION` under D-009.
- A generic PATCH endpoint must not mutate StageEvent state or timestamps.

### InventoryTransaction

```text
recorded -> accepted
         \-> rejected (validation evidence, if persisted)
accepted -> voided (compensating correction only)
```

- Only the currently evidenced `Receiving` and `Issuance` types are allowed; adding movement
  types requires a domain decision.
- Validation checks source/target, Batch/Lot/Part scope, quantity/unit, current available
  balance, Withdrawal Form reference policy, route/station rules, and idempotency in one
  transaction. The authoritative balance is derived from accepted ledger rows or a rebuildable
  projection, not a user-edited total.
- An accepted movement is never overwritten. A void or correction writes compensating evidence,
  links the original, records actor/reason, and updates projections atomically.
- Quantity and variance formulas remain conditional on D-021; `+/-5%` is not hardcoded by this
  design.

### RoutingViolation and VarianceAlert

```text
open -> acknowledged -> resolved
  |          |
  v          v
waived     waived
```

- `open` is created from source evidence and preserves the expected route/quantity context that
  existed at detection time.
- Acknowledgement records actor/time without claiming the source event is valid. Resolution or
  waiver requires an authorized capability, reason, and audit record; waiver is not available
  until its policy is accepted.
- A resolved or waived exception is terminal. A new source problem creates a new exception; it
  does not reopen historical evidence.

### ProcessChangeLog

`ProcessChangeLog` is append-only: `recorded` is the only source state. A process change is
accepted only when the caller has the future-approved capability, the target route is valid, the
change does not reverse completed work under the current forward-only rule, and the command
stores before/after route references, actor, reason, timestamp, and source correlation. The
permission and rework policy are `NEEDS_CONFIRMATION` (D-009 and role decisions).

### Asset

```text
requested -> uploading -> verified -> available -> retired
                    \-> quarantined
requested/uploading/verified -> quarantined
```

- An asset is `available` only after private-object ownership, content type, size, checksum, and
  association checks succeed.
- Failed or suspicious uploads are quarantined; a quarantined object is not returned through a
  read URL. Retiring metadata does not imply immediate byte deletion while retention is open.
- A client never controls a durable object key or turns a public URL into identity. D-014 defines
  the target-owner and cleanup policy before implementation.

### Job

```text
queued -> processing -> completed
                  \-> failed
queued/processing -> cancelled
failed -> queued (bounded retry only)
```

- `processing -> failed` stores a stable RFC 9457-compatible error reference and attempt count.
- A retry creates a new attempt under the same Job identity; terminal `completed`, `cancelled`,
  or exhausted `failed` jobs are not silently reopened.
- A `202 Accepted` command returns a Job resource location and clients poll that resource. Job
  ownership and retry policy are explicit per operation.

### OutboxMessage and AuditRecord

```text
Outbox: pending -> publishing -> published
                    |       \-> failed -> pending
                    \-> failed -> dead_lettered (terminal after bounded attempts)
Audit: append-only; no update/delete lifecycle
```

- The outbox row is written in the same database transaction as its source mutation.
- Publication is at-least-once. Consumers use the message ID and schema version for deduplication
  and tolerate retry. A dead-lettered message retains failure evidence and requires an explicit
  operational replay decision.
- Audit records capture deployment context, actor, action, resource, outcome, correlation, and time. They are
  not a replacement for StageEvents, InventoryTransactions, or domain exceptions.

## Invariant enforcement classification

| Rule | Database constraint | Domain validation | Transaction rule | Projection |
|---|---|---|---|---|
| Opaque immutable IDs, scoped business-code uniqueness | Primary/unique/check constraints | Reject attempted identity mutation | Verify deployment ownership on every referenced row | N/A |
| Route order and published-version immutability | Positive/unique step order; update guard where possible | Publish only a complete route | Lock/check version before release and execution | Route index may be cached |
| Lot/Batch relationship and terminal states | Foreign keys and status enum/check | Allowed transition and cardinality policy | Prevent simultaneous conflicting transitions | Current status summary |
| Stage route eligibility | Foreign keys for cited records | Evaluate Parts List version and station policy | Event, violation, audit, outbox, position update atomic | Batch position rebuild |
| Inventory quantity and movement | Non-negative checks, FK scope | Unit conversion, balance, variance, withdrawal policy | Ledger + projection + audit/outbox atomic | Balance and variance projections |
| Exception resolution | Source-event FK and unique source violation | Capability, reason, terminal resolution rule | Exception/audit/outbox atomic | Open-exception queues |
| Actor and authorization | Subject/assignment relation | Authorization capability and object access | Re-resolve assignment inside write transaction | Audit query indexes |
| Idempotency | Unique actor/deployment/operation/key | Payload normalization and replay/conflict decision | Store result with side effects | N/A |
| Outbox delivery | Unique message ID and status checks | Retry/dead-letter policy | Same-transaction creation; lease/attempt update | Delivery metrics |
| Projection freshness | Source version/reference keys | Rebuild contract | Atomic projection checkpoint | Freshness/status metadata |

## Retry, concurrency, and correction rules

- All externally visible commands that may be retried accept `Idempotency-Key`. The normalized
  payload hash includes semantic fields but excludes transport-only trace headers. Same actor,
  operation, key, and payload replays the original status/body/headers; same key with a different
  payload returns `409 Conflict`.
- A retry after an unknown network result must first use the same idempotency key. Clients must
  not generate a new key to guess whether a stage event or inventory movement committed.
- Mutable planning/configuration/exception resources expose ETags and require `If-Match` when the
  command can overwrite a newer version. A failed validator is `412 Precondition Failed`.
- Append-only event and ledger resources do not use a generic update path. Corrections are new
  records referencing the original, with explicit actor, reason, time, and audit/outbox evidence.
- No correction may create a backward stage transition or reopen a terminal resource unless a
  future accepted rework policy defines a separate state and evidence model.
- Duplicate scans/movements with a different key are domain conflicts when the business identity
  or source sequence proves they are duplicates; they are not silently coalesced.

## Lifecycle questions carried forward

- `NEEDS_CONFIRMATION` D-009: rework, reversal, rejection, and correction semantics.
- `NEEDS_CONFIRMATION` D-010: Lot creation timing and cardinality.
- `NEEDS_CONFIRMATION` D-021: quantity units, scale, variance threshold, rounding, and source of
  accepted tolerance.
- `NEEDS_CONFIRMATION` D-014: asset quarantine/retention/deletion ownership.
- `NEEDS_CONFIRMATION` D-017: audit, outbox, asset, and backup retention periods.
- `NEEDS_CONFIRMATION` D-025: canonical actor identity and optional historical snapshot.

## Pass 5 subject preferences and public identity mapping

Legacy/frontend evidence shows a per-subject locale preference and completed walkthrough state.
This is not authorization truth and must not be placed in catalog-content localization JSON.

Target `SubjectPreference` (D-036 proposed) is owned by Identity and Authorization or Platform and
contains a controlled locale such as `EN`, `JA`, or `FIL`. Target `SubjectWalkthroughCompletion`
rows preserve a walkthrough key, version, and completion time rather than a mutable comma-separated
string. These records do not grant capabilities or change object ownership.

`GET/PATCH /api/v1/users/me/preferences` may be the public self-service contract if the product
requires server persistence. It is a user-facing projection of the authenticated internal
`Subject`; it does not rename the canonical identity entity or expose provider identifiers.

## Decisive target model after manual-conflict review

The target model does not preserve conflicting manual values as parallel canonical fields. It
uses a controlled source-reconciliation boundary:

```text
source draft -> validation -> blocking issue -> authorized correction
             -> approved immutable revision -> plan/material release
```

### Canonical conflict resolutions

- `B248-02-08` is the canonical Kuririn Body part code. `B248-01-08ST` is a rejected source
  reference retained in correction evidence, not an API alias or second part identity.
- The latest approved Asia line-level quantity is canonical: `15,572` per model, `77,860` total,
  `77,060` issued, and `800` balance. Header totals are derived and validation fails when they do
  not equal line totals. The stale 77,060 header remains historical source evidence.

### Decisive material-control model

`MaterialRequirement` is a Planning-owned approved requirement derived from demand/BOM scope.
PATS-scope material issues are append-only Inventory evidence linked to that requirement; balance
is derived from accepted issue/correction records. PMRS remains a controlled external
document/projection and is never the mutable balance source. External ERP/Warehouse remains the
physical stock/procurement authority.

### Reconciliation issue model

Candidate `SourceReconciliationIssue` records the source revision, field/relationship path,
observed value(s), validation rule, blocking status, resolution value, resolver, reason, and audit
correlation. Its lifecycle is:

```text
open -> resolved
     \-> rejected
     \-> waived (authorized exception only)
```

Resolved values are applied to a new approved revision; the original observations remain immutable
evidence. A waived issue never silently changes the source value and requires an explicit capability
and reason.

## Pass 1 schema-normalization revision — canonical entity and ownership map

This section is the canonical reconciliation of the entity list from the normalization-revision
handover. It supersedes earlier candidate wording where that wording treated a source artifact,
planning snapshot, route, or PMRS quantity as the same responsibility.

| Entity | Owning context | Canonical responsibility | Explicit non-responsibility |
|---|---|---|---|
| `ControlledDocumentRevision` | Assets/Documents for lineage metadata; semantic source owner by document type | Stable controlled-source revision identity, external control/revision labels, provenance, source asset/checksum, and immutable approved-revision lineage | Not a generic Product/BOM/PMRS aggregate; does not own business quantities or execution route |
| `SourceReconciliationIssue` | Exceptions/Audit | Blocking or non-blocking validation finding attached to one source revision, with field/path, rule, observed evidence, and status | Does not rewrite the source revision or select authorization identities from document signatures |
| `SourceReconciliationResolution` | Exceptions/Audit | Append-only resolution evidence recording selected value, resolver, reason, `If-Match` basis, and outcome | Does not overwrite original observations; it causes a new corrected revision through the source owner |
| `SourceRevisionApproval` | Exceptions/Audit | Immutable approval evidence and audit correlation for a revision that passed the release gate | Does not make an unresolved or conflicted revision effective; source-owner capability is still required |
| `ProductSpecificationSnapshot` | Planning | Immutable plan-scoped capture of an approved Product Master revision and checksum | Not a live Product or catalog alias |
| `PartsListVersion` | Planning | Immutable plan-scoped executable route-version boundary, linked to an approved Parts List revision | Not a spreadsheet import, BOM tree, process parameter bag, or mutable route array |
| `PartDefinition` | Catalog | Reusable part/material/accessory/packaging identity with typed code namespace and lifecycle | Does not carry model quantity, route order, or execution event |
| `PartApplicability` | Catalog | Relational Product-wide, all-model, or model-specific applicability for a `PartDefinition` and source revision | Does not duplicate a shared part definition per model |
| `BomDefinition` / `BomLine` | Catalog | Versioned parent/child material structure with relation kind and quantity/UOM/usage basis | Does not define execution order, current inventory, or derived balance |
| `ProcessSpecification` / `ProcessSpecificationStep` | Catalog | Controlled injection, decoration, assembly, or packaging process definition and ordered process parameters | Does not become the scan route; `RouteStep` remains the execution order |
| `PackagingSpecification` / `PackagingLine` | Catalog | Versioned packaging hierarchy, parent/child components, packaging levels, ratios, and usage basis | Does not own commercial identity or warehouse issue evidence |
| `PlanDemandAllocation` | Planning | Dimensioned plan/model demand by market/region and controlled demand purpose with explicit quantity specification | Does not coexist with an independently editable model total |
| `PlanModelAllocation` | Planning | Derived/reconciliation-backed model summary from dimensioned demand, with source version/freshness | No independent write-side quantity or duplicate canonical total |
| `MaterialRequirement` | Planning | Approved PATS-scope requirement derived from accepted plan/demand/BOM lineage, with lifecycle and quantity specification | Does not store mutable `issued` or `balance` cells and does not become PMRS ownership |
| `PMRSReference` | Planning | External/control reference and source revision/provenance boundary for PMRS | Does not own the PATS issue ledger, physical stock, procurement, or editable balance |
| `PlanPart` / `RouteStep` | Planning | Plan snapshot of selected catalog part content and ordered executable route rows | Does not follow later catalog edits and does not absorb BOM/process/packaging structure |
| `InventoryTransaction` | Inventory/Traceability | Append-only PATS-scope receiving, issuance, and explicit correction evidence linked to a requirement when applicable | Does not mutate prior ledger rows or store balance as source truth |
| `SubjectPreference` / `SubjectWalkthroughCompletion` | Identity/Authorization | Subject-owned locale and versioned walkthrough completion records | Does not grant capabilities, define roles, or establish object ownership |

### Relationship boundaries

The canonical flow is:

```text
ControlledDocumentRevision
  -> SourceReconciliationIssue
  -> SourceReconciliationResolution (append-only)
  -> SourceRevisionApproval (only after blocking issues are resolved)
  -> owning-domain effective content

Product Master revision -> Product/Part/BOM/Process/Packaging definitions
approved Product Master revision -> ProductSpecificationSnapshot -> PlanningAggregate
approved Parts List revision -> PartsListVersion -> RouteStep -> PlanPart -> Execution
PlanDemandAllocation -> derived PlanModelAllocation
approved demand/BOM/plan lineage -> MaterialRequirement -> InventoryTransaction issue evidence
PMRSReference -> controlled source/projection reference only
Subject -> SubjectPreference and SubjectWalkthroughCompletion
```

The same source revision may be referenced by multiple owning-domain records, but it has one
lineage owner and one approval evidence boundary. A plan snapshot or route version is a new
immutable evidence boundary, not a second mutable copy of source truth. Unresolved source
conflicts remain `NEEDS_CONFIRMATION`/`CONFLICTING` at the release gate and cannot be made
effective by a read or write endpoint.

## Pass 2 schema-normalization revision — relational enforcement summary

The normalized relation matrix is the detailed key/index source for this conceptual model. Its
cross-document rules are:

- Source document identity and revision lineage are separate rows. Reconciliation issues,
  resolutions, and approvals are child evidence rows with strong foreign keys; approval never
  mutates the observed source revision.
- Part, product, document, external item, equipment, PMRS, and withdrawal identifiers remain
  typed by namespace and owning relation. A shared text value is not a global alias or primary
  key.
- Applicability, BOM, process, packaging, route, demand, requirement-lineage, and walkthrough
  repetitions are rows. Relationship quantities, order, scope, ratios, and purpose stay on those
  rows rather than on parent entities.
- `PlanDemandAllocation` is the write-side dimensioned demand relation. `PlanModelAllocation` is
  a derived summary with a source version; no independently editable model total is accepted.
- `MaterialRequirement` is the PATS-owned requirement row. When multiple demand/BOM sources
  contribute, typed bridge rows preserve 1NF/2NF and strong foreign keys. `InventoryTransaction`
  is the append-only issue evidence; issued and balance values are derived.
- JSON remains bounded evidence/provenance/parameter storage only. It cannot replace relational
  keys, route order, authorization assignments, material lineage, current position, or balances.

Candidate keys and indexes remain subject to the open namespace, lifecycle, station, Lot
cardinality, quantity, and source-revision decisions. They are design evidence, not migration
authorization.

### Decisive quantity policy

All quantity-bearing relations use magnitude, UOM, optional usage basis, precision, and source
representation. Ratios are calculated only through an approved UOM/usage rule. If a requirement
has no explicit tolerance, strict equality is the default and a variance creates a blocking or
resolvable exception according to the operation policy. No global ±5% rule is encoded.
