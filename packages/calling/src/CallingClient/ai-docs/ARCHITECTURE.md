# CallingClient Module — Architecture

## Component Overview

The CallingClient module follows a layered architecture: **Application → CallingClient → Line → Registration / CallManager → SDKConnector → Webex SDK / Mobius API**. Each layer has a distinct responsibility — orchestration (CallingClient), line management (Line), device registration (Registration), call lifecycle (CallManager/Call), and SDK bridging (SDKConnector).

### Component Table

| Layer | Component | File | Key Responsibilities |
|-------|-----------|------|---------------------|
| **Orchestrator** | `CallingClient` | `CallingClient.ts` | Mobius discovery, line creation, network resilience, session listener, media engine config |
| **Line Management** | `Line` | `line/index.ts` | Registration orchestration, call initiation, incoming call forwarding, line event emission |
| **Registration** | `Registration` | `registration/register.ts` | Device register/deregister, keepalive via web worker, failover/failback, reconnection |
| **Call Management** | `CallManager` | `calling/callManager.ts` | Call collection, WebSocket event routing, call creation/deletion |
| **Call** | `Call` | `calling/call.ts` | Single call lifecycle via XState, media negotiation (ROAP), hold/resume/transfer/mute |
| **SDK Bridge** | `SDKConnector` | `SDKConnector/index.ts` | Singleton Webex SDK wrapper, HTTP requests, Mercury listener registration |
| **Metrics** | `MetricManager` | `Metrics/index.ts` | Telemetry submission for registration, calls, errors, BNR |
| **Logging** | `Logger` | `Logger/index.ts` | Structured logging with file/method context |

### Singletons and Factories

| Component | Access Pattern | Lifecycle |
|-----------|---------------|-----------|
| `CallingClient` | `createClient(webex, config)` factory | One per application |
| `SDKConnector` | `import SDKConnector from '../../SDKConnector'` (frozen instance) | Global, set once via `setWebex()` |
| `CallManager` | `getCallManager(webex, indicator)` | Module-level singleton |
| `MetricManager` | `getMetricManager(webex, indicator)` | Module-level singleton |
| `Line` | Created internally by `CallingClient.createLine()` | One per CallingClient, stored in `lineDict` |
| `Registration` | Created internally by `Line` constructor via `createRegistration()` | One per Line |
| `Call` | Created by `CallManager.createCall()` | One per active call |

### File Structure

```
CallingClient/
├── CallingClient.ts                    # Main orchestrator class
├── CallingClient.test.ts               # Unit tests
├── types.ts                            # ICallingClient, CallingClientConfig
├── constants.ts                        # All constants (endpoints, timers, methods)
├── callingClientFixtures.ts            # Test fixtures
├── callRecordFixtures.ts               # Call record test fixtures
├── windowsChromiumIceWarmupUtils.ts    # ICE warmup for Windows Chromium
├── ai-docs/
│   ├── AGENTS.md                       # This module's agent doc (you are here)
│   └── ARCHITECTURE.md                 # This file
├── line/
│   ├── index.ts                        # Line class
│   ├── types.ts                        # ILine, LINE_EVENTS
│   ├── line.test.ts                    # Line unit tests
│   └── ai-docs/
│       ├── AGENTS.md                   # Line-specific agent doc
│       └── ARCHITECTURE.md             # Line-specific architecture
├── registration/
│   ├── index.ts                        # Re-exports
│   ├── register.ts                     # Registration class
│   ├── types.ts                        # IRegistration
│   ├── webWorker.ts                    # Keepalive web worker
│   ├── webWorkerStr.ts                 # Stringified worker for Blob URL
│   ├── registerFixtures.ts             # Test fixtures
│   ├── register.test.ts               # Unit tests
│   ├── webWorker.test.ts              # Worker unit tests
│   └── ai-docs/
│       ├── AGENTS.md                   # Registration-specific agent doc
│       └── ARCHITECTURE.md             # Registration-specific architecture
└── calling/
    ├── index.ts                        # Re-exports
    ├── call.ts                         # Call class (XState)
    ├── call.test.ts                    # Call unit tests
    ├── callManager.ts                  # CallManager class
    ├── callManager.test.ts             # CallManager unit tests
    ├── types.ts                        # ICall, ICallManager
    └── CallerId/
        ├── index.ts                    # Caller ID resolution
        └── index.test.ts              # Unit tests
```

---

## Data Flows

### Layer Communication Flow

