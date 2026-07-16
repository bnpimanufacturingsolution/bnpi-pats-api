# Single-Context Revision Pass 2: Domain and Persistence Revision

Using Pass 1, revise the conceptual and normalized persistence design for a single operational
context. Remove mandatory Workspace/Membership tenancy from the first model unless the user has
confirmed multiple lines in one database.

Define the replacement identity/authorization boundary, including subjects, capability
assignments, deployment context, optional future ProductionLine identity, catalog ownership,
foreign keys, uniqueness, indexes, lifecycle, audit actor references, and future multi-line
migration seams. Keep business relationships relational and JSON bounded. Update the schema
normalization pass report and do not create Prisma or migration files.
