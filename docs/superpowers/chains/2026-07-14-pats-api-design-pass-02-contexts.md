# Pass 2: Bounded Contexts and Architecture

## Depends On

Pass 1 evidence baseline and decision register.

## Objective

Define the PATS bounded contexts, ownership, dependency direction, consistency boundaries, and
on-prem deployment shape.

## Scope

- Touch only: `docs/architecture/2026-07-14-pats-api-target-architecture.md`, the master spec,
  and the Pass 2 report.
- Do not touch: source code, Prisma schema, migrations, endpoints, frontend files, or seeds.

## Instructions

1. Define Identity/Tenancy, Catalog, Planning, Execution, Inventory/Traceability,
   Exceptions/Audit, Assets, Reporting/Projections, and Platform contexts.
2. For each context define owned records, public use cases, ports, downstream dependencies, and
   forbidden imports.
3. Define transaction boundaries, append-ledger behavior, projections, outbox position, and
   Docker-first on-prem assumptions.
4. Record architecture decisions that require user confirmation.

## Deliverable

A bounded-context map and architecture boundary document usable by an implementation agent.

## Self-Check Gate

- [ ] Every proposed context has one ownership boundary.
- [ ] Dependency direction does not form a cycle.
- [ ] Write-side truth is distinguished from projections.
- [ ] The architecture remains a modular monolith.
- [ ] No code or schema files changed.

## Stop Conditions

Agent stops if:

- a domain record has multiple competing owners;
- a context boundary requires a role or identity decision that is not recorded;
- the architecture requires a premature message broker or service split.
