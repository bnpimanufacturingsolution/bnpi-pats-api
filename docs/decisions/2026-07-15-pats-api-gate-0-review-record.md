# PATS API Gate 0 Review Record

**Status:** FROZEN — USER CONFIRMED; IMPLEMENTATION APPROVED

**Date:** 2026-07-15

**Repository/branch:** `bnpi-pats-api` / `develop`

## Purpose

This record is the Gate 0 review surface for the completed PATS API design package. The user
confirmed the decisive target set on 2026-07-15 and explicitly approved implementation. The
historical status values below are retained as evidence classifications; they are not silently
rewritten by this freeze record.

## Freeze rule

For each applicable decision, Gate 0 requires an owner-confirmed choice or explicit deferment with
rationale, affected scope, implementation/migration impact, and review condition. `PROPOSED` is
not `CONFIRMED`. `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` remain visible until that
evidence is recorded.

## Decision and evidence matrix

| Decision | Current status | Working target/direction | Required owner confirmation or deferment evidence | Gate 0 result |
|---|---|---|---|---|
| D-001 / D-029 operational context and future line identity | `PROPOSED` / `NEEDS_CONFIRMATION` | First release uses one server-resolved context; no Workspace/membership/ProductionLine persistence | Business/Operations owner confirms first-release scope and records the trigger for reopening a shared-database/line decision | `OPEN` |
| D-005 catalog ownership | `NEEDS_CONFIRMATION` | Deployment-owned catalog first; shared/system templates deferred | Catalog/Product owner confirms ownership, effective-revision responsibility, and future layering review condition | `OPEN` |
| D-006 identity provider | `NEEDS_CONFIRMATION` | Provider-neutral on-prem OIDC/directory adapter; stable provider/issuer/provider subject; claims not authorization truth | Identity/Operations owner confirms provider adapter boundary, issuer/bootstrap policy, disabled-subject behavior, and capability mapping review condition | `OPEN` |
| D-007 PMRS ownership | `PROPOSED` | PATS owns PATS-scope requirements/issues; PMRS is control projection/reference; ERP/Warehouse owns physical stock/procurement | Planning/Warehouse/ERP owner accepts or defers the system boundary and external integration responsibility | `OPEN` |
| D-008 station granularity | `NEEDS_CONFIRMATION` | Stage, SubStage, or configurable bundle remains undecided | Production Operations owner selects the station target and records route/authorization impact | `OPEN` |
| D-009 rework/reversal/correction | `NEEDS_CONFIRMATION` | Forward-only working rule with explicit correction evidence; rework/reversal deferred | Execution/Quality owner confirms holds, correction, rework, reversal, terminal-state, and audit policy | `OPEN` |
| D-010 Lot cardinality/timing | `NEEDS_CONFIRMATION` | `LotPartAllocation` keeps one-Part versus controlled grouping decision-neutral | Planning/Operations owner selects cardinality and creation trigger, with migration impact | `OPEN` |
| D-014 asset ownership | `NEEDS_CONFIRMATION` | API-owned metadata/private MinIO bytes; typed links; retention/orphan policy open | Asset/Operations owner confirms link targets, retention, quarantine, deletion, and orphan cleanup | `OPEN` |
| D-017 / D-023 / D-027 / D-028 on-prem recovery and delivery | `NEEDS_CONFIRMATION` | Docker Compose/air-gapped direction; exact topology, backup owner, retention, RPO/RTO, encryption, and promotion ownership open | Operations owner records named owners, recovery values, topology/promotion boundary, and restore rehearsal condition | `OPEN` |
| D-020 Withdrawal Form boundary | `NEEDS_CONFIRMATION` | PATS may retain an external reference; does not own the form resource | Planning/Warehouse owner confirms ownership, requiredness, validation, and reference lifecycle | `OPEN` |
| D-021 quantity/UOM/variance | `CONFLICTING` | Preserve magnitude/UOM/usage basis/precision/source text; strict equality without explicit tolerance | Planning/Warehouse/Quality owner confirms units, scale, conversion, rounding, tolerance precedence, and override authority | `OPEN` |
| D-024 planning aggregate noun | `NEEDS_CONFIRMATION` | `PlanningAggregate` internally; `Project` versus `ProductionPlan` public noun remains open | Product/Planning owner confirms canonical noun and compatibility mapping before public write identity | `OPEN` |
| D-025 actor identity | `NEEDS_CONFIRMATION` | Stable Subject reference with optional historical snapshot | Identity/Audit owner confirms subject mapping, allowed snapshot fields, and redaction/retention | `OPEN` |
| D-026 capabilities and roles | `NEEDS_CONFIRMATION` | Capability names are working contract language; role mapping is not inferred | Identity/Operations owner confirms capability vocabulary, role mapping, assignment lifecycle, and bootstrap | `OPEN` |
| D-030 controlled revisions | `PROPOSED` | Product Master, Parts List, and PMRS are distinct controlled revisions | Document Control owner confirms document-family identity, revision/supersession, approval, and source-asset lineage | `OPEN` |
| D-031 normalized content model | `PROPOSED` | Separate parts/applicability, BOM, process, packaging, and execution route | Product Engineering/Catalog owner accepts relation ownership and publication semantics | `OPEN` |
| D-032 identifier namespaces | `PROPOSED` | Typed product, part, external-item, control, equipment, PMRS, and withdrawal namespaces | Product/Planning owner confirms namespace vocabulary and crosswalk policy | `OPEN` |
| D-033 Kuririn correction/release | `PROPOSED` plus `CONFLICTING` source evidence | `B248-02-08` canonical; `B248-01-08ST` invalid source evidence only | Product Engineering/Document Control issues or approves corrected source revision and records cross-reference correction | `OPEN` |
| D-034 demand dimensions | `PROPOSED` | Market/region and demand purpose are first-class; model total is derived/reconciled | Planning owner confirms vocabulary, editability, and reconciliation rule | `OPEN` |
| D-035 PMRS quantity relationship | `PROPOSED` plus `CONFLICTING` source evidence | Latest approved line values: `77,860` total, `77,060` issued, `800` balance; header derived | Planning/Warehouse owner approves effective revision and line/header derivation rule | `OPEN` |
| D-036 subject preferences/walkthrough | `PROPOSED` | SubjectPreference plus versioned walkthrough completion, outside authorization truth | Product/Identity owner confirms required persistence, locale vocabulary, and walkthrough contract | `OPEN` |

