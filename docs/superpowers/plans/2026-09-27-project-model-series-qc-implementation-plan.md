# Project Model Quantities, Series, QC, and Completion — Implementation Plan

**Date:** 2026-09-27  
**Status:** PLAN FOR IMPLEMENTATION — Project v1 exception and Batch/Lot cleanup extension approved  
**Owner:** Product/API owner (user)  
**Repositories:** `bnpi-pats-api` + sibling `bnpi-pats-app`  
**Proposed branches:** `feature/project-model-series-qc-lifecycle` in both repos

## Goal

Make the active Projects flow represent a production requirement by Model, derive required
quantities for its ModelParts, mint stable per-ModelPart Batch series, capture simple Batch-level QC
disposition, and allow explicit
Project completion after work is resolved. Project is the primary object; floor execution is
integrated only at the minimum boundaries needed to make its result truthful.

## User-confirmed design constraints

- Project is the requirement; floor execution produces the result.
- Project total is the sum of per-Model required quantities in EA.
- Default batch quantity is 200 and configurable.
- Final required Batch may be partial: 10,100 at 200 yields 51 series, final quantity 100.
- A Batch/Series is for one ModelPart; `x/y` numbering is per ModelPart and is assigned before
  execution. QC failure never renumbers later series.
- A QC item is a Batch. Rework retains the same Batch/series identity. True-NG retains its original
  series identity.
- True-NG compensation is currently physical (needed items are taken from upcoming production);
  its exact transfer/quantity rule is unconfirmed. This plan will not automate replacement, transfer
  quantities, or margin.
- Project completion readiness is derived; an authorized person explicitly confirms completion.
- No production deployment exists. Dev DB is disposable, but destructive migration still gets
  backup + row-count preflight. Historical migrations are immutable.
- Detailed Receiving/Issuance, scanning/printing workflow, inventory, reports, and line screens are
  deferred to a separate floor-execution session. The only floor-facing changes in this slice are
  the stable Series label field and Batch/QC lifecycle data required by Project.

## Confirmed ModelPart quantity basis

The user specified Project order quantity per Model and one-unit-per-ModelPart quantities for the
described Product Pack (e.g. 100 Models → 100 each of head, arms, body, legs). Therefore, for this
Product Pack, each ModelPart's required quantity equals its parent ProjectModelRequirement quantity.
Series count is per ProjectPart. Do not introduce a generic BOM multiplier for the stated case. If
future Product Packs contain a ModelPart more than once per Model, that requires explicit source data
and a later schema extension; it must not be guessed.

## Proposed minimal domain model

### Project

- Lifecycle candidate: `DRAFT → RELEASED → COMPLETED`.
- `READY` is a derived release-readiness result, not stored state; `PAUSED` belongs to execution
  holds, not the requirement. Post-release cancellation remains deferred until in-process work
  disposition is defined; draft deletion remains available.
- Project target quantity is derived from Project Model Requirements. Keep a read-only
  `requiredProductionQuantity` response projection only if useful to clients; do not store a second
  editable total.
- Add `completedAt` and `completedBySubjectId` for the explicit closure confirmation.
- Release freezes product/model quantities and Part/route snapshots.

### ProjectModelRequirement (renames current ProjectModelAllocation)

- One row per `(projectId, modelId)`, with `requiredQuantity` (integer EA) and provenance/source
  reference only if an active app use is confirmed.
- Remove allocation semantics and speculative child `DRAFT/COMMITTED/SUPERSEDED` lifecycle if the
  parent Project lifecycle owns editability.
- Project total = sum of these requirements.
- User-facing label: **Model quantities**.

### ProjectPart quantity requirement

- For the described Product Pack, each Project Part snapshot maps one-to-one to one ModelPart and
  links to its parent ProjectModelRequirement. Example: Model 01 order quantity 100 requires 100
  each of its six listed parts. Do not add a usage multiplier, ask Project authors for duplicate
  per-Part quantities, or store a second independently editable per-Part order quantity.
- Project Part requirement quantity is derived from its parent Model Requirement and is the target
  from which Part-specific series are minted.

### Batch size and Series

- Reuse the existing Project `ProductSpecification.trayQuantityStandard` as the configurable
  Project-level batch-size value; default to 200 and freeze on release. Do not add a batch-size
  entity or per-Model value unless product evidence requires variation.
- `seriesCount = ceil(projectPartRequiredQuantity / batchSize)` per Project Part requirement.
- Persist `seriesNumber` and denominator/count on Batch at release. Last Batch's planned quantity
  is the remainder (1..batchSize). Series identity remains immutable through QC and rework.
