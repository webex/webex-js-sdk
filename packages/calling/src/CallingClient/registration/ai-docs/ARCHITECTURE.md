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
    participant Mobius as Mobius API
    participant Worker as Web Worker

    Line->>Reg: triggerRegistration()
    activate Reg

    Reg->>Reg: attemptRegistrationWithServers(primaryUris)
    loop For each URI in primaryMobiusUris
        Reg->>Mobius: POST /calling/web/devices
        alt 200 OK
            Mobius-->>Reg: {device: {deviceId, uri, addresses, ...}}
            Reg->>Reg: setStatus(ACTIVE)
            Reg->>Reg: setActiveMobiusUrl(uri)
            Reg->>Reg: Store deviceInfo

            Reg->>Worker: START_KEEPALIVE {token, url, interval}
            activate Worker
            Note over Worker: Starts periodic POST /status

            Reg->>Line: lineEmitter(REGISTERED, deviceInfo)
            Reg-->>Line: Registration complete
            deactivate Reg
        else 429 Too Many Requests
            Mobius-->>Reg: 429 + Retry-After header
            Reg->>Reg: Schedule retry after delay
            Note over Reg: Up to 5 retries
        else 401/403/500/503
            Mobius-->>Reg: Error response
            Reg->>Reg: handleRegistrationErrors()
            Note over Reg: May failover to backup
        end
    end
```

### Failover Flow

```mermaid
sequenceDiagram
    participant Reg as Registration
    participant Mobius1 as Primary Mobius
    participant Mobius2 as Backup Mobius
    participant Worker as Web Worker
    participant Line as Line

    Note over Reg: All primary URIs failed

    Reg->>Reg: startFailoverTimer()
    Reg->>Reg: Calculate registration retry interval

    loop Failover attempts
        Reg->>Mobius1: POST /calling/web/device (retry primary)
        Mobius1-->>Reg: Failure (timeout/error)

        Note over Reg: Primary still down, try backup

        Reg->>Mobius2: POST /calling/web/device
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
    participant Mobius1 as Primary Mobius
    participant Mobius2 as Backup Mobius (current)
    participant Worker as Web Worker
    participant Line as Line

    Note over Reg: Currently on backup, failback timer fires

    Reg->>Reg: executeFailback()
    Reg->>Mobius1: POST /calling/web/devices (check primary)

    alt Primary is back
        Mobius1-->>Reg: 200 OK
        Reg->>Worker: CLEAR_KEEPALIVE (stop backup keepalive)
        Reg->>Mobius2: DELETE /devices/{id} (deregister backup)
        Reg->>Reg: setActiveMobiusUrl(primaryUrl)
        Reg->>Worker: START_KEEPALIVE (on primary)
        Reg->>Line: lineEmitter(REGISTERED, deviceInfo)
    else Primary still down
        Mobius1-->>Reg: Failure
        Reg->>Reg: Reschedule failback timer
        Note over Reg: Stay on backup
    end
```

---

## Keepalive Web Worker

### Architecture

The keepalive runs in a **Web Worker** to ensure heartbeats are not blocked by main-thread work (long computations, UI rendering, etc.).

```mermaid
sequenceDiagram
  participant MT as Main Thread
  participant WW as Web Worker
  participant Mob as Mobius

  MT->>WW: new Worker(blobURL)
  MT->>WW: postMessage(START_KEEPALIVE)<br/>{token, url, interval, retryCountThreshold}

  loop setInterval(interval * 1000) while retryCount < threshold
    WW->>Mob: fetch(POST url/status)
    alt 200 OK
      Note over WW: Reset retryCount to 0
      alt retryCount was > 0 (recovering)
        WW-->>MT: postMessage(KEEPALIVE_SUCCESS)
      end
    else Error
      Note over WW: Increment retryCount
      WW-->>MT: postMessage(KEEPALIVE_FAILURE)<br/>{statusCode, headers, retryCount}
    end
  end

  MT->>WW: postMessage(CLEAR_KEEPALIVE)
  Note over WW: clearInterval()
  MT->>WW: worker.terminate()
```

### Worker Messages

| Message | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `START_KEEPALIVE` | Main → Worker | `{accessToken, deviceUrl, interval, retryCountThreshold, url}` | Start sending keepalive requests |
| `CLEAR_KEEPALIVE` | Main → Worker | _(none)_ | Stop sending keepalive requests |
| `KEEPALIVE_SUCCESS` | Worker → Main | _(none)_ | Keepalive POST succeeded |
| `KEEPALIVE_FAILURE` | Worker → Main | `{statusCode, body, retryCount}` | Keepalive POST failed |

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

1. **Emit `RECONNECTING`** via `lineEmitter` to notify the application
2. **Check retry count** against threshold (`MAX_CALL_KEEPALIVE_RETRY_COUNT = 4 for contact center and 5 otherwise`)
3. **If within threshold:** Log warning, wait for next keepalive cycle
4. **If threshold exceeded:** Trigger `reconnectOnFailure()` for full re-registration
5. **Submit metrics** for keepalive failure

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

## Related Documentation

- [Registration AGENTS.md](./AGENTS.md) — Public API, key concepts
- [Line ARCHITECTURE.md](../../line/ai-docs/ARCHITECTURE.md) — lineEmitter pattern, Line ↔ Registration interaction
- [CallingClient ARCHITECTURE.md](../../ai-docs/ARCHITECTURE.md) — Network resilience, initialization
