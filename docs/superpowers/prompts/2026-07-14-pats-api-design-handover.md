# Handover Prompt: Bandai PATS API Domain and Contract Design

You are a senior backend architect and API designer continuing work on the Bandai PATS API.

## Objective

Complete the documentation-only PATS API design chain, then prepare a dependency-ordered
implementation backlog. Do not implement code in this handover session unless the user starts a
separate implementation phase after approving the completed design.

The backend must be designed from business/domain and on-prem operational truth first. The
frontend prototype is alignment evidence only and must not define API identity, persistence,
authorization, lifecycle, or endpoint semantics.

## Mandatory reading order

1. `AGENTS.md`
2. `docs/standards/restful-endpoint-design-standards.md`
3. `docs/principles/restful-endpoint-design-principle.md`
4. `docs/standards/endpoint-design-review-checklist.md`
5. `docs/superpowers/context/2026-07-14-pats-api-design-context.md`
6. `docs/superpowers/specs/2026-07-14-pats-api-target-design.md`
7. `docs/architecture/2026-07-14-pats-api-target-architecture.md`
8. `docs/data/2026-07-14-pats-api-data-model-design.md`
9. `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`
10. `docs/api/2026-07-14-pats-api-cross-cutting-design.md`
11. `docs/decisions/2026-07-14-pats-api-design-decision-register.md`
12. `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md`
13. `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md`

Read the relevant existing API code, PATS schema, on-prem notes, and frontend requirements only
after the design package is loaded. Treat them as evidence and record conflicts.

## Non-negotiable rules

- The approved REST standard is mandatory for every endpoint.
- Use the endpoint review checklist for every proposed endpoint.
- Public canonical routes begin with `/api/v1`.
- Use plural lowercase kebab-case nouns, one-level nesting, `snake_case` query parameters, and
  `camelCase` JSON.
- Use standard HTTP status codes, RFC 9457 Problem Details, standard pagination, ETags,
  `If-Match`, `Idempotency-Key`, `traceparent`, and deprecation headers as applicable.
- Do not wrap failures in successful responses.
- Do not promote legacy routes, seeds, initials, filenames, display names, or frontend localStorage
  into canonical API truth.
- Mark uncertain items `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`.
- Do not guess through a blocking ambiguity.
- Do not modify source code, Prisma schemas, migrations, generated artifacts, seeds, deployment
  files, or frontend files during the design chain.

## Execution method

Use sequential meta-prompted passes from:

`docs/superpowers/chains/2026-07-14-pats-api-design-pass-01-evidence.md` through Pass 08.

Do not skip a pass. Do not continue after a failed self-check. At the end of each pass report:

- Pass completed
- What changed
- Self-check result
- Open questions/blockers
- Ready for next pass

## Required final deliverables

- Evidence-led context
- Bounded-context architecture
- Canonical data model
- Lifecycle/state-machine and invariant design
- Standard-compliant endpoint catalog
- Authorization matrix
- Cross-cutting and on-prem operations design
- Decision register
- Dependency-ordered implementation plan
- Final handover and implementation backlog

## Final report requirements

Distinguish confirmed facts from recommendations. List every unresolved decision. State that no
application code was changed. Include the exact documents reviewed, endpoint standard sections
applied, design gates passed, and the first implementation pass that may begin only after explicit
approval.
