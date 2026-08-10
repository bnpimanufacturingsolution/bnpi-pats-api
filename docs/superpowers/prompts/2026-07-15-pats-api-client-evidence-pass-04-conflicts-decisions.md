# Pass 4 Prompt — Conflict Reconciliation and Decision Register Update

Act as the decision authority for a governed manufacturing-domain design review, while preserving the distinction between recommendation and approval.

## Objective

Reconcile conflicts introduced or exposed by the client evidence and update the decision register without silently deciding for the business owner.

## Read first

Read Passes 1–3, the Claude design review report, the decision register, all changed design documents, and the source artifacts where needed.

## Required analysis

Create a conflict register covering, at minimum:

- Kuririn Body identifier/name mismatch between the Parts List and PMRS/injection evidence.
- Asia 77,060 versus 77,860 lot/order/revised forecast discrepancy.
- Any Product Master, Parts List, and PMRS revision/date mismatch.
- Any contradiction between controlled-document revision and current canonical ProductSpecificationSnapshot behavior.
- Any contradiction between single operational context and evidence that might suggest additional operational boundaries.

For each conflict record:

- Exact source fields and artifact.
- Why the conflict matters.
- Classification: `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`.
- Safe interim design behavior.
- Decision owner and confirmation question.
- Affected entities, endpoints, permissions, lifecycle rules, and implementation tasks.

Review D-001, D-006, D-007, D-008, D-010, D-020, D-021, D-024, D-029, and related decisions. Add candidate decisions only when needed, clearly marked as unapproved.

## Allowed changes

Documentation-only updates to the decision register, design documents, reconciliation chain, and a new Pass 4 report. No code or Prisma changes.

## Required report

Include the five standard pass-report sections, the conflict register, a decision-by-decision impact table, recommended answers with confidence, and the Gate 0 re-entry criteria.
