# Chain Run: BNPI PATS On-Prem Stack and Build Foundation

## Objective
Establish a reproducible, on-premises PATS foundation using Node/Express, PostgreSQL/Prisma, MinIO, and Docker, then prove one narrow read-only API slice before any planning, execution, scanning, or reporting endpoints are added. The work is broken into passes so build correctness, infrastructure readiness, storage behavior, persistence shape, and API integration are each independently reviewable and cannot hide failures from the previous layer.

## Scope
- In scope: API build normalization, pnpm/Docker alignment, production artifact normalization, port normalization, PostgreSQL Compose service, MinIO Compose service, persistent volumes, readiness checks, private bucket initialization, object-storage boundary, PATS Prisma client/migration boundary, one read-only catalog contract, frontend adapter, CI checks, backup/restore documentation.
- Out of scope: legacy Mongo schema deletion or migration, legacy seed rewrite, PATS production seed, authentication redesign, authorization/role redesign, SSO/HRIS changes, planning writes, execution scans, reporting endpoints, printer/scanner integration, production deployment, public bucket access, database reset, destructive migration, default-branch administration, and unrelated app UI changes already present in the working tree.

## Execution Model
- Single agent, sequential execution. No sub-agent spawning.
- Each pass is a bounded, self-contained unit of work.
- Agent MUST NOT proceed to the next pass until the current pass's self-check gate passes.
- Agent MUST NOT reinterpret or expand scope defined in a pass file.
- If a pass reveals a blocking ambiguity, agent STOPS and reports — does not guess and continue.
- Work directly on API `develop`; the app repository's existing uncommitted UI/WWG files remain outside this chain.
- Each pass ends with the required handoff format and a focused commit containing only that pass's files.

## Pass Index

| Pass | Name | Depends On | Status |
|------|------|-----------|--------|
| 1 | Baseline and Scope Lock | — | pending |
| 2 | API Build Normalization | Pass 1 | pending |
| 3 | Docker Compose On-Prem Infrastructure | Pass 2 | pending |
| 4 | MinIO Object-Storage Boundary | Pass 3 | pending |
| 5 | PATS Prisma/PostgreSQL Boundary | Pass 4 | pending |
| 6 | First Read-Only PATS Contract | Pass 5 | pending |
| 7 | Frontend Adapter and On-Prem Verification | Pass 6 | pending |
| 8 | CI, Backup/Restore, and Delivery Report | Pass 7 | pending |

## Truth Surfaces / Key Files

- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `nginx.conf`
- `webpack.config.js`
- `prisma/pats/schema.prisma`
- `prisma/schema/` legacy Mongo compatibility models
- `app/create-app.ts`
- `index.ts`
- `app/workspace/`
- `app/product/` legacy blocked-review module; not a canonical PATS product contract
- `tests/active-surface.spec.ts`
- `tests/`
- sibling app repository `app/types/pats/`
- sibling app repository `.wwg/wiki/project-truth.md`
- sibling app repository `.wwg/workspace/current-task.md`
- sibling app repository `docs/architecture/2026-07-07-pats-onprem-api-architecture-readiness.md`

## Global Self-Check Gate (applies to every pass)

Before marking any pass complete, agent confirms:

- [ ] Only files/scope listed in that pass's file were touched
- [ ] No TODOs or placeholders left in code
- [ ] Existing tests still pass (or new tests added per pass instructions)
- [ ] Output matches the pass's stated deliverable exactly
- [ ] Any open question is logged, not silently resolved
- [ ] `git diff --check` passes
- [ ] The pass has a focused commit and the working tree is clean
- [ ] No app repository UI/WWG change was staged or rewritten

## Handoff Format (end of each pass)

Agent reports back in this shape:

- **Pass completed:** [N]
- **What changed:** [bullet list]
- **Self-check result:** [pass/fail per checklist item]
- **Open questions / blockers:** [list or "none"]
- **Ready for next pass:** [yes/no]

## Pass Files

- [Pass 1: Baseline and Scope Lock](./2026-07-13-pats-onprem-stack-pass-01-baseline.md)
- [Pass 2: API Build Normalization](./2026-07-13-pats-onprem-stack-pass-02-build.md)
- [Pass 3: Docker Compose On-Prem Infrastructure](./2026-07-13-pats-onprem-stack-pass-03-compose.md)
- [Pass 4: MinIO Object-Storage Boundary](./2026-07-13-pats-onprem-stack-pass-04-storage.md)
- [Pass 5: PATS Prisma/PostgreSQL Boundary](./2026-07-13-pats-onprem-stack-pass-05-prisma.md)
- [Pass 6: First Read-Only PATS Contract](./2026-07-13-pats-onprem-stack-pass-06-read-contract.md)
- [Pass 7: Frontend Adapter and On-Prem Verification](./2026-07-13-pats-onprem-stack-pass-07-frontend.md)
- [Pass 8: CI, Backup/Restore, and Delivery Report](./2026-07-13-pats-onprem-stack-pass-08-operations.md)

