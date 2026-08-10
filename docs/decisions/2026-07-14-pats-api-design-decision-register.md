# Bandai PATS API Design Decision Register

**Status:** OPEN DESIGN REGISTER

**Rule:** `NEEDS_CONFIRMATION` items must not be silently resolved in code, schema, or endpoint
contracts.

| ID | Decision | Current recommendation | Status |
|---|---|---|---|
| D-001 | Workspace versus Line API noun | First release uses one server-resolved deployment context; no Workspace or ProductionLine persistence. Reopen only for a real shared-database/line authorization boundary | PROPOSED |
| D-002 | Operational ownership style | For the first single-context deployment, use deployment-level capability authorization and ordinary relational ownership; introduce line-scoped ownership/FKs only if multiple lines share one database | PROPOSED |
| D-003 | Database | PostgreSQL with Prisma migrations | WORKING DEFAULT |
| D-004 | Architecture | Modular monolith with bounded contexts and ports/adapters | PROPOSED |
| D-005 | Catalog ownership | Use deployment-owned catalog configuration for the first implementation; decide later whether system/shared templates or line layers are required | NEEDS_CONFIRMATION |
| D-006 | Identity provider | Use an on-prem OIDC-compatible directory adapter boundary; persist provider/issuer/providerSubject and keep provider claims out of authorization truth | NEEDS_CONFIRMATION |
| D-007 | PMRS | PATS owns approved PATS-scope material requirements and issue evidence; PMRS is a generated/reconciled control projection; external ERP remains physical stock/procurement authority | PROPOSED |
| D-008 | Station granularity | **Station = device endpoint** bound to Stage and/or SubStage steps (configurable bundle via StationStep). **Default install:** one Station per SubStage when sub-stages exist; Stage-level Station when no sub-stages or shared PC. **Process is not a device mount** (cost). Physical **Booth** is separate capacity (N booths : 1 Station). Product owner 2026-08-10. | WORKING DEFAULT |
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

- D-001, D-005, D-006, D-007, D-008, D-009, D-010, D-014, D-017, D-020, D-021, D-024, D-025,
  D-026, D-027, D-028, D-029, D-030, D-031, D-032, D-033, D-034, D-035, and D-036 where
  applicable to the affected write.

Read-only design and contract work may continue while these are open, provided the open status is
visible in the contract.

## Pass 8 decision summary

No open decision was silently converted to `PROPOSED` or `CONFIRMED`. The register contains the
remaining approval gates for tenancy/terminology, catalog ownership, identity/capabilities,
station mapping, PMRS, rework/correction, Lot cardinality, route versioning, asset lifecycle,
quantity/variance, Withdrawal Forms, actor identity, audit/backup retention, and on-prem delivery.

The design chain may complete with these items open because the user requested a documentation
design and handover. Implementation of any affected write contract remains blocked until the
decision is accepted with owner, rationale, affected documents, implementation impact, and
rollback/migration or review condition.

## Pass 1 evidence classification

The following distinctions apply to every decision in this register:

- `CONFIRMED_STANDARD` means mandated by the repository-owned REST standard or review checklist.
- `CONFIRMED_PACKAGE` means accepted by the current API design package without a higher-priority
  conflict.
- `CONFIRMED_IMPLEMENTATION` means observed in the existing API and retained only as
  compatibility evidence.
- `BUSINESS_EVIDENCE` means present in draft stakeholder-derived BRD/PRD material.
- `WORKING_DEFAULT` or `INFERRED` may guide read-only design but cannot authorize a write contract.
- `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` remain visible until an owner accepts the
  choice with rationale, affected documents, implementation impact, and rollback/migration notes.

## Pass 1 findings and new decisions

