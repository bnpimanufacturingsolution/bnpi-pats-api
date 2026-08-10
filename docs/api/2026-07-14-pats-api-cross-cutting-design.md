# Bandai PATS API Cross-Cutting Design

**Status:** PROPOSED DESIGN

**Normative endpoint standard:** `docs/standards/restful-endpoint-design-standards.md`

## Authentication and authorization

- Authentication is provider-agnostic at the application boundary: a verified subject becomes a
  typed identity context.
- Authorization is evaluated for every protected endpoint, not only at route registration.
- Object-level checks verify that the requested resource belongs to the server-resolved deployment
  context and that the actor's capability can perform the operation.
- The identity provider decision (OIDC, on-prem directory, or local mode) is a design decision,
  not a reason to weaken authorization.
- The API must not trust client-selected workspace/tenant IDs, role claims, or resource IDs without
  server-side capability and ownership checks.

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
- Audit records capture deployment context, actor, action, resource, outcome, request correlation,
  and time.
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

## Lifecycle and invariant execution policy

The API exposes state transitions through domain commands, not arbitrary status-field updates.
Each command declares its owning context, allowed source states, target state, required actor
capability, concurrency validator, idempotency behavior, audit event, and outbox event. A request
that names a valid resource but an invalid transition returns a domain Problem Details response
with `409 Conflict` or `422 Unprocessable Content` according to whether the conflict is current
resource state or request/domain validation.

### Append-oriented records

Stage events, inventory transactions, process-change logs, audit records, and outbox messages are
not ordinary mutable CRUD resources. Their HTTP designs will expose creation and read/trace
operations; correction is a separate reviewed command that creates linked evidence. No endpoint
may silently rewrite an event timestamp, actor, route version, quantity, or expected-route
snapshot.

### Atomic command bundle

When a command produces operational evidence, the PostgreSQL transaction must include the source
record, any exception record, the audit record, the idempotency result, the outbox publication
intent, and any command-owned projection/checkpoint. The accepted StageEvent current-position
projection is command-owned and is updated in that transaction. Asynchronous report projection
checkpoints advance with their own projection-row transaction after the durable source/outbox
handoff. External delivery is retried after commit; a failed delivery must not roll back the
business record.

### State-machine test gate

Before implementation of a write endpoint, tests must cover every allowed transition, every
terminal-state rejection, deployment/object authorization, stale `If-Match`, same-key replay,
same-key/different-payload conflict, and correction evidence. Tests must prove that a projection
can be rebuilt from source records without using UI state.

### Unresolved lifecycle policy

The following remain explicit and block affected writes: Lot creation/cardinality (D-010),
rework/reversal/correction (D-009), quantity and variance semantics (D-021), asset retention
(D-014), audit/outbox retention (D-017), and actor identity mapping (D-025).

## Pass 5 API contract baseline

The following rules are `CONFIRMED_STANDARD` where they restate the approved REST standard and
`WORKING_DEFAULT` where the standard requires a project-specific value. They apply to every
canonical endpoint and must be copied into each future OpenAPI operation review.

### Contract identity and paths

- Canonical routes begin with `/api/v1`, including health, readiness, and version resources when
  they are exposed through HTTP. No canonical endpoint uses `/api/pats`, `/api/workspace`, or an
  unversioned operational path.
- Resource path segments are plural lowercase kebab-case nouns. HTTP methods carry the operation;
  verb paths such as `/scan`, `/advance`, `/receive`, `/resolve`, or `/upload` are prohibited.
- Resource identifiers are opaque and immutable. Business codes are queryable attributes, not
  path identity.
- First-release collections and members are top-level resources below `/api/v1`, with at most one
  relationship below a resource. `/api/v1/batches` and `/api/v1/batches/{batchId}` are valid; a
  third business-resource level is not. Cross-resource lookups use filters such as `batch_id` or
  `source_event_id`.
- The deployment context is resolved by server configuration and authenticated subject policy. No
  client-supplied workspace/tenant header or path selector is a canonical mechanism.
- The current proof route `/api/pats/catalog/products/{productId}` remains `TRANSITIONAL` evidence
  and is not an exception or implementation template.

### Query, JSON, and pagination

- Query parameters always use `snake_case`; JSON request/response properties always use `camelCase`.
- Collection filters are query parameters. `sort` accepts a documented comma-separated list of
  stable fields; a leading `-` means descending. The final sort key is always an immutable ID
  tie-breaker, even when not supplied by the caller.
