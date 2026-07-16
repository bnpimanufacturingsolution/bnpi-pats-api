# Schema Pass 5 Prompt: Consistency Review and Handover

Read Passes 1–4 and cross-check the normalized schema design against the architecture, data model,
decision register, endpoint catalog, authorization matrix, OpenAPI common components, lifecycle
rules, and on-prem operations design.

Record every contradiction, missing relation, unbounded JSON field, ambiguous tenant/actor
reference, missing constraint/index, lifecycle mismatch, retention placeholder, or migration risk.
Update the decision register only for genuinely new decisions, preserving all existing statuses.
Mark the chain and pass reports complete only if no unresolved issue is hidden. Produce
`docs/superpowers/prompts/2026-07-14-pats-api-schema-normalization-handover.md` naming the exact
next Prisma implementation task, accepted/deferred decisions required, allowed file scope,
isolated PostgreSQL test gate, migration/rollback evidence, and explicit exclusions.

No Prisma, migration, source, generated, seed, deployment, or frontend change is allowed in this
pass.
