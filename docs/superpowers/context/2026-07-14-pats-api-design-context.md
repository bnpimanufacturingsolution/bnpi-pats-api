# Bandai PATS API Design Context

**Status:** DESIGN BASELINE

**Date:** 2026-07-14

**Purpose:** Give a future agent enough context to design the PATS API from domain and
operational truth without deriving the contract from the unfinished frontend prototype.

## Operating position

The API is being designed before further endpoint implementation. The frontend prototype is
an alignment reference only. It can reveal terminology, user journeys, and compatibility needs,
but it cannot define API resource identity, persistence shape, authorization, lifecycle rules, or
endpoint semantics.

The current API contains a legacy PMS surface and a separate PATS PostgreSQL/Prisma draft. The
legacy surface is not the canonical PATS model. The PATS catalog read route is a proof slice, not
the final public contract.

## Source precedence

When evidence conflicts, use this order and record the result:

1. Explicit user or stakeholder decisions recorded in an accepted decision document.
2. `docs/standards/restful-endpoint-design-standards.md` for HTTP endpoint behavior.
3. Approved PATS business requirements and architecture decisions.
4. This design package and its decision register.
5. Current API code, migrations, configuration, and tests as evidence of implementation reality.
6. Frontend types, routes, fixtures, and UI behavior as alignment evidence only.
7. Seeds, initials, filenames, display names, generated artifacts, and legacy routes as
   compatibility evidence only.

Any unresolved or conflicting item must be labelled `NEEDS_CONFIRMATION`, `CONFLICTING`, or
`STALE`. The agent must not silently choose between conflicting sources.

## Mandatory standards

Before any endpoint design, implementation, review, or OpenAPI change, read:

- `AGENTS.md`
- `docs/standards/restful-endpoint-design-standards.md`
- `docs/principles/restful-endpoint-design-principle.md`
- `docs/standards/endpoint-design-review-checklist.md`

The internal REST standard is mandatory. A design exception must be explicit, scoped, approved,
and time-bounded.

## Working domain truth

- PATS is a production and assembly tracking system, not an ERP.
- Raw-material consumption remains outside PATS unless a later decision changes that boundary.
- The primary operational object is a Part moving through a configured route.
- A Batch is the scannable production/container unit.
- A Lot groups production planning and traceability.
- A Product contains Models; a Model contains catalog-level ModelParts.
- A Parts List version declares ordered routing for project-specific Parts.
- Stage events and inventory transactions are operational records, not UI-only state.
- Routing violations and variance alerts must remain traceable to the event or transaction that
  produced them.
- One workspace per physical assembly line is a working direction; the user-facing term
  `Line` versus internal API term `Workspace` remains a decision to ratify.
- PostgreSQL, Prisma migrations, MinIO, and Docker are the current on-prem foundation direction.

## Explicit non-canon

The following must never become identity or business truth:

- seeded initials;
- display names used as identifiers;
- image filenames used as model identity;
- demo-only product rows;
- legacy Mongo/PMS product records;
- frontend localStorage state;
- generated OpenAPI or Postman output without a reviewed source contract.

## Design constraints

- No code, Prisma schema, route, seed, or frontend change is part of the design phase.
- The design must be implementable as a modular monolith before any future service split.
- Public endpoint paths start at `/api/v1` and follow the approved REST standard.
- Tenancy and object-level authorization must be explicit for every protected resource.
- Core business relationships belong in PostgreSQL relations with constraints; JSON is reserved
  for bounded metadata whose schema is separately defined.
- Operational ledgers are append-oriented. Derived dashboards and reports are projections.
- Air-gapped on-prem operation is a first-class deployment constraint.

## Required design outputs

The design chain must produce:

- bounded-context map and dependency rules;
- canonical data model and invariants;
- lifecycle/state-machine definitions;
- API contract conventions and endpoint catalog;
- authorization matrix;
- files, events, audit, observability, and operational design;
- decision register with explicit unresolved items;
- implementation backlog ordered by dependency;
- a handover prompt that can restart the design or implementation chain in another session.
