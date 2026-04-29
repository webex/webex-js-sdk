# Voicemail Module — Architecture

## Component Overview

The Voicemail module uses a **strategy pattern** with three backend connectors. Architecture: **Application -> Voicemail (facade) -> BackendConnector (WXC/BWRKS/UCM) -> Backend API**. The facade also integrates with MetricManager for telemetry.

### Component Table

| Layer | Component | File | Key Responsibilities |
|-------|-----------|------|---------------------|
| **Facade** | `Voicemail` | `Voicemail.ts` | Backend detection, connector initialization, API delegation, metric submission |
| **WXC Connector** | `WxCallBackendConnector` | `WxCallBackendConnector.ts` | XSI-based voicemail operations, summary, transcript, contact resolution |
| **BWRKS Connector** | `BroadworksBackendConnector` | `BroadworksBackendConnector.ts` | BW token auth, XSI-based voicemail operations |
| **UCM Connector** | `UcmBackendConnector` | `UcmBackendConnector.ts` | VG Gateway voicemail operations, Mercury event for async content |

### Singletons and Factories

| Component | Access Pattern | Lifecycle |
|-----------|---------------|-----------|
| `Voicemail` | `createVoicemailClient(webex, logger)` factory | One per application |
| `SDKConnector` | Frozen singleton | Global |
| `MetricManager` | `getMetricManager(webex)` singleton | Module-level |

### File Structure

```
Voicemail/
├── Voicemail.ts                        # Facade class
├── Voicemail.test.ts                   # Facade unit tests
├── WxCallBackendConnector.ts           # WXC backend
├── WxCallBackendConnector.test.ts      # WXC tests
├── BroadworksBackendConnector.ts       # Broadworks backend
├── BroadworksBackendConnector.test.ts  # Broadworks tests
├── UcmBackendConnector.ts              # UCM backend
├── UcmBackendConnector.test.ts         # UCM tests
├── types.ts                            # IVoicemail, response types, backend interfaces
├── constants.ts                        # Endpoints, method names
├── voicemailFixture.ts                 # Test fixtures
└── ai-docs/
    ├── AGENTS.md                       # Module agent doc
    └── ARCHITECTURE.md                 # This file
```

---

## Data Flows

### Backend Selection and Delegation

```mermaid
flowchart TB
    subgraph Application
        App[Application Code]
    end

    subgraph VoicemailModule
        VM[Voicemail\nFacade + Metrics]
        WXC[WxCallBackendConnector]
        BW[BroadworksBackendConnector]
        UCM[UcmBackendConnector]
    end

    subgraph External
        XSI_WXC[XSI Actions API\nWXC Auth]
        XSI_BW[XSI Actions API\nBW Token Auth]
        VG[VG Gateway API]
        Mercury[Mercury WebSocket]
        Metrics[MetricManager]
    end

    App -->|createVoicemailClient| VM
    VM -->|WXC backend| WXC
    VM -->|BWRKS backend| BW
    VM -->|UCM backend| UCM

    WXC --> XSI_WXC
    BW --> XSI_BW
    UCM --> VG
    UCM -.->|async content download| Mercury

    VM -->|submitVoicemailMetric| Metrics
```

---

## Sequence Diagrams

### 1. Initialization

```mermaid
sequenceDiagram
    participant App as Application
    participant VM as Voicemail
    participant Conn as BackendConnector

    App->>VM: createVoicemailClient(webex, logger)
    activate VM
    VM->>VM: getCallingBackEnd(webex) -> backend
    VM->>VM: getMetricManager(webex)

    alt WXC
        VM->>Conn: new WxCallBackendConnector(webex, logger)
    else BWRKS
        VM->>Conn: new BroadworksBackendConnector(webex, logger)
    else UCM
        VM->>Conn: new UcmBackendConnector(webex, logger)
    end

    VM-->>App: IVoicemail
    deactivate VM

    App->>VM: init()
    VM->>Conn: init()
    Note over Conn: Resolves XSI/VG endpoint, sets up auth
    Conn-->>VM: VoicemailResponseEvent
    VM-->>App: VoicemailResponseEvent
```

### 2. Get Voicemail List (WXC)

```mermaid
sequenceDiagram
    participant App as Application
    participant VM as Voicemail
    participant WXC as WxCallBackendConnector
    participant XSI as XSI Actions API

    App->>VM: getVoicemailList(offset, limit, sort, refresh=true)
    VM->>WXC: getVoicemailList(offset, limit, sort, true)

    alt refresh=true
        WXC->>XSI: GET {xsiEndpoint}/v2.0/user/{userId}/VoiceMessagingMessages?format=json
        XSI-->>WXC: VoicemailList JSON
        WXC->>WXC: Parse messageInfoList, sort, store in cache
    end

    WXC->>WXC: fetchVoicemailList(context, offset, limit)
    WXC-->>VM: VoicemailResponseEvent

    VM->>VM: submitMetric(response, GET_VOICEMAILS)
    VM-->>App: VoicemailResponseEvent
```

