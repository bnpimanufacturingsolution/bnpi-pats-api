# Bandai PATS Foundation Runbook

Status: FOUNDATION-READY FOR LOCAL MVP INTEGRATION; production operations remain explicitly labelled below.

This runbook covers the repeatable local/on-prem foundation checks for `bnpi-pats-api` and the
canonical integration boundary used by `bnpi-pats-app`. It does not open the MVP production
domain scope or silently resolve any `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE` item.

## Repository and branch

Both repositories use `develop` for this foundation chain:

- `bnpi-pats-api`: API, PostgreSQL/Prisma, MinIO, canonical HTTP and local RBAC.
- `bnpi-pats-app`: frontend auth/session projection and the canonical catalog adapter.

## Local foundation startup

From `bnpi-pats-api`:

```powershell
docker compose --profile pats config --quiet
docker compose --profile pats up -d --build
Invoke-WebRequest http://localhost:3000/api/v1/health
docker compose --profile pats ps
```

Apply the isolated PATS migration before using persistence-backed identity or catalog data:

```powershell
$env:PATS_DATABASE_URL = "postgresql://pats:pats@localhost:55432/pats"
pnpm exec prisma migrate deploy --schema prisma/pats/schema.prisma
```

Local accounts are created only through the explicit operator bootstrap command. There is no
automatic administrator or SSO/OIDC bootstrap:

```powershell
$env:PATS_BOOTSTRAP_USERNAME = "foundation-admin"
$env:PATS_BOOTSTRAP_PASSWORD = "use-a-local-secret-of-at-least-12-characters"
$env:PATS_BOOTSTRAP_ROLE_BUNDLES = "operations-admin,catalog-manager"
pnpm run prisma:pats:bootstrap-local-admin
```

For the real app integration, use a local environment override in `bnpi-pats-app`:

```text
VITE_DEMO_MODE=false
VITE_LOCAL_AUTH_MOCK=false
VITE_PATS_API_URL=http://localhost:3000/api/v1
```

The app calls local login, self, capabilities, and the deployment-scoped catalog route. It does
not send a workspace/tenant selector to the canonical API.

## Required validation

API:

```powershell
pnpm run lint
pnpm run type-check
pnpm run prisma:pats:validate
pnpm exec vitest run --pool=forks --maxWorkers=1
pnpm run build
docker compose --profile pats config --quiet
```

App (foundation integration files):

```powershell
pnpm exec eslint --no-fix app/components/guards/auth-guard.tsx app/configs/endpoints.ts app/configs/routes.ts app/hooks/use-auth.ts app/layouts/auth-layout.tsx app/routes/auth/login.tsx app/services/auth-service.ts app/services/pats-catalog-service.ts app/services/pats-catalog-service.test.ts app/stores/auth-store.ts app/types/user.ts
pnpm typecheck
pnpm test
pnpm build
```

The inherited app contains unrelated formatter drift outside this foundation slice; the workflow
keeps its check scoped to the files changed for canonical integration and does not rewrite those
unrelated files.

The repository workflows run these checks on `develop` pushes and pull requests. The API workflow
also performs a Compose build/health smoke check.

## Backup and restore verification

The current foundation provides the database and object-storage boundaries, but a production
backup schedule is not being implied by local Compose. An operator must provide a secure backup
directory and a disposable restore target.

Database backup:

```powershell
$env:PATS_DATABASE_URL = "postgresql://pats:pats@localhost:55432/pats"
pg_dump --format=custom --file .\backup\pats-$(Get-Date -Format yyyyMMdd-HHmmss).dump $env:PATS_DATABASE_URL
pg_restore --list .\backup\pats-latest.dump
```

Object-storage backup, using an installed MinIO Client (`mc`):

```powershell
mc alias set pats http://localhost:9000 pats-minio change-me-minio
mc mirror --overwrite pats/pats-private .\backup\pats-private
```

Restore verification must target a disposable PostgreSQL database and disposable object-storage
bucket. Do not run `pg_restore --clean` against the active PATS database. Verify the result with
`prisma migrate deploy`, a health request, and a read-only catalog request using a test account.

Operational ownership, retention, RPO, RTO, encryption-at-rest, and off-host copy policy remain
`NEEDS_CONFIRMATION`; those are production-readiness follow-ups, not reasons to reopen the frozen
API design or start the domain MVP prematurely.

## Foundation boundary

Green evidence means the app and API can be run together locally with canonical local auth/RBAC,
PostgreSQL migrations, MinIO readiness, and a capability-gated catalog read. The next MVP work may
begin only as an explicitly opened domain slice after this foundation handover is reviewed; this
runbook does not authorize the planning, execution, inventory, or release domain writes.
