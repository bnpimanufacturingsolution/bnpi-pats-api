# Chain Run: Bandai PATS Schema Design and Normalization

**Status:** COMPLETED - documentation-only; first implementation slice revised by the
2026-07-15 single-operational-context revision; pending explicit implementation approval

**Completed:** 2026-07-14

## Objective

Produce a normalized, reviewable PostgreSQL schema design for PATS from the approved domain and
on-prem operating truth, while keeping unresolved decisions visible and avoiding Prisma or
migration implementation until the design is accepted.

The original chain carried a workspace/membership tenancy alternative. The 2026-07-15 revision
supersedes that alternative for the first deployment: the first persistence slice is
deployment-scoped subjects and capability assignments. Workspace and membership tables are not
to be added unless D-001/D-029 is explicitly changed.

## Scope

- In scope: schema authority, normalization, relation decomposition, deployment ownership, keys,
  constraints, indexes, lifecycle persistence, ledgers, audit, outbox, idempotency, jobs, assets,
  projections, retention placeholders, migration safety, and handover.
- Out of scope: Prisma edits, migrations, generated client changes, seeds, application source,
  routes/controllers, frontend changes, production data, deployment changes, and silent decision
  acceptance.

## Execution model

- Five passes execute sequentially.
- Each pass reads its prompt and writes only its declared deliverable.
- A pass that encounters a blocking ambiguity labels it and carries it forward; it does not guess.
- The design may present alternatives and a recommendation, but only an explicitly accepted
  decision can become an implementation constraint.
- The existing draft `prisma/pats/schema.prisma` is read-only evidence.

## Pass index

| Pass | Name | Status |
|---|---|---|
| 1 | Schema authority and decision lock | completed |
| 2 | Normalized relational decomposition | completed |
| 3 | Constraints, indexes, and lifecycle persistence | completed |
| 4 | Operational persistence and migration safety | completed |
| 5 | Consistency review and handover | completed |

## Required pass report

Every pass report must include:

- Pass completed
- What changed
- Self-check result
- Open questions or blockers
- Ready for next pass

## Global self-check

- [x] Only the chain's declared documentation files changed during this schema-design work.
- [x] No Prisma, migration, generated, seed, deployment, application, or frontend file changed.
- [x] Every uncertainty is labelled `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`.
- [x] Core relationships are relational; JSON is bounded and owned.
- [x] Operational ownership, actor, lifecycle, version, correction, retention, and migration boundaries are explicit.
- [x] Existing design and endpoint documents remain internally consistent after the Pass 5 atomicity clarification.
- [x] `git diff --check` passes.

## Handover rule

The chain is complete only after the final report names the exact next implementation task, the
decisions it depends on, the files it may touch, the migration safety gate, and the tests required
before a Prisma schema or migration is accepted.
