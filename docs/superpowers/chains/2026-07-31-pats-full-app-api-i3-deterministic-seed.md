# PATS Full App-API Transition — I3 Deterministic Seed

Status: I3 COMPLETE / I4 READ API COVERAGE READY  
Date: 2026-07-31  
Depends on: I1 model convergence and I2 canonical migration

## Implemented

- Added `scripts/pats-seed.mjs` as the canonical PATS seed orchestrator.
- Added `pnpm prisma:pats:seed` without changing the legacy `prisma/seed.ts`.
- Added explicit `SEED_MODE=none|demo|uat` behavior.
- Added deterministic profile-scoped UUIDs derived from a stable SHA-256 seed key.
- Used upserts and stable business codes; the seed contains no delete or clear operation.
- Required an explicit `PATS_SEED_PASSWORD` for writable profiles.
- Seeded local subjects, credentials, role bundles, preferences, catalog, BOM, route/configuration,
  production plan, allocations, plan parts, route version, material requirement, lot composition,
  batches, stage events, inventory, routing violation, batch position projection, quality
  inspection/decision, audit, and outbox evidence.
- Marked synthetic/source-aligned values as `PROVISIONAL` or explicit seed evidence rather than
  treating them as approved client truth.

## Validation

On a disposable PostgreSQL database with the canonical migration applied:

- `SEED_MODE=demo` completed successfully.
- Re-running `SEED_MODE=demo` completed with the same deterministic identifiers.
- `SEED_MODE=uat` completed successfully in the same database with profile-scoped identifiers.
- `SEED_MODE=none` exited without writes.
- `node --check scripts/pats-seed.mjs` passed.
- Seed contract tests passed.
- API type-check, lint, and full suite passed: 196 tests.

No production database, client Drive source, migration/cutover operation, or legacy seed was
modified by this pass.

## Seed ownership boundary

The seed creates synthetic development/UAT data only. It does not ingest or approve the Drive
source files. Source evidence remains provisional until the controlled source-revision workflow
and business approval boundary are implemented.

## I4 entry condition

The API can now be validated against a complete persisted journey. The next pass exposes read
contracts for catalog/configuration, Production Plans, lots/batches, stage positions, inventory,
exceptions, quality, dashboard summaries, reports, and traceability before adding write commands.
