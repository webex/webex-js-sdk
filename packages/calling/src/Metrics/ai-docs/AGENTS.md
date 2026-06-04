# Metrics Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

Do **not** use this file as your only entry point for reasoning or code generation.

- **How to proceed:**
  - For changes within the `Metrics/` directory, use this file as your primary reference.
  - For understanding how MetricManager integrates with other modules (CallingClient, Registration, Call, Voicemail), also load the relevant module's `ai-docs/AGENTS.md`.
  - For error types (`CallError`, `CallingClientError`, `LineError`), refer to `Errors/` directory.
- **Important:** Load this module-specific doc first, then drill into other module docs as needed for context on metric consumers.

---

## Overview

The `Metrics` module provides a centralized `MetricManager` singleton for collecting and submitting client-side telemetry metrics to the Webex cloud via `@webex/internal-plugin-metrics`. All other modules in the Calling SDK use MetricManager to report operational and behavioral events including registration, call control, media negotiation, voicemail operations, network connectivity, BNR toggles, log uploads, and Mobius server discovery.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/Metrics/index.ts`

**Factory:** `getMetricManager(webex?, indicator?) -> IMetricManager`

---

### Key Capabilities

| Capability | Description |
| ----------- | ----------- |
| **Registration Metrics** | Tracks registration success/error and keepalive failures with server type, tracking ID, and error details. |
| **Call Control Metrics** | Reports call lifecycle events and errors with call ID and correlation ID. |
| **Media Metrics** | Captures media negotiation events (ROAP offer/answer) and errors, including local and remote SDP details. |
| **Connection Metrics** | Records network connectivity events: network flaps, Mercury up/down transitions with timestamps. |
| **Voicemail Metrics** | Tracks voicemail operations (list, read, delete, transcript) and their errors with message IDs and status codes. |
| **BNR Metrics** | Reports Background Noise Reduction enable/disable events for specific calls. |
| **Upload Logs Metrics** | Records success/failure of diagnostic log uploads with tracking IDs and correlation info. |
| **Mobius Discovery Metrics** | Captures region information and Mobius server discovery results including primary/backup server URIs. |

---

## Public API

### IMetricManager Interface

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `setDeviceInfo` | `(deviceInfo: IDeviceInfo) => void` | Sets device info for all subsequent metrics |
| `submitRegistrationMetric` | `(name, metricAction, type, caller, serverType, trackingId, keepaliveCount?, error?) => void` | Submit registration/keepalive metrics |
| `submitCallMetric` | `(name, metricAction, type, callId, correlationId, callError?) => void` | Submit call control metrics |
| `submitMediaMetric` | `(name, metricAction, type, callId, correlationId, localSdp?, remoteSdp?, callError?) => void` | Submit media negotiation metrics |
| `submitConnectionMetrics` | `(name, metricAction, type, downTimestamp, upTimestamp) => void` | Submit network connectivity metrics |
| `submitVoicemailMetric` | `(name, metricAction, type, messageId?, voicemailError?, statusCode?) => void` | Submit voicemail metrics |
| `submitBNRMetric` | `(name, type, callId, correlationId) => void` | Submit BNR enable/disable metrics |
| `submitUploadLogsMetric` | `(name, action, type, trackingId?, feedbackId?, correlationId?, stack?, callId?, broadworksCorrelationInfo?) => void` | Submit log upload metrics |
| `submitRegionInfoMetric` | `(name, metricAction, type, mobiusHost, clientRegion, countryCode, trackingId) => void` | Submit region discovery metrics |
| `submitMobiusServersMetric` | `(name, metricAction, type, mobiusServers, trackingId) => void` | Submit Mobius server discovery metrics |

### Enums

#### METRIC_TYPE

| Value | Description |
| ----- | ----------- |
| `OPERATIONAL` | Operational metric for system health monitoring |
| `BEHAVIORAL` | Behavioral metric for user/application action tracking |

#### METRIC_EVENT

| Value | String | Description |
| ----- | ------ | ----------- |
| `BNR_ENABLED` | `web-calling-sdk-bnr-enabled` | BNR was enabled |
| `BNR_DISABLED` | `web-calling-sdk-bnr-disabled` | BNR was disabled |
| `CALL` | `web-calling-sdk-callcontrol` | Call control action succeeded |
| `CALL_ERROR` | `web-calling-sdk-callcontrol-error` | Call control action failed |
| `CONNECTION_ERROR` | `web-calling-sdk-connection` | Connection/network event |
| `MEDIA` | `web-calling-sdk-media` | Media negotiation succeeded |
| `MEDIA_ERROR` | `web-calling-sdk-media-error` | Media negotiation failed |
| `REGISTRATION` | `web-calling-sdk-registration` | Registration succeeded |
| `REGISTRATION_ERROR` | `web-calling-sdk-registration-error` | Registration failed |
| `KEEPALIVE_ERROR` | `web-calling-sdk-keepalive-error` | Keepalive failed |
| `VOICEMAIL` | `web-calling-sdk-voicemail` | Voicemail operation succeeded |
| `VOICEMAIL_ERROR` | `web-calling-sdk-voicemail-error` | Voicemail operation failed |
| `UPLOAD_LOGS_SUCCESS` | `web-calling-sdk-upload-logs-success` | Log upload succeeded |
| `UPLOAD_LOGS_FAILED` | `web-calling-sdk-upload-logs-failed` | Log upload failed |
| `MOBIUS_DISCOVERY` | `web-calling-sdk-mobius-discovery` | Mobius discovery event |

#### REG_ACTION

| Value | Description |
| ----- | ----------- |
| `REGISTER` | Registration action |
| `DEREGISTER` | Deregistration action |
| `KEEPALIVE_FAILURE` | Keepalive failure action |

#### CONNECTION_ACTION

| Value | Description |
| ----- | ----------- |
| `NETWORK_FLAP` | Network went offline and back online |
| `MERCURY_DOWN` | Mercury WebSocket disconnected |
| `MERCURY_UP` | Mercury WebSocket reconnected |

#### VOICEMAIL_ACTION

| Value | Description |
| ----- | ----------- |
| `GET_VOICEMAILS` | List voicemails |
| `GET_VOICEMAIL_CONTENT` | Get voicemail content |
| `GET_VOICEMAIL_SUMMARY` | Get voicemail summary |
| `MARK_READ` | Mark as read |
| `MARK_UNREAD` | Mark as unread |
| `DELETE` | Delete voicemail |
| `TRANSCRIPT` | Get transcript |

#### Other Action Enums

| Enum | Values | Description |
| ---- | ------ | ----------- |
| `TRANSFER_ACTION` | `BLIND`, `CONSULT` | Call transfer types |
| `MOBIUS_SERVER_ACTION` | `REGION_INFO`, `MOBIUS_SERVERS` | Mobius discovery actions |

### Types

| Type | Definition | Description |
| ---- | ---------- | ----------- |
| `SERVER_TYPE` | `'PRIMARY' \| 'BACKUP' \| 'UNKNOWN'` | Server type for registration metrics |
| `UPLOAD_LOGS_ACTION` | `'upload_logs'` (const) | Action string for log upload metrics |

---

## Configuration

The `MetricManager` is configured through:

1. **Constructor parameters:** `webex` SDK instance and optional `ServiceIndicator`.
2. **Device info:** Set via `setDeviceInfo()` after registration, populates device fields in all metrics.
3. **SDK version:** Resolved from `process.env.CALLING_SDK_VERSION` with fallback to `VERSION` constant.

---

## Examples and Use Cases

### Get the MetricManager Singleton

```typescript
import {getMetricManager} from '@webex/calling';

