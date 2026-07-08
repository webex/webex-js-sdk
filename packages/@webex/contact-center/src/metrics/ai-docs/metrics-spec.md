# Metrics — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the module's canonical specification.

## Metadata

| Field | Value |
|---|---|
| Module id | `metrics` |
| Source path(s) | `src/metrics` |
| Doc kind | Module spec |
| Coverage score | 100% assessed 2026-07-07; 15/15 mandatory fields present; no applicability gaps |
| Generated from | `module-spec` @ SDLC template library `0.2.1` |
| generated_by / approved_by / updated_at | Codex generator / developer-approved residual warning and coverage completion / 2026-07-07 |
| Validation status | pass; validator claude-code; assessed 2026-07-07; 0 Blocking, 0 warnings; clean independent revalidation complete |

## Evidence Rules
Every requirement cites stable source and test file paths. Code/tests are the behavioral referee; routed source text supplies explicit intent and rationale. Missing or contradictory evidence blocks promotion.

## Source Material Register
| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| Reviewed prior module guides and architecture material | overview / architecture / API / tests | used and code-checked | Content is placed by meaning throughout this specification; exact routing remains in the manifest. |

## Overview
Metrics is one of nine confirmed Contact Center SDK modules. Own timing, taxonomy, queuing, payload preparation, and submission for Contact Center behavioral, operational, and business telemetry. Existing reviewed documentation is migrated by meaning and code/tests remain the behavioral referee.

- **Singleton Pattern**: Single `MetricsManager` instance shared across the entire SDK

- **Three Metric Types**: Behavioral (user actions), operational (system events), business (business-level analytics)

- **Event Timing**: `timeEvent` + `trackEvent` pattern automatically calculates `duration_ms`

- **Queued Submission**: Events are queued until the Webex SDK is ready, then submitted in order

- **Behavioral Taxonomy**: Structured `product.agent.target.verb` naming convention for behavioral events

- **Payload Preparation**: Automatic cleanup of empty fields, space-to-underscore conversion, and `tabHidden` metadata

- **AQM Response Helpers**: Static methods to extract common tracking fields from AQM responses

## Purpose / Responsibility
Own timing, taxonomy, queuing, payload preparation, and submission for Contact Center behavioral, operational, and business telemetry.

## Stack
TypeScript 5.4 singleton service, Webex internal metrics APIs, LoggerProxy, Jest 27.

## Folder / Package Structure
```text
src/metrics/
├── MetricsManager.ts
├── behavioral-events.ts
├── constants.ts
```

```text
src/metrics/
├── MetricsManager.ts       # Singleton metrics manager
├── behavioral-events.ts    # Behavioral event taxonomy mapping
├── constants.ts            # METRIC_EVENT_NAMES constants
└── ai-docs/
    ├── AGENTS.md           # Usage documentation (see PR #4762)
    └── ARCHITECTURE.md     # This file
```

## Key Files (source of truth)
| File | Holds |
|---|---|
| `src/metrics/MetricsManager.ts` | Authoritative Metrics implementation or contract source. |
| `src/metrics/behavioral-events.ts` | Authoritative Metrics implementation or contract source. |
| `src/metrics/constants.ts` | Authoritative Metrics implementation or contract source. |

## Public Surface
| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `metrics.surface` | SDK / event / internal API | Internal `MetricsManager` singleton, metric event constants, taxonomy lookup, timing, and tracking helpers. | Stable module consumption boundary. | Additive changes by default; breaking package exports require a major-version transition. | `src/metrics/MetricsManager.ts` | `../../../ai-docs/CONTRACTS.md` |

Compatibility notes:
- Do not remove or reinterpret exported symbols/events without a documented consumer migration.

Returns the singleton instance. On first call with `{webex}`, binds to the Webex SDK and begins listening for the `ready` event.

**Parameters**:

- `options` (object, optional): `{webex: WebexSDK}` - The Webex SDK instance

**Returns**: `MetricsManager`

**Example**:

```typescript
// During initialization (called internally by cc.register())
const metrics = MetricsManager.getInstance({webex});

// Subsequent calls (no webex needed)
const metrics = MetricsManager.getInstance();
```

Starts a timer for one or more event keys. When a matching `trackEvent` / `trackBehavioralEvent` / `trackOperationalEvent` / `trackBusinessEvent` is called, `duration_ms` is automatically added to the payload.

**Parameters**:

- `keys` (string | string[]): One or more `METRIC_EVENT_NAMES` values. The first key is the tracking key; all keys in the array will resolve the same timer.

**Returns**: `void`

**Example**:

```typescript
// Single key
metrics.timeEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS);

// Multiple keys (success/failure share one timer)
metrics.timeEvent([
  METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
  METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
]);
```

Tracks an event across one or more metric services.

**Parameters**:

- `name` (METRIC_EVENT_NAMES): The event name constant

- `payload` (EventPayload, optional): Key-value pairs of event data

- `metricServices` (MetricsType[], optional): Array of `'behavioral'` | `'operational'` | `'business'` (default: `['behavioral']`)

**Returns**: `void`

**Example**:

```typescript
// Behavioral only (default)
metrics.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS, {agentId: '123'});

// Multiple services
metrics.trackEvent(
  METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
  {interactionId: 'abc'},
  ['behavioral', 'operational']
);
```

Tracks a single behavioral event. Looks up the event taxonomy from `behavioral-events.ts` and submits via `webex.internal.newMetrics.submitBehavioralEvent`.

**Parameters**:

- `name` (METRIC_EVENT_NAMES): The event name

- `options` (EventPayload, optional): Additional payload data

**Returns**: `void`

Tracks a single operational event. Prefixes the event name with `WXCC_SDK_` and submits via `webex.internal.newMetrics.submitOperationalEvent`.

**Parameters**:

- `name` (METRIC_EVENT_NAMES): The event name

- `options` (EventPayload, optional): Additional payload data

**Returns**: `void`

Tracks a single business event. Prefixes the event name with `WXCC_SDK_` and submits via `webex.internal.newMetrics.submitBusinessEvent` with `appType: 'wxcc_sdk'`.

