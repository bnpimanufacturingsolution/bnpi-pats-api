# Bandai PATS API Target Design

**Status:** DESIGN PACKAGE FOR REVIEW

**Date:** 2026-07-14

## Goal

Define the Bandai PATS API from domain truth and on-prem operational constraints before further
route, schema, seed, authentication, or frontend integration work.

## Governing rule

Every endpoint must conform to the approved internal
[`restful-endpoint-design-standards.md`](../../standards/restful-endpoint-design-standards.md).
The repository-owned copy is normative for this project. The API `AGENTS.md` makes it a required
reading and review gate.

## Design stance

- The API is designed blind from the frontend implementation but aligned with its confirmed
  business terminology and working domain model.
- Legacy PMS routes and demo data are evidence of compatibility concerns, not canonical PATS
  behavior.
- PATS begins as a modular monolith on PostgreSQL/Prisma with private MinIO and Docker.
- Public contracts use versioned REST resources, shallow relationships, explicit authorization,
  standard errors, and reviewable OpenAPI.
- No design document may silently promote an inferred or conflicting requirement to confirmed
  truth.

## Package map

| Document | Purpose |
|---|---|
| `docs/superpowers/context/2026-07-14-pats-api-design-context.md` | source precedence, scope, working truth |
| `docs/architecture/2026-07-14-pats-api-target-architecture.md` | bounded contexts and architecture boundaries |
| `docs/data/2026-07-14-pats-api-data-model-design.md` | conceptual entities, relations, invariants, gaps |
| `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md` | versioned resource inventory and endpoint rules |
| `docs/api/2026-07-14-pats-api-cross-cutting-design.md` | auth, errors, concurrency, assets, events, operations |
| `docs/decisions/2026-07-14-pats-api-design-decision-register.md` | open decisions and blocking questions |
| `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md` | design and future implementation sequence |
| `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md` | sequential pass index and execution rules |
| `docs/superpowers/prompts/2026-07-14-pats-api-design-handover.md` | restartable prompt for another session |

## Design completion gate

The design is not ready for implementation until:

- all bounded contexts have owners and dependency direction;
- all core entities have identity, lifecycle, tenant scope, and invariants;
- endpoint families have standard-compliant paths, methods, pagination, errors, auth, retries,
  concurrency, and OpenAPI operation definitions;
- write-side state transitions and append-ledger rules are explicit;
- blocking decisions are either accepted or explicitly kept outside implementation scope;
- the implementation backlog has no dependency gaps;
- the final handover prompt can restart the work without relying on chat history.

## Out of scope for this design package

- implementing routes or controllers;
- changing the Prisma schema or migrations;
- creating production seeds;
- integrating the frontend;
- redesigning authentication or roles in code;
- production deployment or destructive data operations;
- committing unapproved business assumptions.
