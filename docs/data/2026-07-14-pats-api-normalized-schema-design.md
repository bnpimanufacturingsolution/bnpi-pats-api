# Bandai PATS Normalized PostgreSQL Schema Design

**Status:** PROPOSED NORMALIZED DESIGN; not a Prisma schema or migration specification

**Date:** 2026-07-15 (single-operational-context revision)

**Depends on:**

- `docs/data/2026-07-14-pats-api-data-model-design.md`
- `docs/architecture/2026-07-14-pats-api-target-architecture.md`
- `docs/api/2026-07-14-pats-api-cross-cutting-design.md`
- `docs/decisions/2026-07-14-pats-api-design-decision-register.md`
- `docs/superpowers/chains/2026-07-15-pats-api-single-operational-context-revision-chain.md`

## Authority and non-goals

This document translates the conceptual PATS model into a normalized relational design that can
later be implemented with PostgreSQL and Prisma. It does not authorize a Prisma edit, migration,
backfill, seed, generated client, route, or runtime behavior. The existing `prisma/pats/schema.prisma`
and legacy schemas are read-only evidence and are not copied as canonical truth.

Open decisions remain labelled `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`. A neutral table or
relation may be designed to carry an open choice, but the document does not pretend that the
choice has been accepted.

## Normalization principles

### Identity and common columns

- Every table uses an opaque immutable UUID/ULID-equivalent primary key unless a bridge relation
  has an explicitly documented composite key. Business codes, names, barcodes, filenames, and
  provider identifiers are alternate attributes, never primary identity.
- The first deployment is one operational context, not a SaaS tenant system. Do not add
  `workspace_id`, workspace membership, or composite tenant FKs to the first schema. If D-029
  later confirms multiple physical lines in one database, introduce an explicit `production_line`
  scope through a reviewed migration.
- Mutable tables use `created_at`, `updated_at`, and a concurrency version/token. Append-only
  evidence uses `occurred_at`/`recorded_at`, `created_at`, and immutable actor/correlation fields;
  `updated_at` is intentionally absent or not semantically meaningful.
- Actor references use a provider-neutral `subject_id` candidate plus an optional immutable
  historical snapshot boundary. D-025 remains open; a free-form `String actor` is not canonical.
- State values are represented as controlled domain values. Final PostgreSQL enum/check strategy
  must follow accepted lifecycle decisions; no open business state is frozen here.
- Times are timezone-aware UTC values at the persistence boundary. Display/localization is an API
  concern, not a duplicated local-time column.

### Normal-form rules

- First normal form: repeated route steps, capability assignments, allocations, event evidence, asset links,
  audit outcomes, and job attempts are rows, not arrays in JSON.
- Second normal form: bridge tables carry attributes of the relationship, such as allocation
  quantity, route order, capability assignment status, or asset link role; those attributes do
  not sit on either parent table.
- Third normal form: codes, names, lifecycle values, and ownership references are stored once at
  their owning relation. Snapshot duplication is allowed only when it preserves immutable evidence
  and is named as a snapshot, not treated as live reference data.
- JSON/JSONB is restricted to bounded metadata, provenance, external reference payloads, and
  preserved evidence with an owner, schema version, maximum size, and redaction rule. It must not
  contain deployment membership, route steps, current position, inventory balance, or authorization
  truth.

### Type policy for implementation review

| Concept | Working relational type | Open/implementation note |
|---|---|---|
| Opaque identity | PostgreSQL `uuid`, application-generated UUID v4 | Working recommendation; use one project-wide type before Prisma implementation |
| Code/name/display text | bounded text/varchar | Exact lengths require domain confirmation; do not use filenames as identity |
| UTC time | `timestamptz` | API emits ISO 8601 UTC |
| Quantity | fixed precision numeric candidate, technically `numeric(18,6)` | Unit semantics, rounding, and variance policy remain D-021 `CONFLICTING`; revise scale if domain precision requires it |
| Boolean flags | boolean | Use status/lifecycle for meaningful state, not multiple contradictory flags |
| Version/concurrency | integer or opaque version token | ETag representation is transport-level; persistence token must be monotonic/immutable |
| Metadata | JSONB with bounded schema | Each field below names an owner and boundary; no unbounded payloads |
| Digest/checksum | bounded text/bytea candidate | Algorithm and canonical encoding require asset policy review |

## Operational context and identity relations

The first deployment is one operational context. It does not need a user-selectable tenant,
workspace membership, or cross-tenant query model. Authorization is still explicit: authenticated
subjects receive approved capabilities within the deployment, and every resource is checked for
ownership and lifecycle access. D-001 and D-029 remain open only for the future terminology and
multi-line evolution boundary.

### `subjects`

Purpose: provider-neutral internal actor identity.

| Attribute | Role | Nullability/meaning |
|---|---|---|
| `id` | primary identity | required, immutable |
| `provider` | identity source label | required only after D-006 accepts provider model |
| `issuer` | provider namespace | required for external subject uniqueness when applicable |
| `provider_subject` | provider identifier | required for external identity; sensitive and never API credential |
| `status` | active/disabled lifecycle | required |
| `display_name_snapshot`, `email_snapshot` | bounded support fields | optional, not authorization truth |
| `created_at`, `updated_at` | audit time | required for mutable record |

Candidate uniqueness is `(provider, issuer, provider_subject)`. The exact provider and issuer
mapping are D-006 `NEEDS_CONFIRMATION`.

### `subject_assignments`

Purpose: normalized role/capability assignment within the single deployment context. This relation
replaces workspace membership for the first implementation; it is not a tenant membership table.

| Attribute | Role | Nullability/meaning |
|---|---|---|
| `id` | primary identity | required |
| `subject_id` | actor FK | required |
| `assignment_kind` | role/capability discriminator | required; vocabulary open |
| `assignment_key` | stable approved key | required; not a display label |
| `status` | active/revoked candidate | required |
| `created_at`, `revoked_at` | lifecycle/audit | required/conditional |

Candidate unique constraint: active `(subject_id, assignment_kind, assignment_key)`. If the
accepted authorization model has separate role and capability tables, this relation may be split
before implementation. Until then, no role enum or default admin assignment is canonical.

### Optional `production_lines` future relation

This relation is not part of the first single-context persistence slice. If D-029 confirms that one
database will serve multiple physical lines, add `production_lines` with an immutable ID, stable
code, lifecycle, and explicit ownership. Then add `production_line_id` only to line-owned relations
and introduce line-aware authorization/FKs through a reviewed expand/contract migration. Do not add
this table merely to simulate SaaS tenancy.

## Catalog and configuration relations

Catalog scope is deployment-owned for the first implementation. Do not add a nullable global versus
global/layered scope field. If multiple lines or shared catalog templates are later confirmed,
introduce an explicit catalog/line relation and precedence rules through a separate design gate.

### Catalog ownership boundary

**Working recommendation:** catalog/configuration relations are owned by the one deployment
context. Products, Models, ModelParts, workflow definitions, stations, and work instructions use
ordinary relational ownership and scoped business-code uniqueness. D-005 remains
`NEEDS_CONFIRMATION` for future system templates or multiple-line sharing, but no layered catalog
table is required for the first implementation.

### `products`

Purpose: catalog product definition.

Core attributes: `id`, stable `code`, `name`, `description`,
`status`, `published_at`, `retired_at`, audit/concurrency columns, and bounded metadata.

Unique code scope depends on D-005. Historical plan snapshots must not follow a later product edit.

### `models`

Purpose: product model definition.

Core attributes: `id`, `product_id`, stable `code`/model number, name, status, published/retired
times, audit/concurrency columns, and bounded metadata. Candidate unique key `(product_id, code)`.

### `model_parts`

Purpose: model-level part definition.

Core attributes: `id`, `model_id`, stable `part_code`, name, description, status, audit/concurrency
columns, and bounded metadata. Candidate unique key `(model_id, part_code)`.

`ModelPart` is catalog lineage. `PlanPart` below is a planning/execution copy or snapshot and is
not a live alias whose later catalog edits can rewrite an active plan.

### `workflow_groups`

Purpose: reusable workflow grouping.

Core attributes: `id`, deployment-owned catalog boundary, stable key/code, display name, status, version,
published/retired times, audit/concurrency columns, and bounded metadata.

### `stages`

Purpose: workflow stage definition.

Core attributes: `id`, `workflow_group_id`, stable key/code, name, display order candidate, status,
audit/concurrency columns, and bounded metadata. Published historical route references retain the
stage identity.

### `sub_stages`

Purpose: optional finer-grained workflow definition.

Core attributes: `id`, `stage_id`, stable key/code, name,
display order, status, audit/concurrency columns, and bounded metadata. The exact station mapping
remains D-008 `NEEDS_CONFIRMATION`.

### `sub_stage_eligibilities`

Purpose: normalized stage/substage compatibility relation.

Core attributes: `stage_id`, `sub_stage_id`, status/validity interval if needed, audit time, and
optional bounded rule metadata. Candidate composite uniqueness prevents duplicate eligibility.

### `stations`

Purpose: physical or logical production station.

Core attributes: `id`, deployment-owned identity and optional future line relation, stable station code, name, status, enabled
state if distinct from lifecycle, audit/concurrency columns, and bounded adapter metadata.

### `station_steps`

Purpose: normalized binding between a station and the accepted stage/substage execution unit.

Core attributes: `id`, `station_id`, target stage/substage relation, binding status, sequence or
eligibility attributes, audit/concurrency columns, and bounded metadata. D-008 controls whether
the target is a stage, substage, or configurable bundle.

### `work_instructions` and `work_instruction_versions`

Purpose: instruction identity plus immutable published versions.

`work_instructions` owns stable identity and target catalog relation. `work_instruction_versions`
owns version number, content/asset references, status, author subject candidate, checksum, and
published/retired timestamps. A published version is immutable; edits create a new version.
Instruction content is a bounded reference/asset relation, not an unbounded route or credential
payload.

## Planning relations

### `planning_aggregates`

