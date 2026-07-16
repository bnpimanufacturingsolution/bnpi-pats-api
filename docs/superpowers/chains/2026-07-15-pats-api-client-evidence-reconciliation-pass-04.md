# Client-Evidence Reconciliation — Pass 4: Conflict Reconciliation and Decision Register Update

Status: `COMPLETED — READY FOR PASS 5`

Date: 2026-07-15

## Pass completed

Pass 4, Conflict Reconciliation and Decision Register Update, is complete. Conflicts are recorded
with source, impact, safe interim behavior, recommended owner, and confirmation question. No
conflict was silently converted into canonical identity or a write invariant.

## What changed

- Added the conflict register for the Kuririn part-code mismatch, Asia quantity discrepancy,
  effective revision relationship, identifier crosswalk, PMRS ownership, quantity semantics, line
  scope, and approval identity.
- Added decision-by-decision impacts for D-001, D-006, D-007, D-008, D-009, D-010, D-020, D-021,
  D-024, D-025/D-026, and D-030 through D-035.
- Added Gate 0 re-entry criteria with explicit owner/confirmation requirements.
- Kept candidate recommendations separate from accepted decisions.

## Conflict summary

| Conflict | Classification | Interim rule |
|---|---|---|
| `B248-02-08` vs. `B248-01-08ST` Kuririn Body | `CONFLICTING` | Preserve both references; affected executable revision remains unpublished |
| Asia 77,060 vs. 77,860 | `CONFLICTING` | Preserve header/line/issued/calculated observations; no canonical total selected |
| Product Master / Parts List / PMRS active revision | `NEEDS_CONFIRMATION` | Preserve source lineage; file modified time does not establish effective status |
| B248 / 2849226 / PMRS / mold / part identifiers | `NEEDS_CONFIRMATION` | Use typed source namespaces; do not create an alias by inference |
| PMRS ownership | `NEEDS_CONFIRMATION` | Hybrid reference/source snapshot is the interim recommendation |
| Mixed quantity/UOM and variance rules | `NEEDS_CONFIRMATION` / `CONFLICTING` | Explicit quantity state/UOM/usage basis; no silent conversion or tolerance |
| Workspace/line scope | `NEEDS_CONFIRMATION` | Keep one server-resolved context; no new tenancy behavior |

## Recommended answers for owner review

1. Keep PATS single-context and deployment-scoped for the first release. Do not add Workspace,
   membership, or ProductionLine persistence unless D-001/D-029 confirms a meaningful shared-line
   boundary.
2. Treat Product Master, Parts List, and PMRS as distinct controlled artifacts linked through
   revision/provenance, not as one generic document or spreadsheet table.
3. Treat the Parts List as evidence for parts/BOM/process/packaging specifications; keep the
   executable route separately versioned and plan-scoped.
4. Use a hybrid PMRS reference boundary until ownership is confirmed. If PATS later owns material
   requirements/issues, use normalized requirements and an append-only ledger with derived balance.
5. Add demand-purpose and market/region dimensions only as an accepted planning model, with one
   authoritative total/reconciliation rule.
6. Preserve mixed UOM and ratio source values until quantity conversion, precision, rounding, and
   variance policy are accepted.
7. Do not resolve the Kuririn or Asia conflicts in API code, schema, seed, or import logic.

## Open questions or blockers

The following remain implementation blockers for affected writes:

- owner-confirmed Kuririn source correction or exception;
- owner-confirmed Asia quantity/revision relationship;
- D-007/D-020 PMRS and issue ownership;
- D-021 quantity/UOM/variance policy;
- D-030 through D-035 controlled-document, normalization, crosswalk, release, demand, and source
  discrepancy decisions;
- D-006/D-025/D-026 identity, actor, and capability mapping;
- D-001/D-029 future line boundary.

## Self-check result

| Check | Result |
|---|---|
| Every known client-evidence conflict recorded | `PASS` |
| Source, impact, classification, interim behavior, owner, and question provided | `PASS` |
| Recommendations distinguished from accepted decisions | `PASS` |
| Decision register updated without silent acceptance | `PASS` |
| Gate 0 re-entry criteria recorded | `PASS` |
| No application source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| `git diff --check` | `PASS` |

## Ready for next pass

`YES` — continue automatically to Pass 5: Consistency Review and Handover.
