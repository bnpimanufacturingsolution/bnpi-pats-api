# Pass 5: PATS Prisma/PostgreSQL Boundary

## Depends On
Pass 4 storage boundary and the app's current PATS types plus WWG truth surfaces.

## Objective
Create an independently generated, migration-managed PATS Prisma client without changing the legacy Mongo runtime.

## Scope
- Touch only: `prisma/pats/schema.prisma`, `prisma/pats/migrations/**`, `scripts/pats-prisma-*.mjs`, `package.json`, `pnpm-lock.yaml`, `tests/pats-prisma-contract.spec.ts`, and `docs/superpowers/reports/2026-07-13-pats-schema-reconciliation.md`.
- Do not touch: `prisma/schema/**` legacy models, `prisma/seed.ts`, legacy seeders, legacy generated client output, auth, workspace membership, route registration, frontend files, or production databases.

## Instructions
1. Reconcile the app shapes for Product → Model → ModelPart, Project → ProjectModelAllocation, PartsList → ordered RoutingStep → Part, Lot → Batch → BatchPartLine, stations, and future asset metadata ownership against `prisma/pats/schema.prisma`.
2. Write the reconciliation report and failing schema contract checks before changing the draft; preserve `NEEDS_CONFIRMATION` labels for unresolved business behavior.
3. Add explicit PATS commands for format, validate, generate, migrate-dev, and migrate-deploy, with a separate generated-client output.
4. Update only confirmed schema mismatches; do not silently collapse ProductSpecification into Product or Lot into Batch.
5. Validate and generate the PATS client with an explicit local `PATS_DATABASE_URL`; create and deploy migrations only against an isolated disposable PostgreSQL database.
6. Run legacy typecheck/tests, PATS schema checks, `git diff --check`, review the changed-file list, and commit only the listed files.

## Deliverable
A reviewed PATS schema reconciliation report, separate PATS Prisma commands/client output, and an isolated migration that deploys successfully without changing the legacy Mongo runtime.

## Self-Check Gate (pass-specific)
- [ ] PATS Prisma client generation is separate from legacy Mongo generation.
- [ ] PATS schema validation and isolated migration deploy pass.
- [ ] Legacy typecheck and tests still pass.
- [ ] No destructive command, production database, seed rewrite, or legacy schema change was used.
- [ ] All unresolved domain decisions are logged in the reconciliation report.
- [ ] No scope creep beyond files listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- The app and API entity shapes cannot be reconciled without a product decision.
- A migration requires destructive data movement or a production database.
- Prisma generation requires modifying legacy models or seed behavior.
- PostgreSQL credentials or an isolated database are unavailable.