**Parameters**:

- `name` (METRIC_EVENT_NAMES): The event name

- `options` (EventPayload, optional): Additional payload data

**Returns**: `void`

Enables or disables metrics collection. When disabled, all pending events are cleared and new events are dropped.

**Parameters**:

- `disabled` (boolean): `true` to disable, `false` to enable

**Returns**: `void`

Static helper that extracts common tracking fields from an AQM success response.

**Parameters**:

- `response` (any): The AQM response object

**Returns**: `Record<string, any>` with fields: `agentId`, `agentSessionId`, `teamId`, `siteId`, `orgId`, `eventType`, `trackingId`, `notifTrackingId`

**Example**:

```typescript
const fields = MetricsManager.getCommonTrackingFieldForAQMResponse(aqmResponse);
metrics.trackEvent(METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS, {
  ...fields,
  interactionId: task.interactionId,
});
```

Resets the singleton instance. Used for testing only.

**Returns**: `void`

All event names are defined in `METRIC_EVENT_NAMES` (`constants.ts`). Events follow a `<Category> <Action> <Result>` pattern.

| Constant | Value | Description |
|---|---|---|
| `STATION_LOGIN_SUCCESS` | `'Station Login Success'` | Agent station login succeeded |

| Constant | Value | Description |
|---|---|---|
| `STATION_LOGIN_FAILED` | `'Station Login Failed'` | Agent station login failed |

| Constant | Value | Description |
|---|---|---|
| `STATION_LOGOUT_SUCCESS` | `'Station Logout Success'` | Agent station logout succeeded |

| Constant | Value | Description |
|---|---|---|
| `STATION_LOGOUT_FAILED` | `'Station Logout Failed'` | Agent station logout failed |

| Constant | Value | Description |
|---|---|---|
| `STATION_RELOGIN_SUCCESS` | `'Station Relogin Success'` | Silent relogin succeeded |

| Constant | Value | Description |
|---|---|---|
| `STATION_RELOGIN_FAILED` | `'Station Relogin Failed'` | Silent relogin failed |

| Constant | Value | Description |
|---|---|---|
| `AGENT_STATE_CHANGE_SUCCESS` | `'Agent State Change Success'` | State change succeeded |

| Constant | Value | Description |
|---|---|---|
| `AGENT_STATE_CHANGE_FAILED` | `'Agent State Change Failed'` | State change failed |

| Constant | Value | Description |
|---|---|---|
| `FETCH_BUDDY_AGENTS_SUCCESS` | `'Fetch Buddy Agents Success'` | Buddy agents fetch succeeded |

| Constant | Value | Description |
|---|---|---|
| `FETCH_BUDDY_AGENTS_FAILED` | `'Fetch Buddy Agents Failed'` | Buddy agents fetch failed |

| Constant | Value | Description |
|---|---|---|
| `AGENT_RONA` | `'Agent RONA'` | Agent Ring-On-No-Answer triggered |

| Constant | Value | Description |
|---|---|---|
| `AGENT_CONTACT_ASSIGN_FAILED` | `'Agent Contact Assign Failed'` | Contact assignment failed |

| Constant | Value | Description |
|---|---|---|
| `AGENT_INVITE_FAILED` | `'Agent Invite Failed'` | Agent invite failed |

| Constant | Value | Description |
|---|---|---|
| `AGENT_DEVICE_TYPE_UPDATE_SUCCESS` | `'Agent Device Type Update Success'` | Device type update succeeded |

| Constant | Value | Description |
|---|---|---|
| `AGENT_DEVICE_TYPE_UPDATE_FAILED` | `'Agent Device Type Update Failed'` | Device type update failed |

| Constant | Value | Description |
|---|---|---|
| `TASK_ACCEPT_SUCCESS` / `FAILED` | `'Task Accept ...'` | Task accept result |

| Constant | Value | Description |
|---|---|---|
| `TASK_DECLINE_SUCCESS` / `FAILED` | `'Task Decline ...'` | Task decline result |

| Constant | Value | Description |
|---|---|---|
| `TASK_END_SUCCESS` / `FAILED` | `'Task End ...'` | Task end result |

| Constant | Value | Description |
|---|---|---|
| `TASK_WRAPUP_SUCCESS` / `FAILED` | `'Task Wrapup ...'` | Task wrapup result |

| Constant | Value | Description |
|---|---|---|
| `TASK_HOLD_SUCCESS` / `FAILED` | `'Task Hold ...'` | Task hold result |

| Constant | Value | Description |
|---|---|---|
| `TASK_RESUME_SUCCESS` / `FAILED` | `'Task Resume ...'` | Task resume result |

| Constant | Value | Description |
|---|---|---|
| `TASK_CONSULT_START_SUCCESS` / `FAILED` | `'Task Consult Start ...'` | Consult start result |

| Constant | Value | Description |
|---|---|---|
| `TASK_CONSULT_END_SUCCESS` / `FAILED` | `'Task Consult End ...'` | Consult end result |

| Constant | Value | Description |
|---|---|---|
| `TASK_TRANSFER_SUCCESS` / `FAILED` | `'Task Transfer ...'` | Transfer result |

| Constant | Value | Description |
|---|---|---|
| `TASK_PAUSE_RECORDING_SUCCESS` / `FAILED` | `'Task Pause Recording ...'` | Pause recording result |

| Constant | Value | Description |
|---|---|---|
| `TASK_RESUME_RECORDING_SUCCESS` / `FAILED` | `'Task Resume Recording ...'` | Resume recording result |

| Constant | Value | Description |
|---|---|---|
| `TASK_ACCEPT_CONSULT_SUCCESS` / `FAILED` | `'Task Accept Consult ...'` | Accept consult result |

| Constant | Value | Description |
|---|---|---|
| `TASK_AUTO_ANSWER_SUCCESS` / `FAILED` | `'Task Auto Answer ...'` | Auto-answer result |

| Constant | Value | Description |
|---|---|---|
| `TASK_OUTDIAL_SUCCESS` / `FAILED` | `'Task Outdial ...'` | Outdial result |

