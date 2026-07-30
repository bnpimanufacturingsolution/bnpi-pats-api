# Bandai PATS API Contract and Endpoint Catalog

**Status:** PROPOSED INVENTORY; single-operational-context revision; no endpoint is approved for implementation until
the revised design chain and user approval gate pass.

**Date:** 2026-07-15

**Normative standard:** `docs/standards/restful-endpoint-design-standards.md`

## Canonical route rules

- Public routes begin with `/api/v1`.
- Resource names are plural, lowercase, and kebab-case.
- Nested resources are limited to one level.
- Collection operations use query parameters, not verb-like subpaths.
- Query parameters use `snake_case`; JSON uses `camelCase`.
- The first deployment context is resolved server-side; clients cannot select or override it.
- A route is not canonical merely because it exists in current code or generated docs.

## Proposed resource families

The following are design families, not implementation commitments.

### Identity and authorization

The first deployment has one server-resolved operational context. It does not expose a tenant
selector, ProductionLine resource, membership collection, or cross-context existence behavior.
Authenticated subjects receive approved capabilities, and every resource is checked for deployment
ownership and lifecycle access.

```text
GET /api/v1/users/me
GET /api/v1/users/me/capabilities
```

Subject-assignment administration is a deployment operation and remains outside the first public
resource catalog until the provider, capability vocabulary, and operational owner are accepted.

### Catalog and configuration

```text
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/{productId}
PATCH  /api/v1/products/{productId}
DELETE /api/v1/products/{productId}
GET    /api/v1/models?product_id={productId}
GET    /api/v1/model-parts?model_id={modelId}
GET    /api/v1/workflow-groups
GET    /api/v1/stages
GET    /api/v1/sub-stages
GET    /api/v1/stations
GET    /api/v1/work-instructions
```

### Planning

```text
GET    /api/v1/production-plans
POST   /api/v1/production-plans
GET    /api/v1/production-plans/{planId}
PATCH  /api/v1/production-plans/{planId}
GET    /api/v1/parts-list-versions?plan_id={planId}
POST   /api/v1/parts-list-versions
GET    /api/v1/lots?production_plan_id={planId}
POST   /api/v1/lots
```

### Execution and inventory

```text
GET    /api/v1/batches
POST   /api/v1/batches
GET    /api/v1/batches/{batchId}
PATCH  /api/v1/batches/{batchId}
GET    /api/v1/stage-events?batch_id={batchId}
POST   /api/v1/stage-events
GET    /api/v1/inventory-transactions
POST   /api/v1/inventory-transactions
GET    /api/v1/routing-violations
PATCH  /api/v1/routing-violations/{violationId}
```

Stage events and inventory transactions are resources. Do not create verb paths such as
`/batches/{id}/scan`, `/batches/{id}/advance`, or `/inventory/receive` unless a documented
exception is approved.

### Traceability and reporting

```text
GET /api/v1/traceability
GET /api/v1/reports
GET /api/v1/audit-records
```

These are read-side resources. They must identify their freshness and source projection where
eventual consistency is possible.

### Assets and jobs

```text
POST /api/v1/assets
GET  /api/v1/assets/{assetId}
POST /api/v1/assets/{assetId}/upload-requests
GET  /api/v1/jobs/{jobId}
```

The upload-request relationship is one level. Private object keys are never public API identity.
Long-running import/export/backup actions return `202 Accepted`, a `Location` job resource, and
terminal job states.

### Platform

```text
GET /api/v1/health
GET /api/v1/ready
GET /api/v1/version
```

Platform endpoints have a separate operational policy and must not expose business data.

## Operation-level design matrix

The route families above are expanded here enough to prevent implementation from inventing
semantics. The matrix omits the common `/api/v1` prefix for readability. The common response,
Problem Details, pagination, trace, deprecation, and retry rules
in the cross-cutting design apply unless a row states a narrower rule.

