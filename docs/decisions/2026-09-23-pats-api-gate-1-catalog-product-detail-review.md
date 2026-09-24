# Gate 1 Review Evidence — GET /api/v1/catalog/products/{productId}

**Date:** 2026-09-23
**Status:** REVIEWED — NO CODE CHANGE (read-only verification)
**Route in code:** `GET /api/v1/catalog/products/:productId` (`app/canonical/router.ts:609`, operationId `catalogProductGet`, handler `catalogController` in `app/pats/catalog.ts:122`, wired with `catalog.read` in `app/create-app.ts:104-107`)
**Transitional twin (not canonical):** `/api/pats/catalog/products/:productId` (`app/pats/catalog.router.ts:47`, `docs/api-pats-catalog-read-contract.md`) — workspace-scoped, legacy `{ success, data }` envelope. Classified TRANSITIONAL; this review covers the CANONICAL route.

## Standard sections reviewed (v1.2.1)

PASS, all with code evidence:

- §2 Resource design — plural kebab-case (`/catalog/products/{productId}`), opaque UUID `productId`, no verbs, no legacy `/api/product` shape.
- §3 Method semantics — GET retrieval only, idempotent; other methods → `405` via `router.all` (`router.ts:645`).
- §4 Relationships — single resource read; nested `models[].modelParts[]` is response expansion, not URL nesting.
- §5 Collections — N/A (single-resource read; no pagination/sort params).
- §6 Responses/errors — `200` JSON; failures as `application/problem+json` RFC 9457, never `2xx` errors.
- §7 Versioning — under `/api/v1`.
- §8 Security — bearer + `catalog.read` (`requireCanonicalCapability`); fail-closed; deployment-scoped, no client workspace trust on canonical route; `Cache-Control: no-store`.
- §9 Concurrency — N/A (read; no `If-Match`).
- §10 Data — `camelCase` JSON; ISO 8601 UTC timestamps; `routingSteps` normalized to `{ stageId, subStageId }`, bad rows dropped (`catalog.ts:282`); cycle map null-safe 1..86400 (`catalog.ts:294`).
- §11 Idempotency — N/A (GET defines no key).
- §12 Observability — correlation via `requestIdMiddleware`; storage errors logged server-side, never leaked.

## Resource and operational scope

Catalog bounded context, deployment-scoped, single server-resolved context. No `ProductionLine` scope (D-001/D-029 OPEN). PL-only: product identity + `Model{modelNumber unique/product, modelName null-allowed, sourceStatus, sourceReference, skuCode, imageUrl, pinned}` + `ModelPart{partCode unique/model, partName, routingSteps, plannedCycleTimes}`. No BOM/material/mold/paint fields.

## Request / response contract

Request: `GET /api/v1/catalog/products/{productId}`, bearer required, no query params.

`200` (`{ success: true, data: {...} }` — canonical handler keeps the transitional envelope):

```json
{ "success": true, "data": { "productId": "uuid", "productCode": "B251", "productName": "...", "lifecycleStatus": "DRAFT", "evidenceStatus": "NEEDS_CONFIRMATION", "rowVersion": 1, "createdAt": "...Z", "updatedAt": "...Z",
  "models": [{ "modelId": "uuid", "modelNumber": "01", "modelName": "Avocado Burger", "sourceStatus": "source-aligned", "sourceReference": {...} | null, "skuCode": "B251-01", "lifecycleStatus": "DRAFT", "evidenceStatus": "...", "rowVersion": 1, "imageUrl": "https://minio.../read-url" | null, "pinned": true, "updatedAt": "...Z",
    "modelParts": [{ "modelPartId": "uuid", "partCode": "B251-01-01", "partName": "...", "lifecycleStatus": "DRAFT", "evidenceStatus": "...", "rowVersion": 1, "routingSteps": [{ "stageId": "uuid", "subStageId": "uuid" | null }], "plannedCycleTimes": { "stageId::subStageId": 45 } | null }] }] } }
```

Sparse rules (tested): `models`/`modelParts` always arrays; `modelName`/`sourceReference` nullable (Model 05 `needs-confirmation` keeps `modelName: null`); missing MinIO object → `imageUrl: null`; private `imageObjectKey` stripped server-side (`catalog.ts:267`), never returned.

## Status codes and problem types

| Case | Code | `type` |
|---|---|---|
| Success | `200` | — |
| Missing/invalid bearer | `401` | auth boundary problem |
| Missing `catalog.read` | `403` | `urn:bandai:pats:problem:authorization-denied` |
| Unknown id | `404` | `urn:bandai:pats:problem:not-found` |
| Wrong method | `405` | `canonicalMethodNotAllowed` |
| Rate limited | `429` | rate-limit problem |
| MinIO failure (non-NotFound) | `503` | `urn:bandai:pats:problem:dependency-unavailable` |

No `400` for malformed id (opaque id passed straight to `findFirst`; unknown → `404`). No `410` (soft-delete hidden as `404` per §6).

## Authorization and object-level checks

Bearer identity + `catalog.read` enforced before handler. Deployment ownership = single context: Prisma `where: { id: productId }` with no tenant predicate (asserted in `canonical-catalog.spec.ts:51-53`). Private object keys never leave the server; read URLs are short-lived MinIO presigned URLs.

## Concurrency / retry / idempotency

Read-only: safe to retry, no validator, no key. `models` ordered by `modelNumber asc`; no pagination on this single read.

## Tests and OpenAPI validation

- `tests/canonical-catalog.spec.ts`: no-workspace-header read asserts `where: { id }` only + `productId/lifecycleStatus/evidenceStatus/rowVersion`; no-capability `403`.
- `tests/pats-catalog.contract.spec.ts` (transitional twin): complete record, sparse nulls + empty arrays, missing-image → null, storage-down `503` without leaking internals, `404` + bad-workspace `400`.
- Suite run 2026-09-23: **437 passing**.
- OpenAPI `router.ts:609-636` (200/401/403/404/429/503) matches handler. No drift. No schema or route change made.

## Unresolved questions / exception

- Exception: none.
- Known envelope wart (recorded, not changed): canonical detail returns `{ success: true, data }` while collection returns `{ data, pagination }`. Harmonizing would be a breaking change — deferred to a versioned-contract decision, not this review.
- Not blocking this read: D-005 ownership, D-014 image retention/orphan policy, D-030 revision lineage, Model 05 ECO.
