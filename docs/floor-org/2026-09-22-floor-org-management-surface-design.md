# Stations Management Surface Design

**Status:** DESIGN — FOR REVIEW

**Date:** 2026-09-22

**Scope:** The "Stations" tab in the Configuration UI. A management surface for the station tree: Section → Process → Sub-process. Admins can view and edit the tree structure and line counts. No people, no leaders, no operators — those are on a different screen.

**Status:** STABLE — FROZEN. Design and API contract are locked. Stage stack realignment is a separate effort (see `2026-09-22-stage-stack-realignment-evidence.md`).

---

## 1. What this surface does

Shows and edits the station configuration tree. That's it.

## 2. The tree

```
Decoration (Section) — 17 lines total
  Full Spray (Process) — 3 lines
    Manual Spray (Sub-process) — 2 lines
    Drum Spray (Sub-process) — 1 line
  Line Spray (Mask) (Process) — 8 lines → SB-2A
  Tampo (Process) — 5 lines → SB-2B
  Mimaki (Process) — 1 line → SB-3-5
```

### 2.1 What each item is

| What you see | What it is | How it's stored |
|---|---|---|
| Decoration, Injection, Assembly | **Section** | `Section` table — top container |
| Full Spray, Tampo, Line Spray, Mimaki | **Process** (root) | `WorkProcess` with `parentProcessId = null`, `sectionId` = Section |
| Manual Spray, Drum Spray | **Sub-process** | `WorkProcess` with `parentProcessId` = parent Process |
| 3, 8, 5, 1, 2, 1 | **Line count** | Count of WorkProcess records under each process/sub-process |
| SB-2A, SB-2B, SB-3-5 | **Booth code** | `Booth` table — `boothCode`, `sectionId`, `workProcessId` |

### 2.2 What "lines" means

Lines are individual physical production lines. Each one is a WorkProcess record (or a Sub-process). The number shown next to a process is just how many physical lines run that process. You add them, you count them. No complex computation.

## 3. What admin can do

- **View the tree** — see all sections, their processes, sub-processes, line counts, booth codes
- **Add a process** under a section — new root WorkProcess
- **Add a sub-process** under a process — new child WorkProcess (sets `parentProcessId`)
- **Edit process/sub-process** — rename, reorder, enable/disable
- **Add a line** under a process — new WorkProcess under that process/sub-process
- **Register a booth** — assign SB code to a process on a section
- **Remove any of the above**

## 4. API surface

### 4.1 Reads — reuse existing endpoints

| UI needs | Endpoint | Status |
|---|---|---|
| List sections | `GET /api/v1/sections` | Exists |
| Get section detail | `GET /api/v1/sections/{sectionId}` | Exists |
| List processes under section | `GET /api/v1/sections/{sectionId}/processes` | Exists (PUT for order) |
| Get process detail | `GET /api/v1/work-processes/{processId}` | Exists |
| List sub-processes | Children of a WorkProcess via `parentProcessId` | Needs endpoint |
| List booths under section | `GET /api/v1/booths?section_id={id}` | Needs endpoint |

### 4.2 Edits

| What | Endpoint | Method |
|---|---|---|
| Create process under section | `/api/v1/sections/{sectionId}/processes` | POST |
| Create sub-process under process | `/api/v1/work-processes/{processId}/sub-processes` | POST |
| Edit process/sub-process name, order, enable | `/api/v1/work-processes/{processId}` | PATCH |
| Add line (WorkProcess) under process | `/api/v1/work-processes/{processId}/lines` | POST |
| Register booth | `/api/v1/sections/{sectionId}/booths` | POST |
| Remove booth | `/api/v1/sections/{sectionId}/booths/{boothId}` | DELETE |
| Reorder processes | `/api/v1/sections/{sectionId}/processes` | PUT (existing) |

### 4.3 All endpoints require `operations.manage` capability and deployment-scoped object checks. Standard RFC 9457 errors, ETags, idempotency for creates.

## 5. No new entities (unless needed)

All data uses existing Prisma models:
- `Section` — already exists
- `WorkProcess` — already exists (processes and sub-processes via `parentProcessId`)
- `Booth` — already exists

No new tables. No new Prisma models.

The only new endpoints are for managing relationships that already exist in the schema but don't have dedicated API routes yet (sub-processes listing, booths under section, etc.).

## 6. Per-slice gates

| Layer | What | Status |
|---|---|---|
| tsc | New endpoint handlers, PATCH WorkProcess types, booth query types | DESIGN PHASE |
| eslint | Match existing patterns | DESIGN PHASE |
| vitest | Tree reads, process create/edit, sub-process create, booth register, line add, order reorder | DESIGN PHASE |
| audit | Actor on mutations, resource IDs, UTC, trace, outbox on writes | DESIGN PHASE |

## 7. Open questions (3)

| ID | Question |
|---|---|
| OS-001 | When "Line Spray has 8 lines" — are these 8 separate WorkProcess records, or something else? (Answer: just count the records. This is a backend implementation detail.) |
| OS-003 | Booth SB-2A — is it one Booth record shared by 8 lines, or 8 Booth records? (Answer from user: it's a physical station, one or many per process.) |
| OS-005 | Can admin change a Process ↔ Sub-process relationship (move a sub-process to a different parent)? Or only add/remove? |

## 8. Constraints

- No schema changes until review approved
- No code changes until review approved
- No people in this surface
- Reuse existing endpoints where possible
- Simple — if it doesn't fit the tree, it doesn't belong here