| Constant | Value | Description |
|---|---|---|
| `TASK_CONFERENCE_START_SUCCESS` / `FAILED` | `'Task Conference Start ...'` | Conference start result |

| Constant | Value | Description |
|---|---|---|
| `TASK_CONFERENCE_END_SUCCESS` / `FAILED` | `'Task Conference End ...'` | Conference end result |

| Constant | Value | Description |
|---|---|---|
| `TASK_CONFERENCE_TRANSFER_SUCCESS` / `FAILED` | `'Task Conference Transfer ...'` | Conference transfer result |

| Constant | Value | Description |
|---|---|---|
| `TASK_CONFERENCE_EXIT_SUCCESS` / `FAILED` | `'Task Conference Exit ...'` | Conference exit result |

| Constant | Value | Description |
|---|---|---|
| `TASK_SWITCH_CALL_SUCCESS` / `FAILED` | `'Task Switch Call ...'` | Switch call result |

| Constant | Value | Description |
|---|---|---|
| `WEBSOCKET_REGISTER_SUCCESS` / `FAILED` | `'Websocket Register ...'` | WebSocket registration result |

| Constant | Value | Description |
|---|---|---|
| `WEBSOCKET_DEREGISTER_SUCCESS` / `FAIL` | `'Websocket Deregister ...'` | WebSocket deregistration result |

| Constant | Value | Description |
|---|---|---|
| `WEBSOCKET_EVENT_RECEIVED` | `'Websocket Event Received'` | WebSocket event received |

| Constant | Value | Description |
|---|---|---|
| `UPLOAD_LOGS_SUCCESS` / `FAILED` | `'Upload Logs ...'` | Log upload result |

| Constant | Value | Description |
|---|---|---|
| `ENTRYPOINT_FETCH_SUCCESS` / `FAILED` | `'Entrypoint Fetch ...'` | Entry point fetch result |

| Constant | Value | Description |
|---|---|---|
| `ADDRESSBOOK_FETCH_SUCCESS` / `FAILED` | `'AddressBook Fetch ...'` | Address book fetch result |

| Constant | Value | Description |
|---|---|---|
| `QUEUE_FETCH_SUCCESS` / `FAILED` | `'Queue Fetch ...'` | Queue fetch result |

| Constant | Value | Description |
|---|---|---|
| `OUTDIAL_ANI_EP_FETCH_SUCCESS` / `FAILED` | `'Outdial ANI Entries Fetch ...'` | Outdial ANI entries fetch result |

All event names are defined in `constants.ts` as `METRIC_EVENT_NAMES`. Events follow a `{Domain} {Action} {Success|Failed}` naming convention:

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Station Login          | `STATION_LOGIN_SUCCESS`                | `STATION_LOGIN_FAILED`                 |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Station Logout         | `STATION_LOGOUT_SUCCESS`               | `STATION_LOGOUT_FAILED`                |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Station Relogin        | `STATION_RELOGIN_SUCCESS`              | `STATION_RELOGIN_FAILED`               |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| State Change           | `AGENT_STATE_CHANGE_SUCCESS`           | `AGENT_STATE_CHANGE_FAILED`            |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Buddy Agents           | `FETCH_BUDDY_AGENTS_SUCCESS`           | `FETCH_BUDDY_AGENTS_FAILED`            |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| WebSocket Register     | `WEBSOCKET_REGISTER_SUCCESS`           | `WEBSOCKET_REGISTER_FAILED`            |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Accept            | `TASK_ACCEPT_SUCCESS`                  | `TASK_ACCEPT_FAILED`                   |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Decline           | `TASK_DECLINE_SUCCESS`                 | `TASK_DECLINE_FAILED`                  |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task End               | `TASK_END_SUCCESS`                     | `TASK_END_FAILED`                      |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Wrapup            | `TASK_WRAPUP_SUCCESS`                  | `TASK_WRAPUP_FAILED`                   |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Hold              | `TASK_HOLD_SUCCESS`                    | `TASK_HOLD_FAILED`                     |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Resume            | `TASK_RESUME_SUCCESS`                  | `TASK_RESUME_FAILED`                   |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Consult Start     | `TASK_CONSULT_START_SUCCESS`           | `TASK_CONSULT_START_FAILED`            |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Consult End       | `TASK_CONSULT_END_SUCCESS`             | `TASK_CONSULT_END_FAILED`              |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Transfer          | `TASK_TRANSFER_SUCCESS`                | `TASK_TRANSFER_FAILED`                 |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Resume Recording  | `TASK_RESUME_RECORDING_SUCCESS`        | `TASK_RESUME_RECORDING_FAILED`         |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Pause Recording   | `TASK_PAUSE_RECORDING_SUCCESS`         | `TASK_PAUSE_RECORDING_FAILED`          |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Accept Consult    | `TASK_ACCEPT_CONSULT_SUCCESS`          | `TASK_ACCEPT_CONSULT_FAILED`           |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Task Auto Answer       | `TASK_AUTO_ANSWER_SUCCESS`             | `TASK_AUTO_ANSWER_FAILED`              |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Conference Start       | `TASK_CONFERENCE_START_SUCCESS`        | `TASK_CONFERENCE_START_FAILED`         |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Conference End         | `TASK_CONFERENCE_END_SUCCESS`          | `TASK_CONFERENCE_END_FAILED`           |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Conference Transfer    | `TASK_CONFERENCE_TRANSFER_SUCCESS`     | `TASK_CONFERENCE_TRANSFER_FAILED`      |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Conference Exit        | `TASK_CONFERENCE_EXIT_SUCCESS`         | `TASK_CONFERENCE_EXIT_FAILED`          |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Switch Call            | `TASK_SWITCH_CALL_SUCCESS`             | `TASK_SWITCH_CALL_FAILED`              |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Outdial                | `TASK_OUTDIAL_SUCCESS`                 | `TASK_OUTDIAL_FAILED`                  |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Upload Logs            | `UPLOAD_LOGS_SUCCESS`                  | `UPLOAD_LOGS_FAILED`                   |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| WebSocket Deregister   | `WEBSOCKET_DEREGISTER_SUCCESS`         | `WEBSOCKET_DEREGISTER_FAIL`            |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Device Type Update     | `AGENT_DEVICE_TYPE_UPDATE_SUCCESS`     | `AGENT_DEVICE_TYPE_UPDATE_FAILED`      |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| EntryPoint             | `ENTRYPOINT_FETCH_SUCCESS`             | `ENTRYPOINT_FETCH_FAILED`              |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| AddressBook            | `ADDRESSBOOK_FETCH_SUCCESS`            | `ADDRESSBOOK_FETCH_FAILED`             |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Queue                  | `QUEUE_FETCH_SUCCESS`                  | `QUEUE_FETCH_FAILED`                   |

