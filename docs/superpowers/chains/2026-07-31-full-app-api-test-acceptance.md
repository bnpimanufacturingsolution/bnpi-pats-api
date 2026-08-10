# Full App–API Test Acceptance (API companion) — 2026-07-31

Status: **OPEN** — acceptance evidence collected; full-transition gate not closed.

App report: `bnpi-pats-app/.wwg/reports/2026-07-31-full-app-api-test-acceptance.md`

## Disposable environment

- Postgres container: `pats-full-api-acc-pg` (`postgres:16.4-alpine`) port **55434**
- API process: host Node on port **3302**, `ENABLE_LEGACY_API=false`, `ENABLE_TEST_MODE=false`, `REDIS_ENABLED=false`
- Migrations: all 9 PATS migrations applied via `pnpm prisma:pats:migrate:deploy`
- Seed matrix:
  - `SEED_MODE=none` → no writes
  - `SEED_MODE=demo` → stable IDs, provisional evidence
  - `SEED_MODE=demo` rerun → same IDs (idempotent upserts)
  - `SEED_MODE=uat` → separate profile IDs

## Static verification

| Check | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm type-check` | PASS |
| `pnpm test` | **214 passing** |
| `pnpm export-docs` | PASS |
| Plan detail ETag regression | PASS (`tests/canonical-domain-read.spec.ts`) |

## API journey

Command:

```bash
PATS_API_BASE=http://127.0.0.1:3302/api/v1 \
PATS_SEED_PASSWORD=pats-demo-seed-2026 \
node scripts/acceptance-api-journey.mjs
```

Result: **35 PASS / 0 FAIL / 0 BLOCKED**

Includes multi-role login (planner/operator/quality), capability isolation, catalog/planning/execution/quality/report reads, draft plan create idempotency, stale `If-Match` 412, plan edit persist, stage-event and inventory idempotency, quality decision conflict on completed inspection, violation resolve, RFC 9457 problem details.

## Defect fixed

`GET /api/v1/production-plans/:planId` now returns strong concurrency ETag `"${rowVersion}"` so app If-Match tokens match command contract (`requireIfMatch`).

## Transition plan status update

I11 remains **OPEN**. Evidence now includes:

- disposable migrate/seed matrix PASS;
- full API journey PASS against seeded DB;
- browser smoke PASS after app transport CORS/fetch fixes (see app report).

Still not full-transition closeout: support-card projections, configuration authoring, planning-editor parity.

DM/cutover, client-data publication, production migration, and production deployment remain frozen.
