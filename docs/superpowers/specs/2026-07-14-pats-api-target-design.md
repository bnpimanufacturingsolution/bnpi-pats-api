# Bandai PATS API Target Design

**Status:** DESIGN PACKAGE FOR REVIEW

**Date:** 2026-07-15 (single-operational-context revision)

## Goal

Define the Bandai PATS API from domain truth and on-prem operational constraints before further
route, schema, seed, authentication, or frontend integration work.

## Governing rule

Every endpoint must conform to the approved internal
[`restful-endpoint-design-standards.md`](../../standards/restful-endpoint-design-standards.md).
The repository-owned copy is normative for this project. The API `AGENTS.md` makes it a required
reading and review gate.

## Design stance

- The API is designed blind from the frontend implementation but aligned with its confirmed
  business terminology and working domain model.
- Legacy PMS routes and demo data are evidence of compatibility concerns, not canonical PATS
  behavior.
- PATS begins as a modular monolith on PostgreSQL/Prisma with private MinIO and Docker.
- Public contracts use versioned REST resources, shallow relationships, explicit authorization,
  standard errors, and reviewable OpenAPI.
- No design document may silently promote an inferred or conflicting requirement to confirmed
  truth.

## Package map

| Document | Purpose |
|---|---|
| `docs/superpowers/context/2026-07-14-pats-api-design-context.md` | source precedence, scope, working truth |
| `docs/architecture/2026-07-14-pats-api-target-architecture.md` | bounded contexts and architecture boundaries |
| `docs/data/2026-07-14-pats-api-data-model-design.md` | conceptual entities, relations, invariants, gaps |
| `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md` | versioned resource inventory and endpoint rules |
| `docs/api/2026-07-14-pats-api-cross-cutting-design.md` | auth, errors, concurrency, assets, events, operations |
| `docs/decisions/2026-07-14-pats-api-design-decision-register.md` | open decisions and blocking questions |
| `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md` | design and future implementation sequence |
| `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md` | sequential pass index and execution rules |
| `docs/superpowers/prompts/2026-07-14-pats-api-design-handover.md` | restartable prompt for another session |

## Design completion gate

The design is not ready for implementation until:

- all bounded contexts have owners and dependency direction;
- all core entities have identity, lifecycle, operational ownership, and invariants;
- endpoint families have standard-compliant paths, methods, pagination, errors, auth, retries,
  concurrency, and OpenAPI operation definitions;
- write-side state transitions and append-ledger rules are explicit;
- blocking decisions are either accepted or explicitly kept outside implementation scope;
- the implementation backlog has no dependency gaps;
- the final handover prompt can restart the work without relying on chat history.

## Pass 2 architecture gate

The working architecture is a modular monolith with explicit bounded-context ownership,
application-facing ports, and Prisma/MinIO/identity adapters. The following are architectural
constraints for the remaining design passes, not implementation approval:

- Identity and Authorization supplies subject resolution, deployment-scoped capabilities, and
  object-access policy; every protected context uses it without importing its persistence types.
- Catalog defines reusable configuration; Planning selects/version-snapshots a route; Execution
  records actual events; Inventory records quantity movement; Exceptions preserves detected
  evidence; Reporting only projects; Platform supplies infrastructure capabilities.
- Source ledgers and audit/outbox writes are transactionally coordinated. Projections are
  rebuildable and may be eventually consistent.
- The first runtime is Docker Compose with PostgreSQL and private MinIO in an air-gapped
  environment. Hyper-V/K3s/Argo CD remains a delivery option, not a domain dependency.
- The first deployment uses one server-resolved operational context. `Workspace` is not a
  canonical tenant or membership entity for that deployment. A `ProductionLine` scope is a
  future option only if D-001/D-029 confirms meaningful line identity or multiple lines in one
  database. `Project` versus `ProductionPlan` remains `NEEDS_CONFIRMATION`; no endpoint path is
  treated as accepted solely because it appears in the provisional catalog.

## Final consistency gate

Passes 1 through 8 are complete when the following evidence is present:

- the context, architecture, data model, lifecycle, contract, endpoint, and operations documents
  agree on ownership, terminology boundaries, route conventions, state evidence, and open
  decisions;
- the endpoint catalog has operation IDs, request/response responsibilities, status/problem
  policies, auth/object checks, pagination, concurrency, idempotency, audit/outbox behavior, and
  test obligations;
- the implementation backlog is dependency ordered and does not conceal unresolved business or
  operational choices;
- the handover prompt restates the required reading order, stop conditions, reporting format, and
  explicit approval gate;
- no source, Prisma schema, migration, generated artifact, seed, deployment, or frontend file was
  changed.

The chain is documentation-complete but remains `PENDING USER APPROVAL` for implementation. An
explicit user approval message is required before any implementation-phase skill or code change is
started.

The single-operational-context revision supersedes the earlier workspace/membership tenancy
assumption for implementation planning. The normalized schema chain remains evidence, but its
first persistence task must follow the revised handover and scope decision.

## Out of scope for this design package

- implementing routes or controllers;
- changing the Prisma schema or migrations;
- creating production seeds;
- integrating the frontend;
- redesigning authentication or roles in code;
- production deployment or destructive data operations;
- committing unapproved business assumptions.

## Client-evidence reconciliation boundary (Pass 2)

The B248 Product Master, Parts List, and PMRS artifacts are controlled business evidence within
their respective domains. They refine the design scope but do not authorize a spreadsheet-shaped
schema or new implementation endpoint.

The target design must distinguish:

- controlled product/package documents and their revisions;
- reusable Product, Model, and Part definitions with model/all-model applicability;
- BOM/material relationships and their quantities/units;
- process specifications for injection, decoration, assembly, and packaging;
- the executable Parts List/route selected for a plan;
- packaging hierarchy and ratios; and
- PMRS/requisition evidence versus PATS-owned inventory or issue ledgers.

The existing `PartsListVersion` and `RouteStep` concepts remain the execution-route boundary. They
must not become a catch-all for BOM children, decoration rows, packaging ratios, mold parameters,
or worksheet order. The new relationships remain `NEEDS_CONFIRMATION` until the affected domain
owners accept the controlled-document, part, BOM, process, and packaging decisions.

The B248 identifier conflict and the Asia quantity conflict remain visible. A source artifact may
be captured as evidence while unresolved, but it must not be published as an executable planning
definition until the applicable conflict-release policy is accepted.

## Decisive target operating model

The approved design direction resolves manual-operational contradictions through a controlled
revision workflow and canonical system values:

- `B248-02-08` is the canonical Kuririn Body part; `B248-01-08ST` is rejected as an invalid
  source reference and retained in correction evidence.
- The latest approved Asia line-level quantities govern: `77,860` total, `77,060` issued, and
  `800` balance. Header totals are derived and validated against lines.
- PATS owns PATS-scope material requirements and issue evidence. PMRS is an external control
  projection/reference; physical stock and procurement remain external unless separately integrated.
- Source revisions cannot be approved or released while blocking reconciliation issues are open.
- Quantity/UOM/usage basis is explicit; absent tolerance means strict equality.
- Demand purpose and market/region are first-class plan-demand dimensions.

These decisions define the target system behavior. Corrected source documents remain auditable
inputs to the approval workflow and are not silently rewritten.
