# BNPI PATS On-Prem Stack and Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Run the chain passes in order and stop at each acceptance gate before continuing.

**Goal:** Establish a reproducible on-premises PATS foundation using Node/Express, PostgreSQL/Prisma, MinIO, and Docker before adding PATS business endpoints or switching the frontend away from demo transport.

**Architecture:** The frontend remains a static React Router SPA. The API runs as a separate Node/Express container. PostgreSQL is the canonical PATS transactional store; Prisma owns the schema, migrations, and typed access; MinIO stores binary assets while PostgreSQL stores asset metadata. The inherited Mongo/PMS runtime remains an explicitly isolated compatibility surface until replacement is proven.

**Tech Stack:** Node.js 20, TypeScript, Express 5, Zod, Prisma 6, PostgreSQL 16, MinIO using its S3-compatible API, Docker/Compose, pnpm, Mocha/Chai/Supertest, ESLint, OpenAPI/Swagger, React Router/Vite frontend, Firebase static hosting.

## Global Constraints

- Work directly on the existing `develop` branch; do not create worktrees.
- Do not reset, checkout-overwrite, delete, or stage the app repository's existing uncommitted UI/WWG changes.
- Do not delete or migrate the legacy Mongo/PMS schema during this foundation pass.
- Do not add PATS CRUD, planning, scanning, reporting, authentication, or authorization behavior until the stack gates pass.
- Do not treat initials, fixtures, legacy seed records, or presentational image paths as canonical product data.
- PostgreSQL and MinIO must use persistent named volumes in local Compose.
- Production containers must run as non-root users and expose health checks.
- Do not use `latest` image tags for infrastructure dependencies; record immutable image versions or digests.
- MinIO buckets must be private by default; application access goes through the API.
- No production deployment, database reset, destructive migration, or public bucket exposure is part of this plan.

## Current Evidence and Decisions

- The API declares `pnpm@10.25.0` and has `pnpm-lock.yaml`, while its Dockerfile currently invokes `npm ci` and copies `package*.json`.
- The API build currently emits `dist/server.ts`, while the HRIS reference emits and starts `dist/server.js`.
- API port settings are inconsistent across `.env`, Compose, Docker, and nginx. The target internal API port is `3000` to match the current frontend local API base URL.
- The current API runtime is MongoDB/Prisma compatibility code. `prisma/pats/schema.prisma` is a standalone PostgreSQL draft and is not yet runtime-wired.
- The PATS repositories have no current MinIO implementation. MinIO is a target infrastructure decision, not a claim about the current runtime.
- The HRIS reference demonstrates useful patterns: multi-stage Docker builds, non-root containers, health checks, service readiness, and a switchable object-storage provider. Its payroll, device, migration, and broad observability dependencies are not imported into PATS.

## File Map

- Modify: `package.json` for consistent package-manager, build, start, Prisma, and verification scripts.
- Modify: `Dockerfile` for pnpm-based multi-stage builds, `dist/server.js`, non-root execution, and health checks.
- Modify: `docker-compose.yml` for the API, PostgreSQL, MinIO, persistent volumes, and service health conditions.
- Modify: `.env.example` for local/on-prem configuration boundaries and safe defaults.
- Modify: `nginx.conf` only if the proxy remains in the selected local deployment path; its upstream must match port `3000`.
- Modify: `webpack.config.js` so the server artifact is emitted as `server.js`.
- Modify: `tsconfig.json` only when required to make the build artifact and Prisma clients consistent.
- Create: `app/storage/object-storage.ts` for the provider-neutral object-storage interface.
- Create: `app/storage/minio-object-storage.ts` for the MinIO implementation and configuration validation.
- Create: `tests/object-storage.contract.spec.ts` for storage behavior using a test double or local service boundary.
- Modify: `prisma/pats/schema.prisma` only after the schema gate approves the persistence shape.
- Create: `prisma/pats/migrations/` only after the schema has been reviewed and validated.
- Create or modify: `scripts/pats-prisma.*` only for explicit PATS validation, generation, and migration commands.
- Modify: `README.md` to document local Compose startup, health checks, volumes, and the compatibility boundary.
- Create: `docs/superpowers/reports/2026-07-13-pats-onprem-stack-build-report.md` for final evidence and remaining risks.

## Chain Protocol

Every pass follows the same sequence:

1. Read the previous pass's output and the relevant project-truth/governance files.
2. State the pass scope and files before editing.
3. Write or update the smallest meaningful test/check first when behavior is changing.
4. Run the red check and confirm it fails for the intended reason.
5. Implement the smallest change that satisfies the pass.
6. Run the pass gate and record exact output.
7. Inspect `git diff --check` and the changed-file list.
8. Commit only the pass's files with a focused message.
9. Continue with the recommended next prompt only when the gate passes.