Purpose: production planning aggregate; `ProductionPlan` is the working canonical noun for the
first API while D-024 remains `NEEDS_CONFIRMATION` against the business term `Project`.

Core attributes: `id`, stable business code, name/description, `status`, planned
dates if accepted, `released_at`, `cancelled_at`, actor/correlation fields, audit/concurrency
columns, and bounded metadata.

The public noun and compatibility mapping remain D-024 `NEEDS_CONFIRMATION`. No database table
name is a final public API identity until that decision is accepted.

### `product_specification_snapshots`

Purpose: immutable plan-specific product specification snapshot.

Core attributes: `id`, `planning_aggregate_id`, source catalog references where known, immutable
schema version, captured content under a bounded schema, captured time, and checksum/provenance.
It is a snapshot by name and must not be used as a live product master.

### `pmrs_references`

Purpose: minimal external/reference boundary for PMRS.

Core attributes: `id`, `planning_aggregate_id`, external system/reference code, status, bounded
provenance, created/attached/superseded times, and actor/correlation fields. D-007 prevents
inventing PMRS-owned tables or relationship cardinality.

### `plan_model_allocations`

Purpose: planned model quantities within a planning aggregate.

Core attributes: `id`, `planning_aggregate_id`, `model_id`/catalog lineage candidate,
`planned_quantity` and unit boundary, status, audit/concurrency columns, and bounded metadata.
Candidate unique key `(planning_aggregate_id, model_id)` depends on accepted allocation rules.

### `plan_parts`

Purpose: planning-owned part snapshot/lineage, separate from live catalog `model_parts`.

Core attributes: `id`, `planning_aggregate_id`, optional `model_part_id` lineage, immutable part
code/name snapshot, quantity policy boundary, status, audit/concurrency columns, and bounded
metadata. The copied code/name is intentionally an evidence snapshot, not denormalized live truth.

### `parts_list_versions`

Purpose: immutable route definition version owned by a planning aggregate.

Core attributes: `id`, `planning_aggregate_id`, monotonically increasing version number, status,
published/superseded times, publication actor/correlation, source snapshot references, and
concurrency/audit columns. Candidate unique key `(planning_aggregate_id, version_number)`.

### `route_steps`

Purpose: normalized ordered route rows.

Core attributes: `id`, `parts_list_version_id`, `plan_part_id`, positive `step_order`, stage/substage
and station binding candidates, expected instruction version, eligibility/status, and immutable
route evidence. Candidate unique keys enforce one step per `(version, plan_part, step_order)` and
prevent duplicate route assignments. Route rows are not a JSON array.

### `lots`

Purpose: planned production grouping retained by execution.

Core attributes: `id`, `planning_aggregate_id`, released route/version reference, immutable lot code,
status, planned/active/completed/cancelled times, actor/correlation fields, audit/concurrency
columns, and bounded metadata.

`lot_part_allocations` below carries cardinality and quantity. The working recommendation is
controlled multi-Part grouping; a required singular `part_id` remains absent while D-010 is open.

### `lot_part_allocations`

Purpose: normalized Lot-to-PlanPart relationship with quantity and unit boundary.

Core attributes: `id`, `lot_id`, `plan_part_id`, quantity/unit candidate, allocation status,
committed/closed times, audit/concurrency columns, and bounded metadata. Candidate uniqueness and
cardinality constraints are D-010-dependent alternatives.

## Execution relations

### `batches`

Purpose: scannable production/container unit.

Core attributes: `id`, `lot_id`, immutable batch code, barcode/scan value as an alternate lookup,
status, route/version reference, lifecycle timestamps, actor/correlation fields, audit/concurrency
columns, and bounded metadata.

`current_stage_id`/`current_position` is not authoritative. It belongs only in a projection below.

### `batch_part_lines`

Purpose: normalized Batch-to-PlanPart quantity relation.

Core attributes: `id`, `batch_id`, `plan_part_id` or lot-allocation lineage, quantity/unit boundary,
status, lifecycle timestamps, audit/concurrency columns, and bounded metadata. Candidate unique
key `(batch_id, plan_part_id)` depends on D-010/D-021.

### `stage_events`

Purpose: immutable execution evidence for a batch/part at a route position.

Core attributes: `id`, `batch_id`, `lot_id`, `batch_part_line_id`, `parts_list_version_id`,
`route_step_id`, stage/substage/station references, event type, occurred/recorded times,
subject/actor candidate, correlation/trace references, outcome, and bounded evidence metadata.

The event stores the cited route/version and expected-route snapshot needed to preserve historical
meaning. A duplicate retry is handled by the idempotency relation, not by rewriting an event.

### `batch_position_projections`

Purpose: rebuildable current-position/read model.

Core attributes: `batch_id` or batch-part projection identity, latest accepted event ID, route step,
position status, source sequence/version, computed time, and freshness metadata. It is disposable
and must be derivable from `stage_events`; it is not a write-side source.

## Inventory and traceability relations

### `inventory_transactions`

Purpose: append-oriented Receiving/Issuance/movement evidence.

Core attributes: `id`, transaction type, deployment context, batch/lot/plan-part lineage,
source and destination reference boundary, quantity/unit candidate, external withdrawal reference
candidate, occurred/recorded times, actor/correlation fields, status/correction linkage, checksum
or source evidence, and bounded metadata.

Source/destination location ownership, unit scale, rounding, variance threshold, and Withdrawal
Form behavior remain D-020/D-021 open. The working technical quantity representation is positive
fixed-precision magnitude plus transaction type; the table must not be implemented with a free-form balance
JSON or a silent `+/-5%` rule.

### `trace_projection_rows`

Purpose: rebuildable trace query projection.

Core attributes: projection identity, deployment/query scope, source record references, source version,
freshness time, and bounded denormalized read fields. Every row must point back to source events,
transactions, plans, lots, or batches; it cannot become a write source.

## Exceptions and change evidence

### `routing_violations`

Purpose: explicit exception linked to one source `stage_event`.

Core attributes: `id`, `source_stage_event_id`, expected route/version snapshot, observed stage/
station evidence, status, resolution/waiver reason boundary, actor/correlation fields, detected/
resolved times, concurrency columns, and bounded metadata. Candidate unique source-event relation
prevents duplicate exception rows.

### `variance_alerts`

Purpose: exception linked to one source inventory/event record.

Core attributes: `id`, source transaction/event reference, expected/observed quantity boundary,
unit/scale placeholder, threshold evidence snapshot, status, resolution/waiver fields, actor/
correlation fields, timestamps, concurrency columns, and bounded metadata. D-021 prevents final
numeric/threshold constraints here.

### `process_change_logs`

Purpose: append-only, reviewed process-change evidence.

Core attributes: `id`, source plan/part/batch relation, before/after route assignment snapshot,
reason, actor subject candidate, correlation, occurred/recorded time, and bounded evidence. A
process change is a new record, not an update to a source event.

## Platform and operational relations

### `audit_records`

Purpose: immutable security/domain audit evidence.

Core attributes: `id`, deployment/platform scope, actor subject candidate, optional historical actor
snapshot, action, resource type/ID, outcome, request/correlation/trace IDs, occurred time, and
redacted bounded metadata. Tokens, credentials, private object keys, and raw claims are excluded.

### `idempotency_records`

Purpose: durable key reservation and exact response replay boundary.

Core attributes: `id`, deployment/actor scope, operation family, key or protected key digest, normalized
request hash, reservation status, response status, response headers, bounded response body or
reference, created/completed/expiry times, and failure metadata. Candidate unique key is
`(deployment_or_scope, actor_subject_id, operation_family, key_digest)`.

Response storage size and retention are operational decisions. Persistence must atomically reserve
the key and store the result with the source mutation for externally visible commands.

### `outbox_messages`

Purpose: transactional publication intent.

Core attributes: `id`, deployment scope, aggregate/resource type and ID, event type, schema version,
deduplication key, bounded serialized payload or payload reference, status, attempts, next-attempt
time, published/dead-letter times, error class, and created time. Candidate unique deduplication
key prevents duplicate publication intent.

### `jobs` and `job_attempts`

Purpose: async operation state plus retry evidence.

`jobs` owns operation, deployment/owner scope, status, progress, timestamps, result/error reference,
concurrency token, and bounded metadata. `job_attempts` owns attempt number, started/completed
times, outcome, retry scheduling, and redacted error reference. Job errors map to stable Problem
Details without storing stack traces or secrets as API data.

### `projection_checkpoints`

Purpose: source/projection rebuild and freshness boundary.

Core attributes: projection name/version, source cursor or high-water mark, last successful time,
status, error class, rebuild run ID, and bounded metadata. A checkpoint never replaces source
records and can be reset during a rebuild.

## Assets and private object metadata

### `assets`

Purpose: API-owned metadata for private MinIO bytes.

Core attributes: `id`, deployment owner boundary, object-storage provider/bucket boundary, private object
reference (never API identity), content type, byte size, checksum, lifecycle status, requested/
verified/retired times, actor/correlation fields, and bounded metadata. The API owns metadata and
authorization; MinIO owns private bytes. D-014/D-027 remain open for retention, backup, and orphan cleanup.

### `asset_links`

Purpose: normalized typed link between an Asset and an approved catalog/instruction/plan target.

Core attributes: `id`, `asset_id`, target relation boundary, link role, active/detached status,
created/detached times, actor/correlation fields, and bounded metadata.

A generic `(target_type, target_id)` is only a temporary conceptual alternative because it cannot
provide a database FK. The final implementation must choose per-target link tables or an accepted
strong relation strategy before asset writes are enabled.

## Bounded metadata registry

The following are the only conceptual JSON owners in this design. Each must receive an explicit
maximum size, schema version, redaction rule, and owner before implementation:

| Owner | Allowed purpose | Prohibited content |
|---|---|---|
| Catalog definitions | localized text/provenance | relationships, auth, secrets |
| Product specification snapshot | immutable external snapshot under accepted schema | unbounded external payload, credentials |
| Route violation | expected-route evidence snapshot | live route configuration or raw token |
| Stage/inventory evidence | bounded device/source evidence | balances, capability assignments, private keys |
| Audit/outbox/job | redacted bounded detail or serialized event contract | credentials, bearer tokens, unbounded body |
| Asset | provider/checksum/provenance metadata | durable secret, public private-object key |
| Projection/checkpoint | rebuild/freshness metadata | source-of-truth mutation |

