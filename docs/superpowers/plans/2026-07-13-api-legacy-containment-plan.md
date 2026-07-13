# Bandai PATS API Legacy Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task with review checkpoints. Read-only inventory work may be parallelized; shared-file mutations remain sequential.

**Goal:** Reduce `bnpi-pats-api` to a verified platform boundary plus an explicitly isolated legacy remainder, without introducing new PATS behavior or treating seeded data as canonical.

**Architecture:** Use evidence-first containment. First map API modules, Prisma models, seeders, generated documentation, and frontend consumers. Then separate active platform routes from legacy compatibility routes through a testable application-composition seam. Retire only modules whose evidence-backed disposition is `RETIRE`; preserve `QUARANTINE` material without exposing it as the current PATS API. Keep `prisma/pats/schema.prisma` standalone and unwired.

**Tech Stack:** Node.js 20 target, TypeScript, Express 5, Prisma 6 with the current Mongo runtime, standalone PostgreSQL Prisma draft for PATS, Zod, Mocha/Chai/Supertest, ESLint, generated OpenAPI/Swagger artifacts, pnpm.

## Global Constraints

- No new PATS CRUD, planning, execution, scanning, or reporting endpoints.
- No database migration, reset, destructive seed operation, or production deployment change.
- No authentication, workspace tenancy, or security middleware replacement during this cleanup.
- Presentational seed data is legacy/demo material and is not evidence for a canonical PATS domain model.
- `prisma/pats/schema.prisma` remains isolated, provisional, and unwired.
- The frontend remains on local/demo transport; do not switch it to the API.
- Retire a route only after repository, frontend, test, seed, schema, documentation, and integration evidence has been checked.
- Use `pnpm` commands from `bnpi-pats-api`; do not upgrade Node, Prisma, or unrelated dependencies.
- Preserve the frontend worktree's existing changes in `bnpi-pats-app`.
- Every implementation pass ends with scoped verification and an intentional commit.

---

## Pass-count analysis and chain

The cleanup is eight passes including the already-completed baseline. Seven passes remain. Two discovery passes are independent and can run concurrently; all mutation passes must wait for their joined disposition matrix.

```text
P0 Baseline (complete)
        |
        +--> P1 API inventory ------------------+
        |                                       |
        +--> P2 Frontend consumer audit --------+--> P3 disposition matrix
                                                       |
                                                       v
                                              P4 composition seam
                                                       |
                                                       v
                                              P5 evidence-backed retirement
                                                       |
                                                       v
                                              P6 docs and seed boundary
                                                       |
                                                       v
                                              P7 verification and truth sync
```

Passes stop rather than guess when an external consumer, auth/workspace dependency, schema coupling, or supported workflow is discovered. A conflict creates a new decision checkpoint; it does not become a silent deletion.

## Prompt pack

These prompts are the chain instructions. Each prompt is deliberately scoped so a worker can inspect the relevant evidence without inventing product behavior.

### P1 prompt — API inventory worker

```text
You are the API inventory worker for Bandai PATS.

Objective: build an evidence-only inventory of bnpi-pats-api. Do not edit source,
schema, seed, generated documentation, or configuration files.

Inspect index.ts, config/, middleware/, app/*, prisma/schema/, prisma/seed.ts,
prisma/seeds/, docs/openApiSpecs.ts, docs/generated/, package.json, and tests/.
For every route module, record: route prefix, registration site, controller,
repository, Prisma models, seeders, tests, generated docs, external integrations,
and imports from other modules. Mark whether it is platform, legacy, or unclear.

Run rg-based discovery plus pnpm run type-check, pnpm test, pnpm run lint, pnpm
run build, and `$env:PATS_DATABASE_URL='postgresql://pats:pats@localhost:5432/pats';
npx prisma validate --schema prisma/pats/schema.prisma`. Record pass/fail and
warnings separately.

Write the result to docs/superpowers/reports/2026-07-13-api-surface-inventory.md.
Do not recommend new PATS endpoints. Do not infer domain truth from seed values.
Stop if a route's classification requires stakeholder confirmation.
```

### P2 prompt — frontend consumer audit worker

