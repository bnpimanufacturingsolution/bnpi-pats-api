# Handover Prompt — PATS Client-Evidence Reconciliation

Continue the Bandai PATS API design in:

`C:\Users\Admin\Documents\Projects\BANDAI PATS\bnpi-pats-api`

Work on `develop`. The client-evidence reconciliation chain is documentation-complete with
known conflicts explicitly recorded, but implementation approval has not been granted and Gate 0
remains required.

## Required reading

Read `AGENTS.md`, the approved REST standard, principle, checklist, the original design package,
the Claude review report, and then:

- `docs/superpowers/plans/2026-07-15-pats-api-client-evidence-reconciliation-plan.md`
- `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-chain.md`
- `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-pass-01.md`
- `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-pass-02.md`
- `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-pass-03.md`
- `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-pass-04.md`
- `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-pass-05.md`
- `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-decision-resolution.md`

The client snapshots are the three files named in the reconciliation plan. Their hashes and
bounded authority are recorded in Pass 1; a changed file requires a new evidence review.

## Current design outcome

- The first deployment uses one server-resolved operational context. Do not create Workspace or
  membership tenancy. ProductionLine remains gated by D-001/D-029.
- Product Master, Parts List, and PMRS are distinct controlled artifacts with source revision and
  provenance lineage; they are not one spreadsheet-shaped aggregate.
- Parts, applicability, BOM, process specifications, packaging hierarchy, and executable route
  are separate design concepts. RouteStep is not a BOM or worksheet-row container.
- PATS owns approved PATS-scope material requirements and issue evidence. PMRS is a reconciled
  control projection/reference; external ERP/Warehouse owns physical stock and procurement.
- Demand purpose and market/region are first-class planning allocation dimensions; totals have one
  authoritative reconciliation rule.
- Kuririn is canonically `B248-02-08`; invalid `B248-01-08ST` requires a corrected source
  revision. Asia is canonically 77,860 total/77,060 issued/800 balance from latest approved line
  values; stale headers require correction before release.
- Subject is the internal identity entity; `/api/v1/users/me` is its authenticated public
  projection. Locale and walkthrough state are normalized subject-owned platform preferences.

## Implementation gate

Do not implement until Gate 0 records accepted or explicitly deferred decisions with owner and
review condition, including D-001, D-006, D-007, D-020, D-021, D-030 through D-036, and every
other decision blocking the requested slice. D-006 must have at least a provider-neutral interim
scope before the identity persistence task.

After explicit user approval, the first domain persistence task remains:

1. provider-neutral `subjects`;
2. deployment-scoped `subject_assignments`;
3. capability-policy and object-authorization ports, without Workspace/membership tables.

Common HTTP infrastructure precedes or surrounds this slice according to the implementation plan.
No client-evidence conflict may be resolved in code, Prisma, migration, seed, or import logic.

## Reporting rule

Report the exact files changed, validation commands, truth/governance surfaces updated, unresolved
questions, and whether implementation approval is still required. Preserve unrelated user changes.
