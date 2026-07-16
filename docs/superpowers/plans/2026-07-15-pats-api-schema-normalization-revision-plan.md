# PATS API Schema Normalization Revision Plan

**Status:** COMPLETE — DOCUMENTATION-ONLY; IMPLEMENTATION BLOCKED

**Date:** 2026-07-15

**Scope:** Reconcile the proposed normalized PATS relational design after the completed original
API design, single-operational-context revision, and client-evidence reconciliation chains.

## Objective

Produce a coherent, implementation-ready design handover for the canonical entities, ownership
boundaries, normalized relations, constraints, namespaces, lifecycle/reconciliation invariants,
and API/on-prem mapping. This plan does not authorize Prisma, migrations, application routes,
generated artifacts, seeds, deployment files, or frontend changes.

## Fixed target direction

- The first deployment has one server-resolved operational context. `Workspace`, membership
  tenancy, client-selected tenant scope, and first-release `ProductionLine` persistence remain
  excluded. Future line scope remains `NEEDS_CONFIRMATION` under D-001/D-029.
- Product Master, Parts List, and PMRS remain distinct controlled source artifacts. PATS owns
  approved PATS-scope material requirements and append-only issue evidence; PMRS is a reconciled
  control projection/reference; physical stock and procurement remain external.
- `B248-02-08` is the canonical Kuririn Body code. `B248-01-08ST` is invalid source evidence,
  retained only through reconciliation/correction evidence.
- The latest approved Asia line-level target is total `77,860`, issued `77,060`, and derived
  balance `800`; the stale `77,060` header remains source evidence. Corrected source revision
  and effective-revision registration remain controlled release gates.
- Quantities preserve magnitude, UOM, usage basis, precision, and source representation. Ratios
  are not silently converted. Missing tolerance means strict equality; explicit tolerance is
  per requirement or operation and produces auditable variance evidence.
- Gate 0 remains pending. Implementation requires Gate 0 freeze and separate explicit user
  approval even after this documentation revision completes.

## Sequential passes

| Pass | Deliverable | Primary surfaces |
|---|---|---|
| 1 | Canonical entity and ownership map; duplicate-ownership resolution | Data model, normalized schema, architecture, pass report — completed |
| 2 | 1NF/2NF/3NF relation inventory, keys, constraints, namespaces, indexes | Normalized schema, data model, pass report — completed |
| 3 | Lifecycle, quantity, reconciliation, release, concurrency, idempotency, audit, and outbox invariants | Normalized schema, cross-cutting design, decisions, pass report — completed |
| 4 | API/authorization/on-prem consistency review and implementation handover | Endpoint catalog, cross-cutting design, plan/chain, completion handover — completed |

Passes execute sequentially without pausing between reports unless a genuine blocker requires a
user decision. An unresolved design item is documented with `NEEDS_CONFIRMATION`, `CONFLICTING`,
or `STALE`; it is not silently selected as an implementation invariant.

## Allowed file scope

Only Markdown design surfaces under `docs/`, `AGENTS.md`, and the dated plan/chain/pass/handover
records created for this revision may change. Application source, Prisma schemas, migrations,
generated artifacts, seeds, deployment files, and frontend files are explicitly out of scope.

## Global close-out checks

- `git diff --check` passes.
- Only documentation files changed by this revision; pre-existing user changes are preserved.
- No stale claim reintroduces Workspace tenancy, a hybrid PMRS ledger, or simultaneous canonical
  Kuririn/Asia values.
- New references resolve to existing files or to files created by this revision.
- Gate 0 blockers remain visible and implementation remains blocked.

## Completion

All four passes completed sequentially. See
`docs/superpowers/prompts/2026-07-15-pats-api-schema-normalization-revision-completion-handover.md`
for the implementation boundary and recommended next step.
