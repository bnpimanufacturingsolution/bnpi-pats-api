# PATS API Gate 0 Decisive Target Resolution

**Status:** DECISIVE TARGET SET CONFIRMED — GATE 0 FROZEN; IMPLEMENTATION APPROVED

**Date:** 2026-07-15

## Purpose

At the user's request, this addendum converts the full Gate 0 working package into concrete
target-design choices. The user reviewed and confirmed the complete set on 2026-07-15. The
confirmation does not silently erase the historical `NEEDS_CONFIRMATION`, `CONFLICTING`, or
`STALE` classifications in the original register.

## Decisive target choices

| Decision | Decisive target choice | Rationale and implementation impact |
|---|---|---|
| D-001 / D-002 / D-029 | First release is one server-resolved operational context. Persist no Workspace, membership tenancy, client-selected tenant scope, or ProductionLine. | Matches the stated on-prem operating model; avoids fake SaaS tenancy. Revisit only for a real shared database/line identity requirement. |
| D-003 | PostgreSQL with Prisma is the canonical relational persistence direction. | Relational constraints, transactions, audit, idempotency, outbox, and projections have one durable source. |
| D-004 | Use a modular monolith with bounded contexts and ports/adapters. | Keeps domain ownership explicit without premature distributed-systems complexity. |
| D-005 | Catalog configuration is deployment-owned in the first release; no shared/system templates or line layers. | Prevents unapproved precedence and inheritance rules; future sharing requires a separate migration gate. |
| D-006 | Use a provider-neutral on-prem OIDC-compatible adapter. Persist `(provider, issuer, providerSubject)`; claims are never authorization truth. | Provider configuration stays deployable without coupling domain records to one identity vendor. Disabled subjects fail closed. |
| D-007 | PATS owns approved PATS-scope MaterialRequirements and append-only issue evidence. PMRS is a reconciled control projection/reference; ERP/Warehouse owns physical stock and procurement. | Separates planning/traceability truth from external stock authority and prevents mutable PMRS balances. |
| D-008 | A Station is a physical execution endpoint. `StationStep` binds it to a Stage plus optional SubStage/configurable execution unit; a Station is not itself a Stage or SubStage. | Supports configurable station routing while keeping route eligibility explicit and relational. |
| D-009 | First release is forward-only: holds and compensating corrections are supported; terminal work is not reopened and generic rework/reversal is excluded. | Protects evidence integrity. Rework requires a later explicit correction/rework model and migration. |
| D-010 | A Lot is a controlled multi-Part grouping with one or more explicit `LotPartAllocation` rows. Lots are created after a plan/route version is released; each allocation carries quantity/UOM. | Preserves controlled grouping without forcing one Part per Lot; Batch composition cites allocations and remains frozen. |
| D-011 | Published Parts List/route versions are immutable; active Lots/Batches retain their cited version. | Later catalog or plan edits cannot rewrite execution history. |
| D-012 | Current batch position is a rebuildable projection derived from accepted StageEvents and updated atomically with the event when bounded. | The event ledger remains source truth and UI/current-stage fields cannot become authoritative. |
| D-013 | Use append-oriented domain ledgers plus transactional audit and outbox records. | Source mutation, audit, idempotency result, and outbox intent commit together; delivery is at-least-once. |
| D-014 | API owns Asset metadata, authorization, checksums, and typed links; private MinIO owns bytes. First release has no ordinary byte deletion; retirement/quarantine and cleanup are operator-controlled and legal-hold aware. | Prevents public object keys and accidental evidence loss; exact retention policy is operational configuration, not a business identity rule. |
| D-015 | Single resources return direct representations; collections return `{data,pagination}`; failures use RFC 9457 Problem Details. | Aligns every endpoint with the approved REST standard. |
| D-016 | All canonical HTTP routes start at `/api/v1`. | Establishes versioning before public implementation. |
| D-017 / D-023 / D-028 | First runtime is one Docker Compose appliance with API, PostgreSQL, and private MinIO; Redis is optional; TLS is at the approved operator boundary. Target recovery is RPO ≤ 1 hour, RTO ≤ 4 hours, daily coordinated backups with hourly PostgreSQL WAL where supported, 30-day retention, operator-managed encryption keys, and quarterly isolated restore rehearsal. | Gives on-prem operations concrete defaults while keeping deployment artifacts outside this design task. Operations owns backup/restore and promotion. |
| D-018 | External identity, scanner, printer, and storage integrations use ports/adapters; no external dependency is required for core domain truth. | Air-gapped operation remains possible and adapter failure cannot fabricate success. |
| D-019 | Legacy PMS routes, generated docs, legacy Prisma, seeds, and fixtures remain compatibility evidence only. | No legacy route or field is promoted to canonical PATS identity or behavior. |
| D-020 | Withdrawal Form is external. `Issuance` requires a typed external withdrawal/reference value; `Receiving` may omit it. PATS validates namespace/shape only and does not own the form. | Makes traceability evidence required where it matters without inventing a PATS form resource. |
| D-021 | Persist quantity magnitude as `numeric(18,6)` with controlled UOM, optional numerator/denominator usage basis, precision, and source representation. Use only approved conversions; round half-up to declared target scale; default tolerance is zero/strict equality; explicit tolerance is stored per requirement/operation and owned by Planning/Quality. | Prevents silent ratio conversion and global tolerance assumptions. Unsupported conversion blocks the command with auditable variance evidence. |
| D-022 | Frontend localStorage, seeded fixtures, initials, filenames, and generated artifacts are stale/alignment evidence only. | They cannot define identity, persistence, authorization, or concurrency. |
| D-024 | `ProductionPlan` is the canonical public planning noun and `/api/v1/production-plans` is canonical. `PlanningAggregate` is the internal neutral term; `Project` is compatibility terminology only. | Removes public noun ambiguity while preserving historical vocabulary mappings. |
| D-025 | Audit and operational records reference stable Subject identity; only bounded display-name/email snapshots may be retained as historical evidence. | Provider claims and free-form actor strings cannot become authorization or audit identity. |
| D-026 | Authorization is capability-first. Initial role bundles are `catalog-manager`, `planner`, `production-operator`, `inventory-controller`, `quality-reviewer`, and `operations-admin`; actual access is evaluated from assigned capabilities, never role names alone. | Provides least-privilege bundles while keeping capability vocabulary as the enforcement contract. No automatic admin assignment. |
| D-027 | PostgreSQL and MinIO are backed up/restored as one coordinated set under the Operations owner; asset metadata/checksum/link reconciliation is mandatory before reopening writes. | Prevents database/object divergence and makes restore evidence testable. |
| D-030 | Product Master, Parts List, and PMRS each have controlled document identity plus immutable revisions: `draft -> validated -> approved -> superseded`, with rejected drafts retained as evidence. | Source lineage, approvals, and supersession are relational and distinct from business content. |
| D-031 | Catalog separates `PartDefinition`/`PartApplicability`, `BomDefinition`/`BomLine`, `ProcessSpecification`/steps, `PackagingSpecification`/lines, and executable `PartsListVersion`/`RouteStep`. | Prevents spreadsheet-shaped or route-shaped overloading. |
| D-032 | Use distinct namespaces: `PRODUCT_B248`, `PART_CANONICAL`, `EXTERNAL_ITEM`, `DOCUMENT_CONTROL`, `PMRS_CONTROL`, `EQUIPMENT_MOLD`, and `WITHDRAWAL_REFERENCE`. | Prevents B248, item numbers, PMRS controls, equipment references, and part codes from becoming aliases. |
| D-033 | `B248-02-08` is the canonical Kuririn Body code; `B248-01-08ST` is invalid source evidence only. Publication requires a corrected Parts List revision and preserved correction evidence. | Resolves the target identity while protecting source history and release safety. |
| D-034 | Demand allocations require model, market/region, demand purpose, quantity/UOM/usage basis, source revision, and lifecycle. Model totals are calculated from active committed lines and are not independently editable. | Preserves planning meaning and eliminates duplicate totals. |
| D-035 | Treat PMRS `/01` as the superseding control revision for PATS reconciliation, not an additive issue cycle. The latest approved line values govern: total `77,860`, issued `77,060`, balance `800`; the stale header is retained as evidence. | Prevents cross-revision double counting and makes the line/header derivation deterministic. A source owner can change this only through controlled revision review. |
| D-036 | Persist `SubjectPreference` with locale `EN`, `JA`, or `FIL`; persist one immutable walkthrough completion per subject/key/version. Neither grants authorization. | Makes self-service preference state server-owned without mixing it with identity or capability truth. |

