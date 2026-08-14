# Metrics Module - AI Agent Guide

## Purpose

`MetricsManager` tracks behavioral, operational, and business metrics for the
Contact Center SDK. It remains a shared singleton. AI summary code uses the
same `trackEvent(...)` API but intentionally does not use the singleton
`timeEvent(...)` timing store.

## Quick Start

```typescript
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

const metrics = MetricsManager.getInstance();

metrics.timeEvent([
  METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
  METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
]);

try {
  const response = await performLogin(params);

  metrics.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS, {
    ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
  });
} catch (error) {
  metrics.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_FAILED, {
    ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error),
  });
}
```

## Key Capabilities

- **Singleton pattern**: one `MetricsManager` instance is shared across the SDK.
- **Three metric types**: behavioral, operational, and business.
- **Event timing**: `timeEvent(...)` plus a later tracking call adds `duration_ms`.
- **Queued submission**: events queue until the Webex SDK is ready, then flush.
- **Behavioral taxonomy**: behavioral events are mapped in `behavioral-events.ts`.
- **Payload preparation**: empty fields are removed, keys are normalized, and browser payloads include `tabHidden`.
- **AQM response helpers**: static helpers extract common success and failure fields.

## API Reference

### `MetricsManager.getInstance(options?)`

Returns the singleton instance. The first call with `{webex}` binds the Webex
SDK instance and installs readiness handling.

- `options` (optional): `{webex: WebexSDK}`
- Returns: `MetricsManager`

```typescript
const metrics = MetricsManager.getInstance({webex});
const sameMetrics = MetricsManager.getInstance();
```

### `metrics.timeEvent(keys)`

Starts a timer for one or more event keys. The first key is the storage key; any
key in the set can later consume that duration through `trackEvent(...)`,
`trackBehavioralEvent(...)`, `trackOperationalEvent(...)`, or
`trackBusinessEvent(...)`.

```typescript
const metrics = MetricsManager.getInstance();

metrics.timeEvent([
  METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
  METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
]);
```

### `metrics.trackEvent(name, payload?, metricServices?)`

Tracks an event across one or more services. `metricServices` defaults to
`['behavioral']`; pass `['behavioral', 'operational']` or
`['behavioral', 'operational', 'business']` when the caller owns those signals.

```typescript
const metrics = MetricsManager.getInstance();

metrics.trackEvent(
  METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
  {interactionId: 'abc'},
  ['behavioral', 'operational']
);
```

### `metrics.trackBehavioralEvent(name, options?)`

Tracks one behavioral event. The event must have a taxonomy mapping in
`behavioral-events.ts` before it is safe to call this method directly.

### `metrics.trackOperationalEvent(name, options?)`

Tracks one operational event. The submitted name is prefixed with `WXCC_SDK_`
and uppercased with spaces converted to underscores.

### `metrics.trackBusinessEvent(name, options?)`

Tracks one business event. The submitted name uses the same transform as
operational events and includes `metadata: {appType: 'wxcc_sdk'}`.

### `metrics.setMetricsDisabled(disabled)`

Enables or disables metrics collection. Disabling metrics clears pending queues
and causes later track calls to return without submission.

### `MetricsManager.getCommonTrackingFieldForAQMResponse(response)`

Extracts common success fields from an AQM response:
`agentId`, `agentSessionId`, `teamId`, `siteId`, `orgId`, `eventType`,
`trackingId`, and `notifTrackingId`.

```typescript
const metrics = MetricsManager.getInstance();
const fields = MetricsManager.getCommonTrackingFieldForAQMResponse(response);

metrics.trackEvent(METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS, fields);
```

### `MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failureResponse)`

Extracts common failure fields from an AQM failure:
`agentId`, `trackingId`, `notifTrackingId`, `orgId`, `failureType`,
`failureReason`, and `reasonCode`.

```typescript
const metrics = MetricsManager.getInstance();
const fields = MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure);

metrics.trackEvent(METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED, fields);
```

### `MetricsManager.resetInstance()`

Resets the singleton instance. This is test-only behavior.

## General Metrics Usage

Existing non-summary operations may use:

```typescript
const metrics = MetricsManager.getInstance();

metrics.timeEvent([
  METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
  METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
]);
metrics.trackEvent(
  METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
  payload,
  ['behavioral', 'operational']
);
```

