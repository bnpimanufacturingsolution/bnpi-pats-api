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
| D-037 | Project–Lot cardinality | Each Project/ProductionPlan has one Lot identity and at most one persisted Lot; each Lot belongs to exactly one Project/ProductionPlan. A draft plan may have no Lot until the accepted Lot-creation trigger | CONFIRMED |
| D-038 | App-backed Project scope | Keep Project, model quantity lineage, Parts, Parts List routes, Lots, and execution. Remove unwired Demand/PMRS/MaterialRequirement surfaces and demand-only fields from the current app/API contract | USER_CONFIRMED_AMENDMENT |
| D-039 | Model ProcessRoute API adoption | Retire the parallel ProcessRoute/ProcessRouteStage API slice because the active app authors routing on ModelPart; retain Stage/SubStage for manufacturing route and execution use | USER_CONFIRMED_AMENDMENT — TRANSITIONAL TO 2027-01-01 |
| D-040 | Floor identity model | Final work tree is ProductionLine → Section → Process → Sub-process; Line is the management/screen grouping with one StationScreen per published Line; StationScreen is Line publication state, not a separate table; floor bindings use Section/Process/Sub-process only | USER_CONFIRMED_AMENDMENT — FINAL DESIGN; MIGRATION PENDING |
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

| D-024 | Draft business documents call the planning aggregate `Project`, while the target endpoint inventory calls it `ProductionPlan` | `CONFIRMED` — canonical noun is `Project` (see resolution entry 2026-09-25) | `Project` is the canonical domain noun, route family, and schema identity; `ProductionPlan` is a retired synonym pending twin removal per the canonicalization plan |

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

## Work-process/section delete referential review evidence (2026-09-22)

User-reported `DELETE /api/v1/work-processes/:processId` returned `500` whenever the process had
children, lines, booths, or monitoring references: unhandled Prisma FK violations escaped
`commandError` (which maps only `P2002`) into the generic `500` problem. No route shape, auth, or
idempotency behavior changed; the fix is confined to the two existing delete handlers.

- **Standard v1.2.1 sections checked:** §2 (paths/identifiers unchanged), §3 (DELETE stays
  idempotent; repeat delete still returns `404` per the documented contract), §4 (no new nesting),
  §6.3 (blocks now return `409 Conflict` as RFC 9457 `application/problem+json` via
  `sendCommandProblem`; no error is wrapped in `2xx`), §8 (authorization unchanged:
  `operations.manage`), §9 (N/A: these rows carry no row-version validator; last-writer-wins was
  already documented), §11 (idempotency-key behavior unchanged).
- **Resource/behavior defined:** `DELETE /work-processes/:processId` detaches children (direct
  children lose `parentProcessId`, all descendants lose `sectionId`), detaches optional booth and
  monitoring references (rows preserved, FK cleared), and refuses with `409` when required
  station-screen lines are attached. `DELETE /sections/:sectionId` refuses with `409` when lines
  belong to the section; its existing unassign semantics are unchanged.
- **Tests:** `tests/work-process-delete.contract.spec.ts` covers line-blocked `409`s, child/evidence
  detachment, and the unchanged no-line section delete. Full suite: 437 passing, 0 failing.
- **OpenAPI:** N/A — no per-endpoint OpenAPI artifact exists for command routes in this repo; the
  contract spec above is the review evidence.
- **Exception:** none.
## User-confirmed Project–Lot cardinality (2026-09-25)

The user confirmed that one Project equals one Lot.

- **Decision:** D-037 is `CONFIRMED`. A Project/ProductionPlan has one Lot identity, with at most one persisted Lot; every Lot belongs to exactly one Project/ProductionPlan.
- **Lifecycle clarification:** The approved zero-Lot state is allowed only before the accepted Lot-creation trigger. After that trigger, the Project/ProductionPlan must have its one Lot. This does not change the D-010 multi-Part allocation decision.
- **Rationale:** Project and Lot are one planning/production identity pair, so a second Lot for the same Project/ProductionPlan must not be created.
- **Affected design surfaces:** Planning data model, normalized schema, Prisma relation constraints, planning reads/writes, migration reconciliation, and API behavior for Lot creation.
- **Implementation impact:** Enforce a unique project/plan foreign key on Lot. A second distinct Lot creation returns `409 Conflict`; idempotent replay of the original create remains valid. Lot reads may return zero or one Lot for a plan depending on lifecycle state. LotPartAllocation remains the source for a Lot's Parts and quantities.
- **Migration impact:** Existing databases must be checked for duplicate Lots per Project before the unique constraint is applied. Existing duplicates require an explicit reconciliation decision; this change does not merge or delete them automatically.
- **Rollback/compatibility:** The route family remains `GET/POST /api/v1/lots` with plan filtering/subresource creation; no new verb path is introduced. Rolling back the unique constraint requires restoring a reviewed pre-change database state and must not be used to silently restore duplicate Lots.
- **Owner and evidence:** User confirmation, 2026-09-25, this repository conversation.
- **Review condition:** Reopen only if the business changes to permit multiple Lots for one Project/ProductionPlan.
- **Endpoint standard review:** No route-shape exception. The existing `/api/v1/lots` and `/api/v1/production-plans/{planId}/lots` shapes remain canonical under v1.2.1 §2–§5; the create behavior must follow §3, §6, §9, and §11 as documented in the endpoint catalog.

