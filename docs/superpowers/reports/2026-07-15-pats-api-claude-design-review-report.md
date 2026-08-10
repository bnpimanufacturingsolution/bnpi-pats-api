# Claude Design Review: Bandai PATS API Design Package

**Reviewer:** Claude (independent design review, read-only)

**Date:** 2026-07-15

**Scope:** `docs/superpowers/prompts/2026-07-15-pats-api-claude-design-review-prompt.md`, full
required reading order, plus read-only inspection of `prisma/pats/schema.prisma`,
`prisma/pats/migrations/**`, and `docs/standards`/`docs/principles`/`docs/generated` for conflicts.
No source, Prisma, migration, test, generated, seed, deployment, or frontend file was modified.

---

## Executive verdict

**`READY_WITH_REQUIRED_REVISIONS`**

The core design question — single on-prem operational context, no `Workspace`/membership tenancy,
no client-selected scope, `ProductionLine` deferred to D-001/D-029 — is applied consistently across
the architecture, conceptual data model, normalized schema, endpoint catalog, cross-cutting design,
decision register, plan, and the 2026-07-15 revision chain. These documents do not silently
contradict each other on tenancy, and the migration-risk claims about the existing
`prisma/pats/schema.prisma` draft (required `Lot.partId`, `partName` denormalization, mutable
`Batch.currentStageId`, JSON routing templates, `String actor`, `workspaceId` on `Project`/
`Station`) are verified accurate against the actual file.

However, the package is not internally consistent end-to-end. The two documents that AGENTS.md
declares mandatory for *every* endpoint review — the endpoint design checklist and the REST
principle — were correctly out of scope for the 2026-07-15 revision chain (chain scope only allowed
design-package Markdown) but were never reconciled afterward, and they still hard-code
"Workspace/line tenancy scope is explicit and tested" as a required review item. AGENTS.md itself,
and the original (pre-revision) design chain/handover prompts, do not reference the 2026-07-15
revision chain at all, creating a real risk that a future session restarting strictly from AGENTS.md
would miss the tenancy revision. D-006 (identity provider) is under-scoped relative to how much
weight the literal first proposed implementation task (`subjects`/`subject_assignments`) places on
it. A legacy/frontend-evidenced domain concept (per-subject locale preference and walkthrough
completion state — EN/JA/FIL is a standing product requirement) has no home in the canonical data
model or endpoint catalog.

None of these are fundamental defects in the domain/data/API model itself, and none require
re-opening the single-operational-context decision. **Implementation remains blocked** until Gate 0
decisions are accepted/deferred with owner and review condition, per the design package's own
gating rule, and the four items below are resolved or explicitly accepted as known gaps.

---

## Critical findings

### Finding 1 — HIGH — Mandatory endpoint checklist/principle still require Workspace/line tenancy testing

- **Affected files:** `docs/standards/endpoint-design-review-checklist.md` ("Security and tenancy"
  section, "Workspace/line tenancy scope is explicit and tested"); `docs/principles/restful-endpoint-design-principle.md`
  ("PATS-specific application", "Workspace/line tenancy and object-level authorization are explicit
  endpoint concerns").
- **Inconsistency:** AGENTS.md makes these two files mandatory reading and a required review gate for
  *every* HTTP endpoint. The 2026-07-15 single-operational-context revision explicitly states the
  first deployment "does not expose a tenant selector, ProductionLine resource, membership
  collection, or cross-context existence behavior" (contract catalog) and that `Workspace` is "not a
  canonical tenant or public API resource for the first release" (review prompt's working
  direction). The checklist and principle were never updated to match; they still instruct reviewers
  to record pass/fail evidence for a tenancy concept the rest of the package says must not exist yet.
- **Why it matters:** These are the literal instruments AGENTS.md says must gate every endpoint. If
  followed literally at Gate 1/4+, an implementer either fabricates a Workspace/line tenancy check
  that contradicts the accepted design, or skips a "required" checklist line without an approved
  exception — both are compliance failures under the checklist's own rules ("`FAIL` blocks normal
  implementation... `N/A` requires a short reason").
- **Recommended resolution:** Before Gate 1 (common HTTP contract) or Gate 4 (first business
  endpoints), amend the checklist/principle to say "deployment-context scope is explicit and tested;
  Workspace/line tenancy applies only if D-001/D-029 later confirms a ProductionLine scope." This is
  a small, scoped edit outside this review's read-only mandate.