`timeEvent(...)` stores timing by metric name in the singleton manager and is
appropriate for existing single-operation patterns.

## Metric Event Names

All documented names below are constants in `METRIC_EVENT_NAMES`
(`constants.ts`). Do not document or consume a metric identifier unless it is
defined there.

### Agent Events

| Constant | Value | Description |
| --- | --- | --- |
| `STATION_LOGIN_SUCCESS` | `'Station Login Success'` | Agent station login succeeded |
| `STATION_LOGIN_FAILED` | `'Station Login Failed'` | Agent station login failed |
| `STATION_LOGOUT_SUCCESS` | `'Station Logout Success'` | Agent station logout succeeded |
| `STATION_LOGOUT_FAILED` | `'Station Logout Failed'` | Agent station logout failed |
| `STATION_RELOGIN_SUCCESS` | `'Station Relogin Success'` | Silent relogin succeeded |
| `STATION_RELOGIN_FAILED` | `'Station Relogin Failed'` | Silent relogin failed |
| `AGENT_STATE_CHANGE_SUCCESS` | `'Agent State Change Success'` | State change succeeded |
| `AGENT_STATE_CHANGE_FAILED` | `'Agent State Change Failed'` | State change failed |
| `FETCH_BUDDY_AGENTS_SUCCESS` | `'Fetch Buddy Agents Success'` | Buddy agents fetch succeeded |
| `FETCH_BUDDY_AGENTS_FAILED` | `'Fetch Buddy Agents Failed'` | Buddy agents fetch failed |
| `AGENT_RONA` | `'Agent RONA'` | Agent Ring-On-No-Answer triggered |
| `AGENT_CONTACT_ASSIGN_FAILED` | `'Agent Contact Assign Failed'` | Contact assignment failed |
| `AGENT_INVITE_FAILED` | `'Agent Invite Failed'` | Agent invite failed |
| `AGENT_DEVICE_TYPE_UPDATE_SUCCESS` | `'Agent Device Type Update Success'` | Device type update succeeded |
| `AGENT_DEVICE_TYPE_UPDATE_FAILED` | `'Agent Device Type Update Failed'` | Device type update failed |

### Task Events

| Constant | Value | Description |
| --- | --- | --- |
| `TASK_ACCEPT_SUCCESS` / `TASK_ACCEPT_FAILED` | `'Task Accept Success'` / `'Task Accept Failed'` | Task accept result |
| `TASK_DECLINE_SUCCESS` / `TASK_DECLINE_FAILED` | `'Task Decline Success'` / `'Task Decline Failed'` | Task decline result |
| `TASK_END_SUCCESS` / `TASK_END_FAILED` | `'Task End Success'` / `'Task End Failed'` | Task end result |
| `TASK_WRAPUP_SUCCESS` / `TASK_WRAPUP_FAILED` | `'Task Wrapup Success'` / `'Task Wrapup Failed'` | Task wrapup result |
| `TASK_HOLD_SUCCESS` / `TASK_HOLD_FAILED` | `'Task Hold Success'` / `'Task Hold Failed'` | Task hold result |
| `TASK_RESUME_SUCCESS` / `TASK_RESUME_FAILED` | `'Task Resume Success'` / `'Task Resume Failed'` | Task resume result |
| `TASK_CONSULT_START_SUCCESS` / `TASK_CONSULT_START_FAILED` | `'Task Consult Start Success'` / `'Task Consult Start Failed'` | Consult start result |
| `TASK_CONSULT_END_SUCCESS` / `TASK_CONSULT_END_FAILED` | `'Task Consult End Success'` / `'Task Consult End Failed'` | Consult end result |
| `TASK_TRANSFER_SUCCESS` / `TASK_TRANSFER_FAILED` | `'Task Transfer Success'` / `'Task Transfer Failed'` | Transfer result |
| `TASK_PAUSE_RECORDING_SUCCESS` / `TASK_PAUSE_RECORDING_FAILED` | `'Task Pause Recording Success'` / `'Task Pause Recording Failed'` | Pause recording result |
| `TASK_RESUME_RECORDING_SUCCESS` / `TASK_RESUME_RECORDING_FAILED` | `'Task Resume Recording Success'` / `'Task Resume Recording Failed'` | Resume recording result |
| `TASK_ACCEPT_CONSULT_SUCCESS` / `TASK_ACCEPT_CONSULT_FAILED` | `'Task Accept Consult Success'` / `'Task Accept Consult Failed'` | Consult accept result |
| `TASK_AUTO_ANSWER_SUCCESS` / `TASK_AUTO_ANSWER_FAILED` | `'Task Auto Answer Success'` / `'Task Auto Answer Failed'` | Auto-answer result |
| `TASK_OUTDIAL_SUCCESS` / `TASK_OUTDIAL_FAILED` | `'Task Outdial Success'` / `'Task Outdial Failed'` | Outdial result |

