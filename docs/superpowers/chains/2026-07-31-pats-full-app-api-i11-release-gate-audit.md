# PATS Full App–API Transition — I11 Release-Gate Audit

Date: 2026-07-31

Status: OPEN — implementation remains bounded by unresolved active-surface contracts

## Verified

- Canonical PATS API runtime, seeded persistence boundary, read models, commands, identity, and
  capability checks are implemented for the current operational slices.
- Station history is now covered by the server-owned `GET /api/v1/stations/:stationId/history`
  projection from I10.
- API full validation is green: lint, type-check, OpenAPI export, and 214 tests.
- App full validation is green: 62 files and 302 tests; the app’s changed files lint and typecheck.

## Acceptance gaps

- The station support-card concepts shown by the prototype do not map to confirmed canonical API
  ownership. Current material quantities are not station-scoped MaterialRequirements, employee
  assignments are not persisted against stations, expected output has no schedule/target source,
  and lot-pack completion requires an accepted completion/packaging policy.
- Configuration writes are not yet a safe canonical contract. Stage/SubStage records lack the
  reviewed mutable-version/edit boundary needed for the local editor’s disable/remove/reorder/link
  operations; the API’s existing create commands do not provide full editor parity.
- PMRS/material requirement semantics and a complete replacement for the legacy full planning draft
  editor remain outside the accepted server workflow.
- A clean seeded environment/browser smoke for refresh, second-browser persistence, and visible API
  outage behavior remains to be executed before release acceptance.

## Decision

The full-transition gate is not marked complete. The next pass is a contract/design review for
station support-card data and configuration authoring. Only confirmed fields should be implemented;
fixture values, global report values, and inferred staff/material/schedule values must not be
promoted into canonical persistence. DM/cutover, client-data publication, production migration,
external integrations, hardware SDKs, and production deployment remain frozen.

## Required next evidence

1. Confirm the owner and source for station materials, staff assignment, station targets/schedules,
   and lot-pack completion.
2. Define lifecycle/versioning/authorization for editable workflow configuration.
3. Add API and app contract tests before enabling any canonical write surface.
4. Run the disposable seeded browser acceptance path only after the contracts are implemented.