- `page` and `limit` are `WORKING_DEFAULT` offset pagination values of `page=1`, `limit=50`, and
  maximum `limit=100` for bounded collections. High-churn events, inventory, audit, batches, and
  jobs use cursor pagination with a default/max page size of 50/100 and `starting_after` plus a
  signed opaque cursor. Each endpoint documents the choice and allowed filters.
- Every paginated collection returns exactly `{ "data": [...], "pagination": {...} }`. Offset
  pagination includes `page`, `pageSize`, `totalItems`, and `totalPages`; cursor pagination
  includes `nextCursor` and `hasMore`. A bare array is not a canonical response.
- Timestamps are ISO 8601 UTC. Nullability is explicit in the JSON schema; absent and `null` do
  not carry different meanings unless the resource documents that distinction.

### HTTP methods and success responses

- `GET` retrieves; `POST` creates or records a command; `PUT` replaces the complete representation;
  `PATCH` replaces named fields and is idempotent by default; `DELETE` retires/removes only when
  the resource lifecycle permits it.
- PUT documents whether omitted writable fields are removed; the default is intentional removal.
- Successful creation returns `201 Created`, the resource representation, and a `Location` header.
- Successful no-content mutation returns `204 No Content`.
- Long-running work returns `202 Accepted` with `Location: /api/v1/jobs/{jobId}`. The Job resource
  exposes `queued`, `processing`, `completed`, `failed`, and `cancelled` behavior; failed jobs
  include a stable problem reference and retry metadata.
- Errors never appear inside a successful `2xx` envelope.

### Problem Details and status policy

Errors use `Content-Type: application/problem+json` and RFC 9457 fields `type`, `title`, `status`,
`detail`, and `instance`. The PATS problem type registry is:

| Type | Default status | Use |
|---|---:|---|
| `urn:bandai:pats:problem:malformed-request` | 400 | Invalid syntax or parameter shape |
| `urn:bandai:pats:problem:authentication-required` | 401 | Missing/invalid authentication |
| `urn:bandai:pats:problem:authorization-denied` | 403 | Authenticated but not permitted |
| `urn:bandai:pats:problem:not-found` | 404 | Missing or intentionally hidden resource, including soft-deleted resource |
| `urn:bandai:pats:problem:method-not-allowed` | 405 | Unsupported method |
| `urn:bandai:pats:problem:not-acceptable` | 406 | Unsatisfiable `Accept` |
| `urn:bandai:pats:problem:conflict` | 409 | State/business conflict or idempotency-key payload mismatch |
| `urn:bandai:pats:problem:gone` | 410 | Intentional permanent removal where signalling is useful |
| `urn:bandai:pats:problem:precondition-failed` | 412 | Failed `If-Match` or other request precondition |
| `urn:bandai:pats:problem:payload-too-large` | 413 | File/bulk payload exceeds documented maximum |
| `urn:bandai:pats:problem:unsupported-media-type` | 415 | Unsupported request `Content-Type` |
| `urn:bandai:pats:problem:validation-error` | 422 | Valid syntax but invalid field/domain rule |
| `urn:bandai:pats:problem:rate-limit` | 429 | Rate limit exceeded |
| `urn:bandai:pats:problem:internal-error` | 500 | Unhandled server failure without secret leakage |
| `urn:bandai:pats:problem:dependency-unavailable` | 503 | Required dependency unavailable |

Field or multi-field validation errors include an `errors` array with `field` and `message`; the
request path or resource appears in `instance`. A 404 is the default for soft-deleted records;
410 is reserved for an explicit permanent-removal policy.

### Authentication, operational scope, and authorization

- Protected endpoints require a verified bearer token at the HTTP boundary. The identity provider
  and on-prem mode remain D-006; handlers receive a typed subject context rather than raw claims.
- Every protected request checks the verified subject, effective capability, deployment ownership,
  and object-level access in the application layer. A valid resource ID does not grant access.
- A resource outside the deployment context is not addressable. The endpoint's documented 404/403
  policy must not reveal unauthorized ownership details.
- The API does not trust role claims, client workspace/tenant selection, localStorage, display names,
  or frontend route guards. Security decisions are repeated server-side for each protected
  operation.

### Content negotiation, concurrency, retries, and observability

- Canonical JSON requests require `Content-Type: application/json`; callers request
  `Accept: application/json`. Unsupported content types return 415 and unsatisfiable accept
  headers return 406.