### Conference Events

| Constant | Value | Description |
| --- | --- | --- |
| `TASK_CONFERENCE_START_SUCCESS` / `TASK_CONFERENCE_START_FAILED` | `'Task Conference Start Success'` / `'Task Conference Start Failed'` | Conference start result |
| `TASK_CONFERENCE_END_SUCCESS` / `TASK_CONFERENCE_END_FAILED` | `'Task Conference End Success'` / `'Task Conference End Failed'` | Conference end result |
| `TASK_CONFERENCE_TRANSFER_SUCCESS` / `TASK_CONFERENCE_TRANSFER_FAILED` | `'Task Conference Transfer Success'` / `'Task Conference Transfer Failed'` | Conference transfer result |
| `TASK_CONFERENCE_EXIT_SUCCESS` / `TASK_CONFERENCE_EXIT_FAILED` | `'Task Conference Exit Success'` / `'Task Conference Exit Failed'` | Conference exit result |
| `TASK_SWITCH_CALL_SUCCESS` / `TASK_SWITCH_CALL_FAILED` | `'Task Switch Call Success'` / `'Task Switch Call Failed'` | Switch-call result |

### System And Data Events

| Constant | Value | Description |
| --- | --- | --- |
| `WEBSOCKET_REGISTER_SUCCESS` / `WEBSOCKET_REGISTER_FAILED` | `'Websocket Register Success'` / `'Websocket Register Failed'` | WebSocket registration result |
| `WEBSOCKET_DEREGISTER_SUCCESS` / `WEBSOCKET_DEREGISTER_FAIL` | `'Websocket Deregister Success'` / `'Websocket Deregister Failed'` | WebSocket deregistration result |
| `WEBSOCKET_EVENT_RECEIVED` | `'Websocket Event Received'` | WebSocket event received |
| `UPLOAD_LOGS_SUCCESS` / `UPLOAD_LOGS_FAILED` | `'Upload Logs Success'` / `'Upload Logs Failed'` | Log upload result |
| `ENTRYPOINT_FETCH_SUCCESS` / `ENTRYPOINT_FETCH_FAILED` | `'Entrypoint Fetch Success'` / `'Entrypoint Fetch Failed'` | Entry point fetch result |
| `ADDRESSBOOK_FETCH_SUCCESS` / `ADDRESSBOOK_FETCH_FAILED` | `'AddressBook Fetch Success'` / `'AddressBook Fetch Failed'` | Address book fetch result |
| `QUEUE_FETCH_SUCCESS` / `QUEUE_FETCH_FAILED` | `'Queue Fetch Success'` / `'Queue Fetch Failed'` | Queue fetch result |
| `OUTDIAL_ANI_EP_FETCH_SUCCESS` / `OUTDIAL_ANI_EP_FETCH_FAILED` | `'Outdial ANI Entries Fetch Success'` / `'Outdial ANI Entries Fetch Failed'` | Outdial ANI entries fetch result |

### Campaign Preview Events

| Constant | Value | Description |
| --- | --- | --- |
| `CAMPAIGN_PREVIEW_ACCEPT_SUCCESS` / `CAMPAIGN_PREVIEW_ACCEPT_FAILED` | `'Campaign Preview Accept Success'` / `'Campaign Preview Accept Failed'` | Campaign preview accept result |
| `CAMPAIGN_PREVIEW_SKIP_SUCCESS` / `CAMPAIGN_PREVIEW_SKIP_FAILED` | `'Campaign Preview Skip Success'` / `'Campaign Preview Skip Failed'` | Campaign preview skip result |
| `CAMPAIGN_PREVIEW_REMOVE_SUCCESS` / `CAMPAIGN_PREVIEW_REMOVE_FAILED` | `'Campaign Preview Remove Success'` / `'Campaign Preview Remove Failed'` | Campaign preview remove result |

