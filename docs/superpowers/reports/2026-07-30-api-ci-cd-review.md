# API CI/CD Review and Repair

Date: 2026-07-30
Repository: `bnpi-pats-api`
Branch: `pats-current-work-checkpoint-20260729`
Pull request: https://github.com/hrisworkforcesystem-coder/bnpi-pats-api/pull/2

## Finding

The `PATS foundation` workflow failed before executing tests because `config/env.ts`
requires a `JWT_SECRET`, but `.github/workflows/foundation.yml` supplied only
`PATS_DATABASE_URL`. The failure was CI configuration drift, not an API test regression.

## Repair

- Added a deterministic, non-production CI-only `JWT_SECRET` at the job boundary.
- Set `NODE_ENV=test` for the test step so test execution is explicit and cannot inherit a
  production runtime mode.
- Added workflow-level `contents: read` permissions.

The workflow continues to run lint, TypeScript checking, PATS Prisma schema validation, the
full test suite, the production build, Compose configuration validation, and a real Compose
health smoke with cleanup in an `always()` step.

## Validation

GitHub Actions run `30504751783` passed end-to-end:

- lint: PASS
- type-check: PASS
- PATS Prisma validation: PASS
- tests: PASS - 186 passing
- build: PASS
- Compose config: PASS
- Compose health smoke: PASS
- Compose cleanup: PASS

Local reproduction with the CI variables also passed the 186-test suite, typecheck, build,
Prisma validation, lint, and Compose config checks.

## CI/CD judgment

The workflow is a sound foundation CI gate for this repository: it is pinned to Node 20 and
the checked-in pnpm lockfile, validates the API artifact, and starts the Compose profile to
verify process health. It is not a complete CD pipeline. It does not deploy an image, apply or
verify migrations against a disposable database, test database-backed readiness beyond the
process health endpoint, publish artifacts, or exercise rollback/backup behavior.

Those are release-readiness gaps, not reasons to weaken this PR check. Production deployment,
migration application, and rollback remain explicitly outside this repair.

## Remaining recommendations

No immediate CI repair remains. Before production delivery, add a separately approved DEV
deployment workflow with disposable database migration/rollback checks, artifact provenance,
secret injection, and a deployment health/readiness gate.
