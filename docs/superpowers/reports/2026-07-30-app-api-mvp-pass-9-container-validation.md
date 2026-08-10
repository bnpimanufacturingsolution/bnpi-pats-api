# App–API MVP Pass 9: Container and DEV Runtime Validation

Status: COMPLETE — DEV release candidate with production boundary  
Date: 2026-07-30  
Scope: Product Catalog App–API MVP only; DM/data migration remains frozen.

## Decision

The MVP is accepted as a DEV release candidate. The deployable API image builds and runs, the browser preflight path works, and the frontend adapter reaches the containerized API in explicit API mode.

No production deployment, client-data publication, destructive reset, or DM/cutover operation was performed.

## Environment

- Disposable Compose project: `bnpi-pats-pass9-20260730`
- API: `3302` → container port `3000`
- PostgreSQL: `55434` → container port `5432`
- MinIO: `9004/9005` → container ports `9000/9001`
- Runtime image: Node 20 Alpine, non-root `nodeuser`
- Synthetic accounts only; no client workbook, PDF, Drive artifact, or production database used

The existing API process on port 3000 and earlier isolated environments were left untouched.

## Findings and fixes

1. The first Docker build failed only because Docker Hub metadata resolution timed out. A retry completed the full multi-stage build successfully, including dependency installation, Prisma generation, OpenAPI export, webpack build, and final image export.
2. Browser preflight initially received `405` because CORS middleware was mounted after the canonical router. CORS now runs before canonical routes, with a regression test covering `OPTIONS /api/v1/auth/login`.
3. Compose did not pass `CORS_ORIGINS` or `CORS_CREDENTIALS` into the API container. Both are now explicit configurable service environment variables.
4. Catalog collection/detail responses now use `Cache-Control: no-store`, and the app canonical catalog adapter requests `cache: "no-store"` to prevent stale mutable catalog state.

## Validation

- Seven committed PATS migrations applied successfully to the disposable PostgreSQL target.
- Container health endpoint: passed.
- Container API smoke: 17 checks passed, covering auth, capabilities, denial, collection/detail reads, Product/Model/ModelPart writes, idempotency replay/conflict, validation, ETag update, stale update rejection, and graph reload.
- Browser preflight: `204` with the configured allow-origin, methods, and headers.
- Frontend live adapter smoke: 2 tests passed against the container, covering collection/detail hydration and create/update/reload behavior.
- API lint: passed.
- API type-check: passed.
- API test suite: 187 passing, including the preflight regression.
- App type-check: passed.
- App standard suite: 269 passed; one unrelated `line-stage` release-scan test timed out under the full-suite run. The focused live adapter smoke passed independently.

## Remaining boundary

This proves a disposable DEV container path, not deployment to production. Before promotion, CI must build and publish the image using the same Node 20 contract, inject environment-specific CORS/JWT/database/object-storage settings, and run migrations through the approved release procedure. BOM, process routes, planning, source publication, DM, and cutover remain outside this MVP chain.
