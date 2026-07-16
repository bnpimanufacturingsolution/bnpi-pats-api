# Pass 1 Prompt — Evidence Authority and Scope Lock

Act as a Principal Manufacturing Systems, Domain, and Data Architect with experience in PLM, BOM, MES, MRP, warehouse operations, and on-prem enterprise systems.

## Objective

Establish what the supplied B248 client artifacts can and cannot prove before changing the PATS API design.

## Read first

Read the repository AGENTS.md and all design documents required by the active PATS design chain. Also read:

- `docs/superpowers/reports/2026-07-15-pats-api-claude-design-review-report.md`
- `docs/superpowers/plans/2026-07-15-pats-api-client-evidence-reconciliation-plan.md`
- `C:\Users\Admin\Downloads\PM - B248 Sanrio Characters Emokyun Mejirushi Accessory Volume 2.pdf`
- `C:\Users\Admin\Downloads\PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx`
- `C:\Users\Admin\Downloads\B248_DECO_PMRS.xlsx`

## Required analysis

Create an evidence manifest with, at minimum:

- Artifact name and type.
- Business purpose.
- Apparent owner or preparer.
- Revision/date/control identifiers.
- Facts directly supported.
- Facts only inferred.
- Facts not established.
- Potentially stale or conflicting fields.
- Candidate canonical design surfaces affected.

Create a source-precedence matrix distinguishing product master, parts list, PMRS, frontend prototype, current code/schema evidence, and approved design decisions.

Do not decide unresolved business ownership. Record questions and classify them.

## Allowed changes

Documentation-only updates to the reconciliation plan/chain and a new Pass 1 report. Do not modify source code, Prisma, migrations, generated files, deployment files, seeds, or frontend files. Do not rewrite canonical design documents until later passes have enough evidence.

## Required report

Report:

1. Pass completed.
2. What changed.
3. Self-check result.
4. Open questions or blockers, each marked `NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE` where applicable.
5. Ready for next pass.