| Operation | Owner | Capability/object check | Success and retry | Side effects and open decisions |
|---|---|---|---|---|
| `GET /users/me`, `GET /users/me/capabilities` | Identity and Authorization | Verified subject; effective deployment assignment | `200`; no idempotency | No business mutation; provider and capability vocabulary remain D-006/D-026 |
| Product/model/model-part reads | Catalog | `catalog.read`; deployment-owned definition | `200`; collection pagination | No mutation; catalog layering is D-005 |
| Product writes and configuration publish/retire | Catalog | `catalog.manage`; object ownership and lifecycle | `201/204`; `If-Match` for mutable resources | Audit/outbox; published immutability and station mapping are D-005/D-008 |
| `GET/POST /production-plans`, member/patch operations | Planning | `planning.read/author`; deployment-owned plan | `200/201/204`; `If-Match` and idempotency for create | Audit/outbox; aggregate noun is D-024 |
| Parts-list versions and route steps | Planning | `planning.author/release`; plan ownership | `200/201`; release uses `If-Match` and idempotency | Published versions immutable; route publication rules remain open |
| Lots | Planning | `planning.author`; plan and allocation lineage | `200/201`; create is idempotent | Audit/outbox; cardinality/timing are D-010 |
| Batches | Execution | `execution.read/record`; lot, plan, station, and deployment ownership | `200/201/204`; create is idempotent; lifecycle uses `If-Match` | Audit/outbox; terminal/rework policy is D-009 |
| Stage events | Execution | `execution.record`; batch/route/station eligibility | `200/201`; idempotency required; append-only | Event, violation, audit, outbox, and position projection are atomic |
| Inventory transactions | Inventory and Traceability | `inventory.record`; source/target and quantity policy | `200/201`; idempotency required; append-only | Ledger, variance, audit, outbox, and projection are atomic; D-020/D-021 |
| Routing violations | Exceptions and Audit | `exceptions.read/resolve`; source evidence ownership | `200/204`; `If-Match` for resolution | Resolution audit/outbox; policy is D-009 |
| Traceability and reports | Reporting and Projections | `reports.read`; deployment query scope | `200`; cursor/page per collection | Read-only projections expose freshness; no write authority |
| Audit records | Exceptions and Audit | `audit.read`; deployment/operator policy | `200`; cursor pagination | Read-only append evidence; retention is D-017 |
| Assets and upload requests | Assets and Documents | `assets.read/write`; approved target ownership | `201/200`; upload/finalization idempotent where retried | Metadata transaction plus private MinIO object; D-014 |
| Jobs | Platform and Operations | Job owner or platform operator | `200`; retry is explicit job operation | Async state and RFC 9457-compatible failure; retention is D-017 |
| Health/readiness/version | Platform and Operations | Endpoint-specific operator policy | `200/503`; no idempotency | No business data; readiness reflects required dependencies |

Every row still requires a concrete OpenAPI operation ID and schema before its implementation gate.
The row is not permission to implement an unresolved decision.

## Authorization and operational scope

The first deployment uses capability authorization within the server-resolved operational context.
It does not use membership tenancy, client-selected workspace IDs, or a user-selectable scope.

| Capability family | Scope | Required object check |
|---|---|---|
| identity.read / capabilities.read | Authenticated subject | Subject is the verified token principal and receives only effective capabilities |
| catalog.read / catalog.manage | Deployment catalog | Target definition belongs to the deployment and cannot invalidate active routes silently |
| planning.read / planning.author / planning.release | Deployment and plan | Plan, route, Lot, and allocation lineage belongs to the deployment; lifecycle rules pass |
| execution.read / execution.record / execution.control | Deployment, batch, and station | Batch/Lot/source evidence belongs to the deployment and station/route eligibility passes |
| inventory.read / inventory.record | Deployment and source/destination | Source, destination, quantity, and external reference policy pass |
| exceptions.read / exceptions.resolve / process-change.create | Deployment and source evidence | Source is visible; resolution/change reason and lifecycle capability pass |
| reports.read / audit.read | Deployment or platform | Query filters and sensitive-field redaction remain within the permitted scope |
| assets.read / assets.write | Approved owner target | Linked target belongs to the deployment and private bytes remain protected |
| platform.read | Deployment/operator policy | No business object scope; operational policy applies |

Authorization is repeated server-side for every protected operation. A valid opaque ID alone does
not grant access. A future multi-line deployment may add ProductionLine scope and line-aware
capabilities after D-029 is accepted; that is not part of the first route contract.

## Common response policy