- GET responses for mutable resources expose a strong or documented version ETag. PATCH/PUT and
  lifecycle changes require `If-Match` when a lost update is possible; stale validators return
  412. Append-only create commands use idempotency rather than ETags for retry safety.
- Retryable externally visible POST commands accept `Idempotency-Key`. The same actor/deployment,
  operation family, key, and normalized payload replays the original status/body/headers. Same key
  with a different payload returns 409. The `WORKING_DEFAULT` retention window is 24 hours and
  remains configurable only through an accepted operational policy.
- The API accepts and propagates W3C `traceparent` and `tracestate` when valid and generates a
  correlation ID for logs. `X-Request-ID` may be returned for support correlation but never
  replaces `traceparent`.
- Rate-limited endpoints return 429, `Retry-After`, `X-RateLimit-Limit`, and
  `X-RateLimit-Remaining`. Limits are endpoint/deployment policy, not business logic.

### Deprecation and OpenAPI evidence

- OpenAPI 3.1 is the source contract. Generated Swagger/Postman output is derived and must not be
  edited as design truth.
- A deprecated canonical endpoint sends `Deprecation: true` and an RFC 1123 `Sunset` date, remains
  documented, and has a minimum 90-day window before removal unless an emergency security
  exception records owner, reason, scope, and review condition.
- Each OpenAPI operation records resource owner, operational scope, auth/capability, request/response
  schemas, query/pagination, status/problem types, ETag/If-Match, idempotency, audit/outbox side
  effects, operation ID, and test obligations.

## Endpoint review evidence template

Every endpoint catalog entry must answer the following with `PASS`, `FAIL`, or `N/A` plus evidence;
`FAIL` blocks implementation and `N/A` needs a reason:

1. Contract identity: classification, `/api/v1`, plural kebab-case resource, opaque ID, no verb.
2. Relationship/collection: one-level depth, snake_case filters, stable sort, pagination default/
   maximum, envelope, cursor choice.
3. HTTP semantics: method, PUT omission behavior, PATCH idempotency, 201/Location, 202/Job,
   no 2xx errors.
4. Errors: RFC 9457 media type, field errors, 404/410 choice, applicable 409/412/415/429/503.
5. Security: authentication, capability, deployment-context check, object-level check, sensitive-field
   redaction, content security.
6. Concurrency/retry: ETag/If-Match, 412, Idempotency-Key replay/conflict, duplicate handling.
7. Data/observability: camelCase JSON, snake_case query, UTC, trace propagation, audit actor/
   deployment-context/time/action/resource/outcome.
8. Documentation/verification: OpenAPI operation, contract tests, authorization tests,
   persistence/operational-scope integration tests, generated-doc check, exception record if any.

## Pass 7 on-prem operations and cross-cutting completion

This section translates the approved design direction and the on-prem readiness evidence into
operational boundaries. It does not accept a production topology, backup owner, retention period,
RPO, RTO, hardware profile, or identity deployment choice.

### Private assets and MinIO lifecycle

The API owns `Asset` metadata and authorization; private MinIO owns object bytes. The lifecycle is:

```text
requested -> upload-requested -> uploading -> verified -> available -> retired
                                      \-> quarantined
```

1. The caller creates asset metadata with an approved owner/link target and declares content type,
   size, and checksum. The API does not accept a caller-chosen public URL or durable object key as
   identity.
2. The API issues a short-lived, scope-limited upload request for the private bucket. The object
   key is server-generated and remains internal. Credentials never appear in API responses or logs.
3. Finalization verifies object existence, byte size, allowed content type, checksum, ownership,
   and association target. Only then does the asset become `available` and eligible for a short-
   lived read URL.
4. Missing bytes are a data-state result and may be represented as a null derived read URL where
   the contract says so. A MinIO outage is a dependency failure and returns `503`; it is not
   silently converted to a stale or public URL.
5. Quarantined objects are inaccessible through normal read URLs. Cleanup, retention, legal hold,
   orphan detection, and byte deletion require D-014/D-017 ownership decisions.
6. Asset links are typed relations. They cannot be used as Product, Model, Batch, or Part identity.

Required isolated checks include private-bucket policy, path traversal/object-key injection,
oversized payload, checksum mismatch, unsupported media, cross-context link, expired URL, missing
object, and MinIO outage behavior.

