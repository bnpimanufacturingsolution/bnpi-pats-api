# Pass 4: Lifecycles and Invariants

## Depends On

Pass 3 canonical data model.

## Objective

Define state machines, allowed transitions, invariants, corrections, and evidence retention for
planning, execution, inventory, exceptions, jobs, assets, and outbox records.

## Scope

- Touch only: `docs/data/2026-07-14-pats-api-data-model-design.md`,
  `docs/api/2026-07-14-pats-api-cross-cutting-design.md`, the decision register, and the Pass 4
  report.
- Do not touch: source code, Prisma schemas, migrations, routes, seeds, or frontend files.

## Instructions

1. Define states and legal transitions for ProductionPlan, Lot, Batch, StageEvent, Inventory,
   RoutingViolation, Asset, Job, and OutboxMessage.
2. Classify each invariant as database constraint, domain validation, transaction rule, or
   rebuildable projection.
3. Define idempotent retry behavior and correction/reversal behavior for append-oriented records.
4. Mark rework, station granularity, quantity, and retention uncertainty explicitly.

## Deliverable

A state/invariant design that an implementation agent can translate into tests before code.

## Self-Check Gate

- [ ] No transition is implied only by a UI label.
- [ ] Event and inventory evidence cannot be silently rewritten.
- [ ] Retry and conflict behavior is defined for externally visible commands.
- [ ] Correction behavior is explicit or marked `NEEDS_CONFIRMATION`.
- [ ] No code or schema files changed.

## Stop Conditions

Agent stops if:

- a write endpoint would require an unapproved transition;
- a correction policy would destroy audit evidence;
- a state machine depends on unfinished frontend behavior.
