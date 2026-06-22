# mobius-socket Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

- **First step:** Load the parent [`packages/calling/AGENTS.md`](../../../AGENTS.md) for package-level routing.
- **For CallingClient transport integration:** Also load [`CallingClient/ai-docs/AGENTS.md`](../../CallingClient/ai-docs/AGENTS.md). `CallingClient` consumes this module through the `APIRequest` wrapper in `src/CallingClient/utils/request.ts` (it does **not** import `MobiusSocket` directly outside that wrapper).
- **Subdirectory scope:** All documentation for `socket/` and `test/` lives in this single `ai-docs/` folder. Do **not** create per-subdirectory `ai-docs/` folders inside `mobius-socket/`.

---

## Overview

The `mobius-socket` module implements the **Mobius WebSocket transport** used by `CallingClient`. It provides a single, long-lived WebSocket connection to a Mobius node and exposes a request/response and async-event API on top of it. When the WSS feature flag (`webrtc-calling-over-ws-CALL-219562`) is enabled in WDM (or via the samples-page `localStorage` override), most Mobius REST traffic (registration, call setup, keepalive, supplementary services) is routed through this socket instead. Discovery (`CallingClient.getMobiusServers`), device listing (`getDevices`), and failback health pings (`Registration.isPrimaryActive`) always use `webex.request()` directly regardless of the flag.

This module is **transport-only**. It does not know about calls, lines, registration, or any calling-business logic — those concerns live in the `CallingClient` module. The socket emits raw envelopes and the `APIRequest` layer in `CallingClient/utils/request.ts` translates them into `WebexRequestPayload`-shaped responses for the rest of the SDK.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/mobius-socket/index.ts`

**Class:** `MobiusSocket extends EventEmitter`

**Factories:**
- `getMobiusSocketInstance(webex, config?) → MobiusSocket` — module-level singleton accessor
- `resetMobiusSocketInstance(): void` — drops the cached singleton (used by tests and instance recycling)

---

## Key Capabilities

| Capability | Description |
|---|---|
| **Singleton lifecycle** | One `MobiusSocket` instance per process via `getMobiusSocketInstance()`. `resetMobiusSocketInstance()` clears the cache. |
| **Connect / disconnect** | `connect(webSocketUrl?)` opens (or reuses) a socket to the supplied URL, falling back to `webex.internal.device.webSocketUrl`. `disconnect(options?)` aborts retries, removes listeners, and closes the underlying socket. |
| **Request / response** | `sendWssRequest(payload, options?)` sends a JSON envelope keyed by `trackingId` and resolves with the matching `SocketResponse`. |
| **Async-event delivery** | Mobius async events (`async_event` envelopes) are deduped by `eventId` (LRU cache, see `dedupCacheMaxSize`) and re-emitted to listeners as `event:async_event`, `event:<type>`, and `event:<namespace>`. |
| **Auto-reconnect** | `backoff.ExponentialStrategy` with `initialDelay = backoffTimeReset`, `maxDelay = backoffTimeMax`, capped retries based on `initialConnectionMaxRetries` (first attempt) and `maxRetries` (subsequent reconnects). |
| **Token refresh** | Hourly `setInterval` while connected (`TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000`). Also triggered inline when the underlying socket surfaces a `statusCode 440` on a non-AUTH response. Calls `webex.credentials.refresh({force: true})` (when `canRefresh`) and re-authenticates the live socket via `Socket#refresh`. |
| **Make-before-break shutdown switchover** | On receipt of a server-initiated `{type: 'shutdown'}` envelope, a second socket is opened in parallel. When the new socket authenticates, it is promoted and the old socket is left in place to be closed by Mobius with code `4001`. |
| **Close-code policy** | Standard WebSocket close codes plus Mobius-specific codes (1003 / 4000 / 4001 / 1005-1012 / 3050 / 4401 / 4403 / 4404 / 4429) drive `offline`, `offline.permanent`, `offline.replaced`, `offline.transient`, and re-auth flows. |

---

## Public API

### `getMobiusSocketInstance(webex, mobiusSocketConfig?)`