const metricManager = getMetricManager(webex, ServiceIndicator.CALLING);
// Subsequent calls return the same instance
const same = getMetricManager();
```

### Set Device Information

```typescript
metricManager.setDeviceInfo(deviceInfo);
```

### Submit Registration Metric

```typescript
metricManager.submitRegistrationMetric(
  METRIC_EVENT.REGISTRATION,
  REG_ACTION.REGISTER,
  METRIC_TYPE.BEHAVIORAL,
  'Registration',
  'PRIMARY',
  trackingId
);
```

### Submit Call Metric

```typescript
metricManager.submitCallMetric(
  METRIC_EVENT.CALL,
  'S_SEND_CALL_SETUP',
  METRIC_TYPE.BEHAVIORAL,
  callId,
  correlationId
);
```

### Submit Connection Metric

```typescript
metricManager.submitConnectionMetrics(
  METRIC_EVENT.CONNECTION_ERROR,
  CONNECTION_ACTION.NETWORK_FLAP,
  METRIC_TYPE.BEHAVIORAL,
  downTimestamp,
  upTimestamp
);
```

---

## Implementation Notes

### Singleton Pattern

`getMetricManager()` stores the singleton at module level. First call with a `webex` parameter creates the instance; subsequent calls (even without parameters) return the same instance.

```typescript
// First call creates the instance
const mm = getMetricManager(webex, ServiceIndicator.CALLING);
// Subsequent calls reuse it
const same = getMetricManager(); // returns same instance
```

### Error Object Access Patterns

Different error types expose their data through different methods:
- `CallError`: `callError.getCallError().message` / `.type`
- `LineError` / `CallingClientError`: `clientError.getError().message` / `.type`

### Metric Data Structure

All metrics follow this shape:
```typescript
{
  tags: { action?, device_id?, service_indicator?, ...method-specific },
  fields: { device_url?, mobius_url?, calling_sdk_version, ...method-specific },
  type: 'operational' | 'behavioral'
}
```

### Per-Method Variations

Not all methods include the same base fields:
- **Voicemail metrics**: No `mobius_url` in fields, no `service_indicator` in tags. Uses `typeof process !== 'undefined'` guard. Error data (`error`, `status_code`) goes in **tags** not fields.
- **Connection metrics**: The tag key is literally `metricAction` (not aliased to `action`).
- **BNR metrics**: No `action` tag at all (no `metricAction` parameter).
- **Region Info / Mobius Servers metrics**: Always hardcode `ServiceIndicator.CALLING` regardless of constructor `indicator` param.
- **Registration metrics**: Uses `trackingId` (camelCase) as field key. Upload logs uses `tracking_id` (snake_case).

### Conditional Submission

- `submitCallMetric(CALL_ERROR)`: Only submits if `callError` param is provided
- `submitMediaMetric(MEDIA_ERROR)`: Only submits if `callError` param is provided
- `submitUploadLogsMetric`: Silently skips if name doesn't match (no warning log)

---

## Dependencies

### Runtime Dependencies

| Package | Purpose |
| ------- | ------- |
| `@webex/internal-plugin-metrics` | Underlying metrics submission via `webex.internal.metrics.submitClientMetrics(name, data)` |

### Internal Dependencies

| Module | Purpose |
| ------ | ------- |
| `SDKConnector` | Provides the WebexSDK instance for metric submission |
| `Logger` | Warning logs for invalid metric names |
| `Errors` (CallError, CallingClientError, LineError) | Error objects parsed for error message and type fields |
| `CallingClient/constants` | Provides `METRIC_FILE` and `VERSION` constants |
| `common/types` | Provides `CallId`, `CorrelationId`, `IDeviceInfo`, `MobiusServers`, `ServiceIndicator` |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams
