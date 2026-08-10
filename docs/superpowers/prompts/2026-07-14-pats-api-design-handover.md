# Handover Prompt: Bandai PATS API Domain and Contract Design

You are continuing the Bandai PATS API design in:

`C:\Users\Admin\Documents\Projects\BANDAI PATS\bnpi-pats-api`

Work directly on `develop` only when the user explicitly requests that scope. The documentation-
only design chain is complete, but implementation approval has not been granted by this prompt.

## Current outcome

The package now contains an evidence-locked domain/operational design, bounded contexts,
canonical conceptual data model, lifecycle/invariant rules, REST contract policy, endpoint and
authorization catalog, cross-cutting/on-prem operations design, decision register, and an
implementation backlog. The 2026-07-15 client-evidence reconciliation chain has additionally
reconciled the supplied B248 Product Master, Parts List, and PMRS artifacts. It is `PENDING USER
APPROVAL` for implementation.

The backend must be designed from business/domain and on-prem operational truth. The frontend
prototype is alignment evidence only; it cannot define API identity, persistence, authorization,
lifecycle, or endpoint semantics.

## Mandatory reading order

1. `AGENTS.md`
2. `docs/standards/restful-endpoint-design-standards.md`
3. `docs/principles/restful-endpoint-design-principle.md`
4. `docs/standards/endpoint-design-review-checklist.md`
5. `docs/superpowers/context/2026-07-14-pats-api-design-context.md`
6. `docs/superpowers/specs/2026-07-14-pats-api-target-design.md`
7. `docs/architecture/2026-07-14-pats-api-target-architecture.md`
8. `docs/data/2026-07-14-pats-api-data-model-design.md`
9. `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`
10. `docs/api/2026-07-14-pats-api-cross-cutting-design.md`
11. `docs/decisions/2026-07-14-pats-api-design-decision-register.md`
12. `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md`
13. `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md`
14. `docs/superpowers/plans/2026-07-15-pats-api-client-evidence-reconciliation-plan.md`
15. `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-chain.md`
16. `docs/superpowers/reports/2026-07-15-pats-api-claude-design-review-report.md`
17. `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-decision-resolution.md`

Read current source/schema/config/tests and sibling-app requirements only after this package is
loaded. Treat those surfaces as evidence and record any conflict; never silently promote them.

## Non-negotiable rules

- The approved REST standard version 1.2.1 is mandatory for every endpoint and OpenAPI entry.
- Canonical routes use `/api/v1`, plural lowercase kebab-case nouns, shallow nesting,
  `snake_case` query parameters, and `camelCase` JSON.
- Use standard HTTP statuses, RFC 9457 `application/problem+json`, standard pagination, ETags/
  `If-Match`, `Idempotency-Key`, W3C trace context, rate-limit headers, and deprecation headers.
- Every protected endpoint has authentication, deployment-scoped capability, and object-level
  authorization checks. The first deployment has no membership-tenancy selector. Do not trust
  workspace headers, role claims, localStorage, or frontend guards.
- Append-oriented stage/inventory/audit/outbox evidence is never silently rewritten. Projections
  are rebuildable and do not become write-side truth.
- Mark uncertainty `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`. Do not guess through a blocking
  business, identity, security, persistence, backup, or deployment ambiguity.
- During design work, do not modify application source, Prisma schemas, migrations, generated
  artifacts, seeds, deployment files, or frontend files.

## Open decisions that block affected implementation

D-001, D-005, D-006, D-008, D-009, D-010, D-014, D-017, D-020, D-021, D-024, D-025, D-026,
D-027, D-028, D-029, D-030, D-031, D-032, D-033, D-034, D-035, and D-036 remain open in the
decision register where applicable. They cover operational context and future line identity, catalog
ownership, identity/capabilities, station mapping, PMRS, rework/correction, Lot cardinality,
assets, units/variance, actor identity, Withdrawal Forms, backup/retention, and on-prem delivery.

The route catalog may be reviewed as a proposed design while these are open. No planning,
execution, inventory, asset, capability-assignment, or operations write may be implemented until the user
accepts the relevant decisions and separately approves implementation.

## If implementation is explicitly approved

Use the dependency-ordered backlog in
`docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md`:

1. Accept/freeze decisions and contract.
2. Implement common HTTP contract and tests.
3. Implement deployment-scoped identity/authorization and object ownership.
4. Implement isolated PostgreSQL persistence/migrations.
5. Implement catalog/configuration.
6. Implement planning.
7. Implement execution.
8. Implement inventory/traceability.
9. Implement exceptions/audit/assets/jobs.
10. Implement reporting/operations and release gates.

The first persistence slice is `subjects` plus deployment-scoped `subject_assignments`; do not
create `workspaces` or `memberships` unless D-001/D-029 is explicitly changed. Before that slice,
Gate 0 must record the minimum provider-neutral D-006 scope and acknowledge the client-evidence
chain's unresolved source conflicts; no implementation may infer the Kuririn or Asia values.

Use TDD and the endpoint checklist for each operation. Verify fresh command output before claiming
any phase complete. Keep changes scoped and preserve unrelated user work.

## Required reporting

For any resumed design or implementation work, report:

- what changed;
- what was validated and the exact command evidence;
- which truth/context/governance surfaces changed;
- unresolved questions and risks;
- whether any new recommendations were added;
- whether application code was changed;
- the next scoped task and whether explicit approval is still required.
