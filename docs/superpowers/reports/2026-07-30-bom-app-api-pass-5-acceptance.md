# BOM App–API Vertical Slice — Pass 5 Acceptance

Status: COMPLETE WITH RELEASE BOUNDARIES  
Date: 2026-07-30  
Scope: Evidence-informed draft BOM reads, adapter integration, and focused model-detail UI.

## Senior decision

The BOM slice is accepted as a disposable DEV-ready vertical slice. The API remains authoritative;
the app does not infer missing quantities, normalize raw source strings, or represent demo data as
persisted BOM data.

## Delivered

- `GET /api/v1/catalog/bom-definitions?model_id=...` with bounded pagination and documented sort.
- `GET /api/v1/catalog/bom-definitions/{bomDefinitionId}` with ordered lines.
- `catalog.read` capability enforcement and `Cache-Control: no-store` on BOM reads.
- OpenAPI and generated endpoint/Postman artifacts for the read contract.
- Typed app adapter for BOM collection/detail reads and guarded create/patch methods.
- Model-detail BOM panel reached from the Product Pack flow.
- Draft revision/line creation and quantity correction with generated `Idempotency-Key`,
  `If-Match`, and authoritative refresh after mutation.
- Explicit handling for sparse quantities, source representation, evidence status, and provenance.

## Validation

- API focused BOM contract tests: passing.
- API full suite: 192 passing.
- API type-check and changed-source lint: passing.
- App BOM adapter and UI tests: 19 passing across the new/changed BOM surfaces.
- App full suite, isolated to one worker: 56 files / 283 tests passing.
- Docker image `bnpi-pats-bom-pass5-api:local`: built successfully from the Node 20 Alpine
  production image path.
- Disposable PostgreSQL target: seven PATS migrations applied; no pending migrations.
- Disposable container health: `GET /api/v1/health` returned 200.
- Browser preflight: `OPTIONS /api/v1/auth/login` returned 204 with the configured origin.
- Synthetic container smoke passed: authenticated Product → Model → ModelPart creation, BOM
  definition and sparse line creation, model-scoped collection, ordered detail, `If-Match`
  quantity correction, reload persistence, and `no-store` response header.

## Evidence and boundaries

- Container validation used the existing disposable `bnpi-pats-mvp-20260730` PostgreSQL/MinIO
  stack and synthetic account/data only.
- No client workbook, PDF, Drive artifact, production database, publication, migration cutover,
  or DM operation was used.
- Remote CI has not been observed because the local branches remain ahead of origin and no
  external push was authorized.
- No new recommendation beyond running the remote CI gate before release promotion.
