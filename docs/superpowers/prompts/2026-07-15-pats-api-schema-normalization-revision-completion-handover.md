# PATS API Schema Normalization Revision — Completion Handover

**Status:** COMPLETE — DOCUMENTATION-ONLY; IMPLEMENTATION BLOCKED

**Date:** 2026-07-15

**Repository:** `C:\Users\Admin\Documents\Projects\BANDAI PATS\bnpi-pats-api`

**Branch:** `develop`

## Completed continuation

The original API design chain and the client-evidence reconciliation chain were treated as
complete and were not restarted. The four-pass normalization revision was executed sequentially:

1. Canonical entity and ownership map.
2. 1NF/2NF/3NF, keys, constraints, namespaces, and indexes.
3. Lifecycles, quantities, reconciliation, release, concurrency, idempotency, audit, and outbox
   invariants.
4. API, authorization, on-prem consistency review, and implementation handover.

Pass reports are recorded in:

- `docs/superpowers/chains/2026-07-15-pats-api-schema-normalization-revision-pass-01.md`
- `docs/superpowers/chains/2026-07-15-pats-api-schema-normalization-revision-pass-02.md`
- `docs/superpowers/chains/2026-07-15-pats-api-schema-normalization-revision-pass-03.md`
- `docs/superpowers/chains/2026-07-15-pats-api-schema-normalization-revision-pass-04.md`

The active plan and chain are:

- `docs/superpowers/plans/2026-07-15-pats-api-schema-normalization-revision-plan.md`
- `docs/superpowers/chains/2026-07-15-pats-api-schema-normalization-revision-chain.md`

## Canonical result

- The first deployment uses one server-resolved operational context. There is no first-release
  Workspace, workspace membership, client-selected tenant scope, or ProductionLine persistence.
  Future line identity remains a separately gated D-001/D-029 decision.
- Controlled document revision lineage, reconciliation findings/resolutions, and approval
  evidence are distinct from Product Master, Parts List, PMRS, planning snapshot, route, and
  inventory responsibilities.
- Catalog owns reusable parts/applicability/BOM/process/packaging definitions. Planning owns
  plan snapshots, executable Parts List versions/routes, dimensioned demand, PMRS references, and
  approved PATS-scope material requirements. Inventory owns append-only PATS-scope issue evidence.
- `PlanModelAllocation` is a derived summary of `PlanDemandAllocation`; PMRS and material
  requirements do not store independently editable `issued` or `balance` truth.
- `B248-02-08` is the canonical Kuririn Body code. `B248-01-08ST` remains invalid source
  evidence only. The target Asia values are total `77,860`, issued `77,060`, and derived balance
  `800`; the stale `77,060` header remains historical source evidence.
- Quantities preserve magnitude, UOM, usage basis, precision, and source representation. Ratios
  are not silently converted. Missing tolerance means strict equality; explicit tolerance is
  per requirement/operation and creates auditable variance evidence.
- Source corrections create new immutable revisions. Open blocking reconciliation issues prevent
  approval and dependent planning/material release. Audit, idempotency, and outbox intent are
  atomic with source mutations; projections remain rebuildable and freshness-aware.

## Gate 0 and implementation boundary

Gate 0 is not frozen. The decision register must still record owner-approved acceptance or
explicit deferment with rationale, impact, and review condition for the affected D-001, D-005,
D-006, D-008, D-009, D-010, D-014, D-017, D-020, D-021, D-024, D-025, D-026, D-027, D-028,
D-029, and D-030–D-036 items. Controlled source-correction/effective-revision evidence for the
Kuririn and Asia cases is also required before affected source content is released.

This design completion does not authorize implementation. Do not modify application source,
Prisma schemas, migrations, generated artifacts, seeds, deployment files, or frontend files until
Gate 0 is frozen and the user separately and explicitly approves implementation.

## Recommended next step after approval

1. Freeze Gate 0 and record the approved/deferred decisions.
2. Obtain explicit user approval for implementation.
3. Execute Gate 1 common HTTP infrastructure and its contract tests.
4. Execute Gate 2 identity/authorization persistence beginning with provider-neutral `subjects`,
   deployment-scoped `subject_assignments`, capability policy, object checks, and audit actor
   mapping. Subject preferences/walkthrough rows remain subject to D-036 scope.
5. Translate only the accepted model into Prisma through an additive, reviewed migration plan;
   do not infer implementation literals from this handover.

## Final validation expectation

The closing session must run `git diff --check`, verify that every new reference resolves, search
for stale Workspace/hybrid/duplicate-Kuririn/duplicate-Asia claims, and confirm that only
documentation files were changed by this revision. No generated artifact is a design source.
