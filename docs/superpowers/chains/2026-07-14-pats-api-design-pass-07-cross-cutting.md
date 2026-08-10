# Pass 7 Report: Cross-Cutting and On-Prem Operations

**Date:** 2026-07-14
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no deployment/configuration implementation approval

## Pass completed

Pass 7 — Cross-Cutting and On-Prem Operations.

## What changed

- Defined private MinIO asset creation, upload, checksum, quarantine, read-URL, retention, and
  ownership boundaries.
- Separated domain records, audit evidence, transactional outbox, idempotency, and rebuildable
  projections, including freshness and at-least-once delivery behavior.
- Defined dependency failure behavior for PostgreSQL, MinIO, identity, outbox, Redis, projections,
  and scanner/printer adapters; added structured logging and redaction requirements.
- Defined stateless rate-limit posture, health/readiness separation, backup/restore scope and
  sequence, forward-compatible migration/rollback rules, air-gapped artifact delivery, and
  promotion order without inventing RPO/RTO, retention, topology, or ownership values.
- Added the contract/domain/authorization/persistence/integration/operational/acceptance test
  layers and logged D-027/D-028 for asset backup and deployment ownership gaps.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| No production topology or recovery objective invented | PASS | Explicit D-017/D-023/D-027/D-028 gates and operational boundary |
| Private storage and non-root/runtime controls explicit | PASS | Asset and migration/delivery sections |
| Audit/outbox not conflated with domain events | PASS | Audit/outbox/projection section |
| External dependency failure/retry behavior defined | PASS | Failure-isolation table and outbox/job rules |
| Operational requirements testable in isolation | PASS | Dependency fault tests and operational test layer |
| No code/deployment files changed | PASS | Changed paths limited to design docs, decisions, report |
| `git diff --check` | PASS | Fresh command run after the edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION` D-014/D-027: asset owner, object retention, backup pairing, and cleanup.
- `NEEDS_CONFIRMATION` D-017/D-023/D-028: backup owner, retention, RPO/RTO, secret custody,
  topology, promotion owner, and restore rehearsal acceptance.
- `NEEDS_CONFIRMATION` D-006/D-025: identity dependency and actor identity policy.

These are operational approval gates, not reasons to invent values in the design.

## Ready for next pass

Yes. Pass 8 may perform the cross-document consistency review and produce the implementation
backlog/handover, retaining these open decisions visibly.
