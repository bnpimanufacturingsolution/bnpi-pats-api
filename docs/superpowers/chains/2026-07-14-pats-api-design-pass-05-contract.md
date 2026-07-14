# Pass 5: API Contract Standards

## Depends On

Pass 4 lifecycle and invariant design.

## Objective

Translate the approved REST standard into PATS-wide API contract rules and reusable review
requirements.

## Scope

- Touch only: `docs/api/2026-07-14-pats-api-cross-cutting-design.md`,
  `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`, and the Pass 5 report.
- Do not touch: endpoint implementation, OpenAPI generated artifacts, schemas, routes, or app
  files.

## Instructions

1. Apply the mandatory standard to `/api/v1` versioning, plural kebab-case nouns, shallow nesting,
   query naming, JSON naming, methods, pagination, responses, and errors.
2. Define common authentication, authorization, tenancy, rate-limit, trace, content-negotiation,
   ETag, `If-Match`, `Idempotency-Key`, and deprecation rules.
3. Define async job behavior and standard Problem Details types.
4. Add the endpoint-review evidence required for every future endpoint.

## Deliverable

A single consistent API contract policy that future endpoint designers can apply without guessing.

## Self-Check Gate

- [ ] Every rule maps to the approved internal standard.
- [ ] Error behavior never uses successful status codes for failures.
- [ ] Collection pagination, filtering, and sorting are deterministic.
- [ ] Retry and concurrency behavior is explicit.
- [ ] The provisional catalog proof route is not promoted automatically.

## Stop Conditions

Agent stops if:

- a proposed route requires a verb path without an approved exception;
- a success envelope conflicts with the pagination or error standard;
- tenant authorization cannot be expressed independently of frontend state.
