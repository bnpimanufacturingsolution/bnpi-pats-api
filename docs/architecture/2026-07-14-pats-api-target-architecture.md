# Bandai PATS API Target Architecture

**Status:** PROPOSED DESIGN

**Date:** 2026-07-15 (single-operational-context revision)

**Depends on:** `docs/superpowers/context/2026-07-14-pats-api-design-context.md`

## Recommendation

Start with a modular monolith using bounded contexts and hexagonal boundaries. Keep one deployable
API and one PostgreSQL database while the operational-context model is being confirmed. Each
context owns its application use cases, domain invariants, persistence mapping, and HTTP contract
through explicit interfaces. A future service split should be possible, but is not a current goal.

This avoids turning an unconfirmed domain into distributed-systems complexity while preventing
the legacy API's shared-controller pattern from becoming the PATS architecture.

## Layer model

```text
HTTP / OpenAPI adapters
        |
Application use cases and authorization policy
        |
Domain entities, value objects, state transitions, invariants
        |
Ports: repositories, clock, identity, object storage, outbox, audit
        |
Adapters: Prisma/PostgreSQL, MinIO, identity provider, stdout/telemetry
```

HTTP handlers must translate transport concerns into application commands/queries. They must not
contain Prisma query composition, workflow rules, or frontend compatibility logic.

## Bounded contexts

### Identity and authorization

Owns authenticated subject mapping, deployment-scoped capability assignments, roles, permissions,
and object-level policy. It provides an authorization policy port consumed by every other context.
It does not own Workspace tenancy or membership administration in the first single-context
deployment. A future ProductionLine scope is gated by D-029.

### Catalog and configuration

Owns Products, Models, ModelParts, workflow groups, stages, substages, stations, and work
instructions. It defines what can exist, not which route a project part takes.

### Planning

Owns production plans/projects, product/model allocations, product specifications, approved
PATS-scope material requirements, PMRS control projections, Parts List versions, project Parts,
Lots, and planned quantities. Planning produces an immutable or explicitly versioned execution
definition.

### Execution

Owns Batches, batch-part lines, station work, stage events, forward progression, holds, closure,
and scrap. Execution records what happened; it does not rewrite the planning definition.

### Inventory and traceability

Owns WIP receiving, issuance, movement, quantity reconciliation, withdrawal references, and
trace queries. Raw-material ERP behavior remains outside this context.

### Exceptions and audit

Owns routing violations, variance alerts, process-change records, audit records, and resolution
history. Exception records reference the source event or transaction and preserve the evidence
that existed at detection time.

### Assets and documents

Owns asset metadata, private object keys, content type, size, checksum, lifecycle, and temporary
read/upload URLs. It does not expose MinIO keys as public identity.

### Reporting and projections

Owns read models and report queries derived from domain records. It is never the write-side
source of truth.

### Platform and operations

Owns health/readiness, job status, migrations, telemetry, backup hooks, version information, and
air-gapped delivery behavior.

## Dependency direction

```text
Identity/Authorization -> every protected context
Catalog -> Planning -> Execution
Planning -> Inventory/Traceability
Execution -> Exceptions/Audit
Inventory/Execution/Exceptions -> Reporting projections
Assets -> Catalog and Work Instructions through asset references
Platform surrounds all contexts; it does not own business rules
```

Dependencies must point toward stable domain contracts. Contexts must not import another context's
Prisma model types directly; use application-facing DTOs or ports.

## Consistency model

- A write that changes multiple owned records uses one PostgreSQL transaction.
- Append-oriented events, inventory transactions, audit records, and an outbox entry are written
  atomically when they belong to one command.
- Read projections may be eventually consistent and must expose their freshness where useful.
- No message broker is required for the first implementation; the transactional outbox is the
  boundary for later asynchronous delivery.
- The API remains stateless. Client state is carried by authenticated requests, resource state,
  idempotency keys, and explicit version validators.

## Deployment shape

The first supported runtime is Docker Compose on-prem with PostgreSQL and private MinIO. The
module boundaries must remain compatible with a later K3s deployment, but Kubernetes manifests,
production topology, and image-factory work are outside this design package.

## Architecture decisions still requiring ratification

