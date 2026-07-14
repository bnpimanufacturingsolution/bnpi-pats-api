# Principle: RESTful Endpoint Design Standards and Patterns

**Status:** Approved
**Version:** 1.2.1
**Owner:** Architecture Team

---

# 1. Statement of Principle

Our systems communicate through predictable, reliable, and secure RESTful interfaces. All HTTP-based APIs must adhere to standardized REST architectural conventions to ensure consistency, interoperability, maintainability, and backward compatibility.

REST endpoints should be intuitive to consume, easy to document, and resilient to future evolution without introducing unnecessary breaking changes.

---

# 2. Resource Design Standards

## 2.1 URL Structure & Naming Conventions

### Use Nouns, Not Verbs

Resource paths represent **resources**, while HTTP methods define the action.

❌ **Bad**

```text
POST /createUser
GET /getUsers
DELETE /deleteCustomer
```

✅ **Good**

```text
POST /users
GET /users
DELETE /users/{id}
```

---

### Use Plural Resource Names

Collections must always use plural nouns.

❌ **Bad**

```text
/customer/123/order/456
```

✅ **Good**

```text
/customers/123/orders/456
```

---

### Use Lowercase Kebab-Case

Resource names must use lowercase letters with hyphens separating multiple words.

❌ **Bad**

```text
/userProfiles
/user_profiles
```

✅ **Good**

```text
/user-profiles
```

---

### Resource Identifiers

Resource identifiers should:

- Be immutable.
- Uniquely identify a resource.
- Avoid exposing implementation details whenever possible.
- Prefer UUIDs, ULIDs, or other globally unique identifiers for distributed systems.

Example:

```text
/users/{id}
```

---

# 3. HTTP Method Semantics

Operations must map directly to standard HTTP semantics.

| Method | Purpose | Idempotent |
|---------|----------|------------|
| GET | Retrieve resource(s) | ✅ Yes |
| POST | Create new resource | ❌ No |
| PUT | Replace the entire resource representation | ✅ Yes |
| PATCH | Apply partial modifications | Should be, with documented exceptions |
| DELETE | Remove a resource (soft or hard delete) | ✅ Yes |

### PUT

PUT replaces the complete resource representation.

Any omitted writable fields are considered intentionally removed unless explicitly documented otherwise.

---

### PATCH

PATCH applies partial modifications.

**PATCH operations should be idempotent whenever practical.** Field-replacement style PATCH (`{"displayName": "Josh"}`) is inherently idempotent and is the default expectation.

Operations that intentionally introduce non-idempotent behavior — such as increment, append, or enqueue semantics — must be explicitly documented on a per-endpoint basis, including what happens on retry.

Example:

```http
PATCH /users/123

{
  "displayName": "Josh"
}
```

---

# 4. Resource Relationships

## 4.1 Shallow Nesting

Limit nested resources to **one level**.

✅ **Good**

```text
/users/{id}/orders
```

❌ **Avoid**

```text
/users/{id}/orders/{id}/items/{id}/reviews
```

Instead:

```text
/reviews?order_item_id=789
```

Flat resources are easier to maintain, cache, and evolve independently.

---

# 5. Collection Operations

Collection behavior must be expressed using query parameters rather than additional endpoint paths.

## Filtering

```text
GET /products?category=shoes&status=active
```

Where appropriate, standardized operators may be supported.

Examples:

```text
?price_gt=100
?price_lt=500
?created_before=2026-01-01
?created_after=2026-01-01
?search=laptop
```

### Query Parameter Naming Convention

**Query parameters use `snake_case`; JSON request and response bodies use `camelCase`.** These are deliberately different conventions, not an inconsistency:

- `snake_case` query parameters read more naturally for filter/comparison operators (`created_before`, `price_gt`) and align with common SQL-adjacent naming.
- `camelCase` JSON bodies align with JavaScript/TypeScript client and consumer expectations.

This split is intentional and should be applied consistently — do not mix `camelCase` query parameters into any endpoint.

---

## Sorting

Ascending:

```text
?sort=name
```

Descending:

```text
?sort=-created_at
```

---

## Pagination

Small datasets:

```text
?page=2&limit=50
```

Large or highly dynamic datasets:

```text
?starting_after=cursor
```

### Requirements

- All collection endpoints **must** enforce a maximum page size.
- Default pagination values should be documented.
- Cursor-based pagination is recommended for datasets with frequent inserts or updates.