```text
You are the cross-repository consumer-audit worker for Bandai PATS.

Objective: determine which bnpi-pats-api routes have real consumers in
bnpi-pats-app. Do not edit either repository.

Inspect bnpi-pats-app/app/routes.ts, active route modules, app/services/,
app/hooks/, app/lib/api-client.ts, app/configs/endpoints.ts, README.md, and
.wwg/wiki/project-truth.md. Use rg and the existing knip configuration where
available. Distinguish: active route/service consumer, demo-only consumer,
test-only consumer, dormant source file, and no consumer.

Pay special attention to /auth, /workspace, /workspace-member, /project-member,
/product, /demand-plan, and all inherited PMS endpoints. A demo handler in
app/lib/demo-api.ts is not evidence that the sibling API route is an active
production consumer.

Write the result to
docs/superpowers/reports/2026-07-13-api-consumer-audit.md in bnpi-pats-api,
using repository-relative paths for both repositories. Do not delete or rename
anything. Stop if an external consumer cannot be ruled out from repository
evidence.
```

### P3 prompt — disposition worker

```text
You are the API disposition worker.

Objective: join the API inventory and frontend consumer audit into one explicit
disposition matrix. Do not edit runtime source, Prisma schema, seeders, or
generated docs.

For every route module and its coupled schema/seed/doc files, choose exactly one
disposition: RETAIN_PLATFORM, QUARANTINE_LEGACY, RETIRE_ACTIVE_ROUTE, or
BLOCKED_REVIEW. Include evidence paths, direct consumers, coupling, rollback
impact, and the verification command that will prove the later change.

Retain only shared platform foundations whose consumers and security behavior are
understood. Quarantine preserves compatibility material but does not present it
as the current manufacturing API. Retire is allowed only for evidence-backed
dead surface. Blocked review is mandatory for auth, tenancy, external SSO/HRIS,
unknown integrations, or contradictory evidence.

Write docs/superpowers/reports/2026-07-13-api-disposition-matrix.md. The matrix
is the only authority for P4-P6 changes. Do not use seeded records as model
requirements.
```

### P4 prompt — composition-seam worker

```text
You are the API composition-seam worker.

Objective: make active platform routes and legacy compatibility routes explicit
and testable without introducing PATS behavior.

Modify only the files named in the approved disposition matrix. Extract the
Express application construction from index.ts into app/create-app.ts so tests
can instantiate the app without starting a listener. Keep index.ts responsible
for process handlers, database connection, cron startup, graceful shutdown,
and server.listen.

Add a typed legacy registration boundary at app/legacy/register-legacy-routes.ts
only if the matrix contains QUARANTINE_LEGACY modules. It must expose:

  export interface AppOptions { enableLegacyRoutes?: boolean }
  export function createApp(options?: AppOptions): express.Application

The default must expose only retained platform routes. Legacy routes may be
enabled explicitly for compatibility tests or a controlled local run. Do not
mount the provisional PATS Prisma client. Add ENABLE_LEGACY_API to config/env.ts
and .env.example only if the matrix confirms a compatibility switch is needed;
production must reject ENABLE_TEST_MODE=true as it does today.

Add tests using supertest for /health, retained platform routes, and at least
one 404 assertion for each RETIRE_ACTIVE_ROUTE group. Preserve existing auth,
workspace, security, and error-handler ordering.
```

### P5 prompt — retirement worker

```text
You are the evidence-backed retirement worker.

Objective: remove only the modules marked RETIRE_ACTIVE_ROUTE in the approved
disposition matrix, in dependency order.

For each retirement group, first remove its route registration and verify the
route returns 404 through createApp(). Then remove unreachable controllers,
repositories, validators, service helpers, schema fragments, seed imports, and
generated documentation only when rg proves no retained module imports them.
Never remove a shared middleware, workspace/auth dependency, or QUARANTINE_LEGACY
source directory. Never hand-edit generated Prisma client output.

After each group, run the focused route-retirement test, pnpm run type-check,
and the affected controller tests. Commit each coherent group with a message
that names the retired surface and its evidence report.

Stop immediately on a non-zero consumer search, a failing retained-platform
test, or a schema dependency that crosses into a retained module.
```

