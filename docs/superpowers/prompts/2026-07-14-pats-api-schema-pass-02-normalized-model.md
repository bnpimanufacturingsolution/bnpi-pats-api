# Schema Pass 2 Prompt: Normalized Relational Decomposition

Read Pass 1 and all governing design documents before writing. Create
`docs/data/2026-07-14-pats-api-normalized-schema-design.md` as a design specification, not Prisma
syntax.

For each bounded context, define tables or relation groups with: purpose, owner, tenant scope,
opaque identity, candidate columns and types at conceptual level, nullability meaning, primary
and alternate keys, foreign keys, lifecycle, audit fields, and bounded JSON metadata. Cover
identity/tenancy, catalog, planning, execution, inventory/traceability, exceptions, audit/platform,
assets, jobs, and projections. Normalize repeated route steps, memberships, allocations, ledger
entries, asset links, and event evidence into relations. Keep `PlanningAggregate`, `Workspace`,
`LotPartAllocation`, and other neutral structures where decisions are open. Explicitly reject
legacy denormalized fields and UI snapshot state as canonical sources.

Do not write Prisma, migrations, seeds, application code, or deployment files. End with a table
inventory and unresolved schema choices for Pass 3.