| Category               | Success Event                          | Failure Event                          |
|---|---|---|
| Outdial ANI Entries    | `OUTDIAL_ANI_EP_FETCH_SUCCESS`         | `OUTDIAL_ANI_EP_FETCH_FAILED`          |

Special events (no success/failure pair):

- `AGENT_RONA` — has behavioral taxonomy (`service.agent_rona.set`)

- `AGENT_CONTACT_ASSIGN_FAILED` — has behavioral taxonomy (`service.agent_contact_assign.fail`)

- `AGENT_INVITE_FAILED` — has behavioral taxonomy (`service.agent_invite.fail`)

- `WEBSOCKET_EVENT_RECEIVED` — **no** behavioral taxonomy (not in `eventTaxonomyMap`)

Of the 80 defined metric names, 71 have behavioral taxonomy and 9 do not. Events **without** an `eventTaxonomyMap` entry are the six `AI_ASSISTANT_*` names plus `WEBSOCKET_DEREGISTER_SUCCESS`, `WEBSOCKET_DEREGISTER_FAIL`, and `WEBSOCKET_EVENT_RECEIVED`.

### Complete METRIC_EVENT_NAMES catalog

This table contains all 80 names from `src/metrics/constants.ts`; taxonomy presence is checked against `src/metrics/behavioral-events.ts`: 71 mapped and 9 unmapped.

