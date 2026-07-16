# Pass 6 Report: Endpoint Catalog and Authorization Matrix

**Date:** 2026-07-14
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no route/OpenAPI implementation approval

## Pass completed

Pass 6 — Endpoint Catalog and Authorization Matrix.

## What changed

- Replaced the route-family sketch with an operation-level canonical endpoint catalog covering
  identity/tenancy, catalog, planning, execution, inventory, exceptions, traceability, reports,
  audit, assets, jobs, and platform operations.
- Added common policy references for status codes, RFC 9457 errors, pagination, ETags,
  `If-Match`, idempotency, audit, outbox, and asynchronous jobs.
- Added a future OpenAPI component/schema registry and capability-based authorization matrix with
  object-level tenancy checks.
- Classified the proof route as `TRANSITIONAL`, inherited API surfaces as `LEGACY`, and canonical
  routes as target shapes rather than implemented behavior.
- Added D-026 to preserve the unresolved final role-to-capability mapping.
- Recorded endpoint-review checklist evidence and implementation gates for unresolved decisions.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| No verb path or excessive nesting | PASS | Catalog rules and operation paths |
| Query/body naming split followed | PASS | Catalog rules and every collection row |
| Protected resources have object-level authorization | PASS | Capability matrix and per-row scope checks |
| Writes define concurrency/retry behavior | PASS | Policy references and append/mutation rows |
| Every endpoint has response/error policy | PASS | Policy references, schema registry, and row-level status/gate data |
| No endpoint promoted from app/legacy evidence | PASS | Compatibility boundary and implementation gate |
| `/api/v1` applied to all canonical routes | PASS | Including health/readiness/version |
| No source/schema/generated/frontend files changed | PASS | Changed paths limited to catalog, decision, report |
| `git diff --check` | PASS | Fresh command run after the edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION` D-001/D-006/D-026: tenant noun, identity provider, roles, and capabilities.
- `NEEDS_CONFIRMATION` D-005/D-008: catalog ownership and station granularity.
- `NEEDS_CONFIRMATION` D-007/D-009/D-010/D-011: PMRS, correction/rework, Lot cardinality, and
  route-version publication rules.
- `CONFLICTING` D-020/D-021: Withdrawal Form ownership and quantity/variance semantics.
- `NEEDS_CONFIRMATION` D-014/D-017/D-023/D-025: asset, backup/retention, on-prem operations, and
  actor identity.

The catalog is complete as a proposed design inventory, but all implementation remains gated by
the final design-chain review and explicit user approval.

## Ready for next pass

Yes. Pass 7 may complete cross-cutting and on-prem operations design against this catalog.
