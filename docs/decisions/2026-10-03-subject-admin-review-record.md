# Subject Admin Review Record — 2026-10-03

Scope: admin user management for the Setup Users tab (`/:ws/setup/users`).
Endpoints: `GET /api/v1/subjects` (extended), `GET /api/v1/subjects/:subjectId`,
`POST /api/v1/subjects`, `PATCH /api/v1/subjects/:subjectId`. Classification: CANONICAL.
Normative standard: RESTful Endpoint Design Standards v1.2.1.

## Checklist (PASS unless noted)

- Contract identity: PASS — `/api/v1` prefix; plural kebab-case nouns; opaque UUID ids;
  no verbs in paths (password reset is a `PATCH` field, role change is a `PATCH` field).
- Relationships/collections: PASS — one-level nesting max (`/subjects/:id`, no deeper);
  `snake_case` query (`search`, `status`, `page`, `limit`); standard `data`+`pagination`
  envelope; max page 100, default 50 (shared `parseOffsetPagination`).
- HTTP semantics: PASS — GET read; POST create returns `201`+`Location`; PATCH is
  field-replacement and idempotent (same payload reapplied is a no-op write of equal values).
- Errors: PASS — RFC 9457 `application/problem+json` everywhere; `422` carries the field-level
  `errors` array; `404` for unknown ids (disabled subjects remain readable, no hard delete);
  `409` for duplicate username; `403` for non-admin and self-disable/self-demote. No `2xx` wrappers.
- Security/scope: PASS — JWT canonical identity; `identity.read` for reads,
  `operations.manage` (admin-only) for mutations; provider identifiers and password hashes never
  serialize; no Workspace tenancy fabricated (deployment-global directory, like pickers).
- Concurrency/retries: N/A with reason — `Subject` carries no row version and admin directory
  edits are last-write-wins (documented in OpenAPI); POST retries are safe via unique-username
  `409`; PATCH is idempotent by construction. No `Idempotency-Key` store.
- Data/observability: PASS — `camelCase` JSON, ISO-8601 UTC timestamps, JSON content types.
- Audit: PASS — `SUBJECT_CREATED`/`SUBJECT_UPDATED` via `recordCommandSuccess`
  (actor, time, resource, correlation id) plus outbox event.
- Documentation/verification: PASS — `docs/openapi/2026-07-31-pats-api-v1-domain-reads.yaml`
  and `-domain-writes.yaml` updated; `tests/subject-admin.spec.ts` (11 tests: success,
  validation, authz, not-found, self-guards, provider-safety, audit) and a directory-search
  test in `tests/canonical-domain-read.spec.ts`; full API suite 519 passing; headed
  `e2e/user-management.spec.ts` (app repo) passes against the live API.

## Exceptions

None. No standard section is excepted.
