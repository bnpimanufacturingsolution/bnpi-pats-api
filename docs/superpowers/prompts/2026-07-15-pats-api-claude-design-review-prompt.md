# Claude Review Prompt: Bandai PATS API Design Package

You are reviewing the Bandai PATS API design package in:

`C:\Users\Admin\Documents\Projects\BANDAI PATS\bnpi-pats-api`

Review the current `develop` working tree. This is an independent senior architecture, domain,
data-model, REST-contract, authorization, and on-prem operations review. Do not implement code,
modify Prisma schemas, create migrations, change generated artifacts, alter seeds, change
deployment files, or edit frontend files.

## Review objective

Determine whether the revised PATS API design is internally consistent and ready for an explicitly
approved implementation phase.

The current working direction is:

- PATS is an on-prem production/assembly tracker, not a SaaS multi-tenant product.
- The first deployment has one server-resolved operational context.
- `Workspace` is not a canonical tenant or public API resource for the first release.
- The first release should not implement `/workspaces`, workspace memberships, client-selected
  tenant scope, cross-tenant HTTP behavior, or composite tenant foreign keys.
- Authorization remains explicit through verified subjects, deployment-scoped capability
  assignments, and object ownership checks.
- `ProductionLine` is a future persisted domain entity only if the business confirms meaningful
  line identity or multiple physical lines sharing one database.
- The first persistence slice, after explicit approval and Gate 0, is `subjects` plus
  deployment-scoped `subject_assignments`.
- The frontend prototype and legacy API are alignment/compatibility evidence only. They are not
  the source of truth for API identity, persistence, authorization, lifecycle, or endpoint
  semantics.

Treat these as working recommendations to review, not as silently accepted decisions.

## Required reading order

Read these files before forming conclusions:

1. `AGENTS.md`
2. `docs/standards/restful-endpoint-design-standards.md`
3. `docs/principles/restful-endpoint-design-principle.md`
4. `docs/standards/endpoint-design-review-checklist.md`
5. `docs/superpowers/context/2026-07-14-pats-api-design-context.md`
6. `docs/superpowers/specs/2026-07-14-pats-api-target-design.md`
7. `docs/architecture/2026-07-14-pats-api-target-architecture.md`
8. `docs/data/2026-07-14-pats-api-data-model-design.md`
9. `docs/data/2026-07-14-pats-api-normalized-schema-design.md`
10. `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`
11. `docs/api/2026-07-14-pats-api-cross-cutting-design.md`
12. `docs/decisions/2026-07-14-pats-api-design-decision-register.md`
13. `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md`
14. `docs/superpowers/prompts/2026-07-14-pats-api-schema-normalization-handover.md`
15. `docs/superpowers/chains/2026-07-15-pats-api-single-operational-context-revision-chain.md`

You may inspect source, Prisma, legacy schema, generated documentation, and frontend evidence
only to identify conflicts. Do not treat those surfaces as canonical without evidence and do not
modify them.

## Review questions

### 1. Domain and scope

- Is the single-operational-context recommendation appropriate for the current PATS business?
- Is removing workspace/membership tenancy correct, or is any required business concept being
  accidentally removed?
- Is the future `ProductionLine` migration boundary clear and safe?
- Are any business concepts missing from the bounded contexts?

### 2. Data model and normalization

- Are `subjects` and `subject_assignments` sufficient for the first identity/authorization slice?
- Are relationships normalized and relational rather than hidden in JSON?
- Are Lot, PlanPart, Batch, StageEvent, InventoryTransaction, Asset, AuditRecord, OutboxMessage,
  IdempotencyRecord, and Job modeled with appropriate ownership and lifecycle boundaries?
- Are constraints, indexes, immutable evidence, correction records, and projection rules adequate?
- Does the design accidentally preserve tenant assumptions under different names?
- Are any proposed keys, types, nullability rules, or uniqueness rules unsafe or premature?

### 3. API and REST contract

