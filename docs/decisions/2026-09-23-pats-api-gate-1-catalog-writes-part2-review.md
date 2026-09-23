# Gate 1 Review Evidence — Catalog Writes Part 2 (PATCH product, POST/PATCH models, POST/PATCH model-parts)

**Date:** 2026-09-23
**Status:** REVIEWED — NO CODE CHANGE (read-only verification)
**Routes in code** (`app/pats/catalog-foundation.ts`, mounted with `catalog.manage` in `app/create-app.ts:120-128`):

- `PATCH /api/v1/catalog/products/{productId}` — handler `:623`, OpenAPI under POST block pattern (`catalogProductPatch`)
- `POST /api/v1/catalog/models` — handler `:466`, OpenAPI `:447` (`catalogModelCreate`)
- `PATCH /api/v1/catalog/models/{modelId}` — handler `:675`, OpenAPI `:654` (`catalogModelPatch`)
- `POST /api/v1/catalog/model-parts` — handler `:544`, OpenAPI `:525` (`catalogModelPartCreate`)
- `PATCH /api/v1/catalog/model-parts/{modelPartId}` — handler `:727`, OpenAPI `:706` (`catalogModelPartPatch`)

**Classification:** all CANONICAL.

## Standard sections reviewed (v1.2.1)

PASS, all with code evidence:

- §2 Resource design — plural kebab-case nouns, opaque UUID path ids, no verbs.
- §3 Method semantics — POST creates (`201` + `Location` + `ETag "1"`); PATCH is field-replacement partial (only supplied keys written, `... === undefined ? {} : ...`), idempotent; `200` + bumped `ETag`.
- §4 Relationships — shallow: model create takes `productId` in body, part create takes `modelId`; missing parent → `404 not-found` (tested for models).
- §5 Collections — N/A (single-resource writes).
- §6 Responses/errors — `201/200` resources; failures as `application/problem+json` RFC 9457, never `2xx` errors.
- §7 Versioning — under `/api/v1`.
- §8 Security — bearer + `catalog.manage` on all five; fail-closed.
- §9 Concurrency — every PATCH requires `If-Match: "rowVersion"` (`requireIfMatch`); missing/stale → `412 precondition-failed`; published/retired → `409 conflict` (`publishedResource`, tested). Last-writer-wins only within a matched version.
- §10 Data — `camelCase` JSON; zod schemas at boundary (`productPatchSchema`, `modelPatchSchema`, `modelPartPatchSchema`), separate from Prisma; UTC timestamps; CT map coerced null-safe 1..86400 (`ctMapOrNull :861`).
- §11 Idempotency — POST creates take `Idempotency-Key` (same key + same payload replays; different payload → `409`). PATCH is idempotent by field-replacement, no key needed.
- §12 Observability — correlation via `requestIdMiddleware`; no secrets in bodies.

## Resource and operational scope

Catalog context, deployment-scoped, single server-resolved context. All writes are DRAFT-only: any non-DRAFT row is rejected `409` and never mutated through this API. PL-only fields: product (`productCode/productName/evidenceStatus`), model (`modelNumber/modelName/skuCode/pinned/evidenceStatus`), part (`partCode/partName/plannedCycleTimes/routingSteps/evidenceStatus`). No BOM/material/mold/paint fields. Part route steps validated against catalog (`assertRouteStepsExist :877`): unknown stage → `422`; sub-stage not eligible under stage → `422` (both tested). CT `null` clears to honest absence (tested).

## Request / response contract (summary)

- `POST /models { productId, modelNumber, modelName?, skuCode?, sourceEvidenceIds? }` → `201` + `Location /models/{id}` + `ETag "1"`; missing product → `404`.
- `PATCH /models/{id} + If-Match { modelNumber?, modelName?, skuCode?, pinned?, evidenceStatus? }` → `200` + bumped `ETag` (pin flow tested).
- `POST /model-parts { modelId, partCode, partName, plannedCycleTimes?, sourceEvidenceIds? }` → `201`; CT omitted → `null`; bad CT (0/negative/fraction/string/>86400) → `422` (tested).
- `PATCH /model-parts/{id} + If-Match { partCode?, partName?, plannedCycleTimes? (null clears), routingSteps?, evidenceStatus? }` → `200`.
- `PATCH /products/{id} + If-Match { productCode?, productName?, evidenceStatus? }` → `200`; published → `409` (tested).

## Status codes and problem types

| Case | Code | `type` |
|---|---|---|
| Created / updated | `201` / `200` | — |
| Missing/invalid bearer | `401` | auth boundary problem |
| Missing `catalog.manage` | `403` | `authorization-denied` |
| Unknown id / missing parent | `404` | `not-found` |
| Duplicate / idempotency conflict / published-edit | `409` | `conflict` |
| Missing/stale `If-Match` | `412` | `precondition-failed` |
| Invalid body, CT, evidence, unknown/ineligible stage | `422` | `validation-error` (+ field `errors`) |

## Authorization and object-level checks

`catalog.manage` before all five handlers. Deployment ownership = single context. Evidence links only from verified ids. No workspace-header trust.

## Concurrency / retry / idempotency

POST: retry same key + payload = safe replay. PATCH: retry same version + payload = same result; stale version → `412`, re-read and retry.

## Tests and OpenAPI validation

- `tests/catalog-foundation.contract.spec.ts`: pin patch + ETag bump, published `409`, CT create/null/patch/clear/reject (5 bad values), route-step save + unknown/ineligible `422`, model-missing-parent `404`, `catalog.read` → `403`, `412` without `If-Match`, create replay equality.
- Suite run 2026-09-23: **437 passing** (covers this spec: 12/12).
- OpenAPI blocks (`:379`, `:447`, `:525`, `:602`-style patch, `:654`, `:706`) match handlers. No drift. No schema or route change made.

## Unresolved questions / exception

- Exception: none.
- Not blocking: D-005 ownership, D-030 revision lineage, publish/retire transitions (no `POST .../publish` endpoint exists yet — future Gate 1 item).
