# Client-Evidence Reconciliation — Pass 5: Consistency Review and Handover

Status: `COMPLETED — IMPLEMENTATION BLOCKED PENDING GATE 0`

Date: 2026-07-15

## Pass completed

Pass 5, Consistency Review and Handover, is complete. The client-evidence reconciliation chain is
documentation-complete with all known conflicts visible and owned. Affected implementation remains
blocked by Gate 0 and explicit user approval; this status is not implementation authorization.

## Consistency matrix

| Chain surface | Result | Evidence/condition |
|---|---|---|
| Evidence authority and scope | `PASS` | Client artifacts are bounded `BUSINESS_EVIDENCE`; source precedence and hashes recorded |
| Bounded contexts and architecture | `PASS` | Catalog owns reusable product/content specs; Planning owns plan snapshots/routes; PMRS boundary remains open |
| Product/model/part/BOM/process/packaging model | `PASS WITH OPEN DECISIONS` | Candidate normalized relations D-030/D-031; Kuririn conflict remains `CONFLICTING` |
| Controlled revision/source lineage | `PASS WITH OPEN DECISIONS` | D-030/D-032; effective revision and identifier crosswalk require owner confirmation |
| Planning/demand/quantity/lifecycle | `PASS WITH OPEN DECISIONS` | D-034/D-035 and D-021 remain open; Asia discrepancy is preserved |
| REST path and contract standard | `PASS` | `/api/v1`, naming, shallow nesting, query/body naming, statuses, RFC 9457, pagination, auth, ETag, idempotency, trace, deprecation |
| REST review checklist/principle | `PASS` | Stale Workspace/tenancy wording revised to server-resolved operational scope |
| Endpoint catalog/authorization | `PASS WITH OPEN DECISIONS` | Candidate parts/BOM/process/packaging/PMRS/demand routes are deferred until ownership and source decisions pass |
| Subject identity mapping | `PASS WITH OPEN DECISIONS` | Internal Subject versus `/users/me` mapping explicit; D-006 provisional scope required |
| Locale/walkthrough state | `PASS WITH OPEN DECISION` | Candidate D-036 gives it a possible normalized home; persistence is not assumed |
| DELETE/404/410 behavior | `PASS` | Retirement/soft-delete returns 404; 410 requires explicit permanent-removal policy; append-only evidence has no ordinary DELETE |
| Cross-cutting/on-prem operations | `PASS` | Audit/outbox, asset privacy, projection freshness, air-gapped behavior, recovery boundaries retained |
| Restartability/handover | `PASS` | AGENTS, original chain/handover, active revision, and client-evidence chain pointers updated |

## What changed

- Reconciled the approved REST principle and checklist with the single-operational-context model.
- Added active-chain pointers to `AGENTS.md`, the original design chain, context, and handover.
- Added D-006 provider-neutral minimum interim scope without selecting a final identity provider.
- Added candidate D-036 for subject locale preference and normalized walkthrough completion state.
- Made `Subject` versus `/users/me` and DELETE/404/410 behavior explicit.
- Added the final client-evidence handover prompt.
- Updated implementation Gate 0 references to include D-030 through D-036.

## Final implementation handover

The first implementation task remains the provider-neutral identity/authorization persistence
slice for `subjects` and deployment-scoped `subject_assignments`, after Gate 0 and explicit user
approval. The client evidence does not authorize schema or endpoint implementation and does not
change the no-Workspace/no-membership first-release boundary.

Before implementation, the user/business owners must confirm or explicitly defer with owner and
review condition:

- D-001/D-029 operational context and future line boundary;
- D-006 minimum provider/issuer/subject mapping scope;
- D-007/D-020 PMRS and issue/Withdrawal Form ownership;
- D-021 quantity/UOM/variance policy;
- D-030 through D-035 controlled revision, normalization, identifier, conflict-release, demand,
  and source-discrepancy decisions;
- D-036 subject preferences/walkthrough persistence;
- all other existing Gate 0 decisions affecting the requested implementation slice.

## Open questions or blockers

The design chain is complete, but implementation remains blocked by the explicit approval gate and
the unresolved decisions above. The Kuririn and Asia conflicts must remain visible until their
owners confirm the source correction or accepted exception.

## Self-check result

| Check | Result |
|---|---|
| All five client-evidence passes executed sequentially | `PASS` |
| Every pass reported with required sections | `PASS` |
| Canonical documents cross-checked | `PASS` |
| Approved REST standard remains mandatory | `PASS` |
| No unresolved item silently promoted | `PASS` |
| No application source, Prisma, migration, generated artifact, seed, deployment, or frontend file changed | `PASS` |
| `git diff --check` | `PASS` |

## Ready for next step

`YES — DOCUMENTATION CHAIN COMPLETE; GATE 0 AND EXPLICIT IMPLEMENTATION APPROVAL STILL REQUIRED.`
