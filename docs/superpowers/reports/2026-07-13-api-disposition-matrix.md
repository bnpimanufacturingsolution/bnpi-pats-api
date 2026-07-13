# Bandai PATS API Disposition Matrix

Date: 2026-07-13  
Repository: `bnpi-pats-api`  
Authority: This matrix is the change boundary for the composition, retirement,
documentation, and seed passes in the approved cleanup plan.

## Decision summary

The API will have three runtime categories after containment:

1. `RETAIN_PLATFORM` remains available in the default application: health,
   security/error plumbing, documentation tooling, and workspace tenancy.
2. `BLOCKED_REVIEW` remains registered and behaviorally unchanged until the
   external or security dependency is confirmed: auth, workspace membership,
   project membership, employee/HRIS, and the legacy product terminology
   surface.
3. `QUARANTINE_LEGACY` remains in source and the Mongo compatibility schema,
   but is not mounted by default. It can be enabled explicitly for controlled
   compatibility use. No route is approved for destructive retirement in this
   pass because repository evidence cannot rule out an external consumer.

This is an intentional containment decision. A green controller test or an
unused frontend adapter proves that code exists or is dormant; it does not
prove that an external deployment, script, or operational workflow does not
depend on the route.

## Matrix

| Group | Route prefixes | Source paths | Schema paths | Seed paths | Consumer evidence | Disposition | Removal order | Verification | Stop condition |
|---|---|---|---|---|---|---|---|---|---|
| Platform health and request plumbing | `/`, `/health`, `/health/redis` | `index.ts`, `config/*`, `middleware/requestId.ts`, `middleware/security.ts`, `middleware/verifyToken.ts`, `middleware/sanitization.ts` | none | none | Direct runtime/monitoring surface; security tests | `RETAIN_PLATFORM` | Never in this cleanup | `GET /health`; `pnpm test -- tests/security.middleware.spec.ts`; typecheck | Any auth, security, response-shape, or middleware-order change |
| API documentation tooling | `/api/docs/*`, development `/api/swagger` | `app/docs/*`, `docs/openApiSpecs.ts`, `scripts/generate-openapi.ts`, `scripts/export-openapi.ts` | none | none | Generated docs and local API tooling; no PATS UI consumer | `RETAIN_PLATFORM` | Keep while route composition is stabilized; regenerate after containment | `pnpm run export-docs`; scan generated route list | Generator requires legacy modules to be mounted or advertises removed routes |
| Authentication boundary | `/api/auth/*` middleware boundary | `index.ts`, `middleware/security.ts`, `middleware/verifyToken.ts`, `config/env.ts` | none directly | none | App auth pages and SSO-style configuration; security-sensitive | `BLOCKED_REVIEW` | No mutation in this pass | Existing auth/security tests; manual middleware diff review | SSO ownership, auth behavior, or production security changes are requested or discovered |
| Workspace tenancy | `/api/workspace*` | `app/workspace/*` | `prisma/schema/Workspace.prisma` | `prisma/seeds/workspaceSeeder.ts` | Active app workspace service/hook; workspace tests | `RETAIN_PLATFORM` | Keep before any PATS domain adoption | `pnpm test -- tests/workspace.controller.spec.ts tests/workspace-authorization.spec.ts`; active-surface test | Workspace scoping or membership semantics change |
| Workspace membership and SSO lookup | `/api/workspace-member*` | `app/workspaceMember/*`, SSO helpers | `prisma/schema/WorkspaceMember.prisma` | `prisma/seeds/workspaceMemberSeeder.ts` | No active app route found; SSO/user lookup coupling and authorization tests | `BLOCKED_REVIEW` | No mutation in this pass | Authorization tests; inspect SSO call paths | External SSO consumer or workspace authorization dependency cannot be ruled out |
| Project membership tenancy coupling | `/api/project-member*` | `app/projectMember/*` | `prisma/schema/ProjectMember.prisma`, `prisma/schema/Workspace.prisma` | `prisma/seeds/projectMemberSeeder.ts` | No active app route; workspace/project authorization coupling | `BLOCKED_REVIEW` | No mutation in this pass | Controller/authorization tests; retained-schema import scan | Project authorization or retained workspace relation is affected |
| Employee and HRIS integration | `/api/employee*` | `app/employee/*`, HRIS configuration | `prisma/schema/employee.prisma` | `prisma/seeds/employeeSeeder.ts` | No active app route; external HRIS integration | `BLOCKED_REVIEW` | No mutation in this pass | Employee tests; HRIS config/integration review | HRIS ownership, sync contract, or employee data dependency is unclear |
| Template compatibility module | `/api/template*` | `app/template/*`, `app/services/template-service.ts` in app | `prisma/schema/template.prisma` | `prisma/seeds/templateSeeder.ts` | Dormant frontend adapter; legacy controller tests; public route | `QUARANTINE_LEGACY` | Register behind explicit legacy boundary; source remains | Default `createApp()` returns 404; explicit compatibility registration test | Any documented supported template workflow is found |
| Project PMS module | `/api/project*` | `app/project/*`, dormant app project adapter | `prisma/schema/project.prisma` | `prisma/seeds/projectSeeder.ts` | No active app route; legacy tests and internal PMS relations | `QUARANTINE_LEGACY` | Quarantine route registration before any source/schema retirement | Default 404; explicit legacy route smoke test; project tests remain runnable | External project consumer or retained relation requires the module |
| Estimation PMS module | `/api/estimation*` | `app/estimation/*`, dormant calculation adapters | `prisma/schema/estimation.prisma` | `prisma/seeds/estimationSeeder.ts` | No active app route; legacy tests and calculation coupling | `QUARANTINE_LEGACY` | After project boundary; preserve source | Default 404; typecheck; estimation tests | Estimation calculation is required by a retained module |
| Sequential numbering module | `/api/sequential*` | `app/sequential/*` | `prisma/schema/sequential.prisma` | `prisma/seeds/sequentialSeeder.ts` | No active app route; project/document numbering helpers | `QUARANTINE_LEGACY` | After project boundary; preserve source | Default 404; search retained imports | A retained workflow requires legacy numbering |
| Item PMS module | `/api/item*` | `app/item/*`, dormant item adapter | `prisma/schema/item.prisma` | `prisma/seeds/itemSeeder.ts` | Dormant frontend adapter; no active route; estimation coupling | `QUARANTINE_LEGACY` | After estimation; preserve source | Default 404; item tests; import scan | Retained estimation or external item consumer is found |
| Order PMS module | `/api/order*` | `app/order/*`, dormant order adapter | `prisma/schema/order.prisma` | `prisma/seeds/orderSeeder.ts` | Dormant frontend adapter; no active route; procurement relations | `QUARANTINE_LEGACY` | After item/estimation; preserve source | Default 404; order tests | Retained procurement workflow or external order consumer is found |
| Vendor PMS module | `/api/vendor*` | `app/vendor/*`, dormant vendor adapter | `prisma/schema/vendor.prisma` | `prisma/seeds/vendorSeeder.ts` | No active app route; no integration found; legacy tests | `QUARANTINE_LEGACY` | After order; preserve source | Default 404; vendor tests | External vendor/procurement consumer is found |
| Payslip finance module | `/api/payslip*` | `app/payslip/*`, dormant payslip adapter | `prisma/schema/payslip.prisma` | `prisma/seeds/payslipSeeder.ts` | Dormant adapter; no active route; employee/finance relations | `QUARANTINE_LEGACY` | After employee review; preserve source | Default 404; payslip tests | Employee/finance workflow or external consumer is found |
| Transaction finance module | `/api/transaction*` | `app/transaction/*`, dormant transaction adapter, Cloudinary helper | `prisma/schema/transaction.prisma` | `prisma/seeds/transactionSeeder.ts` | Dormant adapter; no active route; document upload/audit coupling | `QUARANTINE_LEGACY` | After project/vendor; preserve source | Default 404; transaction tests; integration import scan | Document, audit, or finance integration is found |
| Metrics/reporting module | `/api/metric*` | `app/metric/*`, dormant reporting code | related legacy PMS schema files | none dedicated | No active route; metric tests; derived PMS relations | `QUARANTINE_LEGACY` | After project/estimation/transaction; preserve source | Default 404; metric tests | Retained reporting workflow is found |
| Category module | `/api/category*` | `app/category/*` | `prisma/schema/category.prisma` | `prisma/seeds/categorySeeder.ts` | No active app route; legacy tests | `QUARANTINE_LEGACY` | Independent after platform boundary; preserve source | Default 404; category tests | External configuration consumer is found |
| Dynamic field module | `/api/field*` | `app/field/*`, dormant field adapter | `prisma/schema/field.prisma` | `prisma/seeds/fieldSeeder.ts` | Dormant adapter; no active route; legacy tests | `QUARANTINE_LEGACY` | Independent after platform boundary; preserve source | Default 404; field tests | Retained configurable-form workflow is found |
| Legacy item-type module | `/api/itemType*` | `app/itemType/*` | `prisma/schema/itemType.prisma` | `prisma/seeds/itemTypeSeeder.ts` | No active app route; item/estimation coupling; legacy tests | `QUARANTINE_LEGACY` | After item/estimation; preserve source | Default 404; item-type tests | Retained PMS configuration requires the module |
| Legacy product module | `/api/product*` | `app/product/*`, product controller/tests | `prisma/schema/product.prisma` | `prisma/seeds/productSeeder.ts` | Product UI uses local catalog; no active API consumer; terminology/model conflict with PATS draft | `BLOCKED_REVIEW` | No mutation beyond excluding it from default legacy registration until terminology review | Product tests; terminology review; schema comparison | Product terminology or legacy Product meaning is mistaken for canonical PATS Product |
| Demand planning module | `/api/demand-plan*` | `app/demand/*` | `prisma/schema/demand.prisma` | `prisma/seeds/demandSeeder.ts` | No active app route; demo/test-only evidence; project conversion coupling | `QUARANTINE_LEGACY` | After project boundary; preserve source | Default 404; demand tests | Project conversion workflow or external planning consumer is found |
| Milestone PMS module | `/api/milestone*` | `app/milestone/*`, dormant milestone adapter | `prisma/schema/milestone.prisma` | `prisma/seeds/milestoneSeeder.ts` | Dormant adapter; no active route; project relation | `QUARANTINE_LEGACY` | After project boundary; preserve source | Default 404; milestone tests | Retained project workflow requires milestones |
| Usage-code module | `/api/usageCode*` | `app/usageCode/*`, dormant usage-code adapter | `prisma/schema/usageCode.prisma` | `prisma/seeds/usageCodeSeeder.ts` | Dormant adapter; no active route; legacy tests | `QUARANTINE_LEGACY` | Independent after platform boundary; preserve source | Default 404; usage-code tests | External accounting/configuration consumer is found |
| Purchase-order module | `/api/purchase-order*` | `app/purchaseOrder/*` | `prisma/schema/PurchaseOrder.prisma` | `prisma/seeds/purchaseOrderSeeder.ts` | No active app route; procurement relations; legacy tests | `QUARANTINE_LEGACY` | After order/vendor; preserve source | Default 404; purchase-order tests | Procurement workflow or external consumer is found |
| Delivery-order module | `/api/delivery-order*` | `app/deliveryOrder/*` | `prisma/schema/DeliveryOrder.prisma` | `prisma/seeds/deliveryOrderSeeder.ts` | No active app route; purchase-order relation; legacy tests | `QUARANTINE_LEGACY` | After purchase order; preserve source | Default 404; delivery-order tests | Procurement workflow or external consumer is found |
| Invoice module | `/api/invoice*` | `app/invoice/*` | `prisma/schema/Invoice.prisma` | `prisma/seeds/invoiceSeeder.ts` | No active app route; finance/procurement relations; legacy tests | `QUARANTINE_LEGACY` | After purchase order; preserve source | Default 404; invoice tests | Finance workflow or external consumer is found |
| Payment-term module | `/api/payment-term*` | `app/paymentTerm/*` | `prisma/schema/PaymentTerm.prisma` | `prisma/seeds/paymentTermSeeder.ts` | No active app route; procurement relation; legacy tests | `QUARANTINE_LEGACY` | After purchase order; preserve source | Default 404; payment-term tests | Procurement workflow or external consumer is found |
| PO-type module | `/api/po-type*` | `app/poType/*` | `prisma/schema/POType.prisma` | `prisma/seeds/poTypeSeeder.ts` | No active app route; procurement relation; legacy tests | `QUARANTINE_LEGACY` | After purchase order; preserve source | Default 404; PO-type tests | Procurement workflow or external consumer is found |
| Payment-schedule module | `/api/payment-schedule*` | `app/paymentSchedule/*` | `prisma/schema/PaymentSchedule.prisma` | `prisma/seeds/paymentScheduleSeeder.ts` | No active app route; procurement relation; legacy tests | `QUARANTINE_LEGACY` | After purchase order; preserve source | Default 404; payment-schedule tests | Procurement workflow or external consumer is found |

