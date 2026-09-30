# Project → Floor → QC → Completion — Design Proposal

**Date:** 2026-09-27  
**Status:** PROPOSAL FOR REVIEW — no schema, API, or UI changes authorized by this document  
**Scope:** Project is the primary design subject. Include only the minimum floor execution and
QC semantics needed to make Project result and completion truthful. Detailed Receiving/Issuance,
scanner/printer, inventory, and floor-screen design remain separate work.  
**Confirmed by user in this session:** Project is the production requirement; floor execution is
the path that fulfills it; QC applies to the output Batch; QC can result in rework or True-NG;
Project completion readiness is acceptable if the final Project close is explicitly confirmed.
**Further confirmed (2026-09-27):** Project target is the sum of per-Model quantities in EA;
for the stated Product Pack each ModelPart is one per finished Model; Batch size defaults to 200
but is configurable; the final required Batch may be partial; Series numbering is per ModelPart;
QC failure does not renumber later series.

## 1. Product meaning

`Project` is the authored production requirement. It is not the production result. Floor execution
creates evidence against that requirement; QC determines whether output is accepted, requires
rework, is held, or is True-NG. The Project result is a projection over that evidence.

```text
Project requirement → Lot trace identity → Batch execution unit → QC disposition
       target          one per Project       current scan unit        result
```

The Project should retain its target and released definition. It should not have its required
quantity overwritten by actual output. Actual accepted-good and True-NG quantities are derived
from execution/QC evidence.

## 2. Proposed minimal normal lifecycle

```text
DRAFT → RELEASED → COMPLETED
```

- **DRAFT:** Requirement is being authored. Project target, model allocation, product/part
  snapshots, and routing may be configured. Existing draft deletion can remain the discard path.
- **RELEASED:** Requirement is published to floor execution. Freeze the requirement and the
  product/part/routing revision consumed by the run. Mint or activate the required Batches once.
- **COMPLETED:** Authorized user confirms that this Project has a final result and no more
  production/QC work should be recorded against it. Record `completedAt` and `completedBy` as
  closure evidence; do not copy mutable quantity totals into a second source of truth.

`READY` should be a derived readiness calculation, not a persisted lifecycle status: the user
already has a release checklist, but nothing performs a Ready transition. `PAUSED` should not be a
Project status: a batch hold or blocked floor operation is execution state, not a change to the
requirement. The proposal does not resolve post-release cancellation; that needs a disposition rule
for already-started work and is outside the normal path.

## 3. QC semantics required by this path

The user confirmed that a QC item is the output **Batch**. Keep the existing inspection-to-Batch
relationship; do not introduce a serialized-item entity or a new quality aggregate for this pass.

An inspection decision must express disposition, not merely a generic failure reason:

| QC disposition | Meaning for execution | Contribution to Project result |
|---|---|---|
| **PASS** | This inspection accepts the Batch at this QC gate; execution may continue if more route remains | Not final Project good output unless this is the final acceptance gate |
| **REWORK** | Same Batch identity returns to execution/rework; inspection attempt remains historical evidence | Not accepted good output while rework remains open |
| **TRUE_NG** | Batch is permanently rejected/scrapped | Terminal rejected quantity; never counts as accepted good output |
| **HOLD** | Decision is pending; Batch cannot be treated as accepted or terminal | Blocks Project completion |

Use the same Batch identity through rework. Record each inspection attempt/disposition append-only;
rework must not mint a second Batch or double-count output. After rework the Batch returns for another
QC attempt. A True-NG Batch is terminal. This matches the user's whole-Batch QC unit and avoids
partial-piece disposition machinery.

**Important boundary:** PASS at an intermediate QC stage is not Batch completion. A Batch becomes
final accepted output only after required execution is finished and the applicable final QC gate
passes. Detailed routing/backward movement for rework is a floor-execution dependency; this pass
defines the disposition effect, not the rework screen or station workflow.

## 4. Completion readiness and confirmation

`completionReady` is derived; it is not another stored Project status. It is true when:

1. Every Batch under the Project is terminal: final accepted/closed or True-NG/scrapped.
2. No Batch is active, held, awaiting rework, or awaiting a required QC decision.
3. The Project outcome can be calculated from evidence: target quantity, accepted-good quantity,
   True-NG quantity, and any unfulfilled quantity.

When ready, show a single **Complete Project** action. Confirmation closes the Project against
further ordinary execution writes and records the final actor/time. If accepted-good output is
below target, require an explicit shortfall disposition/reason at confirmation. If output exceeds
target, retain the actual quantity and make the overrun visible; never silently cap it at target.

Do not auto-complete merely because good output reaches the target: other Batches may still be in
process, held, under rework, or awaiting QC. Do not make QC PASS itself close the Project.

