# PATS Full App–API Transition — I8.3 Quality/QC Adoption

Date: 2026-07-31

Status: COMPLETE

## Decision

The active QC workstation must treat the quality inspection ledger as authoritative. Its existing
fixture worklist and local decision state were only demo behavior. The bounded adoption therefore
reuses the existing quality commands and enriches the read resource with the batch/part evidence
the workstation needs to identify the item under inspection.

## Implemented

- `GET /api/v1/quality-inspections` now returns inspection status, row version, decision history,
  batch identity/quantity, and the batch's server-owned part evidence.
- The response is described in the canonical OpenAPI source and generated endpoint artifacts.
- Existing commands remain the write boundary:
  `POST /api/v1/quality-inspections` opens an inspection, and
  `POST /api/v1/quality-inspections/:inspectionId/decisions` records `PASSED`, `FAILED`, or
  `HOLD` with `If-Match` and idempotency.
- No quality values are inferred from the old fixture rows, and the server does not fabricate an
  inspection when a client record is missing.

## Validation

- API lint and type-check passed.
- API domain-read/command coverage passed, including quality batch/part evidence.
- API full suite passed: 213 tests.
- Generated OpenAPI export passed.

## Boundary and next slice

The app exposes the existing QC interaction against server inspections in canonical mode and keeps
the old fixture workstation explicitly available only in demo mode. This slice does not invent a
new QC sampling model, add hardware/scan integration, release a batch, or migrate client data.
The next pass is end-to-end app/API transition verification and closeout of remaining fixture-only
active surfaces.