## Gate 0 status

`FROZEN — USER CONFIRMED; IMPLEMENTATION APPROVED`. The user confirmed the complete decisive
target set referenced below and authorized implementation to begin. The source-correction and
effective-revision evidence requirements remain release gates for the affected source data; they
do not reopen or invalidate the frozen target design.

## User approval and freeze record

- **Approval date:** 2026-07-15.
- **Repository/branch:** `bnpi-pats-api` / `develop`.
- **Approval evidence:** The user stated, “I'm good with this now, you can proceed,” after
  reviewing `docs/superpowers/chains/2026-07-15-pats-api-gate-0-decisive-target-resolution.md`.
- **Decision scope:** The complete D-001 through D-036 decisive target set is accepted with no
  amendments stated.
- **Implementation authorization:** Gate 1 may begin. No later implementation change may silently
  alter a frozen target; a material change requires a new decision record and review gate.
- **Preserved evidence:** Existing `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` labels remain
  visible in the matrix and historical chain reports.
- **Residual release gates:** Corrected/approved source revisions and effective revision-set
  registration remain mandatory before the affected Product Master, Parts List, or PMRS data can
  be released.

## Required freeze record additions

When owners review this matrix, each accepted/deferred row must add:

- decision and exact choice/deferment;
- owner and approval date/reference;
- rationale and affected design surfaces;
- implementation, migration, rollback, and compatibility impact;
- review condition/expiry for deferred decisions;
- source-revision references for D-030/D-033/D-035 where applicable.

Until those additions are made and the user explicitly approves implementation, Gate 1 and all
Prisma/application work remain blocked.

## Pass 2 controlled source-release gate

The three client artifacts previously analyzed by the completed reconciliation chain are present
in the local Downloads evidence boundary, but their presence does not make them approved PATS
source revisions. The repository review found no owner approval reference, corrected revision ID,
or effective Product Master/Parts List/PMRS revision-set record.