| ID | Evidence-led finding | Status | Impact |
|---|---|---|---|
| D-019 | The live API, generated docs, and legacy Prisma schema describe compatibility behavior, while `prisma/pats/schema.prisma` is a separate unwired PostgreSQL draft | `CONFLICTING` | No legacy route, generated artifact, or current schema field may be promoted to canonical PATS contract without review |
| D-020 | The sibling BRD/PRD names Receiving and Issuance but does not establish whether PATS owns Withdrawal Forms | `NEEDS_CONFIRMATION` | Inventory write requests may carry an external reference, but PATS must not create, validate, or own the form resource yet |
| D-021 | Draft business material cites `+/-5%` variance, while the persistence draft contains per-Part thresholds and a fallback behavior | `CONFLICTING` | Variance calculations remain design-only until the authoritative unit, rounding, threshold precedence, and override owner are accepted |
| D-022 | The app uses localStorage release snapshots and seeded fixtures for planning/execution alignment | `STALE` | Prototype transport/state behavior is not an API persistence or concurrency contract |
| D-023 | The on-prem readiness document proposes Docker-first air-gapped deployment but leaves identity, backup ownership, recovery objectives, and topology open | `NEEDS_CONFIRMATION` | Operations design must define control boundaries and test hooks without inventing client-owned values |

| D-024 | Draft business documents call the planning aggregate `Project`, while the target endpoint inventory calls it `ProductionPlan` | `NEEDS_CONFIRMATION` | No public planning route or database identity is canonical until the domain noun and compatibility mapping are accepted |

| D-025 | The current schema uses `String actor`, while audit requirements need a stable subject reference plus an optional historical snapshot | `NEEDS_CONFIRMATION` | Identity mapping and snapshot fields must be accepted before audit or operational writes are implemented |

| D-026 | Final role names and capability-to-role mapping are not present in the stakeholder BRD/PRD and differ between legacy/API and frontend working defaults | `NEEDS_CONFIRMATION` | The catalog uses capability names only; no endpoint write may rely on an unaccepted role mapping |

| D-027 | MinIO asset bytes and PostgreSQL asset metadata need coordinated backup, restore, retention, and orphan cleanup ownership | `NEEDS_CONFIRMATION` | Asset availability and restore verification cannot be accepted without a named owner and rehearsal |

| D-028 | The on-prem target describes Docker-first delivery with an optional Hyper-V/K3s/Argo CD path, but exact environment topology and promotion ownership are not accepted | `NEEDS_CONFIRMATION` | Release design must use immutable artifacts and explicit gates without assuming ports, replicas, or operator roles |
| D-029 | The user states that PATS is not a SaaS multi-tenant system, while the prior design treated one Workspace per physical line as tenant membership | `NEEDS_CONFIRMATION` | The first implementation must choose single deployment context versus multiple physical lines in one database; do not implement workspace membership or cross-tenant behavior before this is confirmed |

### Pass 1 stop-condition assessment

The user-facing domain can be separated from legacy PMS terminology, and the REST standard can be
applied without an exception. No write endpoint is being approved. The unresolved items above are
logged for the architecture, lifecycle, endpoint, and operations passes; none is silently resolved.

## Pass 2 client-evidence findings and candidate decisions

The following findings are added from the B248 Product Master, Parts List, and PMRS evidence. They
are not accepted decisions.

| ID | Evidence-led finding | Current recommendation | Status |
|---|---|---|---|
| D-030 | Product Master, Parts List, and PMRS are distinct controlled artifacts with revision, provenance, and approval evidence | Add a bounded controlled-document revision/lineage concept; link selected revisions to product snapshots, Parts List versions, and PMRS references without collapsing their domains | `PROPOSED` |
| D-031 | The Parts List contains shared/model-specific parts, multi-level content, process parameters, decoration/assembly structure, and packaging hierarchy | Separate part definitions/applicability, BOM lines, process specifications, packaging structures, and execution routes | `PROPOSED` |
| D-032 | B248, item number 2849226, PMRS control numbers, mold/part codes, and regional codes coexist | Use separate typed identifier namespaces: B248 product code, 2849226 external item number, PMRS control/document identifiers, equipment/mold identifiers, and part codes | `PROPOSED` |
| D-033 | The Parts List contains an unresolved Kuririn Body cross-reference conflict | Canonicalize the affected part as `B248-02-08`; reject `B248-01-08ST` as an invalid source reference, record the correction, and block publication until the source revision is corrected | `PROPOSED` |

### Pass 2 impact on existing decisions

- D-005 is affected because catalog ownership now includes controlled part, process, and packaging
  specifications; deployment ownership remains a working default.
- D-007 remains open; the PMRS workbook does not prove that PATS owns requisitions or issues.
- D-010 remains open; BOM applicability and Lot cardinality are separate decisions.
- D-021 remains `CONFLICTING`; mixed units and packaging ratios strengthen the need for an
  accepted quantity/UOM and variance policy.