```typescript
function getMobiusSocketInstance(
  webex: WebexSDK,
  mobiusSocketConfig?: Partial<MobiusSocketConfig>
): MobiusSocket;
```

- Returns the cached singleton if it exists; otherwise constructs a new `MobiusSocket` using `{...config.mobiusSocket, ...mobiusSocketConfig}`.
- The `webex` argument is **only** consulted on the first call; subsequent calls ignore both `webex` and `mobiusSocketConfig` and return the cached instance.
- Throws (from the `MobiusSocket` constructor) if `webex` is missing on the first call.

### `resetMobiusSocketInstance()`

```typescript
function resetMobiusSocketInstance(): void;
```

- Drops the cached singleton so the next `getMobiusSocketInstance()` call constructs a new one. Used by tests and during re-initialisation of `CallingClient`.

### `MobiusSocket` class

| Method | Signature | Description |
|---|---|---|
| `connect` | `(webSocketUrl?: string): Promise<void>` | Opens (or reuses) the Mobius socket. Idempotent while a `connectPromise` is in flight. If `webSocketUrl` differs from the previously-cached `socketUrl`, the next attempt is treated as a fresh initial connection for retry-budget purposes (`hasEverConnected = false`). When `webSocketUrl` is omitted, falls back to `webex.internal.device.webSocketUrl`. |
| `disconnect` | `(options?: MobiusSocketCloseOptions): MobiusSocketDisconnectResult` | Aborts both the primary and shutdown-switchover backoff calls, clears state, stops the token-refresh timer, removes listeners, and closes the underlying socket. Safe to call when no socket is open. |
| `sendWssRequest` | `(payload: MobiusSocketRequestPayload, options?: MobiusSocketRequestOptions): Promise<SocketResponse>` | Sends a JSON request and resolves with the matching response (correlated by `trackingId`). Rejects when the socket is not connected or the payload is invalid. |
| `isConnected` | `(): boolean` | Returns the cached `connected` flag (true after the first successful auth handshake until the active socket closes). |
| `getConnectedWebSocketUrl` | `(): string \| undefined` | Returns the URL of the currently-connected socket, or `undefined` when no socket is connected. |
| `on` / `off` / `emit` | inherited from `EventEmitter` | `off(eventName)` without a listener removes **all** listeners for that event (override). |

### Events Emitted

| Event | Payload | When |
|---|---|---|
| `online` | _(none)_ | First successful authenticated connection (or post-reconnect success). Emitted only for the primary connection path, not for shutdown switchover (switchover emits `event:mobius_shutdown_switchover_complete` instead). |
| `offline` | `SocketCloseEvent` | The active socket has closed. Emitted only when the closing socket is the currently-active one. |
| `offline.permanent` | `SocketCloseEvent` | Close codes that must not trigger reconnect: `1000`, `1001`, `1003`, `4001` (active socket only), `4429` (active socket only), `3050` (with a non-normal reason), default branch. |
| `offline.replaced` | `SocketCloseEvent` | Close code `4000` — the server replaced the connection. |
| `offline.transient` | `SocketCloseEvent` | Close codes `1005`, `1006`, `1011`, `1012`, and `3050` with `reason ∈ {'idle', 'done (forced)'}`. Triggers automatic `reconnect`. |
| `connection_failed` | `(error, {retries})` | A non-1006 attempt failed and at least one retry has already been spent on this backoff cycle. |
| `event` | raw envelope | Catch-all: every non-shutdown, non-duplicate envelope is also re-emitted as `event` for legacy listeners. |
| `event:<envelope.type>` | envelope | Emitted for every typed envelope, e.g. `event:register.response`, `event:call_setup.response`, `event:async_event`. The async-event payload is the **deduped** envelope. |
| `event:<namespace>` | envelope | Emitted from `eventType.split('.')[0]` — e.g. `event:registration`, `event:call`. |
| `event:async_event` | envelope **or** `MOBIUS_SOCKET_4001_EVENT` | Emitted in two distinct situations: **(1) Normal path** — every real Mobius async envelope (`envelope.type === 'async_event'`) triggers this via the generic `event:<envelope.type>` handler; the payload is the deduped envelope. **(2) Synthetic path** — also emitted on close code `4001` (regardless of whether the closing socket is the currently-active one) with the fixed `MOBIUS_SOCKET_4001_EVENT` payload, so consumers always see a `registration.down` event. When the closing socket is active, `offline` and `offline.permanent` are also emitted alongside it. |
| `event:mobius_shutdown_imminent` | shutdown envelope | Fired when Mobius signals an imminent shutdown (`{type: 'shutdown'}`). Reserved for future consumers — not currently subscribed in `CallingClient`. |
| `event:mobius_shutdown_switchover_complete` | `{url}` | The make-before-break replacement socket finished authenticating and was promoted. |
| `event:mobius_shutdown_switchover_failed` | `{reason}` | The switchover backoff exhausted its retries or threw synchronously. |