- Single-resource success responses return the resource representation directly unless the
  endpoint documents a specific representation.
- Paginated collections use `{ data, pagination }` only.
- Creation returns `201 Created`, the resource, and `Location`.
- Successful no-content operations return `204 No Content`.
- Errors use `application/problem+json` and RFC 9457.
- Every endpoint documents `401`, `403`, `404`, `409`, `412`, `422`, `429`, `500`, and `503` cases
  that can occur for its operation.

## Required endpoint metadata

Every catalog entry must include:

- lifecycle classification: `CANONICAL`, `TRANSITIONAL`, or `LEGACY`;
- owner bounded context;
- resource and operational scope;
- method and idempotency behavior;
- request and response schemas;
- query parameters and pagination mode;
- authorization policy and object-level checks;
- concurrency validator behavior;
- problem types and status codes;
- audit and outbox behavior;
- OpenAPI operation identifier;
- focused and integration test requirements;
- unresolved decisions or approved exceptions.

## Provisional compatibility route

`GET /api/pats/catalog/products/{productId}` from the earlier stack proof is transitional evidence
only. It is not the design template. Before implementation, it must either be replaced by the
canonical versioned route or receive an explicit transitional exception and migration plan.

## Pass 2 proposed resource extensions

The client evidence introduces the following candidate resource families. They are not approved
implementation endpoints until D-030 through D-033 and the affected catalog/planning decisions are
accepted.

```text
GET /api/v1/parts?product_id={productId}&model_id={modelId}
GET /api/v1/bom-versions?product_id={productId}&model_id={modelId}
GET /api/v1/bom-lines?bom_version_id={bomVersionId}
GET /api/v1/process-specifications?part_id={partId}&process_family={processFamily}
GET /api/v1/packaging-specifications?product_id={productId}&market_code={marketCode}
GET /api/v1/controlled-document-revisions?document_type={documentType}&external_control_no={controlNo}
```

These remain top-level, shallow, plural kebab-case resources with `snake_case` filters and
standard pagination. The candidate reads expose normalized, source-linked representations; they
do not expose worksheet tabs, private object keys, or raw formula internals.

Candidate write behavior is deferred. In particular, a Parts List revision that contains an
unresolved identifier conflict must not be published or used to release an executable planning
definition under candidate D-033. A read endpoint may return the draft/conflict status only to a
caller with the approved catalog/planning read capability and must not conceal the source conflict.

| Candidate family | Owner | Read authorization | Write/release boundary |
|---|---|---|---|
| Parts | Catalog | `catalog.read`; deployment/object check | `catalog.manage`; source namespace and applicability decisions required |
| BOM versions/lines | Catalog, consumed by Planning | `catalog.read` or `planning.read` according to ownership decision | Publication requires immutable revision and quantity/UOM policy |
| Process specifications | Catalog | `catalog.read`; approved part/specification visibility | Publication requires process-owner and station mapping decisions |
| Packaging specifications | Catalog/Planning boundary | `catalog.read` or `planning.read` according to ownership decision | Packaging hierarchy, ratios, and market scope remain open |
| Controlled document revisions | Owning domain/Assets boundary | `catalog.read` or `planning.read`; source access is object-checked | Effective status and approval require controlled-document policy |

No candidate route changes the mandatory `/api/v1`, HTTP, RFC 9457, pagination, authorization,
ETag, idempotency, trace, deprecation, or OpenAPI requirements. Existing `parts-list-versions`
remain plan-scoped execution-definition resources; they do not become a generic spreadsheet import
resource.

## Pass 3 proposed planning and PMRS extensions

The PMRS evidence supports the following candidate read families. They remain gated by D-007,
D-020, D-021, D-024, D-034, and candidate D-035:

```text
GET /api/v1/pmrs-references?production_plan_id={planId}&market_code={marketCode}
GET /api/v1/plan-demand-allocations?production_plan_id={planId}&demand_purpose={purpose}&market_code={marketCode}
GET /api/v1/material-requirements?production_plan_id={planId}&status={status}
```

`material-requirements` is a canonical PATS planning family. PMRS references and source/projection
status remain visible, but PATS does not expose a spreadsheet clone. `issued` and `balance` are
derived from PATS-scope issue evidence; clients cannot mutate those totals.

