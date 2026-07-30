# Chain: BOM App–API Vertical Slice

Status: COMPLETE WITH RELEASE BOUNDARIES — remote CI gate pending
Date: 2026-07-30  
Prerequisite: App–API MVP container changes are locally complete; remote CI must be green before release claims.

## Senior decision

Proceed with BOM as the next domain slice, using the existing `BomDefinition` and `BomLine` foundation. Do not redesign the schema, copy workbook columns into the API, or build publication/planning behavior.

The smallest useful business slice is a model-scoped draft BOM that can be read, created, corrected, and refreshed while preserving incomplete quantities and source representation for review.

## Accepted MVP boundary

In scope:

- Draft BOM definition revisions attached to a Model.
- Ordered BOM lines attached to the definition.
- ModelPart same-model validation.
- Relationship kind, optional quantity/UOM, usage basis, and raw source representation.
- Evidence status/provenance, capability checks, Idempotency-Key, ETag/If-Match, RFC 9457 errors.
- Frontend adapter and a small Product Pack BOM surface.

Out of scope:

- Publication/approval workflow, inventory reservation, costing, MRP, procurement, packaging hierarchy, process routes, and execution.
- Automatic quantity inference or silent normalization of missing client values.
- DM, cutover, Drive access, and production migration.

## Sequential passes

### BOM Pass 0 — contract and evidence reconciliation

Reconfirm the existing API foundation against the REST standard and evidence rules. Preserve sparse quantities as nullable and classify unresolved relationships instead of forcing certainty. Gate: route family and response shape are fixed.

### BOM Pass 1 — canonical read contract

Add bounded definition collection reads by `model_id` and a definition detail read with ordered lines. Keep existing draft writes. Add OpenAPI, capability, cache policy, and contract tests. Gate: app can load a complete or sparse BOM without local fixtures.

### BOM Pass 2 — frontend adapter

Add typed BOM DTOs and load/create/patch methods to `pats-catalog-service`. Preserve explicit API/demo mode and response reconciliation. Gate: adapter tests cover sparse quantity, provenance, 401/403, 409, 412, and malformed responses.

### BOM Pass 3 — minimal Product Pack surface

Add one focused BOM section to the existing Product Pack/model context. Show revision, ordered lines, quantities when known, raw source representation, evidence state, and explicit unresolved values. Avoid a new navigation system or a full spreadsheet editor.

### BOM Pass 4 — mutation and concurrency integration

Wire draft definition/line creation and correction with idempotency keys and If-Match. Verify same-key replay/conflict, stale updates, cross-model rejection, and refresh persistence.

### BOM Pass 5 — isolated acceptance and handoff

Run the real containerized API/app smoke against synthetic data, then persist reports and update both workspaces. No production migration or publication.

## Success gate

An operator can open a Model, view its current draft BOM revision, see ordered sparse-safe lines with provenance, add/correct a draft line, and refresh without losing unknown values. The API remains the authority; demo mode remains explicit.
