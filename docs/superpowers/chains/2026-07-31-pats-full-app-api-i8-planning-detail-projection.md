# PATS Full App–API Transition — I8 Planning Detail Projection

Date: 2026-07-31

Status: COMPLETE

## Decision

The app may create a lot or batch only when the planning detail read supplies the server-owned
execution bindings required by the command. The client must not infer a parts-list revision,
production quantity, label pack size, allocated part, or first route step from fixture data.

## Implementation

- Expanded `GET /api/v1/production-plans/:planId` lot resources with parts-list identity and
  revision, required quantity, and label pack size.
- Preserved the existing lot allocation and batch projections so the app can select a server-owned
  part and route revision for authoring.
- Added a contract test proving the execution bindings survive the canonical plan-detail read.
- Kept the projection additive; no migration or client-data publication was performed.

## Validation

- Targeted ESLint and TypeScript checks passed.
- Canonical domain-read contract passed.
- Full API suite: 209 passing.

## Boundary

The next planning slice is route/allocation authoring. It must be designed against explicit API
commands and concurrency rules before the remaining local draft editor can be replaced. DM/cutover,
client-data migration, and production deployment remain frozen.
