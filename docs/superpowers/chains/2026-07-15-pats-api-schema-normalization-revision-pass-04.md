# PATS API Schema Normalization Revision — Pass 4

**Pass completed:** 4 — API, authorization, on-prem consistency review, and implementation handover

## What changed

- Mapped source revisions, reconciliation issues/resolutions, approvals, normalized catalog
  content, plan snapshots/demand, derived model summaries, material requirements, inventory
  evidence, subject preferences, and walkthrough completion to proposed `/api/v1` resources and
  OpenAPI operation IDs.
- Recorded owner context, capability/object checks, lifecycle, ETag/`If-Match`, idempotency,
  pagination, RFC 9457 errors, audit/outbox, and projection behavior for each mapped family.
- Applied the endpoint checklist: versioned plural kebab-case routes, one-level relationships,
  snake_case filters, camelCase JSON, standard pagination, no verb paths, hidden `404` default,
  trace propagation, and no ordinary mutation of append-only evidence.
- Reconciled the normalized design with the server-resolved operational context, PostgreSQL/
  private-MinIO ownership, air-gapped Docker Compose direction, readiness/failure behavior, and
  additive migration boundary.
- Added the completion handover with the Gate 0 blocker and post-approval implementation order.

## Self-check result

| Check | Result |
|---|---|
| Only documentation/design files touched by this pass | `PASS` |
| No source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| No tests weakened or removed | `PASS` |
| Endpoint ownership, authorization, lifecycle, concurrency, retry, trace, and RFC 9457 behavior mapped | `PASS` |
| REST checklist applied to proposed normalized-resource routes | `PASS` |
| Single server-resolved operational context preserved; no workspace/line selector introduced | `PASS` |
| On-prem PostgreSQL/MinIO/outbox/projection and air-gap boundaries consistent | `PASS` |
| Gate 0 and explicit implementation approval remain required | `PASS` |
| Completion handover and next-step recommendation recorded | `PASS` |
| `git diff --check` at pass close | `PASS` |

## Open questions or blockers

Implementation remains blocked by the unfrozen Gate 0 decision set and controlled source-correction/
effective-revision evidence described in the completion handover. No additional user decision is
required to close this documentation-only revision.

## Ready for next pass

`N/A` — this was the final pass. The normalization revision is complete as documentation; the next
step is Gate 0 review followed by explicit implementation approval.