If a gate fails because of an unrelated dirty app change, a held process, unavailable Docker, missing database, or an unclear product decision, stop and record the blocker instead of widening scope.

## Pass 0: Baseline and Scope Lock

**Objective:** Establish a clean evidence baseline before touching the API build or infrastructure files.

**Prompt:**

```text
You are the senior infrastructure engineer for BNPI PATS. Run Pass 0 of the On-Prem Stack and Build Plan.

Read first:
- bnpi-pats-api/README.md
- bnpi-pats-api/package.json
- bnpi-pats-api/Dockerfile
- bnpi-pats-api/docker-compose.yml
- bnpi-pats-api/.env.example
- bnpi-pats-api/prisma/pats/schema.prisma
- the app repository's AGENTS.md and required WWG files when inspecting frontend impact

Inspect without editing:
- current branch and working-tree state in both repositories
- package manager and lockfile alignment
- Node, pnpm, Docker, and Docker Compose versions
- API listener port and frontend local API base URL
- current Docker build and production artifact assumptions
- whether PostgreSQL and MinIO are already running locally

Deliver:
1. A concise baseline report at docs/superpowers/reports/2026-07-13-pats-onprem-stack-baseline.md.
2. A changed-file boundary listing files allowed in Pass 1.
3. Exact commands for the Pass 0 gate.

Do not edit application code, Prisma models, seeds, auth, or the app repository.
Do not start or stop unrelated user processes.
Next prompt: Pass 1 — normalize the API build and production artifact.
```

**Gate:** Both repositories' branch/diff state is recorded; the API working tree is clean; no app UI file is staged; the current port and artifact mismatch are evidenced.

## Pass 1: API Build Normalization

**Objective:** Make the API install, build, and production start path deterministic with pnpm and a JavaScript server artifact.

**Prompt:**

```text
Run Pass 1 of the BNPI PATS On-Prem Stack and Build Plan.

Use the Pass 0 baseline. Modify only the API build files named in the plan.

Required decisions:
- Use Corepack and pnpm with the repository's pnpm-lock.yaml in Docker.
- Keep Node.js 20 as the runtime floor.
- Emit dist/server.js and start it with node dist/server.js.
- Standardize the API's internal/listener port at 3000.
- Keep legacy Mongo Prisma generation explicit and separate from future PATS Prisma generation.
- Keep ENABLE_LEGACY_API=false as the default.

Before implementation, add a focused build-contract test or script check that fails against the current server.ts output, npm-ci Docker install, or inconsistent start command.
Run the red check and record the expected failure.

Then make the smallest changes to package.json, Dockerfile, webpack.config.js, .env.example, nginx.conf, or tsconfig.json needed to satisfy the decisions.

Verify with:
- pnpm install --frozen-lockfile
- pnpm run type-check
- pnpm run lint
- pnpm test
- pnpm run build
- node dist/server.js --help or an equivalent non-destructive artifact/load check
- git diff --check

Do not add PostgreSQL runtime wiring, MinIO code, new API routes, migrations, or seed changes in this pass.
Commit only the build-normalization files.
Next prompt: Pass 2 — add the Compose on-prem infrastructure profile.
```

**Gate:** Frozen pnpm install, typecheck, lint, tests, build, and production artifact load all pass; `dist/server.js` exists; no new domain route or database migration appears in the diff.

## Pass 2: Docker Compose Infrastructure

**Objective:** Make a local on-prem stack reproducibly start API, PostgreSQL, and MinIO with persistent storage and readiness checks.

**Prompt:**

```text
Run Pass 2 of the BNPI PATS On-Prem Stack and Build Plan.

Use the passing Pass 1 commit. Modify only Docker, Compose, environment-example, and infrastructure documentation files.

Build a local stack with:
- api on internal port 3000
- PostgreSQL 16 with a named persistent volume and a pg_isready health check
- MinIO with a named persistent volume, private bucket initialization, API and console ports, and a health check
- Redis behind an opt-in Compose profile; it must not be required for the base stack

Requirements:
- Pin infrastructure image versions or immutable digests; never use latest.
- Do not publish PostgreSQL or MinIO admin credentials as application defaults in production documentation.
- Make the API depend on database and object-storage readiness, not merely container start.
- Keep the legacy Mongo compatibility service out of the default PATS base profile unless a separate compatibility profile is explicitly documented.
- Add a bucket-init service that creates the PATS asset bucket without making it anonymous.

Before editing, add a Compose contract check or script assertion for required services, volumes, health checks, port 3000, and the private bucket policy. Run it red against the current Compose file.

Implement the smallest Compose changes. Then verify:
- docker compose config
- docker compose build api
- docker compose up -d postgres minio
- PostgreSQL health is healthy
- MinIO health is healthy
- the bucket-init service completes successfully
- docker compose down leaves named volumes intact

Do not create PATS tables or API endpoints in this pass.
Commit only the Compose/infrastructure files.
Next prompt: Pass 3 — define and test the object-storage boundary.
```