## Pass 1 schema-normalization revision — canonical entity and ownership map

The following ownership map is authoritative for this revision. It resolves the earlier risk of
adding source, planning, and control rows as aliases for one another. A supporting
`controlled_documents` parent relation is permitted as the stable document-family identity; it
is not a generic business aggregate and is not exposed as a substitute for the owning domain.

| Relation | Owner | Required lineage | Canonical role | Must not absorb |
|---|---|---|---|---|
| `controlled_documents` / `controlled_document_revisions` | Assets/Documents for lineage; semantic owner by `document_type` | Document family and immutable revision | Source control number, revision/date, provenance, source asset/checksum, and revision status | Product/BOM/PMRS meaning, route order, or issue balance |
| `source_reconciliation_issues` | Exceptions/Audit | One controlled document revision | Validation rule, field/relationship path, observed evidence, blocking status | Corrected source values or authorization identity inferred from signatures |
| `source_reconciliation_resolutions` | Exceptions/Audit | One reconciliation issue and resolver subject | Append-only selected value, reason, `If-Match` basis, and outcome | In-place source revision edits |
| `source_revision_approvals` | Exceptions/Audit | One controlled document revision and approver subject | Immutable approval evidence and release-gate audit correlation | Approval of a revision with open blocking issues |
| `product_specification_snapshots` | Planning | Planning aggregate and approved Product Master revision | Immutable plan capture/checksum of selected product content | Live catalog alias or current Product Master state |
| `parts_list_versions` | Planning | Planning aggregate and approved Parts List revision | Immutable executable route-version identity | Spreadsheet rows, BOM hierarchy, process parameters, or mutable JSON route |
| `part_definitions` | Catalog | Approved source revision when controlled | Reusable part/material/accessory/packaging identity and typed code | Model quantity, route order, or execution evidence |
| `part_applicabilities` | Catalog | Part definition, Product/Model scope, source revision | Product-wide, all-model, or model-specific applicability | Duplicated shared part definitions |
| `bom_definitions` / `bom_lines` | Catalog | Approved Parts List/Product Master content revision | Versioned parent/child structure and quantity/UOM/usage basis | Execution order or mutable inventory balance |
| `process_specifications` / `process_specification_steps` | Catalog | Approved source revision and target definition | Controlled process family, ordered process steps, and bounded parameters | Assumed scan route or unbounded external payload |
| `packaging_specifications` / `packaging_lines` | Catalog | Approved source revision and target scope | Packaging levels, parent/child components, ratios, and usage basis | Commercial identity or warehouse issue ledger |
| `plan_demand_allocations` | Planning | Planning aggregate, model, source revision | Market/region and demand-purpose quantity rows | Independently editable model totals |
| `plan_model_allocations` | Planning | Planning aggregate, model, demand source version | Derived/reconciled model summary for reads | Second write-side demand truth |
| `material_requirements` | Planning | Approved plan/demand/BOM lineage and source revision | PATS-owned approved requirement and quantity lifecycle | PMRS mutable `issued`/`balance` columns |
| `pmrs_references` | Planning | Planning aggregate and controlled PMRS revision/reference | External/control projection reference and source observations | PATS issue ledger, physical stock, or procurement ownership |
| `plan_parts` / `route_steps` | Planning | Plan, selected part definitions, and approved Parts List revision | Plan snapshots and ordered execution route | Live catalog mutation, BOM/process/packaging content |
| `inventory_transactions` | Inventory/Traceability | Requirement/lot/batch/part lineage as applicable | Append-only PATS-scope Receiving/Issuance/correction evidence | Overwritten ledger rows or source balance fields |
| `subject_preferences` / `subject_walkthrough_completions` | Identity/Authorization | One subject; walkthrough key/version where applicable | Locale and versioned self-service completion state | Capability, role, or object ownership truth |

### Source and planning boundary

`ControlledDocumentRevision` is a lineage record. Product Master, Parts List, and PMRS remain
distinct `document_type` values with distinct semantic owners. A source revision can be referenced
by a catalog or planning row only after its approved status and applicable reconciliation gate
pass. `SourceRevisionApproval` records approval evidence; it does not transfer source meaning to
Exceptions/Audit.

`PlanModelAllocation` remains a read-side summary with a demand-source version/freshness marker.
`PlanDemandAllocation` is the only editable dimensioned demand relation. `MaterialRequirement`
is created from accepted plan/demand/BOM lineage and is the only PATS-owned requirement identity;
`PMRSReference` cannot provide a second requirement or issue identity. `InventoryTransaction` is
the append-only issue evidence relation and its derived balance is a projection.

The normalized schema therefore has one owner per business fact, one explicit evidence boundary
for source corrections, and no first-release workspace/line tenancy relation. Cross-context
references use application-facing ports and ordinary relational FKs; they do not import another
context's Prisma model or transaction object.

## Constraint and operational-context design

This section maps the normalized relations to database-enforced invariants. It remains a design
proposal: the final constraint literals, PostgreSQL type choices, and trigger/privilege strategy
require the decision gate and an implementation review.

### First-deployment scope policy

The first PATS deployment has one operational context. Ordinary relational foreign keys and
application transaction validation are sufficient; there is no `workspace_id`, membership FK,
cross-tenant query, or composite tenant key in the first schema. Deployment context is a runtime
and authorization boundary, not a client-selected resource.

If D-029 later confirms multiple physical lines in one database, the migration must add an explicit
`production_line_id` to line-owned relations, define line-aware authorization, and choose whether
composite line-aware FKs are required. That future choice must be reviewed separately; it must not
be preloaded into the single-context schema.

All writers still use one reviewed repository/transaction boundary, and database constraints remain
the source of relational integrity. The absence of SaaS tenancy does not permit unvalidated object
ownership or arbitrary cross-context references.

### Constraint matrix

| Area | Candidate database constraint | Additional domain/transaction rule | Status |
|---|---|---|---|
| Identity | Immutable opaque primary key on every durable relation | IDs are generated at the write boundary and never reused | Working design; UUID vs ULID is open |
| Operational context | First deployment has one implicit deployment context; ordinary FKs protect relational ownership | Capability and object ownership are checked inside the command transaction | D-029 `NEEDS_CONFIRMATION` for future multi-line scope |
| Subject identity | Unique `(provider, issuer, provider_subject)` when populated | Provider mapping and disabled-subject behavior are accepted by identity policy | D-006 `NEEDS_CONFIRMATION` |
| Operational code | Unique deployment-owned code where a physical line/configuration identity exists | Retired codes are not silently reassigned when evidence remains | D-001/D-029 `NEEDS_CONFIRMATION` |
| Catalog codes | Candidate unique keys such as `(product_code)`, `(product_id, model_code)`, and `(model_id, part_code)` | Deployment-owned catalog and publication rules are enforced at command boundary | D-005 `NEEDS_CONFIRMATION` |
| Subject assignment | Candidate unique active `(subject_id, assignment_kind, assignment_key)` | Capability vocabulary and assignment lifecycle are accepted before authorization writes | D-026 `NEEDS_CONFIRMATION` |
| Foreign keys | Restrict source deletion by default; use explicit composite or scalar FK strategy | Retire records instead of deleting operational evidence | Cascade policy requires review |
| Route version | Unique `(planning_aggregate_id, version_number)` | Only one accepted published version per aggregate at a release boundary | D-011 working; publication transition open |
| Route order | Positive `step_order`; candidate unique `(parts_list_version_id, plan_part_id, step_order)` and, if route-wide, `(parts_list_version_id, step_order)` | Route completeness and station eligibility are checked before publication | Route semantics open |
| Route references | Route step, batch, lot, and event retain the cited parts-list version | Event route/version must match the released lot and batch in one transaction | Required invariant; exact FK shape follows operational-scope strategy |
| Lot allocation | No singular `part_id` while cardinality is open; candidate uniqueness on `(lot_id, plan_part_id)` | Release requires accepted allocation cardinality and quantity policy | D-010 `NEEDS_CONFIRMATION` |
| Batch lines | Candidate unique `(batch_id, plan_part_id)` or lot-allocation lineage | Batch composition is frozen at the accepted lifecycle transition | D-010/D-021 open |
| Temporal values | Checks such as `resolved_at >= detected_at` and end after start | State transition determines which timestamps must be present | Final state literals open |
| Published snapshots | Published route/instruction/snapshot rows are immutable after publication | Corrections create a new version or append evidence | Trigger/privilege or repository enforcement required |
| Stage evidence | Required source IDs and event occurrence time; no update/delete path | Event is appended only when cited batch/route/station context is valid | Append-only enforcement required |
| Quantity | Candidate fixed-precision numeric with non-negative magnitude and approved scale | Movement sign, unit conversion, rounding, and variance threshold follow D-021 | D-021 `CONFLICTING` |
| Inventory correction | Correction points to the original transaction and cannot mutate it | Corrections are append-only and preserve actor/reason evidence | D-020/D-021 open |
| Exception resolution | Resolution fields are jointly present when status is resolved/waived | Resolution requires authorized actor and concurrency check | Status vocabulary open |
| Audit evidence | Required action/resource/time/correlation fields; no delete/update grant | Redaction and retention are operational policy | D-025/D-026/D-023 open |
| Idempotency | Candidate unique `(scope, actor, operation_family, key_digest)` and request hash | Same key with a different normalized hash returns conflict; same hash replays exact result | Required; retention open |
| Outbox | Candidate unique deduplication key; payload schema version required | Mutation and publication intent commit atomically; delivery is retryable | Required; event vocabulary open |
| Jobs | Unique attempt number per job; progress/status fields are bounded | Worker claim, lease, retry, and terminal transitions are concurrency-safe | Operational policy open |
| Assets | Candidate checksum/object-reference uniqueness where ownership permits | Bytes remain private; verification, orphan cleanup, and retention are explicit | D-014/D-027 `NEEDS_CONFIRMATION` |
| Projections | Projection rows carry source ID/version and checkpoint identity | Projection can be deleted and rebuilt without changing source evidence | Rebuild procedure must be approved |

