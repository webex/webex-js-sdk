# Metrics Module — Architecture

## Component Overview

The Metrics module is a centralized telemetry singleton used by all other Calling SDK modules. Architecture: **Calling Modules -> MetricManager -> webex.internal.metrics -> Webex Cloud**.

### Component Table

| Layer | Component | File | Key Responsibilities |
|-------|-----------|------|---------------------|
| **Manager** | `MetricManager` | `index.ts` | Metric data construction, device info enrichment, metric submission |
| **Types** | Enums and interfaces | `types.ts` | `IMetricManager`, `METRIC_EVENT`, `METRIC_TYPE`, action enums |

### Singletons and Factories

| Component | Access Pattern | Lifecycle |
|-----------|---------------|-----------|
| `MetricManager` | `getMetricManager(webex?, indicator?)` module-level singleton | Created on first call with `webex`, reused thereafter |

### File Structure

```
Metrics/
├── index.ts            # MetricManager class and getMetricManager factory
├── index.test.ts       # Unit tests
├── types.ts            # IMetricManager interface, all enums and types
└── ai-docs/
    ├── AGENTS.md       # Module agent doc
    └── ARCHITECTURE.md # This file
```

---

## Data Flows

### Metric Submission Flow

```mermaid
flowchart TB
    subgraph CallingModules
        CC[CallingClient]
        Reg[Registration]
        Call[Call]
        VM[Voicemail]
    end

    subgraph MetricsModule
        MM[MetricManager\nsingleton]
    end

    subgraph WebexSDK
        Metrics[webex.internal.metrics\nsubmitClientMetrics]
    end

    subgraph Cloud
        WebexCloud[Webex Metrics Service]
    end

    CC -->|submitRegistrationMetric\nsubmitConnectionMetrics\nsubmitMobiusServersMetric\nsubmitUploadLogsMetric| MM
    Reg -->|submitRegistrationMetric| MM
    Call -->|submitCallMetric\nsubmitMediaMetric\nsubmitBNRMetric| MM
    VM -->|submitVoicemailMetric| MM

    MM -->|submitClientMetrics(name, data)| Metrics
    Metrics --> WebexCloud
```

### Metric Data Structure

Every metric submitted follows this pattern:

```mermaid
flowchart LR
    subgraph MetricPayload
        Tags[tags:\naction, device_id,\nservice_indicator]
        Fields[fields:\ndevice_url, mobius_url,\ncalling_sdk_version,\n+ metric-specific fields]
        Type[type:\noperational | behavioral]
    end
```

---

## Sequence Diagrams

### 1. MetricManager Initialization

```mermaid
sequenceDiagram
    participant Module as CallingClient/Voicemail
    participant MM as getMetricManager()
    participant Manager as MetricManager

    Module->>MM: getMetricManager(webex, indicator)

    alt First call (metricManager is null)
        MM->>Manager: new MetricManager(webex, indicator)
        Manager->>Manager: Store webex and serviceIndicator
        MM->>MM: Store singleton reference
    end

    MM-->>Module: IMetricManager

    Note over Module: After registration completes
    Module->>Manager: setDeviceInfo(deviceInfo)
    Manager->>Manager: Store deviceInfo for metric enrichment
```

### 2. Registration Metric Submission

```mermaid
sequenceDiagram
    participant Reg as Registration
    participant MM as MetricManager
    participant SDK as webex.internal.metrics

    Reg->>MM: submitRegistrationMetric(REGISTRATION, REGISTER, BEHAVIORAL, caller, PRIMARY, trackingId)

    MM->>MM: Build metric data
    Note over MM: tags: {action, device_id, service_indicator}
    Note over MM: fields: {device_url, mobius_url, sdk_version, reg_source, server_type, trackingId}

    MM->>SDK: submitClientMetrics('web-calling-sdk-registration', data)
```

### 3. Call Error Metric Submission

```mermaid
sequenceDiagram
    participant Call as Call
    participant MM as MetricManager
    participant SDK as webex.internal.metrics

    Call->>MM: submitCallMetric(CALL_ERROR, action, BEHAVIORAL, callId, correlationId, callError)

    MM->>MM: Extract error message and type from callError
    MM->>MM: Build metric data with error fields

    MM->>SDK: submitClientMetrics('web-calling-sdk-callcontrol-error', data)
```

### 4. Voicemail Metric Submission

```mermaid
sequenceDiagram
    participant VM as Voicemail
    participant MM as MetricManager
    participant SDK as webex.internal.metrics

    alt Success
        VM->>MM: submitVoicemailMetric(VOICEMAIL, GET_VOICEMAILS, BEHAVIORAL, messageId)
        MM->>SDK: submitClientMetrics('web-calling-sdk-voicemail', data)
    else Error
        VM->>MM: submitVoicemailMetric(VOICEMAIL_ERROR, GET_VOICEMAILS, BEHAVIORAL, messageId, errorMsg, statusCode)
        MM->>SDK: submitClientMetrics('web-calling-sdk-voicemail-error', data)
    end
```

### 5. Connection Metric Submission

```mermaid
sequenceDiagram
    participant CC as CallingClient
    participant MM as MetricManager
    participant SDK as webex.internal.metrics

    CC->>MM: submitConnectionMetrics(CONNECTION_ERROR, NETWORK_FLAP, BEHAVIORAL, downTs, upTs)

    MM->>MM: Build data with downTimestamp and upTimestamp
    MM->>SDK: submitClientMetrics('web-calling-sdk-connection', data)
```

---

## Key Constants

### Common Metric Fields

Every metric includes these base fields from `MetricManager` state:

| Field | Source | Description |
|-------|--------|-------------|
| `device_id` | `deviceInfo.device.deviceId` | Registered device identifier |
| `device_url` | `deviceInfo.device.clientDeviceUri` | Client device URI |
| `mobius_url` | `deviceInfo.device.uri` | Mobius server URI |
| `calling_sdk_version` | `process.env.CALLING_SDK_VERSION \|\| VERSION` | SDK version string |
| `service_indicator` | Constructor `indicator` param | Service type (CALLING, etc.) |

### Metric Name Validation

The `MetricManager` validates the `name` parameter against expected `METRIC_EVENT` values using switch statements. If an invalid name is received, it logs a warning and does not submit the metric. This prevents malformed telemetry from being sent.

---

## Troubleshooting Guide

### 1. Metrics Not Appearing in Dashboard

**Symptoms:** Metrics not visible in Webex metrics dashboard

**Possible Causes:**
- `MetricManager` not initialized with `webex` parameter
- `webex.internal.metrics` plugin not loaded
- `setDeviceInfo()` not called (device fields will be undefined)

### 2. Device Fields Are Undefined

**Symptoms:** Metrics show `device_id: undefined`, `device_url: undefined`

**Fix:** Ensure `setDeviceInfo(deviceInfo)` is called after successful device registration. The MetricManager stores this for all subsequent metrics.

### 3. Invalid Metric Name Warning

**Symptoms:** Log warning: "Invalid metric name received. Rejecting request to submit metric."

**Cause:** A `METRIC_EVENT` value was passed that doesn't match the expected switch cases for that submit method. Each method only accepts specific event names.

### 4. SDK Version Shows 'unknown'

**Symptoms:** `calling_sdk_version` field is `'unknown'`

**Cause:** `process.env.CALLING_SDK_VERSION` is not set. This is expected in certain build environments. The `VERSION` constant from `CallingClient/constants.ts` provides the fallback.

---

## Related Documentation

- [AGENTS.md](./AGENTS.md) — Overview, examples, public API
