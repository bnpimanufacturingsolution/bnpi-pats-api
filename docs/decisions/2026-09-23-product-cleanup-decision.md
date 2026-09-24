# Product Cleanup Decision — Clean-Break Package (Gate 1)

**Date:** 2026-09-23
**Owner approval:** user (explicit "approved" 2026-09-23; breaking expected for cleanliness)
**Scope:** product catalog only (`Product`, `Model`, `ModelPart` contracts). Floor, planning, BOM, `ProductSpecification` explicitly out of scope and untouched.

## Decisions

### C-001 `Model.skuCode` becomes derived, column dropped

`skuCode` was stored while fully derivable as `` `${productCode}-${modelNumber}` `` (seed already derives it at `bnpi-pats-app/app/lib/product-catalog.ts:410`; runtime seed `scripts/pats-seed.mjs` never writes the column). A stored copy goes stale on `productCode` rename with no cascade. Migration `20260923000000_drop_model_skucode` drops `Model.skuCode`; serializers derive it; create/patch schemas reject it (`422`, `.strict()`). `ProductSpecification.skuCode` (planning) is untouched.

### C-002 `rowVersion` stays in bodies as the documented concurrency token (revised during implementation)

First attempt removed it from JSON, keeping only the `ETag` header — reverted the same session: the app's guarded-write flow chains versions body-to-body (load → PATCH → PATCH), and `GET` responses carry a single aggregate representation that cannot express per-row validators in headers. `rowVersion` remains in product/model/part bodies **documented as the concurrency token mirroring `ETag`** (the K8s-`resourceVersion` pattern), `If-Match` enforcement unchanged. What leaves the contract is `evidenceStatus`, not the token. Alternative (per-resource version endpoints) rejected as new surface for zero gain.

### C-003 `evidenceStatus` leaves product contracts; columns stay

`evidenceStatus` input/output removed from product/model/part schemas and serializers (server defaults `NEEDS_CONFIRMATION` internally; `sourceEvidenceIds` link mechanism unchanged). DB columns retained as internal audit defaults — no destructive evidence-column drop in this change. `bom-foundation`/`bom.ts` evidence handling untouched.

### C-004 One envelope: detail adopts `{ data }`

`GET /api/v1/catalog/products/{productId}` returns `{ data: {...} }`, matching the collection's `{ data, pagination }` family. The legacy `{ success, data }` wrapper is removed (breaking; frontend compensated in the same change). Transitional `/api/pats/...` route keeps its envelope until its own retirement review.

## Impacts

- Breaking for `bnpi-pats-app` catalog service, types, and SKU edit UI — compensated in the same change.
- Migration is single `DROP COLUMN` on nullable, never-seeded column; additive-first history untouched (new file, pinned historical migration unchanged).
- Rollback: re-add nullable column + revert serializers (no data loss: values re-derivable).
- Review condition: full suite green + OpenAPI match before merge.
