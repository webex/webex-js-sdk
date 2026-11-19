# Implementation Plan — T3: Unit tests and the sample-app V2 UI

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This plan builds its task [`task-t3.md`](./task-t3.md) under epic [`epic.md`](./epic.md); design is [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: the full test inventory is in [`test-strategy.md`](../../test-strategy.md).

## Task Context
| Field | Value |
|---|---|
| Task | [`./task-t3.md`](./task-t3.md) |
| Parent epic / feature | [`./epic.md`](./epic.md) · [`../../design/feature-design.md`](../../design/feature-design.md) |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` tests; `docs/samples/contact-center` |
| Execution stream / wave | wave 3 |
| created_by / date | SDD intake / 2026-09-21, revised 2026-11-19 |
| Generated from | `implementation-plan` @ SDLC template library `0.2.0` |

## Current Context (code-grounded)
- Unit tests use Jest with ts-jest. `test/unit/spec/cc.ts` drives `ContactCenter` through `webex.cc['handleWebsocketMessage']` and mocks `services.agent`. Evidence: `test/unit/spec/cc.ts`.
- The agent builder tests mock `AqmReqs.req` / `reqEmpty` to return the config factory, so a test can read `url`, `method`, binds, and `err`. Evidence: `test/unit/spec/services/agent/index.ts`.
- The sample is plain JS and HTML using `webex.cc` events. Evidence: `docs/samples/contact-center/app.js`.

## Proposed Approach & Sequencing
1. `aggregate.ts` suite (25): bridgeable states, projection, primary-channel aux code, duplicate and idle-code re-emit.
2. Builder tests for the four V2 builders; the profile flag mapping (`it.each`); the barrel list.
3. `cc.ts`: add `stateChangeV2` to the agent mock, then the `V2 granular agent state` block:
   - handlers, cleanup, getters, the timer, and seeding;
   - `setAgentState on a V2 session` (5) and `silentRelogin V2 recovery` (2).
4. `cc.ts`: tests for login without fallback, the flag re-read, logout routing, the early pin, and the server-wins pin and routing cases.
5. Sample:
   - render the V2 panel when `getAgentStateControl().active`;
   - per-channel controls through `setAgentState({channelType})`;
   - the mismatch banner when `declared !== active`;
   - tear down on multi-login close and remote logout.

## Backward-Compat / Rollback
- **Compatibility:** existing tests unmodified apart from the new mock and the barrel list.
- **Consumer transition / deprecation:** N/A.
- **Rollback:** revert tests with the code.

## Logs / Metrics / Alerting
- N/A. The sample's V2 listeners use the sample's existing `console` style; no new SDK logs.

## Implementation Caveats
- Fixtures for a successful `setAgentState` need `agentConfig.teams` (the metrics read `teams[0]`).
- Jest can leave open handles; run with `--forceExit` locally.
- `-t` filters still load the whole `cc.ts` file (about 215 tests).

## Anticipated PR Split
| PR | Scope (one logical concern) | Depends on |
|---|---|---|
| Single feature PR | T1 to T4 together (epic decision) | — |

## Manual Validation
- [ ] Sample: V1 agent sees the classic state selector; V2 agent sees per-channel controls.
- [ ] Sample: profile flag changed after login → banner on the next refresh until logout and login.

## AI Docs Impact

### webex/webex-js-sdk — `@webex/contact-center`
| Field | Value |
|---|---|
| Manifest | `packages/@webex/contact-center/.sdd/manifest.json` |
| Standing docs root | `packages/@webex/contact-center/docs/`; module specs at `src/**/docs/README.md` |

| Doc / source | Decision (required / not required / blocked) | Reason / trigger | Required update or no-impact reason |
|---|---|---|---|
| Touched module spec(s) | required | Test evidence for new requirements | Verification and test-evidence columns in `src/docs/README.md`, `src/services/agent/docs/README.md`, `src/services/config/docs/README.md` |
| Router (`docs/specs/README.md`) | not required | No routing change | — |
| Contract index and `contract_catalog` | not required | Tests only | — |
| Native schema/API source | not required | Barrel list already matches `src/index.ts` | — |
| SERVICE_STATE / DATA_MODEL / SECURITY / GLOSSARY | not required | Not present or not affected | — |
| ARCHITECTURE / RULES | not required | No change | — |
| README / public API / help / release docs | required | Sample behavior | [Sample feature spec](../../../../../../../../docs/samples/contact-center/ai-docs/features/WXCC-15791-granular-agent-state-sample/spec/feature-spec.md) |

## Documentation Updates
### webex/webex-js-sdk
- [`test-strategy.md`](../../test-strategy.md) inventory and counts.
- Module spec verification sections.
- Sample feature spec.

## References
- Task: [`./task-t3.md`](./task-t3.md) · Epic: [`./epic.md`](./epic.md) · Feature design: [`../../design/feature-design.md`](../../design/feature-design.md)