```mermaid
graph TB
    subgraph "Application"
        App[Application Code]
    end

    subgraph "Orchestrator Layer"
        CC[CallingClient<br/>Eventing&lt;CallingClientEventTypes&gt;]
    end

    subgraph "Line Layer"
        Line[Line<br/>Eventing&lt;LineEventTypes&gt;]
    end

    subgraph "Registration Layer"
        Reg[Registration<br/>IRegistration]
        Worker[Web Worker<br/>Keepalive]
    end

    subgraph "Call Layer"
        CM[CallManager<br/>Eventing&lt;CallEventTypes&gt;]
        Call[Call<br/>Eventing&lt;CallEventTypes&gt;]
    end

    subgraph "Infrastructure"
        SDK[SDKConnector<br/>singleton]
        Metrics[MetricManager<br/>singleton]
    end

    subgraph "External"
        Webex[Webex SDK]
        Mercury[Mercury WebSocket]
        Mobius[Mobius REST API]
    end

    App -->|createClient| CC
    CC -->|createLine| Line
    Line -->|createRegistration| Reg
    Reg -->|start/stop| Worker
    Line -->|makeCall| CM
    CM -->|createCall| Call

    CC -->|emit: error, sessions| App
    Line -->|emit: registered, incoming_call, error| App
    Call -->|emit: established, disconnect, hold, etc.| App

    SDK -->|request| Webex
    SDK -->|registerListener| Mercury
    Webex -->|HTTP| Mobius
    Mercury -->|event:mobius| CM

    Reg -->|POST /devices| Mobius
    Worker -->|POST /status| Mobius

    style CC fill:#e1f5ff
    style Line fill:#e8f5e9
    style Reg fill:#fff3e0
    style CM fill:#f3e5f5
    style Call fill:#f3e5f5
    style SDK fill:#fce4ec
```

---

## Sequence Diagrams

### 1. Initialization and Line Registration

```mermaid
sequenceDiagram
    participant App as Application
    participant CC as CallingClient
    participant Line as Line
    participant Reg as Registration
    participant Worker as WebWorker
    participant Mobius as Mobius API
    participant Mercury as Mercury WS

    App->>CC: createClient(webex, config)
    activate CC
    CC->>CC: constructor()
    CC->>CC: SDKConnector.setWebex(webex)
    CC->>CC: getCallManager(), getMetricManager()
    CC->>CC: registerSessionsListener()
    CC->>CC: registerCallsClearedListener()

    CC->>CC: init()
    CC->>CC: windowsChromiumIceWarmup() [if Windows]
    CC->>Mobius: getClientRegionInfo()
    Mobius-->>CC: {region, countryCode}
    CC->>Mobius: getMobiusServers()
    Mobius-->>CC: {primary: [...], backup: [...]}

    CC->>Line: new Line(userId, deviceUri, mutex, mobiusUris, ...)
    activate Line
    Line->>Reg: createRegistration(lineEmitter, ...)
    Line->>Line: incomingCallListener()
    deactivate Line

    CC->>Line: register()
    activate Line
    Line->>Line: emit(LINE_EVENTS.CONNECTING)
    Line->>Reg: triggerRegistration()
    activate Reg
    Reg->>Mobius: POST /devices (register)
    Mobius-->>Reg: 200 {device: {...}}
    Reg->>Reg: setStatus(ACTIVE)
    Reg->>Worker: START_KEEPALIVE
    activate Worker
    Reg->>Line: lineEmitter(REGISTERED, deviceInfo)
    deactivate Reg
    Line->>Line: normalizeLine(deviceInfo)
    Line->>App: emit(LINE_EVENTS.REGISTERED, lineInfo)
    deactivate Line
    deactivate CC

    loop Every keepaliveInterval seconds
        Worker->>Mobius: POST /devices/{id}/status
        Mobius-->>Worker: 200 OK
        Worker->>Reg: KEEPALIVE_SUCCESS
    end
```

### 2. Outbound Call Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant Line as Line
    participant CM as CallManager
    participant Call as Call
    participant Mobius as Mobius API
    participant Media as MediaConnection

    App->>Line: makeCall({type: 'uri', address: 'sip:user@...'})
    activate Line
    Line->>CM: createCall(OUTBOUND, deviceId, lineId, dest)
    activate CM
    CM->>Call: new Call(mobiusUrl, webex, OUTBOUND, ...)
    activate Call
    Call->>Call: XState: callStateMachine.start()
    Call->>Call: XState: mediaStateMachine.start()
    CM-->>Line: call (ICall)
    deactivate CM
    Line-->>App: call (ICall)
    deactivate Line

    App->>Call: dial(localAudioStream)
    Call->>Media: new RoapMediaConnection(config, options)
    Media-->>Call: ROAP OFFER (SDP)
    Call->>Mobius: POST /calls (with SDP)
    Call->>Call: callStateMachine.send(E_SEND_CALL_SETUP)
    Mobius-->>Call: 200 {callId, callData}

    Note over Mobius,Call: Via Mercury WebSocket
    Mobius->>Call: callprogress event
    Call->>Call: callStateMachine.send(E_RECV_CALL_PROGRESS)
    Call->>App: emit(CALL_EVENT_KEYS.PROGRESS)

    Mobius->>Call: ROAP ANSWER
    Call->>Media: handleRoapAnswer(sdp)
    Call->>Mobius: ROAP OK

    Mobius->>Call: callconnected event
    Call->>Call: callStateMachine.send(E_RECV_CALL_CONNECT)
    Call->>Call: callStateMachine.send(E_CALL_ESTABLISHED)
    Call->>App: emit(CALL_EVENT_KEYS.ESTABLISHED)
