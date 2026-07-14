# Task 1 Implementation Report: Canonical HTTP Boundary and Platform Health

## Status

Completed. Task 1 adds an isolated canonical `/api/v1` transport boundary and the public
`GET /api/v1/health` process-health endpoint without changing legacy route registrations,
legacy route behavior, persistence, Prisma, generated artifacts, seeds, deployment files, or
frontend files.

## Files changed

- `app/create-app.ts` — mounts the canonical boundary immediately after request correlation and
  before legacy JSON parsing, authentication, and error handling.
- `app/canonical/router.ts` — focused canonical router for JSON negotiation, RFC 9457 Problem
  Details, W3C trace context propagation, public health, 404/405 behavior, media validation, and
  malformed JSON handling.
- `tests/canonical-http-boundary.spec.ts` — focused Supertest contract coverage.

## Behavior delivered

- `GET /api/v1/health` returns only `{ "status": "healthy" }` as `application/json`; it exposes
  no dependency, tenant, secret, or topology data.
- Canonical requests accept JSON-compatible `Accept` values and return
  `urn:bandai:pats:problem:not-acceptable` with `406` for unsatisfiable media preferences.
- Canonical error responses use `application/problem+json` and RFC 9457 `type`, `title`,
  `status`, `detail`, and `instance` fields.
- The approved stable types are used for malformed request, unsupported media type, method not
  allowed, not acceptable, and not found cases.
- Valid inbound `traceparent` and optional `tracestate` are reflected; the existing
  `X-Request-ID` correlation middleware remains first and its response header is preserved.
- `POST /api/v1/health` returns `405` with `Allow: GET`; a JSON-bearing request with unsupported
  content type returns `415` first; malformed JSON returns `400`; unmatched canonical routes
  return canonical `404` problems rather than legacy authentication or legacy error envelopes.

## TDD evidence

### RED

Command:

```text
pnpm exec mocha --no-config --require ts-node/register --extension ts tests/canonical-http-boundary.spec.ts --reporter dot --exit
```

Before implementation, the suite reported **0 passing, 6 failing**. The health and trace tests
received legacy `401 Unauthorized`; error tests received legacy `application/json` envelopes.
This demonstrated that `/api/v1` fell through to the existing `/api` authentication and error
boundary.

### GREEN

The same focused command after implementation reported **7 passing**. The additional 415 test
was written before production code and passed with the full focused contract suite.

## Verification

| Command | Result |
|---|---|
| Focused canonical Supertest suite | PASS — 7 passing |
| `pnpm run lint` | PASS |
| `pnpm run type-check` | PASS |
| `pnpm test` | PASS — full configured Mocha suite exited 0 |
| `git diff --check` | PASS |

## Endpoint review evidence

- Contract identity: PASS — `CANONICAL` operational route at `/api/v1/health`; no identifier or
  verb path.
- HTTP semantics: PASS — public GET process-health response; unsupported method returns 405 and
  `Allow: GET`; no successful error envelopes.
- Errors: PASS — approved RFC 9457 media type/fields and stable PATS problem types; canonical
  404, 405, 406, 415, and malformed JSON 400 coverage.
- Security/tenancy: PASS — public operational read; contains no tenant or sensitive/dependency
  detail; isolated before legacy authentication.
- Data/observability: PASS — JSON response is camelCase-compatible; valid W3C trace context and
  existing human-readable request correlation are propagated.
- Concurrency/retries: N/A — read-only process-health endpoint.
- Documentation/OpenAPI: N/A for this scoped task — Task 3 owns the reviewed common OpenAPI
  components and the user prohibited generated-artifact changes.

## Self-review

- Legacy route registration order and source were not changed.
- Existing `/`, `/health`, `/api`, and compatibility behavior remain covered by the full suite;
  the active-surface tests passed.
- No Prisma schemas, migrations, generated files, seeds, deployment files, or frontend files were
  modified.
- The router is isolated and focused; no broad error-handler or request-ID refactor was made.
- New code is ES6-target compatible after replacing named regex groups identified by type-check.

## Concerns

- Commands ran under Node `v24.17.0` while `package.json` declares Node `20.x`; pnpm emitted an
  engine warning, but lint, type-check, focused tests, and the full suite passed.
