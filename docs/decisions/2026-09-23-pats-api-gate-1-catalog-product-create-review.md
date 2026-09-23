# Gate 1 Review Evidence — POST /api/v1/catalog/products

**Date:** 2026-09-23
**Status:** REVIEWED — NO CODE CHANGE (read-only verification)
**Route in code:** `POST /api/v1/catalog/products` (`app/pats/catalog-foundation.ts:398`, operationId `catalogProductCreate`, mounted with `catalog.manage` in `app/create-app.ts:120-128`)
**Classification:** CANONICAL.

## Standard sections reviewed (v1.2.1)

PASS, all with code evidence:

- §2 Resource design — plural kebab-case noun, no verbs, opaque UUID id returned, human `productCode` is attribute not identity.
- §3 Method semantics — POST creates; returns `201 Created` + `Location: /api/v1/catalog/products/{id}` + `ETag: "1"` (`catalog-foundation.ts:426-433`).
- §4 Relationships — top-level collection create; parent-less (no nesting). Child creates (`POST /models`, `/model-parts`) 404 when parent missing (tested).
- §5 Collections — N/A (single create; no pagination).
- §6 Responses/errors — `201` resource; failures as `application/problem+json` RFC 9457, never `2xx` errors.
- §7 Versioning — under `/api/v1`.
- §8 Security — bearer + `catalog.manage` required; `catalog.read` gets `403`; `x-workspace-id` ignored, not trusted (tested).
- §9 Concurrency — create returns `ETag "1"`; later `PATCH` requires `If-Match`, stale/missing → `412`; published product via draft API → `409`.
- §10 Data — `camelCase` JSON (`productCode`, `productName`, `evidenceStatus`, `sourceEvidenceIds`); UTC timestamps; zod `productCreateSchema` at transport boundary, separate from Prisma model.
- §11 Idempotency — `Idempotency-Key` parameter (OpenAPI `$ref`); same key + same payload replays stored `201` body without re-creating (tested, links stay 1); same key + different payload → `409` via `sendIdempotencyProblem`.
- §12 Observability — correlation via `requestIdMiddleware`; no secrets in body.

## Resource and operational scope

Catalog bounded context, deployment-scoped, single server-resolved context. Creates `DRAFT` product (`rowVersion: 1`) + `CanonicalEvidenceLink` rows for `sourceEvidenceIds`. PL-only: `productCode/productName/evidenceStatus`; no BOM/material/mold/paint fields accepted.

## Request / response contract

Request: `POST /api/v1/catalog/products`, headers `Authorization: Bearer …`, `Idempotency-Key: …`, body `{ productCode: "B243", productName: "...", evidenceStatus: "PROVISIONAL", sourceEvidenceIds: ["evidence-…"] }`.

`201` body: `{ id, productCode, productName, lifecycleStatus: "DRAFT", ..., provenance: { sourceEvidenceCount: N } }` + `Location` + `ETag`.

## Status codes and problem types

| Case | Code | `type` |
|---|---|---|
| Created (incl. idempotent replay) | `201` | — |
| Missing/invalid bearer | `401` | auth boundary problem |
| Missing `catalog.manage` | `403` | `urn:bandai:pats:problem:authorization-denied` |
| Duplicate product / idempotency payload conflict / published-edit via draft API | `409` | conflict problem |
| Invalid product or source evidence | `422` | validation problem (+ field `errors`) |
| `PATCH` without/mismatched `If-Match` | `412` | precondition problem |

OpenAPI create block documents 201/409/422; auth 401/403 enforced by the canonical gate. No `404` on this parent-less create.

## Authorization and object-level checks

`catalog.manage` enforced before router. No workspace-header trust. Evidence links scoped to caller-supplied verified `sourceEvidenceIds` (missing ids → `422`, not silent).

## Concurrency / retry / idempotency

Retry with same key + payload = safe replay. New key = new claim. `PATCH /products/{id}` guarded by `If-Match: "rowVersion"`; published rows rejected with `409`, never mutated through the draft API (tested).

## Tests and OpenAPI validation

- `tests/catalog-foundation.contract.spec.ts`: create + evidence links, replay equality, missing-parent `404` (models), `catalog.read` → `403` with workspace header ignored, `412` without `If-Match`, pin patch + ETag bump, published `409`. Cycle-time/model-part suites cover `422` bounds and route-step eligibility.
- Suite run 2026-09-23: **437 passing**.
- OpenAPI `catalog-foundation.ts:379-397` matches handler. No drift. No schema or route change made.

## Unresolved questions / exception

- Exception: none.
- Not blocking: D-005 ownership, D-030 revision lineage, D-033 Kuririn, Model 05 ECO.
