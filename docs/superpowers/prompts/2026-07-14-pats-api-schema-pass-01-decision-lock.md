# Schema Pass 1 Prompt: Authority and Decision Lock

Read the schema-normalization plan and chain, the existing data-model design, architecture,
cross-cutting design, endpoint catalog, decision register, and the draft PATS Prisma schema as
read-only evidence.

Audit decisions affecting: tenant root and naming, identity/actor mapping, catalog ownership,
station relationships, planning aggregate identity, PMRS, Lot cardinality, route versioning,
quantities/units/variance, rework/correction, asset ownership, audit/outbox/idempotency retention,
backup/recovery, and on-prem migration ownership.

Produce `docs/superpowers/chains/2026-07-14-pats-api-schema-normalization-pass-01.md` with a
decision-impact matrix. Mark each item as accepted package rule, working default, inferred,
`NEEDS_CONFIRMATION`, `CONFLICTING`, or `STALE`. Identify neutral schema structures that can
carry an open decision without encoding it, and list the choices that block Prisma implementation.
Do not change the decision register unless a genuinely new decision is discovered. Do not modify
any source, Prisma, migration, generated, seed, deployment, or frontend file.
