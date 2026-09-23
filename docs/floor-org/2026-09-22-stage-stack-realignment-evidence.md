# Stage Stack Realignment Evidence

**Status:** EVIDENCE — FOR REVIEW

**Date:** 2026-09-22

**Scope:** Inventory of Stage/SubStage definitions across `bnpi-pats-api` and `bnpi-pats-app`. The API is stale relative to the app. App is **always canonical** for Stage/SubStage names, membership, and ordering. API must realign seed data + schema to match the app.

**Stable surface:** The Stations management surface (Section → Process → Sub-process tree) is stable and frozen. No changes to its design or API contract. Realignment work is **only** Stage/SubStage seed + schema on the API side.

**Rule:** Every conflict resolves to "API changes to match app." If a conflict exists, the app version is truth. No "NEEDS APP" items — app is canonical.

---

## Q1: Canonical Stage list — exact names, order, keys/IDs

### APP canonical (`app/lib/pats-stage-config.ts:42-79`)

| ID | Name | WorkflowGroup | displayOrder | Extra |
|---|---|---|---|---|
| STG-PROJECTS | "projects" | WFG-MAIN | 1 | — |
| STG-INJECTION | "Injection (Molding)" | WFG-MAIN | 2 | — |
| STG-DECORATION | "Decoration" | WFG-MAIN | 3 | — |
| STG-ASSEMBLY | "Assembly" | WFG-MAIN | 4 | supportsBaseRouteStep: true |
| STG-WAREHOUSE | "Warehouse" | WFG-WAREHOUSE | 1 | — |

### API seed (`scripts/pats-seed.mjs:822-831`)

| ID | Name | displayOrder |
|---|---|---|
| injectionStageId | "Injection" | 1 |
| decorationStageId | "Decoration" | 2 |
| assemblyStageId | "Assembly" | 3 |
| warehouseStageId | "Warehouse" | 4 |

### API model (`prisma/pats/schema.prisma:362-377`)

`Stage`: `id`, `workflowGroupId`, `name`, `nameLocalized`, `displayOrder`, `isSystemSeed`. No `supportsBaseRouteStep`.

### Conflicts (API must change to match app)

| # | Conflict | Severity | API action |
|---|---|---|---|
| C1 | App has **5 stages**, API seeds **4**. App has `STG-PROJECTS` ("projects") — API seed has none | HIGH | Add "projects" stage to API seed |
| C2 | App name "Injection (Molding)" vs API "Injection" | MEDIUM | Rename API seed "Injection" → "Injection (Molding)" |
| C3 | App has `supportsBaseRouteStep` on STG-ASSEMBLY — API Stage model has no such field | HIGH | Add `supportsBaseRouteStep` to Stage model + seed |
| C4 | App STG-WAREHOUSE under WFG-WAREHOUSE; API seed warehouseStageId workflowGroup unclear | MEDIUM | Ensure warehouseStageId has workflowGroupId: WFG-WAREHOUSE |
| C5 | App displayOrder for STG-WAREHOUSE is 1 (per WorkflowGroup); API has it 4 (global) | MEDIUM | Change API warehouse displayOrder to 1 |

### API endpoints that manage Stages

- `POST /api/v1/stages` (`command-router.ts:1049`) — requires `operations.manage`. Body: `workflowGroupId`, `name`, `displayOrder`, `isSystemSeed`
- `GET /api/v1/stages` (`domain-read.ts:455`) — includes `workflowGroup`, `subStageLinks`

---

## Q2: Sub-stage list per Stage — exact names, parent mapping

### APP canonical (`app/lib/pats-stage-config.ts:81-211`)

**Decoration** (STG-DECORATION):

| ID | Name | displayOrder |
|---|---|---|
| SUB-FULL-SPRAY | "Full Spray" | 1 |
| SUB-MASK-SPRAY | "Line Spray (Mask)" | 2 |
| SUB-TAMPO | "Tampo" | 3 |

**Assembly** (STG-ASSEMBLY):

| ID | Name | displayOrder |
|---|---|---|
| SUB-SUB-ASSEMBLY | "Sub-Assembly" | 1 |
| SUB-CAPSULATION | "Capsulation" | 2 |
| SUB-ASSORTMENT | "Assortment" | 3 |

