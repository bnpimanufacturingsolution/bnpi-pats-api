# PATS API Schema Normalization Revision — Pass 1

**Pass completed:** 1 — Canonical entity and ownership map

## What changed

- Added the dated normalization-revision plan and chain records.
- Reconciled controlled source lineage into `ControlledDocumentRevision`, reconciliation issue/
  resolution evidence, and immutable approval evidence without creating a generic business
  document aggregate.
- Assigned source-lineage metadata to Assets/Documents, reconciliation and approval evidence to
  Exceptions/Audit, and semantic Product Master ownership to Catalog.
- Assigned plan snapshots, executable Parts List versions/routes, dimensioned demand, PMRS
  references, and PATS-owned material requirements to Planning.
- Kept append-only issue evidence in Inventory/Traceability and moved subject preferences and
  walkthrough completion to Identity/Authorization outside capability truth.
- Reconciled `PlanModelAllocation` as a derived/reconciliation-backed summary of
  `PlanDemandAllocation`; it is not an independently editable total.
- Added the explicit relationship flow showing that BOM/process/packaging definitions are not
  execution route rows and PMRS is not the issue ledger.

## Self-check result

| Check | Result |
|---|---|
| Only documentation/design files touched by this pass | `PASS` |
| No source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| No tests weakened or removed | `PASS` |
| Ownership is singular for each business fact; cross-context evidence boundaries are explicit | `PASS` |
| Relationships are not assigned to JSON or duplicate editable totals | `PASS` |
| Single server-resolved operational context preserved | `PASS` |
| `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` labels preserved | `PASS` |
| REST-sensitive ownership implications remain subject to the approved standard | `PASS` |
| `git diff --check` at pass close | `PASS` |

## Open questions or blockers

Gate 0 remains open. D-005, D-006, D-008, D-009, D-010, D-014, D-017, D-020, D-021, D-024,
D-025, D-026, D-027, D-028, D-029, and the proposed D-030–D-036 acceptance/deferment records
still require their named owner, rationale, implementation impact, and review condition before
affected writes can be implemented. No user decision is required to continue documentation.

## Ready for next pass

`YES` — proceed to the relation-level 1NF/2NF/3NF, key, constraint, namespace, and index review.