| Constant | Emitted name | Behavioral taxonomy? |
|---|---|---|
| `STATION_LOGIN_SUCCESS` | `Station Login Success` | yes |
| `STATION_LOGIN_FAILED` | `Station Login Failed` | yes |
| `STATION_LOGOUT_SUCCESS` | `Station Logout Success` | yes |
| `STATION_LOGOUT_FAILED` | `Station Logout Failed` | yes |
| `STATION_RELOGIN_SUCCESS` | `Station Relogin Success` | yes |
| `STATION_RELOGIN_FAILED` | `Station Relogin Failed` | yes |
| `AGENT_STATE_CHANGE_SUCCESS` | `Agent State Change Success` | yes |
| `AGENT_STATE_CHANGE_FAILED` | `Agent State Change Failed` | yes |
| `FETCH_BUDDY_AGENTS_SUCCESS` | `Fetch Buddy Agents Success` | yes |
| `FETCH_BUDDY_AGENTS_FAILED` | `Fetch Buddy Agents Failed` | yes |
| `WEBSOCKET_REGISTER_SUCCESS` | `Websocket Register Success` | yes |
| `WEBSOCKET_REGISTER_FAILED` | `Websocket Register Failed` | yes |
| `AGENT_RONA` | `Agent RONA` | yes |
| `AGENT_CONTACT_ASSIGN_FAILED` | `Agent Contact Assign Failed` | yes |
| `AGENT_INVITE_FAILED` | `Agent Invite Failed` | yes |
| `TASK_ACCEPT_SUCCESS` | `Task Accept Success` | yes |
| `TASK_ACCEPT_FAILED` | `Task Accept Failed` | yes |
| `TASK_DECLINE_SUCCESS` | `Task Decline Success` | yes |
| `TASK_DECLINE_FAILED` | `Task Decline Failed` | yes |
| `TASK_END_SUCCESS` | `Task End Success` | yes |
| `TASK_END_FAILED` | `Task End Failed` | yes |
| `TASK_WRAPUP_SUCCESS` | `Task Wrapup Success` | yes |
| `TASK_WRAPUP_FAILED` | `Task Wrapup Failed` | yes |
| `TASK_HOLD_SUCCESS` | `Task Hold Success` | yes |
| `TASK_HOLD_FAILED` | `Task Hold Failed` | yes |
| `TASK_RESUME_SUCCESS` | `Task Resume Success` | yes |
| `TASK_RESUME_FAILED` | `Task Resume Failed` | yes |
| `TASK_CONSULT_START_SUCCESS` | `Task Consult Start Success` | yes |
| `TASK_CONSULT_START_FAILED` | `Task Consult Start Failed` | yes |
| `TASK_CONSULT_END_SUCCESS` | `Task Consult End Success` | yes |
| `TASK_CONSULT_END_FAILED` | `Task Consult End Failed` | yes |
| `TASK_TRANSFER_SUCCESS` | `Task Transfer Success` | yes |
| `TASK_TRANSFER_FAILED` | `Task Transfer Failed` | yes |
| `TASK_RESUME_RECORDING_SUCCESS` | `Task Resume Recording Success` | yes |
| `TASK_RESUME_RECORDING_FAILED` | `Task Resume Recording Failed` | yes |
| `TASK_PAUSE_RECORDING_SUCCESS` | `Task Pause Recording Success` | yes |
| `TASK_PAUSE_RECORDING_FAILED` | `Task Pause Recording Failed` | yes |
| `TASK_ACCEPT_CONSULT_SUCCESS` | `Task Accept Consult Success` | yes |
| `TASK_ACCEPT_CONSULT_FAILED` | `Task Accept Consult Failed` | yes |
| `TASK_AUTO_ANSWER_SUCCESS` | `Task Auto Answer Success` | yes |
| `TASK_AUTO_ANSWER_FAILED` | `Task Auto Answer Failed` | yes |
| `TASK_CONFERENCE_START_SUCCESS` | `Task Conference Start Success` | yes |
| `TASK_CONFERENCE_START_FAILED` | `Task Conference Start Failed` | yes |
| `TASK_CONFERENCE_END_SUCCESS` | `Task Conference End Success` | yes |
| `TASK_CONFERENCE_END_FAILED` | `Task Conference End Failed` | yes |
| `TASK_CONFERENCE_TRANSFER_SUCCESS` | `Task Conference Transfer Success` | yes |
| `TASK_CONFERENCE_TRANSFER_FAILED` | `Task Conference Transfer Failed` | yes |
| `TASK_CONFERENCE_EXIT_SUCCESS` | `Task Conference Exit Success` | yes |
| `TASK_CONFERENCE_EXIT_FAILED` | `Task Conference Exit Failed` | yes |
| `TASK_SWITCH_CALL_SUCCESS` | `Task Switch Call Success` | yes |
| `TASK_SWITCH_CALL_FAILED` | `Task Switch Call Failed` | yes |
| `TASK_OUTDIAL_SUCCESS` | `Task Outdial Success` | yes |
| `TASK_OUTDIAL_FAILED` | `Task Outdial Failed` | yes |
| `UPLOAD_LOGS_SUCCESS` | `Upload Logs Success` | yes |
| `UPLOAD_LOGS_FAILED` | `Upload Logs Failed` | yes |
| `WEBSOCKET_DEREGISTER_SUCCESS` | `Websocket Deregister Success` | no |
| `WEBSOCKET_DEREGISTER_FAIL` | `Websocket Deregister Failed` | no |
| `AGENT_DEVICE_TYPE_UPDATE_SUCCESS` | `Agent Device Type Update Success` | yes |
| `AGENT_DEVICE_TYPE_UPDATE_FAILED` | `Agent Device Type Update Failed` | yes |
| `WEBSOCKET_EVENT_RECEIVED` | `Websocket Event Received` | no |
| `ENTRYPOINT_FETCH_SUCCESS` | `Entrypoint Fetch Success` | yes |
| `ENTRYPOINT_FETCH_FAILED` | `Entrypoint Fetch Failed` | yes |
| `ADDRESSBOOK_FETCH_SUCCESS` | `AddressBook Fetch Success` | yes |
| `ADDRESSBOOK_FETCH_FAILED` | `AddressBook Fetch Failed` | yes |
| `QUEUE_FETCH_SUCCESS` | `Queue Fetch Success` | yes |
| `QUEUE_FETCH_FAILED` | `Queue Fetch Failed` | yes |
| `OUTDIAL_ANI_EP_FETCH_SUCCESS` | `Outdial ANI Entries Fetch Success` | yes |
| `OUTDIAL_ANI_EP_FETCH_FAILED` | `Outdial ANI Entries Fetch Failed` | yes |
| `CAMPAIGN_PREVIEW_ACCEPT_SUCCESS` | `Campaign Preview Accept Success` | yes |
| `CAMPAIGN_PREVIEW_ACCEPT_FAILED` | `Campaign Preview Accept Failed` | yes |
| `CAMPAIGN_PREVIEW_SKIP_SUCCESS` | `Campaign Preview Skip Success` | yes |
| `CAMPAIGN_PREVIEW_SKIP_FAILED` | `Campaign Preview Skip Failed` | yes |
| `CAMPAIGN_PREVIEW_REMOVE_SUCCESS` | `Campaign Preview Remove Success` | yes |
| `CAMPAIGN_PREVIEW_REMOVE_FAILED` | `Campaign Preview Remove Failed` | yes |
| `AI_ASSISTANT_SEND_EVENT_SUCCESS` | `AI Assistant Send Event Success` | no |
| `AI_ASSISTANT_SEND_EVENT_FAILED` | `AI Assistant Send Event Failed` | no |
| `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_SUCCESS` | `AI Assistant Get Suggested Response Success` | no |
| `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_FAILED` | `AI Assistant Get Suggested Response Failed` | no |
| `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS` | `AI Assistant Fetch Historic Transcripts Success` | no |
| `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_FAILED` | `AI Assistant Fetch Historic Transcripts Failed` | no |

Defined names without an `eventTaxonomyMap` entry: `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_FAILED`, `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS`, `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_FAILED`, `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_SUCCESS`, `AI_ASSISTANT_SEND_EVENT_FAILED`, `AI_ASSISTANT_SEND_EVENT_SUCCESS`, `WEBSOCKET_DEREGISTER_FAIL`, `WEBSOCKET_DEREGISTER_SUCCESS`, `WEBSOCKET_EVENT_RECEIVED`.

## Requires (dependencies)
- `webex.internal.newMetrics` submission APIs
- Webex ready lifecycle
- LoggerProxy and browser visibility metadata

- **`@webex/internal-plugin-metrics`**: Provides `webex.internal.newMetrics` for actual metric submission (`submitBehavioralEvent`, `submitOperationalEvent`, `submitBusinessEvent`)

- **`LoggerProxy`**: Used for error logging within the metrics module

- **`Failure` type** (from `services/core/GlobalTypes`): Used in `getCommonTrackingFieldForAQMResponseFailed`

- **`PRODUCT_NAME`** (from `constants.ts`): Set to `'wxcc_sdk'`, used as the product identifier in behavioral taxonomy and as prefix for operational/business event names

## Requirements
| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| METRICS-R-001 | Track only names defined by METRIC_EVENT_NAMES and keep the canonical catalog synchronized with the const object. | Telemetry queries and dashboards depend on exact stable event names. | `src/metrics/constants.ts` | `test/unit/spec/metrics/MetricsManager.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| METRICS-R-002 | Map behavioral events through eventTaxonomyMap and explicitly identify defined names without taxonomy. | Undefined taxonomy must not be mistaken for an emitted or classified behavioral event. | `src/metrics/behavioral-events.ts` | `test/unit/spec/metrics/behavioral-events.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| METRICS-R-003 | When metrics are disabled, clear pending events and make `timeEvent` plus all tracking methods return without recording/submitting. | Telemetry must never block or alter product behavior and disablement must be comprehensive. | `src/metrics/MetricsManager.ts` | `test/unit/spec/metrics/MetricsManager.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| METRICS-R-004 | Queue submissions until the host SDK is ready and flush through the correct behavioral/operational/business service. | Early lifecycle telemetry must not be lost solely because the host is not ready. | `src/metrics/MetricsManager.ts` | `test/unit/spec/metrics/MetricsManager.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| METRICS-R-005 | Submit through the host SDK's `webex.internal.newMetrics` client without storing credentials or implementing authorization policy in MetricsManager. | Host-owned authentication keeps telemetry credential handling outside the Contact Center metrics module. | `src/metrics/MetricsManager.ts` | `test/unit/spec/metrics/MetricsManager.ts` | None; authentication is inherited and credential ownership is explicitly N/A. | PRESENT |

