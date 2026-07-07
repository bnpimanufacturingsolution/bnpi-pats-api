# Bandai PATS — On-Prem Deployment Skeleton

Status: PROPOSED (2026-07-07) — contract and stack **shape** for the on-prem appliance target
(Hyper-V VM, Docker stack as the default runtime, K8s/Argo CD opt-in). Not yet a runnable
production deployment: the API's live runtime is still the legacy MongoDB-backed domain, and the
`bnpi-pats-web` image does not exist yet. This directory exists so environment contract data has
one home from day one and later slices fill in the runtime, instead of inventing ports ad hoc.

See `bnpi-pats-app/docs/architecture/2026-07-07-pats-onprem-api-architecture-readiness.md` for
the full gap analysis and build list.

## Environment contract (from the appliance reference architecture)

| Environment | App | API `/health` | Postgres host port |
|---|---:|---:|---:|
| PROD | 3000 | 3001 | 15432 |
| DEV  | 3100 | 3101 | 15433 |
| UAT  | 3200 | 3201 | 15434 |

One isolated stack per environment (own database instance, own volumes) — DEV/UAT churn can
never touch PROD data, and the per-env DB host ports exist precisely for per-env admin/backup
access.

## Layout

- `contract/{dev,uat,prod}.env` — the environment contract values (ports, seed mode, CORS
  origin). These are the single source the Docker stack reads and the future GitOps ConfigMaps
  mirror; change ports here, nowhere else.
- `docker-compose.pats.yml` — the parameterized per-environment stack (web + api + postgres).

## Usage (per environment)

```powershell
docker compose -p pats-dev  -f deploy/docker-compose.pats.yml --env-file deploy/contract/dev.env  up -d
docker compose -p pats-uat  -f deploy/docker-compose.pats.yml --env-file deploy/contract/uat.env  up -d
docker compose -p pats-prod -f deploy/docker-compose.pats.yml --env-file deploy/contract/prod.env up -d
```

The `-p` project name keeps each environment's containers, network, and volumes isolated.

## Not decided / not built yet (tracked in the readiness doc)

- `bnpi-pats-web` image (static SPA + nginx) — build list item 5.
- API wiring to the PATS Postgres schema (`prisma/pats/schema.prisma` is a validated draft; the
  runtime still serves the legacy Mongo domain).
- Secrets handling (values in `contract/*.env` are placeholders — real `JWT_SECRET`/DB passwords
  come from the host secret bootstrap, never from this directory).
- Backup job, K8s runtime overlays, image tarball delivery — pending client readiness answers.
