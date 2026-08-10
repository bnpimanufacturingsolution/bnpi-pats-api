# App–API MVP Pass 10: CI and Release Reproducibility

Status: COMPLETE LOCALLY — remote CI run pending push  
Date: 2026-07-30  
Scope: App–API MVP release gates only; DM/data migration remains frozen.

## Decision

Keep the current MVP scope stable and strengthen CI before starting BOM. A fresh CI runner must prove the same deployment-critical sequence already proven locally: dependency startup, committed migrations, API image startup, health, and browser preflight.

## Change

The API foundation workflow now:

1. Validates the Compose configuration.
2. Starts PostgreSQL, MinIO, and MinIO initialization.
3. Applies all committed PATS migrations with `prisma:pats:migrate:deploy`.
4. Builds and starts the API image.
5. Checks `/api/v1/health`.
6. Checks the `OPTIONS /api/v1/auth/login` browser preflight and configured allow-origin.
7. Cleans up the Compose stack even on failure.

This is a small release-safety improvement; it does not introduce production deployment, image publishing, secrets management, or migration cutover.

## Validation

- `docker compose --profile pats config --quiet`: passed locally.
- The exact dependency → migration → container → health → preflight sequence was exercised successfully during Pass 9 against a disposable DEV stack.
- API lint: passed.
- API type-check: passed.
- API suite: 187 passing.

## Boundary

The local `develop` branch is two commits ahead of `origin/develop`. A real GitHub Actions run cannot be observed until the commits are pushed. No remote push was performed in this pass because that is an external repository mutation requiring explicit authorization.

After the CI run is green, the next continuous chain is the BOM vertical slice: evidence-informed BOM contract, draft BOM definition/line API, frontend adapter integration, and isolated acceptance verification. DM/cutover remains frozen.
