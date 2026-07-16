# PATS API Schema Normalization Revision Handover

**Status:** READY TO RESUME — DOCUMENTATION-ONLY SCHEMA REVISION

**Date:** 2026-07-15

**Target repository:** `C:\Users\Admin\Documents\Projects\BANDAI PATS\bnpi-pats-api`

**Target branch:** `develop`

## Why this handover exists

The previous session completed the client-evidence reconciliation chain and reached the point
where the canonical relational model should be iterated again before any Prisma or application
implementation. Context compaction interrupted the start of that schema revision. Resume from
the focused normalization revision below; do not restart the entire design chain and do not
begin implementation.

The current shell context may point at `bnpi-pats-app`. That is not the target for this work.
Change the working directory to `bnpi-pats-api` and confirm the branch before editing.

## Non-negotiable scope

- Documentation-only.
- Work on `develop`.
- Do not modify application source, Prisma schemas, migrations, generated artifacts, seeds,
  deployment files, or frontend files.
- Do not silently resolve uncertainty. Use `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`.
- Implementation remains blocked until Gate 0 decisions are frozen and the user explicitly
  approves the implementation phase.
- Continue the four schema revision passes sequentially. Report each pass, then continue without
  waiting unless a genuine external blocker requires user input.

## Canonical state already completed

The original API design chain and the 2026-07-15 single-operational-context/client-evidence
revisions are complete as documentation. The relevant canonical documents are:

1. `AGENTS.md`
2. `docs/standards/restful-endpoint-design-standards.md`
3. `docs/principles/restful-endpoint-design-principle.md`
4. `docs/standards/endpoint-design-review-checklist.md`
5. `docs/superpowers/context/2026-07-14-pats-api-design-context.md`
6. `docs/superpowers/specs/2026-07-14-pats-api-target-design.md`
7. `docs/architecture/2026-07-14-pats-api-target-architecture.md`
8. `docs/data/2026-07-14-pats-api-data-model-design.md`
9. `docs/data/2026-07-14-pats-api-normalized-schema-design.md`
10. `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`
11. `docs/api/2026-07-14-pats-api-cross-cutting-design.md`
12. `docs/decisions/2026-07-14-pats-api-design-decision-register.md`
13. `docs/superpowers/plans/2026-07-14-pats-api-design-and-implementation-plan.md`
14. `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md`
15. `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-reconciliation-chain.md`
16. `docs/superpowers/chains/2026-07-15-pats-api-client-evidence-decision-resolution.md`

The client evidence was analyzed from:

- `C:\Users\Admin\Downloads\B248_DECO_PMRS.xlsx`
- `C:\Users\Admin\Downloads\PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx`
- `C:\Users\Admin\Downloads\PM - B248 Sanrio Characters Emokyun Mejirushi Accessory Volume 2.pdf`

## Decisive target decisions already approved by the user

These are target design decisions, not implementation authorization:

- First deployment is one server-resolved operational context, not SaaS multi-tenancy.
- Do not persist `Workspace`, workspace membership, client-selected tenant scope, or
  `ProductionLine` in the first release. Revisit `ProductionLine` only if a shared database or
  meaningful multi-line identity is confirmed.
- `Subject` is the internal persisted identity; `/api/v1/users/me` is its authenticated public
  projection.
- Use a provider-neutral on-prem OIDC-compatible identity adapter boundary. Persist provider,
  issuer, and provider subject; do not use raw provider claims as authorization truth.
- Persist locale in `SubjectPreference`. Persist walkthrough completion as versioned child rows;
  these are not authorization truth.
- Product Master owns product/package identity.
- Parts List owns parts, BOM, process, decoration, assembly, and packaging structure.
- PMRS is a reconciled control projection/reference. PATS owns PATS-scope material requirements
  and issue evidence; ERP/Warehouse owns physical stock and procurement.
- Use append-only `InventoryTransaction` issue evidence. Derive issued and balance quantities;
  do not create mutable duplicated `issued` or `balance` truth.
- Quantity design must preserve magnitude, UOM, usage basis, precision, and source representation.
  Ratios such as `1/40`, `1/200`, and tape-per-200 must not be silently converted.
- Missing tolerance means strict equality. Explicit tolerance must be declared per requirement or
  operation; variance becomes auditable exception evidence.
- Market/region and demand purpose are first-class plan-demand dimensions. Model totals are
  derived/reconciled, not independently editable duplicate totals.
- Source conflicts are solved through controlled source revision workflow:
  draft revision -> validation -> blocking reconciliation issues -> authorized resolution ->
  approved immutable revision -> release.
- Kuririn Body canonical part code is `B248-02-08`. `B248-01-08ST` is an invalid source
  reference retained as correction/audit evidence. A corrected source revision is required before
  publication.
- For Asia PMRS, the latest approved line values are canonical: total `77,860`, issued `77,060`,
  balance `800`. The stale `77,060` header is source evidence only; header totals are derived
  from line totals.
- Per-resource DELETE is retirement/soft-delete with reads returning 404. Use 410 only for an
  explicitly permanently removed resource. Append-only source, issue, audit, and outbox evidence
  has no ordinary DELETE.

## Current decision status

Gate 0 is still pending. D-006, D-020, D-021 and other listed decisions must remain visibly
classified until explicitly frozen. The decisive client-evidence behavior above is the target
solution for the known manual conflicts; do not reintroduce simultaneous competing canonical
values or a vague “hybrid” model.

Relevant new decisions are D-030 through D-036:

- D-030 controlled source revision and lineage;
- D-031 normalized parts/BOM/process/packaging;
- D-032 typed identifier namespaces;
- D-033 canonical Kuririn code and correction-release gate;
- D-034 first-class demand dimensions;
- D-035 latest-approved line quantities with header-derived totals/balances;
- D-036 subject locale and walkthrough records.