> `event:async_event` is the **only** event `CallingClient` subscribes to today (via `APIRequest.registerMobiusSocketListener`).

---

## Configuration

### `MobiusSocketConfig`

```typescript
interface MobiusSocketConfig {
  /** Milliseconds to wait for websocket request/response messages, including auth. */
  wssResponseTimeout: number;
  /** Maximum milliseconds between connection attempts. */
  backoffTimeMax: number;
  /** Initial milliseconds between connection attempts. */
  backoffTimeReset: number;
  /** Maximum number of retries for the initial connect() flow before rejecting. */
  initialConnectionMaxRetries: number;
  /** Maximum number of retries for reconnect attempts. 0 means unlimited (backoff library default). */
  maxRetries: number;
  /** Milliseconds to wait for a close frame before forcing closure. */
  forceCloseDelay: number;
  /** Maximum eventIds retained in the dedup cache to suppress duplicate async_event messages. */
  dedupCacheMaxSize: number;
}
```

### Defaults (`config.ts`)

| Property | Default | Notes |
|---|---|---|
| `wssResponseTimeout` | `10000` ms | Per-request timeout. Falls through to `Socket#sendRequest` which uses `10000` ms when neither the per-call override nor this default is set. |
| `backoffTimeMax` | `32000` ms | Exponential backoff ceiling. |
| `backoffTimeReset` | `1000` ms | Initial backoff delay. |
| `initialConnectionMaxRetries` | `0` | `0` disables retries on the very first connect (`call.retryIf(() => false)`); positive values cap retries with `call.failAfter(n)`. |
| `maxRetries` | `3` | Applied to subsequent connects/reconnects when `hasEverConnected === true`. |
| `forceCloseDelay` | `2000` ms | Time the `Socket` waits for a close event before synthesising one. |
| `dedupCacheMaxSize` | `1000` | LRU eviction threshold for the seen `async_event` `eventId` map. |

### Caller overrides

`CallingClient` accepts an SDK-level escape hatch via `webex.config.defaultMobiusSocketOptions`. When set, those options are merged into the per-attempt options passed to `Socket#open` (after the SDK-provided `token`, `refreshToken`, `trackingId`, `logger`, `forceCloseDelay`, and `wssResponseTimeout`). This is intended for advanced diagnostic tuning and must not be used to override `token` or `refreshToken`.

---

## How CallingClient Consumes mobius-socket

`mobius-socket` is **not** imported directly anywhere outside `src/CallingClient/utils/request.ts`. All access goes through the `APIRequest` singleton:

