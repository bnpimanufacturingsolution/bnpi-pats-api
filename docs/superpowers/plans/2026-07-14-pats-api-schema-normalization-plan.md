# Bandai PATS PostgreSQL Schema Design and Normalization Plan

**Status:** DESIGN-ONLY PLAN

**Scope revision:** The 2026-07-15 single-operational-context chain supersedes the prior
workspace/membership tenancy assumption for the first deployment.

**Purpose:** Convert the approved conceptual PATS data model into a reviewable, normalized
PostgreSQL schema design without silently resolving domain decisions or editing Prisma,
migrations, generated artifacts, seeds, deployment files, or application source.

## Authority and constraints

- The domain/data-model design, architecture, cross-cutting design, decision register, and
  approved REST standard are the governing inputs.
- The existing `prisma/pats/schema.prisma` is implementation evidence only. It is not canonical
  and must not be copied mechanically.
- The unfinished frontend, legacy Mongo/PMS schema, generated docs, fixtures, and seed data are
  alignment or compatibility evidence only.
- Every unresolved item remains `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`; this chain may
  recommend alternatives but may not accept a business choice.
- Core relationships, deployment ownership, lifecycle state, ledgers, audit, outbox, idempotency,
  jobs, assets, and projection checkpoints must be represented relationally or explicitly
  bounded; JSON cannot replace relational truth.
- No production data, destructive migration, deployment, or implementation authorization is
  implied by this plan.

## Deliverables

- `docs/data/2026-07-14-pats-api-normalized-schema-design.md`
- Five sequential pass reports under `docs/superpowers/chains/`
- `docs/decisions/2026-07-14-pats-api-design-decision-register.md` only if the chain discovers a
  genuinely new decision; existing open statuses must not be rewritten silently.
- `docs/superpowers/prompts/2026-07-14-pats-api-schema-normalization-handover.md`
- Updated chain run record and implementation handover naming the next gated task.

## Pass sequence

### Pass 1: Schema authority and decision lock

Audit every decision that affects identity, operational ownership, naming, cardinality, quantities,
actor references, assets, retention, and migration. Separate design choices that can be carried
as neutral alternatives from choices that block implementation. Do not accept open decisions.

### Pass 2: Normalized relational decomposition

Create the table/relationship design for identity, deployment authorization, catalog, planning, execution,
inventory, exceptions, audit, platform, assets, and projections. Define table purpose, identity,
operational ownership relation, candidate columns, keys, foreign keys, nullability, and bounded metadata. Keep
business nouns that are still open explicitly neutral.

### Pass 3: Constraints, indexes, and lifecycle persistence

Map every invariant to a database constraint, domain validation, transaction rule, or projection.
Define unique/check/FK constraints, deployment-owned reference strategy, indexes for canonical queries,
append-only protections, version immutability, and state transition persistence. Mark alternatives
where an open decision changes the constraint.

### Pass 4: Operational persistence and migration safety

Design audit, outbox, idempotency, jobs, assets, projection checkpoints, retention placeholders,
transaction bundles, failure/retry behavior, expand/contract migration boundaries, rollback
compatibility, and legacy-data isolation. Do not invent RPO, RTO, retention, topology, or owner
values.

### Pass 5: Consistency review and handover

Cross-check the normalized design against all canonical docs, endpoint catalog, authorization
matrix, lifecycle invariants, OpenAPI components, and decision register. Record contradictions,
new decisions, unresolved blockers, migration risks, and the exact first Prisma implementation
task. Produce the final handover prompt.

## Pass gate

After every pass report:

- Pass completed
- What changed
- Self-check result
- Open questions or blockers
- Ready for next pass

The chain passes only when all five reports are complete, `git diff --check` passes, no prohibited
file changed, every table has an ownership/key/lifecycle statement, every JSON field has a
bounded purpose, and no open decision is hidden as a finalized schema choice.
