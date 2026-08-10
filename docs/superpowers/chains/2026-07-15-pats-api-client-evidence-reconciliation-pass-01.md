# Client-Evidence Reconciliation — Pass 1: Evidence Authority and Scope Lock

Status: `COMPLETED — READY FOR PASS 2`

Date: 2026-07-15

## Pass completed

Pass 1, Evidence Authority and Scope Lock, is complete. The three client artifacts are now
classified as read-only `BUSINESS_EVIDENCE` with bounded authority. They are not being promoted
to API, persistence, authorization, or lifecycle truth without reconciliation and acceptance.

## Evidence inspected

### Client artifacts

The following files were inspected read-only. Hashes identify the reviewed snapshots and are not
business identifiers:

| Artifact | Snapshot metadata | Bounded authority | Classification |
|---|---|---|---|
| `PM - B248 Sanrio Characters Emokyun Mejirushi Accessory Volume 2.pdf` | 600,349 bytes; SHA-256 `BDFF45D45895293CA704C14862F4BDF8A3ED25AB71FBA28A445BFE03D25D4D82`; modified 2026-07-15 | Product and packaging specification evidence for B248 | `BUSINESS_EVIDENCE` |
| `PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx` | 1,882,401 bytes; SHA-256 `0CB39A65F13995E392C06E7A86B67811217847CDC8ED34CE33014A5B7F251A65`; modified 2026-07-15; workbook modified 2026-07-11 | Parts list, injection, decoration, assembly, and packaging evidence | `BUSINESS_EVIDENCE` |
| `B248_DECO_PMRS.xlsx` | 1,490,357 bytes; SHA-256 `3D8A534A57F79B5001A9916ED21A4FD18E5CDA949F8BF35EB6524042B6E13152`; modified 2026-07-15; workbook modified 2026-07-11 | Production material requisition, forecast, lot, regional allocation, issue, and balance evidence | `BUSINESS_EVIDENCE` |

The PDF is raster-based evidence. Its visible contents were inspected visually; extracted text is
not treated as a reliable source of authority. The workbooks contain formulas and cross-sheet
links, so displayed values and formula semantics must be preserved during later reconciliation.

### Repository design evidence

The required repository reading order was completed, including the approved REST standard,
principle, checklist, original design chain, current design package, client-evidence plan/chain,
and the Claude review report. Current code and `prisma/pats/schema.prisma` remain
`CONFIRMED_IMPLEMENTATION` evidence only, not canonical business truth.

## Evidence manifest

### Product Master / Packaging Matrix PDF

The artifact appears to identify:

- product code `B248`;
- item number `2849226`;
- product name `Sanrio Characters Emokyun Mejirushi Accessory Volume 2`;
- a controlled revision/date presentation;
- five style/model names: Hello Kitty, Pompompurin, Kurousa, Shirousa, and Kuririn;
- even-assortment and packaging quantities, including 8 pieces per bag per model, 5 bags per
  model, 40 pieces per model, and 200 pieces per carton;
- a 48 mm transparent pink capsule and packaging-flow information;
- commercial/specification fields such as retail price, customer, and age grade.

These are product and packaging evidence. They do not establish that commercial fields are core
PATS identity, that packaging quantities are production execution quantities, or that PATS owns
the packaging/PMRS process.

### Parts List workbook

The workbook has the sheets `Partslist`, `Inj`, `Inj Shot`, `Deco`, and `Assy`. It appears to
identify a B248 Parts List at revision 6 with:

- 16 injection part codes, plus a capsule item;
- injection mold/shot, cavity, quantity, material, colorant, mixing, decoration, and remarks
  fields;
- hierarchical decoration headers and child process rows such as screen/transfer/tampo/book
  and injected decoration evidence;
- model-specific assembly rows and all-model accessories;
- packaging materials and ratios such as small bags, capsules, assortment bags, carton quantity,
  and tape usage;
- revision history and prepared/checked/approved presentation.