Status columns should use bounded text plus table-local checks or an accepted reference strategy
after lifecycle vocabularies are frozen. PostgreSQL enums are not selected here because changing
an open business lifecycle is a migration decision. A check constraint must never be used to
pretend that an unresolved status vocabulary is accepted.

### Delete, immutability, and append-only policy

- `RESTRICT` is the default for source records referenced by lots, batches, events, inventory,
  exceptions, audit, outbox, or external evidence. Retirement/status transitions preserve
  identity and history.
- Hard delete is limited to explicitly disposable projections, expired idempotency records under
  retention policy, and other platform data whose deletion cannot remove business evidence.
- Published route versions, work-instruction versions, specification snapshots, stage events,
  inventory transactions, audit records, process-change logs, and outbox intent are append-only
  at the domain boundary. A correction is a new record with a source reference.
- Database enforcement may use privileges, row-level triggers, or a dedicated write role. The
  final mechanism must be chosen with the Prisma transaction pattern; application convention
  alone is not sufficient for high-value evidence.

## Candidate index and access-path design

Indexes below are candidates derived from endpoint and worker access patterns. Unique constraints
may provide some of them automatically. The final migration must confirm actual query plans,
cardinality, retention, and write cost rather than adding every possible index.

| Relation/access pattern | Candidate index | Reason and boundary |
|---|---|---|
| Deployment-owned relation lookup | Parent ID/FK indexes; future `(production_line_id, id)` only if D-029 is accepted | Object ownership and future line-scoped resolution |
| Deployment/catalog lookup | Stable code unique within the single deployment; future line/code unique only after D-029 | Code lookup without inventing tenant scope |
| Subject lookup | `(provider, issuer, provider_subject)` unique | Provider identity resolution; sensitive values are not API response identity |
| Capability authorization | `(subject_id, status, assignment_kind, assignment_key)` | Resolve deployment-scoped capability assignments |
| Product/model/part catalog | Parent ID plus code, for example `(product_id, model_code)` and `(model_id, part_code)` | Scoped catalog lookup and alternate-code uniqueness |
| Workflow/station configuration | Parent ID plus stable key/code and station target | Resolve eligible route configuration within scope; target shape follows D-008 |
| Work-instruction versions | `(work_instruction_id, version_number)` unique and published/status access path | Resolve immutable version and current published candidate |
| Planning list | `(status, planned_start_at, id)` where date exists | Paginated planning views within the deployment context |
| Plan model/part allocation | `(planning_aggregate_id, model_id)` and `(planning_aggregate_id, part_code)` candidate uniques | Prevent duplicate planning lines and support detail reads |
| Route traversal | `(parts_list_version_id, plan_part_id, step_order)` | Ordered route reads for a part and version |
| Lot reads | `(planning_aggregate_id, status, id)` and `(lot_code)` unique candidate | List lots by plan/status and resolve scan code |
| Batch scan/list | `(barcode)` unique candidate; `(lot_id, status, id)` | Safe scan lookup and lot batch listing |
| Stage event history | `(batch_id, occurred_at, id)`, `(batch_part_line_id, occurred_at, id)`, and `(lot_id, occurred_at, id)` | Ordered append history and projection rebuild |
| Inventory history | `(occurred_at, id)` and lineage-specific `(batch_id, occurred_at, id)`/`(lot_id, occurred_at, id)` | Trace and correction review without balance-as-source queries |
| Routing/variance exceptions | `(status, detected_at, id)` and source ID unique candidate | Work queues and duplicate exception prevention |
| Audit search | `(occurred_at, id)` and `(resource_type, resource_id, occurred_at, id)` | Deployment-scoped timeline and resource history |
| Idempotency resolution | Unique scope/actor/operation/key digest | Atomic reservation; expiration cleanup may use `(expires_at, status)` |
| Outbox worker | Unique dedup key plus candidate `(status, next_attempt_at, id)` partial index for retryable rows | Claim due work without scanning published/dead-letter history |
| Job queue | `(owner_scope, status, created_at, id)` and `(status, next_run_at, id)` | Worker claim and operator queue views |
| Job attempts | Unique `(job_id, attempt_number)` and `(job_id, started_at, id)` | Retry history and latest-attempt access |
| Projection reads | `(batch_id)`/source identity and checkpoint `(projection_name, projection_version)` unique | Fast current view and one checkpoint per projection version |
| Asset metadata | `(owner_scope, status, created_at, id)` and candidate checksum/object-reference lookup | Private asset lifecycle and orphan reconciliation |

No tenant-leading indexes are required for the first single-context schema. Future line-leading
indexes must be added only with the D-029 migration design.
Partial indexes using status literals are deferred until the state vocabulary is accepted. Indexes
must not be used as a substitute for capability authorization or relational foreign keys.

## Pass 2 schema-normalization revision — 1NF/2NF/3NF, keys, namespaces, and indexes

This section is the relation-level design for the Pass 1 ownership map. It is a conceptual
PostgreSQL design, not a Prisma schema or migration. Candidate uniqueness that depends on an
unaccepted lifecycle or quantity policy remains marked as such.

### Normal-form and namespace rules

- **1NF:** Every route step, applicability, BOM line, process step, packaging line, demand line,
  reconciliation finding/resolution, approval, material lineage link, issue transaction, and
  walkthrough completion is a row. No repeating group, comma-separated identifier list, route
  array, capability array, current-position JSON, or balance JSON is canonical.
- **2NF:** Bridge rows carry attributes of the relationship: applicability scope, allocation
  quantity, BOM relation kind, process order, packaging ratio, demand dimensions, and source
  lineage. Those attributes are not copied onto Product, Model, Part, Plan, or Material rows.
- **3NF:** A code, name, lifecycle, owner, source revision, and current status is stored once at
  its owning relation. Immutable plan/product snapshots are deliberate evidence copies and are
  named snapshots; they are not live catalog fields. `PlanModelAllocation` and material balances
  are derived summaries with a source version, not second editable facts.
- **JSON boundary:** Bounded observed/selected source evidence, provenance, process parameters,
  and redacted operational detail may be JSONB only with an owner, schema version, size limit,
  and redaction rule. JSONB must not carry relationships, route order, authorization truth,
  current position, demand dimensions, material lineage, or balances.

Identifier namespaces are typed at the owning relation; they are not a global alias table:

| Identifier | Owning relation/fields | Candidate namespace rule |
|---|---|---|
| Product code | `products.product_code_namespace`, `products.code` | Unique within the approved Product namespace; not interchangeable with B248 or an external item number |
| Part code | `part_definitions.part_code_namespace`, `part_definitions.part_code` | Unique within the approved part-code namespace; `B248-02-08` is canonical for the affected revision and `B248-01-08ST` remains invalid source evidence |
| External item number | Source revision or typed source-reference relation | Scoped by source system/namespace and document revision; never a Part primary key |
| Document/control number | `controlled_documents.document_namespace`, `external_control_number` | Scoped by source authority and document type; revision label is a child-revision attribute |
| Mold/equipment reference | `process_specification_steps.equipment_namespace`, `equipment_reference` | Process/equipment namespace only; never a product or part identity |
| PMRS/Withdrawal reference | `pmrs_references` or `inventory_transactions` source namespace/reference fields | External reference only until D-020 changes ownership; never a PATS ledger identity |

If a source exposes the same text in two namespaces, the rows remain distinct. No global alias or
filename-based identity is introduced. An `identifier_namespaces` vocabulary may validate these
keys, but it does not replace the typed foreign-key/column on the owning relation.

### Relation key and access-path matrix