### P6 prompt — documentation and seed-boundary worker

```text
You are the API documentation and seed-boundary worker.

Objective: make the repository tell the truth about the post-retirement API
without changing domain behavior.

Update README.md, docs/openApiSpecs.ts, generated docs through the existing
export command, and the seed documentation/orchestration only as required by
the disposition matrix. Keep legacy/demo seed data available unless its schema
was explicitly retired; label it as compatibility/demo material. Do not create
a PATS production seed and do not promote sample values into requirements.

Regenerate docs with pnpm run export-docs. Verify no RETIRE_ACTIVE_ROUTE appears
in docs/generated/swagger.json, swagger.yaml, endpoints.json, or the Postman
collection. Keep retained health, auth/workspace, and documentation endpoints
accurate.
```

### P7 prompt — verification and truth-sync worker

```text
You are the final verification and truth-sync worker.

Objective: prove the cleanup boundary and report remaining risk. Do not add new
PATS behavior.

Run pnpm run lint, pnpm run type-check, pnpm test, pnpm run build, the focused
active-surface tests, legacy Prisma validation, and standalone PATS schema
validation with an explicit PATS_DATABASE_URL. Run route/doc scans and inspect
git diff for accidental seed, auth, tenancy, migration, or production changes.

Update bnpi-pats-api README/local architecture notes and the app repository's
WWG truth/workspace surfaces only with observed cleanup facts. Label inferred,
conflicting, stale, and needs-confirmation items correctly. Do not claim the
PATS domain model is hardened or production-ready.

Produce a concise handoff containing changed files, validation results, known
legacy warnings, unresolved risks, and whether new recommendations were added.
```

---

## Task 1: Record the API inventory (Pass P1)

**Files:**
- Create: `docs/superpowers/reports/2026-07-13-api-surface-inventory.md`
- Inspect: `index.ts`, `config/`, `middleware/`, `app/`, `prisma/schema/`, `prisma/seed.ts`, `prisma/seeds/`, `docs/openApiSpecs.ts`, `docs/generated/`, `package.json`, `tests/`

**Interfaces:**
- Consumes: current repository source and generated artifacts.
- Produces: a route/module/schema/seed/documentation dependency table consumed by Task 3.

- [ ] **Step 1: Enumerate route registrations and module roots.**

Run:

```powershell
rg -n "require\(\"\./app/|app\.use\(|app\.get\(|app\.post\(|app\.patch\(|app\.delete\(" index.ts app
```

Expected: every mounted route group and direct health/documentation route is listed with its registration site.

- [ ] **Step 2: Map Prisma and seed coupling.**

Run:

```powershell
rg -n "prisma\.[A-Za-z0-9_]+|from \"\.\./seeds/|from \"\.\./generated/prisma|from \"\.\./\.\./generated/prisma" app prisma tests
```

Expected: each route group can be traced to schema models, seeders, and tests.

- [ ] **Step 3: Record baseline commands and warning classes.**

Run:

```powershell
pnpm run lint
pnpm run type-check
pnpm test
pnpm run build
$env:PATS_DATABASE_URL='postgresql://pats:pats@localhost:5432/pats'; npx prisma validate --schema prisma/pats/schema.prisma
```

Expected: record pass/fail, test totals, pending totals, engine warnings, and runtime warning classes separately.

- [ ] **Step 4: Write the inventory report.**

The report must contain one row per route group with these exact columns:

```markdown
| Route group | Registration | Controller/repository | Prisma models | Seeders | Tests | Generated docs | External integrations | Initial evidence class |
|---|---|---|---|---|---|---|---|---|
```

- [ ] **Step 5: Commit the evidence report.**

```powershell
git add docs/superpowers/reports/2026-07-13-api-surface-inventory.md
git commit -m "docs: inventory API legacy surface"
```

## Task 2: Record the frontend consumer audit (Pass P2)

**Files:**
- Create: `docs/superpowers/reports/2026-07-13-api-consumer-audit.md`
- Inspect: `../bnpi-pats-app/app/routes.ts`, `../bnpi-pats-app/app/routes/`, `../bnpi-pats-app/app/services/`, `../bnpi-pats-app/app/hooks/`, `../bnpi-pats-app/app/lib/api-client.ts`, `../bnpi-pats-app/app/configs/endpoints.ts`, `../bnpi-pats-app/.wwg/wiki/project-truth.md`