| Candidate operation | Owner/boundary | Success/retry | Required guard |
|---|---|---|---|
| Read PMRS references | Planning | `200`; paginated; no idempotency | Deployment/plan object check; source provenance and revision visible |
| Attach/supersede PMRS reference | Planning, external-reference boundary | `201/204`; `If-Match` for supersession; idempotency if retried | Accepted control/revision policy; no ownership implication |
| Read demand allocations | Planning | `200`; paginated; deterministic filters | Plan/model/market/purpose object checks; source revision visible |
| Create/update demand allocation | Planning | `201/204`; idempotency for create; `If-Match` for mutation | Accepted demand-purpose, UOM, reconciliation, and plan lifecycle rules |
| Read material requirements | Planning/Inventory | `200`; cursor/page as appropriate | Approved source/BOM/demand lineage and D-020/D-021 quantity policy |
| Record material issue | Inventory | `201`; `Idempotency-Key`; append-only | Requirement, source/target, UOM, withdrawal/reference, variance, and correction rules |

The Asia 77,060/77,860 discrepancy is a domain conflict, not a `409` response policy to invent
for a client caller at this stage. If an endpoint later receives a request that depends on the
unresolved source conflict, the contract must define a stable RFC 9457 conflict problem and must
not silently choose a quantity.

## Pass 5 consistency decisions

### Subject versus `/users/me`

`Subject` is the internal persisted identity entity. `/api/v1/users/me` is a user-facing self
projection that returns approved profile/capability-safe data for the authenticated Subject. The
route does not create a separate `users` identity table, expose provider identifiers, or change the
canonical persistence name.

If subject preferences are accepted under D-036, the candidate self-service routes are:

```text
GET   /api/v1/users/me/preferences
PATCH /api/v1/users/me/preferences
```

They are authenticated self-access operations. `PATCH` is field-replacement and requires the
standard concurrency behavior if the preference row can be concurrently updated. Walkthrough
completion updates are separate only if the product requires an explicit completion contract;
otherwise they remain frontend state and are not silently persisted.

### DELETE and 404/410 behavior

Canonical catalog/configuration DELETE operations are retirement/removal requests where lifecycle
allows them. A retired or soft-deleted resource is hidden with `404 Not Found` on subsequent reads;
`410 Gone` is reserved for an explicitly accepted permanent-removal policy. Append-only stage,
inventory, audit, outbox, and source-document evidence have no ordinary DELETE endpoint; correction
or supersession creates linked evidence. The endpoint matrix must state this per resource before
implementation.

## Decisive reconciliation and material-control resources

The manual-conflict solution requires explicit resources for draft validation and approved release:

```text
GET   /api/v1/source-revisions
POST  /api/v1/source-revisions
GET   /api/v1/source-revisions/{sourceRevisionId}
GET   /api/v1/source-reconciliation-issues?source_revision_id={sourceRevisionId}
POST  /api/v1/source-reconciliation-resolutions
POST  /api/v1/source-revision-approvals
GET   /api/v1/material-requirements?production_plan_id={planId}
POST  /api/v1/material-requirements
```

These are candidate canonical resources, not implementation permission. Their decisive behavior is:

- A source revision is created as `draft` and validated before it can become `approved`.
- Open blocking reconciliation issues prevent approval and plan/material release.
- Resolving an issue creates a resolution resource recording the selected value, actor, reason,
  source field/path, and audit evidence; it creates or supersedes a revision rather than mutating
  the original source snapshot.
- `source-revision-approvals` is an idempotent command resource requiring the approved release
  capability and `If-Match` on the source revision.
- `material-requirements` are PATS-owned approved planning requirements. PMRS control numbers are
  external references, not resource identity.
- Material issues use the existing append-only `/api/v1/inventory-transactions` contract and
  derive balance; clients cannot PATCH `issued` or `balance` totals.