- The inherited full suite continues to emit pre-existing mocked activity/audit and Redis warning
  noise while exiting successfully. No new warnings were added by the canonical boundary.
- No new recommendations were identified.

## Final whole-branch review fix section

### Findings addressed

1. The canonical error boundary now contains body-parser and transport failures: malformed JSON
   remains a `400 malformed-request`, oversize JSON is a `413 payload-too-large`, and unsupported
   charset, encoding, or media errors are a `415 unsupported-media-type`. All other errors raised
   while handling a canonical request now receive a generic `500 internal-error` Problem Details
   response without an error message or stack.
2. `GET` and `HEAD /api/v1/health` both return successful process-health responses. HEAD sends no
   response body, and unsupported methods advertise `Allow: GET, HEAD`.
3. Canonical responses remove `X-Powered-By`; legacy composition was not changed. Valid
   `tracestate` values continue to propagate with a valid `traceparent`, while malformed
   `tracestate` values are discarded.

### Changed files

- `app/canonical/router.ts` — contained parser/transport/internal errors in the canonical RFC
  9457 boundary; added HEAD semantics, accurate Allow, canonical-only `X-Powered-By` removal,
  tracestate validation, and a router-level health-handler injection seam used only by the focused
  error-boundary test.
- `tests/canonical-http-boundary.spec.ts` — added regressions for HEAD, Allow, X-Powered-By,
  invalid tracestate, 413, unsupported charset 415, and a deterministic unexpected handler 500.

### TDD and verification evidence

- RED: `pnpm exec mocha --no-config --require ts-node/register --extension ts
  tests/canonical-http-boundary.spec.ts tests/canonical-response-contract.spec.ts --reporter dot
  --exit` — **17 passing, 9 failing** before implementation. Failures demonstrated legacy
  envelopes for parser errors and unexpected canonical failures, plus the missing HEAD, Allow,
  header, trace, and OpenAPI constraints.
- GREEN: the same focused command — **26 passing** after implementation.
- `pnpm run type-check` — PASS (`Type check passed!`).
- `pnpm run lint` — PASS.
- `pnpm test` — PASS (Mocha exited 0).

### Final review self-check

- The canonical router is still mounted before legacy parsing, authentication, and global errors;
  no legacy registration, response composition, persistence, Prisma, migration, seed,
  deployment, generated, or frontend file changed.
- The generic 500 response uses only stable Problem Details fields and a fixed detail; it does not
  serialize the thrown error, message, or stack.
- The test seam changes no public route and exists only to make canonical error handling
  deterministic under Supertest.
- No new recommendations were identified.

### Remaining concerns

- Commands ran with Node `v24.17.0` while `package.json` declares Node `20.x`; pnpm emitted the
  existing engine warning.
- The full inherited suite retains its existing mock audit/activity and optional Redis warning
  noise while exiting successfully.

## Task 1 review-fix section

### Findings addressed

1. Successful canonical JSON negotiation now accepts `application/json` and wildcard media types,
   but not `application/problem+json` alone. A Problem Details-only `Accept` receives canonical
   `406 Not Acceptable`.
2. `traceparent` parsing now enforces lowercase W3C hexadecimal grammar, rejects uppercase
   hexadecimal values, rejects extensions on version `00`, and accepts/propagates lowercase
   extension fields on future versions such as version `01`.
3. Existing valid lowercase `traceparent`/`tracestate` propagation and canonical problem
   responses remain covered and passing.

### Changed files

- `app/canonical/router.ts` — corrected success `Accept` negotiation and traceparent parsing.
- `tests/canonical-http-boundary.spec.ts` — added three focused regressions for
  Problem Details-only `Accept`, uppercase traceparent rejection, and future-version extension
  propagation.
- `.superpowers/sdd/task-1-report.md` — this review-fix evidence section.

### TDD evidence

RED command (before the fix):

```text
pnpm exec mocha --no-config --require ts-node/register --extension ts tests/canonical-http-boundary.spec.ts --reporter dot --exit
```

Result: **7 passing, 3 failing**. The three failures were the newly added regressions: the
Problem Details-only request returned `200 application/json`, uppercase traceparent was
propagated, and the future-version extension traceparent was not propagated.

GREEN command (after the fix):

