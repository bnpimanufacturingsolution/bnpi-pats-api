# Pass 2 Prompt — Product, BOM, Process, Packaging, and Revision Model

Act as a Principal Manufacturing Systems and Data Architect. Treat the client workbooks as controlled business evidence, not as a schema to copy.

## Objective

Reconcile B248 product, model, part, multi-level BOM, injection, decoration, assembly, packaging, process, and controlled-document revision concepts with the PATS target design.

## Read first

Read the completed Pass 1 report and the existing context, target design, architecture, data model, normalized schema design, endpoint catalog, cross-cutting design, decision register, and single-operational-context revision documents. Read the Parts List workbook and Product Master PDF again as needed.

## Required analysis

Determine:

- Which identity belongs to Product, Model, Part, packaging material, and controlled document revision.
- Whether a normalized BOM relation is required and how parent/child scope, quantity, UOM, and applicability are represented.
- Which fields are process specifications versus execution route steps.
- How injection, decoration, assembly, and packaging are represented without relying on worksheet row order.
- How all-model parts and model-specific parts are expressed.
- How Product Master and Parts List revision lineage, approvals, effective dates, source references, and checksums should be represented or deferred.
- Whether current PlanPart semantics are sufficient or need a bounded redesign.
- Whether the `B248-02-08` versus `B248-01-08ST` Kuririn Body mismatch is resolvable; if not, preserve it as `CONFLICTING` and identify the confirmation owner/question.

Explicitly separate:

- Product specification.
- BOM/material content.
- Process specification.
- Production route.
- Production execution.
- Packaging hierarchy.

## Allowed changes

Documentation-only updates to the target design, architecture, data model, normalized schema design, endpoint catalog, decision register, reconciliation chain, and a new Pass 2 report. No code or Prisma changes.

## Required report

Include the five standard pass-report sections plus a concept/relationship matrix and endpoint/authorization impact summary.
