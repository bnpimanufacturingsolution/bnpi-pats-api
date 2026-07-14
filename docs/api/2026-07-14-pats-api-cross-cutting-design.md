# Bandai PATS API Cross-Cutting Design

**Status:** PROPOSED DESIGN

**Normative endpoint standard:** `docs/standards/restful-endpoint-design-standards.md`

## Authentication and authorization

- Authentication is provider-agnostic at the application boundary: a verified subject becomes a
  typed identity context.
- Authorization is evaluated for every protected endpoint, not only at route registration.
- Object-level checks verify that the requested resource belongs to the authorized workspace/line
  and that the actor's role can perform the operation.
- The identity provider decision (OIDC, on-prem directory, or local mode) is a design decision,
  not a reason to weaken authorization.
- The API must not trust workspace IDs, role claims, or resource IDs supplied by the client without
  server-side membership and ownership checks.

## Validation and errors

- Validate path, query, header, and JSON body inputs at the transport boundary.
- Keep validation schemas separate from Prisma models.
- Return RFC 9457 Problem Details with stable problem `type` identifiers.
- Use `422 Unprocessable Content` for syntactically valid requests that violate domain rules;
  use `400 Bad Request` for malformed request syntax or invalid parameter shape.
- Validation errors include field-level `errors` entries.
- Never return `200` with an error flag or a successful envelope containing failure details.

## Pagination and query behavior

- Use `snake_case` query parameters and `camelCase` JSON fields.
- Enforce maximum limits server-side.
- Use stable sort keys and deterministic tie-breakers.
- Prefer cursor pagination for high-churn event, inventory, audit, and batch collections.
- Use page pagination only where totals are useful and bounded.
- Every collection contract documents filters, sort fields, defaults, maximums, and pagination.

## Concurrency and idempotency

- Mutable configuration and planning resources expose ETags and require `If-Match` when lost
  updates are possible.
- A failed validator returns `412 Precondition Failed`.
- Stage event, inventory transaction, batch creation, import, and other externally visible
  commands define `Idempotency-Key` behavior.
- Same key and same normalized payload replays the original response.
- Same key with a different payload returns `409 Conflict`.
- Idempotency records are retained for a bounded, documented window and scoped to the actor and
  operation family.

## Files and MinIO

- The API owns asset metadata; MinIO owns object bytes.
- Buckets remain private.
- API clients receive short-lived presigned URLs, never credentials or durable private keys.
- Uploads validate content type, size, checksum, and ownership before association.
- Asset references are not used as model or product identity.
- Asset deletion and retention need a domain decision before implementation.

## Events, audit, and projections

- Domain records and append-only operational ledgers are written transactionally.
- Audit records capture tenant, actor, action, resource, outcome, request correlation, and time.
- The outbox is written in the same transaction as the source mutation.
- Projections may be rebuilt from source records and expose freshness when relevant.
- Reports do not become write-side sources of truth.

## Observability and resiliency

- Propagate W3C `traceparent` and optionally `tracestate`.
- Add a human-readable request correlation identifier without replacing `traceparent`.
- Log structured events without secrets, credentials, tokens, or private object keys.
- Define timeouts and retry behavior per external dependency.
- Rate-limited endpoints return `429`, `Retry-After`, and the documented rate-limit headers.
- Health and readiness endpoints distinguish process health from dependency readiness.

## Async jobs

- Long-running imports, exports, asset processing, and operational jobs return `202 Accepted`.
- The response includes `Location: /api/v1/jobs/{jobId}`.
- Jobs expose at least `processing`, `completed`, and `failed` terminal behavior.
- Failed jobs expose RFC 9457-compatible error details.
- Job retry policy and ownership are explicit.

## Compatibility and migration

- New public endpoints are versioned from the start.
- Legacy routes are classified and isolated from canonical PATS modules.
- Breaking changes require a new major API version.
- Deprecation uses `Deprecation` and `Sunset` headers, OpenAPI metadata, and a minimum 90-day
  window unless an emergency security exception is approved.
- Data migrations must be additive/backward-compatible across the deployment transition where
  rollback is required.

## Verification requirements

Each implemented endpoint needs contract tests, authorization tests, validation/error tests, and
integration coverage appropriate to its persistence and side effects. The endpoint review
checklist is a release gate, not a documentation suggestion.
