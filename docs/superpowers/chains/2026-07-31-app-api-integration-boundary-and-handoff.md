# App–API Integration Boundary and Iteration Handoff (API pointer)

**Status:** ACCEPTED_WORKING_BOUNDARY (not full-transition closeout)  
**Date:** 2026-07-31  
**Primary document (app repo):**  
`bnpi-pats-app/.wwg/reports/2026-07-31-app-api-integration-boundary-and-handoff.md`

Agents working in **bnpi-pats-api** must treat the app-repo handoff as the canonical resume map for:

- which UI surfaces are API-backed vs EMPTY vs DEMO-ONLY vs DEFERRED;
- seed ownership (`scripts/pats-seed.mjs`, `SEED_MODE`, provisional evidence);
- acceptance scripts (`scripts/acceptance-api-journey.mjs`);
- open flags (support cards, config authoring, planning parity, DEMO/UAT isolation);
- freeze list (DM/cutover, Drive publication, production).

## API-side anchors

| Concern | Location |
|---|---|
| Seed | `scripts/pats-seed.mjs`, `pnpm prisma:pats:seed` |
| Seed contract tests | `tests/pats-seed-contract.spec.ts` |
| Live journey | `scripts/acceptance-api-journey.mjs` |
| Domain reads | `app/pats/domain-read.ts` |
| Commands | `app/pats/command-router.ts` |
| Plan detail ETag | strong `"${rowVersion}"` on production-plan detail |
| Transition plan | `docs/superpowers/plans/2026-07-31-pats-full-app-api-transition-plan.md` |
| I11 gate | `docs/superpowers/chains/2026-07-31-pats-full-app-api-i11-release-gate-audit.md` |

## Working decision

Current seeded read/write slices are **good enough for disposable integration demos**.  
Do **not** close the full App–API gate until support-card and configuration-authoring contracts are designed and implemented (or explicitly deferred by product).

Update the **app-repo handoff §3 screen map** when API surface ownership changes; keep this file as a short pointer only.
