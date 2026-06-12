# Registration Module — Architecture

## Component Overview

The `Registration` class is the most complex subsystem in the CallingClient module. It manages the full lifecycle of device registration with Mobius, including initial registration, keepalive heartbeats, server failover, failback, 429 retry handling, and reconnection after network disruption.

## File Structure

```
registration/
├── index.ts               # Re-exports from register.ts
├── register.ts            # Registration class (main logic)
├── types.ts               # IRegistration, type aliases
├── webWorker.ts           # Keepalive worker (direct module)
├── webWorkerStr.ts        # Stringified worker for Blob URL
├── registerFixtures.ts    # Test fixtures
├── register.test.ts       # Unit tests
├── webWorker.test.ts      # Web Worker unit tests
└── ai-docs/
    ├── AGENTS.md          # Overview, API, examples
    └── ARCHITECTURE.md    # This file
```

---

### Responsibilities

| Concern | Implementation |
|---------|---------------|
| Initial registration | `triggerRegistration()` → `attemptRegistrationWithServers()` |
| Keepalive | Web Worker sends periodic `POST /status` |
| Failover (primary → backup) | `startFailoverTimer()` with exponential backoff |
| Failback (backup → primary) | `initiateFailback()` → `executeFailback()` |
| 429 handling | `Retry-After` header with retry budget |
| Reconnection | `handleConnectionRestoration()` / `reconnectOnFailure()` |
| Deregistration | `DELETE /devices/{id}` + worker termination |
| Mobius WSS connect/disconnect (when `apiRequest.isSocketEnabled()`) | Per-server `apiRequest.connectToMobiusSocket(wssNormalizedUrl)` inside `attemptRegistrationWithServers`; `apiRequest.disconnectFromMobiusSocket({code: 3050, reason: 'done (permanent)'})` on failover, failback, registration-down, restore-previous-registration, and deregister-with-`closeMobiusWss=true`. |

---

## Internal Architecture

```mermaid
graph TD
  subgraph Registration
    TR[triggerRegistration] --> ARS[attemptRegistrationWithServers]
    ARS -->|For each URI: POST /calling/web/device| RES{Result}

    RES -->|Success| SUCC[Set ACTIVE + store deviceInfo]
    SUCC --> KA[Start keepalive Web Worker]
    SUCC --> FB[initiateFailback if on backup]
    SUCC --> LE_REG[lineEmitter: REGISTERED]

    RES -->|Non-fatal error| SFT[startFailoverTimer]
    SFT -->|Retry primary with backoff| ARS
    SFT -->|Threshold exceeded| ARS_B[attemptRegistrationWithServers: backup]
    ARS_B -->|Success| SUCC
    ARS_B -->|All fail| EFF[emitFinalFailure]

    RES -->|Fatal error| LE_ERR[lineEmitter: ERROR]

    KA <-->|START_KEEPALIVE / CLEAR_KEEPALIVE<br/>KEEPALIVE_SUCCESS / KEEPALIVE_FAILURE| WW[Web Worker<br/>webWorkerStr.ts]
    WW -->|POST /devices/id/status<br/>every keepaliveInterval sec| MOB[Mobius]

    FB --> EFB[executeFailback]
    EFB -->|Ping primary, deregister backup, re-register| ARS

    LE_REG --> LINE[lineEmitter → Line]
    LE_ERR --> LINE
    EFF --> LINE
  end
```

---

## Registration Flow

### Initial Registration Sequence

