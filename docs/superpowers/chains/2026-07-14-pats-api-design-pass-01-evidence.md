# Pass 1: Evidence and Scope Lock

## Depends On

None.

## Objective

Produce the evidence-led design baseline that separates canonical decisions from implementation
reality, alignment evidence, and unresolved conflict.

## Scope

- Touch only: `docs/superpowers/context/2026-07-14-pats-api-design-context.md`,
  `docs/decisions/2026-07-14-pats-api-design-decision-register.md`, and the Pass 1 report.
- Do not touch: application source, Prisma schemas, migrations, routes, seeds, generated docs,
  frontend files, or the approved REST standard.

## Instructions

1. Read `AGENTS.md`, the approved REST standard, the principle, and the endpoint checklist.
2. Inspect API code/config/tests, the PATS schema, on-prem documents, and app requirements only as
   alignment evidence.
3. Record source precedence, confirmed facts, inferred facts, conflicts, stale material,
   non-goals, and design blockers.
4. Mark every unresolved decision explicitly in the decision register.

## Deliverable

An evidence-led context and decision register with no unlabelled assumptions.

## Self-Check Gate

- [ ] Source precedence is explicit.
- [ ] Legacy and seeded data are not treated as canonical.
- [ ] All discovered conflicts have a status label and evidence source.
- [ ] No code or schema files changed.
- [ ] No scope creep beyond the listed documents.

## Stop Conditions

Agent stops if:

- approved sources conflict without a recorded decision owner;
- the user-facing domain cannot be separated from legacy PMS terminology;
- endpoint standard requirements cannot be applied without an explicit exception.