This is evidence for a multi-level product-content and process-specification model. It does not
prove that worksheet row order is the execution route, that `No. of Ups` is a customer quantity,
or that every listed quantity belongs in an execution ledger.

### PMRS workbook

The workbook has 21 sheets. B248 sheets are mixed with unrelated A267/A301/A402 material and
must not be imported wholesale. B248 evidence includes:

- product and control numbers such as `260923 - DECO-002J/00` and regional variants;
- forecast and requisition sheets for Japan, Asia, USA, and China;
- lot quantities, model allocations, part numbers, usage, unit, ordered quantity, issued
  quantity, balance, and remarks;
- `/00` and `/01` requisition/issue relationships;
- demand-purpose categories such as sales, samples, inspection, replacement, promotion,
  development, overseas allocation, and QC;
- formula-linked forecast and requisition calculations.

The workbook metadata identifies `Production Planning Staff` as creator and
`Ayiel Govino (Warehouse)` as last modifier. This is operational provenance evidence, not by
itself proof of system ownership or authorization policy.

## Source-precedence and authority matrix

The existing design-package precedence remains valid for global rules, with client artifacts
added as bounded domain evidence:

| Source | Authority | May establish | May not establish |
|---|---|---|---|
| Accepted user/stakeholder decision | Highest business decision authority | Accepted domain choice, owner, rationale, and implementation gate | REST behavior contrary to the normative standard unless an explicit exception is approved |
| Approved REST standard and checklist | Normative HTTP authority | Paths, methods, statuses, errors, pagination, auth review, concurrency, idempotency, trace, deprecation | Product/BOM/PMRS business facts |
| Approved business requirements/architecture | Accepted business and architecture boundary | PATS purpose, bounded contexts, system boundary, approved operational constraints | Unapproved spreadsheet corrections or implementation details |
| Controlled Product Master / Packaging Matrix | Bounded product/package authority for its revision | Product/package identifiers, styles, packaging specification, controlled revision evidence | API resource identity, persistence model, execution lifecycle, PATS ownership |
| Controlled Parts List workbook | Bounded product-content authority for its revision | Part codes, BOM/content evidence, process-specification evidence, packaging content, revision evidence | Row-order route semantics, PATS ownership, authorization, ledger behavior |
| Controlled PMRS workbook | Bounded planning/material-control evidence | Requisition/control numbers, demand categories, lot/order/issue/balance evidence, workbook provenance | Whether PATS owns requisitions or warehouse ledger, correction policy, API contract |
| Current API/code/Prisma draft | Implementation reality | Existing compatibility routes, fields, adapters, migration risk | Canonical business truth or approval of legacy shapes |
| Frontend prototype/fixtures | Alignment evidence | Terminology, journeys, compatibility hints | Identity, persistence, authorization, lifecycle, endpoint semantics |
| Generated docs/seeds/filenames/display labels | Compatibility evidence only | Migration/search clues | Any canonical identity or invariant |

Where a controlled artifact conflicts with an accepted decision, the accepted decision governs.
Where controlled artifacts conflict with one another, the result remains `CONFLICTING` until an
owner confirms the active revision or correction.

## Scope lock changes

The following topics are now explicitly in scope for the remaining design passes:

1. Controlled-document lineage for Product Master, Parts List, and PMRS revisions, including
   source reference, revision/date, approval presentation, effective status, and provenance.
2. A normalized product-content model separating Product, Model, Part, BOM/material relation,
   process specification, execution route, assembly content, and packaging hierarchy.
3. Model/all-model applicability and quantity/UOM semantics, including packaging ratios and
   non-piece usage.
4. Production-plan demand purpose and regional/market allocation, rather than only a total
   model quantity.
5. PMRS ownership boundary and the distinction between requisition/order evidence, immutable
   issue transactions, and derived balance projections.
6. Cross-artifact reconciliation for product identifiers, part identifiers, revision dates,
   approval state, and effective/current status.

The following scope boundaries remain unchanged:

- The first deployment remains one server-resolved operational context; no client evidence proves
  Workspace tenancy, membership administration, or a multi-line shared database.
