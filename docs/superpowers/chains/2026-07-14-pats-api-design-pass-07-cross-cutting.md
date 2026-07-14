# Pass 7: Cross-Cutting and On-Prem Operations

## Depends On

Pass 6 endpoint catalog and authorization matrix.

## Objective

Complete the cross-cutting, storage, audit, observability, testing, backup, restore, and on-prem
delivery design needed to implement and operate the API safely.

## Scope

- Touch only: `docs/api/2026-07-14-pats-api-cross-cutting-design.md`,
  `docs/architecture/2026-07-14-pats-api-target-architecture.md`, the decision register, and the
  Pass 7 report.
- Do not touch: Docker configuration, CI, source code, Prisma schemas, migrations, or app files.

## Instructions

1. Define private MinIO asset lifecycle, upload/download boundaries, checksums, and retention
   decisions.
2. Define audit, outbox, projection freshness, trace propagation, structured logging, and
   dependency failure behavior.
3. Define health/readiness, migration/rollback compatibility, PostgreSQL backup/restore, MinIO
   backup/restore, offline delivery, and upgrade order without inventing client-owned RPO/RTO.
4. Define contract, domain, persistence, integration, and operational test layers.

## Deliverable

A cross-cutting and on-prem operational design with explicit ownership and open decisions.

## Self-Check Gate

- [ ] No production topology or recovery objective is invented.
- [ ] Private storage and non-root runtime requirements are explicit.
- [ ] Audit and outbox behavior are not conflated with domain events.
- [ ] Failure/retry behavior is defined for external dependencies.
- [ ] No code or deployment files changed.

## Stop Conditions

Agent stops if:

- backup/restore ownership or retention is assumed without evidence;
- asset ownership requires changing the domain model without a decision;
- an operational requirement cannot be tested safely in an isolated environment.
