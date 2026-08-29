# QC capability lock (2026-08-26)

**Repository/branch:** `bnpi-pats-api` / `feature/2026-08-26-qc-capability-lock` (from `origin/develop`)
**Type:** meaningful feature (authorization + seed contract)
**Delivery:** AI-agent
**App lock:** Quality Control is admin + quality-capable accounts only. Canonical app refs: `bnpi-pats-app` `.wwg/reports/2026-08-26-floor-visit-screen-design-brief.md` and `.wwg/wiki/project-truth.md` § Floor Visit Intake / Journey D.

## Locks honored

- QC remains Journey D — not a Stage/SubStage/Process; no catalog hops.
- Decide/resolve require `quality.resolve`; lists require `quality.read`.
- Stage scope is `QualityStageAssignment` (`allowedStages`, stage grain), server-enforced, fail-closed.
- API enums stay `PASSED` / `FAILED` / `HOLD`. Floor word "rejected" is app vocabulary only.
- `demo.planner` is a pure planner (planning + read-only monitoring). It does not hold QC capabilities.
- `demo.quality` keeps `quality-reviewer` (`quality.read` + `quality.resolve`) and Decoration + Injection stage scope.
- Administrators keep access: `operations-admin` now includes `quality.read` and `quality.resolve`. Stage rows are still required.

## Endpoint audit

Existing enforcement was already in place:

| Endpoint | Capability | Stage scope |
| --- | --- | --- |
| `GET /api/v1/quality-inspections` | `quality.read` | empty `allowedStages` → `[]` (no leak) |
| `GET /api/v1/quality-inspections/resolve` | `quality.resolve` | gate stage not in allow-list → 403 `not-allowed-stage` |
| `POST /api/v1/quality-inspections` | `quality.resolve` | `assertQualityStageAllowed` |
| `POST /api/v1/quality-inspections/{id}/decisions` | `quality.resolve` | `assertQualityStageAllowed` |

Gaps closed in this pass: planner deny on list/decide, `quality.read` without resolve, `operations-admin` allow, resolve/decide fail-closed with zero stage rows, capabilities projection for planner vs quality vs operations-admin, OpenAPI for scan resolve.

### Endpoint review checklist (changed surfaces)

- Contract identity: `CANONICAL`; `/api/v1`; plural kebab-case. Resolve is a collection subresource with `code` query (existing pattern; not a verb path). **PASS**
- Relationships/collections: resolve uses `snake_case` query `code`; list remains `data` envelope. **PASS**
- HTTP semantics: GET resolve/list; POST create/decide with 201. Errors are RFC 9457, not 2xx. **PASS**
- Security: capability + object-level `allowedStages`; fail-closed. **PASS**
- Concurrency: decide still requires `If-Match` / idempotency. **N/A** for this auth-only change
- OpenAPI: `docs/openapi/2026-07-31-pats-api-v1-domain-reads.yaml` now documents resolve. **PASS**
- Exception: none.

## Seed

- `demo.planner` role bundles: `["planner"]` only. Re-seed **revokes** leftover fat ROLE_BUNDLE / extra CAPABILITY rows (status `REVOKED`, no `deleteMany`).
- Planner `QualityStageAssignment` rows are revoked on re-seed.
- `demo.quality` unchanged: `quality-reviewer` + Decoration + Injection.
- `demo.admin` still holds `operations-admin` (now quality-capable) plus the existing fat bootstrap bundles, and all catalog stage rows.

## Capabilities endpoint

`GET /api/v1/users/me/capabilities` is the app landing input.

| Account | Expected |
| --- | --- |
| `demo.planner` | `planning.read`, `planning.manage`, `material-requirement.manage`, `monitoring.read` — no `quality.*` |
| `demo.quality` | `quality.read`, `quality.resolve`, `reconciliation.resolve` |
| `operations-admin` | includes `quality.read` and `quality.resolve` |

## Remaining risks

- Re-seed is required on existing demo DBs; leftover fat planner bundles stay active until seed runs the new revoke path.
- `operations-admin` without `QualityStageAssignment` rows can see QC as a capability but still 403 on resolve/decide (fail-closed). `demo.admin` is seeded with all catalog stages.
- Slimming `demo.planner` removes `catalog.read` / `execution.read` / `quality.read` from that account. App e2e that still treats fat `demo.planner` as a walk-all identity will 403 until those tests switch accounts.
- Generated `docs/generated/swagger.json` is swagger-jsdoc output and was not regenerated in this pass; canonical source is the domain-reads YAML.

## Recommendations

- No new product recommendations. App Project Truth can drop the "do not treat `demo.planner` fat seed as RBAC truth" warning once this API seed is applied.