**Gate:** `docker compose config` is valid; API image builds; PostgreSQL and MinIO report healthy; the private bucket exists; persistent volumes survive teardown; Redis is not required for base startup.

## Pass 3: MinIO Object-Storage Boundary

**Objective:** Establish a testable storage interface without coupling business modules directly to MinIO or exposing buckets publicly.

**Prompt:**

```text
Run Pass 3 of the BNPI PATS On-Prem Stack and Build Plan.

Read the approved Compose configuration and the PATS on-prem architecture/readiness docs. Modify only storage boundary code, its tests, package dependencies, and focused documentation.

Define an ObjectStorage interface with these operations:
- putObject(input): returns object key and metadata
- getObject(key): returns a readable object or a typed not-found result
- deleteObject(key): idempotent delete with a typed result
- createReadUrl(key, expiry): returns a controlled read URL or API-mediated reference

The MinIO adapter must:
- read endpoint, port, TLS, access key, secret key, and bucket from validated configuration
- reject missing production credentials at startup or first use with an actionable error
- restrict object keys to approved prefixes such as catalog, instructions, labels, evidence, and reports
- preserve content type, byte size, and checksum metadata
- never mark the bucket anonymous

Write contract tests first and run them red. Use a fake storage implementation for unit tests and a separate local MinIO smoke test when the service is available.

Do not add upload routes, asset database models, frontend upload controls, or Cloudinary dependencies.

Verify:
- focused object-storage contract tests
- lint and typecheck
- local MinIO put/get/delete smoke test
- git diff --check

Commit the storage boundary and tests.
Next prompt: Pass 4 — formalize the PATS Prisma/PostgreSQL client and migration boundary.
```

**Gate:** Storage contract tests pass; missing configuration fails clearly; MinIO put/get/delete works through the adapter; no public bucket policy or direct business-module MinIO import exists.

## Pass 4: PATS Prisma/PostgreSQL Boundary

**Objective:** Turn the provisional PATS PostgreSQL schema into an independently generated and migration-managed client without changing the legacy Mongo runtime.

**Prompt:**

```text
Run Pass 4 of the BNPI PATS On-Prem Stack and Build Plan.

Use the approved PATS app types and the existing prisma/pats/schema.prisma draft as evidence, but do not infer missing business rules from seeded data or initials.

Before editing, produce a schema reconciliation table for:
- Product → Model → ModelPart
- Project → ProjectModelAllocation
- Project → PartsList → ordered RoutingStep → Part
- Lot → Batch → BatchPartLine
- Station and workflow catalog references
- future asset metadata ownership and object keys

Mark unresolved business decisions as NEEDS_CONFIRMATION. Do not silently collapse ProductSpecification into Product or Lot into Batch.

Write schema contract tests or validation checks first and run them red against the current draft where the app/API shapes disagree.

Then update only the PATS draft schema and explicit PATS scripts:
- prisma:pats:format
- prisma:pats:validate
- prisma:pats:generate
- prisma:pats:migrate:dev
- prisma:pats:migrate:deploy

Generate the PATS client to a separate output directory. Keep legacy Prisma generation and legacy seed commands unchanged. Do not run db push, reset, or a production migration.

Verify:
- PATS Prisma format
- PATS Prisma validate with an explicit local PATS_DATABASE_URL
- PATS client generation
- migration creation against an isolated disposable PostgreSQL database
- migration deploy against a clean disposable PostgreSQL database
- legacy API typecheck and tests

Commit only the PATS schema, migration boundary, scripts, and schema report.
Next prompt: Pass 5 — add the first read-only PATS platform contract.
```

**Gate:** PATS client generation and isolated migration deploy pass; the legacy Mongo runtime still typechecks and tests; no destructive database command ran; all unresolved domain choices are documented.

## Pass 5: First Read-Only PATS Contract

**Objective:** Add a narrow read-only contract only after the infrastructure and persistence gates pass.

**Prompt:**

