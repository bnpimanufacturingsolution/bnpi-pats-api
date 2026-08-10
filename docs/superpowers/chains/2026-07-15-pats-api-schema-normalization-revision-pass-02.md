# PATS API Schema Normalization Revision — Pass 2

**Pass completed:** 2 — 1NF/2NF/3NF, keys, constraints, namespaces, and indexes

## What changed

- Added normal-form rules to the normalized schema: repeating operational structures are rows,
  relationship attributes stay on bridge rows, and immutable snapshots are distinguished from
  live catalog truth.
- Added the typed identifier namespace policy for product codes, part codes, external item
  numbers, document/control numbers, mold/equipment references, and PMRS/Withdrawal references.
- Added the relation key/access-path matrix for controlled source, reconciliation, catalog
  content, planning snapshots/demand/requirements, route versions, issue evidence, and subject
  preference/walkthrough relations.
- Added typed material-requirement lineage bridge relations for demand allocations and BOM lines;
  a polymorphic source-ID column is explicitly non-canonical.
- Added the derived-summary rules for `PlanModelAllocation` and the append-only/derived boundary
  for `MaterialRequirement`, `InventoryTransaction`, PMRS observations, and balance projections.
- Synchronized the conceptual data-model document with the relation-level enforcement rules.

## Self-check result

| Check | Result |
|---|---|
| Only documentation/design files touched by this pass | `PASS` |
| No source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| No tests weakened or removed | `PASS` |
| 1NF/2NF/3NF rules are explicit | `PASS` |
| Keys, FKs, candidate uniqueness, nullability/relationship attributes, and indexes are recorded | `PASS` |
| Identifier namespaces remain typed and distinct | `PASS` |
| JSON is excluded from relationships, route steps, authorization, current position, and balances | `PASS` |
| Duplicated editable totals are prohibited | `PASS` |
| Open quantity/lifecycle/namespace decisions remain labelled | `PASS` |
| `git diff --check` at pass close | `PASS` |

## Open questions or blockers

No new user decision is required for the documentation pass. Final migration literals remain
blocked by Gate 0, including D-005 catalog layering, D-008 station target, D-010 Lot/cardinality,
D-020 Withdrawal boundary, D-021 quantity scale/conversion/tolerance, D-030/D-031 source and
content model acceptance, and the existing identity, asset, retention, actor, and on-prem
decisions. The bridge-versus-direct-lineage choice remains a documented implementation review
condition, not a hidden assumption.

## Ready for next pass

`YES` — proceed to lifecycle, quantity, reconciliation, release, concurrency, idempotency, audit,
and outbox invariants.