```

### 3. Inbound Call Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant Line as Line
    participant CM as CallManager
    participant Call as Call
    participant Mercury as Mercury WS
    participant Mobius as Mobius API

    Mercury->>CM: event:mobius (callSetup)
    activate CM
    CM->>Call: new Call(mobiusUrl, webex, INBOUND, ...)
    activate Call
    Call->>Call: callStateMachine.send(E_RECV_CALL_SETUP)
    Call->>Call: emit(CALL_EVENT_KEYS.ALERTING)
    CM->>Line: emit(LINE_EVENT_KEYS.INCOMING_CALL, call)
    deactivate CM
    Line->>App: emit(LINE_EVENTS.INCOMING_CALL, call)
    deactivate Call

    App->>Call: answer(localAudioStream)
    activate Call
    Call->>Call: Create RoapMediaConnection
    Call->>Mobius: POST /calls/{callId}/connect
    Call->>Call: callStateMachine.send(E_SEND_CALL_CONNECT)
    Call->>App: emit(CALL_EVENT_KEYS.CONNECT)

    Note over Mobius,Call: ROAP negotiation
    Call->>App: emit(CALL_EVENT_KEYS.ESTABLISHED)
    deactivate Call
```

### 4. Network Disruption and Recovery

```mermaid
sequenceDiagram
    participant Browser as Browser
    participant CC as CallingClient
    participant Line as Line
    participant Reg as Registration
    participant Worker as WebWorker
    participant CM as CallManager
    participant Mobius as Mobius API

    Browser->>CC: window 'offline' event
    CC->>CC: handleNetworkOffline()
    CC->>CC: isNetworkDown = true
    CC->>Reg: clearKeepaliveTimer()
    Reg->>Worker: CLEAR_KEEPALIVE (terminate)

    Note over Browser,Mobius: Network comes back

    Browser->>CC: window 'online' event
    CC->>CC: handleNetworkOnline()
    CC->>CC: networkUpTimestamp = Date.now()

    Note over CC: Wait for Mercury reconnection

    Browser->>CC: Mercury 'online' event
    CC->>CC: handleMercuryOnline()
    CC->>CC: Submit connection metrics

    alt Has active calls
        CC->>CM: checkCallStatus()
        CM->>Mobius: POST /calls/{id}/status
        alt Call still active on server
            Mobius-->>CM: 200 OK
        else Call lost
            CM->>Call: callStateMachine.send(E_SEND_CALL_DISCONNECT)
        end
    end

    CC->>Reg: handleConnectionRestoration(retry)
    activate Reg
    Reg->>Line: lineEmitter(RECONNECTING)
    Line->>App: emit(LINE_EVENTS.RECONNECTING)
    Reg->>Mobius: POST /devices (re-register)
    Mobius-->>Reg: 200 OK
    Reg->>Worker: START_KEEPALIVE (restart)
    Reg->>Line: lineEmitter(REGISTERED, deviceInfo)
    Line->>App: emit(LINE_EVENTS.RECONNECTED)
    deactivate Reg
```

### 5. Deregistration and Cleanup

```mermaid
sequenceDiagram
    participant App as Application
    participant CC as CallingClient
    participant Line as Line
    participant Reg as Registration
    participant Worker as WebWorker
    participant Mobius as Mobius API

    App->>Line: deregister()
    activate Line
    Line->>Reg: deregister()
    activate Reg
    Reg->>Worker: CLEAR_KEEPALIVE (terminate)
    Reg->>Mobius: DELETE /devices/{deviceId}
    Mobius-->>Reg: 200 OK
    Reg->>Reg: setStatus(IDLE)
    deactivate Reg
    Line->>App: emit(LINE_EVENTS.UNREGISTERED)
    deactivate Line
```

---

## Key Constants

