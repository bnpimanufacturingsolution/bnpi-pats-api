# Bandai PATS API Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task-by-task after the design package is approved. Do not implement code during the design chain.

**Goal:** Produce a reviewed, standard-compliant PATS API blueprint and then implement it in dependency order without deriving canonical behavior from the unfinished frontend or legacy API.

**Architecture:** Begin with a modular monolith organized by bounded contexts and hexagonal ports. Keep HTTP adapters, application use cases, domain invariants, persistence adapters, object storage, identity, audit, and outbox boundaries explicit so a future service split remains possible without premature distribution.

**Tech Stack:** Node.js 20, TypeScript, Express, PostgreSQL, Prisma migrations, MinIO/S3-compatible storage, Docker Compose, OpenAPI 3.1, JSON Schema, RFC 9457 Problem Details, W3C Trace Context.

## Global Constraints

- `docs/standards/restful-endpoint-design-standards.md` is mandatory for every endpoint design, implementation, review, and OpenAPI change.
- Public canonical API paths start with `/api/v1`.
- Resource paths use plural lowercase kebab-case nouns; nesting is limited to one level.
- Query parameters use `snake_case`; JSON request and response fields use `camelCase`.
- Paginated collections use only the standard `data` and `pagination` envelope.
- Errors use RFC 9457 Problem Details and are never returned as successful responses.
- Tenancy and object-level authorization are explicit and server-verified.
- Core relationships use PostgreSQL constraints; JSON is limited to bounded metadata.
- Operational ledgers are append-oriented and projections are rebuildable.
- No frontend integration is required during API design or initial API implementation.
- Existing seeded, initial-based, filename-based, and legacy PMS behavior is not canonical.
- Any uncertainty is marked `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`.
- No destructive migration, production deployment, or production seed operation is authorized by this plan.

## Phase 1: Documentation-only design chain

### Task 1: Evidence and scope lock

Read the API repository, approved REST standard, PATS requirements, on-prem architecture notes,
current PATS schema, and frontend alignment evidence. Record confirmed, inferred, conflicting,
stale, and out-of-scope facts in the design context.

**Deliverable:** `docs/superpowers/context/2026-07-14-pats-api-design-context.md` and Pass 1 handoff.

### Task 2: Bounded contexts and architecture

Define context ownership, module dependency direction, application/domain/adapter boundaries,
transaction ownership, outbox position, and Docker-first deployment assumptions.

**Deliverable:** `docs/architecture/2026-07-14-pats-api-target-architecture.md`.

### Task 3: Canonical data model

Design entities, value boundaries, relations, indexes, lifecycle ownership, tenant scope,
versioning, deletion behavior, audit fields, event evidence, and JSON metadata limits. Reconcile
the current draft's project-scoped workflow, part-scoped lot, mutable batch position, PMRS
placeholder, actor fields, asset linkage, and missing audit/outbox models.

**Deliverable:** `docs/data/2026-07-14-pats-api-data-model-design.md`.

### Task 4: Lifecycle and invariants

Define state machines for production plans, lots, batches, stage events, inventory transactions,
routing violations, jobs, assets, and outbox messages. Identify invariants that must be database
constraints, domain validation, transactional rules, or projections.

**Deliverable:** lifecycle and invariant sections in the data model, decision register, and chain
handoff report.

### Task 5: HTTP contract and common semantics

Apply the approved REST standard to versioning, paths, methods, shallow relationships, query
parameters, pagination, errors, content negotiation, ETags, `If-Match`, idempotency keys,
`traceparent`, rate limits, async jobs, and deprecation.

**Deliverable:** `docs/api/2026-07-14-pats-api-cross-cutting-design.md` and endpoint checklist
evidence for the catalog.

### Task 6: Endpoint catalog and authorization matrix

Inventory read and write resources by bounded context. For every proposed endpoint define its
owner, tenant scope, authorization rule, request/response responsibility, side effects, status
codes, problem types, pagination, concurrency, retry behavior, audit, outbox, and OpenAPI
operation identity. Do not implement routes.

**Deliverable:** `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md` and a complete
decision register update.

### Task 7: Cross-cutting and on-prem operations

Design asset ownership, MinIO privacy, audit and outbox behavior, observability, rate limiting,
backup/restore boundaries, air-gapped delivery, upgrade/rollback compatibility, health/readiness,
and test layers. Do not invent RPO/RTO or retention values; record them as decisions.

**Deliverable:** cross-cutting design additions and an operations section in the final report.

### Task 8: Consistency review and implementation backlog

Review all documents against the approved standard and each other. Resolve only decisions that
are explicitly accepted; retain the rest as open. Produce the dependency-ordered implementation
backlog and final handover prompt.

**Deliverable:** approved design package, completed chain report, and the handover prompt.

## Phase 2: Future implementation sequence

Implementation starts only after the design chain and blocking decisions are approved.

1. Common HTTP contract: versioned routing, content negotiation, Problem Details, validation,
   pagination, trace context, rate limits, and standard response helpers.
2. Identity and tenancy: subject mapping, workspace/line membership, role policy, object-level
   authorization, and provider adapter.
3. PostgreSQL boundary: final Prisma schema, migration strategy, constraints, indexes, audit,
   idempotency, and outbox tables.
4. Catalog: Products, Models, ModelParts, workflow catalog, stations, work instructions, asset
   references, and read contracts.
5. Planning: production plans, allocations, parts lists, versions, project Parts, Lots, and
   publish/release rules.
6. Execution: Batches, stage events, routing validation, holds, closure, scrap, and station
   queues.
7. Inventory and traceability: receiving, issuance, movement, variance, withdrawal references,
   batch/lot trace, and append-ledger projections.
8. Exceptions and audit: routing violations, process changes, resolution policies, and immutable
   audit evidence.
9. Assets and jobs: private MinIO lifecycle, async jobs, import/export, retry, and cleanup.
10. Reporting and operations: rebuildable projections, readiness, backups, restore rehearsal,
    Compose/K3s-compatible delivery, and contract-driven release gates.

Each implementation phase must use TDD, complete the endpoint review checklist, update OpenAPI,
and commit only its scoped files.