- Do all routes follow `/api/v1`, plural lowercase kebab-case nouns, shallow nesting,
  `snake_case` query parameters, and `camelCase` JSON?
- Are HTTP methods, statuses, pagination, RFC 9457 errors, ETags, `If-Match`, idempotency,
  trace propagation, rate limits, and deprecation rules consistently specified?
- Does every protected operation define authentication, capability, deployment-context, and
  object-level authorization checks?
- Are any endpoint semantics still derived from the frontend or legacy API?
- Are any endpoint families too vague to implement safely?

### 4. Lifecycle and invariants

- Are forward progression, holds, terminal states, correction, rework, and reversal boundaries
  coherent?
- Are StageEvents and InventoryTransactions correctly append-oriented?
- Are transaction bundles, audit, outbox, idempotency, and rebuildable projections consistent?
- Which lifecycle decisions must be accepted before write endpoints can exist?

### 5. On-prem operations

- Is the Docker Compose-first, air-gapped posture realistic and sufficiently bounded?
- Are PostgreSQL and MinIO backup/restore responsibilities clear enough?
- Are liveness, readiness, dependency failures, identity failures, object-storage failures,
  outbox failures, and projection staleness handled safely?
- Are any RPO, RTO, retention, topology, or ownership assumptions being invented silently?

### 6. Decision quality and implementation readiness

For every open decision, determine whether it should be:

- `ACCEPT_RECOMMENDATION` — safe to formalize based on current evidence;
- `DEFER_WITH_BOUNDARY` — leave open, but the design safely excludes it from the first slice;
- `NEEDS_CONFIRMATION` — requires a business or operational owner;
- `CONFLICTING` — evidence must be reconciled before proceeding; or
- `STALE` — should not influence the canonical design.

Pay particular attention to D-001/D-002/D-005/D-006/D-008/D-009/D-010/D-014/D-017/D-020/D-021,
D-024/D-025/D-026/D-027/D-028, and D-029.

## Required output

Return a review report only. Do not edit repository files.

Use this structure:

### Executive verdict

Choose one:

- `READY_FOR_GATE_0`
- `READY_WITH_REQUIRED_REVISIONS`
- `NOT_READY`

State whether implementation should remain blocked.

### Critical findings

For each finding, include:

- severity: `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`;
- affected file and section;
- concrete inconsistency, risk, or missing rule;
- why it matters to the business, schema, API, authorization, or operations;
- recommended resolution;
- whether it blocks Gate 0, schema implementation, or only later work.

### Decision-by-decision review

Use a table:

| Decision | Meaning | Review result | Recommended disposition | Rationale |
|---|---|---|---|---|

Do not mark a decision accepted merely because it is convenient. Distinguish technical
recommendations from business approvals.

### Domain and schema review

Identify missing entities, unsafe relationships, normalization issues, incorrect constraints,
missing indexes, lifecycle gaps, and migration risks. Explicitly review whether the first schema
should contain any workspace, membership, tenant, or `production_line` tables/columns.

### API and authorization review

Identify endpoint gaps, REST violations, ambiguous operation semantics, missing authorization
checks, incorrect statuses, retry/concurrency risks, and missing Problem Details behavior.

### Operations review

Identify backup, restore, MinIO, identity, readiness, air-gap, observability, upgrade, rollback,
and projection risks.

### Recommended Gate 0 freeze

Provide the smallest exact set of decisions that must be accepted or explicitly deferred before
the first persistence task. Include owner/review condition for each deferred item.

### Recommended next implementation task

Confirm or reject this proposed sequence:

1. Gate 0 decision freeze;
2. `subjects` and deployment-scoped `subject_assignments` persistence;
3. isolated PostgreSQL migration and tests;
4. provider adapter, capability policy, and object-ownership checks;
5. later bounded-context implementation.

### Final handover

State:

- whether the design is ready for explicit user implementation approval;
- what must be revised first, if anything;
- which uncertainties remain intentionally open;
- whether any source, Prisma, migration, test, generated, seed, deployment, or frontend change
  was requested (the answer must be no for this review).