| `APIRequest` method | Delegates to | Used by |
|---|---|---|
| `isSocketEnabled()` | `isMobiusWssEnabled(webex)` (in `utils/wsFeatureFlag.ts`) | `CallingClient`, `Registration`, `CallManager` (to skip the Mercury `event:mobius` listener when WSS is on). |
| `connectToMobiusSocket(wssUrl)` | `MobiusSocket#isConnected`, `MobiusSocket#connect`, `MobiusSocket#getConnectedWebSocketUrl` | `CallingClient.connectToMobiusSocket` (post-discovery), `Registration.attemptRegistrationWithServers` (per server URI). |
| `disconnectFromMobiusSocket(options?)` | `MobiusSocket#disconnect` | `Registration.restorePreviousRegistration` / `startFailoverTimer` / `executeFailback` / `deregister` / `performRegistrationDownCleanup` / `attemptRegistrationWithServers` error branch. |
| `getConnectedWebSocketUrl()` | `MobiusSocket#getConnectedWebSocketUrl` | `Registration` (to decide whether the current connection still matches `activeMobiusUrl`). |
| `makeRequest(request)` | `MobiusSocket#sendWssRequest` when WSS is enabled, otherwise `webex.request` | Mobius REST traffic routed through `APIRequest`: register, deregister, call setup/state/media/status, supplementary services, keepalive 404 recovery, etc. **Not** used for Mobius server discovery (`getMobiusServers`), device listing (`getDevices`), or failback health pings (`Registration.isPrimaryActive`) — those call `webex.request()` directly. |
| `registerMobiusSocketListener(cb)` | `MobiusSocket#on('event:async_event', cb)` | `CallingClient.init` (when WSS is enabled), invoking `handleMobiusAsyncEvent` to fan out to `CallManager.dequeueWsEvents` or `Registration.handleRegistrationDownEvent`. |
| `unregisterMobiusSocketListener()` | `MobiusSocket#off('event:async_event')` | Currently only invoked from tests/cleanup paths. |

> **Disconnect close code convention:** `CallingClient` uses `{code: 3050, reason: 'done (permanent)'}` when it wants the socket to stay torn down across a permanent state change (e.g. failover, failback, registration-down). Close code `3050` with reason `'idle'` or `'done (forced)'` is treated as transient by Mobius and triggers reconnect on receipt.

---

## Error Classes (`errors.ts`)

All connection-level errors extend `@webex/common`'s `Exception`.

| Class | Trigger | Caller response (`MobiusSocket.attemptConnection`) |
|---|---|---|
| `ConnectionError` | Generic close (default branch in `Socket#open`) | Bubbled up; `MobiusSocket.attemptConnection` calls back the backoff callback for retry. |
| `UnknownResponse` | `Socket#open` saw close code `1005` (IE legacy 4XXX masking) | Triggers `webex.internal.device.refresh()`, then propagates to backoff for retry. |
| `BadRequest` | Close code `4400` | Aborts the backoff call (`backoffCallNormal.abort()`) — unrecoverable. |
| `Forbidden` | Close code `4403` | Aborts the backoff call — unrecoverable. |
| `NotAuthorized` | Close code `4401` | Calls `webex.credentials.refresh({force: true})`, then propagates for retry. |

`MobiusSocketResponseError` is a plain `Error` (not an `Exception`) returned by `createWssResponseError` / `createTimeoutError` when a websocket request fails or times out. It carries `statusCode`, `statusMessage`, `response`, and `trackingId`.

---

## File Structure

```
mobius-socket/
├── index.ts                            # Singleton accessor + re-exports
├── mobius-socket.ts                    # MobiusSocket (connect/disconnect/sendWssRequest/event fan-out)
├── config.ts                           # MobiusSocketConfig + defaults
├── errors.ts                           # ConnectionError + subclasses, createWssResponseError, createTimeoutError
├── types.ts                            # MobiusSocketRequestPayload/Options, MobiusSocketCloseOptions, MobiusSocketResponseError
├── socket/
│   ├── index.ts                        # Re-exports the env-appropriate Socket
│   ├── socket.ts                       # Node binding (`ws` package)
│   ├── socket.shim.ts                  # Browser binding (uses global WebSocket / MozWebSocket)
│   ├── socket-base.ts                  # Generalised Socket abstraction (open/close/send/sendRequest/authorize/refresh)
│   ├── constants.ts                    # SOCKET_READY_STATE, MESSAGE_TYPES, MOBIUS_SOCKET_4001_EVENT
│   └── types.ts                        # SocketCloseEvent, SocketResponse, SocketOpenOptions, PendingResponseEntry, ...
├── test/                               # Test-only helpers (mocha-helpers.ts, promise-tick.ts)
├── mobius-socket.test.ts               # Connect/disconnect/reconnect/dedup/token-refresh tests
├── mobius-socket-events.test.ts        # Event fan-out + emitter override tests
├── socket.test.ts                      # socket-base tests (open/close/send/authorize/refresh)
├── errors.test.ts                      # Error class smoke tests
└── ai-docs/
    ├── AGENTS.md                       # This file
    └── ARCHITECTURE.md                 # Sequence diagrams + flow internals
```

