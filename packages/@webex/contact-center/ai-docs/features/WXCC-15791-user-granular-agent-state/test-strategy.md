# Test Strategy — WXCC-15791: Granular Agent State Control V2

> **Navigation:** [AGENTS.md](../../AGENTS.md) → [SPEC_INDEX.md](../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../ARCHITECTURE.md)

> Implements the test plan for [`spec/feature-spec.md`](./spec/feature-spec.md) / [`design/feature-design.md`](./design/feature-design.md).

## Metadata
| Field | Value |
|---|---|
| Feature key | WXCC-15791 |
| Test levels | unit |
| Coverage gate | package 85% global (branches/lines/functions/statements), per `AGENTS.md` |
| Generated from | `test-strategy` @ SDLC template library `0.2.0` |

## References
- Spec: [`spec/feature-spec.md`](./spec/feature-spec.md) · Design: [`design/feature-design.md`](./design/feature-design.md)
- Suites: `test/unit/spec/cc.ts`, `test/unit/spec/services/agent/aggregate.ts`

## Test Config Variables
| Variable | Value |
|---|---|
| Runner | Jest + ts-jest, `NODE_ENV=test` |
| Command | `yarn workspace @webex/contact-center test:unit` |

## Use Cases → Tests
| Requirement | Test | Suite |
|---|---|---|
| R-8 bridge | `projectAggregate` picks the channel whose state equals the projected subStatus; `shouldEmitLegacyEvent` re-emits when the aux code changes | `aggregate.ts` |
| R-9 login fallback | V2 login AQM timeout falls back to V1; a non-timeout V2 error is rethrown | `cc.ts` |
| R-5 channel state change | `handleChannelStateChanged` updates `channelStatesMap`, emits event, invokes bridge | `cc.ts` |
| R-7 channel relogin | `handleChannelReloginSuccess` replaces state maps, pins V2 | `cc.ts` |
| R-13 telephony recovery | `scheduleTelephonyRecovery` defers telephony, callback no-ops after logout | `cc.ts` |
| Session version pinning | `stationLoginSuccess` listener pins V2 or V1 based on `manageChannelAvailability` | `cc.ts` |

## Resiliency Tests
- V2 login timeout → V1 fallback and V1 pin. Covered in `cc.ts`.
- Reconnect reload restores channel and capacity maps and recovers `agent-wss-disconnect` channels. Implemented in `cc.ts`. Not unit-tested.
- No bridgeable channel → no V1 emit. Covered in `aggregate.ts`.

## Coverage Summary
| Area | Target |
|---|---|
| `aggregate.ts` | projection, winning-channel aux code, idle-code re-emit (25 tests) |
| `cc.ts` V2 paths | `handleChannelStateChanged` (8), `handleChannelReloginSuccess` (4), `clearV2LocalState` (4), `scheduleTelephonyRecovery` (6), `seedChannelStates` (4), version-pinning (6), login fallback (2) — ~32 V2-related tests total |
| Package global | 85% gate is unchanged; this change does not claim the gate was re-measured |

`aggregate.ts` and `cc.ts` V2 unit tests pass. Reconnect reload recovery is implemented but not unit-tested. Channel validation (`assertChannelsSelectable`) is implemented but not unit-tested.

## Gaps / Risks
- Backend endpoint/notification confirmation (Q-1) is validated at integration/GA, not in unit tests.
- Cross-channel event ordering is not asserted (not guaranteed by backend).