- D-024 remains open; client evidence does not select `Project` versus `ProductionPlan`.

The blocking list now also includes D-030, D-031, D-032, and D-033 for affected catalog,
planning, and release writes. No candidate decision has been silently promoted to `PROPOSED` or
`CONFIRMED`.

## Pass 3 client-evidence findings and candidate decisions

| ID | Evidence-led finding | Current recommendation | Status |
|---|---|---|---|
| D-034 | PMRS distinguishes market/region and demand purpose in addition to model and total quantity | Make market/region and demand purpose first-class plan-demand allocations; model totals are calculated/reconciled and not independently editable | `PROPOSED` |
| D-035 | PMRS header, forecast, order, issued, and balance values can disagree across revisions/cycles | Treat the latest approved line-level revision as canonical; derive headers and balances; reject stale/manual totals during validation | `PROPOSED` |

### Pass 3 impact on existing decisions

- D-007 remains `NEEDS_CONFIRMATION`, but the safe interim recommendation is a PMRS reference and
  source-snapshot boundary, not a generic PMRS table.
- D-020 remains `NEEDS_CONFIRMATION`; Withdrawal Form and external issue ownership are not proven.
- D-021 remains `CONFLICTING`, strengthened by piece, ratio, length-per-pack, rounding, and
  variance evidence.
- D-024 remains `NEEDS_CONFIRMATION`; demand dimensions refine planning but do not choose the
  planning aggregate noun.
- D-010 remains separate from demand allocation; Lot cardinality cannot be inferred from PMRS
  model quantities.

The blocking list now includes D-034 and D-035 for affected planning, material, and quantity
writes. No candidate decision has been silently accepted.

## Pass 4 conflict register and recommendation table

The following conflicts are not silently resolved. Recommendations are safe interim design
directions, not accepted business decisions.

| Conflict | Source evidence | Classification | Safe interim behavior | Recommended confirmation |
|---|---|---|---|---|
| C-001 Kuririn Body code/name mismatch | Parts List `Inj`/PMRS identify `B248-02-08`; Parts List `Deco` contains `B248-01-08ST` with a Kuririn Body name/reference | `CONFLICTING` | Preserve both source references and their source locations; keep affected revision draft; block effective executable release under D-033 | Product Engineering/Document Control confirms the intended part code and issues a corrected controlled source revision |
| C-002 Asia quantity discrepancy | Asia header shows 77,060 while revised/current order evidence supports 77,860; `/01` shows prior issue/order relationship | `CONFLICTING` | Preserve header, line/order, issued, and calculated values as separate observations; block dependent release | Planning/Warehouse confirms whether `/01` is supplemental, replacement, or stale and which total governs |
| C-003 Effective revision relationship | Product Master, Parts List rev 6, and PMRS workbook have different control/revision/date presentations | `NEEDS_CONFIRMATION` | Store source revision/provenance; do not infer active status from file modified time | Document Control identifies the effective revision set and supersession chain |
| C-004 Identifier crosswalk | B248, item 2849226, PMRS controls, mold numbers, and part codes coexist | `NEEDS_CONFIRMATION` | Keep distinct typed identifiers and source namespaces; no global alias or replacement | Product/Planning owner confirms identifier meaning and canonical crosswalk |
| C-005 PMRS system ownership | Workbook shows planning/warehouse use but not PATS system ownership | `NEEDS_CONFIRMATION` | Apply the approved target: PATS owns PATS-scope requirements/issues; PMRS is a control projection; external ERP/Warehouse owns physical stock/procurement | Record the target ownership and external integration boundary in Gate 0 |
| C-006 Demand and quantity semantics | PMRS contains market/purpose dimensions and mixed pieces/ratios/length usage | `NEEDS_CONFIRMATION` / `CONFLICTING` for variance policy | Preserve demand dimensions and explicit quantity/UOM/usage basis; do not silently convert | Planning/Warehouse confirms purpose vocabulary, UOM conversions, scale, rounding, and variance owner |
| C-007 Operational line scope | Client artifacts contain no evidence of SaaS tenancy or shared multi-line database | `NEEDS_CONFIRMATION` | Keep one server-resolved context; do not add Workspace/membership/line selectors | Business/operations owner confirms D-001/D-029 future line identity requirement |
| C-008 Approval/signature identity | Prepared/checked/approved names appear on controlled artifacts | `NEEDS_CONFIRMATION` | Treat names as provenance snapshots, not authorization subjects | Identity/operations owner maps document roles to accepted subjects/capabilities |