- **Blocks:** Not Gate 0 (schema/persistence). Blocks clean execution of the endpoint review
  checklist starting at Gate 1/4.

### Finding 2 — HIGH — D-006 (identity provider) is under-scoped for the literal proposed next task

- **Affected files:** `docs/decisions/2026-07-14-pats-api-design-decision-register.md` (D-006);
  `docs/data/2026-07-14-pats-api-normalized-schema-design.md` (`subjects` table); schema-normalization
  handover "Exact next implementation tasks".
- **Inconsistency/risk:** The handover names the literal first implementation task as `subjects` plus
  deployment-scoped `subject_assignments`. The `subjects` table's core shape — whether `provider`/
  `issuer`/`provider_subject` are populated, whether a local-mode username/credential boundary exists
  at all, and the candidate `(provider, issuer, provider_subject)` uniqueness — is entirely gated by
  D-006, which remains `NEEDS_CONFIRMATION` with no interim scope. The design tolerates this via
  nullable columns and an expand/contract migration, but that only prevents a *destructive* rework —
  it does not prevent the first slice being unimplementable or being implemented against a guessed
  provider model that gets contradicted once D-006 is actually answered.
- **Why it matters:** Of all sixteen listed blocking decisions, D-006 has the most direct leverage on
  the literal next task this review is asked to confirm. Deferring it with only "remains open" is
  weaker than the other deferrals (e.g., D-008/D-009/D-010 genuinely don't block a subjects table).
- **Recommended resolution:** Gate 0 should record at minimum a *provisional* answer for D-006 (e.g.,
  "local/on-prem-directory mode first, OIDC federation later" or vice versa) sufficient to fix the
  `subjects` table's nullable-vs-required shape, even if the full identity-provider decision remains
  open. This is a narrower ask than fully resolving D-006 and keeps the Gate 2 persistence slice from
  being built against an unstated assumption.
- **Blocks:** Gate 0 sign-off for the specific "first persistence task" claim; does not block
  continuing design work.

### Finding 3 — MEDIUM — AGENTS.md and the original design-chain/handover prompts do not reference the 2026-07-15 revision

- **Affected files:** `AGENTS.md` ("Active PATS Design Package" section); `docs/superpowers/chains/2026-07-14-pats-api-design-chain.md`;
  `docs/superpowers/prompts/2026-07-14-pats-api-design-handover.md`.
- **Inconsistency:** These three files' reading orders and "next task" statements stop at the
  original 8-pass chain and never mention `docs/superpowers/chains/2026-07-15-pats-api-single-operational-context-revision-chain.md`
  or its four pass prompts. By contrast, `docs/superpowers/prompts/2026-07-14-pats-api-schema-normalization-handover.md`
  *was* updated in place to reference the revision. The content of the shared-filename docs
  (context/spec/architecture/data-model/etc.) was edited in place and is current, so this is not a
  content contradiction — but a session that restarts strictly from AGENTS.md's pointers (as its own
  "Required Handoff" section implies) would not be told the tenancy model was revised on 2026-07-15,
  only that the underlying same-named files happen to already reflect it.
