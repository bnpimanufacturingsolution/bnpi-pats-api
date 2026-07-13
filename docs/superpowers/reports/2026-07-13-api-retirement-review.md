# Bandai PATS API Retirement Review

Date: 2026-07-13  
Status: Complete for the current disposition matrix

## Result

No module is approved for destructive retirement in this cleanup pass. The
disposition matrix contains zero `RETIRE_ACTIVE_ROUTE` rows because the two
repositories do not provide evidence that external scripts, deployments, or
operational workflows are absent.

The cleanup result is therefore runtime containment:

- `RETAIN_PLATFORM` and `BLOCKED_REVIEW` routes remain registered.
- `QUARANTINE_LEGACY` routes are not mounted by default.
- Legacy source, Mongo schema fragments, compatibility seeders, and generated
  artifacts remain available for an explicit compatibility run.
- The provisional PostgreSQL PATS schema remains outside the runtime.

## Verification evidence

- `pnpm exec mocha --no-config --require ts-node/register tests/active-surface.spec.ts`
  passed: 5 tests.
- Default `createApp({ enableLegacyRoutes: false })` returned 404 for
  `/api/project` and `/api/template` after the normal auth boundary was
  traversed.
- Explicit `createApp({ enableLegacyRoutes: true })` reached the legacy
  project validator, proving the compatibility route is opt-in rather than
  deleted.
- `pnpm run type-check` passed after the composition seam was extracted.
- `pnpm run lint` passed.
- The commit hook suite passed: 349 passing, 29 pending.

## No deletion performed

No controller, repository, validator, service, Prisma schema fragment,
seeder, generated client, or generated API document was removed in this pass.
Any future deletion requires an external-consumer review and a matrix update
to `RETIRE_ACTIVE_ROUTE` for the specific group.
