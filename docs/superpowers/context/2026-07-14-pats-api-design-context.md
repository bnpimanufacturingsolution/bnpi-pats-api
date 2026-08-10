# Bandai PATS API Design Context

**Status:** DESIGN CHAIN COMPLETE — PENDING USER APPROVAL

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
- The user has stated that PATS is not a SaaS multi-tenant system. A single on-prem deployment is
  the working context; whether one database may serve multiple physical lines remains D-029
  `NEEDS_CONFIRMATION`. `Workspace` is no longer treated as canonical tenant truth.
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

## Final chain state (2026-07-14)

All eight documentation passes have been executed sequentially. The package is internally
consistent as a proposed design and handover, but it is not an implementation approval. The
following identities are deliberately left visible rather than silently resolved:

- `Workspace` is not canonical tenant truth. The first deployment uses one operational context;
  `ProductionLine` remains a possible domain identity only if D-029 confirms multiple lines or a
  meaningful line-level business boundary.
- `PlanningAggregate` is the decision-neutral domain term; the catalog's `production-plans` path
  is a `WORKING_DEFAULT` pending D-024's Project/ProductionPlan decision.
- `LotPartAllocation` preserves the unresolved one-Part versus controlled multi-Part Lot rule
  under D-010.
- `+/-5%` variance is business evidence, not an accepted calculation contract; D-021 remains
  `CONFLICTING` until units, rounding, threshold precedence, and owner are accepted.
- Identity provider, capabilities-to-roles, actor identity, station mapping, catalog ownership,
  PMRS, rework/correction, asset ownership, backup/retention, and deployment ownership remain
  explicitly labelled in the decision register.

The next permitted activity is user review and explicit approval of the implementation phase.
Implementation must restart from the reading order and dependency-ordered backlog in the final
handover prompt; it must not infer approval from this chain's completion.

## Pass 1 evidence and scope lock (2026-07-14)

### Repository evidence

The API checkout is on `develop` with a clean working tree at the start of this chain. The
runtime is still the inherited Express/Mongo/Prisma surface. `README.md` identifies the
PostgreSQL PATS schema as a standalone, provisional, unwired draft with no runtime import,
production seed, or API registration. This is implementation evidence, not canonical domain
truth.

The following implementation facts are therefore classified as `CONFIRMED_IMPLEMENTATION`
only:

| Evidence | Classification | Design consequence |
|---|---|---|
| `prisma/schema/**` and the inherited `app/**` modules use the legacy PMS/runtime surface | `CONFIRMED_IMPLEMENTATION` | Do not copy legacy resource identity or route shape into canonical PATS contracts |
| `prisma/pats/schema.prisma` is PostgreSQL, standalone, and unwired | `CONFIRMED_IMPLEMENTATION` | It is a draft to reconcile, not a migration specification or API source of truth |
| `GET /api/pats/catalog/products/{productId}` exists as a proof slice | `CONFIRMED_IMPLEMENTATION` | Classify as `TRANSITIONAL` evidence; replace or explicitly migrate before implementation |
| Current protected legacy routes use bearer authentication and workspace membership patterns | `CONFIRMED_IMPLEMENTATION` | Reuse only as compatibility evidence; provider and canonical subject mapping remain open |
| Existing generated Swagger/Postman material describes retained routes | `CONFIRMED_IMPLEMENTATION` | Generated artifacts are not approved canonical contracts |
| Existing tests primarily cover mocked legacy controllers and boundary contracts | `CONFIRMED_IMPLEMENTATION` | Future PATS endpoints need new contract, authorization, persistence, and tenancy tests |

### Business and domain evidence

The sibling BRD/PRD and architecture packet are draft or working-design documents. They provide
the following `BUSINESS_EVIDENCE` and `WORKING_DEFAULT` inputs, but do not silently resolve their
open questions:

- PATS is a WIP/MES capability for production and assembly tracking, not an ERP; raw-material
  consumption remains outside the boundary.
- A `Part` follows a part-specific ordered route defined by a versioned Parts List.
- A `Lot` is a planning/traceability grouping and a `Batch` is the barcode/QR-scannable
  production/container unit. The exact Lot-to-Part cardinality remains `NEEDS_CONFIRMATION`.
- Receiving and Issuance are the currently named inventory movements; withdrawal-form ownership
  and requiredness remain `NEEDS_CONFIRMATION`.