## Design Overview
Metrics separates its stable consumption boundary from collaborators so ownership and failure behavior stay explicit. Telemetry is deliberately non-blocking and queue-backed so product behavior never waits for metrics; failures are logged rather than propagated.

> **Purpose**: Track behavioral, operational, and business metrics for Contact Center SDK operations using a singleton `MetricsManager`. Provides event timing, payload preparation, batching, and submission to the Webex metrics backend.

Each behavioral event maps to a structured taxonomy in `behavioral-events.ts`:

```text
{product}.{agent}.{target}.{verb}
```

- **product**: Always `'wxcc_sdk'` (from `PRODUCT_NAME`)

- **agent**: `'user'` for user-initiated actions, `'service'` for system-generated events

- **target**: Snake_case description of the action (e.g., `'station_login'`, `'task_accept'`)

- **verb**: `'complete'` for success, `'fail'` for failure, `'set'` for RONA events

**Example**: `STATION_LOGIN_SUCCESS` maps to `wxcc_sdk.user.station_login.complete`

> **Note**: The following events do **not** have behavioral taxonomy mappings in `behavioral-events.ts`:
> - `AI_ASSISTANT_SEND_EVENT_SUCCESS`
> - `AI_ASSISTANT_SEND_EVENT_FAILED`
> - `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_SUCCESS`
> - `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_FAILED`
> - `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS`
> - `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_FAILED`
> - `WEBSOCKET_DEREGISTER_SUCCESS`
> - `WEBSOCKET_DEREGISTER_FAIL`
> - `WEBSOCKET_EVENT_RECEIVED`
>
> Calling `trackBehavioralEvent` with these event names will push an event with an `undefined` taxonomy.

> **Purpose**: Technical documentation for the metrics collection, batching, and submission system within the Contact Center SDK.

Each metric event name maps to a `BehavioralEventTaxonomy` with four fields:

```typescript
type BehavioralEventTaxonomy = {
  product: MetricEventProduct;  // Always PRODUCT_NAME ('wxcc_sdk')
  agent: MetricEventAgent;      // 'user' or 'service'
  target: string;               // e.g., 'station_login', 'task_accept'
  verb: MetricEventVerb;        // 'complete' for success, 'fail' for failure
};
```

The final behavioral event name is constructed as: `{product}.{agent}.{target}.{verb}`

Example: `wxcc_sdk.user.station_login.complete`

The mapping is defined in `behavioral-events.ts` via `eventTaxonomyMap` and accessed through `getEventTaxonomy(name)`.

```mermaid
flowchart LR
    A[timeEvent keys] --> B[runningEvents stores startTime + key Set]
    B --> C[trackEvent called with one of the keys]
    C --> D[addDurationIfTimed matches key]
    D --> E[Calculates duration_ms = now - startTime]
    E --> F[Removes all keys for that operation]
    F --> G[Attaches duration_ms to payload]
```

Usage pattern from `cc.ts`:

```typescript
// Before operation
this.metricsManager.timeEvent([
  METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
  METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
]);

// On success
this.metricsManager.trackEvent(
  METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
  { ...MetricsManager.getCommonTrackingFieldForAQMResponse(resp) },
  ['behavioral', 'operational', 'business']
);

// On failure
this.metricsManager.trackEvent(
  METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
  { ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure) },
  ['behavioral', 'operational', 'business']
);
```

Two static helpers extract standardized fields from AQM responses for metric payloads:

Extracts: `agentId`, `agentSessionId`, `teamId`, `siteId`, `orgId`, `eventType`, `trackingId`, `notifTrackingId`

## Data Flow
```mermaid
flowchart TD
    A[cc.ts calls metricsManager.timeEvent] --> B[Store startTime + keys in runningEvents]
    B --> C[Operation executes]
    C --> D{Success or Failure?}
    D -->|Success| E[cc.ts calls metricsManager.trackEvent with success name]
    D -->|Failure| F[cc.ts calls metricsManager.trackEvent with failure name]
    E --> G[addDurationIfTimed attaches duration_ms]
    F --> G
    G --> H[preparePayload cleans and enriches]
    H --> I{Metric type?}
    I -->|behavioral| J[Push to pendingBehavioralEvents]
    I -->|operational| K[Push to pendingOperationalEvents]
    I -->|business| L[Push to pendingBusinessEvents]
    J --> M[submitPendingBehavioralEvents]
    K --> N[submitPendingOperationalEvents]
    L --> O[submitPendingBusinessEvents]
    M --> P[webex.internal.newMetrics.submitBehavioralEvent]
    N --> Q[webex.internal.newMetrics.submitOperationalEvent]
    O --> R[webex.internal.newMetrics.submitBusinessEvent]
```

## Sequence Diagram(s)
Sequence coverage:

| Operation group | Diagram | Failure / recovery coverage |
|---|---|---|
| Time and track an event | `timeEvent` stores start time and keys; `trackEvent` attaches duration before queuing. | When disabled, both calls return without timing, queuing, or submission. |
| Queue until SDK readiness | `getInstance` attaches the host-ready callback and preserves pending queues. | A not-ready SDK retains events; READY drains them through the configured metrics service. |
| Submit behavioral/operational/business events | `trackEvent` queues once per requested metric service and invokes the corresponding `newMetrics` submitter. | Submission errors are logged without inventing a successful delivery. |

