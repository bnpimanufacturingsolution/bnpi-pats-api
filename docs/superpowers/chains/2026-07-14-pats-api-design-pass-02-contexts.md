# Pass 2 Report: Bounded Contexts and Architecture

**Date:** 2026-07-14
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no implementation approval

## Pass completed

Pass 2 — Bounded Contexts and Architecture.

## What changed

- Defined ownership, capabilities, ports, allowed dependencies, and forbidden imports for the
  nine bounded contexts.
- Added an acyclic dependency graph and explicit modular-monolith layer rules.
- Defined transaction coordination for stage events, inventory entries, audit, idempotency, and
  outbox records, while keeping projections rebuildable.
- Recorded Docker-first, PostgreSQL/private-MinIO, air-gapped runtime constraints without
  inventing production topology or recovery objectives.
- Added the unresolved planning aggregate noun as a visible `NEEDS_CONFIRMATION` architecture
  item and tightened the target-design completion gate.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| Every context has one ownership boundary | PASS | Architecture context ownership map |
| Dependency direction is acyclic | PASS | Architecture dependency graph and import rules |
| Write-side truth is distinct from projections | PASS | Transaction/consistency boundaries |
| Architecture remains a modular monolith | PASS | Recommendation and layer model |
| Open identity/role/tenancy decisions remain labelled | PASS | D-001, D-005, D-006, D-008, candidate D-024 |
| No code/schema/deployment files changed | PASS | Changed paths limited to architecture, spec, and report |
| `git diff --check` | PASS | Fresh command run after the edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION`: `Workspace` versus `Line` API noun.
- `NEEDS_CONFIRMATION`: `Project` versus `ProductionPlan` canonical planning aggregate noun.
- `NEEDS_CONFIRMATION`: catalog ownership/layering, identity provider, station granularity,
  correction/rework policy, and operational ownership decisions from Pass 1.

No blocker prevents Pass 3 conceptual data-model design; affected write contracts remain gated.

## Ready for next pass

Yes. Pass 3 may define the canonical relational model, provided it does not turn the open planning
noun, Lot cardinality, PMRS, asset ownership, or variance policy into silently accepted schema
behavior.
