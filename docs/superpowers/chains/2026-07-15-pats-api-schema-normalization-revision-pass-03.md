# PATS API Schema Normalization Revision — Pass 3

**Pass completed:** 3 — Lifecycles, quantities, reconciliation, release, concurrency,
idempotency, audit, and outbox invariants

## What changed

- Defined controlled source revision, reconciliation issue, resolution, and approval lifecycles;
  approved revisions are immutable and corrections create new revisions.
- Made blocking issue resolution and effective source-revision registration explicit release
  prerequisites.
- Recorded the decisive Kuririn target (`B248-02-08`) and Asia line-derived target (`77,860`
  total, `77,060` issued, `800` balance) while retaining invalid/stale observations as evidence.
- Defined the quantity specification boundary: magnitude, state, UOM, usage basis, precision,
  source representation, approved conversion, strict equality by default, and auditable explicit
  variance. No global tolerance is encoded.
- Defined dimensioned demand, derived model summaries, material-requirement lifecycle, and the
  append-only InventoryTransaction issue/correction ledger.
- Defined optimistic concurrency, normalized idempotency replay/conflict, atomic audit/outbox
  writes, projection freshness, and subject preference/walkthrough behavior.
- Synchronized cross-cutting API error, header, transaction, and release behavior plus the
  decision-register impact record.

## Self-check result

| Check | Result |
|---|---|
| Only documentation/design files touched by this pass | `PASS` |
| No source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| No tests weakened or removed | `PASS` |
| Source approval cannot bypass open blocking reconciliation issues | `PASS` |
| Quantity/UOM/usage-basis and derived issued/balance behavior is explicit | `PASS` |
| Kuririn and Asia target values are singular while source observations remain auditable | `PASS` |
| Lifecycle, terminal-state, correction, concurrency, idempotency, audit, and outbox rules are explicit | `PASS` |
| Open decisions remain labelled and do not authorize implementation | `PASS` |
| `git diff --check` at pass close | `PASS` |

## Open questions or blockers

Gate 0 remains pending. D-006 provider/actor mapping, D-020 Withdrawal Form boundary, D-021
quantity scale/conversion/tolerance, D-014/D-017 asset and retention ownership, D-009 correction/
rework policy, D-010 Lot cardinality, and D-030–D-036 acceptance/deferment evidence remain
implementation blockers where applicable. Waiver policy is explicitly not treated as accepted.
No user decision is required to continue the documentation review.

## Ready for next pass

`YES` — proceed to API, authorization, on-prem consistency review, and implementation handover.
