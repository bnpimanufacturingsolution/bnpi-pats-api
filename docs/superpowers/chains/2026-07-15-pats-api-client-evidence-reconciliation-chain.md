# PATS API Client-Evidence Reconciliation Chain

Status: `COMPLETED — IMPLEMENTATION BLOCKED PENDING GATE 0`

Date: 2026-07-15

This chain is a sequential documentation-only gate before implementation. It supplements the original eight-pass API design chain, the schema-normalization chain, and the single-operational-context revision chain. It does not replace them.

## Global invariants

- Work on `develop`.
- Read existing design documents before proposing changes.
- Treat the three supplied client artifacts as business evidence, not as an ORM schema.
- Do not modify application source, Prisma schemas, migrations, generated artifacts, seeds, deployment files, or frontend files.
- Do not silently resolve uncertainty.
- Use `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` explicitly.
- Preserve the single-operational-context direction unless new evidence proves a different business boundary.
- Keep implementation blocked until the entire design chain passes and the user explicitly approves implementation.
- Apply the approved REST standard to all revised endpoint proposals.

## Required reading

Read the repository's required design documents in their established order, then read:

- `docs/superpowers/reports/2026-07-15-pats-api-claude-design-review-report.md`
- `docs/superpowers/plans/2026-07-15-pats-api-client-evidence-reconciliation-plan.md`
- The client evidence files named in the plan.

## Pass sequence

| Pass | Name | Status | Gate |
| --- | --- | --- | --- |
| 1 | Evidence Authority and Scope Lock | `COMPLETED` | Evidence ownership and precedence are explicit |
| 2 | Product, BOM, Process, Packaging, and Revision Model | `COMPLETED` | Canonical model is normalized and source lineage is bounded |
| 3 | PMRS, Planning, Quantity, and Lifecycle Model | `COMPLETED` | Quantity ownership, UOM, and lifecycle behavior are explicit |
| 4 | Conflict Reconciliation and Decision Register Update | `COMPLETED` | No contradiction is hidden; decision impacts are recorded |
| 5 | Consistency Review and Handover | `COMPLETED` | All design surfaces agree and implementation remains gated |

## Pass execution rule

Run one pass at a time. A pass may update only documentation/design artifacts permitted by the pass prompt. At the end of each pass, write its report, perform its self-check, list open questions, and stop before the next pass unless the chain operator explicitly continues.

## Chain completion rule

The documentation chain is complete only after Pass 5 reports that every conflict is explicitly
recorded with classification, owner/question, safe interim behavior, and decision impact. An
unresolved `CONFLICTING` item blocks the affected implementation; it does not make the documentation
chain incomplete when it is fully visible and owned. Hidden conflicts, missing owners, or missing
decision impact are not completion. User approval and Gate 0 acceptance remain separate.

## Prompt files

- Pass 1: `docs/superpowers/prompts/2026-07-15-pats-api-client-evidence-pass-01-authority.md`
- Pass 2: `docs/superpowers/prompts/2026-07-15-pats-api-client-evidence-pass-02-product-bom-packaging.md`
- Pass 3: `docs/superpowers/prompts/2026-07-15-pats-api-client-evidence-pass-03-pmrs-quantity-lifecycle.md`
- Pass 4: `docs/superpowers/prompts/2026-07-15-pats-api-client-evidence-pass-04-conflicts-decisions.md`
- Pass 5: `docs/superpowers/prompts/2026-07-15-pats-api-client-evidence-pass-05-consistency-handover.md`
- Handover: `docs/superpowers/prompts/2026-07-15-pats-api-client-evidence-reconciliation-handover.md`
- Decision resolution addendum: `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-decision-resolution.md`
