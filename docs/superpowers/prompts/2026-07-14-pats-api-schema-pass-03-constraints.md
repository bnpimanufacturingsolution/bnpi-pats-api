# Schema Pass 3 Prompt: Constraints, Indexes, and Lifecycle Persistence

Read Passes 1–2 and the lifecycle/invariant sections of the canonical data-model design.

Extend `docs/data/2026-07-14-pats-api-normalized-schema-design.md` with a constraint and access
design. Map each invariant to exactly one or more of: PostgreSQL primary/unique/check/foreign-key
constraint, domain validation, transaction lock/atomicity rule, or rebuildable projection. Define
tenant-safe foreign-key strategies, code uniqueness scopes, route/version immutability, positive
route ordering, quantity/scale placeholders, append-only ledger protections, idempotency
uniqueness, outbox deduplication, and lifecycle state persistence. Define indexes for endpoint
filters, stable cursor pagination, latest-event lookup, audit/outbox queues, and asset ownership.

Where an open decision changes a constraint, show alternatives and retain `NEEDS_CONFIRMATION` or
`CONFLICTING`; do not choose silently. Do not modify Prisma or runtime files. Add the Pass 3 report
under `docs/superpowers/chains/`.
