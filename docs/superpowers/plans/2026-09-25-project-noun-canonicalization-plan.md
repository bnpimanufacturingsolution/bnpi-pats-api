# Project Noun Canonicalization Plan (D-024 close-out)

**Date:** 2026-09-25
**Status:** COMPLETE — all four phases executed and verified 2026-09-25 (see WWG handoff
`2026-09-25-api-sunset-exception-removal-handoff.md` in the sibling repo for the verification log)
**Background:** UI + DB schema say `Project`; the app↔API wire and all API/app code say
`ProductionPlan`. Every planning route is a twin (`/projects` + `/production-plans`) which masked
the split. Earlier passes cleaned scope (D-038) and labels but left twins and code naming as
compat. This plan finishes it. It does **not** cover response-key trimming (`planId`/`planCode`)
or the lifecycle redesign — separate tracks.

## Phase 0 — Record D-024 (prerequisite, no code)

- Append D-024 resolution to `docs/decisions/2026-07-14-pats-api-design-decision-register.md`:
  canonical domain noun is **Project**; `ProductionPlan` is a retired synonym.
- Owner: user. Evidence: UI routes/labels, Prisma `model Project`, sibling audit 2026-09-25.
- Review condition: reopen only if an external consumer requires the `ProductionPlan` noun.

## Phase 1 — App wire switch (services only, no components)

- `app/services/pats-domain-service.ts`: `planPath()` and all plan methods use
  `API_ENDPOINTS.CANONICAL_PATS.PROJECTS` (`/projects`) instead of `PRODUCTION_PLANS`.
  Response parsing unchanged — `planResponse` already carries both `planId` and `projectId` keys.
- Untouched: hook/component/route files, query keys, UI strings.
- Verify: app `typecheck`, `pats-domain-service` + hook unit tests, headed
  `connected-flow-arrival` + `release-as-publish` against dev API.
- Rollback: flip the constant back (one line). Risk: negligible (twin routes both live).

## Phase 2 — API twin removal + renames (after Phase 1 is green)

- Routes: all `["/projects…", "/production-plans…"]` arrays in `domain-read.ts` /
  `command-router.ts` become `/projects…` only; drop `/production-plans` from the canonical
  `domainReadPrefixes` / `domainCommandPrefixes`.
- §7 handling: twins have exactly one consumer (this app), migrated and verified in Phase 1 —
  immediate removal under the same no-production rationale as the 2026-09-25 §7 exception
  (record the scoped exception; no sunset window to protect).
- Renames (behavior-preserving): `PlanLifecycleStatus` → `ProjectLifecycleStatus` (plus a
  non-destructive `ALTER TYPE … RENAME TO …` migration — verify with a migrate dry run first),
  `productionPlan*` schemas/commands/audit names → `project*`, `planResponse` → `projectResponse`,
  user-facing error strings "production plan" → "project".
- Explicitly **kept**: response keys `planId`/`planCode` alongside `projectId`/`projectCode`
  (the app reads `plan.planId`; trimming them is a later contract decision, not this slice).
  Historical audit rows keep old event names; only new rows use the renamed ones.
- Verify: `type-check`, eslint, full API suite (448 baseline), OpenAPI regen + zero-diff check for
  anything except the twin removal, runtime probes (`/production-plans…` → boundary 404/405-or-gate;
  `/projects…` 200/201 paths unchanged), fresh reseed, headed arrival + release-as-publish.

## Phase 3 — App renames (services/hooks/types, unfrozen layers)

- Rename `ProductionPlan*` interfaces, service methods, hooks, and query-key labels to `Project*`,
  leaving compat aliases on the old names (precedent: `useDeleteProject = useDeleteProductionPlan`).
- Component files change **only in import lines** (mechanical; no layout/styling/behavior change —
  frozen-layout constraint respected, flagged explicitly for approval).
- Drop the compat aliases in a later cleanup once components import canonical names.
- Verify: app `typecheck`, full app unit suite, headed arrival + release-as-publish.

## Review evidence (per AGENTS.md handoff)

Standard sections (§2 paths, §3 semantics unchanged, §6 boundary behavior, §7 exception record,
§8 auth unchanged, §9–§11 unchanged), OpenAPI-implementation match, endpoint catalog update
(twins → REMOVED table), decision-register + WWG handoff updates in both repos, unresolved items
(response-key trim, lifecycle redesign) listed, not silently closed.