### AI Assistant Transcript Events

| Constant | Value | Description |
| --- | --- | --- |
| `AI_ASSISTANT_SEND_EVENT_SUCCESS` / `AI_ASSISTANT_SEND_EVENT_FAILED` | `'AI Assistant Send Event Success'` / `'AI Assistant Send Event Failed'` | AI assistant send-event result |
| `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_SUCCESS` / `AI_ASSISTANT_GET_SUGGESTED_RESPONSE_FAILED` | `'AI Assistant Get Suggested Response Success'` / `'AI Assistant Get Suggested Response Failed'` | Suggested response fetch result |
| `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS` / `AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_FAILED` | `'AI Assistant Fetch Historic Transcripts Success'` / `'AI Assistant Fetch Historic Transcripts Failed'` | Historic transcript fetch result |

### AI Summary Events

AI-summary metric names and owner boundaries are canonical in
[Metrics And Privacy](../../../../../../ai-summary.md#metrics-and-privacy).
Every identifier must also exist in `metrics/constants.ts`; do not reproduce
the full owner table in this implementation guide.


## Behavioral Event Taxonomy

Behavioral events map to a structured taxonomy in `behavioral-events.ts`:

```text
{product}.{agent}.{target}.{verb}
```

- `product`: always `'wxcc_sdk'` from `PRODUCT_NAME`
- `agent`: `'user'` for user-initiated actions or `'service'` for system-generated events
- `target`: snake_case action target such as `'station_login'` or `'task_accept'`
- `verb`: `'complete'`, `'fail'`, or `'set'`

Events without behavioral taxonomy must not use default `trackEvent(...)` or
`trackBehavioralEvent(...)`: `WEBSOCKET_DEREGISTER_SUCCESS`,
`WEBSOCKET_DEREGISTER_FAIL`, `WEBSOCKET_EVENT_RECEIVED`, all `AI_ASSISTANT_*`
events, and all `AI_SUMMARY_*` events. AI summary emits operational metrics
explicitly with `['operational']`.

## AI Summary Implementation Rules

- Emit AI-summary events explicitly to the operational service; they have no
  behavioral taxonomy.
- Use a method-local duration for every public Task summary invocation and
  exactly one final success or failure event. Never call `timeEvent(...)` for
  these overlapping operations.
- Task owns request/response operation outcomes. TaskManager owns feature
  receive and terminal inbound-drop outcomes. The coordinator reports expiry
  through TaskManager rather than emitting operation metrics.
- Pass only bounded codes, validated flags, safe identifiers, counters, state,
  feedback, and action type. Never pass summary/card content, human-authored
  keys, agent names, raw payloads, or arbitrary exception details.

The canonical [Metrics And Privacy contract](../../../../../../ai-summary.md#metrics-and-privacy)
owns exact success conditions, event names, receive/drop outcomes, and the
complete privacy allow/deny boundary.


## Error Handling

MetricsManager is non-blocking for callers:

- Events are queued until `webex.ready` fires.
- `setMetricsDisabled(true)` clears pending queues and drops later metrics.
- Invalid metric service names are logged through `LoggerProxy.error`.
- Empty `timeEvent([])` input is logged and ignored.

## Dependencies

- `@webex/internal-plugin-metrics`: provides `webex.internal.newMetrics`.
- `LoggerProxy`: records local metrics-module errors.
- `Failure`: shapes AQM failure extraction.
- `PRODUCT_NAME`: provides the behavioral product value and service prefix.

## Validation

Focused evidence:

```bash
yarn workspace @webex/contact-center test:unit --targets services/task/Task.ts
yarn workspace @webex/contact-center test:unit --targets services/task/TaskManager.ts
yarn workspace @webex/contact-center test:unit --targets services/ApiAiAssistant.ts
```

## Related

- [`MetricsManager.ts`](../MetricsManager.ts)
- [`behavioral-events.ts`](../behavioral-events.ts)
- [`constants.ts`](../constants.ts)
- [`../../cc.ts`](../../cc.ts)
- [`../../constants.ts`](../../constants.ts)
