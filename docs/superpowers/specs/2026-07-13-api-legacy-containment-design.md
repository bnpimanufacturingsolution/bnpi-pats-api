# Bandai PATS API Legacy Containment Design

Date: 2026-07-13  
Status: Proposed for review  
Task mode: high-risk cleanup / architecture containment  
Delivery mode: AI-agent

## 1. Decision

Pause new PATS API feature development and cleanly separate the inherited API
surface from the future manufacturing API.

The current API is not a reliable domain source of truth. Its runtime is a
legacy MongoDB/Prisma application with inherited PMS modules, broad
presentational seed data, and generated documentation for those modules. The
standalone `prisma/pats/schema.prisma` file is a validated working draft, not a
ratified production model. No PATS entity, seed record, or legacy seed shape
will be promoted to canonical merely because it exists in code.

## 2. Goals

- Make the active API surface explicit and small enough to reason about.
- Preserve current behavior long enough to prove which modules are still used.
- Quarantine or retire legacy PMS modules without silently deleting useful
  platform foundations.
- Keep presentational seed data available as legacy/demo material, but prevent
  it from defining future PATS contracts.
- Keep the provisional PATS Prisma schema isolated from the legacy runtime.
- Leave the repository with a repeatable verification baseline for future API
  design work.

## 3. Non-goals

- No new PATS CRUD, planning, execution, scanning, or reporting endpoints.
- No database migration, database reset, seed-data rewrite, or production
  deployment change.
- No decision that the current PATS draft schema is final.
- No replacement of authentication, workspace tenancy, or security middleware
  during the cleanup pass. Those areas require separate review because they
  are foundational and security-sensitive.
- No frontend switch from local fixtures/demo transport to the API.

## 4. Classification model

Every API route, module, schema, seed, generated document, and direct import
will be assigned one of these dispositions:

### Retain as shared platform

Candidates include health/readiness, configuration, request/error handling,
security middleware, authentication integration, and workspace tenancy. A
candidate is retained only after its consumers and tests are verified.

### Quarantine as legacy

Inherited PMS modules that may still be useful for historical/demo operation
but are not part of the current manufacturing product boundary. Quarantined
code remains available in a clearly marked compatibility boundary and is not
treated as a PATS contract.

### Retire from the active runtime

Modules are retired only when repository and consumer evidence shows that no
active frontend, integration, test, or documented supported workflow depends
on them. Their generated route documentation and default registration must be
retired together so the API does not advertise dead behavior.

### Provisional PATS foundation

The standalone PATS schema, deployment skeleton, and any future PATS design
notes remain isolated and explicitly provisional. They are not mounted into
the legacy Mongo runtime and do not receive migrations or production seeds in
this pass.

## 5. Cleanup phases

### Phase A — Evidence and baseline

- Record the current route registration and module dependency graph.
- Map each module to frontend callers, tests, seeders, schema models, docs, and
  external integrations.
- Run and record typecheck, test, build, legacy Prisma validation, and
  provisional PATS schema validation.
- Capture current warnings separately from pass/fail results.

### Phase B — Boundary and runtime containment

- Create an explicit active-platform versus legacy compatibility boundary in
  the API composition layer.
- Stop describing inherited PMS modules as the Bandai PATS manufacturing API.
- Ensure the provisional PATS schema is not accidentally included in the
  legacy Prisma client or runtime startup.
- Keep legacy seed data and source files intact until the retirement matrix is
  reviewed and verified.

### Phase C — Evidence-backed retirement

- Remove only confirmed-dead route registrations and their unreachable
  generated documentation.
- Remove or quarantine associated controllers, repositories, validators, and
  seed entry points only when no retained module imports them.
- Add regression coverage for retired routes so accidental reintroduction is
  visible.
- Do not remove shared middleware or auth/workspace foundations as a side
  effect of module cleanup.

### Phase D — Clean handoff boundary

- Update the API README and local architecture notes to describe the actual
  active surface and legacy boundary.
- Update the app project-truth/workspace surfaces with the discovered API
  status and any unresolved decisions.
- Stop before implementing new PATS persistence or endpoint behavior.

## 6. Verification requirements

The cleanup is complete only when:

- The active route list matches the retained-platform/approved-compatibility
  boundary.
- No retired route remains in generated OpenAPI or endpoint exports.
- Typecheck passes.
- The test suite passes, with pending tests and legacy warning noise reported
  explicitly rather than hidden.
- The production build passes.
- Legacy Prisma validation still passes for retained runtime code.
- `prisma/pats/schema.prisma` validates independently with an explicit
  `PATS_DATABASE_URL`, but remains unwired.
- No seed data was used as evidence for a canonical PATS domain decision.
- No new recommendations are presented as confirmed product truth.

## 7. Risks and stop conditions

Stop and request review if cleanup evidence conflicts with the current
frontend, an external integration, authentication behavior, workspace
scoping, or a documented supported workflow. Pause before any destructive
database, migration, permission, or production operation.

The main known risk is that the legacy API's broad tests can pass while still
emitting warnings caused by incomplete mocks or hidden coupling. Passing tests
are necessary but not sufficient evidence that a module is safe to retire.

## 8. Expected result

At the end of this pass, the repository should be a clean backend shell with a
small, verified platform boundary and an explicitly isolated legacy remainder.
It should be ready for a later PATS domain-design pass driven by confirmed
workflow and UX decisions, not by inherited database models or presentational
fixtures.
