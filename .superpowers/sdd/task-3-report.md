# Task 3 Report: Rate-limit/deprecation headers and OpenAPI common components

## Status

Completed on `develop`. This was classified as a meaningful feature slice delivered by an AI
agent. It adds only reusable canonical transport contract material; it does not add or alter an
endpoint, domain schema, authorization decision, legacy rate-limiter behavior, application
composition, persistence, generated output, seed, deployment, or frontend surface.

## Files changed

- `app/canonical/response-headers.ts` — framework-light `HeaderTarget` adapter interface plus
  reusable rate-limit and deprecation response-header helpers.
- `tests/canonical-response-contract.spec.ts` — focused unit/contract tests for accepted and
  rejected header values and the checked-in OpenAPI source.
- `docs/openapi/2026-07-14-pats-api-v1-common-components.yaml` — reviewed OpenAPI 3.1 source
  contract containing only shared schemas, parameters, headers, and error responses.
- `.superpowers/sdd/task-3-report.md` — this report.

## TDD evidence

### RED

1. Added `tests/canonical-response-contract.spec.ts` before implementation.
2. Ran `pnpm exec mocha --require ts-node/register tests/canonical-response-contract.spec.ts`.
3. The run failed as expected with `Cannot find module '../app/canonical/response-headers'`.

### GREEN

1. Added the header helper and OpenAPI source.
2. The initial repository-configured Mocha invocation passed the new tests and, because the
   repository config expands the test pattern, also passed the existing suite.
3. Added an additional RED assertion for a valid JavaScript `Date` that cannot be represented as
   an IMF-fixdate HTTP-date (year 10000); it failed before the helper was tightened.
4. Added strict IMF-fixdate validation and reran the isolated focused command:
   `pnpm exec mocha --no-config --require ts-node/register tests/canonical-response-contract.spec.ts`
   — **8 passing**.

## Implementation and contract review

- `setRateLimitHeaders` validates all values as non-negative safe integers before emitting any
  header, then sets `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` as wire
  strings. It is not connected to the legacy rate limiter.
- `setDeprecationHeaders` rejects invalid or non-HTTP-date-representable dates before emitting
  anything, then sets exactly `Deprecation: true` and a GMT IMF-fixdate `Sunset` value. It does
  not select a sunset date or encode the 90-day policy.
- The source OpenAPI document declares `openapi: 3.1.0`, `/api/v1`, and empty `paths`; it does not
  define domain resources, operations, or authorization decisions.
- Components cover RFC 9457 Problem Details and field errors, camelCase offset/cursor envelopes,
  Idempotency-Key/If-Match/trace headers, all requested shared response headers, and stable PATS
  `application/problem+json` responses for 400, 401, 403, 404, 405, 406, 409, 412, 413, 415,
  422, 429, 500, and 503.
- Endpoint checklist review: contract identity, relationships/collections, HTTP semantics,
  security/tenancy, and endpoint-specific concurrency are **N/A** because no operations were
  added. Errors, shared pagination, retries/concurrency headers, data naming, observability, and
  OpenAPI source requirements are covered by the shared components and focused tests.

## Verification

| Command | Result |
|---|---|
| `pnpm exec mocha --no-config --require ts-node/register tests/canonical-response-contract.spec.ts` | PASS — 8 passing |
| `pnpm run type-check` | PASS |
| `pnpm run lint` | PASS |
| `git diff --check` | PASS |
| `pnpm test` | PASS — existing suite exit 0 |

The commands reported the existing engine warning because this environment uses Node `v24.17.0`
while `package.json` declares Node `20.x`; all checks completed successfully. The full suite also
retained its pre-existing legacy mocked audit/activity and optional Redis warning output.

## Self-review and concerns

- Confirmed no imports or edits to `app/create-app.ts`, the legacy rate limiter, Task 1/Task 2
  files, Prisma, migrations, generated artifacts, seeds, deployment files, or frontend files.
- Confirmed no domain resource schema, endpoint operation, auth scheme, capability, or tenancy
  assertion is claimed by the new OpenAPI source.
- Confirmed all required headers, status responses, media type, problem types, parsing, and server
  identity are directly asserted in tests.
- No new recommendations were identified.
- Remaining concern: the repository’s current full test suite emits known legacy mock warnings;
  they are unrelated to this slice and did not fail the suite. Runtime engine alignment with the
  declared Node 20.x remains an environment concern outside this task.

## Final whole-branch review fix section

### Findings addressed

- `OffsetPagination.pageSize` now declares `maximum: 100`, matching the canonical runtime page
  size limit.
- `IdempotencyKey` retains its `minLength: 1` and `maxLength: 255` and now uses `pattern: '\\S'`
  so whitespace-only header values are rejected.
- Focused contract assertions cover both source-contract requirements.

### Changed files and verification

- `docs/openapi/2026-07-14-pats-api-v1-common-components.yaml` — added the page-size maximum and
  non-whitespace idempotency-key pattern.
- `tests/canonical-response-contract.spec.ts` — asserts the maximum, length limits, and pattern.
- RED combined canonical command: **17 passing, 9 failing** before this fix wave; the two OpenAPI
  assertions were among the failures.
- GREEN combined canonical command: **26 passing**.
- `pnpm run type-check`, `pnpm run lint`, and `pnpm test` all passed.

### Final review self-check

- The document remains source-only OpenAPI common components with no operations, domain
  decisions, generated files, or legacy changes.
- No new recommendations were identified. The existing Node 20.x engine warning and inherited
  full-suite mock warning noise remain outside this task's scope.
