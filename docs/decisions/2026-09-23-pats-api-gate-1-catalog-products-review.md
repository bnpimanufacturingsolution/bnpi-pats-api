# Gate 1 Review Evidence — GET /api/v1/catalog/products

**Date:** 2026-09-23
**Status:** REVIEWED — NO CODE CHANGE (read-only verification)
**Route in code:** `GET /api/v1/catalog/products` (`app/canonical/router.ts:554`, operationId `catalogProductCollectionGet`, handler `catalogProductCollectionController` in `app/pats/catalog.ts:48`)
**Note:** `GET /api/v1/products` (no `catalog` prefix) appears only in the proposal doc `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md:42` and is not implemented. This review covers the real route. A rename would need its own exception + migration plan.

## Standard sections reviewed (v1.2.1)

PASS, all with code evidence:

- §2 Resource design — plural kebab-case nouns (`/catalog/products`), opaque UUID `productId`, no verbs, no legacy shape.
- §3 Method semantics — GET retrieval only, idempotent, no side effects.
- §4 Relationships — one level (`/catalog/products`); model/part detail via `GET /catalog/products/{productId}`, not deep nesting.
- §5 Collections — `snake_case` query (`page`, `limit`, `sort`), max `limit 100` default 50, stable sort + `id` tie-break, `{ data, pagination }` envelope, unknown params rejected before DB.
- §6 Responses/errors — `200` JSON summaries; failures as `application/problem+json` RFC 9457, never `2xx` errors.
- §7 Versioning — under `/api/v1`; no deprecation headers on this route.
- §8 Security — bearer + `catalog.read` via `requireCanonicalCapability`; fail-closed 401/403; no workspace-header trust; `Cache-Control: no-store`.
- §9 Concurrency — N/A (read; no ETag/`If-Match` needed).
- §10 Data — `camelCase` JSON (`productId`, `productCode`), ISO 8601 UTC timestamps.
- §11 Idempotency — N/A (GET defines no `Idempotency-Key`).
- §12 Observability — correlation via `requestIdMiddleware`; no secrets in body.

## Resource and operational scope

Catalog bounded context, deployment-scoped, single server-resolved operational context. No `ProductionLine` scope (D-001/D-029 still OPEN). PL-only: `productId/productCode/productName/lifecycleStatus/evidenceStatus/createdAt/updatedAt`. No BOM, material, mold, paint, or quantity fields.

## Request / response contract

Request: `GET /api/v1/catalog/products?page=1&limit=50&sort=-updated_at`
Sort fields: `product_code, product_name, created_at, updated_at` (`-` = desc).

`200` body:

```json
{
  "data": [{ "productId": "uuid", "productCode": "B251", "productName": "...", "lifecycleStatus": "DRAFT", "evidenceStatus": "NEEDS_CONFIRMATION", "createdAt": "2026-07-15T00:00:00Z", "updatedAt": "2026-07-16T00:00:00Z" }],
  "pagination": { "page": 2, "pageSize": 1, "totalItems": 3, "totalPages": 3 }
}
```

Summaries only. Full `Product -> Model -> ModelPart` comes from `GET /catalog/products/{productId}`.

## Status codes and problem types

| Case | Code | `type` |
|---|---|---|
| Success | `200` | — |
| Bad page/limit/sort or unknown param | `400` | `urn:bandai:pats:problem:malformed-request` |
| Missing/invalid bearer | `401` | auth boundary problem |
| Missing `catalog.read` | `403` | `urn:bandai:pats:problem:authorization-denied` |
| Rate limited | `429` | rate-limit problem |
| DB down | `503` | `urn:bandai:pats:problem:dependency-unavailable` |
| Wrong method (`POST/PATCH/DELETE` on this path) | `405` | `canonicalMethodNotAllowed` (`router.ts:649`) |

## Authorization and object-level checks

Bearer identity required; `catalog.read` capability enforced in `create-app.ts:108-111` + router gate. Deployment ownership = single context (no per-row tenant check needed; count/findMany unscoped by design). Does not trust client workspace/role claims. Prisma `select` allowlist exposes no storage keys or secrets.

## Concurrency / retry / idempotency

Read-only: safe to retry, no validator, no key. Stable pagination (`skip/take` + deterministic `orderBy` incl. `id` tie-break per spec test).

## Tests and OpenAPI validation

- Focused spec `tests/canonical-catalog-collection.spec.ts`: pagination+sort envelope, unknown-param `400`, no-capability `403`, read-only capability pass, DB-down `503`. Full suite run 2026-09-23: **437 passing**.
- OpenAPI block `app/canonical/router.ts:554-593` matches handler behavior (params `page/limit/sort`, responses 200/400/401/403/429/503). No drift found. No schema or route change made.

## Unresolved questions / exception

- Exception: none. No deviation from the standard.
- Not blocking this read: D-005 catalog ownership OPEN, D-030 revision lineage OPEN, Model 05 `needs-confirmation` (detail-read concern).
- Follow-up (separate review): `GET /catalog/products/{productId}` detail + transitional `/api/pats/catalog/products/:productId` workspace scoping.
