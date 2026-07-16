# RESTful Endpoint Design Review Checklist

Use this checklist for every new endpoint, endpoint change, endpoint review, OpenAPI entry, or
legacy-route migration. The full normative wording is in
[`restful-endpoint-design-standards.md`](restful-endpoint-design-standards.md).

Record `PASS`, `FAIL`, or `N/A` with evidence for every section. A `FAIL` blocks normal
implementation. `N/A` requires a short reason.

## Contract identity

- [ ] The endpoint is classified as `CANONICAL`, `TRANSITIONAL`, or `LEGACY`.
- [ ] The route starts with `/api/v1`.
- [ ] The path uses plural lowercase kebab-case nouns.
- [ ] Identifiers are immutable, opaque, and globally unique.
- [ ] No verbs are embedded in the resource path.

## Relationships and collections

- [ ] Resource nesting is no deeper than one level.
- [ ] Collection filtering uses `snake_case` query parameters.
- [ ] Sorting uses the documented `sort` convention.
- [ ] Maximum page size and default pagination are enforced and documented.
- [ ] Paginated responses use exactly `data` and `pagination`.
- [ ] Large or highly dynamic collections use cursor pagination where appropriate.

## HTTP semantics

- [ ] GET, POST, PUT, PATCH, and DELETE semantics match the standard.
- [ ] PUT replacement behavior defines omitted writable fields.
- [ ] PATCH behavior is field-replacement and idempotent unless explicitly documented otherwise.
- [ ] Creation returns `201 Created` and a `Location` header.
- [ ] Asynchronous work returns `202 Accepted` and a job resource with terminal states.
- [ ] No error is wrapped in a successful `2xx` response.

## Errors

- [ ] Status codes use the standard HTTP meanings.
- [ ] Errors use `application/problem+json` and RFC 9457 fields.
- [ ] Validation errors include the required field-level `errors` array.
- [ ] `404` versus `410` behavior is explicitly chosen.
- [ ] Conflict, precondition, unsupported media type, rate limit, and service-unavailable cases
  are defined where applicable.

## Security and operational scope

- [ ] Authentication requirements are documented.
- [ ] Object-level authorization is enforced for every protected resource.
- [ ] Server-resolved operational scope is explicit and tested; `ProductionLine` scope is included
  only if D-001/D-029 has accepted it.
- [ ] HTTPS/TLS requirements and content types are documented.
- [ ] Rate limiting and required response headers are defined where needed.
- [ ] Sensitive fields, internal IDs, storage keys, and implementation details are not leaked.

## Concurrency and retries

- [ ] Concurrent mutation behavior is defined.
- [ ] ETag/If-Match and `412 Precondition Failed` are used where required.
- [ ] Retryable externally visible POST operations define `Idempotency-Key` behavior.
- [ ] Same-key/same-payload replay and same-key/different-payload conflict are tested.

## Data and observability

- [ ] JSON fields use `camelCase`.
- [ ] Query parameters use `snake_case`.
- [ ] Timestamps are ISO 8601 UTC.
- [ ] Content negotiation and unsupported media behavior are documented.
- [ ] `traceparent` propagation and optional human-readable request correlation are defined.
- [ ] Audit requirements identify actor, operational context, time, action, and affected resource.

## Documentation and verification

- [ ] OpenAPI is updated from the approved contract.
- [ ] Request, response, status, auth, pagination, and error schemas are documented.
- [ ] Focused contract tests cover success, validation, authorization, not-found, conflict, and
  retry behavior applicable to the endpoint.
- [ ] Integration tests cover persistence and operational-context/line boundaries where applicable.
- [ ] Generated documentation matches the reviewed OpenAPI contract.
- [ ] Any exception is recorded with owner, reason, and expiry/review condition.
