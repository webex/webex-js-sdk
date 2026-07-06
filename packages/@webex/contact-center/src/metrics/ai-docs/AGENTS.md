# Metrics Module - AI Agent Guide

> **Purpose**: Track behavioral, operational, and business metrics for Contact Center SDK operations using a singleton `MetricsManager`. Provides event timing, payload preparation, batching, and submission to the Webex metrics backend.

---

## Quick Start

```typescript
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

// Get the singleton instance (webex is set during cc.register())
const metrics = MetricsManager.getInstance();

// Time an operation, then track its result
metrics.timeEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS);
// ... perform the operation ...
metrics.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS, {agentId: '123'});
```

---

## Key Capabilities

- **Singleton Pattern**: Single `MetricsManager` instance shared across the entire SDK
- **Three Metric Types**: Behavioral (user actions), operational (system events), business (business-level analytics)
- **Event Timing**: `timeEvent` + `trackEvent` pattern automatically calculates `duration_ms`
- **Queued Submission**: Events are queued until the Webex SDK is ready, then submitted in order
- **Behavioral Taxonomy**: Structured `product.agent.target.verb` naming convention for behavioral events
- **Payload Preparation**: Automatic cleanup of empty fields, space-to-underscore conversion, and `tabHidden` metadata
- **AQM Response Helpers**: Static methods to extract common tracking fields from AQM responses

---

## API Reference

### Methods

#### `MetricsManager.getInstance(options?)`

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

---

#### `metrics.timeEvent(keys)`

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

---

#### `metrics.trackEvent(name, payload?, metricServices?)`

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

---

#### `metrics.trackBehavioralEvent(name, options?)`

Tracks a single behavioral event. Looks up the event taxonomy from `behavioral-events.ts` and submits via `webex.internal.newMetrics.submitBehavioralEvent`.

**Parameters**:
- `name` (METRIC_EVENT_NAMES): The event name
- `options` (EventPayload, optional): Additional payload data

**Returns**: `void`

---

#### `metrics.trackOperationalEvent(name, options?)`

Tracks a single operational event. Prefixes the event name with `WXCC_SDK_` and submits via `webex.internal.newMetrics.submitOperationalEvent`.

**Parameters**:
- `name` (METRIC_EVENT_NAMES): The event name
- `options` (EventPayload, optional): Additional payload data

**Returns**: `void`

---

#### `metrics.trackBusinessEvent(name, options?)`

Tracks a single business event. Prefixes the event name with `WXCC_SDK_` and submits via `webex.internal.newMetrics.submitBusinessEvent` with `appType: 'wxcc_sdk'`.

**Parameters**:
- `name` (METRIC_EVENT_NAMES): The event name
- `options` (EventPayload, optional): Additional payload data

**Returns**: `void`

---

#### `metrics.setMetricsDisabled(disabled)`

Enables or disables metrics collection. When disabled, all pending events are cleared and new events are dropped.

**Parameters**:
- `disabled` (boolean): `true` to disable, `false` to enable

**Returns**: `void`

---

#### `MetricsManager.getCommonTrackingFieldForAQMResponse(response)`

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

---

#### `MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failureResponse)`

Static helper that extracts common tracking fields from an AQM failure response.

**Parameters**:
- `failureResponse` (Failure): The AQM failure response object

**Returns**: `Record<string, any>` with fields: `agentId`, `trackingId`, `notifTrackingId`, `orgId`, `failureType`, `failureReason`, `reasonCode`

---

#### `MetricsManager.resetInstance()`

Resets the singleton instance. Used for testing only.

**Returns**: `void`

---

## Metric Event Names

All event names are defined in `METRIC_EVENT_NAMES` (`constants.ts`). Events follow a `<Category> <Action> <Result>` pattern.

### Agent Events

| Constant | Value | Description |
|----------|-------|-------------|
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
|----------|-------|-------------|
| `TASK_ACCEPT_SUCCESS` / `FAILED` | `'Task Accept ...'` | Task accept result |
| `TASK_DECLINE_SUCCESS` / `FAILED` | `'Task Decline ...'` | Task decline result |
| `TASK_END_SUCCESS` / `FAILED` | `'Task End ...'` | Task end result |
| `TASK_WRAPUP_SUCCESS` / `FAILED` | `'Task Wrapup ...'` | Task wrapup result |
| `TASK_HOLD_SUCCESS` / `FAILED` | `'Task Hold ...'` | Task hold result |
| `TASK_RESUME_SUCCESS` / `FAILED` | `'Task Resume ...'` | Task resume result |
| `TASK_CONSULT_START_SUCCESS` / `FAILED` | `'Task Consult Start ...'` | Consult start result |
| `TASK_CONSULT_END_SUCCESS` / `FAILED` | `'Task Consult End ...'` | Consult end result |
| `TASK_TRANSFER_SUCCESS` / `FAILED` | `'Task Transfer ...'` | Transfer result |
| `TASK_PAUSE_RECORDING_SUCCESS` / `FAILED` | `'Task Pause Recording ...'` | Pause recording result |
| `TASK_RESUME_RECORDING_SUCCESS` / `FAILED` | `'Task Resume Recording ...'` | Resume recording result |
| `TASK_ACCEPT_CONSULT_SUCCESS` / `FAILED` | `'Task Accept Consult ...'` | Accept consult result |
| `TASK_AUTO_ANSWER_SUCCESS` / `FAILED` | `'Task Auto Answer ...'` | Auto-answer result |
| `TASK_OUTDIAL_SUCCESS` / `FAILED` | `'Task Outdial ...'` | Outdial result |