## User amendment: app-backed Project, no Demand/PMRS/MaterialRequirement (2026-09-25)

The user confirmed that the Project feature remains in scope, while separately modeled Demand,
PMRS, and MaterialRequirement data are out of scope because the active app does not use them. The
user selected immediate removal from v1 for the affected fields after being shown the breaking
response/request behavior.

- **Keep:** Project and its active app-backed ProductSpecification, ProjectModelAllocation quantity
  lineage, Part snapshots, PartsList/RoutingStep, one Lot, Batch, and execution records.
- **Remove:** `PlanDemandAllocation`, `Pmr`, and `MaterialRequirement` Prisma models/tables and seed
  writes; Project/Model demand relations; `marketRegion` and `demandPurpose` from
  `ProjectModelAllocation`; `materialRequirementId` from `InventoryTransaction`.
- **Project detail contract:** Remove `allocations`, `materialRequirements`, and `pmrsReference` from
  `GET /api/v1/production-plans/{planId}`. The app does not consume those fields.
- **Write request contracts:** Remove optional `marketRegion`/`demandPurpose` from
  `POST /api/v1/production-plans/{planId}/model-allocations`, and optional `materialRequirementId`
  from `POST /api/v1/inventory-transactions`. The strict validators will reject those retired
  properties with `422`.
- **Rationale/evidence:** Active sibling app Project screens use model quantities, Part/Parts List
  routing, Lots, and execution. No active app caller uses Demand or PMRS data; the app BOM/Project
  runtime audit and `.wwg` reports are recorded in the sibling repository. Seeded rows were
  provisional examples, not an app workflow.
- **Migration impact:** New migration drops the three retired tables, the `MaterialRequirementStatus`
  enum, the InventoryTransaction FK/column, and the two demand-only model-allocation columns. The
  migration is destructive to those stored rows; a coordinated backup and row-count review is
  required before applying it to a persistent database. Historical migration files remain
  unchanged.
- **REST standard exception:** v1.2.1 §7 ordinarily requires a new major version for these response
  and request contract breaks. The user explicitly approved the scoped v1 exception on 2026-09-25.
  Scope is limited to the fields/models listed above; it does not authorize other v1 contract
  breaks. **Owner:** user. **Reason:** these surfaces are absent from the active app and excluded
  from the current Project flow. **Review condition:** reopen before adding an external consumer or
  reintroducing Demand/PMRS/MaterialRequirement to the app.
- **Other sections checked:** §2 resource identity/paths unchanged; §3 method semantics unchanged;
  §6 success/error shape and strict `422` validation remain; §8 auth/object checks unchanged; §9
  concurrency unchanged; §10 removed fields are no longer accepted/returned; §11 idempotency
  behavior unchanged. OpenAPI and focused tests are updated with the implementation.
- **Historical decision handling:** D-007/D-034 Gate 0 target records remain historical evidence;
  this dated user amendment supersedes those targets only for the current app-backed implementation
  scope described above. Reopen the broader domain design before future planning/demand workflows.

## User amendment: retire app-unwired ProcessRoute API slice (2026-09-25)

The active app authors model-part route steps through `ModelPart.routingSteps` and the Project
PartsList route flow. No active app adapter/callsite uses the separate API `ProcessRoute` or
`ProcessRouteStage` resources. The user directed removal of app-unwired surfaces.

- **Retiring API resources:** `POST/PATCH /api/v1/catalog/process-routes`,
  `POST/PATCH /api/v1/catalog/route-stages`.
