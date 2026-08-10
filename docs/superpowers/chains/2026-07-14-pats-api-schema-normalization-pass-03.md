# Schema Normalization Chain - Pass 3: Constraints, Indexes, and Lifecycle Persistence

**Status:** COMPLETED - design-only

## Pass completed

Pass 3: constraints, indexes, and lifecycle persistence.

## What changed

Extended `docs/data/2026-07-14-pats-api-normalized-schema-design.md` with:

- three tenant-safe foreign-key alternatives and a non-silent working recommendation;
- a relation-by-relation constraint matrix covering identity, tenancy, catalog scope, route
  versioning, allocation cardinality, event/inventory evidence, append-only behavior,
  idempotency, outbox, jobs, assets, and projections;
- delete, immutability, and append-only persistence rules;
- candidate indexes mapped to API reads, scan lookups, worker queues, trace queries, and
  projection rebuilds;
- a lifecycle persistence boundary distinguishing database barriers, domain transaction rules,
  source evidence, and rebuildable projections.

## Self-check result

- No Prisma, migration, generated, seed, deployment, application, or frontend file changed.
- No unresolved business choice was silently converted into a final state, quantity, tenant,
  catalog, station, asset, actor, or cardinality rule.
- The design explicitly prevents tenant checks from being replaced by indexes or API filtering.
- Operational evidence is protected by restrict/retire defaults; hard deletion is limited to
  disposable or retention-governed platform data.
- Repeated structures remain relations and projections remain rebuildable from source evidence.
- Candidate indexes are tied to access patterns and are not presented as a substitute for
  authorization or foreign-key enforcement.
- `git diff --check` passes (with existing line-ending warnings on previously edited documents).

## Open questions or blockers

The following remain open for Pass 4 and must not be hidden by the candidate constraints:

- D-001 tenant root and workspace/line identity;
- D-005 catalog ownership and system/workspace scope;
- D-006 identity provider mapping;
- D-008 station/substage target granularity;
- D-009 rework/reversal semantics;
- D-010 lot and batch-part cardinality;
- D-014/D-027 asset ownership, retention, and backup;
- D-017/D-023/D-028 backup, on-prem topology, promotion, and operations;
- D-020/D-021 inventory ownership, units, numeric scale, and variance policy;
- D-024 planning aggregate public identity;
- D-025 actor identity and historical snapshot boundary;
- D-026 role/capability vocabulary and authorization mapping;
- final UUID/ULID, status-check, append-only enforcement, retention, and projection rebuild
  mechanisms.

## Ready for next pass

Yes - Pass 4 may define on-prem operational persistence, backup/recovery boundaries, migration
safety, rollout gates, and observability without editing deployment or application files.
