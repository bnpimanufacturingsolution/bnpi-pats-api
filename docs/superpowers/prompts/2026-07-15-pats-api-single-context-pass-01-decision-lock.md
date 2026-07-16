# Single-Context Revision Pass 1: Operational-Context Decision Lock

Read the current context, architecture, data model, endpoint catalog, cross-cutting design,
decision register, schema normalization design, schema handover, and implementation plan.

Classify the user's statement that PATS is not multi-tenant against the existing `Workspace`,
`Line`, membership, tenant-FK, and cross-tenant authorization assumptions. Produce a decision
record in the pass report that distinguishes:

- one deployment/one operational context;
- one deployment containing multiple physical lines;
- multiple customer/tenant deployments.

Recommend the least complex model consistent with current on-prem truth. Do not silently turn the
recommendation into an accepted decision. Preserve a future migration path if multiple lines are
later confirmed. Do not change Prisma or application files.
