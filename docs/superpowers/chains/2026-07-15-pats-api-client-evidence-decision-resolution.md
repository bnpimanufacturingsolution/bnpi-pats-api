# Client-Evidence Decision Resolution Addendum

Status: `COMPLETED — GATE 0 PENDING`

Date: 2026-07-15

## Decision resolution completed

The user approved applying the senior target recommendations as decisive design direction. This
addendum updates the design package without implementing code or pretending that incorrect manual
source documents are already corrected.

## Decisive target decisions applied

- `B248-02-08` is the canonical Kuririn Body part; `B248-01-08ST` is rejected as an invalid source
  reference and retained in correction evidence.
- Latest approved Asia line values govern: `77,860` total, `77,060` issued, `800` balance.
  Header totals are derived from lines and cannot override them.
- PATS owns PATS-scope material requirements and issue evidence. PMRS is a reconciled control
  projection/reference; external ERP/Warehouse owns physical stock and procurement.
- Draft source revisions are validated, blocking issues are resolved by authorized users, and only
  approved immutable revisions can release plans/material requirements.
- Quantities use magnitude, UOM, usage basis, precision, and source representation. Missing
  tolerance defaults to strict equality; explicit tolerance is per requirement/operation.
- Market/region and demand purpose are first-class demand-allocation dimensions.
- The first deployment remains single-context with no Workspace/ProductionLine persistence.
- Identity uses a provider-neutral on-prem OIDC-compatible adapter boundary, with locale and
  walkthrough state normalized as subject-owned platform preferences.

## What changed

- Updated the decision register with the decisive target operating model and proposed statuses.
- Updated target design, architecture, data model, normalized schema, endpoint catalog, and
  cross-cutting behavior.
- Added source reconciliation resources and PATS-owned material requirement behavior.
- Added the canonical manual-conflict resolution workflow and release blockers.

## Remaining source/data gates

These are no longer unresolved design choices; they are controlled source-correction tasks:

- issue a corrected Parts List revision for the Kuririn reference;
- issue/approve the corrected Asia PMRS revision with the derived 77,860 total;
- register the effective Product Master/Parts List/PMRS revision set;
- preserve original observations and correction evidence for audit.

## Self-check result

| Check | Result |
|---|---|
| Target behavior is decisive rather than merely observational | `PASS` |
| Manual conflicts have a resolution workflow and release gate | `PASS` |
| Original source observations remain auditable | `PASS` |
| REST and authorization implications are documented | `PASS` |
| No application source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| `git diff --check` | `PASS` |

## Ready for next step

`YES` — Gate 0 can now review the resolved target model and controlled source-correction tasks.
Implementation still requires explicit approval.