```mermaid
sequenceDiagram
    participant Line as Line
    participant Reg as Registration
    participant API as APIRequest
    participant MS as MobiusSocket
    participant Mobius as Mobius API
    participant Worker as Web Worker

    Line->>Reg: triggerRegistration()
    activate Reg

    Reg->>Reg: attemptRegistrationWithServers(primaryUris)
    loop For each URI in primaryMobiusUris
        opt apiRequest.isSocketEnabled()
            Reg->>API: connectToMobiusSocket(wssNormalizedUrl)
            API->>MS: isConnected() ? reuse : MobiusSocket.connect(wssUri)
            MS-->>API: connected URL
            API-->>Reg: connectedWebSocketUrl
        end

        Reg->>API: makeRequest(POST /calling/web/device)
        alt WSS path
            API->>MS: sendWssRequest({type:'register', ...})
            MS-->>API: response_event subtype=register
            API-->>Reg: normalised WebexRequestPayload
        else HTTP path
            API->>Mobius: webex.request(POST /device)
            Mobius-->>API: 200 OK
            API-->>Reg: WebexRequestPayload
        end

        alt 200 OK
            Reg->>Reg: setStatus(ACTIVE)<br/>setActiveMobiusUrl(connectedWebSocketUrl || url)
            Reg->>Reg: Store deviceInfo

            Reg->>Worker: START_KEEPALIVE {token, url, interval}
            activate Worker
            Note over Worker: Starts periodic POST /status

            Reg->>Line: lineEmitter(REGISTERED, deviceInfo)
            Reg-->>Line: Registration complete
            deactivate Reg
        else Error (handled by handleRegistrationErrors)
            opt WSS path && shouldDisconnect && !final-server
                Reg->>API: disconnectFromMobiusSocket({code:3050, reason:'done (permanent)'})
                API->>MS: disconnect({code:3050, reason:'done (permanent)'})
            end
            Note over Reg: 429: stored Retry-After; 401/403(102)/404/400: abort;<br/>others: continue loop or schedule retry
        end
    end
```

> **WSS URL normalisation:** `Registration` strips any trailing `/` from the server URL before passing it to `apiRequest.connectToMobiusSocket(...)`. The connected URL returned by `MobiusSocket` is then re-suffixed with `/` and stored as `activeMobiusUrl` so subsequent comparisons (e.g. in `restorePreviousRegistration`) line up with the URI list.

### Failover Flow

```mermaid
sequenceDiagram
    participant Reg as Registration
    participant API as APIRequest
    participant MS as MobiusSocket
    participant Mobius1 as Primary Mobius
    participant Mobius2 as Backup Mobius
    participant Worker as Web Worker
    participant Line as Line

    Note over Reg: All primary URIs failed

    Reg->>Reg: startFailoverTimer()
    Reg->>Reg: Calculate registration retry interval

    opt apiRequest.isSocketEnabled() && switching to backup
        Reg->>API: disconnectFromMobiusSocket({code:3050, reason:'done (permanent)'})
        API->>MS: disconnect({code:3050, reason:'done (permanent)'})
        Note over MS: Stops backoff retries on the primary URL
    end

    loop Failover attempts
        Reg->>Mobius1: POST /device (retry primary)
        Mobius1-->>Reg: Failure (timeout/error)

        Note over Reg: Primary still down, try backup

        opt apiRequest.isSocketEnabled()
            Reg->>API: connectToMobiusSocket(backupWssUrl)
            API->>MS: MobiusSocket.connect(backupWssUrl)
        end
        Reg->>Mobius2: POST /device
        alt Backup succeeds
            Mobius2-->>Reg: 200 OK {device: {...}}
            Reg->>Reg: setStatus(ACTIVE)
            Reg->>Reg: setActiveMobiusUrl(backupUrl)
            Reg->>Worker: START_KEEPALIVE
            Reg->>Line: lineEmitter(REGISTERED, deviceInfo)

            Note over Reg: Start failback timer to return to primary
            Reg->>Reg: initiateFailback()
        else Backup also fails
            Mobius2-->>Reg: Failure
            Reg->>Reg: Increase backoff, retry
        end
    end
```

### Failback Flow

```mermaid
sequenceDiagram
    participant Reg as Registration
    participant API as APIRequest
    participant MS as MobiusSocket
    participant Mobius1 as Primary Mobius
    participant Mobius2 as Backup Mobius (current)
    participant Worker as Web Worker
    participant Line as Line

    Note over Reg: Currently on backup, failback timer fires

    Reg->>Reg: executeFailback()
    Reg->>Mobius1: GET {primaryBase}ping (isPrimaryActive)

    alt Primary is back AND no active calls
        Mobius1-->>Reg: 200 OK
        Reg->>Reg: deregister()<br/>(DELETE /devices/{id} + clearKeepaliveTimer)
        Reg->>Mobius2: DELETE /devices/{id}

        opt apiRequest.isSocketEnabled()
            Reg->>API: disconnectFromMobiusSocket({code:3050, reason:'done (permanent)'})
            API->>MS: disconnect on backup WSS
        end

        Reg->>Reg: attemptRegistrationWithServers(FAILBACK_UTIL, primaryUris)
        opt registration succeeds
            Reg->>API: connectToMobiusSocket(primaryWssUrl)<br/>(if WSS enabled, inside attempt loop)
            Reg->>Reg: setActiveMobiusUrl(primaryUrl)
            Reg->>Worker: START_KEEPALIVE (on primary)
            Reg->>Line: lineEmitter(REGISTERED, deviceInfo)
        end
    else Primary still down or active calls present
        Mobius1-->>Reg: Failure
        Reg->>Reg: Reschedule failback timer
        Note over Reg: Stay on backup; do NOT disconnect WSS
    end
```

