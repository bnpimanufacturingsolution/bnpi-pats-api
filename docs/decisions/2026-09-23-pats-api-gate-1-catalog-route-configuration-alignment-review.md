# Gate 1 Review Evidence — Catalog Route-Configuration Alignment

**Date:** 2026-09-23
**Status:** REVIEWED — CODE CHANGE (compatible response addition + deterministic ordering + demo/UAT seed lifecycle)
**Trigger:** Product detail UI could not configure manufacturing routes: every save on seeded B251 rows failed `409` (seeded `PUBLISHED`, writes are DRAFT-only), the `200` write response omitted `routingSteps` so saves rendered as no-ops, and part order was nondeterministic across reads.

## Changes (all CANONICAL, under `/api/v1`)

1. `PATCH`/`POST /api/v1/catalog/model-parts` responses now echo `routingSteps`
   (normalized to the GET `{ stageId, subStageId }` shape via `wireRouteSteps`)
   (`app/pats/catalog-foundation.ts`, `toModelPartResource`). Additive only: no
   field removed or renamed, no status-code change, no schema change (`ModelPart`
   carries no `updatedAt` by schema design, so none is echoed).
2. `GET /api/v1/catalog/products/{productId}` orders `modelParts` by
   `createdAt asc, id asc` (`app/pats/catalog.ts`). Order-only change; models keep
   `modelNumber asc`.
3. Demo/UAT seed (`scripts/pats-seed.mjs`, `SEED_MODE=demo|uat` only) writes B251
   catalog product/model/modelPart rows as `DRAFT` instead of `PUBLISHED`, so the
   reviewed DRAFT-only write contract can configure routes on seeded data. BOM
   definitions, process-route revisions, stages, and all other domains keep their
   seed state. The seed never runs in production (`SEED_MODE=none` default).

## Standard sections reviewed (v1.2.1)

PASS, all with code evidence:

- §2 Resource design — no path, noun, or identifier change. Still plural kebab-case (`model-parts`), opaque UUIDs, no verbs.
- §3 Method semantics — unchanged. POST still `201` + `Location` + `ETag "1"`; PATCH still field-replacement partial, idempotent, `200` + bumped `ETag`.
- §4 Relationships — unchanged (flat, no URL nesting).
- §5 Collections — N/A (single-resource writes; detail read has no pagination).
- §6 Responses/errors — `201/200` resources; failures still `application/problem+json` RFC 9457. Envelopes unchanged (`{ data }` canonical detail, bare resource on writes).
- §7 Versioning — under `/api/v1`, no version bump (compatible addition).
- §8 Security — bearer + `catalog.manage` (writes) / `catalog.read` (detail) unchanged; fail-closed; deployment-scoped, no new trust.
- §9 Concurrency — unchanged. Every PATCH still requires `If-Match: "rowVersion"`; stale → `412`; non-DRAFT → `409` (`publishedResource` untouched). `rowVersion` still increments per write.
- §10 Data — new fields are `camelCase` (`routingSteps`, `updatedAt`); `updatedAt` is ISO 8601 UTC; `routingSteps` uses the same normalization as the GET projection (unknown rows dropped, `subStageId` coerced to `null`).
- §11 Idempotency — unchanged. POST still requires `Idempotency-Key`; PATCH needs none.
- §12 Observability — unchanged (request-id correlation; no secrets in bodies).

## Resource and operational scope

Catalog bounded context, deployment-scoped, single server-resolved context. No `ProductionLine` scope. No schema change (Prisma models untouched). No new endpoints.

## Request / response contract (delta)

- `POST /catalog/model-parts` → `201` body now includes `routingSteps: []`.
- `PATCH /catalog/model-parts/{id}` → `200` body now includes the stored `routingSteps` array. Clients render the save without a re-GET.
- `GET /catalog/products/{productId}` → `models[].modelParts[]` in stable `createdAt, id` order.

## Status codes and problem types

No change: `200/201/401/403/404/409/412/422/429/503` exactly as recorded in
`2026-09-23-pats-api-gate-1-catalog-writes-part2-review.md` and
`2026-09-23-pats-api-gate-1-catalog-product-detail-review.md`.

## Authorization and object-level checks

Unchanged: `catalog.manage` before all five write handlers; `catalog.read` before detail; deployment ownership = single context.

## Concurrency / retry / idempotency

Unchanged: retry same version + payload = same result; stale version → `412`, re-read and retry. The echoed `routingSteps`/`updatedAt` make the re-read after `412` cheaper but the contract is identical.

## Tests and OpenAPI validation

- `tests/catalog-foundation.contract.spec.ts`: "saves route steps that name catalog stages" now asserts the `200` body echoes the exact steps.
- `tests/pats-seed-contract.spec.ts`: new case locks the B251 catalog region to `DRAFT` while BOM/process-route seeds stay `PUBLISHED`.
- `@openapi` descriptions for `catalogModelPartCreate` / `catalogModelPartPatch` document the echoed representation. A trial `generate-openapi`/`export-openapi` run confirms the regenerated spec carries exactly these two description changes — but the run also surfaces ~1600 lines of pre-existing annotation drift in unrelated domains, so the generated files are deliberately left untouched here and regen stays a release-pass item (plus the network-dependent Postman export).
- Suite + type-check + lint recorded 2026-09-23: `npx tsc --noEmit` clean;
  full mocha suite **443 passing, 0 failing** (covers the extended route-step
  echo assertion and the new seed-DRAFT case); `eslint` clean on both touched
  `app/` files (spec files are outside the lint scope by config).

## Unresolved questions / exception

- Exception: none (compatible addition + seed-profile data change; no standard section excepted).
- Not blocking: publish/retire transitions (still a future Gate 1 item); process-route (`/catalog/process-routes`) vs per-part `routingSteps` surface split (app adopts per-part steps; process-route integration stays future work); re-seed wipes configured `routingSteps` on the update path (pre-existing seed semantics, unchanged).