- Stage events, inventory transactions, routing violations, process-change records, audit
  records, and projections have distinct responsibilities. A dashboard is not the write-side
  source of truth.
- Workflow groups, stages, substages, stations, and work instructions are intended to be
  configurable; ownership and station granularity remain `NEEDS_CONFIRMATION`.
- The current working execution rule is forward-only. Rework, reversal, defect, and correction
  behavior remain `NEEDS_CONFIRMATION`.
- One operational context per on-prem deployment is the current working direction. A shared
  database for multiple physical lines is D-029 `NEEDS_CONFIRMATION`; no workspace membership or
  cross-tenant behavior is canonical for the first implementation.

### On-prem operational evidence

The on-prem readiness document is `PROPOSED`, not an accepted production topology. It records
these operational constraints as `OPERATIONAL_EVIDENCE`:

- Runtime must be able to operate air-gapped: no registry pulls, external SaaS logging, or
  Cloudinary-style external asset dependency at runtime.
- Docker Compose is the default appliance runtime; Hyper-V/K3s/Argo CD is an opt-in target path,
  not an implementation assumption for this design chain.
- The target direction is isolated per-environment persistence, private MinIO-compatible object
  storage, immutable image tags, and stdout/host-collected structured logs.
- Identity, backup ownership, retention, RPO/RTO, hardware/scanner/printer details, and final
  environment topology are not confirmed. They remain design decisions rather than invented
  operational requirements.
- The prior baseline observed an unavailable Docker Desktop Linux daemon and a local PostgreSQL
  process, but neither observation authorizes infrastructure mutation or proves a production
  database boundary.

### Frontend alignment boundary

The sibling app is alignment evidence only. Its PATS types, fixtures, localStorage release seam,
routes, labels, seeded images, and projection helpers can reveal terminology and user journeys,
but they cannot define API identity, persistence, authorization, lifecycle, or HTTP semantics.
In particular:

- `localStorage` draft/release state is prototype transport, not persistence truth;
- seeded model numbers, initials, display names, image filenames, and demo records are not
  identifiers;
- the app's `Planner`, `Administrator`, and `Production Floor Staff` vocabulary is a working
  role recommendation, not an accepted authorization matrix;
- the app's fixed-stage legacy snapshot and current UI labels do not define the canonical
  workflow model.

### Evidence classification rules for the remaining passes

Every design statement must carry one of these meanings, explicitly or by section heading:

- `CONFIRMED_STANDARD`: required by the approved REST standard or endpoint checklist;
- `CONFIRMED_PACKAGE`: accepted by the current API design package and not contradicted by a
  higher-precedence source;
- `CONFIRMED_IMPLEMENTATION`: observed code/config/test behavior, retained as compatibility
  evidence only;
- `BUSINESS_EVIDENCE`: present in the draft BRD/PRD or stakeholder-derived materials;
- `WORKING_DEFAULT`: a design recommendation used to continue read-only design;
- `INFERRED`: a reasoned interpretation that must not become an identity or invariant without
  acceptance;
- `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`: unresolved, contradictory, or time-sensitive
  material that blocks the affected write contract or implementation.

### Locked scope

This chain may modify design-package Markdown and pass/handover reports only. It must not modify
application source, Prisma schemas, migrations, generated artifacts, seeds, deployment files,
frontend files, or the approved REST standard. Read-only inspection of those surfaces is allowed
as evidence. No write endpoint is implementation-ready while any decision listed as blocking in
the decision register remains unresolved.

## Active supplemental client-evidence chain (2026-07-15)

The client-supplied B248 Product Master, Parts List, and PMRS artifacts are reconciled by
`docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-chain.md`. That
chain is a required supplemental gate before implementation approval. It does not replace this
context or the original eight-pass chain. Its current outcomes are:

- controlled Product Master, Parts List, and PMRS revisions are bounded business evidence;
- B248 BOM/process/packaging structure is separate from executable route steps;
- PATS owns PATS-scope material requirements and issue evidence; PMRS is a reconciled control
  projection/reference and external ERP/Warehouse owns physical stock/procurement;
- Kuririn part-code and Asia quantity conflicts remain visible and block affected release;
- D-030 through D-036 have decisive target behavior applied; source correction/effective-revision
  evidence remains a controlled release gate.