### Audit, outbox, and projection operations

- A domain command writes its source record, audit record, idempotency result, outbox message, and
  any command-owned projection/checkpoint in one PostgreSQL transaction. Asynchronous report
  projection rows and checkpoints commit together in the projection worker transaction after the
  source/outbox handoff.
- An `AuditRecord` contains the deployment context, stable actor reference, action, resource type/ID, outcome,
  request correlation, trace reference where available, and UTC time. Optional actor display data
  is a historical snapshot and never replaces stable identity (D-025).
- Audit is not a replacement for a StageEvent or InventoryTransaction. Domain records explain
  what happened operationally; audit explains who/when/through which request and whether it
  succeeded.
- Outbox delivery is at-least-once and bounded-retry. Consumers deduplicate by message ID and
  schema version. A failed publisher does not undo a committed source transaction; a dead-letter
  state creates an operational alert and requires an explicit replay decision.
- Projection jobs record source high-water mark, build version, and `projectedAt`. Read responses
  expose `projectedAt`/source version when freshness could affect a planner decision. Projection
  rebuilds run from source records and do not call the UI or mutate write-side state.

### Observability and failure behavior

| Dependency or condition | API behavior | Evidence/operational check |
|---|---|---|
| PostgreSQL unavailable or migration lock active | Readiness is `503`; writes do not return success; health may still report process alive | Kill/deny DB in an isolated environment and confirm no partial success |
| MinIO unavailable | Asset upload/finalization/read-URL operations return `503` with stable problem type; no public fallback | Stop private storage and verify metadata/byte consistency |
| Identity provider unavailable | Invalid token remains `401`; inability to verify a required external dependency is `503`; no fail-open access | Exercise provider timeout and deny-by-default behavior |
| Outbox publisher unavailable | Source command can succeed if its durable outbox row committed; delivery retry/dead-letter is visible | Force publisher failure and confirm audit/outbox/source atomicity |
| Redis absent/disabled | Core domain behavior remains available; no hidden Redis requirement | Run the base on-prem profile without Redis |
| Projection stale | Read response shows freshness/version; write authorization uses source-of-truth transaction, not stale projection | Delay/rebuild projection and verify command validation |
| Scanner/printer adapter unavailable | Adapter-specific command fails or is queued only if an accepted job contract exists; the API never claims physical success | Use adapter mocks/fault injection; no hardware assumption is encoded |

Structured logs are emitted to stdout with timestamp, level, service/version, operation ID,
correlation ID, trace ID, deployment-safe resource reference, outcome, latency, and dependency class.
Logs must redact bearer tokens, cookies, `Idempotency-Key` values unless hashed, private object
keys, credentials, raw external claims, and unbounded request bodies. Trace context is propagated
to database/MinIO/identity/outbox adapters where supported.

Health answers process liveness only. Readiness checks the dependencies required for the selected
runtime and reports a classed reason without secrets, SQL, object keys, or internal topology.

### Rate limiting and statelessness

The API remains stateless. Authentication, resource state, idempotency records, and explicit
validators carry client state. Rate limiting policy is applied at the edge and/or a shared store
appropriate to the deployed replica count; no endpoint assumes process-local memory is globally
authoritative. A limit response includes `429`, `Retry-After`, `X-RateLimit-Limit`, and
`X-RateLimit-Remaining`.

### PostgreSQL backup and restore boundary

The backup design requires a named owner, approved retention, encryption/key custody, RPO, RTO,
backup frequency, storage location, and restore rehearsal before production acceptance. These
values are not invented here (D-017/D-023).

The minimum backup set is:

- PostgreSQL data, migration/version metadata, and the backup manifest;
- MinIO object bytes plus the metadata needed to map private objects to API Assets;
- deployment/configuration contract and secret-recovery procedure, without committing secrets to
  Git;
- a checksum and version manifest proving which API/database/object-store versions were paired.

The restore runbook boundary is:

1. Declare an incident, stop or quiesce writes, and preserve the original evidence/backup.
2. Restore PostgreSQL to an isolated target and verify migration/schema compatibility.
3. Restore private MinIO bytes and metadata, then run Asset checksum/link consistency checks.
4. Restore the API image/configuration compatible with the database version; keep the service in
   readiness-failed mode until checks pass.
5. Rebuild projections and retryable outbox delivery from source state; do not regenerate source
   ledgers from dashboards.
