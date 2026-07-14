# Final Whole-Branch Review Fix Report: Gate 1 Common HTTP Contract

## Status

Completed on `develop`. This regression-repair wave fixes every finding from the final
whole-branch review without expanding the Gate 1 scope. Delivery was AI-agent implementation
using TDD.

## Findings fixed

1. Canonical errors cannot fall through to legacy envelopes. The canonical router now returns RFC
   9457 Problem Details for malformed JSON (`400 malformed-request`), oversized JSON (`413
   payload-too-large`), unsupported media/charset/encoding (`415 unsupported-media-type`), and
   unexpected canonical handler failures (`500 internal-error`). The internal response is fixed
   and contains no error message or stack.
2. `GET` and `HEAD /api/v1/health` both succeed as process-health reads. HEAD has no response
   body; unsupported methods return `Allow: GET, HEAD`.
3. OpenAPI common components now constrain `pageSize` to 100 and prohibit whitespace-only
   `Idempotency-Key` values while retaining the existing length limits.
4. Canonical responses remove `X-Powered-By`. Invalid `tracestate` is discarded, while valid
   trace context propagation remains intact.

## Scoped files changed

- `app/canonical/router.ts`
- `tests/canonical-http-boundary.spec.ts`
- `docs/openapi/2026-07-14-pats-api-v1-common-components.yaml`
- `tests/canonical-response-contract.spec.ts`
- `.superpowers/sdd/task-1-report.md`
- `.superpowers/sdd/task-3-report.md`
- `.superpowers/sdd/final-review-fix-report.md`

## TDD evidence

Regression tests were added before the production/OpenAPI changes.

| Phase | Command | Result |
|---|---|---|
| RED | `pnpm exec mocha --no-config --require ts-node/register --extension ts tests/canonical-http-boundary.spec.ts tests/canonical-response-contract.spec.ts --reporter dot --exit` | 17 passing, 9 failing. The failures showed the canonical-to-legacy error escape, missing HEAD/Allow/header/trace behavior, and absent OpenAPI constraints. |
| GREEN | Same focused command | 26 passing. |

## Validation outputs

| Command | Output |
|---|---|
| Focused canonical boundary/response contract tests | PASS — 26 passing |
| `pnpm run type-check` | PASS — `Type check passed!` |
| `pnpm run lint` | PASS — ESLint exited 0 |
| `pnpm test` | PASS — configured Mocha suite exited 0 |
| `git diff --check` | PASS — final scoped-diff verification |

## Endpoint review evidence

- Contract identity: PASS — existing `CANONICAL` `/api/v1/health` operational endpoint only; no
  public business endpoint was added.
- HTTP semantics: PASS — GET/HEAD process-health reads, empty HEAD body, accurate Allow, no
  successful error envelope.
- Errors: PASS — stable RFC 9457 types and `application/problem+json` cover the required 400,
  413, 415, and 500 boundaries without leaking exception detail.
- Security/tenancy: PASS — public health response remains limited to `{ "status": "healthy" }`;
  no tenant, dependency, topology, secret, or stack information is exposed.
- Data/observability: PASS — valid traceparent/tracestate remains propagated, invalid tracestate
  is not echoed, and `X-Powered-By` is removed only on canonical responses.
- Concurrency/retries: N/A — this repair adds no mutation or retryable operation. The shared
  OpenAPI idempotency schema now matches its nonblank-key runtime primitive.
- OpenAPI: PASS — source contract carries the runtime page-size and idempotency-key constraints.

## Self-review

- Preserved `/api/v1` isolation and all Task 2 primitives.
- Did not change legacy routing/composition, Prisma, migrations, generated artifacts, seeds,
  deployment, or frontend files.
- The health-handler injection is a router composition seam for deterministic test coverage, not a
  route or public business capability.
- Scoped tests assert normal and failure behavior, including no sensitive detail in internal
  errors.
- No new recommendations were identified.

## Remaining concerns

- The environment uses Node `v24.17.0` while the project declares Node `20.x`; pnpm emitted the
  existing engine warning during validation.
- The full inherited suite still emits known mocked activity/audit and optional Redis warnings but
  exits successfully. No new warning was introduced by this fix wave.

## Final re-review fix: W3C tracestate grammar

### Scope

This follow-up changes only `app/canonical/router.ts`,
`tests/canonical-http-boundary.spec.ts`, and this report.

### Fix

`tracestate` validation now follows the [W3C Trace Context §3.3.1 grammar](https://www.w3.org/TR/trace-context/#tracestate-header):

- simple keys begin with lowercase alpha and allow at most 255 permitted suffix characters;
- multi-tenant keys enforce the tenant-id and system-id start-character and length rules;
- values are 1–256 printable ASCII characters excluding comma and equals, with a final nonblank
  character;
- spaces/tabs surrounding a list member are ignored without trimming opaque value content;
- empty or whitespace-only list members are accepted; malformed members and duplicate keys discard
  the complete incoming `tracestate` header.

Valid `traceparent` propagation is unaffected when `tracestate` is discarded.

### TDD and validation

- RED: `pnpm exec mocha --no-config --require ts-node/register --extension ts
  tests/canonical-http-boundary.spec.ts --reporter dot --exit` — **18 passing, 5 failing**. The
  new failures covered empty value acceptance, duplicate keys, digit-start multi-tenant keys,
  surrounding OWS/leading opaque value content, and empty list members.
- GREEN: same focused command — **23 passing**.
- `pnpm run type-check` — PASS (`Type check passed!`).
- `pnpm run lint` — PASS.
- `pnpm test` — PASS (configured Mocha suite exited 0).

### Self-review

- No route, response, legacy composition, persistence, OpenAPI, or domain behavior changed.
- The parser uses only space and horizontal-tab as OWS, preserves the original valid header value
  when forwarding, and does not apply broad JavaScript whitespace trimming to opaque values.
- No new recommendations were identified. The existing Node 20.x engine warning and inherited
  full-suite mock/Redis warning noise remain non-blocking concerns.