## Approval boundary

This is a decisive target-design set, not a claim that the agent is the business owner for every
decision. The user confirmation is the explicit Gate 0 approval for the target design. Existing
historical labels remain preserved. Source-owner correction and effective-revision evidence remain
mandatory release prerequisites for the affected source data, but do not block the authorized
Gate 1 implementation chain.

## Recorded user confirmation and Gate 0 outcome

- **Approval date:** 2026-07-15.
- **Repository/branch:** `bnpi-pats-api` / `develop`.
- **Confirmation evidence:** The user stated, “I'm good with this now, you can proceed,” after
  reviewing this complete decisive target set.
- **Interpretation:** The user confirmed the full set with no amendments stated, froze Gate 0, and
  explicitly approved implementation to begin.
- **Scope boundary:** The historical evidence classifications remain unchanged. D-033/D-035
  corrected source revisions and effective-revision registration remain controlled release gates.
- **Next chain:** Begin the separate Gate 1 common HTTP implementation chain.

## Confirmation wording retained for audit

```text
I confirm the decisive target choices in
docs/superpowers/chains/2026-07-15-pats-api-gate-0-decisive-target-resolution.md,
with any listed amendments. Freeze Gate 0 and approve implementation to begin.
```

This wording is retained as the approval template; the user's direct confirmation above is the
recorded approval. The next separate chain starts at Gate 1 common HTTP infrastructure.

## User amendment to D-006 (2026-07-15)

The user clarified that this deployment will not use SSO/OIDC. The implementation target is
amended to PATS-local authentication plus RBAC:

- PATS authenticates local application accounts through a deployment-local adapter;
- the authenticated stable local account maps to `Subject` using the local identity namespace;
- `SubjectAssignment` role bundles and direct capabilities remain the authorization truth;
- no OIDC issuer, JWKS discovery, corporate SSO, or external identity-provider dependency is
  required for the first release;
- client-supplied roles, workspace IDs, and capability strings remain untrusted.

This amendment supersedes the earlier OIDC-compatible working direction for D-006 while
preserving the historical wording and evidence above. The generic `IdentityAuthenticator` port
remains valid because it now represents the PATS-local authentication adapter.