## P4 runtime contract

- `createApp({ enableLegacyRoutes: false })` mounts retained platform routes
  and unchanged blocked-review routes, but no `QUARANTINE_LEGACY` route.
- `createApp({ enableLegacyRoutes: true })` is an explicit compatibility mode;
  it may mount only the quarantine rows above. It does not change auth,
  tenancy, or security middleware behavior.
- `RETIRE_ACTIVE_ROUTE` has no approved rows in this matrix. The 404 tests in
  P4 prove default containment, not destructive source deletion.
- The PATS PostgreSQL schema is not part of either runtime option.

## Coupling and removal rules

- Do not remove `prisma/schema/*.prisma`, seeders, or generated Prisma output
  while their relations or compatibility mode are retained.
- Do not treat generated docs, controller tests, seed values, or dormant app
  adapters as proof of a canonical PATS contract.
- A later retirement pass requires an external-consumer review and a revised
  matrix row explicitly changed to `RETIRE_ACTIVE_ROUTE`.

## Explicit no-go list

This cleanup does not:

- modify or promote `prisma/pats/schema.prisma`;
- design a PATS production seed or migrate presentational seed values;
- switch the frontend from local/demo transport to the API;
- run a database migration, reset, destructive seed, or `db push`;
- change authentication, authorization, tenancy, SSO, HRIS, or production
  deployment behavior;
- add PATS CRUD, planning, execution, scanning, or reporting endpoints.

## Self-review result

No row is marked `RETIRE_ACTIVE_ROUTE` because external consumers cannot be
ruled out from the two repositories alone. Retained rows have direct platform
usage or named security/documentation responsibility. Blocked rows have a
security, tenancy, external integration, or terminology conflict. All other
legacy rows have no active frontend route consumer and are safe to remove from
the default composition while preserving their compatibility source.

## P6 observed outcome

The OpenAPI input list was narrowed to the documentation, workspace,
workspace-member, project-member, employee, and product routers. Generated
Swagger, endpoint, and Postman artifacts now describe that retained/blocked
boundary only; stale per-tag files for quarantined modules were removed.
The legacy seed orchestrator remains intact and is explicitly labeled as
compatibility/demo material.
