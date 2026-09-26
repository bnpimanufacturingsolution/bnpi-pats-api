# BOM App/API Retirement Decision

**Date:** 2026-09-25  
**Status:** USER-DIRECTED RETIREMENT — API SUNSET IN PROGRESS  
**Owner:** Product/API owner (user)

## Decision and evidence

The active `bnpi-pats-app` Product detail route does not render the BOM panel. The BOM panel,
adapter methods, DTOs, and dedicated tests have been removed from the app. API-side BOM routes,
Prisma models, migrations, and provisional seed rows were still present and active before this
decision. The route implementation is therefore being retired through the required public API
deprecation window rather than removed immediately.

The user directed removal because the current app does not use the feature. The app-side removal
does not claim that no other API consumer exists.

## API deprecation boundary

- **Affected resources:** `GET /api/v1/catalog/bom-definitions`,
  `GET /api/v1/catalog/bom-definitions/{bomDefinitionId}`,
  `POST /api/v1/catalog/bom-definitions`, `PATCH /api/v1/catalog/bom-definitions/{bomDefinitionId}`,
  `POST /api/v1/catalog/bom-lines`, and `PATCH /api/v1/catalog/bom-lines/{bomLineId}`.
- **Classification:** `TRANSITIONAL` until sunset.
- **Deprecation date:** 2026-09-25.
- **Sunset date:** 2027-01-01 00:00:00 UTC. This exceeds the REST standard's 90-day minimum.
- **Runtime behavior during transition:** Existing request/response, authentication, capability,
  object checks, validation, concurrency, and idempotency behavior remain available. Responses carry
  `Deprecation: true` and `Sunset: Fri, 01 Jan 2027 00:00:00 GMT`.
- **OpenAPI/changelog:** Every operation is marked deprecated and names the sunset date. This record
  is the retirement notice and the app WWG report records the UI removal.
- **Exception:** None. Immediate removal is not approved.

## Amendment: immediate removal under scoped §7 exception (2026-09-25)

Superseded by the user-approved §7 exception recorded in
`docs/decisions/2026-07-14-pats-api-design-decision-register.md` ("User-approved §7 exception:
immediate removal of sunset-gated surfaces"). No production deployment exists and the sibling
callsite audit verified zero active app API callers, so the BOM route family is removed
immediately instead of at the 2027-01-01 sunset. Persistence cleanup proceeds under that
exception's dev-only disposition; historical migrations remain immutable.

## Persistence cleanup gate

Do not remove `BomDefinition`, `BomLine`, their `Model`/`ModelPart` relations, `BomRelationshipKind`,
or BOM evidence subject enum values until the sunset has elapsed and migration preflight has
identified existing BOM rows/evidence links. Export/backup and explicit disposition of those rows is
required before a destructive migration. Stop treating provisional seed rows as production truth.

After sunset, remove the routes, OpenAPI operations, app/API DTO and test remnants, seed generation,
Prisma models/relations/enums, and tables in a reviewed migration. Keep migration history immutable;
do not edit historical migration files.

## Endpoint-standard review evidence

- **Sections checked:** REST standard v1.2.1 §2 (resource identity), §3 (HTTP semantics), §4
  (shallow resource relationships), §5 (collection filtering/pagination), §6 (success and RFC 9457
  errors), §7 (versioning/deprecation), §8 (authorization), §9 (concurrency), §10 (JSON), §11
  (idempotency), §12 (observability); checklist sections Contract Identity, Relationships and
  Collections, HTTP Semantics, Errors, Security and Operational Scope, Concurrency and Retries,
  Data and Observability, Documentation and Verification.
- **Request/response and status behavior:** unchanged during the transition; existing `200`/`201`,
  `404`, `409`, `412`, and `422` behavior remains. No route shape is changed.
- **Authorization/object checks:** unchanged (`catalog.read` for reads, `catalog.manage` for writes;
  definition/model-part object ownership checks remain).
- **Retry/concurrency:** unchanged; creates retain `Idempotency-Key`; mutable draft resources retain
  `If-Match`.
- **OpenAPI:** source operations marked deprecated with sunset date; generated artifacts must be
  regenerated and checked against runtime behavior.
- **Tests:** focused read and create contracts assert deprecation/sunset headers; existing BOM
  functional tests remain until endpoint sunset.
- **Unresolved:** Any independently deployed BOM consumer must migrate or obtain a separately
  documented exception before the sunset. No exception is currently approved.