- PATS remains a production and assembly tracking system, not an ERP, unless an accepted decision
  changes the boundary.
- The frontend remains alignment evidence only.
- No client file authorizes code, Prisma, migration, seed, generated-artifact, deployment, or
  frontend changes.

## Open questions and blockers

| Item | Classification | Why it remains open | Next pass/decision impact |
|---|---|---|---|
| Active/effective revision relationship among the Product Master PDF, Parts List rev 6, and PMRS workbook | `NEEDS_CONFIRMATION` | File modified dates do not prove business effective status or supersession | Pass 2; controlled-document lineage and release rules |
| Relationship between B248, item number 2849226, and PMRS control numbers | `NEEDS_CONFIRMATION` | Multiple identifiers may be code, item, mold, or requisition references | Pass 2/3; identity and external-reference mapping |
| `B248-02-08` versus `B248-01-08ST` Kuririn Body reference/name | `CONFLICTING` | Parts List cross-sheet references do not agree | Pass 2/4; blocks canonical part-reference acceptance |
| Asia 77,060 header versus 77,860 revised/current order evidence | `CONFLICTING` | Header, forecast, and order quantities do not reconcile from the snapshot alone | Pass 3/4; blocks quantity/requisition invariant acceptance |
| Whether PATS owns PMRS, requisitions, issues, or only references an external warehouse/planning system | `NEEDS_CONFIRMATION` | Workbook provenance shows operational use but not application ownership | Pass 3; D-007, D-020, D-021 |
| Meaning and conversion policy for `Pc`, `1/40`, `1/200`, tape-per-200, and process parameters | `NEEDS_CONFIRMATION` | Mixed units are visible, but canonical conversion and precision rules are not stated | Pass 3; quantity/UOM and variance contracts |
| Whether demand-purpose and market/region are required planning dimensions | `NEEDS_CONFIRMATION` | PMRS categories are present but target API ownership is not accepted | Pass 3; D-024 and planning model |
| Approval names/signatures and their mapping to PATS subjects/capabilities | `NEEDS_CONFIRMATION` | Names on controlled documents do not establish identity-provider mapping or authorization | Pass 4; D-006, D-025, D-026 |
| Whether commercial PDF fields belong in PATS catalog or remain reference metadata | `NEEDS_CONFIRMATION` | Retail/customer/age-grade fields are present but system purpose is not established | Pass 2; Catalog boundary |
| Whether any evidence proves ProductionLine identity or multi-line scope | `NEEDS_CONFIRMATION` | None of the supplied files establishes shared-database line ownership | D-001/D-029 remain open |
| Unrelated A267/A301/A402 PMRS sheets | `STALE` for B248 scope / out of scope | They are historical or unrelated product evidence for this chain | Exclude from B248 canonical analysis |

## Self-check result

| Check | Result |
|---|---|
| Required repository reading order completed | `PASS` |
| Client artifacts inspected read-only | `PASS` |
| Evidence authority bounded by artifact purpose | `PASS` |
| Confirmed, inferred, conflicting, stale, and confirmation-required items labelled | `PASS` |
| No uncertainty silently resolved | `PASS` |
| No application source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| Endpoint standard treated as normative and not changed | `PASS` |
| Existing unrelated/user changes preserved | `PASS` |
| `git diff --check` | `PASS` after report and chain updates |

## What changed

- Added this Pass 1 evidence manifest and scope-lock report.
- Established bounded authority for the Product Master, Parts List, and PMRS artifacts.
- Added client-evidence-driven scope topics for later product/BOM/packaging and PMRS passes.
- Recorded the known part-number and quantity conflicts without correction.
- Preserved D-001/D-029, D-006, D-007, D-020, D-021, D-024, D-025, and D-026 as open where the
  evidence does not decide them.

## Ready for next pass

`YES` — Pass 2 may begin. Pass 2 must reconcile the product, BOM, process, packaging, and
controlled-document revision model; it must not resolve the Kuririn conflict silently.