They are proposed target decisions, not a license to implement.

## Next work: four-pass schema normalization revision

Create a new dated plan and chain under `docs/superpowers/` if they do not already exist. Execute
these passes in order and create a short report for each:

### Pass 1 — Canonical entity and ownership map

Reconcile the canonical data model and normalized schema around these entities and ownership
boundaries:

- `ControlledDocumentRevision`
- `SourceReconciliationIssue`
- `SourceReconciliationResolution`
- `SourceRevisionApproval`
- `ProductSpecificationSnapshot`
- `PartsListVersion`
- `PartDefinition`
- `PartApplicability`
- `BomDefinition`
- `BomLine`
- `ProcessSpecification`
- `ProcessSpecificationStep`
- `PackagingSpecification`
- `PackagingLine`
- `PlanDemandAllocation`
- `MaterialRequirement`
- `InventoryTransaction`
- `SubjectPreference`
- `SubjectWalkthroughCompletion`

Clarify how these relate to existing concepts such as `PMRSReference`, `PlanModelAllocation`,
`PlanPart`, `RouteStep`, and `InventoryTransaction`. Resolve duplicate ownership rather than
merely adding aliases.

### Pass 2 — 1NF/2NF/3NF and relational constraints

For every proposed relation, document primary key, foreign keys, candidate/business uniqueness,
identifier namespace, nullability, relationship attributes, and required indexes. Ensure:

- no spreadsheet-shaped repeating groups;
- no JSON used for relationships, route steps, authorization truth, current position, or balances;
- no duplicated editable totals;
- source revision lineage is relational and immutable after approval;
- part codes, product codes, item numbers, controls, mold/equipment references, and external
  identifiers remain typed fields in distinct namespaces;
- plan demand, model applicability, material requirement, and issue evidence are not collapsed
  into one overloaded row.

### Pass 3 — Lifecycle, quantity, reconciliation, and release invariants

Define relational and application invariants for:

- source revision lifecycle and immutable approved versions;
- blocking issue creation/resolution and approval/release;
- canonical Kuririn and Asia PMRS values;
- quantity magnitude/UOM/usage basis/precision/source representation;
- strict equality and explicit tolerance/variance;
- material requirement lifecycle and append-only issue ledger;
- derived issued/balance calculations;
- optimistic concurrency, idempotency, audit, and outbox boundaries;
- subject preference and versioned walkthrough completion.

### Pass 4 — API mapping, consistency review, and implementation handover

Map normalized relations to the endpoint catalog, authorization matrix, REST rules, on-prem
operational boundaries, and migration sequencing. Check that every endpoint has an owning
aggregate, authorization rule, lifecycle behavior, concurrency behavior, idempotency behavior,
trace propagation, and RFC 9457 error behavior. Record remaining Gate 0 blockers and produce the
next implementation handover without modifying implementation files.

## Required report format after every pass

- Pass completed
- What changed
- Self-check result
- Open questions or blockers
- Ready for next pass

At the end, report that implementation remains blocked unless the user separately and explicitly
approves implementation after Gate 0.

## Validation requirements

At minimum run documentation checks appropriate to the repository, including:

- `git diff --check`;
- search for stale tenancy/workspace/“hybrid” claims in canonical documents;
- search for duplicated or conflicting canonical values for the Kuririn and Asia PMRS cases;
- confirm no non-document files were modified;
- confirm all new references and links resolve.

## Exact restart prompt

Paste the following into the new session:

```text
Continue the Bandai PATS API documentation-only design work in:

C:\Users\Admin\Documents\Projects\BANDAI PATS\bnpi-pats-api

Work directly on develop. Ignore the current bnpi-pats-app context; that is a different
repository. First confirm the API repository and branch.

Read AGENTS.md and the required API design documents in their established order, then read this
handover:

docs/superpowers/prompts/2026-07-15-pats-api-schema-normalization-revision-handover.md

The original API design chain and the 2026-07-15 client-evidence reconciliation chain are already
complete. Do not restart them. Resume the focused four-pass schema design and normalization
revision described in this handover.

Execute the four passes sequentially without stopping after each pass unless a genuine blocker
requires my decision. After every pass report: Pass completed, What changed, Self-check result,
Open questions or blockers, Ready for next pass.

Pass 1: canonical entity and ownership map.
Pass 2: 1NF/2NF/3NF, keys, constraints, namespaces, and indexes.
Pass 3: lifecycles, quantities, reconciliation, release, concurrency, idempotency, audit, and
outbox invariants.
Pass 4: API/authorization/on-prem consistency review and implementation handover.

Use the decisive target behavior already recorded in the handover: single server-resolved
operational context; no first-release Workspace, membership, or ProductionLine persistence;
Product Master/Parts List/PMRS/PATS ownership boundaries; normalized parts/BOM/process/packaging;
dimensioned demand; derived PMRS totals and balances; append-only InventoryTransaction issue
evidence; canonical Kuririn code B248-02-08; Asia latest-approved line total 77,860, issued
77,060, balance 800; and controlled source revision/reconciliation/release workflow.

Do not silently resolve uncertainty. Preserve NEEDS_CONFIRMATION, CONFLICTING, and STALE labels.
Do not modify application source, Prisma schemas, migrations, generated artifacts, seeds,
deployment files, or frontend files. Implementation remains blocked until Gate 0 is frozen and I
explicitly approve implementation.

Use apply_patch for documentation edits. At completion run git diff --check, verify only
documentation changed, and provide the final handover and next-step recommendation.
```