- Whether a meaningful ProductionLine identity is required or one deployment context is sufficient.
- Identity provider and on-prem authentication mode.
- Whether deployment-owned catalog configuration later needs system/shared templates or line layers.
- Whether station identity maps to a Stage, SubStage, or configurable bundle.
- PMRS control projection integration and external physical-stock/procurement boundary.
- Rework/reversal behavior after the current forward-only workflow.

## Pass 2 context contracts and ownership detail

The following is the architecture boundary for the first modular-monolith implementation. It is
a `WORKING_DEFAULT` derived from the evidence lock; it does not accept D-001, D-005, D-006, D-008,
D-009, D-010, D-014, or D-017.

### Context ownership map

| Context | Owned records and truth | Public application capabilities | Ports exposed | Allowed dependencies | Forbidden dependencies |
|---|---|---|---|---|---|
| Identity and Authorization | Subject mapping, deployment-scoped capability assignments, role/permission policy | Resolve caller, resolve effective capabilities, evaluate object access | `IdentityProviderPort`, `CapabilityAssignmentRepository`, `AuthorizationPolicy` | Platform identity adapter and its own persistence | Domain records from Catalog, Planning, Execution, or legacy `WorkspaceMember` Prisma types |
| Catalog and Configuration | Product, Model, ModelPart, WorkflowGroup, Stage, SubStage, Station, WorkInstruction, configuration versions | Read catalog, manage approved configuration, publish effective configuration | `CatalogReader`, `WorkflowReader`, `ConfigurationVersionReader` | Identity policy, Assets reference port | Planning route/order, Batch position, StageEvent, UI fixture state |
| Planning | ProductionPlan/project identity (working noun `ProductionPlan`), product/model allocation, ProductSpecification snapshot, minimal PMRS reference, PartsList versions, route steps, project Parts, Lot | Author plan, create immutable route version, validate and release planning definition, create lots | `PlanningDefinitionReader`, `RouteVersionReader`, `LotReader` | Identity, Catalog read ports, Assets references where approved | Execution event history, current position projection, frontend localStorage, mutable catalog rows after release |
| Execution | Batch, BatchPartLine, station work command, StageEvent, batch lifecycle and position projection input | Create/identify batch, record stage interaction, validate route, hold/close/scrap under accepted policy | `BatchReader`, `StageEventReader`, `ExecutionCommandPort` | Identity, Planning route/lot ports, Catalog station ports, Inventory command port where a movement is part of one command | Direct Prisma imports from Planning, UI state, report projections as write truth |
| Inventory and Traceability | InventoryTransaction ledger, quantity movement, withdrawal-form reference, trace query composition | Record Receiving/Issuance, reconcile quantity, query batch/lot/part trace | `InventoryReader`, `InventoryCommandPort`, `TraceQueryPort` | Identity, Planning lot/part ports, Execution batch/event ports, external withdrawal reference only | Raw-material ERP ledger, derived dashboard-only state, silent mutation of ledger rows |
| Exceptions and Audit | RoutingViolation, VarianceAlert, ProcessChangeLog, AuditRecord and resolution history | Detect/persist exception, acknowledge/resolve/waive only under policy, record authorized process change, query audit | `ExceptionRecorder`, `AuditWriter`, `ExceptionQueryPort` | Identity, Execution and Inventory source-event ports, Planning route snapshots | Rewriting source events, generic log output as audit evidence, frontend alert state |
| Assets and Documents | Asset metadata, ownership, checksum, content type/size, lifecycle, private object reference | Create upload request, finalize/verify object, issue short-lived read URL, retire asset under retention policy | `ObjectStoragePort`, `AssetRepository`, `AssetReferencePort` | Identity, MinIO/S3 adapter, Platform telemetry | Public object keys, model identity, external SaaS asset service in air-gapped runtime |
| Reporting and Projections | Rebuildable read models, freshness metadata, report query definitions | Query WIP, progress, exception, inventory, and trace reports | `ProjectionReader`, `ProjectionRebuilder` | Read ports from all source contexts, outbox/event replay | Any write-side command, owning lifecycle state, direct UI-local fixtures |
| Platform and Operations | Job, outbox publication state, health/readiness/version data, operational hooks | Report health/readiness, inspect job, retry durable publication, expose version/capability metadata | `Clock`, `IdGenerator`, `OutboxWriter`, `JobRepository`, `TelemetryPort` | Infrastructure adapters only | Business state transitions, deployment capability decisions, direct frontend semantics |

