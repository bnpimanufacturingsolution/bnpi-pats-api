# Bandai PATS API Target Architecture

**Status:** PROPOSED DESIGN

**Date:** 2026-07-14

**Depends on:** `docs/superpowers/context/2026-07-14-pats-api-design-context.md`

## Recommendation

Start with a modular monolith using bounded contexts and hexagonal boundaries. Keep one deployable
API and one PostgreSQL database while the domain and tenancy model are being confirmed. Each
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

### Identity and tenancy

Owns authenticated subject mapping, workspaces/lines, memberships, roles, permissions, and
tenant context. It provides an authorization policy port consumed by every other context.

### Catalog and configuration

Owns Products, Models, ModelParts, workflow groups, stages, substages, stations, and work
instructions. It defines what can exist, not which route a project part takes.

### Planning

Owns production plans/projects, product/model allocations, product specifications, PMRS when
confirmed, Parts List versions, project Parts, Lots, and planned quantities. Planning produces an
immutable or explicitly versioned execution definition.

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
Identity/Tenancy -> every protected context
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

- Workspace versus Line as the canonical API noun.
- Identity provider and on-prem authentication mode.
- Whether catalog configuration is workspace-owned, system-owned, or layered.
- Whether station identity maps to a Stage, SubStage, or configurable bundle.
- PMRS structure and ownership.
- Rework/reversal behavior after the current forward-only workflow.
