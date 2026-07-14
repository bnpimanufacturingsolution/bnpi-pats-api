# API Agent Guide

## Purpose

This repository contains the Bandai PATS API and its on-premise runtime foundation.
The API is designed from domain and operational truth first. Frontend prototype code is
alignment evidence only; it is not the authority for API resource shape, persistence, or
business rules.

## Mandatory Endpoint Standard

Before designing, writing, reviewing, documenting, or approving any HTTP endpoint, the agent
MUST read these files in order:

1. `docs/standards/restful-endpoint-design-standards.md` — normative endpoint standard
2. `docs/principles/restful-endpoint-design-principle.md` — project adoption and enforcement
3. `docs/standards/endpoint-design-review-checklist.md` — required review gate
4. The relevant domain design and endpoint catalog documents

For the current PATS design work, also load:

5. `docs/superpowers/context/2026-07-14-pats-api-design-context.md`
6. `docs/superpowers/specs/2026-07-14-pats-api-target-design.md`
7. `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md`
8. `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md`

The approved RESTful Endpoint Design Standards, version 1.2.1, are mandatory. They are not
optional guidance. If a requested endpoint conflicts with the standard, the agent MUST stop,
describe the conflict, and obtain an explicit case-specific exception before proceeding.

Every endpoint change must leave review evidence showing:

- the applicable standard sections were checked;
- the endpoint's resource, method, relationship, response, error, security, concurrency, and
  idempotency behavior was defined;
- OpenAPI documentation matches the implementation;
- the endpoint does not silently inherit a legacy route shape;
- any exception has a documented scope, reason, owner, and expiry or review condition.

## Active PATS Design Package

The current design package is documentation-first and must complete its sequential chain before
implementation begins:

- Context: `docs/superpowers/context/2026-07-14-pats-api-design-context.md`
- Architecture: `docs/architecture/2026-07-14-pats-api-target-architecture.md`
- Data model: `docs/data/2026-07-14-pats-api-data-model-design.md`
- Endpoint catalog: `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`
- Cross-cutting design: `docs/api/2026-07-14-pats-api-cross-cutting-design.md`
- Decisions: `docs/decisions/2026-07-14-pats-api-design-decision-register.md`
- Chain prompts: `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md`
- Handover prompt: `docs/superpowers/prompts/2026-07-14-pats-api-design-handover.md`

Until the chain's final consistency gate passes and the user approves implementation, agents must
not add new business endpoints or change the PATS schema.

## Architecture and Scope Rules

- Design API contracts before implementing routes, schemas, or controllers.
- Use the canonical PATS domain model and mark uncertain requirements as
  `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`; do not guess.
- Treat the current legacy PMS API and seeded/demo data as compatibility evidence, not as
  canonical PATS behavior.
- Preserve existing user changes and unrelated work.
- Do not change authentication, authorization, persistence, migrations, production deployment,
  or data-retention behavior without a reviewed design and explicit approval.
- No endpoint is complete until focused tests, API contract validation, and relevant operational
  checks pass.

## Required Handoff

Every endpoint design or implementation handoff must state:

- standard sections reviewed;
- resource and tenancy scope;
- request and response contract;
- status codes and RFC 9457 problem types;
- authorization and object-level access checks;
- concurrency and retry/idempotency behavior;
- tests and OpenAPI validation performed;
- unresolved questions and any approved exception.