```mermaid
sequenceDiagram
    participant CC as ContactCenter (cc.ts)
    participant MM as MetricsManager
    participant NM as webex.internal.newMetrics

    CC->>MM: timeEvent([SUCCESS_KEY, FAILURE_KEY])
    Note over MM: Store startTime + key set in runningEvents
    CC->>CC: Execute operation (e.g., stationLogin)
    Note over MM: trackEvent defaults to ['behavioral'] only if no metricServices specified
    alt Success
        CC->>MM: trackEvent(SUCCESS_KEY, payload, ['behavioral', 'operational', 'business'])
    else Failure
        CC->>MM: trackEvent(FAILURE_KEY, payload, ['behavioral', 'operational', 'business'])
    end
    MM->>MM: addDurationIfTimed → attach duration_ms
    MM->>MM: preparePayload → clean empty fields, add tabHidden
    loop For each metric type
        MM->>MM: Push to pending queue
        alt readyToSubmitEvents
            MM->>NM: submit[Behavioral|Operational|Business]Event
        else not ready
            Note over MM: Events stay queued until SDK ready
        end
    end
```

```mermaid
sequenceDiagram
    participant CC as ContactCenter
    participant MM as MetricsManager
    participant Webex as WebexSDK

    CC->>MM: getInstance({webex})
    MM->>MM: Create singleton (if needed)
    MM->>MM: setWebex(webex)
    opt webex.ready === true
        MM->>MM: setReadyToSubmitEvents()
        MM->>MM: submitPendingEvents()
    end
    MM->>Webex: webex.once('ready', callback)
    Note over MM: 'ready' listener is always registered
    Webex-->>MM: 'ready' event fires
    MM->>MM: setReadyToSubmitEvents()
    MM->>MM: submitPendingEvents()
```

## Class / Component Relationships
```mermaid
classDiagram
  class ContactCenter
  class MetricsManager
  class METRIC_EVENT_NAMES
  class eventTaxonomyMap
  class NewMetrics
  ContactCenter --> MetricsManager : timeEvent / trackEvent
  MetricsManager --> METRIC_EVENT_NAMES : canonical names
  MetricsManager --> eventTaxonomyMap : behavioral taxonomy lookup
  MetricsManager --> NewMetrics : submit queued event types
```

| Component                | File                    | Responsibility                                                                 |
|---|---|---|
| `MetricsManager`         | `MetricsManager.ts`     | Singleton that manages event queuing, timing, payload preparation, and submission |

| Component                | File                    | Responsibility                                                                 |
|---|---|---|
| `BehavioralEventTaxonomy`| `behavioral-events.ts`  | Maps metric event names to structured taxonomy for behavioral analytics         |

| Component                | File                    | Responsibility                                                                 |
|---|---|---|
| `METRIC_EVENT_NAMES`     | `constants.ts`          | Canonical constant object of all tracked metric event names                     |

`MetricsManager` uses a private constructor with a static `getInstance` factory:

```typescript
// MetricsManager.ts
export default class MetricsManager {
  private static instance: MetricsManager;
  private constructor() {}

  public static getInstance(options?: {webex: WebexSDK}): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }
    if (!MetricsManager.instance.webex && options?.webex) {
      MetricsManager.instance.setWebex(options.webex);
    }
    return MetricsManager.instance;
  }

  public static resetInstance() {
    MetricsManager.instance = undefined;
  }
}
```

- The Webex SDK instance is set once via `setWebex()`, which listens for the `ready` event before flushing pending queues.

- `resetInstance()` sets the singleton to `undefined`, allowing a fresh instance to be created. Primarily used in tests.

## Use Cases
- **UC-1 Time and track an event:** `timeEvent` records the start against success/failure keys and `trackEvent` attaches `duration_ms` before preparing and queuing the payload. Evidence: `src/metrics/MetricsManager.ts`, `test/unit/spec/metrics/MetricsManager.ts`.
- **UC-2 Queue until SDK readiness:** events remain in the behavioral/operational/business pending queues until the host is ready, then the ready callback drains them. Evidence: `src/metrics/MetricsManager.ts`, `test/unit/spec/metrics/MetricsManager.ts`.
- **UC-3 Submit event categories:** each requested metric service uses its matching `webex.internal.newMetrics` submission method; taxonomy is applied only where `eventTaxonomyMap` contains the name. Evidence: `src/metrics/MetricsManager.ts`, `src/metrics/behavioral-events.ts`, `test/unit/spec/metrics/MetricsManager.ts`.

```typescript
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

// Get the singleton instance (webex is set during the ContactCenter READY callback)
const metrics = MetricsManager.getInstance();

// Time an operation, then track its result
metrics.timeEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS);
// ... perform the operation ...
metrics.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS, {agentId: '123'});
```

The standard pattern used throughout the Contact Center SDK:

```typescript
const metrics = MetricsManager.getInstance();

// 1. Start timing before the operation
metrics.timeEvent([
  METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
  METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
]);

try {
  const response = await performLogin(params);

  // 2a. Track success (duration_ms auto-added)
  metrics.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS, {
    ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
  });
} catch (error) {
  // 2b. Track failure (duration_ms auto-added)
  metrics.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_FAILED, {
    ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error),
  });
}
```

## State Model
MetricsManager holds three pending queues, running timing entries, a readiness flag, a submission lock, and an independent disabled flag. Host READY enables draining; disabling metrics prevents both timing and tracking and clears pending events through the configured disable path.

`preparePayload()` processes every event payload before submission:

1. **Removes empty/null/undefined fields** — strips keys with `undefined`, `null`, `''`, any arrays, or empty objects

2. **Converts spaces to underscores** — `spacesToUnderscore()` applied to all key names

3. **Adds common metadata** — appends `tabHidden: document.hidden` in browser environments

## Business Rules & Invariants
- `timeEvent` and every tracking method return immediately while metrics are disabled.
- Only names present in `eventTaxonomyMap` receive behavioral taxonomy; 71 of 80 names are mapped and the six AI Assistant plus three WebSocket names are intentionally catalogued as unmapped.
- `submittingEvents` prevents overlapping queue-drain executions.
- Authentication is inherited from the host Webex SDK's metrics client; MetricsManager owns no credentials, tokens, or authorization policy.

