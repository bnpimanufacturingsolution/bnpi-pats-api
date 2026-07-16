# Bandai PATS Schema Normalization Handover

**Status:** DESIGN CHAIN COMPLETE - IMPLEMENTATION NOT AUTHORIZED

**Date:** 2026-07-15 (revised by single-operational-context chain)

## Current result

The schema normalization chain completed all five documentation-only passes. The canonical
deliverable is `docs/data/2026-07-14-pats-api-normalized-schema-design.md`, interpreted together
with the 2026-07-15 single-operational-context revision and
`docs/data/2026-07-14-pats-api-data-model-design.md`. It is a proposed normalized relational
design, not a Prisma schema, migration, seed, generated client, or runtime authorization contract.

The first deployment is not a SaaS multi-tenant system. It uses one server-resolved operational
context. `Workspace`, workspace membership, client-selected tenant scope, and cross-tenant HTTP
behavior are not first-release persistence or API requirements. `ProductionLine` remains a future
identity only if D-001/D-029 confirms meaningful line identity or multiple lines in one database.

The chain did not modify Prisma, migrations, generated artifacts, seeds, deployment files,
application source, or frontend files. Completion of the chain is not implementation approval.
The user must explicitly approve the implementation phase before any persistence or application
file is changed.

## Consistency review result

Pass 5 cross-checked the normalized design against the target architecture, conceptual data model,
lifecycle/invariant rules, endpoint catalog, authorization/cross-cutting design, OpenAPI common
components, decision register, and on-prem boundary.

The one consistency issue found was the scope of projection-checkpoint atomicity. The endpoint and
cross-cutting design now distinguish:

- source mutation, exception evidence, audit, idempotency result, outbox, and any command-owned
  projection/checkpoint as one PostgreSQL transaction;
- the StageEvent current-position projection as the accepted command-owned projection case;
- asynchronous report projection rows and checkpoints as one later projection-worker transaction
  after the durable source/outbox handoff.

The following are implementation conditions, not silently accepted decisions:

- catalog layering and system/shared template ownership remain D-005
  `NEEDS_CONFIRMATION`;
- ordinary deployment-owned foreign keys are the first-release recommendation; a line-aware
  composite FK strategy is deferred until D-001/D-029;
- station target granularity remains D-008 `NEEDS_CONFIRMATION`;
- Lot and BatchPart cardinality remains D-010 `NEEDS_CONFIRMATION`;
- quantity, unit, correction, and variance representation remains D-020/D-021 open or
  `CONFLICTING`;
- actor/provider and historical snapshot fields remain D-006/D-025 `NEEDS_CONFIRMATION`;
- asset typed-link FK strategy and PostgreSQL/MinIO ownership, retention, and backup remain
  D-014/D-027 `NEEDS_CONFIRMATION`;
- lifecycle literals, append-only enforcement, retention/legal-hold fields, and on-prem
  ownership/recovery values require explicit acceptance or a recorded deferral.

No new decision ID was created. Existing decision statuses remain authoritative.

## Gate 0 required before implementation

Accept or explicitly defer each blocking decision with owner, rationale, affected documents,
implementation impact, and migration/rollback or review condition:

`D-001`, `D-005`, `D-006`, `D-008`, `D-009`, `D-010`, `D-014`, `D-017`, `D-020`, `D-021`,
`D-024`, `D-025`, `D-026`, `D-027`, `D-028`, and `D-029`.

The freeze must also record the project-wide opaque ID type, deployment ownership/FK strategy,
accepted catalog scope relation, lifecycle state vocabulary, quantity/unit/rounding policy, actor
snapshot boundary, asset link strategy, append-only enforcement mechanism, retention/legal-hold
authority, and migration rollback condition. D-019 remains `CONFLICTING` evidence and must not be
promoted from the legacy or draft schema.

## Exact next implementation tasks

After Gate 0 and explicit user approval of the implementation phase:

1. **First persistence task - Gate 2 identity/authorization slice:** translate the accepted
   `subjects` and deployment-scoped `subject_assignments` relations into the dedicated PATS Prisma
   schema. Implement only the subject mapping boundary, assignment lifecycle, capability keys,
   and deployment-scoped authorization persistence needed by the identity/authorization gate.
