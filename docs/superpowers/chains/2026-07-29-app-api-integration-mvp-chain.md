# Chain: App–API Integration MVP

Status: PASSES 0-10 COMPLETE LOCALLY / DEV RELEASE CANDIDATE / REMOTE CI PENDING
Date: 2026-07-29
Owner: cross-repository implementation agent
Companion plan: docs/superpowers/plans/2026-07-29-app-api-integration-mvp-plan.md
App plan/report: sibling repository bnpi-pats-app/.wwg/reports/2026-07-29-app-api-integration-mvp-plan.md
Pass 8 execution plan: sibling repository bnpi-pats-app/.wwg/reports/2026-07-30-app-api-mvp-pass-8-dev-smoke-plan.md
Pass 8 execution report: docs/superpowers/reports/2026-07-30-app-api-mvp-pass-8-dev-smoke.md
Pass 9 execution report: docs/superpowers/reports/2026-07-30-app-api-mvp-pass-9-container-validation.md
Pass 10 execution report: docs/superpowers/reports/2026-07-30-app-api-mvp-pass-10-ci-release-validation.md

## Meta-prompt

Act as a senior Bandai PATS API and frontend integration engineer. Execute the passes in order. Use the API repository's REST standard, endpoint checklist, design context, and current Gate 0 target as governing constraints. Use the frontend only as alignment evidence for UI state and terminology.

Objective: integrate the smallest complete Product Catalog vertical slice across bnpi-pats-api and bnpi-pats-app.

Source precedence:

1. Explicit user decisions and accepted WWG/API decision records.
2. The API REST endpoint standard and endpoint checklist.
3. Accepted API architecture/data-model/cross-cutting design.
4. Current implementation and tests.
5. Frontend types, routes, fixtures, and reports as alignment evidence.
6. Seeds, filenames, generated artifacts, and legacy routes as compatibility evidence only.

Rules:

- Do not guess when sources conflict. Mark NEEDS_CONFIRMATION, CONFLICTING, or STALE.
- Canonical routes begin at /api/v1 and use plural lowercase kebab-case resource names.
- Query parameters are snake_case; JSON is camelCase.
- Collections use the data/pagination envelope and enforce bounds.
- Protected resources require authenticated server-side capability and deployment/object checks.
- Mutable draft resources use ETag/If-Match; retryable creates use Idempotency-Key.
- Error responses use RFC 9457 Problem Details.
- Do not trust workspace headers, localStorage, client roles, display names, image filenames, or incomplete source files as canonical authority.
- Keep API mode and demo mode explicit; never silently fall back.
- Do not apply migrations, contact production, publish uncertain client values, or perform DM/cutover work.
- Preserve unrelated user changes and never weaken existing tests.
- Write a report after each pass with evidence, files changed, validation, blockers, and the exact next pass.

## Sequential pass prompts

### Pass 0 — baseline and chain contract

Inspect both worktrees, the current checkpoint branch, catalog routes, app service/hook, auth/capability paths, OpenAPI sources, migrations, and tests. Record current truth and scope exclusions. No source changes.

Gate: the Product Catalog vertical slice is bounded and the route-family discrepancy is visible.

### Pass 1 — contract reconciliation

Review the proposed Product collection/detail/write operations against the REST standard and checklist. Decide or explicitly defer /api/v1/catalog/products versus /api/v1/products. Specify pagination, sorting, response fields, capability, deployment scope, errors, ETags, idempotency, and OpenAPI operation identity.

Gate: one route family is accepted for this MVP; no endpoint implementation proceeds with an unresolved namespace conflict.

### Pass 2 — collection read implementation

Implement the approved Product collection GET using the existing catalog foundation seams. Keep the operation deployment-scoped and capability-protected. Add bounded pagination, deterministic ordering, sparse-safe output, OpenAPI, and contract tests.

Gate: API lint/type checks, focused tests, authorization tests, and generated documentation validation pass.

### Pass 3 — frontend transport adapter

Extend the existing pats-catalog-service boundary with typed list/detail DTOs, auth headers, API/demo mode configuration, error normalization, and source/lifecycle mapping. No route UI changes until the adapter tests pass.

Gate: mocked transport tests prove success, malformed response, 401/403, 409/412/422/503 mapping, and explicit demo behavior.

### Pass 4 — read hydration

Wire product list, product pack detail, and model detail to API mode. Keep the existing demo reducer path behind explicit demo mode. Preserve canonical IDs and evidence states. Add concise loading/error/empty/sparse states and route tests.

Gate: refresh returns API state; API mode does not write canonical state to localStorage; UI simplification check passes for changed screens.

### Pass 5 — draft mutation integration

Wire Product, Model, and ModelPart create/PATCH calls. Add idempotency keys, ETag/If-Match, response reconciliation, and conflict handling. Do not add publication, retirement, BOM, route, or planning mutations.

Gate: retry, same-key conflict, stale validator, validation, authorization, and API-unavailable behavior are tested.

### Pass 6 — cross-repository acceptance verification

Run API contract tests, frontend service/route tests, type checks, OpenAPI generation/validation, and an isolated local API/browser smoke if available. Do not apply migrations or use production data.

Gate: MVP acceptance criteria are evidenced and failures are classified.

### Pass 7 — truth synchronization and handoff

Update WWG reports/current task, API plan/chain status, OpenAPI evidence, and PR descriptions. State exactly what is API-backed, what remains demo/localStorage, which migrations are unapplied, and what must happen next.

Gate: canonical truth, release boundaries, and unresolved decisions are persisted outside the chat.

### Pass 8 — isolated environment smoke (conditional)

Only after explicit approval of an isolated DEV database/migration target, run a real API/app smoke. Verify identity, catalog reads/writes, migration status, logs, and rollback compatibility. Never run production or destructive cutover operations.

Gate: environment, migration approval, recovery evidence, and stop conditions are recorded.

### Pass 9 — container and browser runtime validation

Build the API image using the Node 20 contract, start a uniquely named disposable Compose stack, apply committed migrations to its database, verify CORS preflight and health, and run the API and frontend adapter smoke against the container. Fix only integration defects exposed by that path; do not expand into new domain slices.

Gate: the image builds, the container is healthy, browser preflight succeeds, API and adapter checks pass, and the result is recorded as a DEV release candidate without implying production readiness.

### Pass 10 — CI and release reproducibility

Make CI execute the deployment-critical sequence: start dependencies, apply committed migrations, build/start the API image, verify health, verify browser preflight, and clean up. Do not add production publishing or migration cutover.

Gate: local workflow configuration is valid and the remote GitHub Actions run is green before the next domain chain is treated as release-ready.

## Per-pass handoff template

- Pass completed:
- Evidence inspected:
- Files changed:
- Contract/implementation result:
- Validation:
- Open questions:
- Release boundary:
- Ready for next pass: yes/no

## Chain completion gate

The chain is complete only when the app can load, create, edit, and refresh Product/Model/ModelPart data through API mode; demo mode remains explicit; concurrency and retry semantics are verified; the deployable DEV container path is healthy; the remote CI release gates are green; and the release boundary states that BOM, routes, planning, execution, inventory, Drive, publication, production, and DM/cutover are not included.