**Interfaces:**
- Consumes: API inventory paths and frontend source evidence.
- Produces: active/dormant/demo-only consumer classification consumed by Task 3.

- [ ] **Step 1: Enumerate endpoint constants and service callers.**

Run from `bnpi-pats-app`:

```powershell
rg -n "API_ENDPOINTS|apiClient\.(get|post|patch|put|delete)|fetch\(" app/services app/hooks app/routes app/lib/api-client.ts
```

Expected: service-level callers are separated from tests and demo request handlers.

- [ ] **Step 2: Check active route-tree reachability.**

Run:

```powershell
rg -n "routes|route\(|createBrowserRouter|createRoutes|workspace|planning|line|product|demand" app/routes.ts app/routes app/components app/hooks app/services
```

Expected: each service is labeled active, dormant, demo-only, test-only, or unknown.

- [ ] **Step 3: Run unused-code discovery without editing.**

Run:

```powershell
npx knip --no-progress --reporter compact
```

Expected: record unused services and files as supporting evidence, not as the only retirement proof.

- [ ] **Step 4: Write the consumer report.**

Use this exact table shape:

```markdown
| API route group | Frontend caller | Active route path | Demo-only caller | Test-only caller | Current disposition evidence |
|---|---|---|---|---|---|
| `/api/example` | `app/services/example-service.ts` | `/:workspaceCode/example` | `app/lib/demo-api.ts` | `app/lib/example.test.ts` | active/demo/test/unknown |
```

Replace the example row with observed rows; do not retain the example as data.

- [ ] **Step 5: Commit the consumer report in the API repository.**

```powershell
cd ..\bnpi-pats-api
git add docs/superpowers/reports/2026-07-13-api-consumer-audit.md
git commit -m "docs: audit frontend API consumers"
```

## Task 3: Produce the disposition matrix (Pass P3)

**Files:**
- Create: `docs/superpowers/reports/2026-07-13-api-disposition-matrix.md`
- Read: `docs/superpowers/reports/2026-07-13-api-surface-inventory.md`
- Read: `docs/superpowers/reports/2026-07-13-api-consumer-audit.md`
- Read: `docs/requirements` and `.wwg` surfaces in `../bnpi-pats-app` when a row touches product truth, auth, tenancy, or production boundaries.

**Interfaces:**
- Consumes: both discovery reports.
- Produces: the authoritative disposition used by Tasks 4–6.

- [ ] **Step 1: Create one row per route/module/schema/seed/documentation group.**

Use this exact table:

```markdown
| Group | Route prefixes | Source paths | Schema paths | Seed paths | Consumer evidence | Disposition | Removal order | Verification | Stop condition |
|---|---|---|---|---|---|---|---|---|---|
```

- [ ] **Step 2: Apply the four allowed dispositions.**

Use only `RETAIN_PLATFORM`, `QUARANTINE_LEGACY`, `RETIRE_ACTIVE_ROUTE`, or `BLOCKED_REVIEW`. `BLOCKED_REVIEW` is required for unknown external integrations, auth, tenancy, SSO/HRIS, or contradictory evidence.

- [ ] **Step 3: Record the no-go list.**

The report must explicitly state that `prisma/pats/schema.prisma`, PATS seed design, frontend API adoption, database migration, and production deployment are outside this cleanup.

- [ ] **Step 4: Self-review the matrix.**

Check that every `RETIRE_ACTIVE_ROUTE` row has no active consumer and that every `RETAIN_PLATFORM` row has a named test or direct platform dependency. Any row without both is changed to `BLOCKED_REVIEW`.

- [ ] **Step 5: Commit the matrix.**

```powershell
git add docs/superpowers/reports/2026-07-13-api-disposition-matrix.md
git commit -m "docs: define API legacy dispositions"
```

## Task 4: Extract a testable application-composition seam (Pass P4)

