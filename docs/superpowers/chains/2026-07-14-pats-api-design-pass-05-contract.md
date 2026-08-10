# Pass 5 Report: API Contract Standards

**Date:** 2026-07-14
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no OpenAPI or route implementation approval

## Pass completed

Pass 5 — API Contract Standards.

## What changed

- Translated the approved REST standard into PATS-wide rules for versioning, nouns, relationship
  depth, query/body naming, pagination, methods, status codes, Problem Details, auth, tenancy,
  content negotiation, ETags, `If-Match`, idempotency, tracing, rate limits, and deprecation.
- Registered stable PATS Problem Details types and working pagination defaults/maxima.
- Required `/api/v1` for operational resources and removed unversioned health/readiness/version
  paths from the provisional catalog.
- Added an endpoint review evidence template that maps directly to the repository checklist.
- Kept the legacy catalog proof route transitional and prohibited frontend/client tenancy state
  from becoming canonical.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| Rules map to the approved REST standard | PASS | Cross-cutting contract baseline and review template |
| Errors never use successful status codes | PASS | Problem Details/status policy |
| Pagination/filter/sort deterministic | PASS | Query, JSON, and pagination section |
| Retry/concurrency behavior explicit | PASS | ETag/If-Match and Idempotency-Key rules |
| Proof route not promoted | PASS | Catalog Pass 5 baseline |
| Every endpoint uses `/api/v1` | PASS | Canonical path rule and platform path correction |
| No route/OpenAPI/source files changed | PASS | Documentation-only changed paths |
| `git diff --check` | PASS | Fresh command run after the edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION`: identity provider/roles/capabilities, Workspace versus Line, catalog
  ownership, and all domain write decisions carried from Pass 4.
- Working defaults (page size 50/max 100 and 24-hour idempotency retention) are documented as
  design defaults, not client-owned production policy.

No standard exception is requested. Pass 6 may build the endpoint and authorization matrix using
the contract baseline while marking affected writes as design-only or blocked.

## Ready for next pass

Yes. The common contract rules are ready to apply endpoint-by-endpoint.
