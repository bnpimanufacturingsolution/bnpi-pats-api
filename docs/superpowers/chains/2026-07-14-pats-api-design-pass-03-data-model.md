# Pass 3: Canonical Data Model

## Depends On

Pass 2 bounded contexts and architecture boundaries.

## Objective

Define the canonical relational entity model, relationships, constraints, metadata boundaries, and
unresolved data decisions without editing Prisma.

## Scope

- Touch only: `docs/data/2026-07-14-pats-api-data-model-design.md`,
  `docs/decisions/2026-07-14-pats-api-design-decision-register.md`, and the Pass 3 report.
- Do not touch: `prisma/**`, generated clients, routes, controllers, seeds, or app files.

## Instructions

1. For each entity define identity, owner context, tenant scope, lifecycle, timestamps, deletion
   behavior, and sensitive fields.
2. Define relationships, unique constraints, foreign keys, indexes, and quantity/unit rules at a
   conceptual level.
3. Separate catalog definitions, planning snapshots, execution records, append ledgers, audit,
   assets, outbox, and projections.
4. Reconcile current draft gaps: workflow scope, Lot cardinality, Parts List versioning, batch
   position, PMRS, actor identity, assets, audit, and outbox.

## Deliverable

A canonical conceptual data model and a migration-risk/open-question list.

## Self-Check Gate

- [ ] No entity uses initials, display names, or filenames as identity.
- [ ] Every relationship has one clear owner.
- [ ] Mutable state and append-only evidence are distinguished.
- [ ] Flexible JSON fields have bounded purposes.
- [ ] Blocking unresolved decisions are in the decision register.

## Stop Conditions

Agent stops if:

- Lot, Part, Batch, or route version semantics cannot be stated without guessing;
- PMRS is expanded beyond confirmed business evidence;
- a relational invariant is proposed only as an unvalidated JSON blob.
