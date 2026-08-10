# Bandai PATS API Surface Inventory

Date: 2026-07-13  
Repository: `bnpi-pats-api`  
Status: Evidence collected; not a product-domain decision

## Runtime composition

`index.ts` eagerly constructs every route module before middleware and mounts
all route groups into the same `/api` application. The current runtime uses the
Mongo Prisma client from `generated/prisma`; `prisma/pats/schema.prisma` is not
imported or mounted.

Public/direct runtime surfaces are:

- `/` and `/health`
- `/health/redis` behind token verification
- development-only `/api/swagger`
- `/api/template*`
- `/api/docs*`
- `/api/auth/*` security middleware, with auth behavior supplied externally

Protected runtime route groups mounted in `index.ts` are:

`project`, `estimation`, `sequential`, `item`, `order`, `vendor`, `payslip`,
`transaction`, `metric`, `category`, `field`, `itemType`, `product`, `demand`,
`milestone`, `usageCode`, `employee`, `workspace`, `purchaseOrder`,
`deliveryOrder`, `invoice`, `paymentTerm`, `poType`, `paymentSchedule`,
`workspaceMember`, and `projectMember`.

## Route/module inventory

| Route group | Registration | Controller/repository | Prisma models | Seeders | Tests | Generated docs | External integrations | Initial evidence class |
|---|---|---|---|---|---|---|---|---|
| `/api/workspace*` | `index.ts` protected mount | `app/workspace/*` | `Workspace` | `workspaceSeeder` | controller and authorization tests | yes | workspace membership and audit/activity helpers | platform candidate |
| `/api/workspace-member*` | `index.ts` protected mount | `app/workspaceMember/*` | `WorkspaceMember` | `workspaceMemberSeeder` | authorization tests | yes | `SSO_BASE_URL` user lookup | platform/security review |
| `/api/project-member*` | `index.ts` protected mount | `app/projectMember/*` | `ProjectMember`, `Workspace` | `projectMemberSeeder` | controller tests | yes | workspace/project authorization | legacy candidate; coupled |
| `/api/project*` | `index.ts` protected mount | `app/project/*` | `Project` and related PMS relations | `projectSeeder` | controller tests | yes | sequential/project helpers | legacy PMS candidate |
| `/api/estimation*` | `index.ts` protected mount | `app/estimation/*` | `Estimation`, `Item`, `Project` | `estimationSeeder` | controller tests | yes | item/status/calculation helpers | legacy PMS candidate |
| `/api/item*` | `index.ts` protected mount | `app/item/*` | `Item`, `Estimation`, `ItemType` | `itemSeeder` | controller tests | yes | file upload and calculation helpers | legacy PMS candidate |
| `/api/order*` | `index.ts` protected mount | `app/order/*` | `Order`, `Vendor`, `Estimation` | `orderSeeder` | controller tests | yes | procurement relations | legacy PMS candidate |
| `/api/vendor*` | `index.ts` protected mount | `app/vendor/*` | `Vendor` | `vendorSeeder` | controller tests | yes | none found | legacy PMS candidate |
| `/api/payslip*` | `index.ts` protected mount | `app/payslip/*` | `Payslip`, `Estimation` | `payslipSeeder` | controller tests | yes | employee/finance relations | legacy PMS candidate |
| `/api/transaction*` | `index.ts` protected mount | `app/transaction/*` | `Transaction`, `Project`, `Vendor` | `transactionSeeder` | controller tests | yes | Cloudinary upload helper, audit/activity | legacy PMS candidate |
| `/api/metric*` | `index.ts` protected mount | `app/metric/*` | financial/project relations | none dedicated | metric tests | yes | calculation/report helpers | legacy PMS candidate |
| `/api/category*` | `index.ts` protected mount | `app/category/*` | `Category` | `categorySeeder` | controller tests | yes | none found | legacy PMS candidate |
| `/api/field*` | `index.ts` protected mount | `app/field/*` | `Field` | `fieldSeeder` | controller tests | yes | dynamic-field helpers | legacy PMS candidate |
| `/api/item-type*` | `index.ts` protected mount | `app/itemType/*` | `ItemType` | `itemTypeSeeder` | controller tests | yes | item/estimation relations | legacy PMS candidate |
| `/api/product*` | `index.ts` protected mount | `app/product/*` | legacy `Product` and production/cost relations | `productSeeder` | controller tests | yes | workspace role authorization | legacy PMS candidate; terminology conflict |
| `/api/demand-plan*` | `index.ts` protected mount | `app/demand/*` | `DemandPlan`, estimate/conversion models | `demandSeeder` | demand tests | yes | project conversion relations | legacy/non-active candidate |
| `/api/milestone*` | `index.ts` protected mount | `app/milestone/*` | `Milestone`, `Project` | `milestoneSeeder` | controller tests | yes | project relations | legacy PMS candidate |
| `/api/usageCode*` | `index.ts` protected mount | `app/usageCode/*` | `UsageCode` | `usageCodeSeeder` | controller tests | yes | none found | legacy PMS candidate |
| `/api/employee*` | `index.ts` protected mount | `app/employee/*` | `Employee` | `employeeSeeder` | controller/service tests | yes | HRIS API configuration | external-integration review |
| `/api/purchase-order*` | `index.ts` protected mount | `app/purchaseOrder/*` | `PurchaseOrder`, `Vendor` | `purchaseOrderSeeder` | controller tests | yes | procurement relations | legacy PMS candidate |
| `/api/delivery-order*` | `index.ts` protected mount | `app/deliveryOrder/*` | `DeliveryOrder`, `PurchaseOrder` | `deliveryOrderSeeder` | controller tests | yes | procurement relations | legacy PMS candidate |
| `/api/invoice*` | `index.ts` protected mount | `app/invoice/*` | `Invoice`, `PurchaseOrder` | `invoiceSeeder` | controller tests | yes | finance/procurement relations | legacy PMS candidate |
| `/api/payment-term*` | `index.ts` protected mount | `app/paymentTerm/*` | `PaymentTerm` | `paymentTermSeeder` | controller tests | yes | procurement relations | legacy PMS candidate |
| `/api/po-type*` | `index.ts` protected mount | `POType` | `POType` | `poTypeSeeder` | controller tests | yes | procurement relations | legacy PMS candidate |
| `/api/payment-schedule*` | `index.ts` protected mount | `app/paymentSchedule/*` | `PaymentSchedule`, `PurchaseOrder` | `paymentScheduleSeeder` | controller tests | yes | procurement relations | legacy PMS candidate |
| `/api/template*` | public mount | `app/template/*` | `Template` | `templateSeeder` | controller tests | yes | none found | public legacy candidate |
| `/api/sequential*` | protected mount | `app/sequential/*` | `Sequential` | `sequentialSeeder` | controller tests | yes | project/document number helpers | legacy PMS candidate |
| `/api/docs*` | public mount | `app/docs/*` | none directly | none | docs/controller tests | generated from current app | OpenAPI/Swagger/Postman generation | platform candidate, needs cleanup |