| Resource family | Capability | Concurrency/retry | Blocking rule |
|---|---|---|---|
| Source revisions | `catalog.manage` or owning-domain capability | `POST` uses `Idempotency-Key`; mutable draft uses `If-Match` | Cannot approve with open blocking issue |
| Source reconciliation issues/resolutions | `reconciliation.read/resolve` | Resolution `POST` uses `Idempotency-Key` and `If-Match` on the issue; resolution is audited | Waiver requires explicit capability and reason |
| Source revision approvals | `planning.release`/`catalog.release` | Idempotent command; `If-Match`; `409` for state conflict | Approved revision must pass validation |
| Material requirements | `planning.author/release` | Create idempotent; mutation uses `If-Match` | Requires approved source/BOM/demand lineage |
| Material issue evidence | `inventory.record` | `Idempotency-Key`; append-only correction | Requirement, UOM, source/reference, and variance rules pass |

## Pass 4 schema-normalization revision — API and authorization consistency review

The following mapping makes the normalized relations visible through resource contracts without
exposing table shape as the API. These are proposed canonical resource families; Gate 0 and user
approval still block implementation. Operation IDs are design identities for the future OpenAPI
contract.

| Resource/operation | Owning aggregate/context | Capability and object check | Lifecycle/concurrency/retry | Standard/error/side-effect boundary |
|---|---|---|---|---|
| `GET /api/v1/source-revisions` (`sourceRevisionList`) | `ControlledDocumentRevision`; Assets/Documents plus semantic source owner | `source-revision.read`; server-resolved deployment and source visibility | Cursor/page per documented collection; no idempotency; source status/conflict is read-only | `200` `{data,pagination}`; RFC 9457 `401/403/404/422/429/503`; no mutation |
| `POST /api/v1/source-revisions` (`sourceRevisionCreate`) | Controlled source revision | `source-revision.manage`; approved source/import boundary and target ownership | Draft creation uses `Idempotency-Key`; source revision identity is immutable | `201` plus `Location`; `409` key conflict; audit/outbox with draft creation |
| `GET /api/v1/source-revisions/{sourceRevisionId}` (`sourceRevisionGet`) | Controlled source revision | Same capability and object check; unauthorized existence remains hidden per policy | Strong ETag for mutable draft; no idempotency | `200` direct resource; `404` for missing/hidden; source evidence is redacted/bounded |
| `GET /api/v1/source-reconciliation-issues` (`sourceReconciliationIssueList`) | `SourceReconciliationIssue`; Exceptions/Audit | `reconciliation.read`; source revision ownership and permitted evidence visibility | Cursor/page; no idempotency; status is evidence state | `200` paginated; RFC 9457 errors; issue evidence is not source mutation |
| `POST /api/v1/source-reconciliation-resolutions` (`sourceReconciliationResolutionCreate`) | `SourceReconciliationIssue` plus append-only resolution | `reconciliation.resolve`; issue/source ownership and resolver capability | `If-Match` on issue; `Idempotency-Key`; same-key replay/different-payload `409` | `201` plus `Location`; `412/409/422`; resolution, audit, and outbox commit atomically |
| `POST /api/v1/source-revision-approvals` (`sourceRevisionApprovalCreate`) | `SourceRevisionApproval`; Exceptions/Audit release evidence | `catalog.release` or `planning.release` according to document type; source object check | `If-Match` on revision; `Idempotency-Key`; open blocking issue is a conflict/validation failure | `201`/`409`/`412`/`422`; approval, status transition, audit, and outbox are one transaction |
| `GET /api/v1/parts` (`partList`) and `GET /api/v1/part-applicabilities` (`partApplicabilityList`) | `PartDefinition`/`PartApplicability`; Catalog | `catalog.read`; typed namespace, deployment, Product/Model object checks | Cursor/page; no idempotency; effective/draft visibility follows capability | `200` standard envelope; no global alias or filename identity; source conflict is visible when permitted |
| `GET /api/v1/bom-versions` (`bomVersionList`) and `GET /api/v1/bom-lines` (`bomLineList`) | `BomDefinition`/`BomLine`; Catalog consumed by Planning | `catalog.read` or `planning.read`; source revision and target scope checks | Cursor/page; immutable effective revisions; no idempotency | `200`; RFC 9457 errors; quantities include UOM/usage basis and source revision |
| `GET /api/v1/process-specifications` (`processSpecificationList`) and `GET /api/v1/process-specification-steps` (`processSpecificationStepList`) | `ProcessSpecification`/Step; Catalog | `catalog.read`; part/process/station object checks | Cursor/page; effective versions immutable; no idempotency | `200`; process parameters bounded; no inference of scan route from worksheet order |
| `GET /api/v1/packaging-specifications` (`packagingSpecificationList`) and `GET /api/v1/packaging-lines` (`packagingLineList`) | `PackagingSpecification`/Line; Catalog | `catalog.read`; Product/Model/Part object checks | Cursor/page; effective versions immutable; no idempotency | `200`; ratios remain explicit; no packaging-to-inventory alias |
| `GET /api/v1/product-specification-snapshots` (`productSpecificationSnapshotList`) | `ProductSpecificationSnapshot`; Planning | `planning.read`; plan and approved source ownership | Cursor/page; immutable after plan release; no idempotency | `200`; checksum/source revision/freshness exposed; no live catalog mutation |
| `GET/POST /api/v1/plan-demand-allocations` (`planDemandAllocationList`, `planDemandAllocationCreate`) | `PlanDemandAllocation`; Planning | `planning.read/author`; plan/model/source object checks | Create uses `Idempotency-Key`; mutable draft uses ETag/`If-Match`; committed rows freeze at release | `200`/`201`/`412`/`409`/`422`; dimensioned quantity only; audit/outbox on writes |
| `GET /api/v1/plan-model-allocations` (`planModelAllocationList`) | Derived `PlanModelAllocation`; Planning/Reporting | `planning.read`; plan/model scope and source freshness | Cursor/page; no write or idempotency contract; freshness is visible | `200`; read-side summary only; no independent total mutation |
| `GET/POST /api/v1/material-requirements` (`materialRequirementList`, `materialRequirementCreate`) | `MaterialRequirement`; Planning | `planning.read/author/release`; approved source/BOM/demand lineage and plan object check | Create uses `Idempotency-Key`; lifecycle mutation uses ETag/`If-Match`; no creation from unresolved source | `200`/`201`/`409`/`412`/`422`; audit/outbox; no `issued`/`balance` write fields |
| `GET /api/v1/pmrs-references` (`pmrsReferenceList`) | `PMRSReference`; Planning external-reference boundary | `planning.read`; plan/source reference visibility | Cursor/page; supersession uses ETag and idempotency when later enabled | `200`; source observations labelled with revision/freshness; PMRS is not PATS ledger |
| `GET/POST /api/v1/inventory-transactions` (`inventoryTransactionList`, `inventoryTransactionCreate`) | `InventoryTransaction`; Inventory/Traceability | `inventory.read/record`; requirement, batch/lot/part, source/destination object checks | Cursor; create/issue uses `Idempotency-Key`; correction is a linked append-only record; no generic PATCH/DELETE | `200`/`201`/`409`/`422`/`503`; ledger, variance, audit, outbox, and bounded projection atomic |
| `GET /api/v1/users/me/preferences` / `PATCH /api/v1/users/me/preferences` (`subjectPreferenceGet`, `subjectPreferencePatch`) | `SubjectPreference`; Identity/Authorization | Authenticated subject self-access; no provider identifier exposure | PATCH field replacement; ETag/`If-Match`; no idempotency required for a replacement | `200`/`204`/`412`/`422`; audit if policy requires; not authorization truth |
| `GET/POST /api/v1/users/me/walkthrough-completions` (`walkthroughCompletionList`, `walkthroughCompletionCreate`) | `SubjectWalkthroughCompletion`; Identity/Authorization | Authenticated subject self-access | Versioned completion row; POST uses `Idempotency-Key`; same version is idempotent | `200`/`201`/`409`/`422`; append evidence; no capability or ownership effect |