```text
pnpm exec mocha --no-config --require ts-node/register --extension ts tests/canonical-http-boundary.spec.ts --reporter dot --exit
```

Result: **10 passing**. The run retains only pre-existing Node/EventEmitter warning noise.

### Verification commands and outputs

- `pnpm run type-check` — PASS; `Type check passed!` (pnpm emitted the existing Node 20.x versus
  Node 24.17.0 engine warning).
- `pnpm run lint` — PASS; ESLint exited 0.
- The focused suite preserved the original health, negotiation, canonical error, media type,
  malformed JSON, correlation, and valid trace context behaviors while adding the three review
  regressions.

### Fix self-review

- Only the canonical router and its focused test file were changed for the fix; the legacy route
  registrations and pre-existing documentation changes were not modified.
- The Accept change applies only to canonical negotiation and leaves RFC 9457 error responses
  intact.
- The trace parser rejects uppercase hex and reserved version `ff`, requires nonzero trace and
  parent IDs, preserves version `00` behavior, and accepts lowercase extension fields for future
  versions.
- No Prisma, generated, seed, deployment, frontend, or unrelated files were changed.
- No new recommendations were identified; the existing Node-version and inherited warning-noise
  concerns remain documented above.

## Task 1 re-review fix section

### Findings addressed

1. Canonical success negotiation now accepts `Accept: application/*` for the JSON health
   response.
2. Matching media ranges are resolved by specificity before quality: the more-specific
   `application/json;q=0` excludes JSON even when `*/*;q=1` is also present.
3. Higher-version `traceparent` values validate only the known lowercase version, trace ID,
   parent ID, and flags prefix. Unknown future suffix fields are opaque, are not parsed or
   constrained, and the complete incoming header is propagated. Version `ff` and uppercase
   known fields remain rejected; existing valid `tracestate` propagation remains intact.

The trace behavior follows the official [W3C Trace Context versioning
guidance](https://www.w3.org/TR/trace-context/#versioning-of-traceparent): higher-version
headers are parsed through the known prefix and unknown fields are not interpreted.

### Changed files

- `app/canonical/router.ts` — added media-range specificity/quality selection and opaque
  higher-version traceparent handling.
- `tests/canonical-http-boundary.spec.ts` — added regressions for `application/*`, specific
  `q=0` precedence, and a non-hex future extension while retaining all prior coverage.
- `.superpowers/sdd/task-1-report.md` — this re-review evidence section.

### TDD evidence

RED command before the production fix:

```text
pnpm exec mocha --no-config --require ts-node/register --extension ts tests/canonical-http-boundary.spec.ts --reporter dot --exit
```

Result: **10 passing, 3 failing**. The new `application/*` request returned a canonical 406,
the specific JSON `q=0` request returned successful JSON, and the opaque future extension was
dropped.

GREEN command after the production fix:

```text
pnpm exec mocha --no-config --require ts-node/register --extension ts tests/canonical-http-boundary.spec.ts --reporter dot --exit
```

Result: **13 passing**. Existing valid trace/tracestate and canonical error behavior remained
green. Only the repository's pre-existing Node/EventEmitter warning noise was emitted.

### Verification commands and outputs

- `pnpm run type-check` — PASS; `Type check passed!` (existing Node 20.x versus Node 24.17.0
  engine warning emitted).
- `pnpm run lint` — PASS; ESLint exited 0 (existing Node engine warning emitted).
- `git diff --check` — PASS before staging.

### Re-review self-review

- The Accept implementation selects the highest-specificity matching range, so exact JSON
  exclusions cannot be overridden by wildcard ranges; `application/*` remains a valid match.
- The trace parser validates only the known prefix and the required delimiter before an unknown
  suffix; it does not inspect future extension content and returns the original header unchanged.
- Lowercase known-field validation, nonzero IDs, reserved `ff` rejection, version `00` behavior,
  valid `tracestate`, RFC 9457 errors, malformed JSON, 404/405, 406, and 415 behavior remain
  covered by the focused suite.
- Only `app/canonical/router.ts`, `tests/canonical-http-boundary.spec.ts`, and this report were
  changed/staged for this re-review; legacy behavior and approved design docs were untouched.
- No new recommendations were identified.