## Decision-by-decision impact and recommended answer

| Decision | Evidence impact | Senior recommendation | Status after Pass 4 |
|---|---|---|---|
| D-001/D-029 operational context and ProductionLine | No client artifact proves tenancy or shared-line scope | Retain one server-resolved deployment context; defer persisted ProductionLine until a real shared-database/line business boundary is confirmed | `NEEDS_CONFIRMATION` |
| D-006 identity provider | Document names do not identify provider or subject model | Keep provider-neutral Subject/Assignment design; require provider and issuer mapping before identity implementation | `NEEDS_CONFIRMATION` |
| D-007 PMRS | PMRS is operationally important but ownership is not proven | PATS owns PATS-scope requirements/issues; PMRS remains a reconciled control projection and external physical stock/procurement stays external | `PROPOSED` |
| D-008 station granularity | Device vs catalog vs booth clarified 2026-08-10 | Station at Stage/SubStage only; default SubStage; Booth physical; Process no PC default | `WORKING DEFAULT` |
| D-009 rework/reversal | Client files do not provide execution correction policy | Preserve append-only/forward-only working rule; defer rework and reversal | `NEEDS_CONFIRMATION` |
| D-010 Lot cardinality | PMRS model quantities do not prove Lot grouping | Keep `LotPartAllocation` decision-neutral; do not infer Lot cardinality from demand lines | `NEEDS_CONFIRMATION` |
| D-020 Withdrawal Form | PMRS issue/balance fields do not prove form ownership | Keep external reference only until the owner confirms the form boundary | `NEEDS_CONFIRMATION` |
| D-021 quantity/variance | Mixed UOM, ratios, and conflicting totals strengthen the unresolved policy | Preserve source quantity specs and reject silent conversion; do not hardcode tolerance | `CONFLICTING` |
| D-024 planning noun | B248 evidence uses product/PMRS terminology, not a decisive aggregate noun | Keep `PlanningAggregate` internally and `production-plans` as a working route only | `NEEDS_CONFIRMATION` |
| D-025/D-026 actor/capability mapping | Document approvals are not API actors/roles | Keep stable Subject references plus optional snapshots; do not infer roles from signatures | `NEEDS_CONFIRMATION` |
| D-030–D-033 controlled revision, normalization, identifiers, conflict release | Client evidence directly introduces these concerns | Apply the proposed controlled-revision model, typed identifiers, canonical Kuririn code, and blocking source correction workflow | `PROPOSED` |
| D-034/D-035 demand dimensions and source discrepancies | PMRS categories and quantity mismatches affect planning writes | Apply first-class demand dimensions and latest approved line-level quantities with derived headers/balances | `PROPOSED` |

## Gate 0 re-entry criteria

Before implementation approval, the design package must record:

1. An owner-confirmed Kuririn code/cross-reference correction or explicit accepted exception.
2. An owner-confirmed Asia quantity relationship and effective PMRS revision.
3. Accepted or explicitly deferred D-007, D-020, and D-021 ownership/quantity boundaries.
4. Accepted or explicitly deferred D-030 through D-035 with owner and review condition.
5. A consistent source-revision, identifier, applicability, BOM/process/packaging, and demand
   allocation model across the data and endpoint documents.
6. No implementation task that assumes unresolved values as canonical identity or invariant.

## Pass 5 consistency decisions and handover candidates

| ID | Finding | Interim recommendation | Status |
|---|---|---|---|
| D-036 | Legacy/frontend evidence contains per-subject locale and walkthrough completion state, but the canonical model has no home | Persist locale in `SubjectPreference` and walkthrough completion in versioned child rows; keep both outside authorization truth | `PROPOSED` |

### D-006 minimum interim scope for Gate 0

