# CallSettings Module — Architecture

## Component Overview

The CallSettings module uses a **strategy pattern**: the `CallSettings` facade delegates all operations to a backend-specific connector chosen at construction time. The architecture is: **Application -> CallSettings -> BackendConnector (WXC or UCM) -> Backend API**.

### Component Table

| Layer | Component | File | Key Responsibilities |
|-------|-----------|------|---------------------|
| **Facade** | `CallSettings` | `CallSettings.ts` | Backend detection, connector initialization, API delegation |
| **WXC Connector** | `WxCallBackendConnector` | `WxCallBackendConnector.ts` | XSI Actions (call waiting), Hydra People API (DND, CF, VM, CFA) |
| **UCM Connector** | `UcmBackendConnector` | `UcmBackendConnector.ts` | Webex APIs for CFA with directory number; 501 for unsupported methods |

### Singletons and Factories

| Component | Access Pattern | Lifecycle |
|-----------|---------------|-----------|
| `CallSettings` | `createCallSettingsClient(webex, logger, useProdWebexApis?)` factory | One per application |
| `SDKConnector` | Frozen singleton via `import SDKConnector` | Global, set once via `setWebex()` |
| `WxCallBackendConnector` | Created internally by `CallSettings.initializeBackendConnector()` | One per CallSettings |
| `UcmBackendConnector` | Created internally by `CallSettings.initializeBackendConnector()` | One per CallSettings |

### File Structure

```
CallSettings/
├── CallSettings.ts                 # Facade class with backend delegation
├── CallSettings.test.ts            # Facade unit tests
├── WxCallBackendConnector.ts       # WXC/Broadworks backend implementation
├── WxCallBackendConnector.test.ts  # WXC connector unit tests
├── UcmBackendConnector.ts          # UCM backend implementation
├── UcmBackendConnector.test.ts     # UCM connector unit tests
├── types.ts                        # ICallSettings, setting types, response types
├── constants.ts                    # Endpoints, method names
├── testFixtures.ts                 # Test fixtures
└── ai-docs/
    ├── AGENTS.md                   # Module agent doc
    └── ARCHITECTURE.md             # This file
```

---

## Data Flows

### Backend Selection Flow

```mermaid
flowchart TB
    subgraph Application
        App[Application Code]
    end

    subgraph CallSettingsModule
        CS[CallSettings\nFacade]
        WXC[WxCallBackendConnector]
        UCM[UcmBackendConnector]
    end

    subgraph External
        XSI[XSI Actions API\nCall Waiting XML]
        Hydra[Hydra People API\nDND/CF/VM JSON]
        WebexAPI[Webex APIs\nUCM CFA]
    end

    App -->|createCallSettingsClient| CS
    CS -->|WXC/BWRKS backend| WXC
    CS -->|UCM backend| UCM

    WXC -->|getCallWaitingSetting| XSI
    WXC -->|DND/CF/VM APIs| Hydra
    WXC -->|getCallForwardAlwaysSetting| Hydra

    UCM -->|getCallForwardAlwaysSetting| WebexAPI
    UCM -->|other methods| UCM
    UCM -.->|501 Not Supported| App
```

---

## Sequence Diagrams

### 1. Backend Connector Initialization

```mermaid
sequenceDiagram
    participant App as Application
    participant CS as CallSettings
    participant Utils as getCallingBackEnd()

    App->>CS: createCallSettingsClient(webex, logger)
    activate CS
    CS->>CS: SDKConnector.setWebex(webex)
    CS->>Utils: getCallingBackEnd(webex)
    Utils-->>CS: CALLING_BACKEND (WXC | UCM | BWRKS)

    alt WXC or BWRKS
        CS->>CS: new WxCallBackendConnector(webex, logger)
    else UCM
        CS->>CS: new UcmBackendConnector(webex, logger, useProdWebexApis)
    end

    CS-->>App: ICallSettings
    deactivate CS
```

### 2. Get Call Waiting (WXC — XSI Actions)

```mermaid
sequenceDiagram
    participant App as Application
    participant CS as CallSettings
    participant WXC as WxCallBackendConnector
    participant XSI as XSI Actions API

    App->>CS: getCallWaitingSetting()
    CS->>WXC: getCallWaitingSetting()
    activate WXC

    alt XSI endpoint not cached
        WXC->>WXC: getXsiActionEndpoint(webex)
    end

    WXC->>XSI: GET /{xsiEndpoint}/v2.0/user/{userId}/services/CallWaiting
    Note over WXC,XSI: Authorization: getUserToken()
    XSI-->>WXC: XML response with <active> element

    WXC->>WXC: Parse XML, extract active status
    WXC-->>CS: {statusCode: 200, data: {callSetting: {enabled: true/false}}}
    deactivate WXC
    CS-->>App: CallSettingResponse
```

### 3. Get/Set DND (WXC — Hydra API)