### Dependency rules

The permitted business dependency graph is:

```text
Identity/Authorization
    -> Catalog and Configuration
    -> Planning -> Execution -> Inventory and Traceability
                                  \-> Exceptions and Audit
    -> Inventory and Traceability -> Exceptions and Audit
Catalog and Configuration -> Planning
Planning/Execution/Inventory/Exceptions -> Reporting and Projections
Assets and Documents -> Catalog and Configuration (reference port only)
Platform and Operations surrounds all contexts through infrastructure ports
```

The arrows mean a consuming context may call an application-facing port or use a versioned DTO;
they do not permit importing another context's Prisma model, repository implementation, or
transaction object. Reporting may read source records through dedicated query ports or a
projection feed, but source contexts never call Reporting to decide whether a command is valid.
The graph is intentionally acyclic. `Execution` and `Inventory` may participate in one command
transaction through an application orchestration boundary, but neither imports the other's
persistence types.

### Layer and module boundaries

Each context uses four internal layers:

1. **Domain:** entities, value objects, state transitions, and invariant functions. No Express,
   Prisma, MinIO SDK, JWT library, or environment access.
2. **Application:** commands, queries, transaction orchestration, authorization calls, and
   context-facing DTOs. It owns the use-case boundary and idempotency decision.
3. **Ports:** repository, clock, identity, object storage, audit, outbox, and external-reference
   interfaces. Ports are stable contracts, not ORM types.
4. **Adapters:** HTTP/OpenAPI, Prisma/PostgreSQL, MinIO, identity provider, stdout/telemetry,
   and job runners. Adapters translate and validate; they do not create domain rules.

The HTTP adapter may depend on an application use case and shared transport contracts only. It
must not compose Prisma queries, resolve deployment ownership by trusting a client-selected scope, or implement
route progression. Persistence adapters may map database constraint failures to application
conflicts, but they must not decide whether a state transition is legal.

### Transaction and consistency boundaries

- A command has one explicit owner context and one transaction coordinator.
- A stage-event command writes the event, any routing violation, the rebuildable current-position
  projection update, audit record, idempotency record, and outbox message atomically when those
  records are part of the same command. The source event remains append-oriented.
- An inventory command writes the inventory ledger entry, variance evidence when produced by the
  command, audit record, idempotency record, and outbox message atomically.
- Cross-context validation reads stable ports inside the transaction. It does not use an
  eventually consistent report projection to authorize a write.
- Read projections are eventually consistent, carry a freshness timestamp or version when
  relevant, and can be rebuilt from source records plus the outbox/event history.
- `Idempotency-Key` records are scoped to actor, operation family, and normalized request hash;
  replay returns the stored status/body/headers without re-running side effects.
- Mutable resources use a version/ETag check. A failed `If-Match` returns `412 Precondition
  Failed`; an accepted state conflict returns `409 Conflict`.

### On-prem deployment boundary

The first supported API shape is one modular-monolith image with PostgreSQL and private MinIO in
the Docker Compose appliance runtime. Redis is optional and is not a required domain dependency.
The API must run without registry access or external SaaS calls, use immutable image tags, run as
a non-root user, expose process health separately from dependency readiness, and write structured
logs to stdout for host collection. Hyper-V/K3s/Argo CD remains an opt-in delivery target and
cannot introduce context ownership or persistence behavior that differs from Compose.

Per-environment database isolation, backup owner, recovery objectives, secret bootstrap, and
identity deployment remain `NEEDS_CONFIRMATION` under D-006, D-017, and D-023. No architecture
statement here authorizes a production topology or destructive migration.

## Pass 2 unresolved architecture items

- `NEEDS_CONFIRMATION` (D-001/D-029): whether `ProductionLine` has meaningful domain identity or
  whether the first deployment remains one implicit operational context. Workspace tenancy is not
  canonical for the first release.