2. Add the reviewed identity/authorization migration and isolated PostgreSQL persistence tests.
   Do not copy `prisma/pats/schema.prisma` mechanically and do not alter the legacy Mongo/PMS
   schema.
3. Complete the Gate 2 provider adapter, capability policy, and object-ownership checks as a
   separate application task. Then begin **Gate 3 - PostgreSQL persistence boundary** for catalog,
   planning, execution, inventory, audit, idempotency, outbox, jobs, assets, and projections.

The full schema must not be generated in one pass before the identity/authorization gate proves
the deployment, subject, capability, and actor boundary. Do not add workspace or membership tables
unless D-001/D-029 explicitly changes the scope decision.

## Allowed file scope for the first Prisma task

Only the following may be changed after approval for the first persistence slice:

- `prisma/pats/schema.prisma`;
- one reviewed additive migration under `prisma/pats/migrations/`;
- dedicated PostgreSQL persistence/integration tests under the repository's approved test path;
- the decision/design documents required to record accepted Gate 0 decisions and their impact.

Application identity adapters, authorization policy, and audit integration belong to the separate
Gate 2 application task. No generated artifact is committed unless repository policy explicitly
requires it. Do not touch `prisma/schema/**`, legacy migrations, seeds, deployment files, frontend
files, or unrelated HTTP routes in the first persistence task.

## Isolated PostgreSQL test gate

The first slice is accepted only when an isolated, non-production PostgreSQL instance proves:

- migration application from an empty database and clean migration status;
- project-wide ID generation/type and immutable identity behavior;
- deployment-owned parent/child FK behavior and rejected references to non-owned objects;
- subject-provider uniqueness and approved nullable/snapshot rules;
- active assignment uniqueness, lifecycle timestamp checks, revocation/reinstatement policy, and
  capability-assignment uniqueness according to the accepted decisions;
- optimistic version/concurrency behavior for mutable identity records;
- restrictive delete/retire behavior where evidence or assignment history is retained;
- bounded/redacted actor metadata with no credentials or raw claims;
- transaction rollback leaves no partial assignment, audit, idempotency, or outbox result when
  those records are included in the approved command;
- migration compatibility evidence for the supported previous application image and no
  production database access.

The test gate must include persistence, deployment-authorization boundary, migration, and restore
(or backup checkpoint) evidence. Tests must not rely on frontend localStorage, fixtures as truth,
legacy Mongo records, or seeded initials.

## Migration and rollback evidence

Before applying a migration, record the schema diff, affected relations/indexes, lock/size risk,
backup checkpoint, compatibility assumptions, and rollback boundary. Use additive expand/contract
behavior when mixed application versions can coexist. A prior image may be rolled back only while
the expanded database remains backward-compatible; no down-migration is assumed after a contract
or destructive change. The evidence must show either a forward corrective migration or a
coordinated PostgreSQL/MinIO restore path, plus projection/outbox reconciliation where applicable.

## Explicit exclusions

This handover does not authorize:

- implementation before Gate 0 and explicit user approval;
- copying the legacy or draft Prisma model into the canonical schema;
- a production migration, data backfill, seed, or destructive operation;
- final catalog scope, station mapping, Lot cardinality, quantity/variance policy, rework policy,
  identity provider, role vocabulary, asset retention, legal-hold policy, RPO/RTO, topology, or
  deployment ownership without accepted decisions;
- route/controller changes, HTTP contract changes, generated OpenAPI/Postman output, frontend
  integration, scanner/printer behavior, or external PMRS/Withdrawal Form domain ownership;
- using JSON for subject assignments, route steps, current position, inventory balance, or
  authorization truth.

## Restart instruction

Before starting implementation, reread `AGENTS.md`, the approved REST standard and checklist, the
design package in its required order, this handover, and the accepted decision register. Confirm
the user has explicitly approved the implementation phase. Then execute Gate 0, record the freeze,
and start only the first identity/authorization persistence slice above.