**Files:**
- Create: `app/create-app.ts`
- Create if required by the matrix: `app/legacy/register-legacy-routes.ts`
- Create: `tests/active-surface.spec.ts`
- Modify: `index.ts`
- Modify if required by the matrix: `config/env.ts`, `.env.example`

**Interfaces:**
- Consumes: `config/prisma.ts`, `config/config.ts`, retained route factories, the disposition matrix.
- Produces: `createApp(options?: AppOptions): express.Application` and a runtime that can expose legacy routes only through an explicit compatibility option.

- [ ] **Step 1: Write the failing composition tests.**

Create `tests/active-surface.spec.ts` with the following contract:

```ts
import request from "supertest";
import { createApp } from "../app/create-app";

describe("active API surface", () => {
	it("serves health without starting a listener", async () => {
		const app = createApp({ enableLegacyRoutes: false });
		await request(app).get("/health").expect(200);
	});

	it("does not expose retired route groups by default", async () => {
		const app = createApp({ enableLegacyRoutes: false });
		await request(app).get("/api/project").expect(404);
	});
});
```

Use `/api/project` as the initial retirement smoke route only if P3 classifies the inherited project module as `RETIRE_ACTIVE_ROUTE`; otherwise use the first literal route prefix marked `RETIRE_ACTIVE_ROUTE` in the matrix. The test must not use a route marked `RETAIN_PLATFORM` or `BLOCKED_REVIEW`.

- [ ] **Step 2: Run the focused test to verify the seam is absent.**

```powershell
pnpm test -- tests/active-surface.spec.ts
```

Expected: FAIL because `app/create-app.ts` does not exist yet.

- [ ] **Step 3: Extract application construction.**

Create `app/create-app.ts` with this public shape and preserve the existing middleware order:

```ts
import express from "express";

export interface AppOptions {
	enableLegacyRoutes?: boolean;
}

export function createApp(options: AppOptions = {}): express.Application {
	const app = express();
	// Move the current request parsing, CORS, security, sanitization, health,
	// docs, auth, retained routes, 404, and error middleware here in order.
	return app;
}
```

Move server creation, database connection, cron initialization, graceful shutdown, and `listen` responsibility to `index.ts`. Do not change response shapes or middleware ordering while extracting.

- [ ] **Step 4: Add the explicit legacy registration boundary if needed.**

Create `app/legacy/register-legacy-routes.ts` with this interface:

```ts
import type { Express, Router } from "express";
import type { PrismaClient } from "../../generated/prisma";

export interface LegacyRouteRegistration {
	path: string;
	load: (prisma: PrismaClient) => Router;
}

export function registerLegacyRoutes(
	app: Express,
	prisma: PrismaClient,
	baseApiPath: string,
	registrations: readonly LegacyRouteRegistration[],
): void {
	for (const registration of registrations) {
		app.use(registration.path || baseApiPath, registration.load(prisma));
	}
}
```

The registration list must contain only `QUARANTINE_LEGACY` groups. `RETIRE_ACTIVE_ROUTE` groups are not registered. The default `createApp()` call must pass `enableLegacyRoutes: false` unless the disposition matrix explicitly requires compatibility by default.

- [ ] **Step 5: Add environment configuration only if required.**

If the matrix requires an environment switch, add:

```ts
ENABLE_LEGACY_API: z.enum(["true", "false"]).default("false"),
```

to `config/env.ts`, add `ENABLE_LEGACY_API=false` to `.env.example`, and use the parsed value only as the default for `createApp`. Do not weaken the existing production guard for `ENABLE_TEST_MODE`.

- [ ] **Step 6: Run focused and baseline verification.**

```powershell
pnpm test -- tests/active-surface.spec.ts
pnpm run type-check
pnpm run lint
```

Expected: focused tests pass; typecheck and lint pass; no PATS endpoint is introduced.

- [ ] **Step 7: Commit the composition seam.**

```powershell
git add app/create-app.ts app/legacy/register-legacy-routes.ts tests/active-surface.spec.ts index.ts config/env.ts .env.example
git commit -m "refactor: isolate legacy API route composition"
```

Only stage files that actually exist and are covered by the disposition matrix.

## Task 5: Retire confirmed-dead API groups (Pass P5)

