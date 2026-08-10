# Pass 4 Report: Lifecycles and Invariants

**Date:** 2026-07-14
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no implementation approval

## Pass completed

Pass 4 — Lifecycles and Invariants.

## What changed

- Added explicit state machines for planning aggregates, Lots, Batches, StageEvents, inventory
  transactions, exceptions, assets, jobs, outbox messages, and audit records.
- Classified invariants by database constraint, domain validation, transaction rule, and
  rebuildable projection.
- Defined retry/idempotency, optimistic concurrency, duplicate-scan, correction, and
  append-ledger behavior.
- Added cross-cutting atomic-command and state-machine test gates.
- Kept rework/reversal, Lot cardinality, quantity/variance, asset retention, actor identity, and
  operational retention decisions explicitly open.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| No transition relies only on a UI label | PASS | Lifecycle sections cite domain records and command rules |
| Evidence cannot be silently rewritten | PASS | Append-oriented and correction rules |
| Retry/conflict behavior is explicit | PASS | Idempotency/concurrency section and atomic command bundle |
| Correction behavior explicit or labelled open | PASS | Explicit linked-evidence rule; D-009 remains open for rework |
| Station/quantity/retention uncertainty labelled | PASS | Lifecycle questions and decision register references |
| No code/schema/route files changed | PASS | Changed paths limited to data, cross-cutting, decision/report docs |
| `git diff --check` | PASS | Fresh command run after the edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION` D-009: rework, reversal, rejection, and correction policy.
- `NEEDS_CONFIRMATION` D-010: Lot cardinality and lifecycle trigger.
- `NEEDS_CONFIRMATION` D-021: quantity units, tolerance, rounding, and variance authority.
- `NEEDS_CONFIRMATION` D-014/D-017: asset, audit, outbox, and backup retention ownership.
- `NEEDS_CONFIRMATION` D-025: actor identity mapping and snapshot policy.

These block affected write endpoints but not the common HTTP contract pass.

## Ready for next pass

Yes. Pass 5 may translate the lifecycle and invariant policy into standard-compliant HTTP contract
rules without approving unresolved domain writes.
