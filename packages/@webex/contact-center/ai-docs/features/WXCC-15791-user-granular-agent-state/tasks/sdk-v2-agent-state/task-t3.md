# Task — T3: Unit tests and the sample-app V2 UI

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This task sits under its epic [`epic.md`](./epic.md) ↔ its plan [`implementation-plan-t3.md`](./implementation-plan-t3.md); it implements part of [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: the test inventory lives in [`test-strategy.md`](../../test-strategy.md); the sample UI lives in the sample spec.

## Metadata
| Field | Value |
|---|---|
| Task title | Unit tests and the sample-app V2 UI |
| Parent epic | [`./epic.md`](./epic.md) |
| Parent feature | [`../../design/feature-design.md`](../../design/feature-design.md) (and [`../../spec/feature-spec.md`](../../spec/feature-spec.md)) |
| Task type | validation |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` tests; `docs/samples/contact-center` |
| Tracker key | [WXCC-15791](https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-15791) |
| State | ready_for_merge |
| created_by / approved_by / date | SDD intake / pending / 2026-09-21, revised 2026-11-19 |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements: Test Strategy (unit tier for T1 and T2) and UX Design & Traceability (the sample app, [sample spec](../../../../../../../../docs/samples/contact-center/ai-docs/features/WXCC-15791-granular-agent-state-sample/spec/feature-spec.md)).

## Primary Code Touchpoints
- `test/unit/spec/services/agent/aggregate.ts` (new, 25 tests).
- `test/unit/spec/services/agent/index.ts`: `reloadV2`, `stationLoginV2`, `stateChangeV2`, `logoutV2`.
- `test/unit/spec/services/config/Util.ts`: `maps manageChannelAvailability %s to %s`.
- `test/unit/spec/cc.ts`:
  - the `V2 granular agent state` block (38 tests);
  - the `stationLogin` no-fallback tests, `profile flag refresh before login`, and `stationLogout` routing;
  - the early-pin cases and the `session version pin (server wins)` pin and routing cases;
  - the `stateChangeV2` agent mock.
- `docs/samples/contact-center/app.js`, `index.html`: V2 agent-state panel, per-channel controls, the mismatch banner, multi-login teardown, session status messages, and V2 failure feedback. The V1 dropdown is unchanged from `next`.

## Ownership Boundary
- Owns: the test files and blocks above; the sample V2 panel and mismatch banner.
- Must NOT touch (owned by another task):
  - `src/**` → T1, T2, T4;
  - the lifecycle tests (`handleConnectionLost`, `setupEventListeners()`, the session-not-found cases, own-session logout) and the sample session-status alert → T4.

## Multi-Repo Scope
N/A — single target repo (`webex/webex-js-sdk`; the sample is in the same repo outside the package).

## Dependencies / Execution Stream
| This task | Depends on (blocked-by) | Parallel-safe with | Wave / stream |
|---|---|---|---|
| T3 | T1, T2 | T4 | 3 |

## Acceptance Criteria
- [x] Every T1 and T2 requirement in the feature spec has a positive and a negative test, or a documented "no guard by design".
- [x] Sample shows per-channel state and controls only when `getAgentStateControl().active` is `true`, and shows the mismatch banner when `declared !== active`.

## Verifier Exit Criteria
- [x] `npx jest test/unit/spec/cc.ts test/unit/spec/services/agent/aggregate.ts test/unit/spec/services/agent/index.ts test/unit/spec/services/config/Util.ts --coverage=false` passes (278 tests).
- [x] `node --check docs/samples/contact-center/app.js` passes.
- [ ] Package 85% gate re-measured in CI.

## Traceability
| Requirement / rule id | Code symbol (class.method / file) | Test that proves it |
|---|---|---|
| R-1 to R-13 | see [`task-t2.md`](./task-t2.md) | see the Use Cases → Tests table in [`test-strategy.md`](../../test-strategy.md) |
| R-14 | `docs/samples/contact-center/app.js` | manual (sample spec) |

## Coverage Expectation
- Package 85% global gate (`jest.config.js`); evidence: CI coverage report.

## Cross-Cutting Prompts
- **Logging:** N/A — tests and sample only; the sample adds no new console logs.
- **Metrics:** N/A.
- **Security:** N/A.
- **Idempotency:** N/A.
- **Rollout:** sample works with the flag on or off.

## Non-Goals / Out-of-Scope
- Integration or Playwright E2E suites (gap in the test strategy).
- Widget UI.

## References
- Epic: [`./epic.md`](./epic.md) · Implementation plan: [`./implementation-plan-t3.md`](./implementation-plan-t3.md)
- Feature design: [`../../design/feature-design.md`](../../design/feature-design.md) · Coverage/contracts baseline: [`.sdd/manifest.json`](../../../../../.sdd/manifest.json)