---

## Keepalive Web Worker

### Architecture

The keepalive runs in a **Web Worker** to ensure heartbeats are not blocked by main-thread work (long computations, UI rendering, etc.).

```mermaid
sequenceDiagram
  participant MT as Main Thread (Registration)
  participant WW as Web Worker
  participant Mob as Mobius

  MT->>WW: new Worker(blobURL)
  MT->>WW: postMessage(START_KEEPALIVE)<br/>{interval, retryCountThreshold}

  loop setInterval(interval * 1000) while retryCount < threshold
    WW-->>MT: postMessage(SEND_KEEPALIVE)
    MT->>Mob: apiRequest.makeRequest(POST url/status)
    alt 200 OK
      Mob-->>MT: 200 OK
      MT->>WW: postMessage(KEEPALIVE_RESULT)<br/>{statusCode}
      Note over WW: Reset retryCount to 0
      alt retryCount was > 0 (recovering)
        WW-->>MT: postMessage(KEEPALIVE_SUCCESS)<br/>{statusCode}
      end
    else Error
      Mob-->>MT: error response
      MT->>WW: postMessage(KEEPALIVE_RESULT)<br/>{err}
      Note over WW: Increment retryCount
      WW-->>MT: postMessage(KEEPALIVE_FAILURE)<br/>{err, keepAliveRetryCount}
    end
  end

  MT->>WW: postMessage(CLEAR_KEEPALIVE)
  Note over WW: clearInterval()
  MT->>WW: worker.terminate()
```

### Worker Messages

| Message | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `START_KEEPALIVE` | Main → Worker | `{interval, retryCountThreshold}` | Start the keepalive interval timer |
| `SEND_KEEPALIVE` | Worker → Main | _(none)_ | Timer fired — main thread should send the keepalive POST |
| `KEEPALIVE_RESULT` | Main → Worker | `{statusCode}` on success, `{err}` on failure | Result of the keepalive POST (sent by main thread after `apiRequest.makeRequest` resolves/rejects) |
| `CLEAR_KEEPALIVE` | Main → Worker | _(none)_ | Stop the keepalive interval; main thread also calls `worker.terminate()` |
| `KEEPALIVE_SUCCESS` | Worker → Main | `{statusCode}` | Keepalive succeeded **after a prior failure** (`retryCount > 0`); normal successes are silent |
| `KEEPALIVE_FAILURE` | Worker → Main | `{err, keepAliveRetryCount}` | Keepalive POST failed; `err` is the WebexRequestPayload-shaped error |

### Worker Creation

The worker is created from a stringified JavaScript source to avoid separate file bundling:

```typescript
// webWorkerStr.ts contains the worker code as a string
const blob = new Blob([webWorkerStr], {type: 'application/javascript'});
const url = URL.createObjectURL(blob);
this.webWorker = new Worker(url);
URL.revokeObjectURL(url);
```

### Keepalive Failure Handling

When the main thread receives `KEEPALIVE_FAILURE`:

1. **Submit metrics** and run `handleRegistrationErrors` to classify the error (fatal vs. non-fatal vs. 429).
2. **If abort (fatal) OR retryCount ≥ threshold** (`4` for contact-center, `5` otherwise):
   - Set status to `INACTIVE`, terminate the keepalive worker
   - Emit `LINE_EVENTS.UNREGISTERED` via `lineEmitter`
   - If **non-fatal threshold exceeded** (not `abort`): call `reconnectOnFailure()` for full re-registration
   - If **fatal + 404**: call `handle404KeepaliveFailure()` for a fresh registration attempt
3. **If below threshold** (non-fatal and retryCount < threshold): emit `LINE_EVENTS.RECONNECTING` via `lineEmitter` and wait for the next keepalive cycle

---

## Reconnection

### reconnectOnFailure()

Called when keepalive failures exceed the threshold or when CallingClient detects all calls have cleared after a network disruption.

