# Schema Normalization Chain — Pass 1: Authority and Decision Lock

**Status:** COMPLETED — design-only

## Pass completed

Pass 1: Schema authority and decision lock.

## What changed

This pass establishes which sources may influence a normalized PostgreSQL design and which
decisions remain unsafe to encode. The conceptual data-model document is the starting point; the
unwired `prisma/pats/schema.prisma`, legacy Mongo/PMS models, generated docs, frontend state, and
seeded fixtures remain evidence only.

### Authority classification

| Evidence or rule | Classification | Schema consequence |
|---|---|---|
| PostgreSQL is the target PATS persistence boundary and Prisma is the working adapter | `WORKING_DEFAULT` / D-003 | Design relationally; implementation still requires Gate 0 acceptance and migration review |
| Opaque immutable identities, relational core relationships, bounded JSON, UTC timestamps | `CONFIRMED_PACKAGE` / standard-aligned | Applies to every table design unless a labelled conflict is found |
| Append-oriented operational ledgers, audit, outbox, and rebuildable projections | `PROPOSED` / D-011–D-013 | Carry as design structure; do not claim retention or correction policy is accepted |
| `/api/v1`, pagination envelopes, Problem Details, idempotency and ETag semantics | `CONFIRMED_STANDARD` / `PROPOSED` package rules | Schema supports the contract but does not authorize domain writes |
| Existing PATS Prisma draft | `CONFLICTING` / D-019 | Do not copy required `Lot.partId`, denormalized names, mutable current position, string actor, or JSON routes as canonical truth |
| Frontend localStorage/release snapshots and fixtures | `STALE` / D-022 | No UI snapshot becomes a source table, version, or concurrency token |
| On-prem Docker-first direction without accepted identity/backup/topology ownership | `NEEDS_CONFIRMATION` / D-023, D-027, D-028 | Keep operational ownership and recovery values as explicit placeholders |

### Decision-impact matrix