### Conference Events

| Constant | Value | Description |
|----------|-------|-------------|
| `TASK_CONFERENCE_START_SUCCESS` / `FAILED` | `'Task Conference Start ...'` | Conference start result |
| `TASK_CONFERENCE_END_SUCCESS` / `FAILED` | `'Task Conference End ...'` | Conference end result |
| `TASK_CONFERENCE_TRANSFER_SUCCESS` / `FAILED` | `'Task Conference Transfer ...'` | Conference transfer result |
| `TASK_CONFERENCE_EXIT_SUCCESS` / `FAILED` | `'Task Conference Exit ...'` | Conference exit result |
| `TASK_SWITCH_CALL_SUCCESS` / `FAILED` | `'Task Switch Call ...'` | Switch call result |

### System Events

| Constant | Value | Description |
|----------|-------|-------------|
| `WEBSOCKET_REGISTER_SUCCESS` / `FAILED` | `'Websocket Register ...'` | WebSocket registration result |
| `WEBSOCKET_DEREGISTER_SUCCESS` / `FAIL` | `'Websocket Deregister ...'` | WebSocket deregistration result |
| `WEBSOCKET_EVENT_RECEIVED` | `'Websocket Event Received'` | WebSocket event received |
| `UPLOAD_LOGS_SUCCESS` / `FAILED` | `'Upload Logs ...'` | Log upload result |

### Data Fetch Events

| Constant | Value | Description |
|----------|-------|-------------|
| `ENTRYPOINT_FETCH_SUCCESS` / `FAILED` | `'Entrypoint Fetch ...'` | Entry point fetch result |
| `ADDRESSBOOK_FETCH_SUCCESS` / `FAILED` | `'AddressBook Fetch ...'` | Address book fetch result |
| `QUEUE_FETCH_SUCCESS` / `FAILED` | `'Queue Fetch ...'` | Queue fetch result |
| `OUTDIAL_ANI_EP_FETCH_SUCCESS` / `FAILED` | `'Outdial ANI Entries Fetch ...'` | Outdial ANI entries fetch result |

---

## Behavioral Event Taxonomy

Each behavioral event maps to a structured taxonomy in `behavioral-events.ts`:

```
{product}.{agent}.{target}.{verb}
```

- **product**: Always `'wxcc_sdk'` (from `PRODUCT_NAME`)
- **agent**: `'user'` for user-initiated actions, `'service'` for system-generated events
- **target**: Snake_case description of the action (e.g., `'station_login'`, `'task_accept'`)
- **verb**: `'complete'` for success, `'fail'` for failure, `'set'` for RONA events

**Example**: `STATION_LOGIN_SUCCESS` maps to `wxcc_sdk.user.station_login.complete`

> **Note**: The following events do **not** have behavioral taxonomy mappings in `behavioral-events.ts`:
> - `WEBSOCKET_DEREGISTER_SUCCESS`
> - `WEBSOCKET_DEREGISTER_FAIL`
> - `WEBSOCKET_EVENT_RECEIVED`
>
> Calling `trackBehavioralEvent` with these event names will push an event with an `undefined` taxonomy.

---

## Usage Pattern (timeEvent + trackEvent)

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

---

## Error Handling

MetricsManager is designed to be non-blocking. Metric failures do not propagate to callers:

- If `webex` is not yet ready, events are queued in `pendingBehavioralEvents`, `pendingOperationalEvents`, or `pendingBusinessEvents`
- Once `webex.ready` fires, all pending events are flushed
- If metrics are disabled via `setMetricsDisabled(true)`, all track methods silently return
- Invalid metric types log an error via `LoggerProxy` but do not throw

---

## Dependencies

- **`@webex/internal-plugin-metrics`**: Provides `webex.internal.newMetrics` for actual metric submission (`submitBehavioralEvent`, `submitOperationalEvent`, `submitBusinessEvent`)
- **`LoggerProxy`**: Used for error logging within the metrics module
- **`Failure` type** (from `services/core/GlobalTypes`): Used in `getCommonTrackingFieldForAQMResponseFailed`
- **`PRODUCT_NAME`** (from `constants.ts`): Set to `'wxcc_sdk'`, used as the product identifier in behavioral taxonomy and as prefix for operational/business event names

---

## Related

- [`MetricsManager.ts`](../MetricsManager.ts) - Singleton metrics manager implementation
- [`behavioral-events.ts`](../behavioral-events.ts) - Event taxonomy mapping
- [`constants.ts`](../constants.ts) - `METRIC_EVENT_NAMES` definitions
- [`../../constants.ts`](../../constants.ts) - `PRODUCT_NAME` constant
- [`services/core/GlobalTypes.ts`](../../services/core/GlobalTypes.ts) - `Failure` type definition