6. Run smoke, contract, tenancy, audit, asset, and traceability checks before reopening writes.
7. Record the rehearsal result, gap, owner, and next review date.

### Migration, upgrade, rollback, and air-gapped delivery

- Schema changes use reviewed forward migrations. The expand/contract pattern is required when
  more than one image version may coexist; destructive changes require an explicit migration and
  rollback review and are outside this design approval.
- Application image rollback is safe only when the database remains backward-compatible with the
  prior image. No down-migration is assumed. A failed migration blocks readiness rather than
  silently starting a mixed-version runtime.
- The delivery artifact includes immutable API/web/dependency image tags, checksums, migration
  manifest, configuration contract, secret bootstrap instructions, backup/restore runbook, and
  offline verification commands. Runtime must not pull from a registry or call external SaaS.
- The operational sequence is validate artifact offline -> backup/restore checkpoint -> update
  development environment -> validate -> update UAT -> validate -> update production only after
  approval. The exact environment topology and promotion owner remain open.
- Docker Compose is the default runtime direction. Hyper-V/K3s/Argo CD artifacts may consume the
  same immutable images and contract values but must not introduce different domain semantics.
- Containers run non-root, expose TLS through the approved boundary, and separate health from
  readiness. Secrets are supplied by the approved on-prem bootstrap mechanism, never by source or
  generated docs.

### Test and release layers

Every implementation phase must pass the layers below before its endpoints are considered for
release:

| Layer | Proves | Required examples |
|---|---|---|
| Contract/OpenAPI | HTTP shape and standard compliance | Method/path, schema, status, Problem Details, pagination, headers, generated-doc diff |
| Domain | State transitions and invariants | Route eligibility, terminal states, quantity rules, correction evidence, idempotency normalization |
| Authorization | Identity, deployment context, object, capability enforcement | Resource ownership, missing capability, stale role/capability, hidden 404 |
| Persistence | Constraints and transaction atomicity | Foreign keys, unique route order, ETag conflict, source/audit/outbox atomicity, projection rebuild |
| Integration | PostgreSQL/MinIO/identity/adapter boundaries | MinIO private URL/checksum, provider timeout, outbox retry, DB outage, cursor stability |
| Operational | On-prem readiness and recovery behavior | Offline image verification, non-root runtime, health/readiness, backup restore rehearsal, migration compatibility |
| User journey/acceptance | Business workflow alignment | Planning release to execution, scan/route violation, receiving/issuance, trace/report freshness |

No application test is added during this documentation chain. The first implementation pass must
add meaningful tests for the endpoint it introduces and must not weaken existing tests.

## Pass 3 quantity and PMRS cross-cutting rules

PMRS-derived values are source observations or projections unless an accepted decision makes PATS
the owner of the requirement/issue ledger. The API must identify the source revision and freshness
when returning observed `issued`, `balance`, forecast, or calculated quantities. A mutable client
payload must never overwrite a ledger-derived balance.

Quantity-bearing contracts must identify the quantity state (planned, ordered, issued, accepted,
or derived), UOM, usage basis where applicable, precision, and rounding policy. Ratios and mixed
units are not converted merely to satisfy a numeric schema. If the system cannot safely convert a
source quantity, it preserves the source representation and returns an explicit validation or
domain problem rather than a fabricated piece count.

PMRS reference attachment/supersession is a mutable planning operation and uses object-level
authorization plus `If-Match` when concurrent updates are possible. Inventory/material issue
commands are append-oriented and use `Idempotency-Key`; a retry replays the original result and a
correction creates linked evidence. A source discrepancy such as the Asia 77,060/77,860 case is
recorded with both observations and remains a domain conflict until its owner resolves it.

## Decisive source-reconciliation and material-control behavior

Source conflicts are resolved at the controlled-revision boundary. A draft source revision is
validated, blocking issues are created, an authorized resolver selects/corrects the value, and a
new immutable approved revision is published. The original manual observation is never deleted or
silently overwritten.

The canonical rules are:

- `B248-02-08` is the accepted target Kuririn Body code; `B248-01-08ST` is an invalid source
  reference retained only in correction evidence.
- The latest approved Asia line quantities are authoritative; the total is `77,860`, issued is
  `77,060`, and derived balance is `800`. Header totals must equal the line sum.
- Planning owns PATS-scope material requirements. Inventory owns append-only issue evidence and
  derived balances. PMRS is a control projection/reference, not a mutable ledger.