> The `socket/` folder is internal to this module. Outside `mobius-socket/`, only the `MobiusSocket` class and the singleton accessors are part of the public surface. Per the directive at the top of this document, do **not** create a separate `ai-docs/` folder inside `socket/` or `test/` — all relevant detail lives here.

---

## Examples

### Get the singleton and connect

```typescript
import {getMobiusSocketInstance} from '@webex/calling/mobius-socket';

const socket = getMobiusSocketInstance(webex);
await socket.connect('wss://mobius.example.webex.com/calling/api/v1');

if (socket.isConnected()) {
  console.log('Connected to', socket.getConnectedWebSocketUrl());
}
```

### Send a request and read the response

```typescript
const response = await socket.sendWssRequest(
  {
    type: 'register',
    trackingId: `webex-js-sdk_${crypto.randomUUID()}`,
    metadata: {userAgent, authorization: bearerToken},
    data: {userId, serviceData, clientDeviceUri},
  },
  {timeout: 8000}
);

if (response.statusCode >= 200 && response.statusCode < 300) {
  // handle success
}
```

### Subscribe to async events

```typescript
socket.on('event:async_event', (envelope) => {
  // envelope.data is a Mobius async event (e.g. registration.down, call.setup)
});
```

### Reset the singleton (tests only)

```typescript
import {resetMobiusSocketInstance} from '@webex/calling/mobius-socket';

resetMobiusSocketInstance();
```

---

## Operational Notes / Gotchas

- **Singleton scope:** `getMobiusSocketInstance` ignores subsequent `webex` and `config` arguments. Tests that need a fresh instance must call `resetMobiusSocketInstance()`.
- **`event:async_event` dedup:** Duplicates are suppressed by `eventId` and the cache is LRU-evicted at `dedupCacheMaxSize`. `disconnect()` clears the cache.
- **Token bearer prefix:** `normalizeMobiusAuthToken` strips a leading `Bearer ` before handing the token to `Socket#open`. Callers should not strip it themselves.
- **`connect()` URL change semantics:** Calling `connect(newUrl)` with a URL that differs from the previously-cached `socketUrl` resets `hasEverConnected` so the retry budget is re-evaluated as an initial connect.
- **`disconnect()` while connecting:** Aborts the in-flight backoff and rejects the awaiting `connect()` with `MobiusSocket Connection Aborted`.
- **Shutdown switchover:** The old socket is **not** closed by the SDK after switchover — Mobius is expected to close it with `4001`. `MobiusSocket#onclose` ignores closes from non-active sockets so the new connection's state is preserved.
- **440 response code:** A `statusCode === 440` on a non-AUTH response triggers `refreshToken()` via the `Socket#handlePendingResponse` path; the original response is still rejected to the caller, but the next request will use the refreshed token.
- **Logger:** When the supplied `webex.logger` is missing, the module falls back to `console`. Callers are still expected to provide the SDK logger so log lines route through the SDK's appender chain.

---

## Related Documentation

- [mobius-socket Architecture](./ARCHITECTURE.md) — Sequence diagrams (connect, reconnect, shutdown switchover, token refresh, message dispatch).
- [CallingClient AGENTS.md](../../CallingClient/ai-docs/AGENTS.md) — Consumer-side overview, `APIRequest` wiring.
- [CallingClient ARCHITECTURE.md](../../CallingClient/ai-docs/ARCHITECTURE.md) — End-to-end data flow including WSS path.
- [Registration AGENTS.md](../../CallingClient/registration/ai-docs/AGENTS.md) — Registration-side touch points for connect/disconnect.
