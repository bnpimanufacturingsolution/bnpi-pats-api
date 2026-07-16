# Chain Run: PATS API Schema Normalization Revision

**Status:** COMPLETED — DOCUMENTATION-ONLY; IMPLEMENTATION BLOCKED

**Date:** 2026-07-15

## Continuation boundary

The original eight-pass API design chain, single-operational-context revision, and client-
evidence reconciliation chain are complete. This chain does not restart those activities. It
revises the normalized schema and its dependent design surfaces from the existing handover.

## Scope rules

- Work only in `bnpi-pats-api` on `develop`.
- Use the approved REST standard for all API design decisions.
- Preserve `NEEDS_CONFIRMATION`, `CONFLICTING`, and `STALE` labels.
- Keep the first deployment as one server-resolved operational context.
- Do not modify application source, Prisma schemas, migrations, generated artifacts, seeds,
  deployment files, or frontend files.
- Gate 0 freeze and explicit user approval remain required before implementation.

## Pass index

| Pass | Name | Status |
|---|---|---|
| 1 | Canonical entity and ownership map | completed |
| 2 | 1NF/2NF/3NF, keys, constraints, namespaces, and indexes | completed |
| 3 | Lifecycles, quantities, reconciliation, release, concurrency, idempotency, audit, and outbox invariants | completed |
| 4 | API, authorization, on-prem consistency review, and implementation handover | completed |

## Canonical entities in scope

`ControlledDocumentRevision`, `SourceReconciliationIssue`, `SourceReconciliationResolution`,
`SourceRevisionApproval`, `ProductSpecificationSnapshot`, `PartsListVersion`, `PartDefinition`,
`PartApplicability`, `BomDefinition`, `BomLine`, `ProcessSpecification`,
`ProcessSpecificationStep`, `PackagingSpecification`, `PackagingLine`,
`PlanDemandAllocation`, `MaterialRequirement`, `InventoryTransaction`, `SubjectPreference`,
and `SubjectWalkthroughCompletion`, together with the existing `PMRSReference`,
`PlanModelAllocation`, `PlanPart`, and `RouteStep` boundaries.

## Global self-check

Every pass must confirm:

- only documentation/design files were touched;
- no existing tests or implementation files were weakened or changed;
- every inferred, conflicting, stale, or unresolved item is labelled;
- relational truth is not hidden in JSON or duplicated editable totals;
- endpoint-related changes comply with the REST standard and checklist;
- `git diff --check` passes;
- open questions are recorded rather than guessed.

## Required report format

Each pass report records:

- Pass completed
- What changed
- Self-check result
- Open questions or blockers
- Ready for next pass

## Completion condition

Pass 4 may complete the documentation revision only when the normalized design, architecture,
data model, endpoint catalog, cross-cutting design, decision register, plan, and handover agree.
This completion is not implementation approval.

## Completion result

All four normalization-revision passes completed sequentially. The normalized schema, conceptual
data model, architecture, endpoint catalog, cross-cutting design, decision register, plan, and
handover agree on ownership, typed namespaces, derived quantities, source reconciliation, audit/
outbox atomicity, and the single operational context. Gate 0 remains pending and implementation
requires separate explicit user approval.
