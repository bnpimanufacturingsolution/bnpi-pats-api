# Schema Normalization Chain — Pass 2: Normalized Relational Decomposition

**Status:** COMPLETED — design-only

## Pass completed

Pass 2: Normalized relational decomposition.

## What changed

Created `docs/data/2026-07-14-pats-api-normalized-schema-design.md` with a conceptual table and
relationship inventory for identity/tenancy, catalog/configuration, planning, execution,
inventory/traceability, exceptions, audit/platform, assets, jobs, and projections.

The design applies first-, second-, and third-normal-form rules: repeated route steps,
memberships, assignments, allocations, events, asset links, audit records, outbox messages, and
job attempts are relations; relationship attributes remain on bridge/evidence tables; live
catalog data is separated from plan/execution snapshots.

## Self-check result

- No Prisma, migration, generated, seed, deployment, application, or frontend file changed.
- All tables have a stated purpose, ownership boundary, identity, relationship intent, lifecycle,
  and open-decision status where applicable.
- JSON is limited to explicitly named bounded metadata owners.
- Neutral structures preserve D-001, D-005, D-008, D-010, D-014, D-020, D-021, D-024, and D-025
  without silently choosing a business rule.
- Legacy denormalized fields and frontend snapshots are explicitly excluded as source truth.
- `git diff --check` passes (with only existing line-ending warnings on prior design documents).

## Open questions or blockers

Pass 3 must resolve as design alternatives, without accepting them: tenant-safe FK strategy,
catalog ownership relation, station target relation, quantity representation, asset link FK
strategy, and actor snapshot boundary. The implementation blockers from Pass 1 remain unchanged.

## Ready for next pass

Yes — Pass 3 may map the table inventory to database constraints, indexes, and lifecycle
persistence rules.