**Files:**
- Modify: `index.ts` and `app/create-app.ts` route registration
- Modify: `app/legacy/register-legacy-routes.ts` if present
- Delete only: source directories, schema fragments, seed imports, validators, services, and generated documentation named `RETIRE_ACTIVE_ROUTE` in the matrix
- Modify: `tests/active-surface.spec.ts` and add focused regression tests beside any retained route whose coupling changes

**Interfaces:**
- Consumes: the approved disposition matrix and `createApp()` seam.
- Produces: 404-backed, evidence-supported retirement of dead API groups without disturbing retained platform behavior.

- [ ] **Step 1: Select the next retirement group by dependency order.**

Choose the first matrix row whose `Removal order` has no unfinished prerequisite. Do not combine a `BLOCKED_REVIEW` or `RETAIN_PLATFORM` group into the commit.

- [ ] **Step 2: Prove no retained imports exist.**

Run the group-specific search described in the matrix. For the initial project retirement group, the concrete search is:

```powershell
rg -n "project|Project" app config middleware prisma tests docs
```

For each later group, run the same command shape with the exact lowercase module name and Prisma model name recorded in that matrix row. Expected: only the selected group, its report, and its approved tests remain.

- [ ] **Step 3: Add or update the 404 regression test first.**

Use the real route prefix:

```ts
it("returns 404 for retired project routes", async () => {
	const app = createApp({ enableLegacyRoutes: false });
	await request(app).get("/api/project").expect(404);
});
```

Repeat this exact test shape with the literal route prefix from each additional `RETIRE_ACTIVE_ROUTE` row.

- [ ] **Step 4: Remove registration and unreachable source.**

Remove the selected group from its route registry, then remove its source only after the import search is clean. Remove its Prisma schema fragment only if no retained schema relation references it. Remove its seed import/call only if its schema is retired or the matrix explicitly keeps the seeder as compatibility-only.

- [ ] **Step 5: Regenerate Prisma and API docs where applicable.**

```powershell
pnpm run prisma-generate
pnpm run export-docs
```

Never hand-edit `generated/`, `docs/generated/swagger.json`, `docs/generated/swagger.yaml`, `docs/generated/endpoints.json`, or `docs/generated/postman.collection.json` when the generator can produce the change.

- [ ] **Step 6: Verify the group and commit it.**

```powershell
pnpm test -- tests/active-surface.spec.ts
pnpm run type-check
pnpm test -- tests/project.controller.spec.ts
git diff --check
git diff --name-only
git add -A -- app prisma docs tests index.ts config/env.ts .env.example
git commit -m "refactor: retire project API surface"
```

Before staging, confirm that `git diff --name-only` contains only the selected group, its tests, generated outputs, and the approved reports. Repeat the same verification and commit shape for each additional group.

Repeat Steps 1–6 for every `RETIRE_ACTIVE_ROUTE` group. If the group cannot pass the import or route test, stop and change its disposition to `BLOCKED_REVIEW` rather than broadening the deletion.

## Task 6: Make documentation and seed boundaries truthful (Pass P6)

**Files:**
- Modify: `README.md`
- Modify: `docs/openApiSpecs.ts` only for retained route descriptions and legacy deprecation/boundary metadata
- Modify: `prisma/seed.ts` only when required to preserve a retained compatibility seed boundary
- Modify: `docs/superpowers/reports/2026-07-13-api-disposition-matrix.md` with final file outcomes
- Regenerate: `docs/generated/swagger.json`, `docs/generated/swagger.yaml`, `docs/generated/endpoints.json`, `docs/generated/postman.collection.json`

**Interfaces:**
- Consumes: final route composition and retirement results.
- Produces: documentation that lists only active routes and labels retained seed data as legacy/demo material.

- [ ] **Step 1: Update the README API boundary.**

Replace claims that the inherited PMS modules are the manufacturing API with an explicit statement that the repository currently contains shared platform foundations, legacy compatibility modules, and a provisional unwired PATS schema. Keep setup commands accurate.

- [ ] **Step 2: Update seed documentation without redesigning seed data.**

