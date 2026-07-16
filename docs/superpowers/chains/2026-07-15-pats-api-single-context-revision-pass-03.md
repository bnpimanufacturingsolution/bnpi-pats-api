# Pass 3 Report: API, Architecture, and Operations Revision

**Date:** 2026-07-15
**Repository:** `bnpi-pats-api`
**Branch:** `develop`
**Mode:** Documentation-only; no implementation approval

## Pass completed

Pass 3 — API, architecture, and operations revision.

## What changed

- Revised the endpoint catalog so the first deployment uses top-level `/api/v1` resources with a
  server-resolved operational context and no workspace selector, membership catalog, or
  cross-tenant HTTP model.
- Added an operation-level design matrix covering owner, capability/object checks, success and
  retry behavior, side effects, and unresolved decision dependencies.
- Revised the architecture to make deployment-scoped capability assignments, object ownership,
  deployment-owned catalog records, and the future `ProductionLine` migration boundary explicit.
- Revised cross-cutting authorization, audit, idempotency, trace, asset, readiness, and lifecycle
  rules around deployment context rather than SaaS tenancy.
- Revised the implementation plan so the future identity phase creates subject assignments and
  capability checks, not workspace memberships or tenant-key behavior.
- Revised the target design and conceptual data model references to use operational ownership and
  the single-context boundary.

## Self-check result

| Gate | Result | Evidence |
|---|---|---|
| `/api/v1`, naming, shallow nesting, query/body naming | PASS | Endpoint catalog route rules and operation matrix |
| Deployment context is server-resolved | PASS | Endpoint catalog and cross-cutting authorization sections |
| Capability and object authorization remain explicit | PASS | Authorization matrix and architecture context ownership |
| Workspace/membership tenancy is not first-release behavior | PASS | Context, architecture, catalog, data model, and plan revision notes |
| Future multi-line evolution is a migration boundary | PASS | D-001/D-029 references and future `ProductionLine` notes |
| No implementation files changed | PASS | Changed paths remain documentation, plans, prompts, chain reports, and SDD handover artifacts |
| `git diff --check` | PASS | Checked after the pass edits |

## Open questions or blockers

- `NEEDS_CONFIRMATION` D-001/D-029: whether a meaningful `ProductionLine` identity or shared
  multi-line database is required.
- `NEEDS_CONFIRMATION` D-005/D-006/D-008/D-024/D-026: catalog layering, identity provider,
  station mapping, planning noun, and capability vocabulary.
- Existing lifecycle, quantity, asset, retention, actor, and on-prem decisions remain open under
  D-009, D-014, D-017, D-020, D-021, D-025, D-027, and D-028.
- The prior schema-normalization handover still needs to be rewritten for the revised first
  persistence task; this is a Pass 4 handover action.

## Ready for next pass

Yes. Pass 4 may perform the consistency review, supersede the old workspace-based implementation
handover, and finalize the exact first implementation task without starting implementation.
