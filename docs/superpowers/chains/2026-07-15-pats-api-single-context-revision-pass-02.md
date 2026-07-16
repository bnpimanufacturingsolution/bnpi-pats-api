# Single-Context Revision Chain - Pass 2: Domain and Persistence Revision

**Status:** COMPLETED - design-only

## Pass completed

Pass 2: domain and persistence revision.

## What changed

- Revised the normalized schema design from Workspace/Membership tenancy to one deployment-scoped
  operational context.
- Replaced `memberships`/`membership_assignments` as the first identity model with `subjects` and
  deployment-scoped `subject_assignments`.
- Kept `ProductionLine` as an optional future relation gated by D-029 rather than a forced SaaS
  tenant table.
- Made first-deployment catalog ownership deployment-owned without a global/layered catalog scope
  table.
- Revised planning, inventory, audit, idempotency, outbox, jobs, asset, constraint, index, and
  lifecycle language to remove mandatory workspace/tenant ownership.
- Recorded working technical recommendations for UUID v4, fixed-precision quantity, controlled
  multi-Part Lot allocations, `ProductionPlan`, and API-owned asset metadata with MinIO-owned
  private bytes.

## Self-check result

- No Prisma, migration, application, test, generated, seed, deployment, or frontend file changed.
- Relational identity, capability assignments, catalog ownership, source ledgers, audit, outbox,
  idempotency, jobs, assets, and projections remain explicit.
- The single-context model does not rely on client-selected scope or hidden workspace membership.
- Future multi-line behavior is represented as a named migration boundary under D-029, not
  preloaded composite tenancy complexity.
- Unresolved business decisions remain labelled and no unrelated status was silently accepted.

## Open questions or blockers

- D-029 must confirm whether multiple lines can share one database.
- D-001 must confirm whether `ProductionLine` has business identity even in a single deployment.
- D-006/D-026 remain open for provider and capability vocabulary.
- D-005 remains open for future shared/system catalog templates.
- D-021 remains `CONFLICTING` for business quantity/variance policy despite the technical numeric
  recommendation.

## Ready for next pass

Yes - Pass 3 may revise API paths, architecture context ownership, authorization language,
cross-cutting behavior, and the implementation plan for the single-context model.