Keep existing seed values unless their schema was retired. Add a clear header/comment to `prisma/seed.ts` that the current orchestrator seeds the legacy compatibility database and is not a canonical PATS seed. Do not add PATS entities or rename legacy values.

- [ ] **Step 3: Regenerate and scan documentation.**

```powershell
pnpm run export-docs
rg -n "/api/project|project" docs/generated docs/openApiSpecs.ts
```

Repeat the scan with each literal route and operation identifier from the matrix. Expected: no retired route is advertised.

- [ ] **Step 4: Verify docs and commit.**

```powershell
pnpm run type-check
pnpm run lint
git diff --check
git add README.md docs/openApiSpecs.ts prisma/seed.ts docs/generated docs/superpowers/reports/2026-07-13-api-disposition-matrix.md
git commit -m "docs: clarify API legacy and seed boundaries"
```

## Task 7: Verify and synchronize truth (Pass P7)

**Files:**
- Inspect and verify: all API changes above
- Modify: `README.md` or local API architecture note only if final observed behavior is missing
- Modify in `../bnpi-pats-app` only after reading the required WWG files: `.wwg/wiki/project-truth.md`, `.wwg/wiki/terminology.md`, `.wwg/wiki/principles/README.md`, `.wwg/workspace/current-task.md`, `.wwg/governance/drift-guard.md`, `README.md`
- Modify app truth/workspace/report surfaces only with observed facts from the completed cleanup

**Interfaces:**
- Consumes: all prior commits and reports.
- Produces: evidence-backed final handoff and synchronized project context.

- [ ] **Step 1: Run the complete verification suite.**

```powershell
pnpm run lint
pnpm run type-check
pnpm test
pnpm run build
$env:PATS_DATABASE_URL='postgresql://pats:pats@localhost:5432/pats'; npx prisma validate --schema prisma/pats/schema.prisma
```

Expected: lint, typecheck, tests, build, and standalone PATS schema validation pass. Report test totals and pending tests exactly.

- [ ] **Step 2: Verify runtime route behavior.**

Run the active-surface tests and verify at least one retained platform route, `/health`, every retired route group, and the 404 handler. Confirm no legacy route is mounted when `enableLegacyRoutes` is false.

- [ ] **Step 3: Scan for accidental scope expansion.**

```powershell
git diff --name-only cd7d725..HEAD
rg -n "prisma/pats|PATS_DATABASE_URL|migrate|db push|DROP DATABASE|reset --force|production|latest-stable" index.ts app config prisma deploy docs README.md
```

Review every hit. The scan is not a failure by itself; it is a manual check that no migration, production, or PATS-runtime work entered this cleanup.

- [ ] **Step 4: Synchronize the app WWG surfaces.**

Record only observed facts: API runtime remains legacy Mongo-backed, PATS schema remains provisional/unwired, legacy route groups retired or quarantined by evidence, and seed data remains demo/compatibility material. Preserve `INFERRED`, `CONFLICTING`, `NEEDS_CONFIRMATION`, and `STALE` labels where applicable.

- [ ] **Step 5: Write the handoff.**

The final handoff must list:

```markdown
## Changed
## Validated
## Truth/context/governance synchronized
## Retained and quarantined surfaces
## Remaining risks
## Recommendations
```

State explicitly whether new recommendations were added. Do not claim the PATS model is hardened or production-ready.

- [ ] **Step 6: Commit final synchronization.**

```powershell
git add README.md docs app index.ts config/env.ts .env.example
git commit -m "chore: verify API legacy containment boundary"
```

## Plan self-review

- Spec coverage: the plan covers evidence, classification, runtime containment, retirement, documentation/seed truth, verification, and WWG synchronization.
- Placeholder scan: no unresolved path or behavior placeholder remains. Project-route examples are concrete smoke tests; additional groups repeat the same tested command shape using literal paths recorded in the approved disposition matrix.
- Type consistency: `createApp(options?: AppOptions): express.Application`, `AppOptions.enableLegacyRoutes?: boolean`, and `registerLegacyRoutes(app, prisma, baseApiPath, registrations)` are used consistently across P4–P7.
- Scope: the plan does not add PATS domain behavior, migrations, production deployment, or frontend API adoption.
