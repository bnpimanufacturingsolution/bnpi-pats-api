# App–API MVP Pass 8: API DEV Smoke Evidence

Status: COMPLETE WITH RELEASE BOUNDARIES / DM FROZEN
Date: 2026-07-30

## API result

The merged API source passed real HTTP verification against an isolated PostgreSQL/MinIO target.
The target used Compose-owned fresh volumes under project `bnpi-pats-mvp-20260730`; the pre-existing
API process on port 3000 and stale PATS containers/volumes were not touched.

Host bindings used for the smoke were API `3301`, PostgreSQL `55433`, and MinIO `9002/9003`.

## Persistence and migration

`pnpm run prisma:pats:migrate:deploy` applied all seven committed migrations successfully. A final
`pnpm exec prisma migrate status --schema prisma/pats/schema.prisma` reported the primary database
up to date.

The synthetic target ended with 8 Products, 8 Models, and 8 ModelParts. No client workbook, PDF,
Google Drive artifact, or canonical publication was used.

## API contract checks

The real HTTP harness passed health/authentication, deployment-scoped catalog reads, capability
denial, draft Product/Model/ModelPart creates, durable idempotency replay/conflict behavior,
validation, ETag/If-Match updates, stale update rejection, and graph reload.

The frontend adapter was run asynchronously against this live server with
`VITE_DEMO_MODE=false`, `VITE_LOCAL_AUTH_MOCK=false`, and the canonical API URL. Its collection,
detail, and draft update operations passed.

## Recovery

The synthetic database was backed up and restored into a separately named disposable PostgreSQL
container. The restored database contained all 7 completed migrations and the expected Product,
Model, and ModelPart records. `prisma migrate status` reported the restored schema up to date, and a
read-only API collection/detail request returned `200`.

Backup SHA-256:

`204712C6DB23BFB216664B28951FB49CAA755C708E2D86615F57B28160724EC3`

The restore container was removed. The temporary synthetic backup remains under the local temp
directory for inspection. It is not a production backup or a client-data artifact.

## Known limitations

The local API Docker image build could not resolve `node:20-alpine` because Docker Hub timed out.
The host-source runtime smoke passed, but container-image build and deployment capability remain
release checks. Local host execution also used Node 24 instead of the package-declared Node 20.

No production migration, publication, destructive reset, DM, or cutover operation was performed.
