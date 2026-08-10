# Schema Pass 4 Prompt: Operational Persistence and Migration Safety

Read Passes 1–3, the cross-cutting/on-prem design, and the implementation backlog.

Extend the normalized schema design with audit, outbox, idempotency, jobs, assets, projection
checkpoints, retention/legal-hold placeholders, redaction boundaries, and transaction bundles.
Describe source mutation + audit + idempotency result + projection checkpoint + outbox atomicity,
retry/dead-letter behavior, MinIO metadata/byte ownership, and readiness/failure boundaries.

Define additive expand/contract migration stages, compatibility requirements for mixed application
versions, rollback boundaries, legacy Mongo isolation, backfill prerequisites, and restore/rebuild
verification. Do not invent retention, RPO, RTO, topology, owner, or secret values. Do not modify
Prisma, migrations, application, deployment, or generated files. Add the Pass 4 report.