### Pagination Response Envelope

All paginated collection responses **must** use a standardized envelope. Do not return a bare array.

**Offset/page-based pagination:**

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 2,
    "pageSize": 50,
    "totalItems": 248,
    "totalPages": 5
  }
}
```

**Cursor-based pagination:**

```json
{
  "data": [ ... ],
  "pagination": {
    "nextCursor": "eyJpZCI6MTIzfQ",
    "hasMore": true
  }
}
```

The `data` key is reserved exclusively for the collection payload. Do not substitute `items`, `results`, `rows`, or other aliases.

---

# 6. Response Standards

## Success Responses

Use standard HTTP success codes.

| Status | Meaning |
|----------|----------|
| 200 OK | Successful retrieval or update |
| 201 Created | Resource created |
| 202 Accepted | Processing asynchronously |
| 204 No Content | Successful request with no response body |

### Resource Creation

Successful `POST` requests should return:

- `201 Created`
- The created resource (where appropriate)
- A `Location` header pointing to the new resource

Example:

```http
HTTP/1.1 201 Created
Location: /api/v1/users/123
```

### Asynchronous Processing (202 Accepted)

When an operation returns `202 Accepted`, the response **must** include a way to check job status:

```http
HTTP/1.1 202 Accepted
Location: /api/v1/jobs/123
```

Clients poll the job resource until it reaches a terminal state:

```http
GET /api/v1/jobs/123