### Endpoint checklist result

| Checklist area | Result | Evidence |
|---|---|---|
| Contract identity | `PASS` for proposed routes | All routes begin `/api/v1`, use plural lowercase kebab-case resources, opaque IDs, and no verb path. New command families are collection resources. |
| Relationships and collections | `PASS` | At most one relationship level; filters use `snake_case`; collections document cursor/page choice and `{data,pagination}`. |
| HTTP semantics | `PASS` | GET/read, POST/create/record, PATCH field replacement, `201/Location`, `204`, and no successful error envelope are defined. Append-only evidence has no generic update/delete. |
| Errors | `PASS` | RFC 9457 `application/problem+json`, field errors, `404` hidden/retired default, and applicable `409/412/422/429/503` behavior are defined. |
| Security and operational scope | `PASS` | Provider-neutral authenticated subject, capability, server-resolved deployment context, object-level checks, and redaction are required. |
| Concurrency and retries | `PASS` | ETag/`If-Match` for mutable drafts and preferences; `Idempotency-Key` replay/conflict for retryable commands. |
| Data and observability | `PASS` | camelCase JSON, snake_case queries, UTC timestamps, trace propagation, correlation, and audit fields follow the cross-cutting design. |
| OpenAPI/tests/generated documentation | `N/A — design phase` | Operation IDs and obligations are recorded; OpenAPI, contract tests, persistence tests, and generated-doc verification remain Gate 0/post-approval implementation gates. |

