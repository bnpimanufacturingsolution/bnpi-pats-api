# Pass 6: Endpoint Catalog and Authorization Matrix

## Depends On

Pass 5 API contract standards.

## Objective

Produce the complete proposed endpoint inventory and authorization matrix for each bounded
context, without implementing routes.

## Scope

- Touch only: `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`,
  `docs/decisions/2026-07-14-pats-api-design-decision-register.md`, and the Pass 6 report.
- Do not touch: source code, generated OpenAPI, Prisma schemas, migrations, seeds, or frontend
  files.

## Instructions

1. Inventory resources for identity, tenancy, catalog, planning, execution, inventory,
   exceptions, traceability, assets, jobs, reports, and platform operations.
2. For every endpoint record owner, method, resource path, one-level relationship, tenant scope,
   authorization policy, request/response, pagination, status codes, problem types, ETag,
   idempotency, audit, outbox, and operation identifier.
3. Classify each endpoint as `CANONICAL`, `TRANSITIONAL`, or `LEGACY`.
4. Review the catalog against the endpoint-design checklist and record every gap or exception.

## Deliverable

A complete endpoint catalog and authorization matrix that can be converted into OpenAPI after
design approval.

## Self-Check Gate

- [ ] No path contains a verb or exceeds one relationship level.
- [ ] Query/body naming follows the mandatory split.
- [ ] Every protected resource has object-level authorization.
- [ ] Every write has concurrency/retry behavior where applicable.
- [ ] Every endpoint has standard response and error behavior.
- [ ] No endpoint is approved solely because the app or legacy API already calls it.

## Stop Conditions

Agent stops if:

- an endpoint has no clear bounded-context owner;
- authorization depends on an unresolved role model;
- a write endpoint would encode an unresolved domain decision.