- **Classification/transition:** `TRANSITIONAL`, with `Deprecation: true` and
  `Sunset: Fri, 01 Jan 2027 00:00:00 GMT`. During the transition, behavior/auth/idempotency/ETag
  remain unchanged. The 90-day v1.2.1 §7 window is met; no exception is required.
- **Persistence cleanup after sunset:** Remove `ProcessRoute`/`ProcessRouteStage`, their canonical
  evidence subject enum values and seed writes through a reviewed migration after row-count/evidence
  preflight. Historical migration files remain immutable.
- **Keep Stage/SubStage:** They remain active manufacturing-route and execution identities and are
  used by the app's ModelPart routing editor, station-step configuration, quality scope, and stage
  events. They are distinct from the floor hierarchy Section → Process → Sub-process.
- **Owner/evidence:** User direction, 2026-09-25; sibling app runtime callsite audit; API route and
  seed inventory.
- **Review condition:** Reopen only if the app adopts `ProcessRoute`/`ProcessRouteStage` or another
  approved consumer is identified before sunset.

## User amendment: final floor identity model (2026-09-25)

The user finalized the following floor-organization design. This entry authorizes the target model
and phased migration; it does not apply a database migration by itself.

- **Work tree:** `ProductionLine → Section → Process → Sub-process`. `Section` groups multiple
  Processes; a `Process` has multiple child Sub-processes through `WorkProcess.parentProcessId`. No
  extra umbrella entity is introduced.
- **Line:** `Line` is the management/screen grouping created under Section/Process/Sub-process.
  Multiple Lines may manage the same Section/Process/Sub-process. Do not rename `Line` to
  `ProductionLine`.
- **StationScreen:** A `StationScreen`/Work Station Interface is the published state of a `Line`,
  not a separate persistent table. A created Line becomes a StationScreen when published with the
  required line-leader assignment. The published Line/screen is also the station device for that
  line; no separate Station entity is created for this slice.
- **Floor bindings:** Floor setup uses `Section`/`Process`/`Sub-process` and `Line`/StationScreen
  only. Do not use `Stage`/`SubStage` as floor parents and do not infer floor mappings from them.
  Existing `Stage`/`SubStage` identities remain only where manufacturing route/execution evidence
  already depends on them, pending a separate product-routing migration.
- **WorkProcess mapping:** Floor `WorkProcess` records are independent of manufacturing
  `Stage`/`SubStage`. Remove the API behavior that assigns the first bound SubStage when none is
  supplied; an explicit route mapping must be provided only where manufacturing routing truly needs
  it.
- **Owner/evidence:** User direction, 2026-09-25; sibling app setup/lines editor callsite audit; API
  `floor-operations.prisma`, command/read inventory, and current seeder sample.
- **Route/versioning constraint:** Canonical `/stations` remains occupied by the transitional Section
  alias until 2027-06-30. The migration must therefore use versioned or additive floor paths and
  must not silently repurpose v1 `/sections` identity. Historical migrations remain immutable.
- **Review condition:** Reopen before changing `/sections` identity, adding canonical station paths,
  dropping floor `Stage`/`SubStage` links, or migrating existing floor data.

## D-040 implementation evidence (2026-09-25)

- **Schema:** `ProductionLine` added (`floor-operations.prisma`); `Section.productionLineId` is an
  optional FK; `WorkProcess.subStageId` is now nullable with no first-bound inference. Migration
  `20260925170000_floor_identity_production_line` is additive; historical migrations untouched.
- **Endpoints:** `GET/POST /api/v1/production-lines` (`operations.manage` for create,
  `execution.read` for list; idempotent create; duplicate `lineCode` → `409`). `POST /sections`
  accepts optional `productionLineId` with a `404` for unknown lines; response shape unchanged.
  `POST /work-processes` accepts a null/absent `subStageId` without inference. `GET /lines` adds
  the derived `stationScreen` flag (published = enabled with a leader); no existing response field
  changed.
- **Seed:** `PL-MAIN` umbrella owns the four seeded Sections; wipe list and summary include
  `productionLine`.
- **Standards checked:** v1.2.1 §2 (plural nouns, `/api/v1`), §3 (POST create semantics),
  §4 (one-level paths), §5 (paginated `{data,pagination}` + `search`), §6 (`201` + `Location`,
  RFC 9457 errors), §8 (`operations.manage`/`execution.read`, object checks), §10 (camelCase),
  §11 (`Idempotency-Key` on create). No exception.
