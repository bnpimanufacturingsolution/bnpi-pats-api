# Client-Evidence Reconciliation — Pass 2: Product, BOM, Process, Packaging, and Revision Model

Status: `COMPLETED — READY FOR PASS 3`

Date: 2026-07-15

## Pass completed

Pass 2, Product, BOM, Process, Packaging, and Revision Model, is complete. The B248 evidence
requires a normalized product-content boundary that is separate from the plan-scoped execution
route. No source conflict was silently corrected and no implementation was authorized.

## What changed

- Added controlled-document revision/lineage as a candidate concept for Product Master, Parts
  List, and PMRS artifacts.
- Separated candidate Part definitions and applicability from model-specific display structure.
- Added decision-neutral candidate relations for BOM/material lines, process specifications, and
  packaging hierarchy.
- Preserved `PartsListVersion` and `RouteStep` as execution-definition concepts rather than using
  route rows for BOM children, decoration rows, packaging ratios, or mold parameters.
- Added candidate read-only resource families for parts, BOMs, process specifications, packaging
  specifications, and controlled-document revisions.
- Added candidate decisions D-030 through D-033, all still `NEEDS_CONFIRMATION`.
- Preserved the Kuririn Body identifier conflict as `CONFLICTING` and added a safe interim
  recommendation to block effective publication/release of the affected executable definition.

## Evidence-to-concept matrix

| Evidence pattern | Canonical design response | Classification |
|---|---|---|
| Product Master revision, item/product codes, styles, packaging specification | Controlled source revision linked to immutable product/package snapshots; commercial fields remain boundary questions | `BUSINESS_EVIDENCE` / `NEEDS_CONFIRMATION` |
| 16 injection parts plus capsule and shared/model-specific scope | Part definition plus explicit applicability relation; no duplicated identity per model | `WORKING_DEFAULT` / `NEEDS_CONFIRMATION` |
| Decoration headers and child process rows | Process specification and process-step concepts, separate from BOM and execution route | `WORKING_DEFAULT` |
| Assembly and packaging rows | BOM/material and packaging hierarchy relations with explicit quantity/UOM | `WORKING_DEFAULT` / `NEEDS_CONFIRMATION` |
| Mold, cavity, colorant, mixing, and No. of Ups fields | Bounded process parameters; `No. of Ups` is not treated as product quantity | `INFERRED` / `NEEDS_CONFIRMATION` |
| Parts List revision history and approvals | Immutable controlled-document/source lineage and approval provenance | `BUSINESS_EVIDENCE` / `NEEDS_CONFIRMATION` |
| Kuririn Body cross-sheet mismatch | Preserve conflicting references; block effective executable publication under candidate D-033 | `CONFLICTING` |

## Endpoint and authorization impact

The endpoint catalog now records candidate read families using the required REST shape:

- `/api/v1/parts`
- `/api/v1/bom-versions`
- `/api/v1/bom-lines`
- `/api/v1/process-specifications`
- `/api/v1/packaging-specifications`
- `/api/v1/controlled-document-revisions`

These are top-level, plural, lowercase kebab-case resources with `snake_case` filters and
standard pagination. They are not implementation commitments. Candidate write/release operations
remain gated by source revision, applicability, quantity/UOM, publication, and conflict-policy
decisions.

Object-level checks remain deployment-scoped and server-side. `catalog.read`/`catalog.manage` or
`planning.read`/`planning.author`/`planning.release` are capability working names only; final
provider, role, and capability mapping remains D-006/D-026 `NEEDS_CONFIRMATION`.

## Open questions or blockers

| Item | Classification | Effect |
|---|---|---|
| Active/effective revision and approval relationship among Product Master, Parts List rev 6, and PMRS | `NEEDS_CONFIRMATION` | Blocks source-effective publication semantics |
| B248, item 2849226, PMRS control, mold, and part-code namespaces | `NEEDS_CONFIRMATION` | Blocks canonical identifier crosswalk |
| `B248-02-08` versus `B248-01-08ST` Kuririn Body | `CONFLICTING` | Blocks affected Parts List effective publication and executable release |
| Exact Part versus ModelPart/applicability mapping | `NEEDS_CONFIRMATION` | Blocks final catalog relation names and uniqueness constraints |
| BOM relation kinds and quantity/UOM/ratio representation | `NEEDS_CONFIRMATION` | Blocks BOM/process/packaging write contracts; continues into Pass 3 |
| Process specification ownership and station mapping | `NEEDS_CONFIRMATION` | D-008 and catalog publication remain open |
| Packaging hierarchy ownership and whether it is execution or reference-only | `NEEDS_CONFIRMATION` | Blocks packaging writes and planning quantity semantics |
| Commercial PDF fields in or out of PATS catalog | `NEEDS_CONFIRMATION` | Prevents accidental catalog scope expansion |
| PMRS ownership | `NEEDS_CONFIRMATION` | Deferred to Pass 3 under D-007/D-020 |

## Self-check result

| Check | Result |
|---|---|
| Pass 1 report and existing design package read | `PASS` |
| Product, BOM, process, packaging, and revision concepts separated | `PASS` |
| No spreadsheet row order promoted to execution semantics | `PASS` |
| Kuririn conflict preserved and classified | `PASS` |
| Candidate decisions clearly marked unapproved | `PASS` |
| REST path, shallow nesting, query naming, authorization impact recorded | `PASS` |
| No application source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| `git diff --check` | `PASS` |

## Ready for next pass

`YES` — continue automatically to Pass 3: PMRS, Planning, Quantity, and Lifecycle Model.
