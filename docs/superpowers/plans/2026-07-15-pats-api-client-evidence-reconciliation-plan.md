# PATS API Client-Evidence Reconciliation Plan

Status: `COMPLETED — DECISIVE TARGET APPLIED; GATE 0 PENDING`

Date: 2026-07-15

Owner perspective: Principal Manufacturing Systems, Domain, and Data Architect

## Objective

Reconcile the newly supplied client-controlled production evidence with the existing PATS API domain, data-model, lifecycle, endpoint, cross-cutting, and decision documents before Gate 0 is frozen and before any implementation begins.

This is a documentation-only design activity. The evidence must refine the API around actual product, BOM, packaging, planning, requisition, and on-prem operational truth. The frontend prototype remains alignment evidence only.

## Evidence under review

The following client files are read-only business evidence:

1. `C:\Users\Admin\Downloads\PM - B248 Sanrio Characters Emokyun Mejirushi Accessory Volume 2.pdf`
   - Product Master / Packaging Matrix style evidence.
2. `C:\Users\Admin\Downloads\PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx`
   - Parts List, injection, injection-shot, decoration, assembly, and packaging evidence.
3. `C:\Users\Admin\Downloads\B248_DECO_PMRS.xlsx`
   - Production material requisition, forecast, lot, regional, issue, balance, and demand-purpose evidence.

These files are not automatically canonical. Each field must be classified as `CONFIRMED`, `INFERRED`, `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE` before it influences the target design.

## Scope

### In scope

- Evidence authority and source precedence.
- Product, model, part, BOM, process, decoration, assembly, and packaging concepts.
- Controlled-document revision, approval, effective-date, and source-lineage requirements.
- Production-plan demand purpose, market or regional allocation, lot quantities, and model quantities.
- PMRS ownership boundary, requisition semantics, issue/balance semantics, and external-system references.
- Mixed units of measure, ratios, process parameters, and quantity precision.
- Lifecycle, invariants, authorization, endpoint semantics, and operational implications caused by the evidence.
- Reconciliation of open decision-register items and creation of explicitly marked candidate decisions.

### Out of scope

- Application source, Prisma schemas, migrations, generated artifacts, seeds, deployment files, or frontend files.
- Importing spreadsheets directly into a production schema.
- Declaring a spreadsheet formula or row order to be a domain invariant without confirmation.
- Resolving contradictions silently.
- Beginning implementation or granting implementation approval.

## Design principles for this reconciliation

1. Controlled client evidence outranks frontend convenience but does not outrank confirmed business ownership or an approved decision.
2. A Product Master, Parts List, and PMRS are different controlled artifacts with different purposes; they must not be collapsed into one generic product table or one spreadsheet-shaped aggregate.
3. BOM relationships, process specifications, execution routes, and material transactions are different concepts and must be modeled separately unless the evidence proves otherwise.
4. Derived values such as PMRS balance must have an identified source of truth and calculation rule.
5. A repeated spreadsheet pattern is evidence of a possible rule, not proof that the rule is universal.
6. Every unresolved mismatch is recorded with source, impact, classification, and an owner/question for confirmation.

## Sequential passes

### Pass 1 — Evidence Authority and Scope Lock

Create an evidence manifest and precedence model. Identify what each client artifact controls, what it only references, and what it cannot establish. Reconcile the evidence with the existing context, target design, architecture, data model, API catalog, cross-cutting design, decision register, normalization design, single-context revision, and Claude review.

Required outputs:

- Evidence manifest.
- Source-to-domain authority matrix.
- New or changed scope statements.
- Explicit list of stale, conflicting, inferred, and confirmation-required evidence.

### Pass 2 — Product, BOM, Process, Packaging, and Revision Model

Determine the minimum canonical concepts needed for the B248 evidence without cloning the workbooks. Review Product, Model, Part, controlled specification revisions, multi-level BOM relationships, process specifications, execution routes, assembly content, packaging hierarchy, all-model scope, and source-document lineage.

Required outputs:

- Canonical concept and relationship changes.
- Normalization findings.
- Revision and approval lineage requirements.
- Endpoint and authorization impact.
- Explicit handling of the Kuririn body identifier conflict.

### Pass 3 — PMRS, Planning, Quantity, and Lifecycle Model

Reconcile PMRS as a possible external reference, owned requisition domain, or hybrid boundary. Review demand purpose, market or region, forecast versus requisition versus issue, lot and model allocation, mixed units, ratios, issue history, balance derivation, correction policy, and plan lifecycle.

Required outputs:

- Decision analysis for D-007, D-010, D-020, D-021, and D-024.
- PMRS ownership options and recommended interim scope.
- Quantity and UOM invariants.
- Required lifecycle and concurrency rules.
- Explicit handling of the Asia 77,060 versus 77,860 discrepancy.

### Pass 4 — Conflict Reconciliation and Decision Register Update

Resolve only what can be resolved from authoritative evidence. For every remaining conflict, create a confirmation question and mark the affected design as `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`. Update the decision register with candidate decisions only; do not silently convert recommendations into accepted decisions.

Required outputs:

- Conflict register.
- Decision-by-decision impact table.
- Recommended answers with confidence and evidence basis.
- Approval questions for the client or business owner.
- Gate 0 re-entry criteria.

### Pass 5 — Consistency Review and Handover

Check the revised design as one chain: business evidence → bounded context → canonical model → lifecycle/invariants → REST contract → endpoint catalog/authorization → cross-cutting/on-prem operations → implementation handover. Confirm the mandatory REST standard remains satisfied and that no implementation task is under-specified.

Required outputs:

- Consistency matrix.
- Revised open-risk list.
- Documentation-only handover.
- Explicit implementation blockers.
- Exact first implementation task, subject to user approval.

## Required report format after every pass

Each pass report must contain:

- Pass completed.
- Evidence and documents inspected.
- What changed.
- Self-check result.
- Open questions or blockers.
- Classification of every unresolved item.
- Ready for next pass.

The report must distinguish document edits from recommendations. A recommendation is not an approved decision.

## Gate and approval rules

The reconciliation chain may complete only when:

- Every client artifact has an explicit authority classification.
- B248 product, parts, process, packaging, PMRS, and planning concepts have an identified canonical home or an explicit deferral.
- The Kuririn identifier conflict and Asia quantity discrepancy are not hidden.
- PMRS ownership and derived balance semantics are explicitly bounded.
- The revised design is consistent with the approved REST endpoint standard.
- The remaining questions have owners and a decision impact.

Completion of this plan does not authorize code or schema implementation. After the chain passes, the user must explicitly approve the implementation phase.

## Current execution state

All five client-evidence reconciliation passes are complete, and the user-approved decisive target
operating model is applied in the decision-resolution addendum. The reviewed client snapshots are
bounded `BUSINESS_EVIDENCE`; original source observations remain auditable and corrected revisions
must pass the release workflow. The design package is ready for Gate 0 review, not implementation.

## Expected implementation handover shape

The first implementation task remains the provider-neutral identity/assignment foundation after
Gate 0 and explicit user approval. The handover must list the intentionally deferred items,
especially ProductionLine, external identity-provider details, PMRS ownership, D-030 through D-036,
and unresolved source-data conflicts. See
`docs/superpowers/prompts/2026-07-15-pats-api-client-evidence-reconciliation-handover.md`.

The decisive target update is recorded in
`docs/superpowers/chains/2026-07-15-pats-api-client-evidence-decision-resolution.md`.