{
  "id": "123",
  "status": "processing",
  "createdAt": "2026-07-14T10:15:00Z"
}
```

Terminal states must include at minimum `completed` and `failed`. Failed jobs should include error details following the RFC 9457 conventions in Section 6.3.

Job status endpoints may return a `Retry-After` header to suggest polling cadence.

---

## Error Responses

Do **not** wrap failures inside successful (`200 OK`) responses.

Use standard HTTP status codes.

### Client Errors

- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `405 Method Not Allowed`
- `406 Not Acceptable`
- `409 Conflict`
- `410 Gone`
- `412 Precondition Failed`
- `415 Unsupported Media Type`
- `422 Unprocessable Content`
- `429 Too Many Requests`

### Server Errors

- `500 Internal Server Error`
- `502 Bad Gateway`
- `503 Service Unavailable`

### 404 vs. 410

- **404 Not Found** — the resource never existed, or its existence is intentionally hidden from the caller (including soft-deleted resources; clients should not be able to distinguish "never existed" from "soft-deleted" through the response).
- **410 Gone** — the resource previously existed at this identifier and was intentionally, permanently removed, and the API wants to communicate that explicitly (e.g. deprecated public endpoints, permanently retired records where signaling removal has value to the caller).

Default to `404` for soft-deleted resources unless there is a specific reason to signal permanent removal via `410`.

---

### RFC 9457 Problem Details

Validation and application errors must follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) ("Problem Details for HTTP APIs"), which obsoletes the earlier RFC 7807 of the same name. The JSON shape is unchanged between the two; only the RFC citation and its normative status have been updated. Any existing internal references to RFC 7807 should be treated as referring to RFC 9457.

```json
{
  "type": "https://example.com/problems/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "The request contains one or more invalid fields.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address."
    },
    {
      "field": "password",
      "message": "Must be at least 8 characters."
    }
  ]
}
```

The `errors` array is required whenever the failure involves more than one field or a field-specific validation issue. `instance` should identify the specific request path or resource involved.

---

# 7. API Versioning

All public APIs must be versioned from their initial release.

Preferred pattern:

```text
/api/v1/users
/api/v2/users
```

### Guidelines

- Breaking changes require a new major API version.
- Non-breaking enhancements should remain within the existing version.
- Versioning should be applied consistently across all public endpoints.

### Deprecation

Deprecated endpoints must signal deprecation via response headers:

```http
Deprecation: true
Sunset: Wed, 31 Dec 2026 00:00:00 GMT
```

**Public APIs must provide a minimum 90-day deprecation window before removal**, unless an emergency security issue requires immediate action. Deprecation notices should also be reflected in the OpenAPI specification and any published changelog.

---

# 8. Security & Resiliency

## Statelessness

Application servers must remain stateless.

Client state must be carried within requests using headers, tokens, or request payloads rather than server-side sessions.

---

## Transport Security

All endpoints must be served exclusively over HTTPS using TLS 1.3 or newer.

---

## Authentication

Protected endpoints must require authenticated requests using industry-standard mechanisms such as:

- JWT
- OAuth 2.0
- OpenID Connect

---

## Authorization

Authentication identifies the caller.

Authorization determines whether the caller is permitted to perform the requested operation.

Authorization checks must be enforced on every protected endpoint.

---

## Rate Limiting

Rate-limited endpoints should return:

```http
429 Too Many Requests
```

Along with:

```text
Retry-After
X-RateLimit-Limit
X-RateLimit-Remaining
```

---

# 9. Concurrency

Where concurrent updates are possible, APIs should support optimistic concurrency control using HTTP validators.

Example:

```http
If-Match: "etag-value"
```

A failed precondition should return `412 Precondition Failed`. This prevents clients from unintentionally overwriting newer versions of a resource.

---

# 10. Data Conventions

## JSON Naming

JSON property names should use **camelCase** consistently.

Example:

```json
{
  "firstName": "Josh",
  "createdAt": "2026-07-14T10:15:00Z"
}
```

Note: this differs deliberately from query parameter naming — see Section 5, "Query Parameter Naming Convention."

---

## Date & Time

Date/time values must use ISO 8601 in UTC.

Example:

```text
2026-07-14T10:15:00Z
```

---

## Content Negotiation

JSON APIs should use:

```http
Content-Type: application/json
Accept: application/json
```

Unless another media type is explicitly documented. Requests with an unsupported `Content-Type` should return `415 Unsupported Media Type`; requests with an unsatisfiable `Accept` header should return `406 Not Acceptable`.

---

# 11. Idempotency

Operations that create externally visible effects and may be retried (such as payment processing, order creation, or webhook handling) should support **Idempotency-Key** headers.

Example:

```http
POST /orders
Idempotency-Key: 2f7a3db0-88f4-4fd9-b1cf-4c5fd7f93b65
```

### Idempotency-Key Behavior

- **Same key, same payload** → the server must replay the original response (same status code and body) without reprocessing the operation.
- **Same key, different payload** → the server must reject the request with `409 Conflict`, since this indicates a client-side reuse error rather than a legitimate retry.
- Idempotency keys should be retained server-side for a bounded window (e.g. 24 hours) sufficient to cover realistic retry scenarios, after which they may expire.

Supporting idempotency keys helps prevent duplicate resource creation caused by retries or network failures.

---

# 12. Observability

Production APIs should support standardized observability headers for distributed tracing and debugging.

Recommended headers:

```http
traceparent
tracestate
```

per the [W3C Trace Context](https://www.w3.org/TR/trace-context/) specification, which is the standard expected by most modern tracing tooling.

`X-Request-ID` may additionally be included for human-friendly correlation in logs and support tooling, but should not replace `traceparent` for distributed tracing.

Correlation identifiers should be propagated across downstream services whenever possible.

---

# 13. Bulk Operations

Bulk endpoints are permitted for high-volume create/update/delete use cases. Where supported, they must define:

```text
POST /users/bulk
PATCH /users/bulk
DELETE /users/bulk
```

### Requirements

- **Maximum batch size** must be documented and enforced (reject oversized batches with `413 Payload Too Large` or `422 Unprocessable Content`).
- **Transactional behavior** must be explicit per endpoint: either the batch is fully transactional (all-or-nothing) or it processes items independently with partial failure allowed. Default to non-transactional unless documented otherwise.
- **Per-item errors** must be returned in the response body, keyed to the corresponding request item, following the RFC 9457-style error shape from Section 6.3 for each failed item.

Example partial-failure response:

```json
{
  "results": [
    { "id": "1", "status": "success" },
    { "id": "2", "status": "error", "error": { "title": "Validation Failed", "detail": "Invalid email." } }
  ]
}
```

---

# 14. Recommended Best Practices

The following practices are strongly encouraged for production-grade APIs:

- Publish an OpenAPI (Swagger) specification for every public API.
- Clearly document authentication requirements and authorization scopes.
- Use consistent request and response schemas across endpoints.
- Document rate limits, pagination defaults, and filtering capabilities.
- Deprecate endpoints with sufficient notice before removal (see Section 7).
- Prefer additive changes over breaking changes whenever possible.
- Keep resources coarse-grained and focused on business capabilities.
- Avoid exposing internal implementation details through URLs or payloads.
- Maintain backward compatibility within a major API version.
