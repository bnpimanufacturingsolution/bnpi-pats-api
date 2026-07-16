# Schema Normalization Chain - Pass 4: On-Prem Operations and Migration Safety

**Status:** COMPLETED - design-only

## Pass completed

Pass 4: on-prem operational persistence and migration safety.

## What changed

Extended `docs/data/2026-07-14-pats-api-normalized-schema-design.md` with:

- PostgreSQL, MinIO, legacy Mongo/PMS, projections, logs, and API ownership boundaries;
- command, projection, outbox, job, and asset transaction bundles with precise atomicity rules;
- retention/legal-hold placeholders and redaction boundaries without inventing policy values;
- readiness and failure behavior for PostgreSQL, migrations, MinIO, identity, outbox, projections,
  and backup/restore verification;
- coordinated PostgreSQL/MinIO recovery and reconciliation requirements;
- additive expand/contract migration stages, mixed-version compatibility, rollback boundaries,
  legacy isolation, and backfill prerequisites;
- air-gapped artifact and promotion gates without assuming topology, credentials, or operator
  ownership.

## Self-check result

- No Prisma, migration, generated, seed, deployment, application, or frontend file changed.
- No RPO, RTO, retention duration, topology, owner, secret, promotion schedule, or hardware value
  was invented.
- Source mutation, audit, idempotency result, and transactional outbox are atomic by default;
  asynchronous projection checkpoints advance only with their own projection writes, so a derived
  view cannot be mistaken for source truth.
- MinIO bytes and PostgreSQL asset metadata are explicitly coordinated but not falsely treated as
  one database transaction.
- Legacy Mongo/PMS data remains isolated evidence and requires an approved staged crosswalk before
  any future backfill.
- Expand/contract stages preserve mixed-version compatibility and prohibit assumed down-migrations
  after destructive schema changes.
- `git diff --check` passes (with existing line-ending warnings on previously edited documents).

## Open questions or blockers

- D-017/D-023/D-027/D-028 still require named ownership for backup, retention, recovery, assets,
  and on-prem promotion/topology.
- Migration implementation still requires the accepted identity type, tenant-safe FK strategy,
  catalog scope, lifecycle vocabulary, quantity representation, actor snapshot policy, and asset
  link strategy.
- Exact retention/legal-hold fields and governance workflow remain placeholders until accepted.
- No schema or migration may be generated from this pass until Gate 0 decisions and a reviewed
  implementation plan are approved.

## Ready for next pass

Yes - Pass 5 may perform the consistency review, reconcile all open labels against the decision
register and API contract, and produce the schema implementation handover without modifying runtime
or persistence source files.
