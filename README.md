# Bandai PATS API

Backend foundation for the Bandai Production and Assembly Tracking System.

## Current status

This repository is not yet a hardened manufacturing API or canonical PATS
domain model. It currently contains:

- shared platform foundations for health, security, documentation, and
  workspace tenancy;
- inherited MongoDB/Prisma PMS, procurement, finance, employee, and product
  modules retained as compatibility material;
- a provisional, standalone PostgreSQL draft at `prisma/pats/schema.prisma`.

The default Express composition does not mount quarantined legacy routes.
Set `ENABLE_LEGACY_API=true` only for a controlled compatibility run. Auth,
workspace membership, project membership, employee/HRIS, and legacy product
surfaces remain unchanged pending external or security review.

No seeded record, initial, fixture, or legacy field name is a PATS requirement.
The frontend prototype remains on local/demo transport while UX and the domain
model are being confirmed.

## Runtime boundary

`createApp({ enableLegacyRoutes: false })` is the testable default composition.
`index.ts` owns the HTTP listener, Socket.IO server, database connections,
cron startup, and graceful shutdown.

| Surface | Default behavior |
|---|---|
| `/`, `/health`, `/health/redis` | Shared health and infrastructure surface |
| `/api/docs/*`, development `/api/swagger` | Documentation tooling |
| `/api/workspace*` | Retained workspace tenancy |
| `/api/auth/*`, `/api/workspace-member*`, `/api/project-member*`, `/api/employee*`, `/api/product*` | Blocked-review surfaces; behavior preserved |
| Inherited PMS/procurement/finance routes | Quarantined; opt in with `ENABLE_LEGACY_API=true` |
| `prisma/pats/schema.prisma` | Provisional and unwired; not used by the runtime |

The full route/module evidence is recorded in
[`docs/superpowers/reports/2026-07-13-api-surface-inventory.md`](docs/superpowers/reports/2026-07-13-api-surface-inventory.md),
the frontend consumer audit, and the
[disposition matrix](docs/superpowers/reports/2026-07-13-api-disposition-matrix.md).

## Local setup

Requirements: Node.js 20.x, pnpm 10.x, and the existing MongoDB/Redis
dependencies when exercising integration behavior.

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and set a local `JWT_SECRET`. The development
defaults enable test mode and keep `ENABLE_LEGACY_API=false`; do not carry
those development settings into production.

## Verification commands

```bash
pnpm run lint
pnpm run type-check
pnpm test
pnpm run build

# Validate the provisional draft independently; this does not connect it
# to the runtime or create a migration.
PATS_DATABASE_URL=postgresql://pats:pats@localhost:5432/pats \
  npx prisma validate --schema prisma/pats/schema.prisma
```

The suite is primarily mocked controller coverage. The active-surface tests in
`tests/active-surface.spec.ts` exercise the real Express composition boundary.
The current baseline includes legacy warning noise from mocked activity/audit
logging, optional Redis, and incomplete estimation mocks; warnings are not
treated as proof that the inherited model is healthy.

## Documentation and generated artifacts

Swagger UI is available at `/api/swagger` in development. The generated API
catalog is built from the retained and blocked route sources, not from every
quarantined compatibility router:

```bash
pnpm run export-docs
```

Generated files are written under `docs/generated/`.

## Seeds and persistence

`prisma/seed.ts` is the legacy Mongo compatibility/demo seed orchestrator. It
seeds inherited module data for local presentation and compatibility testing;
it is not a canonical PATS seed. This cleanup does not rewrite, migrate, reset,
or promote those values.

The only PATS schema currently present is the standalone draft under
`prisma/pats/`. It has no runtime import, migration history, production seed,
or API registration.

## Technology

- TypeScript and Express 5
- Prisma 6 with the current MongoDB runtime
- Standalone PostgreSQL Prisma draft for future PATS design
- Zod validation, JWT/SSO boundary, Redis, Socket.IO, OpenAPI/Swagger
- Mocha, Chai, Supertest, ESLint, and webpack

## Scope boundary

This cleanup intentionally does not add PATS CRUD, planning, execution,
scanning, or reporting endpoints. It also does not replace authentication,
authorization, workspace tenancy, SSO/HRIS integrations, database migrations,
production deployment, or frontend API adoption.
