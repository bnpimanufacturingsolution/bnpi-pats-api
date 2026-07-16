# PATS API Gate 2 Identity and Authorization Implementation Plan

**Status:** COMPLETE — GATE 2 SLICE IMPLEMENTED AND VALIDATED

**Date:** 2026-07-15

**Repository/branch:** `bnpi-pats-api` / `develop`

## Scope

Implement the first deployment-scoped identity slice from the frozen Gate 0 target set:

- PATS-local authenticated `Subject` identity keyed by `(provider, issuer, providerSubject)` in
  the local identity namespace;
- append-oriented `SubjectAssignment` rows for capabilities and approved role bundles;
- capability-first authorization evaluation with no automatic administrator assignment;
- `/api/v1/users/me` and `/api/v1/users/me/capabilities` self-projections;
- a typed local authentication adapter boundary so client claims never become authorization truth;
- PATS-local username/password login backed by `SubjectCredential`, Argon2id verification, and
  signed subject-only bearer sessions;
- additive PostgreSQL/Prisma persistence and focused contract/policy tests.

## Frozen constraints

- The first release has one server-resolved operational context. Do not add Workspace,
  membership-tenancy, client-selected tenant, or ProductionLine persistence.
- The legacy HS256/workspace middleware remains compatibility-only and is not reused by canonical
  PATS routes.
- Disabled or revoked subjects fail closed. Role names are not authorization checks; effective
  capabilities are.
- Local identity identifiers are sensitive and are not exposed by self-projection. Bounded display-name
  and email snapshots are historical support fields only.
- Claims, localStorage values, frontend initials, and free-form actor strings cannot grant access.
- Local usernames are normalized to lowercase; password material is stored only as an Argon2id
  hash. Signed local bearer sessions contain subject identity and token metadata, never RBAC or
  workspace claims.
- Do not implement subject preference/walkthrough persistence in this slice; it remains a separate
  self-service platform slice despite its accepted target shape.
- Do not change generated artifacts by hand. If generated Prisma output is required, the generation
  step is a separately visible validation/output step.

## Work sequence

1. Add the normalized Subject/SubjectAssignment models and an additive migration without changing
   existing legacy or draft PATS relations.
2. Add typed local authentication verification and subject-resolution ports with a provider-neutral
   request context; resolve local credentials through `SubjectCredential` and issue subject-only
   signed bearer sessions.
3. Add capability policy evaluation, initial role-bundle mapping, disabled/revoked fail-closed
   behavior, and authorization middleware for canonical routes.
4. Add self-projection routes with RFC 9457 errors, correlation, and no provider-identifier leak.
5. Add focused tests for identity uniqueness, assignment status, capability evaluation, object
   scope, unauthenticated/disabled subjects, and legacy-route isolation.
6. Validate Prisma schema/migration, TypeScript, focused tests, and `git diff --check`.

## Initial policy vocabulary

Initial role bundles are policy conveniences only:

| Role bundle | Capabilities |
|---|---|
| `catalog-manager` | `catalog.read`, `catalog.manage`, `source-revision.approve` |
| `planner` | `planning.read`, `planning.manage`, `material-requirement.manage` |
| `production-operator` | `execution.read`, `execution.write`, `inventory.issue` |
| `inventory-controller` | `inventory.read`, `inventory.receive`, `inventory.issue`, `reconciliation.read` |
| `quality-reviewer` | `quality.read`, `quality.resolve`, `reconciliation.resolve` |
| `operations-admin` | `identity.read`, `capabilities.read`, `operations.manage` |

Direct capability assignments remain supported. The policy map is the enforcement contract; an
assignment row never grants access merely because its text resembles a role or claim.

## Completion result

Schema validation, focused local-auth/identity/authorization tests, self-projection contract tests,
TypeScript type-checking, and legacy isolation checks pass. The repository wrapper's Prisma
validation command requires `PATS_DATABASE_URL`; direct non-writing schema validation passed with a
placeholder URL. Credential bootstrap, password reset/change, login lockout/rate limiting, and
operator assignment administration remain explicit operational release inputs and were not guessed
into automatic application behavior.
