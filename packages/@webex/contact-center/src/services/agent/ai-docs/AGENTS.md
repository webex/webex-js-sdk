# Agent Service - AI Agent Guide

> **Legacy/reference-only.** Canonical SDD: [`agent-spec.md`](agent-spec.md). Use the package [manifest](../../../../.sdd/manifest.json) and [`SPEC_INDEX.md`](../../../../ai-docs/SPEC_INDEX.md) for routing; code and tests remain the behavioral referee.

> **Purpose**: Manage agent lifecycle including login, logout, state changes, and buddy agent queries.

## Purpose

Manage agent lifecycle operations such as registration, station login/logout,
state changes, buddy-agent lookup, and silent relogin. AI summary work does not
add agent service APIs; it consumes agent profile feature flags and forwards one
client-level feature event.

## Core Capabilities

- `cc.register()` loads the agent profile and initializes SDK services.
- `cc.stationLogin(...)` and `cc.stationLogout(...)` manage station state.
- `cc.setAgentState(...)` updates agent availability.
- `cc.getBuddyAgents(...)` supports consult and transfer destination lookup.
- Connection re-establishment may perform silent relogin when configured.

## AI Summary Feature Source

Generated-summary organization flags are read from the existing profile path:

`getAgentConfig() -> Profile.aiFeature -> TaskManager.setConfigFlags(...) -> Task.getGeneratedSummaryFlags()`

The SDK uses optional chaining and strict `=== true` checks for:

- `aiFeature.generatedSummaries.wrapUpSummariesEnabled`
- `aiFeature.generatedSummaries.consultTransferSummariesEnabled`

Absent `aiFeature` or absent `generatedSummaries` must not throw during
registration. Existing realtime transcript and suggested-response workflows
continue to operate independently.

## Feature Enablement Event

`AGENT_EVENTS.FEATURE_ENABLEMENT` is emitted to consumers as:

```typescript
cc.on('cc:featureEnablement', (payload) => {
  // payload.interactionId
  // payload.postCallEnabled
  // payload.midCallEnabled
  // payload.actionTimeStamp
});
```

`postCallEnabled` and `midCallEnabled` are independently optional booleans.
Absence remains `undefined`. Consumers may use this event as a discovery signal,
but an unchecked Task request is still safe: it rejects disabled locally without
creating backend work.

`incomingTaskListener()` removes the named feature handler before adding it, so
repeated listener setup remains single-subscribed. Distinct inbound frames,
including identical repeats, are still forwarded once each.

## Lifecycle Cleanup

`ContactCenter.register()`, connection re-establishment, and
`ContactCenter.deregister()` call `TaskManager.clearAISummaryState()` to clear
session-scoped summary state.

The clear happens before applying a new profile on register/reconnect and in a
`finally` block during deregister, so earlier teardown failure cannot skip AI
summary cleanup. Full cleanup:

- marks inbound summary handling inactive
- rejects live summary request Promises with `AI_SUMMARY_REQUEST_CANCELLED`
- clears pending request timers, receiver buffers, feature snapshots, and their
  timers
- makes queued classified summary frames metadata-only `sdk-deregistered` drops

The next `setConfigFlags(...)` call reactivates summary handling for the new
session.

## Privacy

Agent-facing AI summary lifecycle logs and metrics may include bounded event
names, validation outcomes, boolean enablement values, and safe identifiers.
They must not include summary text, section keys or values, Adaptive Card
bodies, agent names, raw payloads, or arbitrary exception text.

## Validation

Focused lifecycle evidence lives in:

```bash
yarn workspace @webex/contact-center test:unit --targets cc.ts
```

## Agent Lifecycle Quick Start

AI-summary support extends the existing agent service; it does not replace its login, state, or
buddy-agent responsibilities.

```typescript
const cc = webex.cc;
const profile = await cc.register();
await cc.stationLogin({teamId: profile.teams[0].teamId, loginOption: 'BROWSER'});
await cc.setAgentState({state: 'Available', auxCodeId: '0'});
const buddies = await cc.getBuddyAgents({state: 'Available', mediaType: 'telephony'});
```

### Login options

| Option | Description | Dial number |
| --- | --- | --- |
| `BROWSER` | WebRTC softphone in the browser | Not required |
| `EXTENSION` | Desk-phone extension | Required |
| `AGENT_DN` | Direct agent dial number | Required |

### Existing public methods

| Method | Purpose | Important inputs | Result |
| --- | --- | --- | --- |
| `cc.stationLogin(params)` | Log the agent into a station | `teamId`, `loginOption`, and `dialNumber` when required | `Promise<StationLoginResponse>` |
| `cc.stationLogout(params)` | Log the agent out of the station | Optional `logoutReason` | `Promise<StationLogoutResponse>` |
| `cc.setAgentState(params)` | Change between Available, Idle, or backend-defined states | `state`, `auxCodeId`, optional reason/agent ID | `Promise<SetStateResponse>` |
| `cc.getBuddyAgents(params)` | Find agents for consult or transfer | Optional state and required media type | `Promise<BuddyAgentsResponse>` |

`cc.register()` must finish before station operations. Browser login also requires the Mercury and
Web Calling setup performed by `ContactCenter`.

## Existing Agent Events

| Event | Meaning |
| --- | --- |
| `agent:stationLoginSuccess` / `agent:stationLoginFailed` | Station-login outcome |
| `agent:logoutSuccess` / `agent:logoutFailed` | Station-logout outcome |
| `agent:stateChange` | State update received from any supported source |
| `agent:stateChangeSuccess` / `agent:stateChangeFailed` | Requested state-change outcome |
| `agent:multiLogin` | Another active agent session was detected |
| `agent:reloginSuccess` | Silent relogin completed |
| `agent:dnRegistered` | Dial-number registration completed |
| `cc:featureEnablement` | Valid AI-summary feature flags were received |

Consumers should treat `AgentState` as extensible. Known values include Available, Idle, RONA, and
LoggedOut, but organizations can expose additional backend-defined values through auxiliary codes.

## Existing Error Guidance

Agent operations reject with structured errors. Preserve `error.data` when presenting field-level
login failures, and handle unknown error shapes without assuming every failure is an `Error` object.

| Reason | Meaning |
| --- | --- |
| `DUPLICATE_LOCATION` | The extension or dial number is already in use |
| `INVALID_DIAL_NUMBER` | The submitted dial number failed validation |
| `AGENT_NOT_FOUND` | The agent no longer exists; silent relogin handles this specially |

## Dependencies And Related Files

- `cc.register()` and the agent profile are prerequisites for station login.
- Browser login depends on the Mercury connection and Web Calling registration.
- `../index.ts` defines the routing-agent request factory.
- `../types.ts` owns agent payloads and event constants.
- `../../../cc.ts` owns the public methods, lifecycle, and event forwarding.
- [ARCHITECTURE.md](ARCHITECTURE.md) describes the request and reconnection flows.
