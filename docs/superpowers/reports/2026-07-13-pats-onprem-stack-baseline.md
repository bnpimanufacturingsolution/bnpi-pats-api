# BNPI PATS On-Prem Stack Baseline

Date: 2026-07-13  
Pass: 1 — Baseline and Scope Lock  
Repository: `bnpi-pats-api`  
Branch: `develop`

## Result

The API checkout is clean and suitable for Pass 2. The sibling app checkout had no uncommitted files at capture time, but it is one local commit ahead of `origin/develop`; it remains outside this chain's write scope. The API is currently healthy on port `3000`. PostgreSQL is listening on port `5432`. MinIO is not running. Docker and Compose CLIs are installed, but the Docker Desktop Linux daemon is unavailable, so Pass 3 cannot run until the daemon is restored.

## Repository State

### API

```text
## develop...origin/develop
HEAD e70590d docs: add gated on-prem stack chain prompts
```

The API working tree is clean.

### App

```text
## develop...origin/develop [ahead 1]
HEAD 4c3ef7d workspace stub functions
```

The app working tree is clean at capture time. The app repository remains protected from this API infrastructure chain.

## Toolchain Evidence

```text
node v24.17.0
pnpm 10.25.0
docker 29.5.3
Docker Compose v5.1.4
```

The API declares Node `20.x` and pnpm `10.25.0`. The current shell is using Node `24.17.0`, which is an unsupported-engine warning for the API and must not be treated as the final build environment. Pass 2 should use Node 20 for its verification gate.

The API repository contains `package.json` and `pnpm-lock.yaml`; it does not contain `package-lock.json` or `yarn.lock`.

## Runtime and Port Evidence

### API

`http://localhost:3000/health` returned HTTP 200 with:

```json
{"status":"healthy","message":"SLA monitoring is active"}
```

Port `3000` is owned by an existing Node process. It was not stopped or modified.

### PostgreSQL

Port `5432` is listening and owned by a `postgres` process. It was not stopped or modified. This confirms a PostgreSQL process is available locally, but it does not prove that it is the disposable database intended for future PATS migrations.

### MinIO

Ports `9000` and `9001` are free. No MinIO process or container is running.

### Other observed ports

- App development ports `5173` and `5174` are occupied by existing listeners.
- API port `3001`, MinIO ports `9000`/`9001`, Redis port `6379`, and PostgreSQL alternate port `55432` were free at capture time.

## Current Build and Configuration Mismatches

1. `package.json` declares pnpm, but `Dockerfile` runs `npm ci` and copies `package*.json`. The repository has no package-lock file, so Docker dependency installation is not aligned with the checked-in lockfile.
2. `webpack.config.js` emits `dist/server.ts`; `package.json` runs `node ./dist/server.ts`; the target production artifact is `dist/server.js`.
3. `.env.example` and `config/env.ts` default the API to port `3000`, while `Dockerfile` exposes `3001`, its health check defaults to `3001`, and `nginx.conf` targets `app:3001`.
4. `docker-compose.yml` currently defines only `mongo`, `redis`, and `app`; it does not define PostgreSQL or MinIO.
5. The app's `VITE_BASE_URL_LOCAL` and `VITE_SSO_BASE_URL` use `http://localhost:3000/api`, while the legacy `VITE_HRIS_API_URL` remains `http://localhost:3001/api`. This legacy app setting is recorded but protected from Pass 2.
6. The API's default Prisma scripts and `postinstall` target the legacy Mongo schema. The standalone `prisma/pats/schema.prisma` has no runtime import, migration history, or `PATS_DATABASE_URL` entry in `.env.example`.
7. `docker compose config --services` currently lists `mongo`, `redis`, and `app`; Docker daemon operations cannot run because the Docker Desktop Linux engine pipe is unavailable.

## Pass 2 File Boundary

### Allowed to touch

- `package.json`
- `Dockerfile`
- `webpack.config.js`
- `.env.example`
- `nginx.conf`
- `tsconfig.json` only if the artifact change requires it
- `tests/build-contract.spec.ts`

### Protected

- all application source under `app/`
- all Prisma schemas under `prisma/`, including `prisma/pats/`
- all seed files
- `docker-compose.yml` and Compose services
- all frontend files and the sibling app repository
- auth, workspace membership, legacy route registration, and production deployment behavior
- running user processes and environment secrets

## Pass 1 Self-Check

- [x] API branch and working-tree state recorded.
- [x] App state recorded and protected from this chain.
- [x] Package manager, lockfile, port, artifact, Docker, and service evidence recorded.
- [x] No source, schema, seed, environment secret, or app file changed.
- [x] No scope creep beyond this report file.
- [x] `git diff --check` passed before report creation.

## Open Questions / Blockers

- Docker Desktop Linux daemon must be restored before Pass 3 can build or start containers.
- Pass 2 must use Node 20 rather than the current Node 24 shell.
- The PostgreSQL process on port 5432 must not be assumed to be the disposable PATS migration database.
- The legacy `VITE_HRIS_API_URL` setting needs a later app/configuration decision; it is outside Pass 2.

## Handoff

- **Pass completed:** 1
- **What changed:** Added this baseline report only.
- **Self-check result:** All Pass 1 checks passed.
- **Open questions / blockers:** Docker daemon unavailable; Node 20 runtime required for the next gate.
- **Ready for next pass:** Yes for Pass 2; Pass 3 remains blocked until Docker is available.

