# PATS API Gate 2 Identity and Authorization Handover

**Status:** COMPLETE — READY FOR NEXT DOMAIN SLICE

**Date:** 2026-07-15

**Repository/branch:** `bnpi-pats-api` / `develop`

## Completed

The Gate 2 implementation chain added:

- normalized `Subject` and `SubjectAssignment` persistence;
- provider-neutral identity and subject-resolution ports;
- capability-first policy with approved role bundles;
- PATS-local username/password login with Argon2id password verification and signed subject-only
  bearer sessions; no SSO/OIDC dependency;
- canonical self-projection routes and RFC 9457 auth/dependency failures;
- additive migration and source OpenAPI contract;
- focused tests and schema/type validation.

## Runtime composition condition

The canonical app composes the PATS-local authentication adapter and PostgreSQL-backed
`SubjectRepository`; login and self routes fail closed with `503` when that dependency is
unavailable. A usable deployment still requires the additive migration and explicitly bootstrapped
`Subject`/`SubjectCredential` rows. No account is auto-promoted to administrator. The legacy
workspace/role claims are not an acceptable authorization source for canonical PATS routes.

## Next chain

The next implementation chain may begin the first business-domain persistence slice using the
frozen capability contract. In parallel, operations must define account bootstrap, password
reset/change, login lockout/rate limiting, and assignment administration before production rollout.
The domain chain must define normalized schema and additive migration before adding routes, preserve
append-only/audit/outbox invariants, and keep unresolved source corrections outside released
production truth.
