# PATS Common HTTP Contract Implementation Plan

This plan executes Gate 1 of the approved PATS API design package. It is limited to shared
transport infrastructure and platform health behavior. It must not implement business-domain
identity, persistence, catalog, planning, execution, inventory, asset, or job writes while the
open decision register remains unresolved.

## Binding requirements

- Canonical public routes start with `/api/v1`.
- Canonical JSON responses use `application/json`; errors use RFC 9457 Problem Details with
  `application/problem+json` and stable PATS problem type identifiers.
- Unsupported `Accept` returns `406 Not Acceptable`; unsupported request media types return
  `415 Unsupported Media Type`; malformed JSON returns `400 Bad Request`; unsupported methods
  return `405 Method Not Allowed`.
- Canonical requests propagate valid W3C `traceparent` and optional `tracestate` and continue to
  expose `X-Request-ID` for human-readable correlation.
- Existing legacy `/`, `/health`, `/api`, and compatibility behavior remains unchanged.
- No generated artifact, Prisma schema, migration, seed, deployment file, or frontend file may
  be changed by these tasks.

### Task 1: Canonical HTTP boundary and platform health

Add a separately mounted canonical HTTP boundary that owns `/api/v1` negotiation, canonical
problem responses, trace/request context handling, method handling, and a public GET endpoint at
`/api/v1/health`. The endpoint must not expose dependency, tenant, secret,
or topology details. Canonical unmatched routes return Problem Details and must not fall through
to legacy envelopes or legacy authentication.

Use the existing `createApp` composition without changing the legacy route registrations. Add
focused Supertest coverage for successful health, accepted JSON negotiation, unacceptable media,
canonical 404/405 responses, malformed JSON, stable problem fields/media type, request
correlation, and trace context propagation.

### Task 2: Shared collection, precondition, and idempotency primitives

Add focused, independently testable transport helpers for the approved offset/cursor pagination
envelopes and limits, strong ETag/`If-Match` evaluation returning `412`, and an injectable
Idempotency-Key store/handler contract that supports same-key replay and same-key/different-payload
`409` conflict. A process-local store may exist only as an explicitly test-only adapter; production
composition must require an injected durable adapter and must not assume process memory is
authoritative across replicas.

Use snake_case query parsing and camelCase pagination JSON. Add unit/contract tests for defaults,
maximum limits, invalid combinations, exact envelopes, stale validators, replay, and conflict.

### Task 3: Rate-limit/deprecation headers and OpenAPI common components

Add reusable response header helpers for `429` (`Retry-After`, `X-RateLimit-Limit`,
`X-RateLimit-Remaining`) and deprecation (`Deprecation`, `Sunset`) without changing legacy policy
unless the canonical boundary opts in. Add the reviewed OpenAPI 3.1 common component source for
Problem Details, pagination, ETag/precondition, trace/correlation, and idempotency headers. Do not
generate checked-in runtime artifacts.