```text
Run Pass 5 of the BNPI PATS On-Prem Stack and Build Plan.

Build one read-only vertical slice only:
- health/readiness for API, PostgreSQL, and MinIO
- workspace-scoped catalog read model for Product, Model, and ModelPart

Do not add planning writes, execution scans, reporting, auth redesign, or role-model changes.

Define the response contract so it supports:
- complete records
- nullable source metadata
- empty model-part and routing collections
- missing optional images
- explicit not-found and unavailable-storage states

Write Supertest contract tests first and run them red. Keep the endpoint behind the existing authentication and workspace boundary. Use the PATS Prisma client and object-storage interface; do not import legacy product controllers or demo seed records.

Verify focused API tests, typecheck, lint, build, active-surface tests, and a Compose smoke request.

Commit the read-only contract and tests only after all gates pass.
Next prompt: Pass 6 — integrate the frontend adapter and on-prem verification.
```

**Gate:** Read-only contract tests pass against isolated PostgreSQL data; optional image absence is handled; workspace scoping is enforced; no legacy product route is reused.

## Pass 6: Frontend Adapter and On-Prem Verification

**Objective:** Connect the existing prototype without making the UI depend on live API availability or seeded initials.

**Prompt:**

```text
Run Pass 6 of the BNPI PATS On-Prem Stack and Build Plan.

Inspect the app repository's existing dirty UI changes before editing. Do not stage or rewrite them. Add only the smallest PATS API adapter and tests required to consume the read-only catalog contract.

The adapter must:
- map API records into the existing Product/Model/ModelPart view model
- preserve null and empty states
- use local/demo transport as an explicit fallback
- avoid deriving identity from initials, display names, or image filenames
- avoid changing the dense-screen UI copy or hierarchy unless required by a failing contract

Write adapter tests first and run them red. Then implement and verify:
- focused adapter tests
- Planning/Product route tests
- typecheck
- lint
- full app test suite
- Playwright smoke test with API unavailable and API available
- Docker Compose startup and health checks

Do not commit the pre-existing dirty app UI files in this pass. Commit only explicitly added adapter/test files after reviewing the path list.
Next prompt: Pass 7 — CI, backup/restore, and delivery report.
```

**Gate:** The UI works in demo mode without the API, consumes complete and sparse API records when available, and passes focused/full verification without staging unrelated work.

## Pass 7: CI, Backup/Restore, and Delivery Report

**Objective:** Make the stack reproducible for an on-prem operator and document the remaining production-readiness boundaries.

**Prompt:**

```text
Run Pass 7 of the BNPI PATS On-Prem Stack and Build Plan.

Add or update CI and operational documentation for:
- frozen pnpm install
- API lint, typecheck, tests, and build
- PATS Prisma validate/generate/migration deploy against an isolated database
- Compose configuration validation
- PostgreSQL and MinIO health checks
- MinIO bucket privacy check
- Docker image non-root check
- frontend typecheck, tests, build, and browser smoke

Document an on-prem operator runbook covering:
- required environment variables and secret injection
- first startup
- named volume locations
- PostgreSQL backup and restore
- MinIO object backup and restore
- offline image/package delivery
- upgrade order and rollback boundaries
- health endpoints and log locations

Run the full verification chain and create docs/superpowers/reports/2026-07-13-pats-onprem-stack-build-report.md with exact results, changed files, unresolved NEEDS_CONFIRMATION items, and whether any new recommendation was added.

Do not perform production deployment, destructive reset, public bucket exposure, or default-branch administration.
```

**Gate:** CI and the operator runbook cover the full stack; backup/restore procedures are tested in an isolated environment; the report distinguishes verified behavior from recommendations.

## Final Review Checklist

- [ ] The API uses one package manager and one lockfile path in local and Docker builds.
- [ ] `dist/server.js` is the sole production artifact and the start command matches it.
- [ ] API, Compose, proxy, and frontend local configuration agree on port `3000`.
- [ ] PostgreSQL is the only canonical PATS transactional store.
- [ ] Prisma PATS generation and migrations are separate from legacy Mongo compatibility generation.
- [ ] MinIO is private, persistent, health-checked, and accessed through an adapter.
- [ ] Redis is optional and not required for base PATS startup.
- [ ] No PATS production seed was inferred from presentational data.
- [ ] No existing app UI/WWG changes were overwritten or silently committed.
- [ ] Docker build, Compose startup, API tests, Prisma validation, storage tests, and frontend tests have fresh evidence.
- [ ] Remaining authentication, role, workflow, and production deployment decisions are explicitly labeled.
