# Pass 3 Report: Canonical Data Model

**Date:** 2026-07-14
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no Prisma or migration approval

## Pass completed

Pass 3 — Canonical Data Model.

## What changed

- Replaced the provisional data-model note with a context-owned conceptual relational model.
- Defined identity, tenant scope, lifecycle/deletion boundary, relationships, constraints,
  indexes, quantity/metadata boundaries, and correction/retention rules.
- Added the decision-neutral `LotPartAllocation` boundary so Lot cardinality is not silently
  collapsed to the current draft's required `partId`.
- Kept PMRS as a reference boundary, separated catalog definitions from planning snapshots, and
  made stage/inventory ledgers, audit, outbox, assets, jobs, and projections first-class concepts.
- Added D-024 for the Project/ProductionPlan noun conflict and D-025 for stable actor identity.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| No initials, display names, or filenames as identity | PASS | Relational design rules and entity tables |
| Every relationship has one clear owner | PASS | Context model and relationship map |
| Mutable state separated from append-only evidence | PASS | Execution, inventory, exception, audit, and correction sections |
| Flexible JSON has bounded purpose | PASS | Metadata and sensitive-data boundary |
| Blocking unresolved decisions are in the register | PASS | D-001, D-005–D-010, D-014, D-017, D-020, D-021, D-024, D-025 |
| Existing Prisma draft not edited | PASS | No changes under `prisma/**` |
| `git diff --check` | PASS | Fresh command run after the edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION`: Lot cardinality and whether Lots may be created outside planning.
- `NEEDS_CONFIRMATION`: Project versus ProductionPlan canonical noun.
- `NEEDS_CONFIRMATION`: PMRS structure, actor subject mapping, quantity/unit/variance policy,
  catalog ownership, station granularity, asset ownership, and retention.

Pass 4 can define lifecycle rules over these decision-neutral boundaries. It must stop short of
approving transitions that depend on unresolved business policy.

## Ready for next pass

Yes. The model is sufficiently explicit for lifecycle/invariant analysis without changing schema
or implementation artifacts.