## Persistence and seed boundary

The live Prisma schema is assembled from `prisma/schema/*.prisma` and uses the
MongoDB provider. It contains the inherited workspace, PMS, procurement,
finance, employee, demand, and product models. The main `prisma/seed.ts`
orchestrator creates workspaces and then seeds all inherited modules across
those workspaces.

The separate `prisma/pats/schema.prisma` uses PostgreSQL and contains a draft
manufacturing model. It has no runtime import, no migration history, and no
PATS production seed. It remains provisional and outside this cleanup.

## Integration inventory

- SSO/user lookup: `SSO_BASE_URL` is used by workspace membership and auth-related code.
- HRIS: employee service/controller contains HRIS API configuration.
- Redis: optional connection, cache middleware, and `/health/redis`.
- Socket.IO: attached to the Express server and exposed to request handlers.
- Cloudinary: transaction document helper, with mock URL behavior in local code.
- Activity/audit logging: outbound `fetch` calls from `utils/activityLogger.ts` and `utils/auditLogger.ts`.
- OpenAPI/Swagger/Postman: generated documentation is derived from route source and `docs/openApiSpecs.ts`.

## Baseline evidence

Validated on 2026-07-13 before cleanup mutation:

- `pnpm run lint`: pass
- `pnpm run type-check`: pass
- `pnpm test`: 344 passing, 29 pending
- `pnpm run build`: pass during the plan/commit hook run
- `PATS_DATABASE_URL=postgresql://pats:pats@localhost:5432/pats npx prisma validate --schema prisma/pats/schema.prisma`: valid when the variable is supplied

The suite emits repeated legacy warnings, including failed audit/activity
logging in mocked contexts, Redis-not-connected warnings, and an estimation
mock warning about missing `prisma.item.findMany`. These warnings are not
failures, but they are evidence that a green legacy suite is not proof of a
healthy or canonical manufacturing API.