- Each Series Batch belongs to exactly one Project Part and one Lot, with its own quantity,
  `seriesNumber`, and `seriesCount`. Use a direct Batch→ProjectPart relation; do not retain a
  multi-Part `BatchPartLine` join for a unit the user has defined as one ModelPart. The API response
  should say `part`, not `parts[]`.
- Do not mint reserve/replacement series or transfer quantity after True-NG in this slice.

### Lot

- Preserve D-037: one Lot per Project.
- Lot is the Project's trace envelope. No independently editable Lot target or Lot lifecycle if
  those values are derived from the Project/Batches.
- D-041 amendment (2026-09-28): create the single project-owned Lot atomically with the draft
  Project; there is no separate Create Lot trigger. The initial Lot Code is a suggestion and may
  be customized before submission. Lot name follows Project name; lot target derives from model
  order quantities; batch size comes from the Project ProductSpecification.
- Paper PMRS Control No is not a Project/Lot field. It is allocated Decoration requisition
  information with resource ownership/lifecycle `NEEDS_CONFIRMATION`; it is removed from the active
  Project UI/API/schema pending a separately approved PMRS/allocated-requirements design.
- Lot does not choose a primary Part. Its member Project Parts and their series come from the
  Project Model Requirements.

### QC / Batch disposition

- Keep `QualityInspection` attached to Batch and retain stage/actor/evidence fields.
- Store `failureDisposition = REWORK | TRUE_NG` separately from `reasonCode`; `FAILED` alone is
  not enough to drive the Project result. `PASSED` and `HOLD` retain their current meanings.
- Rework remains on the same Batch/Series; its unresolved disposition blocks Project completion
  until a later passing or True-NG inspection attempt. The physical rework screen/route is deferred.
- True-NG is terminal QC evidence for that Batch. Preserve the QC reason/actor/time. Do not infer or
  write the floor's physical upcoming-item substitution.
- Project completion readiness: every released Batch has a terminal final QC disposition, and no
  unresolved rework/hold remains. Completion confirmation locks ordinary Project execution writes.
  Report recorded PASS/REWORK/TRUE_NG and target variance honestly; do not represent physical
  substitution as a digitally reconciled quantity.

## Endpoint/API work (after gate and exception record)

### Canonical Project quantity resource

- Replace `POST /api/v1/projects/{projectId}/model-allocations` with
  `PUT /api/v1/projects/{projectId}/model-requirements`, a one-level child collection whose
  representation replaces the complete requirement set. This is idempotent field replacement;
  requires the current Project `If-Match`; one transaction validates Product/Model ownership,
   duplicate Model IDs, positive EA quantities, and updates Project rowVersion. Same request safely
  retries; stale version → `412`; invalid model/quantity → RFC 9457 `422`; conflicting lifecycle
  → `409`.
- Project detail returns `modelRequirements` plus derived total and frozen batch/series information.
  Do not return duplicate `modelAllocations` aliases.

### Lifecycle transitions

- Replace verb path `POST /projects/{projectId}/release` with `PATCH /projects/{projectId}` status
  transition `DRAFT → RELEASED`. Release checks server-owned model/part requirements and route
  snapshots, creates per-ModelPart Batches with immutable Series identities, and activates them atomically. Same
  `If-Match` + `Idempotency-Key` contract, RFC 9457 errors, audit/outbox.
- Add `PATCH /projects/{projectId}` transition `RELEASED → COMPLETED`; require If-Match and
  idempotency; reject until all released Batch/QC work is terminal. Record actor/time and audit.
- The `/release` route and `/model-allocations` operation are existing v1 public contracts. The
  immediate, scoped v1.2.1 §7 exception was approved by the user (D-041 narrative) because no
  production deployment exists and the active app is the only consumer. Exception owner: user.
  Review condition: before any external consumer or production deployment. Update OpenAPI and record
  the exact removed request/response fields; no Batch `parts[]` break is needed in this slice.
- **Correction to exception scope (approved and implemented 2026-09-28):** a direct Batch→ProjectPart
  relation removes the public `parts[]` batch request/response and Lot `partAllocations`
  projection and drops `BatchPartLine` rows/table (migration
  `20260927150000_project_batch_single_part`, guarded: every existing Batch had exactly one
  line whose quantity equaled `plannedQuantity`). `LotPartAllocation` storage is retained but
  unexposed. Lot single-Part request/response fields removed per the D-041 Lot amendment.