D-006 remains `NEEDS_CONFIRMATION`; no final identity provider is silently selected. To make the
future identity persistence slice implementable after approval, Gate 0 must at minimum accept a
provider-neutral subject contract: stable `(provider, issuer, provider_subject)` identity
attributes, no provider-specific claims as authorization truth, and a provisional on-prem
OIDC/directory-compatible adapter boundary. The final provider, issuer policy, bootstrap owner,
and capability mapping remain review conditions before Gate 2 implementation. This is a
`WORKING_DEFAULT` recommendation, not an accepted provider decision.

### Handover rules added by Pass 5

- `Subject` is the internal identity entity; `/users/me` is its authenticated public projection.
- Canonical retirement/soft-delete reads return `404`; `410` requires an explicit permanent-removal
  policy; append-only evidence has no ordinary DELETE.
- The REST checklist's operational-scope wording supersedes stale Workspace-tenancy wording.
- The client-evidence reconciliation chain is a required supplemental gate before implementation
  approval.

## User-approved decisive target operating model (2026-07-15)

The user approved applying the following recommendations as the target design direction. These
choices solve the manual-operation conflicts in the system model; they do not falsify the original
source files. Source corrections remain auditable reconciliation work before release.

1. **Controlled revision workflow is canonical.** Product Master, Parts List, and PMRS are
   imported as draft revisions, validated against typed identifiers and quantities, assigned
   blocking reconciliation issues, corrected by an authorized owner, and published as immutable
   approved revisions. Conflicting drafts cannot release production.
2. **Kuririn resolution is decisive.** `B248-02-08` is the canonical Kuririn Body part code for
   the affected revision. `B248-01-08ST` is rejected as an invalid source reference and is retained
   only in correction/audit evidence. A corrected source revision is required before publication.
3. **Asia quantity resolution is decisive.** The latest approved line-level values govern:
   `15,572` per model, `77,860` total, `77,060` issued, and `800` remaining. Header totals are
   derived and may not override line totals. The stale `77,060` header is retained as prior-source
   evidence.
4. **PATS owns PATS-scope material control.** Planning owns approved material requirements;
   Inventory owns append-only PATS-scope issue evidence and derived balances. PMRS is a generated/
   reconciled control projection. External ERP/Warehouse remains the authority for physical stock
   and procurement unless a later integration decision changes that boundary.
5. **Quantity behavior is explicit.** Quantities use magnitude, UOM, usage basis, precision, and
   source representation. Ratios are not silently converted. If no explicit tolerance is set,
   the default is strict equality; variance becomes an exception requiring authorized resolution.
6. **Demand dimensions are first-class.** Market/region and demand purpose are stored on demand
   allocations. Model totals are derived/reconciled and cannot be edited independently.
7. **Identity and preferences are deployment-scoped.** Use the provider-neutral on-prem OIDC
   adapter boundary, persist subject identity by provider/issuer/subject, persist locale and
   walkthrough completion separately, and keep these outside authorization truth.
8. **No first-release line tenancy.** The first deployment has no Workspace or ProductionLine
   persistence. A line is introduced only through a separately approved shared-database or
   line-authorization requirement.

These are target design decisions for the next implementation gate. The source-document correction
and effective-revision evidence must still be recorded before the affected revision is released.

## Schema-normalization revision Pass 3 impact

The lifecycle and invariant revision applies the decisive target direction without changing the
acceptance status of Gate 0 decisions:

- Approved source revisions are immutable. Resolution is append-only evidence that produces a new
  corrected revision; open blocking reconciliation issues prevent approval and dependent release.
- `B248-02-08` is the canonical target Part code for the affected revision. `B248-01-08ST` remains
  invalid source evidence only. The corrected Parts List/effective-revision task remains a
  controlled source gate, not an implementation shortcut.
- Asia line values are authoritative in the target model: `77,860` total, `77,060` issued, and
  `800` derived balance. The stale `77,060` header is historical source evidence and cannot be a
  competing canonical total.
- Quantity/UOM/usage-basis/precision/source representation is required. Missing tolerance means
  strict equality; explicit tolerance is per requirement or operation and produces auditable
  variance evidence. No global tolerance is accepted.
- PATS-owned `MaterialRequirement` rows and append-only `InventoryTransaction` issue evidence are
  distinct from `PMRSReference`; issued and balance values are derived, not mutable cells.