| Relation | Primary key and foreign keys | Candidate/business uniqueness | Nullability and relationship attributes | Required/candidate indexes |
|---|---|---|---|---|
| `controlled_documents` | `id`; no business FK | `(document_namespace, external_control_number)` where the source authority guarantees it | `document_type`, namespace, control number, and semantic owner required; source-specific uniqueness remains `NEEDS_CONFIRMATION` | `(document_type, status, id)`; `(document_namespace, external_control_number)` |
| `controlled_document_revisions` | `id`; `controlled_document_id`; optional `source_asset_id`; optional `supersedes_revision_id` | `(controlled_document_id, revision_label)` | Revision label, source date, checksum/provenance, and status required; supersession only points backward | `(controlled_document_id, status, id)`; `(source_asset_id)`; `(effective_at, id)` |
| `source_reconciliation_issues` | `id`; `source_revision_id`; optional resolver subject FK only after resolution | `(source_revision_id, rule_key, field_path, observed_value_digest)` prevents duplicate findings | Field/path, rule, severity/blocking flag, observed evidence, and status required; resolution fields do not live here | `(source_revision_id, status, id)`; `(status, detected_at, id)` |
| `source_reconciliation_resolutions` | `id`; `issue_id`; `resolver_subject_id`; optional `supersedes_resolution_id` | `(issue_id, resolution_sequence)` | Selected value/source representation, reason, `If-Match` basis, outcome, and time required; append-only | `(issue_id, resolved_at, id)`; `(resolver_subject_id, occurred_at, id)` |
| `source_revision_approvals` | `id`; `source_revision_id`; `approver_subject_id` | `(source_revision_id, approval_kind, approval_sequence)` | Approval kind, outcome, reason/evidence, and time required; one approval cannot stand in for another role | `(source_revision_id, outcome, id)`; `(approver_subject_id, occurred_at, id)` |
| `part_definitions` | `id`; optional approved `source_revision_id` for draft, required for effective content | `(part_code_namespace, part_code)` for canonical definitions | Code, kind, lifecycle, and name required; source display values are not identity | `(part_code_namespace, part_code)`; `(status, id)` |
| `part_applicabilities` | `id`; `part_definition_id`; one scoped FK to Product or Model; `source_revision_id` | `(part_definition_id, scope_kind, target_id, source_revision_id)` candidate | `scope_kind` plus exactly one Product/Model target; effective revision required for published applicability | `(product_id, status, id)`; `(model_id, status, id)`; `(part_definition_id, status, id)` |
| `bom_definitions` | `id`; `source_revision_id`; scoped Product/Model/parent-Part FKs as applicable | `(source_revision_id, bom_key)` | Effective definition must have one parent scope; draft unresolved child identity cannot publish | `(source_revision_id, status, id)`; `(parent_part_definition_id, status, id)` |
| `bom_lines` | `id`; `bom_definition_id`; required effective child `part_definition_id`; optional `parent_line_id` self-FK | `(bom_definition_id, parent_line_id, line_order)`; child/relation duplicate check candidate | Relation kind, positive quantity specification, UOM/usage basis, and line order required; parent line is nullable only for root children | `(bom_definition_id, parent_line_id, line_order)`; `(child_part_definition_id, id)` |
| `process_specifications` | `id`; `source_revision_id`; `part_definition_id` | `(part_definition_id, process_family, revision_number)` | Process family, lifecycle, and target part required; source revision required for effective status | `(part_definition_id, process_family, status, id)`; `(source_revision_id, id)` |
| `process_specification_steps` | `id`; `process_specification_id`; optional Stage/SubStage/Station FKs | `(process_specification_id, step_order)` | Step order required/positive; equipment namespace/reference and bounded parameters are step attributes | `(process_specification_id, step_order)`; `(station_id, status, id)` |
| `packaging_specifications` | `id`; `source_revision_id`; Product/Model scope FKs as applicable | `(source_revision_id, packaging_key)` | Packaging scope, lifecycle, and source revision required for effective content | `(product_id, status, id)`; `(model_id, status, id)`; `(source_revision_id, status, id)` |
| `packaging_lines` | `id`; `packaging_specification_id`; `component_part_definition_id`; optional `parent_line_id` | `(packaging_specification_id, parent_line_id, line_order)` | Packaging level, parent relation, positive ratio/usage basis, UOM, and order are relationship attributes | `(packaging_specification_id, parent_line_id, line_order)`; `(component_part_definition_id, id)` |
| `product_specification_snapshots` | `id`; `planning_aggregate_id`; approved Product Master `source_revision_id` | `(planning_aggregate_id, snapshot_kind, source_revision_id)` candidate | Captured schema version/checksum/time required; content is immutable after plan release | `(planning_aggregate_id, captured_at, id)`; `(source_revision_id, id)` |
| `parts_list_versions` | `id`; `planning_aggregate_id`; approved Parts List `source_revision_id` | `(planning_aggregate_id, version_number)`; one published version per plan at a release boundary | Version/order/status required; published rows immutable | `(planning_aggregate_id, status, version_number)`; `(source_revision_id, id)` |
| `plan_demand_allocations` | `id`; `planning_aggregate_id`; `model_id`; source revision FK | `(planning_aggregate_id, model_id, market_code, demand_purpose, allocation_revision)`; one current active dimension candidate | Market, purpose, quantity specification, source revision, and lifecycle required; no total column duplicated from the model summary | `(planning_aggregate_id, status, id)`; `(planning_aggregate_id, model_id, market_code, demand_purpose, id)` |
| `plan_model_allocations` | `id`; `planning_aggregate_id`; `model_id` | `(planning_aggregate_id, model_id)` | Derived quantity, demand source version, calculated time, and freshness required; client writes are prohibited | `(planning_aggregate_id, model_id)`; `(planning_aggregate_id, source_version, id)` |
| `material_requirements` | `id`; `planning_aggregate_id`; optional Lot/PlanPart/Model/Part FKs; approved source revision | Candidate requirement key plus explicit revision; do not enforce a false single-source cardinality | Required quantity specification, demand scope, lifecycle, and source revision; lineage may have multiple typed bridge rows | `(planning_aggregate_id, status, id)`; `(lot_id, status, id)`; `(plan_part_id, status, id)` |
| `material_requirement_demand_allocations` | `id`; `material_requirement_id`; `plan_demand_allocation_id` | `(material_requirement_id, plan_demand_allocation_id)` | Relationship row has contribution quantity/usage basis only when approved; no duplicate demand identity | `(plan_demand_allocation_id, material_requirement_id)` |
| `material_requirement_bom_lines` | `id`; `material_requirement_id`; `bom_line_id` | `(material_requirement_id, bom_line_id)` | Relationship row has derived contribution quantity/source version; not a second requirement | `(bom_line_id, material_requirement_id)` |
| `pmrs_references` | `id`; `planning_aggregate_id`; optional controlled PMRS revision FK | `(planning_aggregate_id, source_namespace, external_control_number, revision_label)` candidate | Status, source namespace/control, and provenance required; issued/balance are observations/projections only | `(planning_aggregate_id, status, id)`; `(source_namespace, external_control_number, revision_label)` |
| `plan_parts` | `id`; `planning_aggregate_id`; `part_definition_id`; source revision/snapshot FK | `(planning_aggregate_id, plan_part_code_namespace, plan_part_code)` | Immutable code/name snapshot and lineage required; catalog edits cannot rewrite it | `(planning_aggregate_id, status, id)`; `(part_definition_id, id)` |
| `route_steps` | `id`; `parts_list_version_id`; `plan_part_id`; optional process/stage/substage/station FKs | `(parts_list_version_id, plan_part_id, step_order)`; optional route-wide `(parts_list_version_id, step_order)` | Positive order and route assignment required; process specification reference is not the route source | `(parts_list_version_id, plan_part_id, step_order)`; `(station_id, status, id)` |
| `inventory_transactions` | `id`; optional `material_requirement_id`; batch/lot/plan-part FKs; correction FK; actor subject FK | Idempotency relation provides retry uniqueness; source/correction duplicate candidates are domain-specific | Transaction kind, positive magnitude, UOM, direction/effect, source namespace/reference, and status required; requirement required for accepted material issue | `(material_requirement_id, occurred_at, id)`; `(batch_id, occurred_at, id)`; `(lot_id, occurred_at, id)`; `(status, occurred_at, id)` |
| `subject_preferences` | `subject_id` as one-to-one PK/FK to `subjects` | `subject_id` | Controlled locale and concurrency version required; no role/capability attributes | `(locale_code, subject_id)` only if support queries require it |
| `subject_walkthrough_completions` | `id`; `subject_id` | `(subject_id, walkthrough_key, walkthrough_version)` | Key/version/completion time required; completion is immutable evidence for that version | `(subject_id, completed_at, id)`; `(walkthrough_key, walkthrough_version, id)` |

The matrix deliberately leaves final enum/check literals, quantity scale, and some partial unique
indexes open where D-005, D-008, D-010, D-020, D-021, D-030, or D-031 is not accepted. A candidate
constraint must not be presented as a frozen migration rule.

### Lineage and derived-value rules

Material requirements may be derived from several demand allocations and BOM lines. The two
typed bridge relations above preserve strong foreign keys and 2NF; a polymorphic `(source_type,
source_id)` lineage column is not canonical. If the accepted business rule proves exactly one
lineage source, the direct FK may replace the bridge through an approved migration design.

`PlanModelAllocation` stores only a derived summary with the demand-source version/freshness.
`MaterialRequirement` stores required quantity and source lineage, while accepted issue amounts
are rows in `inventory_transactions`. `PMRSReference` may retain observed header/line values as
bounded source evidence, but no PMRS or requirement row contains independently editable issued or
balance totals.

## Lifecycle persistence boundary

The persistence design separates a state transition, its source evidence, and rebuildable read
models. Status names below are candidate examples, not accepted API or database vocabulary.

| Aggregate/evidence | Durable persistence | Database barrier | Transaction/domain responsibility | Projection/outbox consequence |
|---|---|---|---|---|
| Planning aggregate | One mutable aggregate row with version and lifecycle timestamps | Ordinary relational FKs; optimistic version; temporal checks | Validate actor capability, dates, catalog references, and release preconditions | Release/cancel intent is emitted only with the accepted mutation |
| Parts-list version | Immutable version row plus ordered route-step rows | Scoped version uniqueness; positive/unique order; restrict referenced rows | Publish validates route completeness, station eligibility, and snapshot references | Published version becomes the route identity for lots and batches |
| Lot | Lot row retains released route/version; allocation rows carry part/quantity relationship | FK to planning/version; candidate allocation uniqueness; no source cascade | Release freezes route/allocation boundary; completion requires accepted evidence | Lot state and allocation changes produce audit/outbox records |
| Batch | Batch row plus batch-part-line rows | Unique scan identity within the deployment; route/version FK; optimistic version | Create/void/complete transition validates lot and line composition | Position projection is updated from events, never from an arbitrary current-stage write |
| Stage event | Append-only event row | Required lineage/source FKs; route/version consistency where enforceable | Validate station/route and actor; reserve idempotency key in same transaction | Projection update and outbox intent commit with the event |
| Inventory transaction | Append-only movement/correction row | Required lineage and correction linkage; candidate numeric checks | Validate unit/quantity/sign policy and source reference; never edit original | Variance alert and trace projection derive from transaction evidence |
| Routing violation/variance alert | Mutable exception row linked to immutable source | Source uniqueness candidate; resolution timestamp checks; version token | Authorized resolve/waive transition requires reason and actor | Queue/read projection refreshes; source event/transaction remains unchanged |
| Audit record | Append-only audit row | Required actor/resource/correlation/time fields; restrictive privileges | Record accepted outcome and redacted context in the same command transaction when required | No projection is authoritative; retention/archival is operational |
| Idempotency record | Reservation/result row | Scope/key uniqueness and request-hash check | Reserve before side effect; persist exact result atomically; expire by policy | No duplicate outbox/event for a replayed command |
| Outbox message | Append-only publication-intent row with retry state | Deduplication uniqueness; bounded payload/schema version | Worker claims with lease/concurrency rule; never reopens source mutation | Delivery status is operational and must be observable |
| Job/attempt | Job state plus append-only attempt rows | Unique attempt number; bounded status/progress; lease timestamps | Claim/retry/terminal transitions are concurrency-safe and idempotent | Async API result references job state, not an unbounded response payload |
| Asset/link | Asset metadata plus typed/strong asset-link relation | Private object reference/checksum policy; restrict linked source delete | Verify bytes and detach/retire according to ownership/retention policy | Orphan and backup reconciliation jobs operate from metadata |
| Projection/checkpoint | Rebuildable rows plus checkpoint | Source identity/version and checkpoint uniqueness | Rebuild from source in bounded batches; checkpoint advances only after durable write | Stale projections are diagnosable and never become source truth |