### 3. Get Voicemail Content (UCM — Async)

```mermaid
sequenceDiagram
    participant App as Application
    participant UCM as UcmBackendConnector
    participant VG as VG Gateway
    participant Mercury as Mercury WebSocket

    App->>UCM: getVoicemailContent(messageId)
    UCM->>VG: GET {vgEndpoint}/vmgateway/api/v1/Users/{userId}/voicemails/{messageId}/content
    VG-->>UCM: Response

    alt statusCode 200
        UCM-->>App: {voicemailContent: {type, content}}
    else statusCode 202 (processing)
        UCM->>Mercury: registerListener('event:ucm.voicemail_download_complete')
        Mercury-->>UCM: voicemail_download_complete event

        UCM->>VG: GET .../voicemails/{messageId}/content (retry)
        VG-->>UCM: 200 {voicemailContent}
        UCM->>Mercury: unregisterListener(...)
        UCM-->>App: {voicemailContent: {type, content}}
    end
```

### 4. Voicemail Summary (WXC Only)

```mermaid
sequenceDiagram
    participant App as Application
    participant WXC as WxCallBackendConnector
    participant XSI as XSI Actions API

    App->>WXC: getVoicemailSummary()
    WXC->>XSI: GET {xsiEndpoint}/v2.0/user/{userId}/calls/MessageSummary
    XSI-->>WXC: XML with summary elements
    WXC->>WXC: Parse newMessages, oldMessages, newUrgentMessages, oldUrgentMessages
    WXC-->>App: {voicemailSummary: SummaryInfo}
```

---

## Key Constants

### API Endpoints

| Constant | Value | Description |
|----------|-------|-------------|
| `VOICE_MESSAGING_MESSAGES` | `'VoiceMessagingMessages'` | XSI voicemail messages path |
| `JSON_FORMAT` | `'?format=json'` | JSON format query param for XSI |
| `MARK_AS_READ` | `'MarkAsRead'` | XSI mark as read endpoint |
| `MARK_AS_UNREAD` | `'MarkAsUnread'` | XSI mark as unread endpoint |
| `MESSAGE_MEDIA_CONTENT` | `'messageMediaContent'` | XML tag for voicemail content |
| `MESSAGE_SUMMARY` | `'MessageSummary'` | XSI message summary path |
| `BW_TOKEN_FETCH_ENDPOINT` | `'/idp/bwtoken/fetch'` | Broadworks token endpoint |
| `VMGATEWAY` | `'vmgateway'` | UCM VG Gateway path segment |
| `API_V1` | `'api/v1'` | UCM VG API version |
| `VOICEMAILS` | `'voicemails'` | UCM voicemails path segment |

### Pagination Defaults

| Constant | Value | Description |
|----------|-------|-------------|
| `OFFSET_INDEX` | `0` | Default pagination offset |
| `OFFSET_LIMIT` | `100` | Default pagination limit |
| `NO_VOICEMAIL_STATUS_CODE` | `204` | Status when no more voicemails |

---

## Troubleshooting Guide

### 1. Init Fails

**Symptoms:** `init()` throws or returns error

**Possible Causes:**
- XSI endpoint not resolvable (WXC/BWRKS)
- Broadworks token fetch failed (BWRKS)
- VG endpoint not resolvable (UCM)

### 2. Voicemail List Empty

**Symptoms:** `getVoicemailList` returns empty list

**Possible Causes:**
- `refresh` parameter not set to `true` on first call
- No voicemails exist for the user
- XSI/VG service unavailable

### 3. UCM Content Returns 202

**Symptoms:** `getVoicemailContent` takes long to resolve on UCM

**Explanation:** UCM may return 202 (processing) when content needs to be downloaded from the voicemail server. The connector registers a Mercury listener for `event:ucm.voicemail_download_complete` and retries automatically.

### 4. Summary/Transcript Returns null

**Symptoms:** `getVoicemailSummary` or `getVMTranscript` returns null

**Explanation:** These features are only supported on WXC. Broadworks and UCM connectors return `null`.

### 5. Contact Resolution Returns null

**Symptoms:** `resolveContact` returns null

**Explanation:** Only the WXC connector implements contact resolution. BWRKS and UCM return `null`.

---

## Related Documentation

- [AGENTS.md](./AGENTS.md) — Overview, examples, public API
