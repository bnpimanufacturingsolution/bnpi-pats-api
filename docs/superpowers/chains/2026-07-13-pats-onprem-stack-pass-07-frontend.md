# Pass 7: Frontend Adapter and On-Prem Verification

## Depends On
Pass 6 read-only PATS catalog contract and passing API/Compose gates.

## Objective
Let the existing prototype consume the read-only catalog contract while preserving demo fallback and protecting the app's pre-existing dirty UI work.

## Scope
- Touch only: explicitly new PATS adapter/test files in the sibling app repository, plus the chain handoff report; do not modify pre-existing dirty app files.
- Do not touch: existing workspace/planning UI changes, WWG truth files already modified in the app, UI copy/hierarchy, API domain files, Prisma schemas, seeds, or deployment settings.

## Instructions
1. Inspect the app working tree and record the pre-existing dirty-file list before editing.
2. Write adapter tests first for complete, sparse, missing-image, API-unavailable, and demo-fallback cases; run them red.
3. Implement the smallest adapter that maps API records to the existing Product/Model/ModelPart view model without deriving identity from initials, display names, or filenames.
4. Run focused adapter tests, Planning/Product route tests, app typecheck, lint, full app tests, and Playwright smoke tests with the API both available and unavailable.
5. Run Docker Compose startup and health checks from the API repository.
6. Review the path list and commit only new adapter/test files; do not stage or rewrite the existing dirty app files.

## Deliverable
The prototype remains usable in demo mode, consumes complete and sparse API catalog records when available, and has verified fallback behavior without committing unrelated UI changes.

## Self-Check Gate (pass-specific)
- [ ] Existing app dirty files are unchanged and unstaged.
- [ ] Adapter tests cover complete, sparse, missing-image, unavailable-API, and demo-fallback behavior.
- [ ] The UI does not depend on initials or seeded display names.
- [ ] Focused/full app verification and API Compose smoke pass.
- [ ] Only new adapter/test files were committed.
- [ ] No scope creep beyond files listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- Existing dirty app files must be modified to make the adapter work.
- The API response needs a UI redesign or terminology decision.
- The API is unavailable and no safe contract fixture exists.
- The adapter would require switching the app's default transport away from demo mode.