```mermaid
sequenceDiagram
    participant App as Application
    participant WXC as WxCallBackendConnector
    participant Hydra as Hydra People API

    App->>WXC: getDoNotDisturbSetting()
    WXC->>Hydra: GET /people/{personId}/features/doNotDisturb?orgId={orgId}
    Hydra-->>WXC: {enabled: true, ringSplashEnabled: false}
    WXC-->>App: {statusCode: 200, data: {callSetting: ToggleSetting}}

    App->>WXC: setDoNotDisturbSetting(true)
    WXC->>Hydra: PUT /people/{personId}/features/doNotDisturb?orgId={orgId}
    Note over WXC,Hydra: Body: {enabled: true, ringSplashEnabled: false}
    Hydra-->>WXC: 200 OK
    WXC-->>App: {statusCode: 200, data: {callSetting: ToggleSetting}}
```

### 4. Get Call Forward Always (WXC — Composite)

```mermaid
sequenceDiagram
    participant App as Application
    participant WXC as WxCallBackendConnector
    participant Hydra as Hydra People API

    App->>WXC: getCallForwardAlwaysSetting()
    WXC->>Hydra: GET /people/{personId}/features/callForwarding?orgId=...
    Hydra-->>WXC: CallForwardSetting

    alt CFA enabled with destination
        WXC-->>App: {callSetting: {enabled: true, destination: '+15551234'}}
    else CFA enabled but no destination
        WXC->>Hydra: GET /people/{personId}/features/voicemail?orgId=...
        Hydra-->>WXC: VoicemailSetting

        alt VM enabled and sendAllCalls enabled
            WXC-->>App: {callSetting: {enabled: true, destination: 'VOICEMAIL'}}
        else No CFA set
            WXC-->>App: {callSetting: {enabled: false, destination: undefined}}
        end
    end
```

### 5. Get Call Forward Always (UCM — Directory Number)

```mermaid
sequenceDiagram
    participant App as Application
    participant UCM as UcmBackendConnector
    participant API as Webex APIs

    App->>UCM: getCallForwardAlwaysSetting(directoryNumber)

    alt No directoryNumber provided
        UCM-->>App: {statusCode: 400, error: 'Directory Number is mandatory for UCM backend'}
    else directoryNumber provided
        UCM->>API: GET /people/{userId}/features/callforwarding?orgId=...
        API-->>UCM: {callForwarding: {always: [{dn, destination, destinationVoicemailEnabled, e164Number}]}}

        UCM->>UCM: Find CFA entry matching directoryNumber

        alt Match found
            alt destinationVoicemailEnabled
                UCM-->>App: {callSetting: {enabled: true, destination: 'VOICEMAIL'}}
            else has destination
                UCM-->>App: {callSetting: {enabled: true, destination: '...'}}
            end
        else No match
            UCM-->>App: {statusCode: 404, error: 'Directory Number is not assigned to the user'}
        end
    end
```

---

## Key Constants

### API Endpoints

| Constant | Value | Description |
|----------|-------|-------------|
| `PEOPLE_ENDPOINT` | `'people'` | Hydra People API path segment |
| `DND_ENDPOINT` | `'features/doNotDisturb'` | DND feature endpoint |
| `CF_ENDPOINT` | `'features/callForwarding'` | Call forwarding feature endpoint |
| `VM_ENDPOINT` | `'features/voicemail'` | Voicemail feature endpoint |
| `CALL_WAITING_ENDPOINT` | `'CallWaiting'` | XSI call waiting service endpoint |
| `XSI_VERSION` | `'v2.0'` | XSI Actions API version |
| `ORG_ENDPOINT` | `'orgId'` | Organization ID query parameter |
| `USER_ENDPOINT` | `'user'` | XSI user path segment |

---

## Troubleshooting Guide

### 1. 501 Not Supported for UCM

**Symptoms:** Methods like `getCallWaitingSetting`, `getDoNotDisturbSetting`, etc. return `statusCode: 501`

**Explanation:** The UCM backend connector intentionally returns 501 for most methods. Only `getCallForwardAlwaysSetting` is implemented for UCM.

### 2. Call Waiting Fails on WXC

**Symptoms:** `getCallWaitingSetting` returns an error

**Possible Causes:**
- XSI Actions endpoint not resolvable
- User token expired
- XSI service unavailable

**What happens internally:**
The WXC connector lazily resolves the XSI endpoint on first call and caches it. If resolution fails, the error propagates.

### 3. CFA Returns Wrong State

**Symptoms:** `getCallForwardAlwaysSetting` returns unexpected enabled/destination values

**What happens internally (WXC):**
1. Fetches full call forwarding settings
2. If CFA `enabled` is true AND `destination` is set: returns the destination
3. If CFA `enabled` is true but no destination: checks voicemail settings
4. If voicemail `enabled` AND `sendAllCalls.enabled`: returns `destination: 'VOICEMAIL'`
5. Otherwise: returns `enabled: false`

### 4. UCM CFA Requires Directory Number

**Symptoms:** `getCallForwardAlwaysSetting()` returns `statusCode: 400` on UCM

**Fix:** Pass the user's directory number: `getCallForwardAlwaysSetting('1234')`

---

## Related Documentation

- [AGENTS.md](./AGENTS.md) — Overview, examples, public API
