# PATS Full App–API Transition — I10 Station History Adoption

Date: 2026-07-31

Status: COMPLETE

## Decision

The active station View History screen needed server-owned execution history, but no new ledger or
station-history persistence table was justified. Existing stage-event and routing-violation records
already contain the authoritative evidence. A small read-only station projection is therefore the
pragmatic API boundary. It is rebuildable and does not invent materials, staffing, expected output,
or lot-pack completion data.

## Implemented

- Added `GET /api/v1/stations/:stationId/history` to the canonical domain-read router.
- The projection resolves a station's configured stage boundaries, reads ordered stage events and
  open routing violations, and enriches them with server batch, lot, part, and stage identities.
- The endpoint is protected by `execution.read`, returns `404` for an unknown station, and uses the
  existing canonical `503` dependency problem boundary.
- Added the OpenAPI source contract, generated Swagger JSON/YAML, and generated endpoint inventory.
- Added a contract test covering station identity, event identity, actor display name, violation
  part/lot identity, and attempted-step naming.

## Endpoint review checklist

| Review area | Result | Evidence |
|---|---|---|
| Classification and version | PASS | Canonical `/api/v1` route; source OpenAPI operation `stationHistoryGet` |
| Resource/path semantics | PASS | Plural `stations`, lowercase kebab-case, one-level nested read relationship, no verb |
| HTTP method | PASS | `GET` has no write side effect |
| Response contract | PASS | `200` JSON object with `station`, `events`, and `openViolations` |
| Error contract | PASS | `403`, `404`, and `503` use the canonical Problem Details boundary |
| Authorization | PASS | Canonical identity middleware plus `execution.read` capability |
| Scope/object access | PASS | Station identity and stage boundaries are resolved from server persistence; no client workspace selector |
| Pagination | N/A | This is a bounded station projection, not a public unbounded collection; history is limited by the current execution evidence boundary and may receive pagination in a later contract if volume requires it |
| Concurrency/idempotency | N/A | Read-only GET; no mutation or externally visible retry effect |
| OpenAPI alignment | PASS | Source and generated Swagger/endpoint artifacts updated and export succeeded |

## Validation

- Changed-source ESLint passed.
- TypeScript type-check passed.
- Station-history focused contract test passed.
- Full API suite passed: 214 tests.
- OpenAPI generation/export passed.
- `git diff --check` passed.

## Boundary

No schema migration, seed change, client-data publication, production database operation, or
cutover was performed. The generated Postman collection was restored because the converter rewrote
unrelated generated IDs/methods. The next transition pass is app-wide verification and release-
boundary handoff. Station support-card data and configuration writes remain separate contract work.
