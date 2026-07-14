# Bandai PATS API Contract and Endpoint Catalog

**Status:** PROPOSED INVENTORY; no endpoint in this document is approved for implementation until
the design chain completes.

**Normative standard:** `docs/standards/restful-endpoint-design-standards.md`

## Canonical route rules

- Public routes begin with `/api/v1`.
- Resource names are plural, lowercase, and kebab-case.
- Nested resources are limited to one level.
- Collection operations use query parameters, not verb-like subpaths.
- Query parameters use `snake_case`; JSON uses `camelCase`.
- Tenant scope is explicit and authorization is checked against the resolved resource.
- A route is not canonical merely because it exists in current code or generated docs.

## Proposed resource families

The following are design families, not implementation commitments.

### Identity and tenancy

```text
GET    /api/v1/me
GET    /api/v1/workspaces
GET    /api/v1/workspaces/{workspaceId}
GET    /api/v1/workspaces/{workspaceId}/members
POST   /api/v1/workspaces/{workspaceId}/members
PATCH  /api/v1/workspaces/{workspaceId}/members/{membershipId}
DELETE /api/v1/workspaces/{workspaceId}/members/{membershipId}
```

### Catalog and configuration

```text
GET    /api/v1/workspaces/{workspaceId}/products
POST   /api/v1/workspaces/{workspaceId}/products
GET    /api/v1/workspaces/{workspaceId}/products/{productId}
PATCH  /api/v1/workspaces/{workspaceId}/products/{productId}
DELETE /api/v1/workspaces/{workspaceId}/products/{productId}
GET    /api/v1/workspaces/{workspaceId}/models?product_id={productId}
GET    /api/v1/workspaces/{workspaceId}/model-parts?model_id={modelId}
GET    /api/v1/workspaces/{workspaceId}/workflow-groups
GET    /api/v1/workspaces/{workspaceId}/stages
GET    /api/v1/workspaces/{workspaceId}/sub-stages
GET    /api/v1/workspaces/{workspaceId}/stations
GET    /api/v1/workspaces/{workspaceId}/work-instructions
```

### Planning

```text
GET    /api/v1/workspaces/{workspaceId}/production-plans
POST   /api/v1/workspaces/{workspaceId}/production-plans
GET    /api/v1/workspaces/{workspaceId}/production-plans/{planId}
PATCH  /api/v1/workspaces/{workspaceId}/production-plans/{planId}
GET    /api/v1/workspaces/{workspaceId}/parts-list-versions?plan_id={planId}
POST   /api/v1/workspaces/{workspaceId}/parts-list-versions
GET    /api/v1/workspaces/{workspaceId}/lots?production_plan_id={planId}
POST   /api/v1/workspaces/{workspaceId}/lots
```

### Execution and inventory

```text
GET    /api/v1/workspaces/{workspaceId}/batches
POST   /api/v1/workspaces/{workspaceId}/batches
GET    /api/v1/workspaces/{workspaceId}/batches/{batchId}
PATCH  /api/v1/workspaces/{workspaceId}/batches/{batchId}
GET    /api/v1/workspaces/{workspaceId}/stage-events?batch_id={batchId}
POST   /api/v1/workspaces/{workspaceId}/stage-events
GET    /api/v1/workspaces/{workspaceId}/inventory-transactions
POST   /api/v1/workspaces/{workspaceId}/inventory-transactions
GET    /api/v1/workspaces/{workspaceId}/routing-violations
PATCH  /api/v1/workspaces/{workspaceId}/routing-violations/{violationId}
```

Stage events and inventory transactions are resources. Do not create verb paths such as
`/batches/{id}/scan`, `/batches/{id}/advance`, or `/inventory/receive` unless a documented
exception is approved.

### Traceability and reporting

```text
GET /api/v1/workspaces/{workspaceId}/traceability
GET /api/v1/workspaces/{workspaceId}/reports
GET /api/v1/workspaces/{workspaceId}/audit-records
```

These are read-side resources. They must identify their freshness and source projection where
eventual consistency is possible.

### Assets and jobs

```text
POST /api/v1/assets
GET  /api/v1/assets/{assetId}
POST /api/v1/assets/{assetId}/upload-requests
GET  /api/v1/jobs/{jobId}
```

The upload-request relationship is one level. Private object keys are never public API identity.
Long-running import/export/backup actions return `202 Accepted`, a `Location` job resource, and
terminal job states.

### Platform

```text
GET /health
GET /ready
GET /version
```

Platform endpoints have a separate operational policy and must not expose business data.

## Common response policy

- Single-resource success responses return the resource representation directly unless the
  endpoint documents a specific representation.
- Paginated collections use `{ data, pagination }` only.
- Creation returns `201 Created`, the resource, and `Location`.
- Successful no-content operations return `204 No Content`.
- Errors use `application/problem+json` and RFC 9457.
- Every endpoint documents `401`, `403`, `404`, `409`, `412`, `422`, `429`, `500`, and `503` cases
  that can occur for its operation.

## Required endpoint metadata

Every catalog entry must include:

- lifecycle classification: `CANONICAL`, `TRANSITIONAL`, or `LEGACY`;
- owner bounded context;
- resource and tenancy scope;
- method and idempotency behavior;
- request and response schemas;
- query parameters and pagination mode;
- authorization policy and object-level checks;
- concurrency validator behavior;
- problem types and status codes;
- audit and outbox behavior;
- OpenAPI operation identifier;
- focused and integration test requirements;
- unresolved decisions or approved exceptions.

## Provisional compatibility route

`GET /api/pats/catalog/products/{productId}` from the earlier stack proof is transitional evidence
only. It is not the design template. Before implementation, it must either be replaced by the
canonical versioned route or receive an explicit transitional exception and migration plan.