No route permits a client-selected workspace, line, tenant, PMRS balance, or UI/localStorage
state to authorize a write. `TRANSITIONAL` legacy proof routes remain compatibility evidence;
they are not silently promoted to these canonical candidates.

## 2026-07-29 App–API MVP route reconciliation

The earlier proposed inventory lists `/api/v1/products` as a candidate catalog family. The
implemented foundation closure and the first frontend adapter use `/api/v1/catalog/products`.
For the App–API Product Catalog MVP, `/api/v1/catalog/products` and its member route are the
working canonical family. The top-level `/api/v1/products` spelling remains a proposed future
contract only and must not be added as a second identity without an explicit compatibility and
deprecation plan.

The MVP collection operation is:

```text
GET /api/v1/catalog/products?page=1&limit=50&sort=-updated_at
```

It requires `catalog.read`, resolves the operational context on the server, accepts only bounded
offset pagination and documented snake_case sort fields, and returns exactly `{data,pagination}`.
The collection is a read-only summary; Product → Model → ModelPart detail remains the member
graph at `/api/v1/catalog/products/{productId}`.

## Gate 2 identity slice implemented (2026-07-15)

The first canonical identity slice is now implemented behind the frozen Gate 0 target:

| Route | Operation ID | Runtime contract |
|---|---|---|
| `GET /api/v1/users/me` | `userMeGet` | Provider-safe `id`, bounded `displayName`, and bounded `email`; provider, issuer, and provider subject are never returned. |
| `GET /api/v1/users/me/capabilities` | `userMeCapabilitiesGet` | Sorted effective capability keys derived from active direct capability or role-bundle assignments. |

The routes use an injected provider-neutral identity adapter and subject repository. If the
deployment has not composed that adapter, they return the canonical `503` dependency problem;
they never fall back to legacy HS256/workspace claims. Missing authentication returns `401`, and a
disabled subject returns `403`. Unknown capability literals and inactive assignments are ignored.

This slice does not add a client-selected context, Workspace, membership tenancy, ProductionLine,
or subject-preference/walkthrough persistence.

## Pass 4 on-prem and implementation consistency

- PostgreSQL remains the canonical relational owner for source revisions, reconciliation
  evidence, approved content, plans, requirements, inventory transactions, audit, idempotency,
  outbox, and projection checkpoints. PMRS/legacy stores are read-only evidence or external
  references, not a second PATS write store.
- Source files and controlled-document bytes use private MinIO Asset metadata. Object keys are
  never resource identity, no public URL is a source-control substitute, and approval cannot be
  reported while required bytes/checksums are unavailable.
- The source mutation, resolution/approval, requirement, or issue command commits its source
  record, audit, idempotency result, outbox intent, and only bounded synchronous projections in
  one transaction. Asynchronous report projections expose freshness and rebuild from source.
- Docker Compose remains the first air-gapped runtime direction. Health and readiness remain
  separate; PostgreSQL/identity failures fail writes closed, MinIO failures do not fabricate
  verified assets, and outbox/projection failures are observable and retryable. Backup, retention,
  RPO/RTO, promotion ownership, and exact topology remain `NEEDS_CONFIRMATION`.
- Any future schema implementation must use the reviewed expand/contract sequence: Gate 0 freeze,
  approved Prisma design, preflight/recovery evidence, additive expand, compatibility/backfill
  reconciliation, enforce, and only then contract. This pass authorizes none of those changes.