| Decision | Status | Normalized-design impact | Prisma/migration blocker |
|---|---|---|---|
| D-001 Workspace versus Line and tenant root | `NEEDS_CONFIRMATION` | Use neutral internal `Workspace` and show tenant-key alternatives; do not expose a final product noun | Yes — tenant keys, FKs, uniqueness, and API identity depend on it |
| D-002 Tenant scoping style | `PROPOSED` | Preserve one-level workspace scope and server-side membership as the working shape | Yes until composite/reference enforcement is accepted |
| D-003 PostgreSQL with Prisma migrations | `WORKING_DEFAULT` | Use PostgreSQL relational terminology and migration-safe design | Yes for implementation authority, not for conceptual design |
| D-005 Catalog ownership/layering | `NEEDS_CONFIRMATION` | Keep catalog owner relation abstract enough for system/workspace/layered alternatives | Yes — ownership FKs, uniqueness, visibility, and seed boundary depend on it |
| D-006 Identity provider and subject mapping | `NEEDS_CONFIRMATION` | Use provider-neutral `Subject`, `Membership`, and assignment structures; do not encode claims | Yes — subject key, issuer uniqueness, actor references, and membership lifecycle depend on it |
| D-007 PMRS structure | `NEEDS_CONFIRMATION` | Keep `PMRSReference` as an external/reference boundary, not an invented aggregate | Yes for PMRS-owned tables/relations |
| D-008 Station granularity | `NEEDS_CONFIRMATION` | Keep `StationStep` as a configurable binding candidate; do not choose Stage/SubStage ownership | Yes — station FK and route eligibility constraints depend on it |
| D-009 Rework/reversal/correction | `NEEDS_CONFIRMATION` | Preserve append-only source evidence plus correction-link capability; do not model silent updates | Yes for correction relations, state transitions, and ledger mutation privileges |
| D-010 Lot cardinality and creation timing | `NEEDS_CONFIRMATION` | Use `LotPartAllocation` as a neutral relation; avoid a required single `part_id` | Yes — uniqueness/cardinality and creation constraints depend on it |
| D-011 Route versioning | `PROPOSED` | Use immutable `PartsListVersion` and normalized `RouteStep` rows as the working design | Implementation requires acceptance of immutability and migration behavior |
| D-012 Current batch position | `PROPOSED` | Treat position as a rebuildable projection from `StageEvent`, never sole source | Projection table/index can be designed; write authority still gated |
| D-013 Event/audit strategy | `PROPOSED` | Include append-only source, audit, and outbox structures in the design | Transaction and retention policy require acceptance |
| D-014 Asset ownership/lifecycle | `NEEDS_CONFIRMATION` | Use `Asset` + typed `AssetLink`, private object reference, and no public key identity | Yes — owner relation, link targets, retention, and deletion behavior depend on it |
| D-017 Backup/recovery ownership and retention | `NEEDS_CONFIRMATION` | Include manifest/checkpoint/retention placeholders without invented values | Yes for operational acceptance and destructive-retention policy |
| D-018 External integrations | `PROPOSED` | Keep identity, storage, scanner/printer, and publisher behind ports; no provider columns beyond references | Adapter ownership remains open |
| D-019 Legacy/draft schema conflict | `CONFLICTING` | Explicitly exclude legacy denormalization and unwired draft assumptions | Yes — no direct migration from the draft is authorized |
| D-020 Withdrawal Form ownership | `NEEDS_CONFIRMATION` | Store only bounded external reference candidate on inventory evidence | Yes for a first-class Withdrawal Form relation or validation FK |
| D-021 Quantity/unit/variance policy | `CONFLICTING` | Design quantity value boundary and source/target fields without final scale/threshold/rounding | Yes — numeric types/checks and variance tables depend on it |
| D-022 Frontend snapshots/fixtures | `STALE` | Exclude localStorage state and seeded release snapshots from source truth | Yes — no fixture-to-schema promotion |
| D-023 On-prem readiness ownership | `NEEDS_CONFIRMATION` | Keep operational ownership/test hooks abstract | Yes for release/restore acceptance |
| D-024 Project versus ProductionPlan | `NEEDS_CONFIRMATION` | Use `PlanningAggregate` neutral design identity and carry route alias as a working default only | Yes — table identity/public mapping and migration compatibility depend on it |
| D-025 Canonical actor identity/snapshot | `NEEDS_CONFIRMATION` | Use `Subject` reference plus optional immutable historical snapshot boundary | Yes for audit/ledger actor columns and foreign keys |
| D-026 Role/capability mapping | `NEEDS_CONFIRMATION` | Store membership/assignment relations without final role enum or capability claim | Yes for authorization tables/checks and protected writes |
| D-027 MinIO/PostgreSQL asset backup ownership | `NEEDS_CONFIRMATION` | Keep object metadata/checksum and restore consistency hooks; no owner/retention claim | Yes for asset lifecycle and operational acceptance |
| D-028 On-prem topology/promotion ownership | `NEEDS_CONFIRMATION` | Keep schema migration and artifact compatibility independent of topology | Yes for production migration/release approval |

### Neutral structures permitted to carry open decisions

- `Workspace` is an internal tenant-root candidate; the public `Line` noun remains undecided.
- `PlanningAggregate` holds the conceptual planning identity while `Project` versus
  `ProductionPlan` remains open.
- `LotPartAllocation` represents one-or-more planned-part membership without silently enforcing
  single-part or multi-part Lots.
- `Subject`, `Membership`, and assignment relations separate provider identity from authorization
  vocabulary and actor evidence.
- `PMRSReference` stores only an external/reference boundary until PMRS ownership is known.
- `Asset` plus typed `AssetLink` separates API metadata from MinIO bytes and keeps link targets
  explicit while D-014 is open.
- `StageEvent` and `InventoryTransaction` remain immutable source evidence; corrections reference
  originals rather than mutating them.
- Current batch position and trace/report data remain rebuildable projections with source version
  and freshness, not write-side truth.

### Implementation blockers carried forward

The following remain blockers for a final Prisma schema or migration: D-001, D-005, D-006, D-008,
D-009, D-010, D-014, D-017, D-020, D-021, D-024, D-025, D-026, D-027, and D-028. This pass does
not accept, rename, or downgrade any of them.

## Self-check result

- Only this documentation pass file was added; no Prisma, migration, generated, seed, deployment,
  application, or frontend file changed.
- Existing decision statuses were preserved.
- Conflicting/stale/open evidence is labelled and not promoted to schema truth.
- Neutral alternatives and implementation blockers are explicit.
- `git diff --check` is required before the pass is marked ready; no code tests are applicable to
  this documentation-only pass.

## Open questions or blockers

The implementation blockers above remain open. No additional decision was silently introduced.

## Ready for next pass

Yes — Pass 2 may define the normalized table inventory using the neutral structures and labels
above.