- **Tests:** production-line create/duplicate/list, work-process creation without a SubStage, seed
  wipe/summary assertions; full suite green.
- **App UI:** untouched per the frozen-layout constraint; the app's existing setup editors continue
  against unchanged v1 shapes plus additive fields.

## User-confirmed planning noun: Project (2026-09-25)

D-024 is resolved. The canonical planning aggregate noun is **Project**.

- **Decision:** `Project` is the canonical domain noun, route family (`/api/v1/projects…`),
  schema identity (`model Project`), and UI term. `ProductionPlan`/`productionPlan` is a retired
  synonym: route twins, code identifiers, audit names, and error strings still carrying it are
  compatibility residue, not a second concept.
- **Rationale/evidence:** UI routes/labels, Prisma schema, and user direction agree on `Project`;
  the sibling callsite audit (2026-09-25) showed the app displays `Project` while calling
  `/production-plans` on the wire — one noun end-to-end removes the split.
- **Implementation impact:** Executed per
  `docs/superpowers/plans/2026-09-25-project-noun-canonicalization-plan.md` (app wire switch →
  API twin removal + renames → app renames with compat aliases). Response keys `planId`/`planCode`
  are retained in this slice; trimming them is a separate contract decision.
- **Owner:** user, 2026-09-25.
- **Review condition:** reopen only if an external consumer requires the `ProductionPlan` noun.

## User-approved §7 exception: immediate removal of sunset-gated surfaces (2026-09-25)

The user approved immediate removal of the 2027-gated transitional surfaces without waiting for
sunset, as a scoped v1.2.1 §7 exception (same mechanism as D-038).

- **Excepted section:** v1.2.1 §7 minimum 90-day deprecation window.
- **Scope (only):** `GET/POST/PATCH /api/v1/catalog/bom-definitions`,
  `POST/PATCH /api/v1/catalog/bom-lines`, `POST/PATCH /api/v1/catalog/process-routes`,
  `POST/PATCH /api/v1/catalog/route-stages`, and the `/stations` route-path alias rows for
  `/sections`, `/sections/{id}/history`, `/sections/{id}/support`. `Stage`/`SubStage`, ModelPart
  `routingSteps`, PartsList/RoutingStep, and the Section → Process → Sub-process hierarchy stay.
- **Why conformance is not appropriate:** no production deployment exists; the dev database is
  disposable. Sibling callsite audit (2026-09-25) verified zero active app API callers: the app
  calls canonical `/api/v1/sections/...` (`endpoints.ts` `SECTIONS`/`STATION_HISTORY`) and never
  `/api/v1/stations`, `bom-definitions`, `bom-lines`, `process-routes`, or `route-stages`.
  The 2027 sunset dates assumed a production consumer that does not exist.
- **Owner:** user. **Reason:** dead transitional weight on an unshipped v1; nothing to migrate.
- **Review condition:** reopen before any external consumer is introduced or any removed surface
  is reintroduced to the app. One-time; no expiry.
- **Explicitly retained (outside this scope):** response compat fields (`stationCode`, history/
  support `station` + `stationId` shapes, station-step `station` shape) and the `stationId`
  request-body alias on work-process create. The app hook (`useCreateWorkProcess`) now sends
  `sectionId`-only on the wire (2026-09-25 service/hook alignment; frozen components untouched);
  the API alias remains as a safety net until components are editable. The app's
  `/line/stations/*` UI routes are frontend paths and are untouched.
- **Migration impact:** new additive migration drops `BomDefinition`, `BomLine`, `ProcessRoute`,
  `ProcessRouteStage`, and `BomRelationshipKind`; historical migrations untouched. Dev-only
  row disposition (disposable DB, reseed after migrate).
- **Other sections checked:** §2 resource identity/paths (§7 alias rows removed, canonical
  `/sections` unchanged); §3 method semantics unchanged; §6 RFC 9457 shape unchanged (removed
  routes fall through to the existing canonical `404`/`405` boundary); §8 auth/object checks
  unchanged (removed capability gates leave with their routes); §9 concurrency unchanged;
  §10 removed fields no longer accepted/returned at route scope; §11 idempotency middleware
  for removed catalog paths leaves with them. OpenAPI and focused tests updated.
- **Supersedes:** the "Exception: None" lines in `docs/decisions/2026-09-25-bom-api-retirement-decision.md`
  and `docs/decisions/2026-09-25-process-route-api-retirement-decision.md`, and the D-040
  `/stations`-until-2027-06-30 hold, only for the route-path scope above.
