# Paper Identifier Pattern Review — B248 PMRS

**Date:** 2026-09-28  
**Status:** Evidence normalization only; not identifier-format approval  
**Authority:** User-provided analysis of the B248 PMRS workbook. The repository evidence
manifest names `B248_DECO_PMRS.xlsx`; see
[`2026-07-15-pats-api-client-evidence-reconciliation-pass-01.md`](../chains/2026-07-15-pats-api-client-evidence-reconciliation-pass-01.md).
Do not infer API ownership or lifecycle from the worksheet alone.

## Cleaned observations

| Paper field | Normalized observed pattern / meaning | Status for PATS |
|---|---|---|
| **Product Code** | Examples `B248`, `A267`; supplied analysis describes `[A-Z][0-9]{3}`. Product name is the selected pack name. | `NEEDS_CONFIRMATION` as a universal validation rule. In PATS, Product Code comes from the selected Product/Pack catalog record; do not duplicate it as a Project-owned value. |
| **Part No.** | Examples `B248-01-01`, `B248-02-01`, `A267-01-01`; supplied analysis describes `{ProductCode}-{SubGroup}-{ItemID}`. | `NEEDS_CONFIRMATION` as a universal pattern. The observed B248 family is evidence, not a rule for every Product Part (e.g. shared capsule codes use another prefix). |
| **Lot No.** | Six numeric characters in the analyzed PMRS, including `260864`–`260866` and `260923`; analysis associates distinct values with regional allocation runs. | `CONFLICTING` with accepted PATS D-037 (one PATS Lot per Project) if each regional Lot No is asserted to be a separate PATS Lot. The examples are not reliably dates: `260864` is not a valid `YYMMDD` date. Do not parse Lot No as a date or generate one from a date without confirmation. |
| **Control No.** | Example `260923 - DECO-002J/00`. User clarified this represents allocated Decoration requisition requirements (PMRS-like), not a Project/Lot attribute. The supplied analysis decomposes it as paper Lot No + department/process + paper production batch + destination + revision. | `NEEDS_CONFIRMATION` as a PATS resource, owner, and lifecycle. Parked outside current Project/Lot UI, API, and persistence. |
| **Paper production batch / destination / revision** | Supplied analysis interprets `002` as paper production run, `J` as Japan, and `/00` / `/01` as issue revisions; it lists `A/C/J/U` for destination. | `NEEDS_CONFIRMATION`. “Paper production batch” is not the PATS Batch/Series scan unit. Destination mapping and revision semantics require the controlled workbook/process owner. |

## Important corrections

1. Do not equate `Control No` to `Project.projectCode`, `Lot.lotCode`, or PATS `Batch.batchCode`.
   The user identifies it as allocated Decoration requisition data; its eventual owner is not yet
   established in PATS.
2. Do not infer a date from the six-digit paper Lot No. Some supplied examples are impossible as
   `YYMMDD` values.
3. Do not import the “four regional Lots for one production batch” statement into the canonical
   PATS run model: it conflicts with D-037 until a mapping between regional material allocation
   Lots and the PATS Project-owned Lot is confirmed.
4. Do not apply the proposed Product Code or Part No regex globally from examples alone.

## Current PATS boundary

- Project API identity remains its opaque `projectId`; `projectCode` is a human-readable business
  code. The Product Code/pack label is sourced from the selected catalog Product.
- A Project owns one PATS Lot (D-037); Lot is the run trace envelope. Its creation date is stored
  as a timestamp, not decoded from an external paper Lot No.
- The paper Control No is removed from the Project/Lot contract and model pending a separately
  approved requisition/allocated-requirements resource design.
- The current suggestion `{projectCode}-L1` is an application suggestion only, not confirmation
  that the paper Lot No uses that pattern.

## PATS implementation disposition (2026-09-28)

The user directed that Control No be parked and removed from the current Project/Lot. Accordingly,
`Lot.controlNumber`, the Project create field, Project detail projection, and the Control No edit
route/UI are removed by follow-up migration
`20260928170000_park_unconfirmed_control_number`; no replacement PMRS resource is introduced.
The earlier proposed `{lotCode}-001` Control No default is withdrawn. The older client-evidence
reconciliation chain remains historical evidence; this report is the corrected current reference.

## Follow-up questions before a code-pattern standard

- Does the source owner confirm the one-Lot-per-Project mapping despite regional Lot No values?
- What controlled source generates the six-digit paper Lot No, and is it globally unique or scoped
  to product, batch, destination, or another allocation run?
- What resource owns the Control No, which process codes are valid, and how are sequence/revision
  values allocated and revised?
- Which source revision is authoritative for Product Code / Part No patterns, including known
  shared parts and decoration variants?

Until these are resolved, only normalization of an explicitly approved identifier grammar may be
implemented. This report does not approve a new Project/Lot/Control No format.