- `NEEDS_CONFIRMATION` (candidate D-024): whether the planning aggregate is named `Project`,
  `ProductionPlan`, or a deliberate split. The architecture keeps both words qualified rather
  than silently making the endpoint catalog's `production-plans` canonical.
- `NEEDS_CONFIRMATION` (D-005): deployment-owned catalog now; future system/shared templates and
  line layers require a separate decision.
- `NEEDS_CONFIRMATION` (D-006): identity provider and subject-to-capability mapping.
- `NEEDS_CONFIRMATION` (D-008): physical station mapping to Stage, SubStage, or configurable
  bundle.

## Pass 7 operational boundary

### Runtime ownership

The API image owns HTTP, application/domain use cases, authorization policy calls, migrations as
an explicitly controlled job, structured stdout logging, and readiness reporting. PostgreSQL owns
relational source records and transactional outbox/idempotency state. MinIO owns private object
bytes. A deployment/operator layer owns TLS termination policy, image loading, secrets bootstrap,
backup scheduling, restore rehearsal, and host/network controls. No context may assume that a
deployment file or a local process is the source of business truth.

### Failure isolation

The application must distinguish liveness from readiness. PostgreSQL or identity failure cannot
fail open or produce successful writes; MinIO failure cannot produce a public asset URL; outbox
delivery failure does not roll back a committed source transaction; projection staleness is
visible and cannot authorize a write. These behaviors are testable adapter contracts.

### Recovery and delivery posture

The supported delivery posture is air-gapped, immutable-tag, Docker-Compose-first operation with
private PostgreSQL/MinIO. Hyper-V/K3s/Argo CD remains an optional delivery target consuming the
same image and configuration contract. Backup contents, owner, retention, encryption, RPO, RTO,
secret custody, and environment topology remain open under D-017/D-023. The design requires a
restore rehearsal and migration-compatible upgrade order but invents none of those values.

## Pass 8 consistency outcome

The architecture is consistent with the revised data model and catalog under these explicit
terminology boundaries:

- The first deployment has one server-resolved operational context; `Workspace` is not canonical
  tenant truth. `ProductionLine` is a future scope only under D-001/D-029.
- `ProductionPlan` is the working planning noun; D-024 still controls final business/API naming.
- Catalog definitions are not live planning routes; published Parts List versions are immutable;
  Execution and Inventory own evidence; Exceptions owns resolution records; Reporting owns only
  projections.
- PostgreSQL transaction boundaries, private MinIO ownership, outbox/audit distinction, and
  projection freshness match the cross-cutting design.
- Docker Compose is the first runtime direction; Hyper-V/K3s/Argo CD is optional delivery. No
  deployment file, topology, secret, or recovery objective is accepted by this document.

## Pass 2 client-evidence context refinement

The B248 evidence refines context ownership without changing the single-operational-context
boundary:

| Concern | Owning context | Design boundary |
|---|---|---|
| Product Master and reusable Product/Model/Part definitions | Catalog and Configuration | Own controlled product-content definitions and effective revisions; do not treat commercial fields or filenames as identity without confirmation |
| Model/all-model applicability | Catalog and Configuration | Use explicit relational applicability rather than duplicating a shared part into each model |
| BOM/material and packaging structures | Catalog and Configuration, consumed by Planning | Keep parent/child content and packaging quantities separate from execution route order; exact ownership and quantity policy remain `NEEDS_CONFIRMATION` |
| Injection, decoration, assembly, and packaging process specifications | Catalog and Configuration | Preserve process parameters and controlled sequence as specifications; do not infer execution order from worksheet row order |
| Plan-selected Parts List and executable route | Planning | Snapshot approved source definitions and publish immutable route versions for execution |
| PMRS control/requisition evidence | Planning boundary pending D-007 | Retain a bounded external/reference boundary until ownership of requisition and issue behavior is accepted |
| Source files, checksums, and controlled-document lineage | Assets/Documents plus owning domain | Store private asset metadata and source provenance without making object keys or files business identity |

The contexts communicate through application-facing DTOs or ports. Planning may consume a
published Catalog specification and create a plan snapshot, but it must not import Catalog
persistence types or mutate live catalog content. Execution consumes the published route; it does
not interpret BOM or packaging worksheet structure at scan time.

