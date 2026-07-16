# Single-Context Revision Pass 4: Consistency Review and Handover

Cross-check all revised documents against the REST standard, architecture, data model, lifecycle,
endpoint catalog, authorization rules, schema normalization design, decision register, and on-prem
operations boundary.

Record contradictions rather than hiding them. Confirm that no document still requires workspace
membership or cross-tenant behavior for the single-context first implementation. Update the schema
normalization handover with the exact next implementation task, allowed files, isolated PostgreSQL
gate, migration/rollback evidence, and explicit exclusions. Keep implementation blocked pending
explicit user approval. Do not modify Prisma, migrations, application, tests, generated artifacts,
seeds, deployment, or frontend files.
