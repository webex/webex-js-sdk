# Implementation Plan — T3: Unit Tests & Sample Panel

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Plan for [`task-t3.md`](./task-t3.md) under [`epic.md`](./epic.md).

## Task Context
Prove the V2 behavior with unit tests and provide a reference sample panel; remove obsolete per-helper specs left over from the pre-fold design.

## Current Context (code-grounded)
- `test/unit/spec/services/agent/aggregate.ts` covers the bridge.
- `test/unit/spec/cc.ts` covers plugin behavior.
- Obsolete specs for the removed `version`/`channels`/`recovery`/`routing-eligibility` modules were deleted.

## Proposed Approach & Sequencing
1. Keep/trim `aggregate.ts` spec to the shipped surface (24 tests).
2. Extend `cc.ts` spec for V2 routing, pinning, fallback, recovery, getters, events (156 tests).
3. Build the sample `app.js` panel; refresh on the `stationLogin()` promise (post-pin), relogin, and logout.

## Build / CI / Deployment Impact
Runs under existing Jest config; package 85% coverage gate must hold.

## Backward-Compat / Rollback
Test-only + sample-only; no production impact.

## Implementation Caveats
`cc.ts` spec is slow under full coverage; run focused when iterating.

## Manual Validation
`yarn workspace @webex/contact-center test:unit` green; sample panel exercises every V2 API.

## AI Docs Impact
Update [`../../test-strategy.md`](../../test-strategy.md) status line.

## References
- [`task-t3.md`](./task-t3.md) · [`../../test-strategy.md`](../../test-strategy.md)

## Logs and Metrics

- No production log/metric changes (test-only task).
- Verify that V2 log statements from T2 (`isV2Eligible`, `assertChannelsSelectable`, recovery) are exercised in test assertions.
- Sample panel logs V2 API calls and state changes to the browser console for debugging.

## PR Split Strategy

- `aggregate.ts` unit tests (24 tests) can land as an independent commit.
- `cc.ts` V2 test extensions (156 tests) land as a second commit after T2 merges.
- Sample panel (`index.html` + `app.js`) can be a separate, lightweight review commit.

## Documentation Updates

- Update [`../../test-strategy.md`](../../test-strategy.md) status line to reflect merged test coverage.
- Document the sample panel usage in `docs/samples/contact-center/README.md` if present.
