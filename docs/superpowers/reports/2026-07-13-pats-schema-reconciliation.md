# PATS Schema Reconciliation

Date: 2026-07-13
Status: PASS 5 working report; unresolved decisions remain explicitly marked `NEEDS_CONFIRMATION`.

## Purpose

This report reconciles the current standalone PostgreSQL PATS draft with the app's canonical domain shapes before the PATS Prisma client is generated or migrations are created. The legacy MongoDB schema and runtime remain outside this reconciliation.

## Confirmed domain mappings

| App/domain shape | PATS persistence mapping | Decision |
| --- | --- | --- |
| `Product -> Model -> ModelPart` | New `Product`, `Model`, and `ModelPart` models with explicit foreign keys | Confirmed by the product-model hierarchy report |
| `Project.productId` | Nullable `Project.productId` relation to `Product` | Confirmed; a project may exist before catalog linkage |
| `ProjectModelAllocation` | New project-to-model allocation with `plannedQuantity` | Confirmed production lineage boundary |
| `ProductSpecification` | Remains a separate project runtime snapshot | Confirmed; it is not collapsed into catalog `Product` |
| `PartsList -> ordered RoutingStep -> Part` | Existing normalized `PartsList`, `RoutingStep`, and `Part` tables | Confirmed; `stepOrder` preserves routing order |
| `Part.sourceModelId/sourceModelPartId` | Nullable source lineage references on `Part` | Confirmed app shape; source records remain optional |
| `Lot` | Existing lot parent with `lotCode`, `lotName`, `requiredProductionQuantity`, parts-list version, and batches | Canonical quantity/name fields are aligned; existing one-part fields remain pending reconciliation |
| `Batch` | Existing lot child with `batchCode`, `plannedQuantity`, `labelPackSize`, planned status, and optional project-model allocation | Confirmed by the domain foundation and hierarchy reports |
| `BatchPartLine` | Composite batch/part line with a real `Part` relation | Confirmed execution relationship; cardinality remains general many-to-many |
| `Station` and `StationStep` | Existing station and bound-step models | Confirmed; device bundle maps to existing screen/scanner/printer fields |

## Changes allowed in this pass

- Add the canonical catalog and project-model allocation models.
- Add confirmed catalog/lineage fields and relations to existing PATS models.
- Add `PLANNED` to `BatchStatus` and make it the new default for newly-created PATS batches.
- Add explicit PATS-only Prisma format, validate, generate, and migration commands.
- Generate the client into `generated/pats-client`; no legacy generated client output is changed intentionally.

## Mismatches preserved for later decision

### `Project.requiredProductionQuantity`

The app/domain truth places required production quantity on `Lot`, while the current draft also stores it on `Project`. Removing the project field would be a destructive semantic change and is not required to establish the new catalog boundary. It remains in this pass and is marked stale for a later migration decision.

### Lot part ownership

The app's current `Lot` shape is a run parent without a required `partId`, while the draft models one required part per lot and denormalizes `partName`. The correct lot-to-part cardinality is not confirmed. These fields remain unchanged; no silent collapse or deletion is made here.

### Station workspace ownership

The draft's `workspaceId` is retained. Project-to-workspace and station-to-workspace ownership are not frozen in the app architecture, and there is no confirmed cross-schema foreign key to introduce in this pass.

### Asset metadata and MinIO ownership

The app's `imageUrl` is a presentation/transport shape, not a confirmed persistence contract. A public URL must not be stored as the source of truth for private MinIO objects. This pass does not add an `Asset` model or persist `imageUrl`; object-key ownership, metadata, and model attachment rules remain `NEEDS_CONFIRMATION` for a later domain decision.

### Catalog routing templates

`ModelPart.routingSteps` is an ordered `StageStepRef[]` in the app shape, but the existing `RoutingStep` rows are versioned under a run-scoped `PartsList`. This pass stores catalog template routing as JSON on `ModelPart` rather than incorrectly linking it to a project `PartsList`. The JSON shape and promotion process into a `PartsList` are `NEEDS_CONFIRMATION`.

### Model source status and source references

The app exposes source status/reference data, but the complete allowed status vocabulary is not a durable backend decision. The schema uses a small explicit enum for the currently confirmed states and keeps the workbook/reference payload as JSON. Additional statuses require product confirmation.

## Migration and safety boundary

- The PATS schema remains in `prisma/pats/schema.prisma` and uses `PATS_DATABASE_URL`.
- PATS migrations live under `prisma/pats/migrations` and are generated/deployed only against an isolated disposable PostgreSQL instance during this pass.
- `prisma/schema/**`, `prisma/seed.ts`, legacy seeders, legacy generated output, production databases, auth, route registration, and frontend files are out of scope.
- No PATS runtime route or repository is wired in this pass; generation proves the schema boundary only.

## Open questions

- `NEEDS_CONFIRMATION`: Should a lot be allowed to contain multiple parts, and when is its part association established?
- `NEEDS_CONFIRMATION`: Should project quantity be removed after lot quantity becomes authoritative?
- `NEEDS_CONFIRMATION`: Which catalog image metadata belongs to `Model`, `ModelPart`, or a separate asset owner, and which object-key/read-URL policy applies?
- `NEEDS_CONFIRMATION`: What is the canonical catalog routing-template JSON contract and promotion workflow?
- `NEEDS_CONFIRMATION`: Is `Model 05` a valid source record or should it remain unresolved input data?

## Non-goals

This report does not authorize seed data, API route registration, authentication changes, frontend persistence, production migration, or destructive cleanup of legacy models.