- A missing tolerance means strict equality. An explicit tolerance is per requirement/operation;
  variance creates an auditable exception rather than being absorbed silently.
- All corrections, approvals, waivers, and material issues carry actor, reason, source/revision,
  correlation, audit, and outbox evidence in the owning transaction.

## Pass 3 schema-normalization execution invariants

The API and persistence boundary must implement the following rules together; a resource
description that omits one of them is incomplete:

### Source revision and reconciliation commands

- `POST /api/v1/source-revisions` creates a draft source revision with an idempotency boundary;
  it does not make the revision effective.
- Validation creates `SourceReconciliationIssue` evidence. A read may expose draft conflicts to
  an authorized caller, but a source revision approval or dependent plan/material release fails
  while a blocking issue remains open.
- `POST /api/v1/source-reconciliation-resolutions` records a selected value, resolver, reason,
  source path, and `If-Match` basis as append-only evidence. It creates/supersedes a revision;
  it never edits the original observed value. Same-key replay returns the original result and a
  different payload returns the standard `409 Conflict` problem.
- `POST /api/v1/source-revision-approvals` requires the accepted release capability and
  `If-Match`. It commits approval evidence, the source status transition, audit, idempotency
  result, and outbox intent atomically. Approval of unresolved or conflicting source evidence is
  a stable conflict/validation problem, not a successful response.

### Quantity and material commands

- Demand and material request/response schemas expose quantity state, magnitude, UOM, usage basis,
  precision, source representation, and source revision. They do not expose independently
  editable `issued` or `balance` fields.
- `PlanModelAllocation` responses identify their demand source version/freshness and are
  read-side summaries. Demand writes target `PlanDemandAllocation` dimensions.
- Material issue requests use the append-only `InventoryTransaction` contract and link an
  approved `MaterialRequirement` where required. The command validates source/target, compatible
  UOM/usage basis, requirement lifecycle, explicit tolerance policy, and idempotency in one
  transaction.
- The approved Asia target is represented by line-derived values `77,860` total, `77,060` issued,
  and `800` balance. The stale `77,060` header remains source evidence. An endpoint must never
  silently select the header over the line sum.

### Error, concurrency, and evidence behavior

- Stale source, requirement, PMRS-reference, or preference versions return `412` with the PATS
  precondition problem. Current state conflicts return `409`; valid syntax with a failed quantity,
  lineage, or release rule returns `422`. Field-specific failures include RFC 9457 `errors`.
- Trace headers are accepted/propagated and excluded from normalized idempotency payload hashes.
  Audit/outbox records carry correlation and trace references but never bearer tokens, raw claims,
  private object keys, or unbounded request bodies.
- Source corrections, approvals, requirement creation, issue evidence, audit, idempotency, and
  outbox intent share one PostgreSQL transaction. Derived balance/projection updates are either
  in that transaction when bounded and command-owned or occur asynchronously with freshness
  metadata; neither projection is authorization truth.

The source correction/effective-revision tasks remain controlled Gate 0 release conditions. The
target Kuririn and Asia values are decisive design behavior, but implementation must not bypass
the corrected approved revision boundary.

## Gate 2 identity implementation consistency (2026-07-15)

The first identity implementation follows the approved cross-cutting boundary:

- canonical self routes use an injected provider-neutral authenticator and a PostgreSQL-backed
  Subject/SubjectAssignment repository seam;
- `(provider, issuer, providerSubject)` resolves a stable internal Subject, while claims and
  provider identifiers remain outside authorization responses;
- authorization evaluates active, known capabilities and expands only the approved role-bundle
  policy; disabled subjects and inactive assignments fail closed;
- no client-supplied Workspace, membership, tenant, line, role, or capability selector is read by
  the canonical boundary;
- absent identity composition returns the canonical dependency-unavailable problem instead of
  falling back to legacy HS256/workspace behavior.

The runtime adapter/provider bootstrap remains deployment configuration. Until it is composed, the
self routes are intentionally unavailable while public canonical health remains available.

### Current D-006 target: local authentication and RBAC

The user has clarified that first release does not use SSO/OIDC. The runtime adapter therefore
authenticates PATS-local accounts and maps the stable local account to `Subject`; authorization is
RBAC through `SubjectAssignment` role bundles and direct approved capabilities. Credential/session
handling is separate from capability evaluation. No client-provided role, workspace, tenant, or
capability value is trusted.
