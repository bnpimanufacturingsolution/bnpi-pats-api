# Bandai PATS API Design Decision Register

**Status:** OPEN DESIGN REGISTER

**Rule:** `NEEDS_CONFIRMATION` items must not be silently resolved in code, schema, or endpoint
contracts.

| ID | Decision | Current recommendation | Status |
|---|---|---|---|
| D-001 | Workspace versus Line API noun | Keep `workspace` as internal tenancy until identity and terminology are ratified; expose `Line` only where product language is approved | NEEDS_CONFIRMATION |
| D-002 | Tenant scoping style | Use one-level workspace-scoped resources and explicit server-side membership checks | PROPOSED |
| D-003 | Database | PostgreSQL with Prisma migrations | WORKING DEFAULT |
| D-004 | Architecture | Modular monolith with bounded contexts and ports/adapters | PROPOSED |
| D-005 | Catalog ownership | Decide system-seeded, workspace-owned, or layered catalog configuration | NEEDS_CONFIRMATION |
| D-006 | Identity provider | Define OIDC/on-prem directory/local authentication mode and subject mapping | NEEDS_CONFIRMATION |
| D-007 | PMRS | Keep PMRS minimal and unextended until the business structure is confirmed | NEEDS_CONFIRMATION |
| D-008 | Station granularity | Decide whether a station represents a Stage, SubStage, or configurable bundle | NEEDS_CONFIRMATION |
| D-009 | Rework and reversal | Current working rule is forward-only; define hold, correction, rework, and reversal policy | NEEDS_CONFIRMATION |
| D-010 | Lot cardinality | Resolve whether a Lot is plan-wide, part-specific, or a controlled grouping | NEEDS_CONFIRMATION |
| D-011 | Route versioning | Published Parts List versions are immutable; active batches retain their version | PROPOSED |
| D-012 | Current batch position | Derive from valid StageEvents and maintain a rebuildable projection | PROPOSED |
| D-013 | Event and audit strategy | Append-oriented ledgers plus transactional outbox and audit records | PROPOSED |
| D-014 | Asset ownership | Introduce first-class asset metadata and private MinIO references | NEEDS_CONFIRMATION |
| D-015 | API response shape | Direct single resources; `{ data, pagination }` for collections; RFC 9457 errors | PROPOSED |
| D-016 | API versioning | `/api/v1` from the first canonical public contract | PROPOSED |
| D-017 | Backup and recovery | Define owner, retention, RPO, RTO, encryption, and restore rehearsal | NEEDS_CONFIRMATION |
| D-018 | External integrations | Use ports/adapters; keep external identity, printer, scanner, and storage dependencies optional | PROPOSED |

## Decision acceptance rules

A decision becomes accepted only when a reviewer records the choice, rationale, affected
documents, implementation impact, and any migration/rollback requirement. Updating a frontend
fixture or API seed does not accept a domain decision.

## Blocking decisions before write endpoints

The following must be resolved before implementing planning or execution writes:

- D-001, D-005, D-006, D-008, D-009, D-010, D-014, and D-017.

Read-only design and contract work may continue while these are open, provided the open status is
visible in the contract.
