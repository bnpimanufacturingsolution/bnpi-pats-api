# Chain Run: Bandai PATS Single-Operational-Context Design Revision

**Status:** COMPLETED - documentation-only revision; implementation approval pending

**Date:** 2026-07-15

## Objective

Revise the PATS design package for a single on-prem operational context without treating the
system as SaaS multi-tenant, while preserving an explicit future path for multiple physical lines
if that requirement is later confirmed.

## Scope rules

- Read the existing design package and the four pass prompts before executing a pass.
- Only design-package Markdown, pass reports, chain records, plans, and prompts may change.
- Do not modify Prisma, migrations, application source, tests, generated artifacts, seeds,
  deployment files, or frontend files.
- Do not silently accept unrelated open decisions.
- Keep `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` labels visible.

## Pass index

| Pass | Name | Status |
|---|---|---|
| 1 | Operational-context decision lock | completed |
| 2 | Domain and persistence revision | completed |
| 3 | API, architecture, and operations revision | completed |
| 4 | Consistency review and implementation handover | completed |

## Required report format

Every pass report must state:

- Pass completed
- What changed
- Self-check result
- Open questions or blockers
- Ready for next pass

## Global invariants

- A single installation is not described as a SaaS tenant system.
- A physical production line/site is not invented as a public resource unless its business
  identity is confirmed.
- Capability authorization remains explicit even without membership tenancy.
- Core relations remain relational and JSON remains bounded.
- Future multi-line evolution is described as a migration boundary, not preloaded complexity.
- No application or persistence implementation begins in this revision chain.
- `git diff --check` passes.

## Completion rule

The chain completes only after the revised package is internally consistent and the handover names
the exact first implementation task under the single-context model.

## Completion result

The package is internally consistent for the first single-operational-context deployment. The
exact first implementation task is the Gate 2 identity/authorization persistence slice for
`subjects` and deployment-scoped `subject_assignments`, followed by capability policy and object
ownership checks. Implementation remains blocked until Gate 0 decisions are accepted or explicitly
deferred and the user explicitly approves the implementation phase.