**Warehouse** (STG-WAREHOUSE):

| ID | Name | displayOrder |
|---|---|---|
| SUB-SEALING | "Sealing" | 1 |
| SUB-MAIN-PACKING | "Main Packing" | 5 |
| SUB-PALLETIZING | "Palletizing" | 6 |

### API seed (`scripts/pats-seed.mjs:884-896, 919-937`)

**Injection** (injectionStageId):

| ID | Name | SubStageEligibility |
|---|---|---|
| subInjectionMoldingId | "Molding" | Injection |

**Decoration** (decorationStageId):

| ID | Name | SubStageEligibility |
|---|---|---|
| subFullSprayId | "Full Spray" | Decoration |
| subLineSprayId | "Line Spray (Mask)" | Decoration |
| subTampoId | "Tampo" | Decoration |
| subMimakiId | "Mimaki" | Decoration |

**Assembly** (assemblyStageId):

| ID | Name | SubStageEligibility |
|---|---|---|
| subAssemblyStagingId | "Assembly Staging" | Assembly |
| subSubAssemblyId | "Sub Assembly" | Assembly |
| subMainAssemblyId | "Main Assembly" | Assembly |
| subCapsulationId | "Capsulation" | Assembly |
| subAssortmentId | "Assortment" | Assembly |

**Warehouse** (warehouseStageId):

| ID | Name | SubStageEligibility |
|---|---|---|
| subMainPackingId | "Main Packing" | Warehouse |

### Conflicts (API must change to match app)

| # | Conflict | Severity | API action |
|---|---|---|---|
| C6 | API has "Mimaki" under Decoration; App does NOT | MEDIUM | Remove "Mimaki" from API seed |
| C7 | API has "Molding" under Injection as SubStage; App has "Molding" as a WorkProcess (SEED_PROCESSES line 40) not a SubStage | HIGH | Remove "Molding" SubStage from API seed |
| C8 | API has "Assembly Staging" as SubStage; App has "Staging" as a WorkProcess under Sub-Assembly — not a SubStage | MEDIUM | Remove "Assembly Staging" from API seed |
| C9 | API has "Main Assembly" as SubStage; App has no such SubStage (Assembly is base state via supportsBaseRouteStep) | HIGH | Remove "Main Assembly" from API seed |
| C10 | App has "Sealing" + "Palletizing" under Warehouse; API seed has neither | HIGH | Add SUB-SEALING + SUB-PALLETIZING to API seed |
| C11 | API has "Sub Assembly" + "Main Assembly" under Assembly; App has only "Sub-Assembly" (hyphenated) | HIGH | Rename "Sub Assembly" → "Sub-Assembly"; Remove "Main Assembly" |
| C12 | App Capsulation/Assortment eligible under STG-ASSEMBLY + STG-WAREHOUSE; API SubStageEligibility has same mapping | ✅ MATCH | None |
| C13 | App displayOrder for Warehouse sub-stages: Sealing=1, Main Packing=5, Palletizing=6. API: Main Packing=1 | MEDIUM | Fix displayOrder: Sealing=1, Main Packing=5, Palletizing=6 |

### Note on API SubStage model (`prisma/pats/schema.prisma:379-396`)

API SubStage has: `id`, `name`, `nameLocalized`, `displayOrder`, `isSystemSeed`, `isConfigurable`, `isBuffer`, `hasQualityCheckpoint`, `isMandatoryCheckpoint`, `alwaysAlertOnRoutingViolation`, `subProcessGroup`, `isDisabled`. Eligibility via `SubStageEligibility` join table (no direct FK — multi-stage eligible).

All these fields match the App's SubStage interface (`app/types/pats/sub-stage.ts:16-27`). Field parity is good — the issue is only seed data values.

---

## Q3: Section → Stage → SubStage → Process → Booth hierarchy

### Conceptual mapping

