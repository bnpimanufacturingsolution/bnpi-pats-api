# Task 2 Implementation Report: Canonical Transport Primitives

## Status and classification

Completed. This was a meaningful feature delivered by an AI agent: independently testable
canonical transport primitives only. No route, application composition, persistence, schema,
generated artifact, seed, deployment, or frontend surface changed.

## Implementation

- `app/canonical/collection.ts` adds strict offset and cursor pagination parsing, a codec-only
  opaque cursor boundary, exact offset/cursor envelopes, and documented snake_case sorting with
  an immutable `id` tie-breaker.
- `app/canonical/preconditions.ts` creates quoted strong ETags from safe opaque tokens and
  evaluates exact strong `If-Match` values or the allowed HTTP wildcard. Missing, weak, stale,
  unquoted, and comma-separated validators return the stable 412 precondition problem.
- `app/canonical/idempotency.ts` defines an injected `IdempotencyStore` reservation/persistence
  contract. It scopes reservations by actor and operation (the adapter receives both), compares a
  caller-supplied normalized request hash, replays stored status/body/headers, and returns stable
  400/409 transport results for invalid keys and payload mismatches. It deliberately provides no
  process-local production adapter.
- `tests/canonical-transport-primitives.spec.ts` uses a test-local fake durable-store adapter to
  prove replay, conflict, and actor/operation isolation.

## TDD evidence

### RED

Before implementation:

```text
pnpm exec mocha --require ts-node/register tests/canonical-transport-primitives.spec.ts
```

Result: failed with `Cannot find module '../app/canonical/collection'`, because the Task 2
production modules did not exist.

### GREEN

After implementation:

```text
pnpm exec mocha --no-config --require ts-node/register tests/canonical-transport-primitives.spec.ts
```

Result: **8 passing**. Coverage includes pagination defaults/bounds/mixed parameters, opaque
codec rejection, exact response envelopes, sort validation/tie-breaker, strong ETag/If-Match
rejections, idempotent replay/conflict/scope isolation, and invalid keys.

## Verification

| Command | Result |
| --- | --- |
| Focused Task 2 spec | PASS — 8 passing |
| `pnpm run type-check` | PASS |
| `pnpm run lint` | PASS |
| `pnpm test` | PASS — 392 passing, 29 pending |
| `git diff --check` | PASS |

The full suite retained pre-existing mocked Redis/activity/audit and validation-warning output;
it exited successfully and no Task 2 helper emits application logging.

## Files committed for Task 2

- `app/canonical/collection.ts`
- `app/canonical/preconditions.ts`
- `app/canonical/idempotency.ts`
- `tests/canonical-transport-primitives.spec.ts`
- `.superpowers/sdd/task-2-report.md`

## Self-review

- The Task 1 canonical router and `create-app` were not modified.
- No production in-memory idempotency store was introduced; every execution requires an injected
  adapter, which must provide durable atomic reservation semantics in a future composition.
- Cursors are passed only to an injected codec and never decoded as trusted client state here.
- Collection response constructors return exactly the documented `data` and `pagination` keys.
- Strong ETags are quoted and cannot be formed from quotes, whitespace, or control characters;
  weak/multiple validators never match.
- Only Task 2 source, focused test, and report files are staged/committed. Existing approved
  documentation and SDD scratch changes remain untouched and unstaged.

## Concerns

- The future production adapter must make `reserve` and response persistence durable/atomic in
  the same command transaction; this task intentionally does not select or compose a persistence
  implementation.
- The helper accepts a caller-provided normalized request hash. Endpoint/domain work must define
  canonical payload normalization before invoking it.
- No new recommendations were identified.