No lifecycle transition may be represented only by a boolean flag or an overwritten current value
when historical evidence matters. For each accepted state machine, the implementation must define
allowed transitions, required actor/correlation fields, timestamp requirements, concurrency behavior,
and whether an outbox message is part of the same transaction.

## Pass 3 schema-normalization revision — lifecycle, quantity, reconciliation, and release invariants

### Controlled source and approval lifecycle

The source-control state is represented by a controlled transition and append-only evidence:

```text
draft -> validated -> approved -> superseded
  |          |          |
  v          v          v
rejected  rejected   (immutable)
```

- A draft revision may preserve source observations, provenance, checksums, and unresolved
  conflicts. Validation creates `SourceReconciliationIssue` rows; it does not silently select a
  canonical value.
- `validated` requires all structural checks to pass, but it is not approval. Any open blocking
  issue prevents `SourceRevisionApproval` and effective publication.
- A resolution is an append-only `SourceReconciliationResolution` with resolver subject, reason,
  selected value/source representation, and `If-Match` basis. It does not update the observed
  revision. The corrected values are captured in a new revision that supersedes the draft.
- Approval writes immutable `SourceRevisionApproval` evidence and changes the selected revision
  status in the same transaction. A later correction creates a new revision; an approved revision
  is never edited in place.
- `waived` issue handling remains `NEEDS_CONFIRMATION` under the accepted exception policy. A
  waiver can never silently make a source value canonical.

### Issue and release invariants

```text
open -> resolved
     \-> rejected
     \-> waived (only if an accepted exception policy permits it)
```

The issue status may be a current projection of its append-only resolution history, but every
resolved/rejected/waived outcome requires a corresponding evidence row. Source approval and plan
or material release require:

1. the selected revision is structurally validated and has no open blocking issue;
2. the effective Product Master/Parts List/PMRS revision relationship is registered according to
   the controlled-document policy;
3. all identifiers resolve in their typed namespace, with `B248-02-08` as the canonical Kuririn
   Body code and `B248-01-08ST` retained only as invalid source evidence;
4. all demand, BOM, process, packaging, and quantity relationships are relational and complete;
5. dependent plan snapshots, route versions, and requirements cite the approved revision IDs;
6. the release actor has the accepted capability and the command passes its `If-Match` basis.

The corrected source-document/effective-revision tasks remain a controlled Gate 0 release
condition even though the target canonical values are decisive in the design.

### Quantity and PMRS invariants

Every quantity-bearing relation carries a quantity specification with:

- non-negative magnitude and an explicit quantity state (`planned`, `ordered`, `issued`,
  `accepted`, or `derived`);
- controlled UOM, precision, and approved conversion/rounding policy;
- optional usage-basis numerator/denominator (for example `1/40` or tape-per-200);
- source representation/text when conversion is not accepted.

Transaction direction/effect is separate from positive magnitude. A ratio is never converted to
pieces merely to satisfy a numeric column. If no approved conversion exists, the command is
blocked with auditable validation evidence. If no explicit tolerance is present, comparison uses
strict equality. Any explicit tolerance belongs to the requirement or operation policy and a
variance creates a `VarianceAlert`; no global `+/-5%` rule is encoded.

For the approved Asia target, line-level values are authoritative: total `77,860`, issued
`77,060`, derived balance `800`. Header `77,060` is an observed stale source value and is never
allowed to overwrite the line sum. The material balance projection is:

```text
derived issued = sum(accepted, compatible, direction-adjusted issue/correction evidence)
derived balance = required quantity - derived issued
```

The projection must expose source revision, UOM/conversion rule, and freshness. It cannot be
edited through PMRS or MaterialRequirement APIs. An issue cannot be accepted against a cancelled
or fulfilled requirement, and an incompatible UOM/usage basis blocks acceptance.

### Demand, requirement, and issue lifecycles

```text
PlanDemandAllocation: draft -> committed -> superseded
MaterialRequirement:  draft -> approved -> ordered -> partially_issued -> fulfilled
                                |          |                  |
                                v          v                  v
                             cancelled  cancelled          cancelled (policy-gated)
InventoryTransaction:     recorded -> accepted
                                      \-> rejected
accepted -> voided/corrected (compensating evidence only)
```

`PlanDemandAllocation` rows become immutable at plan release. `PlanModelAllocation` is recalculated
from the committed dimensioned rows and carries the source demand version; it is not a mutable
total. `MaterialRequirement` can be approved only from accepted source/BOM/demand lineage and
inherits the required quantity specification. An accepted issue is a new immutable ledger row;
void/correction is a compensating row linked to the original. No source ledger is updated or
deleted by an ordinary resource operation.

Subject preferences are one mutable row per subject and use field-replacement PATCH semantics with
optimistic concurrency. Walkthrough completion is one immutable row per subject/key/version and
is idempotent to record; a later walkthrough version creates a new row rather than updating the
old completion.

### Concurrency, idempotency, audit, and outbox invariants

- Draft source revisions, reconciliation issues, PMRS references, material requirements, and
  subject preferences expose a monotonic version/ETag. A stale `If-Match` fails with
  `412 Precondition Failed`; it cannot merge conflicting source or quantity values.
- Resolution, approval, material creation, and inventory issue commands accept `Idempotency-Key`
  when externally visible and retryable. The normalized request hash excludes trace-only headers.
  Same actor/scope/operation/key and same hash replays the exact stored status/body/headers; a
  different hash returns `409 Conflict`; an in-progress reservation cannot create a second side
  effect.
- A command transaction reserves idempotency, validates source and object ownership, writes the
  source/evidence mutation, writes the audit record, writes the outbox intent, updates only an
  allowed synchronous projection, stores the exact result, and commits all of them together.
- `AuditRecord` captures stable subject, action, resource, outcome, UTC time, operational
  context, request/correlation/trace references, and bounded redacted detail. It is not a
  substitute for source, requirement, or inventory evidence.
- `OutboxMessage` is created atomically with the source mutation, has a schema version and
  deduplication key, and is delivered at least once. Consumers deduplicate by message identity
  and contract version. Publisher failure never reopens or rolls back a committed source
  mutation; dead-letter replay is explicit and audited.
- A replayed idempotency key produces no duplicate source row, audit record, outbox intent,
  derived position, or material issue. Projection workers advance checkpoints only after their
  projection rows commit.

### Subject preference and walkthrough boundary

`SubjectPreference` is subject-owned self-service metadata with a controlled locale and version.
`SubjectWalkthroughCompletion` is versioned completion evidence. Neither relation is an
authorization assignment, role mapping, object-ownership relation, or replacement for localized
catalog content. D-006, D-025, D-026, and D-036 remain Gate 0 review items even though this target
shape is the working direction.

## On-prem operational persistence and migration safety

This section defines control boundaries for the on-prem direction. It does not choose a topology,
backup owner, retention period, RPO, RTO, credential mechanism, or promotion schedule. Those values
remain D-017, D-023, D-027, and D-028 `NEEDS_CONFIRMATION` items.

### Persistence ownership boundary

| Concern | Canonical owner | Persistence rule | Failure implication |
|---|---|---|---|
| Business identity and relationships | PostgreSQL relational store | IDs, operational ownership, FKs, lifecycle, source ledgers, audit, idempotency, outbox, jobs, and checkpoints are relational | No successful write may be reported without a committed database transaction |
| Private object bytes | MinIO-compatible private object storage | Bytes use a server-generated internal object reference; the database stores metadata and link ownership | Missing/unavailable bytes are not replaced by a public URL or fabricated success |
| Asset authorization and lifecycle | API plus PostgreSQL `assets`/typed links | API controls who can request, finalize, read, retire, or reconcile an asset | Object storage ACLs do not replace API object and capability checks |
| Legacy Mongo/PMS data | Legacy system or isolated evidence import boundary | Read-only compatibility evidence; never a second canonical PATS write store | A legacy outage cannot corrupt or silently redefine PATS source truth |
| Logs and telemetry | On-prem host/runtime collection boundary | Structured operational records may refer to stable IDs but are not business ledgers | Missing telemetry must not make a committed domain event disappear |
| Projections and reports | PostgreSQL projection relations/jobs | Rebuildable rows carry source IDs/versions and a checkpoint | Stale or failed projections are observable and never authorize writes |

### Transaction bundles and atomicity

The default command bundle is one PostgreSQL transaction:

```text
authenticate/authorize
  -> normalize idempotency key and request hash
  -> reserve or resolve idempotency record
  -> validate source and deployment-owned relationships
  -> write source mutation/evidence
  -> write audit record
  -> write transactional outbox intent
  -> optionally write a synchronous derived view/checkpoint
  -> persist exact idempotency result
  -> commit
```

The following rules apply:

- Source mutation, audit, outbox intent, and the completed idempotency result commit or roll back
  together. A response cannot claim success when the transaction rolled back.
- A duplicate key with the same normalized request hash replays the stored result. A duplicate key
  with a different hash returns the standard conflict problem. An in-progress reservation follows
  the endpoint's documented retry/processing response and cannot create a second side effect.
- A synchronous projection is included in the command transaction only when its derivation is
  bounded, deterministic, and owned by the same database write. The accepted StageEvent
  current-position projection is the working command-owned case and is updated with the event;
  this does not make the projection authoritative.
- Other reporting projections use the asynchronous path. A projection worker writes projection
  rows and advances its checkpoint in one separate transaction. The source command and that
  checkpoint are not falsely presented as one transaction; the source event/outbox is the durable
  handoff.