```mermaid
flowchart TD
  A[reconnectOnFailure called] --> B[Set reconnectPending = false]
  B --> C{Device already registered?}
  C -- Yes --> Z[Return — no action needed]
  C -- No --> D{Active calls present?}
  D -- Yes --> E[Set reconnectPending = true<br/>Defer until calls clear]
  D -- No --> F[restorePreviousRegistration<br/>Try last activeMobiusUrl]
  F --> G{Registered?}
  G -- Yes --> Z
  G -- No, not aborted --> H[restartRegistration<br/>Try primary servers + startFailoverTimer]
  G -- Aborted, fatal error --> Z
```

### handleConnectionRestoration()

Called by `CallingClient` after Mercury reconnection. Runs inside `mutex.runExclusive`.

```mermaid
flowchart TD
  A[handleConnectionRestoration called] --> B{retry = true?}
  B -- No --> Z[Return retry value unchanged]
  B -- Yes --> C[clearKeepaliveTimer]
  C --> D{Currently registered?}
  D -- Yes --> E[deregister: DELETE device + set INACTIVE]
  D -- No --> F
  E --> F{activeMobiusUrl set?}
  F -- No --> G[Skip — let failover timer handle registration]
  F -- Yes --> H[restorePreviousRegistration<br/>Try last activeMobiusUrl first]
  H --> I{Registered?}
  I -- Yes --> J[Set retry = false, return]
  I -- No, not aborted --> K[restartRegistration<br/>Try primary servers + startFailoverTimer]
  I -- Aborted, fatal error --> J
  K --> J
  G --> J
```

---

## 429 Retry Logic

`handle429Retry(retryAfter, caller)` handles 429 differently depending on the calling context:

```mermaid
flowchart TD
  A[429 received via handle429Retry] --> B{Caller context?}

  B -->|FAILBACK_UTIL| C{failback429RetryAttempts >= 5?}
  C -- Yes --> D[Return — stay on backup, stop retrying]
  C -- No --> E[Clear failback timer<br/>Increment failback429RetryAttempts]
  E --> F[Start new failback timer with backoff interval]
  F --> G[restorePreviousRegistration]
  G --> H{Registered?}
  H -- Yes --> I[Done]
  H -- No --> J[restartRegistration<br/>Primary servers + startFailoverTimer]

  B -->|KEEPALIVE_UTIL| K[Clear keepalive timer — terminate worker]
  K --> L[Wait Retry-After seconds]
  L --> M[Restart keepalive with new worker]

  B -->|Other: initial registration| N[Store retryAfter on instance<br/>Used by startFailoverTimer for interval calculation]
```