| Release prerequisite | Current evidence | Result |
|---|---|---|
| Source artifacts retained as evidence | Product Master/Parts List/PMRS files are available in the external evidence boundary | `PASS — evidence present; not canonical persistence` |
| Product Master/Parts List/PMRS document-family lineage | Design defines `ControlledDocumentRevision` and typed namespaces | `OPEN — owner must register the effective revision set` |
| Kuririn correction | Target is `B248-02-08`; `B248-01-08ST` remains invalid source evidence | `BLOCKED — corrected/approved Parts List revision not recorded` |
| Asia quantity correction | Target is line-derived `77,860` total, `77,060` issued, `800` balance; stale header remains evidence | `BLOCKED — corrected/approved PMRS revision and owner relationship not recorded` |
| Reconciliation issue/resolution evidence | Normalized relations and endpoint design exist | `OPEN — no accepted source-resolution record or approval reference` |
| Effective revision set | Release gate is defined across source, plan, route, and material requirements | `BLOCKED — no owner-confirmed effective revision/supersession record` |
| Dependent plan/material release | Canonical documents block unresolved source release | `PASS — implementation/design boundary remains closed` |

The target values are therefore usable as the approved design direction already recorded by the
user, but they are not proof that Gate 0 source-release evidence has been completed.

## Pass 3 canonical consistency audit

The canonical truth surfaces were searched for stale tenancy, hybrid PMRS ownership, duplicate
canonical conflict values, and premature implementation approval.

| Audit area | Result | Interpretation |
|---|---|---|
| Workspace/membership/line tenancy | `PASS` | References are explicitly negative, historical, or `NEEDS_CONFIRMATION`; no canonical first-release tenant selector or persistence is introduced. |
| PMRS ownership | `PASS WITH OPEN D-007` | The target direction consistently assigns PATS requirements/issues and external physical stock/procurement, while the decision status remains `PROPOSED` pending owner freeze. |
| Kuririn values | `PASS` | `B248-02-08` is the singular target; `B248-01-08ST` is retained only as invalid source evidence and release-blocking conflict. |
| Asia values | `PASS` | `77,860` total, `77,060` issued, and `800` derived balance are the singular target; stale header observations remain evidence and cannot override line totals. |
| Historical reconciliation reports | `PASS` | Earlier pass reports remain historical chain evidence; the decision-resolution addendum and current canonical documents supply the later decisive target. |
| Implementation authorization | `PASS` | Canonical handovers, plan, and this review record all require Gate 0 freeze plus separate explicit user approval. |

No canonical contradiction was silently rewritten. Historical reports were not edited to change
their recorded state; their status and chronology remain understandable from the completed-chain
records.

## Final Gate 0 outcome

`FROZEN — USER CONFIRMED; IMPLEMENTATION APPROVED`.

The documentation review and user approval are complete. The following remain required before the
affected source data can be released:

1. Owner-confirmed acceptance or explicit deferment for each applicable open decision in the
   matrix, with rationale, scope, impact, and review condition.
2. Recorded corrected/effective source-revision evidence for the Kuririn and Asia cases.
3. No further Gate 0 approval is required for the authorized Gate 1 implementation chain.

Gate 1 common HTTP, followed by the approved implementation sequence, is authorized by this
record. Source corrections remain controlled release work.

## User-requested decisive target set

The user requested a decisive resolution of the complete Gate 0 package. The concrete choices are
recorded in:

`docs/superpowers/chains/2026-07-15-pats-api-gate-0-decisive-target-resolution.md`

That addendum resolves the target choices for operational context, identity, catalog, station
mapping, Lot/rework, asset/backup operations, PMRS/quantity behavior, planning terminology,
capabilities, controlled revisions, namespaces, source conflicts, demand dimensions, and subject
preferences. The user confirmed it on 2026-07-15; it is the decisive target basis for the frozen
Gate 0 outcome.

## Post-freeze D-006 amendment

On 2026-07-15 the user clarified that the first PATS deployment will not use SSO/OIDC. D-006 is
amended to PATS-local authentication plus RBAC. The existing Subject/SubjectAssignment schema and
capability policy remain applicable; only the authentication adapter/deployment dependency changes.

The amended target requires local account authentication, stable local Subject mapping, explicit
role/capability assignment, disabled-account fail-closed behavior, and no client-trusted role or
workspace claims. OIDC, JWKS discovery, and corporate identity-provider configuration are not
required release inputs for this deployment.
