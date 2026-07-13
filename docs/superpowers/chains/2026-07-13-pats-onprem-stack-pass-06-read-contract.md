# Pass 6: First Read-Only PATS Contract

## Depends On
Pass 5 PATS client and isolated migration gate.

## Objective
Expose one workspace-scoped read-only Product → Model → ModelPart contract with complete, sparse, and missing-data behavior.

## Scope
- Touch only: `app/pats/catalog/**`, `app/pats/index.ts`, `tests/pats-catalog.contract.spec.ts`, generated OpenAPI inputs for the new read-only route, and focused API documentation.
- Do not touch: legacy `app/product/**`, planning writes, execution scans, reporting, auth/role behavior, workspace membership semantics, seeds, frontend files, or the legacy API registration boundary outside the new PATS module.

## Instructions
1. Define the response contract for complete records, nullable source metadata, empty model-part/routing collections, missing optional images, explicit not-found responses, and unavailable-storage responses.
2. Write Supertest contract tests first and run them red.
3. Implement the smallest read-only route through the PATS Prisma client and object-storage interface, retaining the existing authentication and workspace boundary.
4. Confirm that no legacy product controller, demo seed record, display name, or initial is used as canonical data.
5. Run focused API tests, typecheck, lint, build, active-surface tests, OpenAPI generation, and a Compose smoke request.
6. Review scope and commit only the listed files.

## Deliverable
A passing, workspace-scoped read-only catalog endpoint and contract test suite backed by isolated PostgreSQL data, with optional image references handled safely.

## Self-Check Gate (pass-specific)
- [ ] Complete and sparse records both satisfy the response contract.
- [ ] Missing records and unavailable storage return explicit typed responses.
- [ ] Workspace scoping remains enforced by the existing boundary.
- [ ] No legacy product route or seed data is reused.
- [ ] Focused tests, typecheck, lint, build, docs generation, and Compose smoke pass.
- [ ] No scope creep beyond files listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- The endpoint requires a new authentication or role decision.
- Workspace scoping cannot be enforced with the existing retained boundary.
- The schema lacks a confirmed relation needed for the read-only response.
- The route would need a write operation, legacy product controller, or seed-derived fallback.