---

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_KEEPALIVE_INTERVAL` | 30s | Default keepalive frequency |
| `REG_TRY_BACKUP_TIMER_VAL_IN_SEC` | 114s | Time before trying backup servers |
| `REG_FAILBACK_429_MAX_RETRIES` | 5 | Max 429 retries before failover |
| `BASE_REG_RETRY_TIMER_VAL_IN_SEC` | 30 | Base retry timer (seconds) |
| `BASE_REG_TIMER_MFACTOR` | 2 | Multiplication factor for exponential backoff |
| `REG_RANDOM_T_FACTOR_UPPER_LIMIT` | 10000 | Randomization upper bound (milliseconds) |
| `RETRY_TIMER_UPPER_LIMIT` | 60 | Max retry timer value (seconds) |

---

## Error Handling

Registration errors are mapped through `handleRegistrationErrors()`. Fatal errors (`abort = true`) stop the registration loop and emit `LINE_EVENTS.ERROR`. Non-fatal errors allow the loop to continue to the next server or schedule a retry via the failover timer.

| HTTP Status | ERROR_TYPE | Fatal? | Action |
|-------------|-----------|--------|--------|
| 400 | `BAD_REQUEST` | Yes | Abort — emit error |
| 401 | `TOKEN_ERROR` | Yes | Abort — emit error (token expired/invalid) |
| 403 (code 101) | `FORBIDDEN_ERROR` | No | Device limit exceeded — `restoreRegistrationCallBack`: deregister existing + re-register |
| 403 (code 102) | `FORBIDDEN_ERROR` | Yes | Device creation disabled — abort, emit error |
| 403 (code 103/other) | `FORBIDDEN_ERROR` | No | Device creation failed — continue retry |
| 404 | `NOT_FOUND` | Yes | Abort — emit error |
| 429 | `TOO_MANY_REQUESTS` | No | Call `handle429Retry` with `Retry-After` value |
| 500 | `SERVER_ERROR` | No | Continue to next server or schedule retry |
| 503 | `SERVICE_UNAVAILABLE` | No | Continue to next server or schedule retry |
| Other | `DEFAULT` | No | Continue to next server or schedule retry |

### Final vs Non-Final Error Flow

```mermaid
sequenceDiagram
    participant Mobius
    participant Reg as Registration<br/>(attemptRegistrationWithServers)
    participant HRE as handleRegistrationErrors
    participant Line as Line<br/>(lineEmitter)
    participant App as Application

    Note over Reg: Server loop: iterate over Mobius URIs

    Reg->>Mobius: POST /device (register)
    Mobius-->>Reg: HTTP error response

    Reg->>HRE: handleRegistrationErrors(err, emitterCb, ...)
    HRE->>HRE: Map statusCode → ERROR_TYPE, set finalError flag

    alt Final error (400, 401, 404, 403 code 102)
        HRE->>HRE: finalError = true
        HRE->>Line: emitterCb(lineError, true)
        Line->>App: emit LINE_EVENTS.ERROR (lineError)
        HRE-->>Reg: return abort = true
        Reg->>Reg: setStatus(INACTIVE)
        Reg->>Reg: uploadLogs()
        Reg->>Reg: break out of server loop
    else Non-final error (500, 503, other)
        HRE->>HRE: finalError = false
        HRE->>Line: emitterCb(lineError, false)
        Line->>App: emit LINE_EVENTS.UNREGISTERED (no payload)
        HRE-->>Reg: return abort = false
        Reg->>Reg: continue to next server in loop
        Note over Reg: If all servers exhausted:
        Reg->>Reg: startFailoverTimer()
        alt Primary time budget remaining
            Reg->>Reg: Schedule retry with primary (exponential backoff)
        else Primary time exceeded, backups exist
            Reg->>Mobius: attemptRegistrationWithServers(backupUris)
            alt Backups also fail
                Reg->>Reg: Schedule one more backup retry
                alt Still fails
                    Reg->>Line: emitFinalFailure → lineEmitter(ERROR)
                    Line->>App: emit LINE_EVENTS.ERROR (SERVICE_UNAVAILABLE)
                end
            end
        else No backups available
            Reg->>Line: emitFinalFailure → lineEmitter(ERROR)
            Line->>App: emit LINE_EVENTS.ERROR (SERVICE_UNAVAILABLE)
        end
    else 429 Too Many Requests
        HRE->>HRE: finalError = false
        HRE->>Reg: retry429Cb(retryAfter, caller)
        Reg->>Reg: handle429Retry (path depends on caller context)
        HRE-->>Reg: return abort = false
    else 403 Device Limit Exceeded (code 101)
        HRE->>HRE: finalError = false
        HRE->>Reg: restoreRegCb(errorBody, caller)
        Reg->>Reg: Deregister existing device, re-register
        HRE-->>Reg: return abort = false
    end
