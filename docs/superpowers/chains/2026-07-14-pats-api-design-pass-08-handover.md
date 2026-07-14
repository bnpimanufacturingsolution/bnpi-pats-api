# Pass 8: Consistency Review and Handover

## Depends On

Pass 7 cross-cutting and on-prem operations design.

## Objective

Perform a final cross-document consistency review and produce the implementation backlog and
restartable handover prompt.

## Scope

- Touch only: all design-package Markdown files listed in the chain truth surfaces,
  `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md`,
  `docs/superpowers/specs/2026-07-14-pats-api-target-design.md`,
  `docs/superpowers/prompts/2026-07-14-pats-api-design-handover.md`, and the Pass 8 report.
- Do not touch: application source, Prisma schemas, migrations, generated artifacts, seeds,
  frontend files, or deployment configuration.

## Instructions

1. Review every endpoint against the approved REST standard and the endpoint checklist.
2. Verify entity names, relationships, lifecycle states, endpoint paths, authorization rules,
   error types, and operational assumptions agree across documents.
3. Remove duplicate or contradictory decisions; preserve unresolved items in the decision register.
4. Order the future implementation backlog by dependency and define a test gate for each phase.
5. Write the final handover prompt with repository paths, reading order, chain rules, stop
   conditions, and required reporting format.

## Deliverable

A coherent, review-ready design package and a handover prompt that can start another session
without chat history.

## Self-Check Gate

- [ ] All documents agree on terminology and proposed route conventions.
- [ ] All unresolved decisions are visible and labelled.
- [ ] The backlog has no hidden dependency or implementation guess.
- [ ] The handover prompt explicitly requires the REST standard and checklist.
- [ ] No code, schema, migration, seed, generated artifact, or frontend file changed.
- [ ] `git diff --check` passes and documentation scope is clean.

## Stop Conditions

Agent stops if:

- two design documents still define different canonical identities or route shapes;
- an endpoint is described without an authorization or error contract;
- the handover prompt would require relying on unstated chat context.
