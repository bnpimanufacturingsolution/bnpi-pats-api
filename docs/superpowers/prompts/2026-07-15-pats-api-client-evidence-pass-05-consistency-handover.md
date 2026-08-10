# Pass 5 Prompt — Consistency Review and Handover

Act as a Principal API Architect and manufacturing-platform implementation reviewer.

## Objective

Perform the final documentation-only consistency review after client-evidence reconciliation and prepare a safe implementation handover without implementing anything.

## Read first

Read Passes 1–4, the entire current design package, the REST standards and checklist, the Claude review report, the client-evidence plan/chain, and all newly recorded conflicts and candidate decisions.

## Required checks

Verify the chain in this order:

1. Evidence authority and scope.
2. Bounded contexts and architecture.
3. Product, model, part, BOM, process, packaging, and revision data model.
4. Lifecycles, invariants, quantity/UOM, concurrency, and idempotency.
5. `/api/v1`, plural lowercase kebab-case nouns, shallow nesting, snake_case query parameters, camelCase JSON, standard statuses, RFC 9457 errors, pagination, authorization checks, trace propagation, deprecation, and conditional request rules.
6. Endpoint catalog and authorization matrix.
7. On-prem operations, auditability, external references, and observability.
8. Implementation handover and explicit approval boundary.

Confirm that no endpoint relies on an unapproved Workspace/tenancy concept, that Subject versus `/users/me` mapping is explicit, and that locale/walkthrough state has a deliberate canonical home or marked deferral.

## Required outputs

- A consistency matrix with source decision, affected design surface, result, and evidence.
- A list of remaining `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` items.
- A revised implementation task sequence that remains documentation-only at this stage.
- The exact first implementation task, including prerequisites and exclusions.
- A clear statement that implementation requires explicit user approval after this chain.

## Allowed changes

Documentation-only updates to the design package, chain, plan, and a new Pass 5 report. No application source, Prisma, migrations, generated artifacts, seeds, deployment files, or frontend files.

## Required report

Use the five standard pass-report sections and conclude with one of:

- `READY_FOR_IMPLEMENTATION_APPROVAL`
- `READY_WITH_REQUIRED_REVISIONS`
- `BLOCKED_PENDING_CONFIRMATION`

Do not call implementation ready merely because the plan is complete.
