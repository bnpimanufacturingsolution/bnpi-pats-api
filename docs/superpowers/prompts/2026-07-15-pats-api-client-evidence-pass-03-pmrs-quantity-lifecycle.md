# Pass 3 Prompt — PMRS, Planning, Quantity, and Lifecycle Model

Act as a Principal Manufacturing Systems Architect with MRP, warehouse, inventory, and on-prem integration experience.

## Objective

Determine the correct PATS boundary for PMRS, production planning, material quantities, issue/balance behavior, demand purpose, regional allocation, units of measure, and lifecycle transitions.

## Read first

Read Pass 1 and Pass 2 reports and the existing planning, data-model, lifecycle, endpoint, cross-cutting, and decision documents. Read `C:\Users\Admin\Downloads\B248_DECO_PMRS.xlsx` in full enough to distinguish B248 evidence from unrelated A267/A301/A402 sheets.

## Required analysis

Evaluate:

- Whether PMRS is an external reference, a PATS-owned requisition domain, or a hybrid boundary.
- Whether `Order Qty`, `Issued`, and `Balance` are source fields, derived fields, or transaction projections.
- The meaning of PMRS control numbers, revisions, regional codes, lot quantities, and `/00` versus `/01` cycles.
- Demand-purpose categories such as sales, samples, inspection, replacement, promotion, development, and overseas allocation.
- Whether PlanModelAllocation needs a demand-purpose/market dimension.
- Model quantity invariants and the relationship between total lot quantity and five-model allocation.
- Mixed UOM and ratio cases such as `Pc`, `1/40`, `1/200`, and inches per 200.
- Whether quantities require decimal precision, conversion rules, or explicit non-convertible packaging ratios.
- Requisition, issue, correction, cancellation, and close behavior.
- The Asia discrepancy between a 77,060 header and 77,860 revised/current order quantity. Do not label it a typo without confirmation.
- Effects on D-007, D-010, D-020, D-021, and D-024, plus any affected concurrency/idempotency rules.

## Allowed changes

Documentation-only updates to planning, data-model, lifecycle, endpoint, cross-cutting, and decision documents, plus a new Pass 3 report. No code or Prisma changes.

## Required report

Include the five standard pass-report sections, a PMRS ownership options table, quantity/UOM invariants, lifecycle implications, and the exact unresolved confirmation questions.
