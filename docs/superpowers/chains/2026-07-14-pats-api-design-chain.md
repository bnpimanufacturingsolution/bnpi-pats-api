# Chain Run: BNPI PATS API Domain and Contract Design

## Objective

Design the PATS API from domain and on-prem operating truth before further implementation. The
chain produces bounded contexts, a canonical data model, lifecycle invariants, a complete
standard-compliant endpoint catalog, cross-cutting rules, an implementation backlog, and a
restartable handover prompt. It is broken into passes so uncertainty is surfaced and reviewed
before it becomes code, schema, seed data, or an accidental API contract.

## Scope

- In scope: API domain design, bounded contexts, data structures, lifecycle/state machines,
  endpoint inventory, REST contract rules, authorization matrix, assets, events, audit,
  observability, on-prem operations, testing strategy, decision register, implementation backlog,
  and handover prompts.
- Out of scope: source code, Prisma schema edits, migrations, routes, controllers, seeds,
  authentication implementation, frontend integration, UI changes, production deployment,
  destructive database operations, and production data.

## Execution Model

- Single agent, sequential execution. No sub-agent spawning.
- Each pass is a bounded, self-contained unit of design work.
- The agent MUST read `AGENTS.md`, the approved REST standard, the principle, and the checklist
  before endpoint-related passes.
- The agent MUST NOT proceed to the next pass until the current pass's self-check gate passes.
- The agent MUST NOT reinterpret or expand the scope defined in a pass file.
- If a pass reveals a blocking ambiguity, the agent STOPS and reports it as
  `NEEDS_CONFIRMATION`; it does not guess and continue.
- No application source, Prisma schema, generated client, seed, or frontend file may be changed.

## Pass Index

| Pass | Name | Depends On | Status |
|---|---|---|---|
| 1 | Evidence and Scope Lock | — | pending |
| 2 | Bounded Contexts and Architecture | Pass 1 | pending |
| 3 | Canonical Data Model | Pass 2 | pending |
| 4 | Lifecycles and Invariants | Pass 3 | pending |
| 5 | API Contract Standards | Pass 4 | pending |
| 6 | Endpoint Catalog and Authorization Matrix | Pass 5 | pending |
| 7 | Cross-Cutting and On-Prem Operations | Pass 6 | pending |
| 8 | Consistency Review and Handover | Pass 7 | pending |

## Truth Surfaces / Key Files

- `AGENTS.md`
- `docs/standards/restful-endpoint-design-standards.md`
- `docs/principles/restful-endpoint-design-principle.md`
- `docs/standards/endpoint-design-review-checklist.md`
- `docs/superpowers/context/2026-07-14-pats-api-design-context.md`
- `docs/architecture/2026-07-14-pats-api-target-architecture.md`
- `docs/data/2026-07-14-pats-api-data-model-design.md`
- `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`
- `docs/api/2026-07-14-pats-api-cross-cutting-design.md`
- `docs/decisions/2026-07-14-pats-api-design-decision-register.md`
- `prisma/pats/schema.prisma` as implementation evidence only during design
- sibling app PATS requirements and architecture docs as alignment evidence only

## Global Self-Check Gate

Before marking any pass complete, confirm:

- [ ] Only files/scope listed in that pass's file were touched.
- [ ] No code, schema, migration, seed, generated artifact, or frontend file was changed.
- [ ] No TODO or unlabelled placeholder remains in the deliverable.
- [ ] Existing tests were not weakened or removed; no code test run is required for docs-only work.
- [ ] Confirmed, inferred, conflicting, stale, and `NEEDS_CONFIRMATION` items are labelled.
- [ ] The approved REST standard was applied to every endpoint-related decision.
- [ ] The output matches the pass deliverable exactly.
- [ ] `git diff --check` passes.
- [ ] Any open question is logged, not silently resolved.

## Handoff Format

At the end of every pass, report:

- **Pass completed:** [N]
- **What changed:** [bullet list]
- **Self-check result:** [pass/fail per checklist item]
- **Open questions / blockers:** [list or "none"]
- **Ready for next pass:** [yes/no]

## Pass Files

- `2026-07-14-pats-api-design-pass-01-evidence.md`
- `2026-07-14-pats-api-design-pass-02-contexts.md`
- `2026-07-14-pats-api-design-pass-03-data-model.md`
- `2026-07-14-pats-api-design-pass-04-lifecycle.md`
- `2026-07-14-pats-api-design-pass-05-contract.md`
- `2026-07-14-pats-api-design-pass-06-endpoints.md`
- `2026-07-14-pats-api-design-pass-07-cross-cutting.md`
- `2026-07-14-pats-api-design-pass-08-handover.md`
