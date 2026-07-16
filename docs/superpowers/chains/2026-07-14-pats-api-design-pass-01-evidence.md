# Pass 1 Report: Evidence and Scope Lock

**Date:** 2026-07-14
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no implementation approval

## Pass completed

Pass 1 — Evidence and Scope Lock.

## What changed

- Extended the design context with repository, business, frontend-alignment, and on-prem
  evidence classifications.
- Locked the design-only file boundary and the source-precedence rules for later passes.
- Added evidence-led decisions D-019 through D-023 for legacy/PATS conflict, Withdrawal Forms,
  variance policy, prototype release state, and on-prem ownership gaps.
- Replaced this pass instruction shell with the executed report.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| Source precedence is explicit | PASS | Context source-precedence and evidence-classification sections |
| Legacy/seeded data is not canonical | PASS | Context legacy and frontend alignment boundary |
| Conflicts have labels and evidence | PASS | Decision register D-001, D-005 through D-010, D-014, D-017, D-019 through D-023 |
| No code/schema files changed | PASS | `git status` scope review after edit |
| Scope stayed within Pass 1 | PASS | Context, decision register, and this report only |
| REST standard remains untouched | PASS | No diff under `docs/standards/**` |
| No code tests required | PASS | Documentation-only pass; no tests weakened or removed |
| `git diff --check` | PASS | Fresh command run after the edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION`: canonical `Workspace` versus `Line` noun and the project-to-tenant
  relationship.
- `NEEDS_CONFIRMATION`: identity provider/subject mapping, catalog ownership, station
  granularity, Lot cardinality, PMRS, rework/correction policy, asset ownership, and backup/
  recovery ownership.
- `CONFLICTING`: draft `+/-5%` variance language versus the schema's per-Part threshold draft.
- `STALE`: frontend localStorage release state and seeded/demo identifiers.

These do not block read-only architecture and contract design, but they block approval of affected
write endpoints and implementation.

## Ready for next pass

Yes. Pass 2 may define bounded contexts and dependency direction while preserving the open
decision labels.