- **Why it matters:** This is exactly the failure mode the design package elsewhere guards against
  ("Implementation must restart from the reading order... in the final handover prompt; it must not
  infer approval from this chain's completion"). The review prompt for this session had to explicitly
  append the revision-chain file to the reading list because AGENTS.md's own order would not have
  surfaced it.
- **Recommended resolution:** Add one line to AGENTS.md's "Active PATS Design Package" section
  pointing to the 2026-07-15 revision chain and its handover, and add a superseding note to the
  original design-chain/design-handover files (mirroring what the schema-normalization handover
  already does).
- **Blocks:** Not Gate 0 directly; blocks a clean, unambiguous restart for a future session.

### Finding 4 — MEDIUM — No canonical home for subject locale preference / walkthrough state

- **Affected files:** `docs/data/2026-07-14-pats-api-data-model-design.md`; `docs/data/2026-07-14-pats-api-normalized-schema-design.md`;
  `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md`; compare `prisma/pats/schema.prisma`
  `UserPreference` model (`locale: EN|JA|FIL`, `completedTours: String[]`).
  the draft Prisma schema in `prisma/pats/schema.prisma` (`UserPreference` model with `locale` and
  `completedTours`).
- **Gap:** The canonical data model enumerates an "Operational context and identity" table with
  `Subject`, `SubjectAssignment`, and a capability/role policy row, but has no entity for a subject's
  UI locale preference or completed-walkthrough state. The only localization concept in the canonical
  docs is bounded catalog-content JSON ("localized text with an explicit locale-key allowlist"),
  which is a different concept (multi-locale *content*, not a per-user *preference*). This concept is
  present in the legacy/draft evidence and is a standing product requirement (EN/JA/FIL plus
  walkthrough), so its absence from the canonical model and endpoint catalog (no `GET/PATCH
  /users/me/preferences`-equivalent) is a real, if minor, scope gap rather than an intentional
  exclusion — nothing in the data model doc's "explicit non-canon" or gaps lists calls it out as
  deliberately deferred.
- **Why it matters:** If left unaddressed, a future implementer either re-derives this from the
  legacy schema uncritically (against the design package's own rule that legacy Prisma is evidence
  only) or omits it and it resurfaces as an unplanned addition mid-implementation.
- **Recommended resolution:** Add a short entity (e.g., `SubjectPreference` owned by Identity/Platform,
  or a `Platform` bounded-metadata field on `Subject`) and a corresponding read/write route family to
  the data model and endpoint catalog, or explicitly record it as `NEEDS_CONFIRMATION`/out-of-scope
  with a reason. Low effort, should happen before the Catalog/Identity implementation gates (Gate 2/4),
  not before Gate 0.
- **Blocks:** Not Gate 0. Should be closed before Gate 2/4.

### Finding 5 — LOW — D-001/D-029 boundary overlap

- **Affected files:** decision register D-001, D-029; referenced together as "D-001/D-029" in nearly
  every document that touches `ProductionLine`.
- **Observation:** D-001 ("does `ProductionLine` have a meaningful business identity/API noun") and
  D-029 ("will one database ever serve multiple physical lines") are conceptually separable but are
  never actually treated separately anywhere in the package — every reference gates on both together,
  and no document describes a scenario where one is answered without the other. This is not a defect,
  but the two-ID structure adds decision-register overhead without adding review value.
- **Recommendation:** Consider merging D-001 into D-029 (or vice versa) at the next register revision
  for owner clarity. Non-blocking, cosmetic.

### Finding 6 — LOW — `Subject` (schema) vs `/users/me` (route) naming is never reconciled

- **Affected files:** `docs/data/2026-07-14-pats-api-normalized-schema-design.md` (`subjects` table);
  `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md` (`GET /api/v1/users/me`).
- **Observation:** The canonical persisted entity is `Subject`/`subjects`, but the only exposed route
  in the identity family uses the noun `users`. No document states whether `users` is the deliberate
  public-facing synonym for the internal `Subject` concept, or whether a future `users` resource with
  different semantics is anticipated. This is a common and reasonable pattern (public "user" vs.
  internal "subject") but should be a stated mapping, not an implicit one, given how strictly the rest
  of the package insists on naming precision (e.g., the `PlanningAggregate`/`ProductionPlan`/`Project`
  treatment under D-024).
- **Recommendation:** One sentence in the endpoint catalog's identity section stating the `users` ↔
  `Subject` mapping. Non-blocking.

### Finding 7 — LOW — Per-resource 404-vs-410 and delete semantics not yet pinned in the operation matrix

- **Affected file:** `docs/api/2026-07-14-pats-api-contract-and-endpoint-catalog.md` (`DELETE
  /api/v1/products/{productId}` listed in the route family; the operation-level design matrix's
  "Product writes and configuration publish/retire" row does not separately state DELETE's soft/hard
  semantics or 404-vs-410 choice).
- **Observation:** The data model says products are "hide rather than erase," which implies DELETE
  should retire rather than hard-delete and should return 404 (not 410) afterward per the REST
  standard's default — but the catalog doesn't say this explicitly per-resource yet. The catalog
  itself acknowledges this class of gap ("Every row still requires a concrete OpenAPI operation ID
  and schema before its implementation gate"), so this is expected incompleteness at this design
  stage, not a contradiction.
- **Recommendation:** Carry forward into the OpenAPI authoring step for Gate 4; no action needed now.

---

## Decision-by-decision review

| Decision | Meaning | Review result | Recommended disposition | Rationale |
|---|---|---|---|---|
| D-001 | Workspace vs. `ProductionLine` API noun | Consistently applied: no `Workspace` tenant noun anywhere in the canonical package; `ProductionLine` gated behind confirmation | `DEFER_WITH_BOUNDARY` | Design safely excludes it from the first schema/route surface; overlaps almost entirely with D-029 (Finding 5) |
| D-002 | Operational ownership style (deployment-level auth + ordinary FKs vs. line-scoped) | Technical recommendation, already `PROPOSED`, consistent with every other document, correctly excluded from the "blocking decisions" list | `ACCEPT_RECOMMENDATION` | Pure engineering direction, not a business call; no conflicting evidence found |
| D-005 | Catalog ownership: deployment-owned only vs. future shared/system templates | Consistently deferred; first schema has no nullable global/layered scope field | `DEFER_WITH_BOUNDARY` | Safely excluded from Gate 0–3; needed before Gate 4 (Catalog) |
| D-006 | Identity provider and subject mapping | Consistently marked `NEEDS_CONFIRMATION`, but under-scoped relative to its leverage on the literal first persistence task (Finding 2) | `NEEDS_CONFIRMATION` (with a required minimum interim scope before Gate 2) | Business/technical owner required; the `subjects` table shape depends on at least a provisional answer |
| D-008 | Station-to-Stage/SubStage/bundle mapping | Consistently deferred; not needed for identity/persistence slice | `DEFER_WITH_BOUNDARY` | Blocks Gate 4 only |
| D-009 | Rework/reversal/correction policy | Consistently forward-only as working rule; deferred everywhere it's cited | `NEEDS_CONFIRMATION` | Genuine business policy call; blocks Execution (Gate 6) |
| D-010 | Lot cardinality (single-part vs. controlled multi-part) | `LotPartAllocation` is a well-designed decision-neutral relation that supports either outcome without rework | `NEEDS_CONFIRMATION` | Business policy call; blocks Planning (Gate 5); schema shape is already safe either way |
| D-014 | Asset ownership, linkable targets, retention | Consistently deferred; asset link strategy explicitly flagged as needing a stronger-FK decision before writes | `NEEDS_CONFIRMATION` | Blocks Gate 8; the "generic (target_type, target_id)" placeholder is correctly flagged as non-final |
| D-017 | Backup/recovery owner, retention, RPO/RTO | Consistently deferred; no invented values found anywhere (verified across architecture, normalized schema, and cross-cutting docs) | `NEEDS_CONFIRMATION` | Needs a named operational owner soon given the air-gapped on-prem posture; doesn't block Gate 0–3 |
| D-020 | Withdrawal Form ownership/requiredness | Consistently deferred; inventory design allows external reference only | `DEFER_WITH_BOUNDARY` | Blocks Gate 7 only |
| D-021 | Quantity/unit/variance/rounding | Register status `CONFLICTING`; cross-checked against `prisma/pats/schema.prisma` (`Part.variancePercentThreshold`/`varianceAbsoluteFloor` with implied 5% fallback) vs. BRD's flat ±5% — the conflict is real, not overcaution | `CONFLICTING` | Two genuinely different structures (flat global threshold vs. per-part override+fallback) must be reconciled by a business owner before Gate 7 |
| D-024 | `Project` vs. `ProductionPlan` planning-aggregate noun | Internal table name (`planning_aggregates`) is neutral; public route (`production-plans`) explicitly labeled `WORKING_DEFAULT` everywhere it appears | `DEFER_WITH_BOUNDARY` | Safe because neither the schema nor the route commits irreversibly; needed before Gate 5 |
| D-025 | Actor identity / historical snapshot fields | `subject_id` candidate plus optional snapshot columns is a tolerant design | `DEFER_WITH_BOUNDARY` | Compatible with the first persistence slice as designed |
| D-026 | Role/capability vocabulary and role-to-capability mapping | Correctly excluded from the persistence-slice scope; sequenced into the separate Gate 2 capability-policy task | `NEEDS_CONFIRMATION` | Business/ops decision; sequencing in the plan already isolates it from the schema task |
| D-027 | Coordinated MinIO+PostgreSQL backup/retention/orphan-cleanup ownership | Consistently deferred; no invented retention values | `NEEDS_CONFIRMATION` | Blocks Gate 8/9; needs a named owner |
| D-028 | On-prem topology and promotion ownership | Consistently deferred; Compose-first vs. Hyper-V/K3s/Argo CD correctly kept as delivery-only, not domain-affecting | `NEEDS_CONFIRMATION` | Blocks Gate 9/10; needs a named operational owner |
| D-029 | Single vs. multi-line shared database | This is the master premise of the entire revision; consistently and safely bounded (no `production_lines` table, no composite FK, explicit future migration boundary) | `DEFER_WITH_BOUNDARY` | Best-handled decision in the register; the whole package already assumes "single" as a safe default with a clean expansion path |

---

## Domain and schema review

- **Should the first schema contain any workspace/membership/tenant/`production_line` tables or
  columns?** No, and it does not. `subjects`/`subject_assignments` replace workspace membership
  cleanly; no `workspace_id`, membership FK, or composite tenant key appears anywhere in the
  normalized schema design. This was independently verified against the actual `prisma/pats/schema.prisma`
  draft, which *does* still carry `workspaceId` on `Project`/`Station` — correctly treated as
  implementation evidence to reconcile, not copied forward.
- **Are `subjects`/`subject_assignments` sufficient for the first identity/authorization slice?**
  Structurally yes — normalized, FK-clean, with a sensible candidate uniqueness
  `(provider, issuer, provider_subject)` and `(subject_id, assignment_kind, assignment_key)`. The
  open risk is not structural but decision-dependent: see Finding 2 (D-006).
- **Normalization:** Consistently good. Route steps, capability assignments, allocations, event
  evidence, asset links, and job attempts are all modeled as rows, not JSON arrays. The JSON
  metadata registry (data model doc + normalized schema doc) is unusually disciplined — every
  allowed JSON owner has a stated purpose and an explicit prohibited-content list (no relationships,
  no auth, no secrets, no balances).
- **Lot/Batch/StageEvent/InventoryTransaction/Exceptions/Audit/Outbox/Idempotency/Job ownership and
  lifecycle:** Coherent state machines with correctly append-oriented evidence (StageEvent,
  InventoryTransaction, ProcessChangeLog, AuditRecord, OutboxMessage never support an ordinary
  update path; corrections are new linked records). `LotPartAllocation` is a genuinely
  decision-neutral design for D-010 rather than a disguised single-part assumption — this is a
  strong piece of design work.
- **Migration risk boundary:** The document's list of what NOT to carry forward from the current
  draft (required `Lot.partId`, denormalized `partName`, mutable `Batch.currentStageId`, JSON
  routing templates, `String actor`) was checked line-by-line against `prisma/pats/schema.prisma`
  and is accurate.
- **Gap found:** subject locale preference / walkthrough completion state has no home (Finding 4).
- **Keys/types/nullability:** No unsafe or premature commitments found. UUID identity, `timestamptz`,
  `numeric(18,6)` are all explicitly labeled "candidate"/"working recommendation," and the type
  policy table is honest about what's still open (rounding/scale under D-021, checksum encoding
  under asset policy).

## API and authorization review

- **Route conventions:** `/api/v1`, plural kebab-case, one-level nesting, `snake_case` query params,
  `camelCase` JSON — applied consistently across every route family in the catalog. No verb paths
  found (`/scan`, `/advance`, `/receive` are explicitly and correctly prohibited).
- **Methods/statuses/pagination/RFC 9457/ETags/idempotency/trace/rate-limit/deprecation:** All
  specified at a project-wide level in the cross-cutting design with a genuine PATS problem-type
  registry (`urn:bandai:pats:problem:*`), not a generic placeholder. Idempotency replay/conflict
  rules and `If-Match`/412 behavior are stated once and referenced consistently rather than
  re-derived per endpoint.
- **Authorization:** Every protected operation family in the operation-level design matrix states a
  capability and an object-level check, and the cross-cutting design repeats "authorization is
  re-resolved inside the write transaction" as a hard rule (not just a route-registration check).
  This directly satisfies the checklist's "object-level authorization is enforced for every
  protected resource" line — except that the checklist's *tenancy* line is stale (Finding 1).
- **Endpoint semantics derived from frontend/legacy?** No violations found. The provisional
  compatibility route (`GET /api/pats/catalog/products/{productId}`) is explicitly marked
  `TRANSITIONAL`, not a template, consistent with the context doc's evidence-precedence rules.
- **Endpoint families too vague to implement safely?** None outright — every family states owner,
  capability, and open decisions. The genuinely vague edges (DELETE semantics per resource, exact
  OpenAPI schemas) are explicitly and honestly flagged as deferred to the OpenAPI authoring step,
  which is appropriate at this design stage (Finding 7, non-blocking).

## Operations review

- **Docker Compose-first, air-gapped posture:** Realistic and bounded. The design repeatedly refuses
  to invent topology, replica count, TLS termination, or hardware profile, and correctly separates
  "delivery option" (Hyper-V/K3s/Argo CD) from "domain dependency."
- **PostgreSQL/MinIO backup and restore:** Responsibilities are clear in structure (named minimum
  backup set, named restore runbook steps) but explicitly and correctly leave owner/RPO/RTO/retention
  open (D-017/D-027/D-028) rather than inventing them — this is the right call for a design-only
  package, not a gap.
- **Liveness/readiness/failure behavior:** The failure-mode table (PostgreSQL down, MinIO down,
  identity provider down, outbox publisher down, projection stale, backup/restore verification
  failure) is concrete and testable, with explicit "fail closed, never fabricate success" rules
  throughout. No silent fail-open path was found.
- **No invented RPO/RTO/retention/topology/ownership values found** anywhere in the package —
  every instance is correctly labeled `NEEDS_CONFIRMATION` rather than defaulted.

---

## Recommended Gate 0 freeze

Smallest exact set of decisions to accept or explicitly defer, with owner/review condition, before
the `subjects`/`subject_assignments` persistence task:

| Item | Required action before Gate 0 sign-off | Owner/condition |
|---|---|---|
| D-001/D-029 | Accept "single operational context, no `Workspace`" as the working schema boundary (already the package's consistent direction) | Business/product owner sign-off; review trigger = confirmed multi-line requirement |
| D-002 | Accept as-is (ordinary FKs, deployment-level authorization) | Architecture owner; no review trigger needed unless D-029 changes |
| D-006 | Record at minimum a provisional identity-provider mode (e.g., local/on-prem-directory first) so `subjects.provider`/`issuer` nullability is fixed | Security/ops owner; full OIDC decision may remain open, review before Gate 4 |
| D-025 | Accept `subject_id` + optional bounded snapshot as the actor-reference shape | Architecture owner |
| D-026 | May be explicitly deferred past Gate 0 — sequenced into the separate Gate 2 capability-policy task, not the schema task | Business/ops owner; review before Gate 2's capability-policy step |
| D-005, D-008, D-009, D-010, D-014, D-017, D-020, D-021, D-024, D-027, D-028 | Explicitly deferred with the boundary already stated in this package (no schema/route field encodes them) | Named per-decision owner; review triggers already stated per-decision in the register and this report's table above |

Additionally, before Gate 1 (not Gate 0): reconcile Finding 1 (checklist/principle Workspace
language) and Finding 3 (AGENTS.md/handover staleness) so the mandatory review artifacts don't
contradict the accepted direction once endpoint work starts.

## Recommended next implementation task

**Confirmed**, with one addition:

1. Gate 0 decision freeze (as scoped above, including the D-006 minimum-scope requirement).
2. `subjects` and deployment-scoped `subject_assignments` persistence.
3. Isolated PostgreSQL migration and tests.
4. Provider adapter, capability policy, and object-ownership checks.
5. Later bounded-context implementation.

This sequence is sound and matches the plan, handover, and revision chain consistently. The only
addition is that step 1 must produce a concrete (even if provisional) answer to D-006 before step 2
starts, since step 2's table shape is not fully decidable without it (Finding 2). No other step
needs reordering.

## Final handover

- **Ready for explicit user implementation approval?** The domain/data/API design itself is ready.
  Implementation approval should be granted only after: (a) Gate 0 decisions in the table above are
  recorded with owner/rationale/impact per the register's own acceptance rule, and (b) Findings 1 and
  3 are acknowledged or fixed so the mandatory endpoint checklist/principle and AGENTS.md don't
  contradict the accepted single-context direction once endpoint implementation starts.
- **What must be revised first:** Finding 1 (checklist/principle Workspace language) and Finding 3
  (AGENTS.md/original handover staleness) are small, mechanical doc fixes and should happen before
  Gate 1. Finding 2 (D-006 minimum scope) should happen as part of Gate 0. Finding 4 (locale/
  walkthrough entity) should happen before Gate 2/4 but does not block Gate 0.
- **Uncertainties intentionally left open:** All sixteen reviewed decision IDs except D-002 remain
  open by design, each with a stated review trigger (see table above); this is correct behavior for
  a documentation-only design package, not a defect.
- **Was any source, Prisma, migration, test, generated, seed, deployment, or frontend change
  requested or made by this review?** **No.** This review only read files (`Read`/`Glob`/`Grep`) and
  wrote this report. No `Edit`/`Write` call touched any file outside this report.