## 5. Quantity and schema implications (proposed, not accepted)

The current structure carries `Project.requiredProductionQuantity`, per-model
`ProjectModelAllocation.plannedQuantity`, and `Lot.requiredProductionQuantity` independently.
Before schema changes, define one quantity rule. Candidate recommendation:

- Project target means **required accepted-good output**.
- Model allocation quantities are the breakdown of that target. If they share one unit/basis, their
  total must reconcile to the Project target before release. If they do not share a compatible basis,
  do not sum them; record the product-specific rule first.
- A one-to-one Lot is the trace identity for the Project, not a second editable target. Its quantity
  should be derived from or an immutable release snapshot of the Project target—not independently
  editable before/after release.
- Batch quantities partition the Lot target at release. Accepted-good, True-NG, rework, and open
  quantities reconcile from Batch/QC evidence; Project-level actuals are derived.

This is the main open modeling question: confirm whether allocation quantities are homogeneous
finished-product quantities that sum to the Project's required-good target. Do not enforce a sum
until that unit/basis is confirmed.

## 6. Current implementation gaps against the proposal

- The Project tab creates `Project` directly, but initial `requiredProductionQuantity` is a
  placeholder `1`; the creation form does not collect the target quantity.
- The Project UI has no model-allocation authoring control. The release-as-publish headed test
  performs that step directly through the API before it can create the Lot.
- API release currently gates only on status (`DRAFT`/`READY`), not on the UI's release checklist.
  Once the readiness rules are accepted, the API must enforce them as authority.
- QualityDecision is currently `PASSED/FAILED/HOLD`; `REWORK` is only a `reasonCode`, not an
  operational disposition, and True-NG is not modeled. QC decisions do not currently change Batch
  execution state or provide a final accepted-good result.
- Batch `CLOSED`/`SCRAPPED` statuses exist but the ordinary app/API does not yet provide the full
  terminal disposition flow needed to make Project completionReady meaningful.
- Lot is one-to-one with Project (D-037) but still has a separately stored status and quantity;
  current release activates Batches while leaving Lot `PLANNED`.

These are discovery findings, not authorization to implement all listed changes in this pass.

## 7. External manufacturing references and what they imply

These are product-documentation precedents, not requirements that PATS copy a vendor's full ERP:

