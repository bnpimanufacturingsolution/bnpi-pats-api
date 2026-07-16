# Bandai PATS Foundation Closure Report

Date: 2026-07-15
Branch: `develop`
Repositories: `bnpi-pats-api` and `bnpi-pats-app`

## Result

Foundation status: **READY FOR REVIEW / MVP DOMAIN STILL CLOSED**.

The foundation tasks needed to wire the app and API locally are complete. The domain MVP is not
being opened by this report. This closes the infrastructure, auth/RBAC, canonical catalog read,
frontend adapter, and repeatable validation path; it does not claim production backup ownership.

## Pass closure

| Foundation pass | Result | Evidence |
|---|---|---|
| 1. Baseline and scope lock | Complete | Existing Gate 0 freeze record, this report, protected legacy routes |
| 2. API build normalization | Complete | `pnpm run lint`, `pnpm run type-check`, `pnpm run build` |
| 3. Compose on-prem infrastructure | Complete | PostgreSQL and MinIO services, named volumes, readiness checks, Compose config |
| 4. MinIO storage boundary | Complete | Private bucket initialization and object-storage contract tests |
| 5. PATS Prisma/PostgreSQL boundary | Complete | Isolated generated client, migration deploy, schema contract tests |
| 6. First read-only catalog contract | Complete | Transitional workspace route retained; canonical deployment-scoped route added |
| 7. Frontend adapter and verification | Complete | Canonical app auth/capability loading, catalog adapter, 50 app files / 254 tests |
| 8. CI, backup/restore, delivery checks | Complete for foundation; production ops open | `.github/workflows/foundation.yml`, foundation runbook |

## Canonical integration now available

- `POST /api/v1/auth/login` accepts a PATS-local username/password and returns a signed bearer token.
- `GET /api/v1/users/me` returns the provider-safe self projection.
- `GET /api/v1/users/me/capabilities` returns effective server-derived capabilities.
- `GET /api/v1/catalog/products/{productId}` is authenticated and requires `catalog.read`.
- The canonical catalog route resolves the operational context on the server; the app does not send
  `x-workspace-id` or select a tenant.
- The old `/api/pats/catalog/products/{productId}` route remains transitional and workspace-header
  scoped for compatibility evidence. It is not the app integration surface.

## Validation evidence

API:

- `pnpm run type-check` passed.
- Focused and full API suite passed: 154 tests.
- `pnpm run build` passed.
- `docker compose --profile pats config --quiet` passed.
- PostgreSQL and MinIO were started healthy; the private bucket initializer completed.
- PATS migration `20260715090000_gate2_identity_authorization` deployed successfully.
- `/api/v1/health` returned healthy from the running Compose app.
- Local login, self, and capabilities smoke passed with a disposable bootstrap account.
- The rebuilt Compose app image started healthy after the canonical catalog and rate-limit changes.

App:

- Targeted foundation-file ESLint passed without `--fix`; unrelated inherited formatter drift was
  intentionally not rewritten.
- `pnpm typecheck` passed.
- Full isolated Vitest suite passed: 50 files, 254 tests.
- Canonical catalog adapter tests cover complete/sparse payloads and explicit demo fallback.

## Open questions and blockers

- `NEEDS_CONFIRMATION`: production backup owner, schedule, retention, RPO, RTO, encryption, and
  off-host copy policy.
- `NEEDS_CONFIRMATION` / `CONFLICTING` / `STALE`: historical truth and design labels remain in
  their source documents and were not rewritten by this closure report.
- MVP domain writes remain closed until the user explicitly opens the next domain slice. No
  planning, execution, inventory, release, or outbox business endpoint is claimed complete here.

## Self-check

- [x] Repository branches confirmed as `develop`.
- [x] App and API integration boundaries are canonical and do not require SSO/OIDC.
- [x] Local RBAC is server-derived and capability-gated.
- [x] Transitional workspace behavior is labelled rather than silently promoted.
- [x] App and API tests/build checks pass.
- [x] `git diff --check` passes.
- [x] No generated artifacts, seeds, or frontend demo fixtures were changed by the foundation closure.

Ready for the next decision: open one MVP domain vertical slice, or keep foundation in review.