## Concurrency & Reactive Flow
- Queue insertion is synchronous. Submission is gated by host readiness and the submission lock; each metric type drains through its own host method without propagating telemetry failures to product callers.

MetricsManager maintains three independent pending event queues:

| Queue                       | Type         | Submitted Via                                      | Name Transform                                  | Extra Metadata                   |
|---|---|---|---|---|
| `pendingBehavioralEvents`   | behavioral   | `webex.internal.newMetrics.submitBehavioralEvent`   | Taxonomy-based (`{product}.{agent}.{target}.{verb}`) | None                             |

| Queue                       | Type         | Submitted Via                                      | Name Transform                                  | Extra Metadata                   |
|---|---|---|---|---|
| `pendingOperationalEvents`  | operational  | `webex.internal.newMetrics.submitOperationalEvent`  | `WXCC_SDK_` prefix + uppercase (e.g. `WXCC_SDK_STATION_LOGIN_SUCCESS`) | None                             |

| Queue                       | Type         | Submitted Via                                      | Name Transform                                  | Extra Metadata                   |
|---|---|---|---|---|
| `pendingBusinessEvents`     | business     | `webex.internal.newMetrics.submitBusinessEvent`     | `WXCC_SDK_` prefix + uppercase (same as operational) | `metadata: {appType: 'wxcc_sdk'}` |

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Buffering
  Buffering --> ReadyToSubmit: host already ready / ready event
  ReadyToSubmit --> Submitting: pending events and lock acquired
  Submitting --> ReadyToSubmit: queues drained and lock released
  Buffering --> Disabled: setMetricsDisabled(true)
  ReadyToSubmit --> Disabled: setMetricsDisabled(true)
  Disabled --> Buffering: enabled before host ready
  Disabled --> ReadyToSubmit: enabled after host ready
```

- **readyToSubmitEvents**: Set to `true` only after `webex.once('ready')` fires. Events queue until then.

- **submittingEvents**: Lock flag to prevent concurrent `submitPendingEvents()` calls.

- **metricsDisabled**: When `true`, `timeEvent` and all `track*` methods return early, and `clearPendingEvents()` empties all queues.

## Pitfalls
- Do not bypass the Metrics ownership boundary or duplicate its constants/events; doing so breaks correlation, compatibility, or state invariants.

Static helper that extracts common tracking fields from an AQM failure response.

**Parameters**:

- `failureResponse` (Failure): The AQM failure response object

**Returns**: `Record<string, any>` with fields: `agentId`, `trackingId`, `notifTrackingId`, `orgId`, `failureType`, `failureReason`, `reasonCode`

MetricsManager is designed to be non-blocking. Metric failures do not propagate to callers:

- If `webex` is not yet ready, events are queued in `pendingBehavioralEvents`, `pendingOperationalEvents`, or `pendingBusinessEvents`

- Once `webex.ready` fires, all pending events are flushed

- If metrics are disabled via `setMetricsDisabled(true)`, all track methods silently return

- Invalid metric types log an error via `LoggerProxy` but do not throw

MetricsManager does not throw errors to callers. Instead:

- Invalid metric types are logged via `LoggerProxy.error`

- Empty `timeEvent` key arrays are logged and ignored

- Disabled state (`metricsDisabled`) prevents both timing and tracking and silently drops new events

- The `submittingEvents` lock prevents race conditions during concurrent submissions

Extracts: `agentId`, `trackingId`, `notifTrackingId`, `orgId`, `failureType`, `failureReason`, `reasonCode`

**Cause**: Webex SDK not yet ready when `trackEvent` is called

**Solution**: Events are automatically queued in `pending*Events` arrays and flushed once `webex.once('ready')` fires. Verify the SDK is initializing correctly.

**Cause**: `timeEvent` was not called before `trackEvent`, or the event name does not match any key in `runningEvents`

**Solution**: Ensure `timeEvent([SUCCESS_KEY, FAILURE_KEY])` is called before the operation, and that the exact `METRIC_EVENT_NAMES` constant is used in both calls.

**Cause**: `metricsDisabled` is set to `true`

**Solution**: Check if `setMetricsDisabled(true)` was called. This clears all pending queues and causes all `track*` methods to return early.

## Module Do's / Don'ts
- DO use the authoritative files and typed constants listed above.
- DON'T use raw event strings, swallow errors, or infer backend behavior.

## Key Design Trade-off
- Telemetry is deliberately non-blocking and queue-backed so product behavior never waits for metrics; failures are logged rather than propagated.

## Test-Case Strategy (module)
Use `test/unit/spec/metrics/MetricsManager.ts` for readiness queues, timing/tracking, disabled behavior, submission categories, and failures. Use `test/unit/spec/metrics/behavioral-events.ts` to reconcile every taxonomy-backed name. Mechanically compare the complete constant catalog with taxonomy keys so newly defined events cannot disappear from the spec.

## Traceability
- Repo architecture: `../../../ai-docs/ARCHITECTURE.md` · Registry: `../../../ai-docs/SPEC_INDEX.md`
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`

- [`MetricsManager.ts`](../MetricsManager.ts) - Singleton metrics manager implementation

- [`behavioral-events.ts`](../behavioral-events.ts) - Event taxonomy mapping

- [`constants.ts`](../constants.ts) - `METRIC_EVENT_NAMES` definitions

- [`../../constants.ts`](../../constants.ts) - `PRODUCT_NAME` constant

- [`services/core/GlobalTypes.ts`](../../services/core/GlobalTypes.ts) - `Failure` type definition

- [MetricsManager.ts](../MetricsManager.ts) — Singleton metrics manager

- [behavioral-events.ts](../behavioral-events.ts) — Event taxonomy mapping

- [constants.ts](../constants.ts) — METRIC_EVENT_NAMES definitions

- [cc.ts](../../cc.ts) — Main plugin class (primary consumer)

- [constants.ts](../../constants.ts) — PRODUCT_NAME used in event prefixing