1. **Microsoft Dynamics 365 Supply Chain Management — [Report production orders as finished](https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/report-production-orders-as-finished):** supports partial good quantity and error quantity with reason; “Reported as finished” prevents additional quantity reporting.
2. **Microsoft Dynamics 365 Supply Chain Management — [Production process overview](https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/production-process-overview):** distinguishes progress/reporting, receipt of finished quantity, quality assessment, and the later “Ended” state that prevents further postings. Not every lifecycle activity must be a status.
3. **Microsoft Dynamics 365 — [Production order posting](https://learn.microsoft.com/en-us/dynamics365/finance/general-ledger/production-posting):** distinguishes reporting finished/error quantities from ending the order; end locks out additional postings.
4. **SAP Digital Manufacturing — [Production Order Completion](https://help.sap.com/docs/sap-digital-manufacturing/integration-guide/production-order-complete):** supports automatic order completion when all execution units finish the final reporting step, or manual completion in order management.
5. **Oracle JD Edwards — [Understanding Discrete Work Order Completion](https://docs.oracle.com/en/applications/jd-edwards/supply-chain-manufacturing/9.2/eoash/understanding-discrete-work-order-completion.html):** supports partial/full completion, separate completed/scrapped quantities, and an over-completion warning.

**Design inference:** automate readiness from completed execution/QC facts; keep the irreversible
“no more production against this Project” close as an explicit confirmation until PATS has a
well-defined final Batch event and reconciled quantities. If later the final operation is guaranteed
to close every Batch and all QC dispositions are terminal, auto-completion can be evaluated without
changing the meaning of Project results.

## 8. Decisions for review (no implementation yet)

1. Confirm Project quantity semantics: target **accepted-good output** (recommended) versus total
   attempted/started production.
2. Confirm whether per-model allocation quantities share a unit/basis and sum to the Project target.
3. Confirm whole-Batch QC disposition is acceptable (user stated QC item = Batch); mixed pass/rework/
   True-NG quantities within one Batch are not supported by this minimal proposal.
4. Confirm disposition vocabulary/meaning: PASS, REWORK, TRUE_NG, HOLD; current `FAILED` + reason
   distinction is retired in the candidate design.
5. Confirm completion confirmation ownership and whether shortfall can be explicitly closed.
6. Decide post-release cancellation only when the handling of active, held, rework, and True-NG
   Batches is defined.

No route shapes, status enum changes, schema edits, migrations, UI changes, or endpoint contracts
are approved by this proposal. Any resulting HTTP command design will be reviewed against the
mandatory REST standard and checklist before implementation.

## 9. Project quantity breakdown recommendation (review addendum)

The user asked what the current “model allocation” means and what the proper design should be.
The current entity is not allocating inventory or floor resources; it says how many units of each
Model this Project requires. “Allocation” therefore obscures its meaning.

**Recommendation: model this as Project Model Requirements / Project Model Quantities.** In the UI,
call the step “Model quantities.” Each row selects a Model from the chosen Product Pack and gives
the required finished-unit quantity for that model. The Project is the parent requirement; these
rows are its breakdown, not a separate planning aggregate.

Candidate invariants, contingent on confirming that all model quantities use the same finished-unit
basis (EA):

- Each Model belongs to the Project's selected Product.
- A Project has at most one requirement row per Model.
- Each included Model quantity is a positive integer.
- Project target quantity is derived as the sum of included Model quantities; do not store and
  separately edit another Project total.
- A Project with no model quantities is incomplete and cannot be released.
- Release freezes the model-quantity set and the Parts/PartsList route snapshot used by the run.
- Each released Batch belongs to exactly one Project Model Requirement and one Lot. Batches are
  minted per model requirement (tray-sized within that model's required quantity), rather than
  allocating the entire Lot quantity to the Lot's single `partId`.
- At Project level, accepted-good result is derived from final accepted Batch quantities;
  True-NG is reported separately; open rework/hold remains outstanding. The Project target is
  never overwritten with actuals.

This replaces the current `Project.requiredProductionQuantity` + `ProjectModelAllocation.plannedQuantity`
independent totals with one requirement source. It also exposes the current schema mismatch: one
Project has a one-to-one Lot, while release currently mints Batches using only `Lot.partId` and does
not populate `Batch.projectModelAllocationId`. The intended per-model Batch-to-requirement lineage
must be designed before changing the quantity schema or release algorithm.

**App dependency:** the Projects tab currently creates the Project with placeholder quantity `1`;
the active app has no model-quantity editor, and the headed release test supplies one allocation by
direct API call. The proper Project flow must make the model-quantity breakdown an app-authored,
validated Project step before Lot creation/release. This is a product-surface dependency, not a
request to build or restyle the floor screens in this pass.

### User clarification: ModelPart batch grain (2026-09-27)

The user clarified that a Project enters required quantity per Model, and each ModelPart is one
piece per finished Model for the stated Product Pack (for example, a 100-unit Model requirement
means 100 heads, 100 left arms, 100 right arms, 100 bodies, and 100 of each listed leg).
Project total = sum of Model requirements in EA is confirmed. Each output Batch/Series is for one
ModelPart, not a finished Model; therefore each ProjectPart requirement equals the parent Model
requirement for this product structure. Do not ask for duplicate per-Part quantities or infer a
general BOM multiplier. Future packs with repeated component usage need explicit source data and a
separate decision.

## 10. Candidate minimal schema shape (not approved)

| Concept | Candidate responsibility | Keep out to avoid duplicate/unused state |
|---|---|---|
| `Project` | Requirement header: code, name, product, lifecycle, version, release/completion actor/time | No independently editable total if model quantities are authoritative; no Workspace tenancy column under the accepted single-context target |
| `ProjectModelRequirement` (rename from `ProjectModelAllocation`) | One positive required EA quantity per included Model; unique `(projectId, modelId)` | No allocation lifecycle/status/child rowVersion if Project version governs draft edits; no supply/resource meaning |
| Project `Part` snapshots + `PartsList` versions | Frozen-at-release part and route data used by this run | No new route abstraction; keep Stage/SubStage and PartsList/RoutingStep as they are |
| `Lot` | The single D-037 trace envelope for the Project | No independent target quantity or status machine if both are derivable; keep lot code and identity. The accepted creation trigger (currently a UI action) must be decided before moving it to release. |
| `Batch` | Tray/output QC unit for one ProjectPart/ModelPart; linked to its Part requirement and Lot | No batch should be minted against an arbitrary Lot primary Part while losing ModelPart lineage |
| `QualityInspection` / `QualityDecision` | Batch/stage inspection attempts and disposition evidence | No per-piece/QC-item entity for this agreed Batch-level unit |

On release, mint tray-sized Batches **per ProjectPart/ModelPart requirement**, not from one
Project-wide Lot quantity and one Lot `partId`. A Project Model Requirement with six listed Parts
therefore produces six independently routed Part series for each ordinal. The Project result is a
read projection over model requirements, ProjectParts, Batches, and QC dispositions. Do not sum
Part batch quantities as if they were finished Model quantities; one finished Model comprises its
component Parts.

This shape removes two independent quantity/lifecycle dimensions while preserving the existing
Product → Model → ModelPart and Project → Lot → Batch identities. It is the candidate schema direction
for review, not a migration plan.

## 11. User clarification: series are the planned ModelPart Batch sequence (2026-09-27)

The user clarified the intended production unit and Lot Progress concept:

- Each Product Model has an order quantity under the Project.
- That model quantity is divided into output Batches, with a default Batch quantity of 200 that
  should be configurable.
- Each ModelPart is needed once per finished Model for the stated Product Pack. Each ModelPart has
  its own Batch series; `x/y` appears on its printed label and in Lot Progress, and the denominator
  uses that Part's required quantity.
- A QC-failed Batch retains its original series identity; later Batches are never renumbered because
  an earlier series failed.
- The user says the floor physically gets needed items from upcoming production after a True-NG,
  but exactly what quantity is taken and how the upcoming Batch/series is adjusted is unconfirmed.
- Margin/error allowance is not designed in this pass. No automated replacement or series shift is
  authorized by the note.
- The Project progress view may reuse the Routing configuration's expandable table hierarchy; that
  is presentation reuse, not a reason to persist another tree structure.

### Recommended identity rule

Assign each required series ordinal at Project release from the ModelPart requirement and the frozen
batch-size setting. Persist the series identity on the Batch (or an equivalent durable execution
identity); do not calculate `x` from current successful-output count. If Part Series 03 fails QC, it
remains Series 03 in all history and labels; Series 04 remains Series 04.

**Confirmed rule:** batch size is a target/max quantity and the final required Batch may be partial.
Thus a 10,100-unit ModelPart requirement at 200 per Batch has 51 required series: 50 × 200 and one
× 100. This avoids silently changing the requested quantity or forcing excess production. Series
numbering restarts for each ModelPart.

### True-NG physical compensation — record, do not automate yet

Keep the QC fact simple: True-NG permanently dispositions the inspected Batch; its original series
number remains visible and is never renumbered. Rework retains the same Batch/series identity. The
floor's physical substitution from upcoming production is acknowledged as current practice, but it
is **not yet a system rule**. Until confirmed, do not automatically create reserve series, subtract
quantities from an upcoming Batch, transfer good quantity between Batches, or silently alter the
Project target/series denominator. Preserve the True-NG evidence and leave physical compensation
outside the Project/QC state calculation in this first design.

This makes a boundary explicit: Project accepted-good totals cannot infer substituted units from
the True-NG event alone. If management later needs the digital result to account for those physical
substitutions, that requires a small, explicit reconciliation rule (source Batch, destination/need,
quantity, actor/time), designed with floor owners rather than inferred from the note.

Until then, Project completion must present recorded Batch/QC facts and must not label the target
“fulfilled” solely by assuming a physical True-NG substitution occurred. The user-confirmed final
completion action can close the Project with the recorded result; a future reconciliation feature is
only needed if the business requires the substituted quantity in digital fulfillment totals.

### Minimal schema delta implied by the clarified semantics

- `ProjectModelRequirement`: one required EA quantity per Model; the aggregate Project target is
  the sum of those rows.
- Each Project Part snapshot links to its parent Model Requirement. For the stated Product Pack,
  its required quantity is inherited 1:1 from that Model Requirement; no extra usage-ratio or Part
  total field is needed.
- Reuse the existing one-to-one `ProductSpecification.trayQuantityStandard` as the Project's
  configurable batch-size standard (default 200; editable before release). Do not add a separate
  BatchSize table or one batch-size field per Model unless plant practice proves they differ.
- `Batch`: one Project Part line, persisted `seriesNumber` and `seriesCount` (or
  stable equivalent), actual planned quantity for that series (final one may be partial), and current
  execution status. `seriesCount = ceil(projectPartRequiredQuantity / trayQuantityStandard)`.
- Rework/QC history stays attached to that same Batch. True-NG is a terminal disposition with its
  original series identity. The floor's physical substitution is not automated or represented as a
  quantity transfer in this pass.
- No `ProjectSeries` table unless a single series can legitimately span multiple Batches or have
  independent lifecycle. Under the user-described grain, the Batch itself is the series output unit.

This also means the old single `Lot.partId` release loop cannot define the sequence. Release must
generate series per Project Part requirement and preserve FIFO order within that Part's sequence.

### Remaining design checks

1. If future reporting must account for the physical substitution after True-NG, confirm how
   operators identify the donor/upcoming Batch and quantity. This is deferred; no reserve or
   replacement automation is included now.
2. Confirm who may Complete Project and what reason/evidence is required for a shortfall.
3. Define post-release cancellation only if/when needed; dispositions for active/rework/held Batches
   must be specified first.

These confirmed series rules are design constraints, not migration authorization. The model
requirement schema and per-model release logic still need review before implementation.