| Layer | APP entity | API entity | Link |
|---|---|---|---|
| Stage | `Stage` (STG-*) | `Stage` (id, name) | Stage ID shared |
| Section | `Section` (sectionId, stageId) | `Section` (id, stageId, sectionCode) | Section.stageId → Stage.id |
| SubStage | `SubStage` (subStageId, eligibleStageIds[]) | `SubStage` (id) + `SubStageEligibility` (stageId, subStageId) | Eligibility join |
| Process | `WorkProcess` (id, parentProcessId, sectionId) | `WorkProcess` (id, subStageId, sectionId, parentProcessId) | parentProcessId for tree; subStageId → SubStage.id |
| Booth | Not in Station type directly | `Booth` (id, boothCode, sectionId, stageId, subStageId, workProcessId) | Booth.sectionId → Section.id; Booth.workProcessId → WorkProcess.id |

### Conflicts

| # | Conflict | Severity | API action |
|---|---|---|---|
| C14 | API Booth has `stageId` and `subStageId`; App Station type has no Booth concept | MEDIUM | No action needed for Stations surface (stable). Booth fields are for other surfaces |
| C15 | App `WorkProcess` type (`work-process.ts:1-7`) missing `subStageId`; API WorkProcess has it | MEDIUM | No action — app reads subStageId from Section.boundSteps, not from WorkProcess list. Verify this is intentional |
| C16 | App SEED_PROCESSES assigns processes to sections by name pattern; API assigns by sectionId + subStageId explicitly | MEDIUM | No action — app's LineSetupEditor uses SEED_SECTIONS/SEED_PROCESSES locally, not from API |

### Key finding: App WorkProcess type is MISSING subStageId

`app/types/pats/work-process.ts:1-7` — no `subStageId`. But API GET /work-processes returns it (`domain-read.ts:899-906`). The app's line-setup-editor reads `parentProcessId` and `sectionId` from processes but does NOT read `subStageId`. SubStage context comes from Section's boundSteps instead.

This is intentional for the stable Stations surface — no change needed.

---

## Q4: App types/fixtures with no API counterpart

| # | App concept | Where | API counterpart | Status | API action |
|---|---|---|---|---|---|
| C18 | `supportsBaseRouteStep` on Stage | `app/lib/pats-stage-config.ts:71` | API Stage model has no such field | NO COUNTERPART | Add field to schema + seed |
| C19 | `subProcessGroup: "packaging"` on SubStage | `app/lib/pats-stage-config.ts:154,167,183,196,209` | API SubStage model has `subProcessGroup` column (`schema.prisma:390`) | EXISTS BUT NOT SEEDED | Add to API seed |
| C20 | `STG-CUSTOM-*` / `SUB-CUSTOM-*` IDs for admin-added stages | `app/stores/line-admin-store.ts:97,116` | POST /stages and POST /sub-stages exist but don't generate custom IDs | PARTIAL | Server assigns IDs; app uses client-generated as fallback |
| C21 | App uses Section.stageId → StationStepRef{stageId, subStageId} | `app/types/pats/station.ts:18-23` | API StationStep (sectionId, stageId, subStageId) — same triple | ✅ MATCH | None |
| C22 | App terminology: "Station" = Section; "Production Line" = floor work location | `.wwg/wiki/terminology.md:14-24` | API: "Station" = transitional alias for Section | PARTIAL | Migrate Station→Section naming in API responses |
| C23 | App LineSetupEditor uses Section.stageId and WorkProcess.parentProcessId but NOT WorkProcess.subStageId | `app/components/organisms/line-setup-editor.tsx` | API GET /work-processes returns subStageId | GAP (intentional) | No action — stable surface |

---

## Q5: Dead / renamed / transitional API endpoints

### Transitional aliases (app uses canonical names; API has legacy aliases)

| Endpoint/Field | Canonical | Transitional alias | Where | Status |
|---|---|---|---|---|
| `GET /sections` | `GET /sections` | `GET /stations` (same route, array) | `domain-read.ts:479` | ACTIVE ALIAS |
| `GET /sections/:sectionId/history` | `/sections/:sectionId/history` | `/stations/:stationId/history` | `domain-read.ts:526` | ACTIVE ALIAS |
| `GET /booths` filter `section_id` | `section_id` | `station_id`, `stationId` | `domain-read.ts:918-924` | ACTIVE ALIAS |
| Response field `stationId` in Booth | `sectionId` | `stationId` | `domain-read.ts:940-942` | TRANSITIONAL |
| App endpoint config: `STATION_HISTORY: "/sections"` | `/sections` | Named "STATION_HISTORY" | `app/configs/endpoints.ts:34` | NAMING ONLY |
| App route `/:workspaceCode/line/stages/:stageKey` | — | Legacy redirect to desk | `app/routes.ts:82` | LEGACY REDIRECT |

