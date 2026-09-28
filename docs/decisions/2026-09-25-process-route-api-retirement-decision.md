# ProcessRoute API Retirement Decision

**Date:** 2026-09-25  
**Status:** USER-DIRECTED RETIREMENT — API SUNSET IN PROGRESS  
**Owner:** Product/API owner (user)

## App-usage evidence

The active app product-routing editor reads and writes `ModelPart.routingSteps`, a Stage/SubStage
template, and the Project flow uses versioned PartsList routes. The app has no active adapter or
route/component callsite for the separate `/catalog/process-routes` and `/catalog/route-stages`
resources. The separate API foundation has tests and provisional seed rows, but those do not
establish an active app consumer.

## Deprecation contract

| Operation | Existing contract retained through sunset |
|---|---|
| `POST /api/v1/catalog/process-routes` | `201`; `Idempotency-Key`; `catalog.manage`; parent Model check |
| `PATCH /api/v1/catalog/process-routes/{processRouteId}` | `200`; `If-Match`; `catalog.manage`; draft-only transition |
| `POST /api/v1/catalog/route-stages` | `201`; `Idempotency-Key`; `catalog.manage`; ProcessRoute ownership and stage-identity validation |
| `PATCH /api/v1/catalog/route-stages/{routeStageId}` | `200`; `If-Match`; `catalog.manage`; draft-only transition and parent route ownership |

- **Classification:** `TRANSITIONAL`.
- **Deprecation headers:** `Deprecation: true` and `Sunset: Fri, 01 Jan 2027 00:00:00 GMT` on
  requests under both resource paths.
- **OpenAPI:** All four operations are marked `deprecated: true` and name the sunset date.
- **Sunset:** 2027-01-01 00:00:00 UTC (more than 90 days after notice).
- **Exception:** none; v1.2.1 §7's minimum deprecation window is observed.

## Amendment: immediate removal under scoped §7 exception (2026-09-25)

Superseded by the user-approved §7 exception recorded in
`docs/decisions/2026-07-14-pats-api-design-decision-register.md` ("User-approved §7 exception:
immediate removal of sunset-gated surfaces"). No production deployment exists and the sibling
callsite audit verified zero active app API callers, so the ProcessRoute/RouteStage route family
is removed immediately instead of at the 2027-01-01 sunset. Persistence cleanup proceeds under
that exception's dev-only disposition; historical migrations remain immutable.

## Scope boundary

This retires only the distinct `ProcessRoute`/`ProcessRouteStage` resource family. It does **not**
retire operational `Stage`/`SubStage`, ModelPart `routingSteps`, PartsList/RoutingStep, StageEvent,
StationStep, or the app's Section → Process → Sub-process hierarchy. Those are separate active
surfaces and must not be collapsed based on shared words.

The Prisma models, seed fixtures, and process-route evidence enum values remain until sunset and a
database row/evidence preflight. No historical migration is modified. A follow-up migration must
explicitly disposition route rows and canonical evidence links before removing their tables/enums.

## Standard review evidence

- **Sections checked:** REST v1.2.1 §2, §3, §4, §5, §6, §7, §8, §9, §10, §11, and §12; endpoint
  checklist: contract identity, relationships, HTTP semantics, errors, security, concurrency,
  retries, data/observability, and documentation.
- **Resource/request/response:** Existing create and draft-patch resource shapes and status codes
  remain unchanged through sunset; routes are shallow catalog resources.
- **Problem/status behavior:** Existing RFC 9457 validation, not-found, conflict, and precondition
  behavior is unchanged.
- **Authorization/object checks:** `catalog.manage`; model/route/stage ownership checks unchanged.
- **Concurrency/retries:** Create retains `Idempotency-Key`; mutable draft records retain `If-Match`.
- **Tests/OpenAPI:** `tests/process-route-foundation.contract.spec.ts` checks the sunset headers on
  create paths; all operations are marked deprecated in generated OpenAPI. Focused tests pass.
- **Review condition:** Reopen only if the app adopts these resources or an independent consumer is
  identified before sunset.
