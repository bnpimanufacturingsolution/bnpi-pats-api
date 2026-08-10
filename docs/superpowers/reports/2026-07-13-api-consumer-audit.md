# Bandai PATS API Consumer Audit

Date: 2026-07-13  
Repositories: `bnpi-pats-app`, `bnpi-pats-api`  
Status: Evidence collected; not a product-domain decision

## Active frontend route tree

The active app route tree contains:

- authentication pages
- workspace entry, selection, and creation
- the line shell and dedicated line-stage workstations
- the Planning Desk
- product configuration routes
- error pages

There are no active route-tree entries for the inherited PMS project,
estimation, procurement, transaction, finance, employee, vendor, or demand-plan
screens. Planning and product configuration currently use PATS-local types,
local storage, seeded catalog helpers, and local state rather than the sibling
API.

## Consumer classification

| API route group | Frontend caller | Active route path | Demo-only caller | Test-only caller | Current disposition evidence |
|---|---|---|---|---|---|
| `/api/workspace*` | `app/services/workspace-service.ts`, `app/hooks/use-workspaces.ts` | workspace selection, workspace creation, workspace switcher | `app/lib/workspace-demo-api.ts` in demo mode | workspace hook/service tests | active platform candidate; demo fallback remains primary locally |
| `/api/auth*` | `app/services/auth-service.ts`, auth routes | `/auth/login`, `/auth/forgot-password` | local auth fallback and demo bootstrap | auth tests | auth/security review; API is configured as an SSO-style base, not confirmed as the sole live provider |
| `/api/workspace-member*` | no active route/component import found | none | retired demo-request regression tests only | `app/lib/demo-api.workspace-member.test.ts` | no active frontend consumer; keep blocked until external consumer check |
| `/api/project-member*` | no active route/component import found | none | retired demo-request regression tests only | `app/lib/demo-api.project-member.test.ts` | no active frontend consumer; legacy candidate |
| `/api/project*` | dormant `app/services/project-service.ts` only | none in active route tree | legacy demo history/tests | service source and historical tests | no active frontend consumer; legacy candidate |
| `/api/estimation*` | no active route import | none | legacy demo history | legacy controller/service tests | no active frontend consumer; legacy candidate |
| `/api/item*` | dormant `app/services/item-service.ts` only | none | legacy demo history | legacy controller/service tests | no active frontend consumer; legacy candidate |
| `/api/order*` | dormant `app/services/order-service.ts` only | none | legacy demo history | legacy controller/service tests | no active frontend consumer; legacy candidate |
| `/api/vendor*` | no active service consumer | none | retired demo-request regression tests only | vendor retirement test | no active frontend consumer; legacy candidate |
| `/api/payslip*` | dormant `app/services/payslip-service.ts` only | none | legacy demo history | legacy controller tests | no active frontend consumer; legacy candidate |
| `/api/transaction*` | dormant `app/services/transaction-service.ts` only | none | legacy demo history | legacy controller tests | no active frontend consumer; legacy candidate |
| `/api/metric*` | dormant report/dashboard service code | none in active route tree | legacy demo history | metric/controller tests | no active frontend consumer; legacy candidate |
| `/api/category*` | no active service consumer | none | legacy demo history | category controller tests | no active frontend consumer; legacy candidate |
| `/api/field*` | dormant `app/services/field-service.ts` only | none | legacy demo history | field controller tests | no active frontend consumer; legacy candidate |
| `/api/item-type*` | no active service consumer | none | legacy demo history | item type controller tests | no active frontend consumer; legacy candidate |
| `/api/product*` | no live `product-service.ts` consumer found | product UI uses `app/lib/product-catalog.ts` | product demo-request tests | product controller tests | no active API consumer; terminology/model conflict requires review |
| `/api/demand-plan*` | no active route import | none | demand demo-request tests | demand controller tests | no active frontend consumer; legacy candidate |
| `/api/milestone*` | dormant `app/services/milestone-service.ts` only | none | legacy demo history | milestone controller tests | no active frontend consumer; legacy candidate |
| `/api/usageCode*` | dormant `app/services/usage-code-service.ts` only | none | legacy demo history | usage-code controller tests | no active frontend consumer; legacy candidate |
| `/api/employee*` | no active route/component import | none | retired demo-request regression tests only | employee retirement/controller tests | no active frontend consumer; external HRIS review required |
| `/api/purchase-order*` | no active route import | none | legacy demo history | purchase-order controller tests | no active frontend consumer; legacy candidate |
| `/api/delivery-order*` | no active route import | none | legacy demo history | delivery-order controller tests | no active frontend consumer; legacy candidate |
| `/api/invoice*` | no active route import | none | legacy demo history | invoice controller tests | no active frontend consumer; legacy candidate |
| `/api/payment-term*` | no active route import | none | legacy demo history | payment-term controller tests | no active frontend consumer; legacy candidate |
| `/api/po-type*` | no active route import | none | legacy demo history | PO type controller tests | no active frontend consumer; legacy candidate |
| `/api/payment-schedule*` | no active route import | none | legacy demo history | payment-schedule controller tests | no active frontend consumer; legacy candidate |
| `/api/template*` | dormant `app/services/template-service.ts` only | none | legacy demo history | template controller tests | public legacy candidate |
| `/api/sequential*` | no active route import | none | legacy demo history | sequential controller tests | no active frontend consumer; legacy candidate |

## Important evidence distinctions

1. The frontend’s active PATS surfaces do not call the sibling API for their
   product catalog, planning, lot, batch, routing, stage, station, or live-ops
   data. They use local/demo state.
2. `API_ENDPOINTS` still contains many inherited route constants, but constants
   and dormant service files are not active consumers by themselves.
3. `app/lib/demo-api.ts` and `app/lib/workspace-demo-api.ts` are local demo
   transports. Their test coverage does not prove a live sibling API contract.
4. `workspace-service.ts` and `auth-service.ts` are the only clear platform
   adapter candidates. Workspace UI uses demo fallback and local store fallback,
   so the real API consumer boundary remains environment-dependent.
5. Knip reported 93 unused frontend files, including most inherited API service
   adapters. This supports legacy classification but does not replace external
   integration review.

## Audit stop conditions

- Do not retire workspace, workspace-member, auth, SSO, or HRIS code solely from
  frontend inactivity.
- Do not infer PATS API requirements from legacy project/product service names.
- Do not remove demo handlers solely because the sibling API route is unused;
  demo behavior belongs to the frontend prototype boundary.
- Any external consumer not represented in these repositories becomes
  `BLOCKED_REVIEW` in the disposition matrix.