- **Verification evidence (2026-09-28, local dev):** migration deployed; all 27 existing
  Batches carry `partId`; fresh reseed (15 projects / 9 lots / 27 batches); API
  `tsc`+`eslint` clean, mocha 448/448; app `tsc`+`eslint` clean, vitest 842/842;
  API acceptance journey 35/35; Playwright `release-as-publish` headed pass
  (create with quantities → lot → release mints 15 singular-part Series Batches);
  Playwright `project-series-qc-completion` headed pass (stage event to route
  stage → line-QC Cosmetic fail with TRUE_NG disposition → remaining Batches
  PASSED → completion-ready → Complete → COMPLETED).
  Floor findings fixed in-slice: catalog ModelParts now seed the standard route
  (`standardModelRoute()`; release snapshots were empty so fresh Batches were
  unroutable), and the Projects index hydrates catalog models (quantity rows
  never rendered). Demo-pack ModelParts keep empty routes (NEEDS_CONFIRMATION).
  Standard sections reviewed: REST v1.2.1 §2–§12 per checklist; no new exception taken.
- Add QC `failureDisposition` to existing QC decision request/response; no new floor route/screen
  family. Existing `reasonCode` stays the defect reason. A failed request without a disposition is
  treated as unresolved/legacy and cannot satisfy Project completion until resolved.

**REST review evidence required before implementing endpoints:** v1.2.1 §2, §3, §4, §5, §6, §7,
§8, §9, §10, §11, §12; checklist PASS/N/A by item; path/resource identity; request/response; RFC
9457 statuses; capability/object scope; If-Match/idempotency; OpenAPI and focused contract tests.

## App work (no layout/style redesign)

- Project create must not write placeholder quantity `1`. Create the draft requirement header, then
  author Model quantities and their ModelPart requirements in the Project flow before Lot/release.
- Add a simple **Model quantities** table in the existing Project work surface: selected Model,
  required quantity, computed Project total. Show ModelPart required quantities/Series beneath each
  Model using the Routing tree-table pattern. The project-wide configurable batch size defaults to
  200; the existing hierarchy/table visual language is the reference; no new visual system.
- Lot quantity displays the derived sum; do not ask the user to re-enter it.
- Show per-Model Series `x/y`, actual planned quantity (including a partial final Batch), QC
  disposition, and a derived completion-ready state in the existing Project/Batches surfaces.
- Add `REWORK` / `TRUE_NG` disposition choices to the existing QC fail flow while retaining defect
  reason and note. No scanner, printer, Receiving/Issuance, inventory, reports, or route-screen
  redesign beyond carrying Series onto the existing label preview/physical Label IR.
- Existing user direction freezes layout/styling; functional component edits above are limited to
  the existing Project and QC surfaces and must be presented in this plan first. No component
  style/token changes.

## Migration/reseed and safety

1. Confirm both worktrees are on `develop`, clean except the two known design reports; create
   matching feature branches before code edits.
2. Before destructive DB changes, record row counts and take a dev backup. Historical migration
   files are immutable. New migration renames/removes/recreates affected schema only after the
   exact data disposition is documented. The dev DB is disposable; fresh-reseed after migration.
3. Regenerate Prisma client; validate schema; apply migration; verify `Project`, requirement,
   Batch series, QC disposition rows, enum/table removals and counts.
4. Update seed to create consistent Project Model Requirements, ModelPart quantities, one Lot,
   per-Part Batches/Series, routable part links, and QC fixtures. No invented
   True-NG replacement transfer rows.

## Verification gates

- API: Prisma validate/generate, TypeScript, ESLint, full tests, focused Project requirement/release/
  completion/QC disposition contract tests, OpenAPI generation + validation, runtime 404/405 checks
  for excepted paths, fresh reseed, acceptance journey (known unrelated route-step gap tracked).
- App: typecheck, lint, full Vitest suite, focused Project/QC/adapter suites; headed Project create →
  configure model quantities → lot/release → Series labels → QC pass/rework/True-NG → completion
  confirmation; existing arrival and release-as-publish journeys remain green.
- Keep UI layout/styling frozen. Layout changes require a new proposal and explicit approval.

## Implementation entry gates

- The Project v1 §7 exception is approved and recorded. BatchPart/LotPart removal is outside that
  approved exception until its precise scope is approved; preserve the existing representation if
  the user declines the extension.
- The current Product Pack one-part-per-ModelPart assumption is confirmed by the user example. Do
  not generalize it to future packs without source evidence.
- Project QC in this slice is final output QC for a whole Batch. Existing intermediate-stage QC
  evidence does not itself close a Batch; only the designated output disposition is terminal.
- The Part-quantity data basis is confirmed; no `quantityPerModel` field or general BOM multiplier
  is added for the described Product Pack.

No historical migration edits. Run destructive preflight/backup on the disposable dev database,
then fresh-reseed after applying the new migration.
