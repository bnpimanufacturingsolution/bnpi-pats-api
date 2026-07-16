# Principle: RESTful Endpoint Design Standards

**Status:** ACTIVE

**Adopted:** 2026-07-14

**Normative version:** 1.2.1

**Canonical standard:** [`docs/standards/restful-endpoint-design-standards.md`](../standards/restful-endpoint-design-standards.md)

## Principle

Every Bandai PATS HTTP endpoint must conform to the repository-owned RESTful Endpoint Design
Standards before it is designed, implemented, reviewed, documented, or handed over.

The standard governs resource naming, HTTP method semantics, relationship depth, collection
queries, pagination, responses, errors, API versioning, deprecation, security, concurrency,
idempotency, data conventions, content negotiation, observability, and bulk operations.

## Enforcement

The full standard is the source of truth. This principle does not replace or weaken it. Agents
must read the standard and complete the endpoint review checklist for every endpoint. A route
that exists in legacy code, generated documentation, a seed, or a frontend prototype is not
exempt from review.

An endpoint that does not conform must not be implemented as a normal endpoint. It requires an
explicit, case-specific exception that records:

- the exact standard section being excepted;
- why conformance is not possible or appropriate;
- the affected endpoint and consumers;
- the owner who approved the exception;
- the expiry date or review condition;
- the migration or removal plan, if transitional.

## PATS-specific application

- PATS public routes start at `/api/v1`.
- Resource paths use plural lowercase kebab-case nouns.
- Relationships remain shallow; collection filters use `snake_case` query parameters.
- JSON request and response fields use `camelCase`.
- Paginated collections use the standard `data` and `pagination` envelope.
- Errors use RFC 9457 Problem Details and are never represented as successful responses.
- Server-resolved operational context and object-level authorization are explicit endpoint
  concerns. A `ProductionLine` scope is tested only when D-001/D-029 accepts it; no endpoint may
  fabricate Workspace tenancy.
- Commands that may be retried use the standard idempotency behavior.
- Mutable resources use HTTP validators where concurrent updates are possible.
- OpenAPI is the contract source and must match the endpoint behavior.

## Legacy boundary

Existing legacy endpoints may remain available for compatibility, but their existence does not
make their patterns canonical. New PATS endpoints must follow this principle. Legacy routes
being retained or migrated must be classified as `LEGACY`, `TRANSITIONAL`, or `CANONICAL` in the
endpoint catalog.