```

> **Source references:**
> - Server loop and error branching: `attemptRegistrationWithServers` in `src/CallingClient/registration/register.ts`
> - Error classification and callback invocation: `handleRegistrationErrors` in `src/common/Utils.ts`
> - Failover timer and final failure: `startFailoverTimer` in `register.ts`, `emitFinalFailure` in `src/common/Utils.ts`
> - `lineEmitter` branching on `finalError`: the `emitterCb` closure in `attemptRegistrationWithServers` — emits `LINE_EVENTS.ERROR` for `finalError = true`, `LINE_EVENTS.UNREGISTERED` for `finalError = false`

---

## Mobius WSS Touch Points

When `apiRequest.isSocketEnabled()` is true (driven by `isMobiusWssEnabled(webex)` — see [`CallingClient/ai-docs/ARCHITECTURE.md`](../../ai-docs/ARCHITECTURE.md#4-transport-selection-http-vs-mobius-wss)), the `Registration` class becomes responsible for sequencing the Mobius WebSocket connection alongside the registration POST / DELETE.

### When Registration Connects / Disconnects the WSS

| Flow | WSS action | Code path |
|---|---|---|
| `attemptRegistrationWithServers` (each server iteration) | `apiRequest.connectToMobiusSocket(wssNormalizedUrl)` before `postRegistration` | `register.ts ~ L994–L1010` |
| Registration error with `shouldDisconnect = true` (non-final, not last server in list, not 429) | `apiRequest.disconnectFromMobiusSocket({code: 3050, reason: 'done (permanent)'})` | `register.ts ~ L1085–L1098` |
| `restorePreviousRegistration` when the connected WSS URL differs from `activeMobiusUrl` | disconnect first, then re-attempt | `register.ts ~ L308–L321` |
| `startFailoverTimer` switching primary → backup | disconnect primary WSS before backup re-registration | `register.ts ~ L508–L520` |
| `executeFailback` primary recovered + no active calls | disconnect backup WSS before primary re-registration | `register.ts ~ L713–L725` |
| `deregister(closeMobiusWss = true)` | disconnect WSS after DELETE returns | `register.ts ~ L1264–L1270` |
| `performRegistrationDownCleanup` (after Mobius async `registration.down`) | disconnect WSS as final cleanup step | `register.ts ~ L1411–L1419` |

### Constants Used

| Value | Meaning |
|---|---|
| `{code: 3050, reason: 'done (permanent)'}` | The convention `CallingClient` and `Registration` pass to `apiRequest.disconnectFromMobiusSocket(...)` to indicate a permanent teardown. `MobiusSocket` treats this as `offline.permanent` (no auto-reconnect) — distinct from `'idle'` / `'done (forced)'` which are transient and reconnectable. |
| `URL replace 'https://' → 'wss://'` | Used in `getExistingDevice` (403/101 device-limit branch) to keep `activeMobiusUrl` aligned with the WSS scheme when the socket is enabled. |
| `url.endsWith('/') ? slice(0,-1) : url` | URL normalisation applied by `attemptRegistrationWithServers` before calling `connectToMobiusSocket`, then re-suffixed with `/` for `setActiveMobiusUrl`. |

### Mobius `registration.down` Async Event

```mermaid
sequenceDiagram
    participant MS as MobiusSocket
    participant API as APIRequest
    participant CC as CallingClient
    participant Reg as Registration
    participant CM as CallManager
    participant Line as Line

    MS-->>API: emit('event:async_event', {data:{eventType:'registration.down', ...}})
    API->>CC: handleMobiusAsyncEvent(event)
    CC->>CC: submitMobiusSocketMetric(<br/>MOBIUS_SOCKET_ERROR, REGISTRATION_DOWN, ...)
    CC->>Reg: line.registration.handleRegistrationDownEvent(event)

    Reg->>CM: getActiveCalls() → end first active call
    Reg->>Reg: performRegistrationDownCleanup()

    Reg->>Reg: mutex.runExclusive(...)
    Reg->>Reg: clearFailbackTimer + clearKeepaliveTimer
    Reg->>Reg: reset reconnectPending, scheduled429Retry,<br/>failoverImmediately, retryAfter, registerRetry
    Reg->>Reg: clearFailoverState() + setStatus(INACTIVE)

    opt apiRequest.isSocketEnabled()
        Reg->>API: disconnectFromMobiusSocket({code:3050, reason:'done (permanent)'})
        API->>MS: disconnect
    end

    Reg->>Line: lineEmitter(LINE_EVENTS.UNREGISTERED)
```

> **Note:** The synthetic `MOBIUS_SOCKET_4001_EVENT` envelope emitted when the server closes the socket with code `4001` carries `eventType: 'registration.down'` and therefore drives the **same** cleanup path as a server-pushed async `registration.down`. See [`mobius-socket/ai-docs/ARCHITECTURE.md`](../../../mobius-socket/ai-docs/ARCHITECTURE.md) for the close-code matrix.

---

## Related Documentation

- [Registration AGENTS.md](./AGENTS.md) — Public API, key concepts
- [Line ARCHITECTURE.md](../../line/ai-docs/ARCHITECTURE.md) — lineEmitter pattern, Line ↔ Registration interaction
- [CallingClient ARCHITECTURE.md](../../ai-docs/ARCHITECTURE.md) — Network resilience, initialization, transport selection
- [`mobius-socket` AGENTS.md](../../../mobius-socket/ai-docs/AGENTS.md) — Public API for the WebSocket transport
- [`mobius-socket` ARCHITECTURE.md](../../../mobius-socket/ai-docs/ARCHITECTURE.md) — Internals (backoff, dedup, close-code matrix, shutdown switchover, token refresh)