An unresolved source-reference conflict is an input-quality condition owned by the source/design
workflow. It may be recorded as draft evidence, but release into an executable planning definition
is blocked until the accepted conflict-release policy is applied.

## Decisive material-control and reconciliation ownership

The target operating model resolves the former PMRS boundary ambiguity:

- Planning owns approved PATS-scope material requirements derived from released demand/BOM
  definitions.
- Inventory and Traceability owns append-only PATS-scope issue evidence and rebuildable balances.
- PMRS is a controlled external document/projection used for reconciliation and operational
  communication; it is not the write-side source of material balance.
- External ERP/Warehouse remains the authority for physical stock and procurement. PATS records
  the requirement and PATS-scope issue evidence needed for production traceability.

The source-reconciliation workflow is a platform capability used by the owning domain:

```text
draft source revision
  -> validate identifiers, revisions, quantities, and relationships
  -> create blocking reconciliation issues
  -> authorized correction and audit evidence
  -> approve immutable revision
  -> release plan/material definition
```

No unresolved source revision can become an executable route or approved material requirement.
The workflow corrects manual operational conflicts at the controlled-boundary transition instead
of preserving contradictory values as simultaneous canonical truth.

## Pass 1 schema-normalization revision: ownership resolution

The normalized source-control entities do not create a generic business-document context and do
not give one context duplicate ownership of Product Master, Parts List, and PMRS meaning. They
use the following split:

| Entity or boundary | Owning context | Ownership rule |
|---|---|---|
| `ControlledDocumentRevision` | Assets and Documents for lineage metadata; semantic source owner by document type | Owns stable source/revision identity, provenance, checksum, source-asset relation, and revision lifecycle metadata. It does not own Product, BOM, process, packaging, demand, or PMRS meaning. |
| `SourceReconciliationIssue` | Exceptions and Audit | Owns blocking validation findings and their evidence. The source owner supplies the validation rule and may not bypass an open blocking issue. |
| `SourceReconciliationResolution` | Exceptions and Audit | Owns append-only selected-value, resolver, reason, and concurrency evidence. It creates a corrected revision through the source owner; it does not mutate the observed source revision. |
| `SourceRevisionApproval` | Exceptions and Audit | Owns immutable approval evidence and approval audit linkage. The source owner and capability policy determine whether approval is allowed; approval is committed with the revision state transition. |
| Product Master semantics: `PartDefinition`, `PartApplicability`, `BomDefinition`, `BomLine`, `ProcessSpecification`, `ProcessSpecificationStep`, `PackagingSpecification`, `PackagingLine` | Catalog and Configuration | Owns reusable product-content definitions and effective revisions. BOM, process, and packaging rows are not route steps or inventory rows. |
| `ProductSpecificationSnapshot` | Planning | Owns the plan-scoped immutable capture of an approved Product Master revision. It is evidence for a plan, not a live catalog alias. |
| `PartsListVersion`, `PlanPart`, `RouteStep` | Planning | Owns the executable, plan-scoped route definition. It references approved source/content revisions and is the only route source consumed by Execution. |
| `PlanDemandAllocation`, `MaterialRequirement`, `PMRSReference` | Planning | Owns dimensioned demand and approved PATS-scope requirements. PMRS remains an external/control reference; it is not a PATS issue ledger. |
| `InventoryTransaction` | Inventory and Traceability | Owns append-only PATS-scope receiving/issue/correction evidence and material-requirement linkage. Derived balances are projections, not editable transaction fields. |
| `SubjectPreference`, `SubjectWalkthroughCompletion` | Identity and Authorization | Owns subject-scoped product preferences and versioned walkthrough evidence. These records do not grant capability or alter object ownership. |

`PlanModelAllocation` is retained only as a derived/reconciliation-backed summary of
`PlanDemandAllocation` for model-level reads. It is not a second independently editable demand
total. A plan release may cite its source demand version and calculated total; a client cannot
mutate the summary separately from its dimensioned demand rows.

The source-control workflow is therefore a capability spanning Assets/Documents, Exceptions/Audit,
and the semantic source owner. It is not a new unrestricted aggregate and does not turn PMRS into
PATS-owned inventory. The first deployment remains one server-resolved operational context.
