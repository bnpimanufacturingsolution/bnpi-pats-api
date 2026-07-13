# Pass 8: CI, Backup/Restore, and Delivery Report

## Depends On
Pass 7 frontend adapter verification and clean API/app scope review.

## Objective
Document and automate the repeatable on-prem build, health, backup/restore, and delivery checks for the PATS foundation.

## Scope
- Touch only: API CI workflow files, `README.md`, on-prem operator documentation, `docs/superpowers/reports/2026-07-13-pats-onprem-stack-build-report.md`, and narrowly scoped verification scripts.
- Do not touch: business modules, Prisma domain shape, seeds, authentication/authorization, production deployment execution, default-branch settings, or existing app UI/WWG changes.

## Instructions
1. Add CI checks for frozen pnpm install, API lint, typecheck, tests, build, PATS Prisma validation/generation, Compose configuration, and health checks.
2. Document secret injection, first startup, named-volume locations, PostgreSQL backup/restore, MinIO object backup/restore, offline image/package delivery, upgrade order, rollback boundaries, health endpoints, and logs.
3. Run the full verification chain in an isolated environment and capture exact command results.
4. Verify the MinIO bucket remains private and the API image runs as non-root.
5. Create the delivery report with changed files, verification evidence, unresolved `NEEDS_CONFIRMATION` items, remaining risks, and whether a new recommendation was added.
6. Run `git diff --check`, review scope, and commit only the listed operational files.

## Deliverable
CI and an on-prem operator runbook cover the stack, isolated backup/restore procedures are verified, and the final delivery report distinguishes evidence from recommendations.

## Self-Check Gate (pass-specific)
- [ ] CI verifies build, tests, Prisma boundary, Compose configuration, health, storage privacy, and non-root execution.
- [ ] PostgreSQL and MinIO backup/restore procedures are documented and tested in isolation.
- [ ] Offline installation and image/package delivery are documented.
- [ ] Final report lists exact verification results and unresolved questions.
- [ ] No production deployment or destructive operation occurred.
- [ ] No scope creep beyond files listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- Backup or restore cannot be tested safely in an isolated environment.
- CI requires credentials or external services not available in the approved environment.
- The operational runbook would require inventing production topology, retention, or recovery objectives.
- Any remaining product, identity, or security ambiguity is being treated as an implementation detail.