### Missing endpoints needed for Stations surface (stable — but API gap)

**GET /work-processes has no `parentProcessId` filter**
`domain-read.ts:857-911` — only filters by `subStageId` and `search`, NOT by `parentProcessId`. The Stations tree needs to read children of a Process via `parentProcessId`.

**Filed**: NEEDS API — add `parentProcessId` filter to GET /work-processes, OR add GET /work-processes/:processId/children endpoint.

**GET /booths?section_id=X already exists** — design doc listed this as "Needs endpoint" but it already works.
**Filed**: RESOLVED — update design doc to reflect it exists.

---

## API endpoints inventory (for realignment scope)

### Reads (domain-read.ts)

| Endpoint | Status | Notes |
|---|---|---|
| GET /workflow-groups | Exists | Includes stages + subStageLinks |
| GET /stages | Exists | Includes workflowGroup + subStageLinks |
| GET /sub-stages | Exists | Includes eligibleStages |
| GET /sections (=/stations) | Exists | Paginated, search, boundSteps |
| GET /sections/:sectionId/history (=/stations/:stationId/history) | Exists | Station history |
| GET /station-steps | Exists | Section→Stage→SubStage triple |
| GET /work-processes | Exists | Filters: subStageId, search. **NO parentProcessId filter** |
| GET /booths | Exists | Filters: section_id (canonical), station_id, stationId (transitional) |
| GET /work-instructions | Exists | stageId + subStageId + version |

### Writes (command-router.ts)

| Endpoint | Status | Notes |
|---|---|---|
| POST /stages | Exists | Body: workflowGroupId, name, displayOrder, isSystemSeed |
| POST /sub-stages | Exists | Body: name, eligibleStageIds[], displayOrder, flags |
| POST /sections | Exists | Creates bound steps for all eligible sub-stages automatically |
| PATCH /sections/:sectionId | Exists | name, sectionCode |
| PUT /sections/:sectionId/processes | Exists | Replaces process set, reassigns booths |
| POST /work-processes | Exists | subStageId or sectionId required, parentProcessId optional with cycle check |
| PATCH /work-processes/:processId | Exists | name, parentProcessId with cycle check |
| DELETE /work-processes/:processId | Exists | Unassigns descendants |
| POST /station-steps | Exists | sectionId, stageId, subStageId |
| POST /work-instructions | Exists | stageId, subStageId, steps, version |

---

## Summary: Priority realignment actions (all API-side)

### HIGH priority
1. **Add "projects" stage** to API seed (C1)
2. **Add `supportsBaseRouteStep`** to Stage model + seed (C3)
3. **Remove "Molding" SubStage** from Injection in API seed (C7) — app has it as Process
4. **Remove "Main Assembly" SubStage** from API seed (C9)
5. **Add "Sealing" + "Palletizing"** sub-stages to Warehouse seed (C10)
6. **Rename "Sub Assembly" → "Sub-Assembly"** and remove "Main Assembly" (C11)
7. **Add `parentProcessId` filter** to GET /work-processes (tree reads)

### MEDIUM priority
8. Rename API "Injection" → "Injection (Molding)" (C2)
9. Ensure warehouseStageId has WFG-WAREHOUSE (C4)
10. Change warehouse displayOrder to 1 (C5)
11. Remove "Mimaki" from API seed (C6)
12. Remove "Assembly Staging" from API seed (C8)
13. Fix Warehouse sub-stage displayOrders (C13)
14. Add `subProcessGroup` to sub-stage seed records (C19)
15. Migrate Station→Section naming in API responses (C22)

### STABLE — no changes
- Stations management surface design (frozen)
- Section → Process → Sub-process tree contract
- Booth registration for the Stations surface
- WorkProcess.parentProcessId tree mechanism
- Capsulation/Assortment multi-stage eligibility
