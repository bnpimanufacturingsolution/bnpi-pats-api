# PATS API Gate 2 Identity and Authorization Chain

**Status:** COMPLETE — GATE 2 SLICE IMPLEMENTED AND VALIDATED

**Date:** 2026-07-15

**Repository/branch:** `bnpi-pats-api` / `develop`

## Scope

This chain implements the first approved identity slice after Gate 0 freeze and existing Gate 1
common HTTP infrastructure. It does not implement business-domain writes, workspace tenancy, line
selection, subject preferences, or source-release corrections.

## Sequential passes

### Pass 1 — Subject and assignment persistence

- Added PostgreSQL/Prisma `Subject`, `SubjectAssignment`, and controlled lifecycle enums.
- Enforced unique `(provider, issuer, providerSubject)` subject identity.
- Enforced assignment uniqueness and indexes without a Workspace, membership, tenant, or
  ProductionLine relation.
- Added an additive migration; legacy and draft PATS relations remain untouched.

### Pass 2 — Adapter and capability policy

- Added typed `IdentityAuthenticator` and `SubjectRepository` ports.
- Added a local-identity-compatible verified identity shape; client claims are not policy input.
- Added PATS-local username/password verification through `SubjectCredential`, Argon2id password
  hashes, and signed subject-only bearer sessions. No SSO/OIDC/JWKS dependency was introduced.
- Added active-status fail-closed behavior and the approved capability/role-bundle map.
- Unknown capability literals and inactive assignments do not become effective access.

### Pass 3 — Canonical self-projection API

- Added `POST /api/v1/auth/login` for PATS-local credentials with generic invalid-credential
  responses and canonical validation/dependency failures.
- Added `GET /api/v1/users/me`.
- Added `GET /api/v1/users/me/capabilities`.
- Added canonical `401`, `403`, and `503` Problem Details behavior.
- Kept absent adapter composition unavailable by default instead of falling back to legacy auth.
- Added the source OpenAPI 3.1 identity contract.

### Pass 4 — Validation and handover

- Focused identity tests pass.
- Canonical HTTP and transport regression tests pass.
- TypeScript type-check passes.
- Direct Prisma schema validation passes with a non-writing placeholder database URL.
- Repository Prisma validation wrapper remains environment-blocked when `PATS_DATABASE_URL` is
  absent; no database migration was applied.
- Local-auth tests confirm successful login, role/workspace-claim exclusion, generic invalid-login
  behavior, and malformed-input validation.
- `git diff --check` passes.

## Preserved boundaries and next work

- Existing historical `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` labels remain unchanged.
- Account bootstrap, password reset/change, login lockout/rate limiting, and operator assignment
  workflow remain the next authentication operations task. This slice deliberately does not
  auto-create an administrator.
- The next domain slice must use the frozen capability boundary and must not reintroduce client
  selected Workspace/tenant/line authorization.
- Controlled source correction/effective-revision evidence for D-033/D-035 remains a release gate.