- An outbox worker claims a due message under a lease/concurrency guard, performs the adapter call,
  and records success, retryable failure, or dead-letter state. Delivery is at-least-once, so every
  consumer must deduplicate by message identity and contract version.
- A job attempt is its own retry evidence. A worker may retry a safe/idempotent operation, but it
  must not repeat a non-idempotent domain command without the original idempotency boundary.
- Asset byte upload is not part of a PostgreSQL transaction. Asset metadata is created as a
  pending row, the private object is uploaded through a scoped operation, and finalization verifies
  the object before a database transaction marks it available and emits audit/outbox evidence.
  Reconciliation handles abandoned pending rows and orphaned bytes without deleting evidence by
  guesswork.

### Audit, redaction, and retention/legal-hold placeholders

Audit and source evidence have different purposes. A `StageEvent`, `InventoryTransaction`, or
`ProcessChangeLog` explains the operational fact; an `AuditRecord` explains the actor, request,
authorization outcome, correlation, and time. Neither may contain credentials or unbounded request
bodies.

The normalized design reserves a governance-only retention envelope for relations that may require
controlled retention or legal hold:

- optional `retention_policy_key` or equivalent policy reference;
- optional `retain_until`/review boundary supplied by an accepted policy, not an invented date;
- optional `legal_hold_reference` and hold-status boundary owned by the approved governance owner;
- source/evidence linkage proving why a row is retained or released.

These are placeholders, not accepted columns or legal rules. A legal hold must prevent an automated
cleanup path from deleting the protected source/asset evidence, while the hold decision, owner, scope,
and release evidence remain outside this schema design until confirmed.

Redaction boundaries are mandatory for implementation review:

- never persist bearer tokens, cookies, passwords, private object credentials, raw identity claims,
  or secret configuration in business metadata, audit detail, idempotency responses, jobs, or logs;
- store stable subject identity and only the minimum approved historical actor snapshot;
- hash or otherwise protect idempotency keys in operational logs while preserving the database
  lookup boundary;
- store bounded, versioned error detail rather than stack traces or full request/response bodies;
- keep object keys internal and avoid exposing bucket names/paths when a short-lived URL is returned;
- define field-level redaction before any metadata JSON is allowed on a new relation.

### Readiness and failure boundaries

| Condition | Write behavior | Read/health behavior | Required evidence |
|---|---|---|---|
| PostgreSQL unavailable | Fail without success or partial side effect; no in-memory fallback for source truth | Liveness may remain process-level; readiness is dependency-failed | Inject connection loss and verify no false 2xx or missing audit/outbox |
| Migration pending, failed, or incompatible | Keep the service readiness-failed until the approved schema/application pair is restored | Expose a safe classed reason without SQL, topology, or secret detail | Start each image against its supported schema version |
| MinIO unavailable or object checksum mismatch | Asset upload/finalization/read URL fails or remains pending/quarantined; metadata never claims verified bytes | Non-asset domain reads may continue if their source is available | Verify missing bytes, outage, checksum, and orphan reconciliation paths |
| Identity provider unavailable | Required external verification fails closed; do not grant new access from stale failure | Health output does not expose provider claims or secrets | Exercise timeout, invalid token, and previously issued-session policy |
| Outbox publisher unavailable | Source command may succeed after durable outbox commit; delivery remains retryable and observable | Readiness policy follows whether publishing is required for the selected operation | Confirm source/audit/outbox atomicity and dead-letter alerting |
| Projection worker unavailable/stale | Source writes continue if their own invariants pass; freshness is exposed where relevant | Projection reads report stale/unavailable state rather than fabricated current data | Stop/restart worker and rebuild from source high-water mark |
| Backup or restore verification failure | Block the affected promotion/reopen gate; never mark recovery complete | Service remains isolated or readiness-failed according to the approved runbook | Restore PostgreSQL and MinIO together in an isolated target and reconcile |

### Backup, restore, and reconciliation boundary

The minimum coordinated recovery set is:

1. PostgreSQL data, accepted schema/migration metadata, and a backup manifest;
2. MinIO private object bytes plus the asset metadata/link mapping needed to validate ownership;
3. immutable API/database/object-store version and checksum manifests;
4. configuration contract and secret-recovery procedure without storing secret values in Git;
5. projection rebuild and outbox replay instructions, including deduplication behavior.

The owner, frequency, retention, encryption/key custody, RPO, and RTO are not specified here.
Before production acceptance, a named owner must define them and record a restore rehearsal. A
rehearsal must at minimum restore into an isolated target, verify schema compatibility, compare
source relationships and invariants rather than only row counts, validate Asset metadata against
private bytes and checksums, rebuild projections, exercise outbox deduplication, and record gaps
and corrective actions. The original source evidence and backup must be preserved during testing.

### Additive expand/contract migration stages

The schema implementation must use reviewed forward migrations. When more than one application image
may be active, the following stages are required conceptually:

| Stage | Allowed change | Compatibility gate | Rollback boundary |
|---|---|---|---|
| 0. Preflight | Inspect current schema, data quality, locks, size, dependencies, and backup/restore checkpoint | Approved mapping, risk review, and recovery evidence exist | Abort before schema mutation |
| 1. Expand | Add new tables, nullable columns, additive indexes/constraints that do not reject existing data, and compatibility views only if accepted | Old and new image can start without reading missing fields | Application/image rollback remains possible |
| 2. Compatibility | Deploy code that can read old and new representations and writes the old-compatible form plus new form only when safe | Mixed-version reads/writes and idempotency behavior are tested | Roll back image while additive shape remains |
| 3. Backfill | Copy validated rows in bounded, resumable batches with deployment/line mapping and lineage | Dry run, conflict report, counts/checksums, FK/uniqueness validation, and operator sign-off | Stop/resume or isolate backfill; do not delete source |
| 4. Enforce | Make required columns non-null, add final checks/FKs/uniques, and switch reads/writes to the canonical relation | Backfill reconciliation and mixed-version exit gate pass | Forward fix is preferred; no automatic down-migration |
| 5. Contract | Remove compatibility writes/reads and only later remove deprecated columns/relations after the accepted review window | No supported image or report depends on the old shape; backup and restore verified | Contract removal is the irreversible boundary |

Mixed-version compatibility requires additive fields, tolerant readers, explicit feature/version
negotiation where behavior differs, and no migration that makes the previous supported image fail
to start. New code must not require a field before every writer has populated it. Dual writes must
be idempotent and reconciled; they must not create two canonical ledgers. A failed migration blocks
readiness rather than allowing an unverified mixed-version runtime.

There is no assumed down-migration. Before the contract stage, an application image can be rolled
back only if the database remains backward-compatible. After a destructive/contract change, use a
forward corrective migration or restore the coordinated database/object backup; never invent a
down-migration that could destroy accepted evidence.

### Legacy isolation and backfill prerequisites

Legacy Mongo/PMS data remains outside the canonical PATS write path. If a future migration is
approved, it must use a staged, read-only extraction and an explicit crosswalk containing:

- accepted source-to-target ownership and deployment/line mapping;
- stable source lineage and a new canonical identity policy;
- code/name/initial/filename collision handling;
- field-level mapping for status, dates, actors, route versions, quantities, and assets;
- conflict, null, duplicate, and unsupported-state policy;
- checksums/counts plus relationship and invariant reconciliation;
- dry-run output, resumable batch/checkpoint behavior, and operator sign-off;
- a no-write or dual-write boundary with a named cutover decision.

No legacy row, frontend fixture, seed, filename, or initial is an automatic canonical ID. A
backfill may preserve a bounded source reference/evidence field, but it cannot turn legacy shape
or display labels into accepted domain semantics.

## Pass 2 client-evidence relational additions

The B248 evidence requires the following candidate relational boundary before a future Prisma
translation. These are normalized design concepts, not approved table names or migrations.

### Controlled source revisions

Candidate relations:

- `controlled_documents`: stable internal identity and bounded document type/owner;
- `controlled_document_revisions`: immutable revision, external control number, revision/date,
  effective status, source asset/reference, checksum, provenance, and approval references.

Candidate relations from `products`, `parts_list_versions`, and `pmrs_references` point to the
selected revision. A revision record does not make PMRS PATS-owned. Source assets remain private
Asset metadata under D-014; the controlled revision stores provenance and checksum, not a public
object key.

### Part, applicability, BOM, process, and packaging candidates

| Candidate relation | Normalized responsibility | Must not absorb |
|---|---|---|
| `part_definitions` | Stable part identity, source code, name, kind, lifecycle | Model quantity, route order, or execution event |
| `part_applicabilities` | Product/all-model/model-specific applicability and effective source revision | Duplicated copies of one shared part |
| `bom_definitions` / `bom_lines` | Versioned parent/child content, relation kind, quantity/UOM, applicability | Ordered execution route or mutable inventory balance |
| `process_specifications` / `process_specification_steps` | Injection/deco/assembly/packaging process sequence and bounded parameters | Assumed scan route or free-form unbounded JSON |
| `packaging_specifications` / `packaging_lines` | Packaging levels, parent/child components, ratios, usage basis, scope | Commercial identity or warehouse issue ledger |

The existing `model_parts` relation may be retained as a compatibility-facing model applicability
view only if its semantics are accepted. It must not be used as the only source for shared parts,
packaging materials, or all-model components.

### Relational constraints and source conflict behavior

- Part source codes are unique only within an accepted source/code namespace; the B248 code
  conflict must not be hidden by a global unique constraint chosen before reconciliation.
- BOM, process, and packaging revisions are immutable after effective publication; corrections
  create a new revision or explicit evidence record.
- BOM and packaging quantities retain unit and usage-basis data. `No. of Ups` remains a process
  parameter candidate, not a BOM quantity.
- A plan snapshot references the exact controlled revisions used to build it. Later catalog/source
  revisions do not rewrite a released plan.
- An unresolved source conflict can be stored in draft evidence but blocks effective publication
  under candidate D-033.
- `RouteStep` remains a normalized execution-order relation and cannot be used as a substitute for
  BOM, process, or packaging relations.

