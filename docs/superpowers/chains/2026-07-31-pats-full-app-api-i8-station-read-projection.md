# PATS Full App–API Transition — I8 Station Read Projection

Date: 2026-07-31

Status: COMPLETE

## Decision

The station screen cannot derive execution identity from frontend fixtures. A workstation needs
one server-owned projection that joins the current batch position with batch/lot/part identity and
the ordered route steps used to decide whether a batch is awaiting receipt or ready for issuance.
The projection remains rebuildable; stage events, inventory transactions, and routing violations
remain the business ledgers.

## Implementation

- Expanded `GET /api/v1/batch-positions` additively with:
  - batch barcode, quantity, status, row version, and creation timestamp;
  - lot code/name, project identity, and parts-list revision identity;
  - all batch part lines with part code/name and quantity evidence;
  - ordered route steps with part identity and stage/substage references.
- Kept the existing top-level position fields and no-store response behavior.
- Added route-step lookup by the batch lot's parts-list revision so the API does not ask the
  frontend to reconstruct planning joins.
- Documented the enriched station-ready projection in the canonical OpenAPI source and regenerated
  Swagger JSON/YAML.
- Added a contract test proving server identifiers, part identity, route order, and projection
  timestamps are preserved.

## Boundaries

- This is a read projection, not a new persistence authority and not a migration.
- The API does not infer client approval from seeded or provisional records.
- Station write commands remain the stage-event and inventory ledgers implemented in I5.
- The app still has separate work for planning screen reads/writes, activity/throughput/report
  reads, and non-domain UI cards such as presentation snapshots.

## Validation

- `pnpm lint`: passed.
- `pnpm type-check`: passed.
- Full API suite: 208 passing.
- OpenAPI generation: passed.

## Next integration step

Consume this projection in the app's canonical station snapshot hook and validate that scan
commands use server stage/part identifiers rather than fixture identifiers. Continue with the
planning and reporting route cutovers afterward.
