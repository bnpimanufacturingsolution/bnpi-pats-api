# Product Cleanup — Implementation Evidence (Gate 1)

**Date:** 2026-09-23
**Decision:** `docs/decisions/2026-09-23-product-cleanup-decision.md` (C-001–C-004, user-approved; C-002 revised mid-implementation with rationale recorded)
**Scope:** product catalog only. Floor, planning, BOM, `ProductSpecification` untouched.

## What changed

**API (`bnpi-pats-api`)**
- `prisma/pats/catalog.prisma`: `Model.skuCode` column removed.
- `prisma/pats/migrations/20260923000000_drop_model_skucode/migration.sql`: single `DROP COLUMN`; no backfill (nullable, never seeded).
- `app/pats/catalog-foundation.ts`: `skuCode`/`evidenceStatus` removed from all six zod schemas (`.strict()` → sent values get `422`); `deriveModelSkuCode(productCode, modelNumber)` exported; `toModelResource` derives it (product code threaded from parent lookup); `rowVersion`/`ETag`/`If-Match` machinery unchanged.
- `app/pats/catalog.ts`: collection drops `evidenceStatus` (select + output); detail derives `skuCode`, drops `evidenceStatus`, canonical envelope is now `{ data }` (transitional keeps `{ success, data }`).
- OpenAPI blocks unchanged in shape (params/responses still accurate); operationIds unchanged.

**App (`bnpi-pats-app`)**
- `services/pats-catalog-service.ts`: no `skuCode` sent on create; stripped from patches; `evidenceStatus` mappings removed; `skuCode: string` (derived) kept for display.
- `lib/product-catalog.ts`: `getModelSkuCode()` added; `models/add` derives demo-mode SKU from parent pack; action types drop `skuCode`.
- `routes/product-detail.tsx`: SKU edit removed → derived read-only. `components/organisms/product-catalog-manager.tsx`: SKU input removed → live derived preview.

## Verification

- API `tsc --noEmit`: clean. Full mocha suite: **437 passing** (post-change run).
- App `tsc --noEmit`: clean. ESLint on edited files: clean (after `--fix`). Vitest: service 7/7, lib 10/10, hooks 3/3, routes planning/pack 26/26, BOM panel + desk + adapter suites pass.
- Transitional `/api/pats/...` specs pass unchanged (derived `B251-01` equals previously stored value).

## Pending (needs dev-server restart / live DB)

- `prisma generate` for `generated/pats-client` (engine DLL locked by running node processes; stale client is type-compatible since no code references the dropped field).
- Applying migration `20260923000000` to live/dev databases.

## Resulting detail shape (`GET /api/v1/catalog/products/PRODUCT-B251`)

```json
{
  "data": {
    "productId": "PRODUCT-B251",
    "productCode": "B251",
    "productName": "Machibouke Hamburger Shop 3",
    "lifecycleStatus": "DRAFT",
    "rowVersion": 1,
    "createdAt": "2026-07-12T00:00:00.000Z",
    "updatedAt": "2026-07-12T00:00:00.000Z",
    "models": [{
      "modelId": "MODEL-B251-01",
      "productId": "PRODUCT-B251",
      "modelNumber": "01",
      "modelName": "Avocado Burger",
      "sourceStatus": "source-aligned",
      "sourceReference": { "workbookTitle": "PL B251 Machibouke Hamburger Shop 3 (Rev 6.0).xlsx", "revision": "Rev 6.0", "modelNamesByTab": {} },
      "skuCode": "B251-01",
      "lifecycleStatus": "DRAFT",
      "rowVersion": 1,
      "imageUrl": null,
      "pinned": true,
      "updatedAt": "2026-07-12T00:00:00.000Z",
      "modelParts": [{
        "modelPartId": "MODELPART-B251-01-01",
        "modelId": "MODEL-B251-01",
        "partCode": "B251-01-01",
        "partName": "Avocado Burger Upper Bun",
        "lifecycleStatus": "DRAFT",
        "rowVersion": 1,
        "routingSteps": [{ "stageId": "STAGE-INJ-UUID", "subStageId": null }],
        "plannedCycleTimes": { "STAGE-INJ-UUID::": 45 }
      }]
    }]
  }
}
```

No `evidenceStatus`, no stored `skuCode`, one envelope. `rowVersion` retained as the documented concurrency token (revised C-002).
