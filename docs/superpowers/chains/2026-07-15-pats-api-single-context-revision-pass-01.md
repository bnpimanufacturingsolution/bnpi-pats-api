# Single-Context Revision Chain - Pass 1: Operational-Context Decision Lock

**Status:** COMPLETED - design-only

## Pass completed

Pass 1: operational-context decision lock.

## What changed

- Recorded the user's current product direction: PATS is not being designed as a SaaS
  multi-tenant system.
- Revised D-001 and D-002 recommendations so `Workspace` is not canonical tenant truth and the
  first deployment uses deployment-level capability authorization.
- Added D-029 to keep the unresolved question visible: whether one database will ever serve
  multiple physical production lines.
- Updated the design context to distinguish deployment context, optional `ProductionLine`
  identity, and SaaS tenancy.

## Self-check result

- No Prisma, migration, application, test, generated, seed, deployment, or frontend file changed.
- The single-context recommendation is recorded as a working direction, not silently accepted as
  a final schema/API decision.
- D-001, D-002, and new D-029 remain visible for user approval or explicit deferral.

## Open questions or blockers

- Confirm whether one database may ever contain multiple physical lines (D-029).
- Confirm whether a physical line has a required business identity even in a single-line
  deployment (D-001).
- Identity provider, capability vocabulary, catalog ownership, and other existing blockers remain
  unchanged.

## Ready for next pass

Yes - Pass 2 may revise the identity, authorization, catalog, normalized relation, and schema
handover design for the single-context recommendation.
