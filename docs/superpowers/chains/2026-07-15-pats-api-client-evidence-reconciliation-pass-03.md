# Client-Evidence Reconciliation — Pass 3: PMRS, Planning, Quantity, and Lifecycle Model

Status: `COMPLETED — READY FOR PASS 4`

Date: 2026-07-15

## Pass completed

Pass 3, PMRS, Planning, Quantity, and Lifecycle Model, is complete. The PMRS workbook is treated
as operational planning/material-control evidence with a bounded reference boundary. PATS-owned
requirements or issue ledgers remain conditional on explicit ownership decisions.

## What changed

- Recommended a hybrid interim PMRS boundary: retain control/revision/source evidence without
  treating spreadsheet `ISSUED` or `BALANCE` cells as canonical ledger state.
- Preserved the existing append-oriented `InventoryTransaction` boundary for any PATS-owned WIP
  receiving/issuance, with external references governed by D-020.
- Added candidate `PlanDemandAllocation` dimensions for model, market/region, demand purpose,
  quantity/UOM, and source revision.
- Added quantity/UOM rules for pieces, ratios, length-per-pack, usage basis, precision, conversion,
  and rounding; no silent conversion was introduced.
- Added PMRS/reference and candidate material-requirement lifecycles, concurrency, idempotency,
  and projection rules.
- Preserved the Asia 77,060 versus 77,860 discrepancy as `CONFLICTING` source evidence.
- Added candidate decisions D-034 and D-035, both `NEEDS_CONFIRMATION`.

## PMRS ownership options

| Option | Boundary | Recommendation |
|---|---|---|
| External reference only | PATS stores control/revision/source reference; external system owns requirements and issues | Safe minimum, but may be too thin for planning traceability |
| PATS-owned ledger | PATS owns requirements, issues, corrections, and derived balances | Only after explicit D-007/D-020/D-021 acceptance |
| Hybrid | PATS stores PMRS reference/source snapshot; PATS inventory ledger records only accepted in-scope movements with external references | Recommended interim direction; still requires business confirmation |

## Quantity and lifecycle invariants

- A quantity has state, magnitude, UOM, and usage basis where applicable.
- `No. of Ups` remains a process parameter, not a product/customer quantity.
- `1/40`, `1/200`, and tape-per-200 usage remain representable without lossy conversion.
- `issued` and `balance` are source observations or derived projections unless PATS ownership is
  accepted; they are not mutable PMRS truth.
- Accepted issue records are append-oriented and retry-safe through `Idempotency-Key`.
- Mutable PMRS references and demand allocations use `If-Match` where concurrent updates are
  possible.
- A superseded PMRS reference preserves its source control/revision and historical observation.
- A source quantity conflict blocks dependent effective release until its owner resolves it.

## Endpoint and authorization impact

Candidate families recorded in the endpoint catalog:

- `/api/v1/pmrs-references`
- `/api/v1/plan-demand-allocations`
- conditional `/api/v1/material-requirements`

All remain subject to the approved REST standard, deployment/object checks, capability policy,
pagination, RFC 9457 errors, ETags, idempotency, trace propagation, and OpenAPI review. No PMRS
spreadsheet import route or balance-mutation endpoint was approved.

## Open questions or blockers

| Item | Classification | Effect |
|---|---|---|
| Whether PATS owns PMRS requirements or material issue records | `NEEDS_CONFIRMATION` | Blocks material write endpoints and final PMRS schema |
| Whether PMRS `/00` and `/01` are revisions, supplements, issue cycles, or another relation | `NEEDS_CONFIRMATION` | Blocks PMRS lifecycle/crosswalk rules |
| Withdrawal Form ownership and requiredness | `NEEDS_CONFIRMATION` | D-020 blocks affected inventory writes |
| Quantity/UOM/ratio precision, conversion, rounding, and variance policy | `CONFLICTING` | D-021 blocks quantity-bearing write contracts |
| Dimensioned demand allocation versus existing model totals | `NEEDS_CONFIRMATION` | D-034 blocks final planning allocation semantics |
| Asia 77,060 versus 77,860 evidence | `CONFLICTING` | D-035 blocks dependent release and canonical quantity selection |
| Planning aggregate noun | `NEEDS_CONFIRMATION` | D-024 remains unresolved; no endpoint noun is accepted by this pass |

## Self-check result

| Check | Result |
|---|---|
| PMRS B248 evidence distinguished from unrelated sheets | `PASS` |
| PMRS ownership options explicitly separated | `PASS` |
| Order/issued/balance semantics not silently promoted | `PASS` |
| Demand purpose and market/region impact recorded | `PASS` |
| Mixed UOM and ratios represented without invented conversion | `PASS` |
| Asia quantity discrepancy preserved | `PASS` |
| Lifecycle, concurrency, and idempotency impact recorded | `PASS` |
| No application source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| `git diff --check` | `PASS` |

## Ready for next pass

`YES` — continue automatically to Pass 4: Conflict Reconciliation and Decision Register Update.