### Timers and Intervals

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_KEEPALIVE_INTERVAL` | 30s | Keepalive POST frequency |
| `DEFAULT_REHOMING_INTERVAL_MIN` | 60s | Min failback timer |
| `DEFAULT_REHOMING_INTERVAL_MAX` | 120s | Max failback timer |
| `DEFAULT_SESSION_TIMER` | 10 min | Call session timeout |
| `NETWORK_FLAP_TIMEOUT` | 5000ms | Debounce for network flap |
| `REG_TRY_BACKUP_TIMER_VAL_IN_SEC` | 114s | Timer before trying backup servers |
| `REG_FAILBACK_429_MAX_RETRIES` | 5 | Max retries on 429 during failback |
| `MAX_CALL_KEEPALIVE_RETRY_COUNT` | 4 | Max call keepalive retries |

### API Endpoints

| Constant | Value | Description |
|----------|-------|-------------|
| `DEVICES_ENDPOINT_RESOURCE` | `calling/web/devices` | Device registration |
| `CALL_ENDPOINT_RESOURCE` | `calls` | Call creation |
| `CALL_STATUS_RESOURCE` | `status` | Call status check |
| `MEDIA_ENDPOINT_RESOURCE` | `media` | Media/ROAP messaging |

---

## Troubleshooting Guide

### 1. Line Never Reaches REGISTERED State

**Symptoms:** `LINE_EVENTS.REGISTERED` never fires after `line.register()`

**Possible Causes:**
- Mobius server unreachable
- Invalid or expired Webex token
- SDKConnector not initialized with Webex instance

**Debug Steps:**
```typescript
callingClient.on('callingClient:error', (error) => {
  console.error('Client error:', error.getError());
});

line.on('error', (error) => {
  console.error('Line error:', error.getError());
});
```

### 2. Calls Drop After Network Recovery

**Symptoms:** Calls disconnect after temporary network loss

**Possible Causes:**
- Mercury reconnection taking too long
- Call keepalive retry count exceeded (`MAX_CALL_KEEPALIVE_RETRY_COUNT = 4`)
- Mobius server lost the call state

**What happens internally:**
1. `handleNetworkOffline()` clears the keepalive timer
2. `handleMercuryOnline()` triggers `checkCallStatus()` for active calls
3. If the Mobius server no longer has the call, `E_SEND_CALL_DISCONNECT` is sent
4. If no calls are active, `handleConnectionRestoration()` re-registers the device

### 3. Registration Fails with 429

**Symptoms:** Registration fails repeatedly; `LINE_EVENTS.ERROR` with `TOO_MANY_REQUESTS`

**What happens internally:**
- Registration respects `Retry-After` headers from Mobius
- Retries up to `REG_FAILBACK_429_MAX_RETRIES` (5) times
- On exhaustion, falls back to backup Mobius servers

### 4. Keepalive Failures

**Symptoms:** `LINE_EVENTS.RECONNECTING` fires repeatedly

**What happens internally:**
1. Web Worker sends `POST /devices/{id}/status` every `keepaliveInterval` seconds
2. On failure, Worker sends `KEEPALIVE_FAILURE` to main thread
3. Registration emits `RECONNECTING` and attempts recovery
4. On persistent failure, triggers full reconnect via `reconnectOnFailure()`

### 5. No Incoming Calls

**Symptoms:** `LINE_EVENTS.INCOMING_CALL` never fires

**Possible Causes:**
- Mercury WebSocket not connected (`webex.internal.mercury.connected === false`)
- Line not registered (check `line.getStatus() === 'active'`)
- CallManager not listening for Mobius events

**Debug Steps:**
```typescript
console.log('Line status:', line.getStatus());
console.log('Mercury connected:', webex.internal.mercury.connected);
```

---

## Subdirectory Architecture Docs

For detailed architecture of subsystems:

- **Line:** [line/ai-docs/ARCHITECTURE.md](../line/ai-docs/ARCHITECTURE.md) — Line class internals, lineEmitter pattern, call initiation
- **Registration:** [registration/ai-docs/ARCHITECTURE.md](../registration/ai-docs/ARCHITECTURE.md) — Registration flow, keepalive web worker, failover/failback

---

## Related Documentation

- [AGENTS.md](./AGENTS.md) — Overview, examples, public API
- [TypeScript Patterns](../../../ai-docs/patterns/typescript-patterns.md)
- [Event Patterns](../../../ai-docs/patterns/event-patterns.md)
- [State Machine Patterns](../../../ai-docs/patterns/state-machine-patterns.md)
- [Error Handling Patterns](../../../ai-docs/patterns/error-handling-patterns.md)
- [Testing Patterns](../../../ai-docs/patterns/testing-patterns.md)

---

_Last Updated: 2026-03-15_
