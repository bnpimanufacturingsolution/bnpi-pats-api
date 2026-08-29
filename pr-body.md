## Error-UX Constitution API Hardening (2026-08-29)

**Cross-repo pair:** bnpi-pats-app PR #19 (`feature/2026-08-29-rbac-qa-suite`)

### Incident
`demo.planner` (pure planner, lacks `execution.read`) hit 403 on `GET /api/v1/dashboard-summaries` and `GET /api/v1/reports/line`. Pasted error banners leaked `VITE_PATS_API_URL`, `PATS_SEED_PASSWORD`, `demo.planner`, and `execution.read` — including the denied identity as "sign in as" remediation.

### Constitution (three classes, fixed copy)
| Class | Trigger | User Copy |
|-------|---------|-----------|
| Session ended | 401 | "Your session ended. Sign in again to continue." |
| Access denied | 403 | "You don't have access to this data. Sign in with an account that has access, or ask your supervisor." |
| Connectivity | 0/502/503/504 | "This data can't be loaded right now. Check your connection, then try again." |

### API Hardening
- `app/canonical/router.ts` — identity 503 detail static + `console.error` cause (was `error.message`); generic 503 aligned
- `app/pats/catalog.ts` — storage 503 canonical detail + legacy message static; keep `errorCode` + `console.error`
- `app/create-app.ts` — global 500 always "Internal server error" (no stack echo); P2002 → "A record with these details already exists." (no column leak); `console.error` retained

### Regression Tests
- `tests/error-response-boundary.spec.ts` (new): global 500 no-leak (sync throw); P2002 no-leak (mock Prisma error class)
- `tests/bom-read.contract.spec.ts`: 503 detail exact match + no "database unavailable" leak
- `tests/pats-catalog.contract.spec.ts`: 503 message exact match + no "MinIO unavailable" leak
- `tests/canonical-identity.spec.ts`: no-adapter 503 detail exact match + no-leak regex

### Gates
- `tsc --noEmit`: PASS
- `mocha`: 272/272 PASS

### Notes
- Pre-existing uncommitted changes (policy.ts, seed scripts, tests, docs, generated) remain unstaged per adoption rule
- Only hardening files staged in this commit