- Retryable source, requirement, approval, and issue commands use normalized idempotency records;
  mutable resources use `If-Match`; source/audit/idempotency/outbox writes are atomic.

D-006, D-020, D-021, D-025, D-026, D-030, D-031, D-032, D-033, D-034, D-035, and D-036, along
with the existing Gate 0 list, remain visibly `NEEDS_CONFIRMATION`, `CONFLICTING`, or `PROPOSED`
as recorded above. This section does not silently accept or defer any decision.

## User-requested decisive target resolution

The user requested a decisive target choice for the complete Gate 0 package. The full target set,
including rationale and implementation impact for D-001 through D-036, is recorded in:

`docs/superpowers/chains/2026-07-15-pats-api-gate-0-decisive-target-resolution.md`

The user confirmed that addendum on 2026-07-15 by stating, “I'm good with this now, you can
proceed.” It does not erase the historical evidence classifications above. The Gate 0 review
record captures the resulting freeze and implementation authorization; corrected source revisions
and effective-revision registration remain release prerequisites for affected source data.

## Gate 0 freeze and implementation authorization (2026-07-15)

- **Status:** `FROZEN — USER CONFIRMED; IMPLEMENTATION APPROVED`.
- **Basis:** The user reviewed and confirmed the complete decisive target set for D-001 through
  D-036 with no amendments stated.
- **Authorization:** Begin the separate Gate 1 common HTTP implementation chain. The frozen target
  design is the contract for subsequent schema, migration, endpoint, and test work.
- **Preservation rule:** Historical `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` labels remain
  visible as source/evidence classifications. They are not rewritten to fabricate source-owner
  approvals.
- **Release rule:** D-033/D-035 corrected source revisions and effective-revision registration
  remain mandatory before affected source data is published or used as released production truth.

## Gate 2 identity and authorization implementation record (2026-07-15)

The approved implementation slice adds only deployment-scoped identity and capability policy:

- PostgreSQL/Prisma `Subject` and `SubjectAssignment` relations use the provider/issuer/subject
  identity key and do not add Workspace, membership, tenant-selector, or ProductionLine scope;
- canonical `GET /api/v1/users/me` and `GET /api/v1/users/me/capabilities` routes use an injected
  provider-neutral authenticator and repository, return provider-safe data, and fail closed when
  identity is missing, disabled, inactive, or unavailable;
- capability evaluation accepts only the frozen capability vocabulary and expands approved role
  bundles; claims and role-shaped strings are not authorization truth;
- the legacy HS256/workspace middleware remains compatibility-only and is not used by canonical
  PATS self routes.

The source code, additive migration, OpenAPI source contract, focused tests, and implementation
plan are the Gate 2 evidence. Provider bootstrap, issuer/key-discovery configuration, operator
assignment workflow, and all other domain writes remain separate implementation/release work.

## User amendment: local authentication, no SSO/OIDC (2026-07-15)

The user clarified the actual PATS use case: this deployment needs application authentication and
RBAC, not corporate SSO. Therefore the current D-006 implementation target is:

- PATS-local account authentication through the existing generic `IdentityAuthenticator` port;
- stable local account to `Subject` mapping using the local identity namespace;
- RBAC role bundles and direct capability assignments as authorization truth;
- no OIDC, JWKS, corporate directory, or external identity-provider dependency;
- no client-trusted role, workspace, tenant, or capability claims.

The earlier OIDC-compatible direction remains preserved as historical design evidence but is no
longer the first-release deployment requirement. Credential/session handling is resolved by the
Gate 2 implementation record below.

## Local authentication implementation resolution (2026-07-15)

The approved first-release local-authentication boundary is now implemented as follows:

- `SubjectCredential` stores one normalized local username and Argon2id password hash for a
  `Subject`; disabled or revoked `Subject` status fails closed;
- `POST /api/v1/auth/login` verifies local credentials and issues a signed HS256 PATS bearer
  session with an eight-hour default TTL (bounded to 300-86400 seconds);
- the token carries subject identity and token metadata only. Roles, capabilities, workspace,
  tenant, and line values are never accepted from the client token;
- `SubjectAssignment` remains the sole RBAC authorization source after subject resolution;
- account bootstrap, password reset/change, lockout/rate limiting, and operator assignment
  administration remain separate operational work and are not auto-created by this slice.
