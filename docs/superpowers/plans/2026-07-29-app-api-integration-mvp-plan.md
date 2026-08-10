# App–API Integration MVP Implementation Plan

Status: PLANNED / NOT IMPLEMENTED
Date: 2026-07-29
Scope: first App–API Product Catalog vertical slice
Companion chain: docs/superpowers/chains/2026-07-29-app-api-integration-mvp-chain.md

## Goal

Expose the current PATS catalog foundation to the frontend through a reviewable canonical API contract and integrate the app's Product Catalog in an explicit API mode.

The slice covers Product, Model, and ModelPart draft reads and writes. It does not cover BOM, process routes, Planning, execution, inventory, Drive, source publication, data migration, production deployment, or cutover.

## Existing implementation to preserve

- Canonical catalog detail read: GET /api/v1/catalog/products/{productId}.
- Draft writes: POST/PATCH for products, models, and model-parts under the current catalog foundation.
- Server-resolved deployment context and catalog.read/catalog.manage capability checks.
- RFC 9457 Problem Details, ETags/If-Match, Idempotency-Key handling, and OpenAPI generation.
- Existing SourceRun/intake boundary as evidence intake only.
- Existing legacy routes as compatibility material, not canonical PATS behavior.

## Contract gap that blocks implementation

The historical design catalog contains a proposed /api/v1/products family, while the implemented foundation and current app adapter use /api/v1/catalog/products.

Pass 1 must record the accepted route family. The working implementation default is to extend /api/v1/catalog/products because it is the live canonical foundation closure surface already consumed by the app adapter. If the team accepts /api/v1/products instead, the change must include an explicit compatibility and migration plan; a second silent route family is prohibited.

## Planned API work

### 1. Product collection read

Add the collection operation in the accepted catalog namespace.

Minimum contract:

- Authenticated bearer request.
- catalog.read capability.
- Server-resolved deployment scope; no client-selected workspace or tenant header.
- Bounded offset pagination, default page 1 and limit 50, maximum limit 100 unless Pass 1 records a different approved value.
- Stable documented sort with immutable ID tie-breaker.
- Standard { data, pagination } response; never a bare array.
- Product summary fields only; no private object keys or fabricated image fallback.
- RFC 9457 problems for authentication, authorization, malformed query, rate limit, and dependency failure.
- OpenAPI operation ID and generated-artifact validation.

The first UI slice does not require separate Model or ModelPart collection reads because the existing Product detail graph returns Product → Model → ModelPart. Add those reads only when a later screen needs independent collection behavior.

### 2. Frontend contract support

The API must keep the detail graph and current draft write behavior stable while the app adds:

- explicit API/demo runtime mode;
- typed collection/detail DTO mapping;
- source/lifecycle/sparse-state preservation;
- Idempotency-Key for create requests;
- ETag/If-Match for draft updates;
- stable error mapping for 401, 403, 409, 412, 422, and 503.

### 3. API verification

Required API evidence:

- endpoint checklist for the collection read;
- success and pagination contract tests;
- 401/403 capability tests;
- invalid query and dependency failure tests;
- OpenAPI source/generated consistency;
- no migration application and no production database contact.

## Dependency order

1. Reconcile route family and collection contract.
2. Implement Product collection read.
3. Validate OpenAPI and API contract tests.
4. Implement frontend API/demo boundary.
5. Hydrate product list/detail from API mode.
6. Wire draft mutations.
7. Run cross-repository verification.
8. Synchronize WWG and hand off release gates.

## Stop conditions

Stop and report instead of guessing if:

- route namespace or capability names conflict;
- server operational scope requires Workspace or ProductionLine semantics;
- a response needs fields not represented by the canonical API;
- source status or lifecycle cannot be mapped without inventing certainty;
- a write requires an unapplied migration or publication decision;
- API mode would need silent demo fallback;
- a test failure indicates a regression outside this slice.

## Definition of done for the API portion

- The accepted Product collection endpoint is documented and implemented.
- The existing Product detail graph remains contract-compatible.
- API authorization is server-side and deployment-scoped.
- Pagination and errors match the REST standard.
- OpenAPI and generated docs agree.
- Focused contract and authorization tests pass.
- No migration or production operation is performed.

