# Registration Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

- **First step:** Load the parent [CallingClient/ai-docs/AGENTS.md](../../ai-docs/AGENTS.md) for module-level context.
- **For line-specific context:** Also load [line/ai-docs/AGENTS.md](../../line/ai-docs/AGENTS.md) (Registration is owned by Line).
- **For package-level patterns:** See `packages/calling/ai-docs/patterns/`.

---

## Overview

The `Registration` class manages the lifecycle of a device registration with the Webex Calling Mobius backend. It handles initial registration, keepalive heartbeats (via a Web Worker), server failover/failback, reconnection after network disruption, and clean deregistration.

`Registration` does **not** emit events directly to the application. Instead, it communicates state changes back to `Line` via the `lineEmitter` callback pattern.

**File:** `packages/calling/src/CallingClient/registration/register.ts`

**Class:** `Registration implements IRegistration`

**Factory:** `createRegistration(...)` — called internally by the `Line` constructor

---

## Purpose

The Registration module handles:

- **Device Registration** — `POST /calling/web/devices` to Mobius to register the client device
- **Keepalive** — Periodic `POST /devices/{id}/status` via a dedicated Web Worker
- **Server Failover** — Automatic switch from primary to backup Mobius servers on failure
- **Server Failback** — Automatic return to primary servers when they become available
- **Reconnection** — Re-register after network disruption or Mercury disconnection
- **429 Retry** — Respect `Retry-After` headers with exponential backoff
- **Deregistration** — `DELETE /devices/{id}` to clean up the device on Mobius

---

## Public API

### IRegistration Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `setMobiusServers` | `(primary: string[], backup: string[]): void` | Sets primary and backup Mobius URIs |
| `triggerRegistration` | `(): Promise<void>` | Starts registration (or resumes failover if in progress) |
| `isDeviceRegistered` | `(): boolean` | Returns `true` if status is `ACTIVE` |
| `setStatus` | `(value: RegistrationStatus): void` | Sets registration status |
| `getStatus` | `(): RegistrationStatus` | Returns current status (`IDLE`, `active`, `inactive`) |
| `getDeviceInfo` | `(): IDeviceInfo` | Returns device info from last successful registration |
| `clearKeepaliveTimer` | `(): void` | Stops the keepalive Web Worker |
| `deregister` | `(): Promise<void>` | Deletes device from Mobius and stops keepalive |
| `setActiveMobiusUrl` | `(url: string): void` | Sets the active Mobius URL |
| `getActiveMobiusUrl` | `(): string` | Returns current active Mobius URL |
| `reconnectOnFailure` | `(caller: string): Promise<void>` | Re-registers or defers if calls are active |
| `isReconnectPending` | `(): boolean` | Returns `true` if reconnect is deferred |
| `handleConnectionRestoration` | `(retry: boolean): Promise<boolean>` | Re-registers after network/Mercury recovery |
| `setDeviceInfo` | `(body: Devices): void` | Hydrates device info from a Devices response |

---

## Key Concepts

### Registration Status Flow

```
IDLE ──triggerRegistration()──► registering... ──success──► ACTIVE
  ▲                                    │
  │                               failure
  │                                    │
  │                    ┌───────────────▼───────────────┐
  │                    │  handleRegistrationErrors()    │
  │                    │  ├── 429: retry with backoff   │
  │                    │  ├── 401: token error          │
  │                    │  └── other: failover to backup │
  │                    └───────────────────────────────┘
  │                                    │
  └──────deregister()──────────────────┘
```

### Server Selection

| Phase | Servers Used | When |
|-------|-------------|------|
| Primary | `primaryMobiusUris` | Initial registration attempt |
| Failover | `backupMobiusUris` | Primary servers all fail |
| Failback | `primaryMobiusUris` | While on backup, periodically check if primary is up |

### Keepalive Web Worker

The keepalive mechanism runs in a dedicated **Web Worker** to avoid being blocked by main-thread activity:

- **Start:** Worker receives `START_KEEPALIVE` with access token, device URL, interval, and retry threshold
- **Loop:** Worker sends `POST /devices/{id}/status` every `keepaliveInterval` seconds
- **Success:** Worker posts `KEEPALIVE_SUCCESS` to main thread
- **Failure:** Worker posts `KEEPALIVE_FAILURE` with error details and retry count
- **Stop:** Main thread sends `CLEAR_KEEPALIVE`, Worker clears interval and main thread terminates it

### 429 Retry Logic

When Mobius responds with HTTP 429:
1. Extract `Retry-After` header value
2. Schedule retry after the specified delay
3. Retry up to `REG_FAILBACK_429_MAX_RETRIES` (5) times
4. On exhaustion, switch to backup servers

---

## Examples

### Registration is Triggered by Line

```typescript
// Inside Line.register()
await this.registration.triggerRegistration();
```

### Checking Registration State

```typescript
const isRegistered = registration.isDeviceRegistered(); // true if ACTIVE
const status = registration.getStatus(); // 'IDLE' | 'active' | 'inactive'
const deviceInfo = registration.getDeviceInfo();
const activeMobiusUrl = registration.getActiveMobiusUrl();
```

### Handling Reconnection

```typescript
// CallingClient calls this after network/Mercury recovery
const success = await registration.handleConnectionRestoration(true);

// Or defer reconnect if calls are active
await registration.reconnectOnFailure('mercuryReconnect');
```

### Clean Deregistration

```typescript
await registration.deregister();
// Sends DELETE /devices/{id} to Mobius
// Stops keepalive Web Worker
// Sets status to IDLE
```

---

## Types

### IRegistration Interface

See full interface in `registration/types.ts`.

### Key Type Aliases

```typescript
type Header = {[key: string]: string};

type restoreRegistrationCallBack = (
  restoreData: unknown,
  caller: string,
) => Promise<boolean>;

type retry429CallBack = (
  retryAfter: number,
  caller: string,
) => void;

type FailoverCacheState = {
  attempt: number;
  timeElapsed: number;
  retryScheduledTime: number;
  serverType: string;
};
```

---

## Files in This Module

| File | Purpose |
|------|---------|
| `index.ts` | Re-exports from `register.ts` |
| `register.ts` | `Registration` class implementation |
| `types.ts` | `IRegistration` interface, type aliases |
| `webWorker.ts` | Keepalive Web Worker logic (direct) |
| `webWorkerStr.ts` | Stringified Web Worker for Blob URL creation |
| `registerFixtures.ts` | Test fixtures |
| `register.test.ts` | Unit tests for Registration |
| `webWorker.test.ts` | Unit tests for Web Worker |

---

## Related Documentation

- [Registration Architecture](./ARCHITECTURE.md) — Internal flows, failover, keepalive details
- [Line AGENTS.md](../../line/ai-docs/AGENTS.md) — Line owns Registration via `lineEmitter`
- [CallingClient AGENTS.md](../../ai-docs/AGENTS.md) — Parent module overview
- [Error Handling Patterns](../../../../ai-docs/patterns/error-handling-patterns.md) — LineError, CallingClientError

---

_Last Updated: 2026-03-15_