No candidate relation authorizes an implementation migration. D-030 through D-033 and the
affected D-005, D-007, D-010, D-021, and D-024 decisions remain open.

## Pass 3 PMRS and planning quantity relations

### PMRS control projection boundary

The canonical normalized shape is `pmrs_references` plus immutable source/provenance
evidence. Candidate attributes include planning aggregate, external system/source, control number,
revision/cycle, market/region, source document revision, observed lot quantity, and status. A
reference may retain bounded line snapshots only if the owner, schema version, size, and redaction
policy are defined.

`issued` and `balance` are not writable canonical columns on `pmrs_references`. If they are
displayed, they must be explicitly labelled as source observations or projections with source
revision/freshness.

### PATS-owned material relations

The target design adds normalized relations:

- `material_requirements`: requirement identity, plan/lot/source revision, demand scope, quantity
  and UOM, lifecycle, and concurrency version;
- `material_issue_references` or the existing `inventory_transactions`: append-only accepted
  issue evidence with external control/withdrawal reference;
- `material_balance_projections`: rebuildable derived balance with source high-water mark and
  freshness.

The design must not create a generic `pmrs_rows` table that mirrors worksheet columns. PMRS
document identity, material requirement, issue ledger, and balance projection have different
owners and lifecycles.

### Candidate demand allocation relation

`plan_demand_allocations` is a candidate bridge relation between a planning aggregate and model,
with market/region, demand-purpose, quantity specification, source revision, and lifecycle. It
must have a defined reconciliation rule with `plan_model_allocations`; two independently mutable
totals are not acceptable. If the model total is a projection, it carries source version/freshness
and is not a second write-side truth.

### Quantity specification candidate

The quantity boundary should support a positive magnitude, controlled UOM, optional numerator/
denominator usage basis, source representation, and explicit precision/rounding policy. The final
database numeric type and conversion table remain D-021 `CONFLICTING`. A ratio such as `1/40` or
`133 inches per 200` must remain representable without lossy conversion.

### Source discrepancy and concurrency rules

- A PMRS source snapshot stores both observed header and line/calculated values when they disagree;
  it does not overwrite one with the other.
- A source revision/control update creates a new reference or supersedes the prior reference;
  it does not mutate historical issue/balance observations.
- A plan/demand/material requirement mutation uses ETag/`If-Match` when mutable; issue and
  inventory evidence use `Idempotency-Key` and append-only correction behavior.
- A 77,060 versus 77,860 conflict blocks effective release of dependent planning data until the
  source owner confirms the relationship.

D-007, D-020, D-021, D-024, D-034, and candidate D-035 remain open. No migration is authorized.

## Pass 5 subject preference normalization

The legacy/frontend `UserPreference` evidence is not canonical persistence, but it identifies a
product capability. Under proposed D-036, use normalized relations:

- `subject_preferences`: one subject preference row with controlled locale and version/concurrency
  fields;
- `subject_walkthrough_completions`: one row per subject, walkthrough key, and walkthrough
  version, with completion time.

These records are self-service platform/identity metadata. They must not grant capabilities,
change object ownership, or become a substitute for localized catalog content. Provider subject
identifiers remain private. The first implementation slice may defer these relations until the
product owner confirms that locale and walkthrough state must be server-persisted.

### Offline and on-prem delivery gate

An accepted deployment artifact must be verifiable without registry access or external SaaS. The
design package expects an immutable version/checksum manifest, migration manifest, configuration
contract, dependency images, backup/restore runbook, and offline verification procedure. It does
not choose Docker Compose topology, replicas, ports, TLS termination, hardware, identity placement,
or promotion ownership. Those values must be supplied by the approved on-prem operator boundary.

The promotion sequence is a gate, not an implementation script: verify offline artifact -> verify
backup/restore checkpoint -> apply to a non-production environment -> run contract, tenancy,
persistence, asset, outbox, and projection checks -> obtain the approved promotion decision ->
repeat in the next environment. The API must not silently pull images, credentials, migrations, or
telemetry configuration from the public network.

## Normalized relationship summary

```text
Subject 1—* SubjectAssignment
Deployment context 1—* Product 1—* Model 1—* ModelPart (implicit first-deployment scope)
WorkflowGroup 1—* Stage 1—* SubStage
Station 1—* StationStep — target stage/substage boundary
PlanningAggregate 1—* PlanModelAllocation
PlanningAggregate 1—* PlanPart
PlanningAggregate 1—* PartsListVersion 1—* RouteStep —* PlanPart
PlanningAggregate 1—* Lot 1—* LotPartAllocation —1 PlanPart
Lot 1—* Batch 1—* BatchPartLine —1 PlanPart
Batch/BatchPartLine 1—* StageEvent —0..1 RoutingViolation
Batch/Lot/PlanPart 1—* InventoryTransaction —0..* VarianceAlert
StageEvent/Inventory/ProcessChange 1—* AuditRecord and OutboxMessage
Asset 1—* AssetLink — approved target boundary
Source records 1—* Projection rows; ProjectionCheckpoint tracks rebuild state
```

The diagram expresses relational intent, not accepted cardinality for D-010 or open asset/station
ownership. The deployment context is not a client-selectable tenant. All relationship cardinalities
that affect writes require the decision register gate. A future multi-line design may add
`ProductionLine` and line-owned relations after D-029 is accepted.

## Explicit exclusions from canonical schema

- Legacy Mongo/PMS tables, initial-based IDs, filename-derived identity, seeded fixture rows, and
  frontend localStorage snapshots.
- Denormalized `partName`/`currentStageId` fields as sole truth.
- Required singular `Lot.partId` while D-010 is open.
- Free-form `String actor` as audit or event identity.
- JSON route arrays, capability assignments, inventory balances, or asset ownership.
- First-class Withdrawal Form, PMRS domain, or scanner/printer state without accepted ownership.

## Open questions carried into the implementation gate

- Whether a single database will ever serve multiple physical lines (D-029).
- Whether `ProductionLine` has a required business identity even for a single deployment (D-001).
- Whether future line scope requires composite line-aware FKs or ordinary FKs plus transaction validation.
- Whether catalog configuration remains deployment-owned or later supports shared/system templates (D-005).
- Which station target relation will D-008 accept?
- Which quantity/unit representation can be constrained without choosing D-021?
- Which asset link strategy provides strong FKs under D-014?
- Which actor snapshot columns are allowed under D-025?
- Which accepted lifecycle literals and append-only enforcement mechanism will be implemented?
- Which retention/legal-hold policy reference and cleanup authority will be approved?
- Which restore rehearsal, migration compatibility, and projection rebuild evidence will satisfy
  D-017/D-023/D-027/D-028?

## Implementation gate

The prior five-pass schema chain is superseded for implementation planning by this single-context
revision chain. The document is not ready to become Prisma. D-001, D-005, D-006, D-008, D-009,
D-010, D-014, D-017, D-020, D-021, D-024, D-025, D-026, D-027, D-028, D-029, D-030, D-031,
D-032, D-033, D-034, D-035, and D-036 must be accepted or explicitly deferred with owner and
review condition. The next task must be the revised
deployment-scoped identity/capability persistence slice named in the updated handover; no
implementation is authorized by chain completion alone.

## Decisive normalized relations for manual-conflict resolution

The target schema must make the corrected value the canonical value while retaining the original
manual observation as evidence. Add the following relations to the implementation design:

### `material_requirements`

Planning-owned approved requirements derived from a released plan/demand/BOM definition. Candidate
attributes include plan/lot/model/part lineage, market/purpose, required quantity/UOM/usage basis,
source revision, lifecycle, and concurrency version. PMRS control/revision is an external reference,
not the requirement identity.

### `source_reconciliation_issues`

Blocking validation findings attached to a controlled source revision. Candidate attributes:
source revision, field/relationship path, rule key, observed values, selected resolution value,
status, resolver subject, reason, resolved time, and audit/outbox correlation. The source revision
cannot become effective while blocking issues are open.

### `material_issue` evidence

Use the existing append-only `inventory_transactions` boundary for PATS-scope issue evidence,
linked to `material_requirements` and external PMRS/Withdrawal references. Do not create mutable
`issued` or `balance` columns. Derived balance is the accepted requirement quantity minus accepted
issue/correction evidence, with a rebuildable projection.

### Canonical quantity and source rules

- Asia line quantities are authoritative after the latest approved revision; header totals are
  calculated values and must validate against the line sum.
- Kuririn identity is `B248-02-08`; `B248-01-08ST` remains only in source correction evidence.
- Ratios preserve numerator/denominator or usage-basis semantics; no lossy conversion is allowed.
- Missing tolerance means strict equality. Any tolerance must be explicit on the requirement or
  operation policy and produce auditable variance handling.
- A corrected value is written to a new immutable approved revision, never by overwriting source
  evidence in place.

### Resolution evidence relation

`source_reconciliation_resolutions` is append-only evidence linked to one reconciliation issue. It
stores the selected resolution, resolver subject, reason, source field/path, `If-Match` basis,
correlation, and outcome. The resolution command is idempotent. The issue status projection changes
only after the resolution commits; the original observed values remain immutable.

## Gate 2 identity implementation handover (2026-07-15)

The earlier implementation-gate text above records the schema's pre-freeze state and remains
historical design evidence. Gate 0 is now frozen and the first additive identity slice has been
implemented:

- `Subject` stores provider-neutral `(provider, issuer, providerSubject)` identity plus bounded
  display-name/email snapshots and an active/disabled status;
- `SubjectAssignment` stores deployment-scoped direct capability or role-bundle assignments with
  active/suspended/revoked lifecycle state and normalized uniqueness;
- no Workspace, membership, tenant selector, or ProductionLine relation was added;
- canonical self routes evaluate persisted assignment policy through an injected adapter/repository
  boundary and fail closed when identity composition is absent or unavailable.

The remaining normalized catalog, planning, execution, inventory, source-revision, audit, outbox,
and subject-preference relations are not claimed as implemented by this slice. Controlled source
correction/effective-revision evidence for D-033/D-035 remains a release gate.
