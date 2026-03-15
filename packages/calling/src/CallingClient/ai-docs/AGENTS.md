# CallingClient Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

Do **not** use this file as your only entry point for reasoning or code generation.

- **First step:** Locate and review the package-level `ai-docs/patterns/` directory at `packages/calling/ai-docs/patterns/` for cross-cutting patterns (TypeScript, events, state machines, error handling, testing, architecture).
- **How to proceed:**
  - For changes within the `line/` subdirectory, also load [line/ai-docs/AGENTS.md](../line/ai-docs/AGENTS.md).
  - For changes within the `registration/` subdirectory, also load [registration/ai-docs/AGENTS.md](../registration/ai-docs/AGENTS.md).
  - For changes within the `calling/` subdirectory (Call, CallManager, CallerId), refer to the package-level patterns — especially [event-patterns.md](../../../ai-docs/patterns/event-patterns.md) and [state-machine-patterns.md](../../../ai-docs/patterns/state-machine-patterns.md).
- **Important:** Always load the package-level patterns first, then the module-specific docs in this file, then drill into subdirectory docs as needed.

---

## Overview

The `CallingClient` is the top-level orchestrator for the Webex Calling SDK. It manages line registration, call lifecycle coordination, Mobius server discovery, network resilience, and media engine configuration.

It is the **only entry point** for applications consuming the calling SDK — applications create a `CallingClient` via the `createClient()` factory function and interact with lines and calls through it.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/CallingClient/CallingClient.ts`

**Factory:** `createClient(webex, config?) → ICallingClient`

---

## Purpose

The CallingClient module enables applications to:

- **Register a telephony line** with the Webex Calling (Mobius) backend
- **Make and receive calls** via WebRTC and the ROAP media protocol
- **Handle network disruptions** with automatic reconnection and failover
- **Discover Mobius servers** (primary and backup) based on client region
- **Manage call lifecycle** through the CallManager singleton
- **Upload diagnostic logs** to the Webex support infrastructure
- **Query active calls and devices** registered to the user

### Key Capabilities

| Capability | Description |
|------------|-------------|
| **Line Registration** | Create and register a Line with Mobius, including keepalive and failover |
| **Outbound Calls** | Initiate calls via `line.makeCall()` |
| **Inbound Calls** | Receive incoming calls via `LINE_EVENTS.INCOMING_CALL` |
| **Call Control** | Hold, resume, transfer, mute, DTMF via `ICall` methods |
| **Network Resilience** | Automatic reconnection on network flap and Mercury disconnection |
| **Mobius Discovery** | Region-based server discovery with primary/backup failover |
| **Media Engine** | Configures `@webex/internal-media-core` for WebRTC |
| **Diagnostics** | Log upload and metric submission |
| **Multi-Backend** | Supports Webex Calling, UCM, and Broadworks via `ServiceIndicator` |

---

## Examples and Use Cases

### Getting Started

#### Create and Initialize a CallingClient

```typescript
import {createClient} from '@webex/calling';

const callingClient = await createClient(webex, {
  logger: {level: 'info'},
  serviceData: {indicator: 'calling', domain: ''},
});
```

The `createClient` factory instantiates `CallingClient` and calls `init()`, which:
1. Performs ICE warmup (Windows Chromium only)
2. Discovers Mobius servers for the client region
3. Creates a Line and begins registration

#### Register a Line and Listen for Events

```typescript
const lines = callingClient.getLines();
const line = Object.values(lines)[0];

line.on('registered', (registeredLine) => {
  console.log('Line registered:', registeredLine.lineId);
  console.log('Phone number:', registeredLine.phoneNumber);
});

line.on('error', (error) => {
  console.error('Line error:', error.getError());
});

line.on('line:incoming_call', (call) => {
  console.log('Incoming call from:', call.getCallerInfo());
  call.answer(localAudioStream);
});

line.register();
```

#### Make an Outbound Call

```typescript
const callDetails = {type: 'uri', address: 'sip:user@example.com'};
const call = line.makeCall(callDetails);

call.on('connect', (callId) => {
  console.log('Call connecting:', callId);
});

call.on('established', (callId) => {
  console.log('Call established:', callId);
});

call.on('disconnect', (callId) => {
  console.log('Call ended:', callId);
});

call.dial(localAudioStream);
```

#### Handle Network Disruptions

```typescript
line.on('reconnecting', () => {
  console.log('Network disruption — attempting to reconnect...');
});

line.on('reconnected', () => {
  console.log('Successfully reconnected to Mobius');
});
```

#### Upload Diagnostic Logs

```typescript
try {
  const response = await callingClient.uploadLogs();
  console.log('Logs uploaded:', response);
} catch (error) {
  console.error('Log upload failed:', error);
}
```

#### Query Active Calls and Devices

```typescript
const activeCalls = callingClient.getActiveCalls();
const connectedCall = callingClient.getConnectedCall();
const devices = await callingClient.getDevices();
```

---

## Public API

### ICallingClient Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `getSDKConnector` | `(): ISDKConnector` | Returns the SDK connector singleton |
| `getLoggingLevel` | `(): LOGGER` | Returns the current log level |
| `getLines` | `(): Record<string, ILine>` | Returns all registered lines |
| `getDevices` | `(userId?: string): Promise<DeviceType[]>` | Fetches devices from Mobius for the user |
| `getActiveCalls` | `(): Record<string, ICall[]>` | Returns active calls grouped by lineId |
| `getConnectedCall` | `(): ICall \| undefined` | Returns the currently connected (non-held) call |
| `uploadLogs` | `(): Promise<UploadLogsResponse>` | Uploads diagnostic logs to Webex |
| `mediaEngine` | `typeof Media` | The `@webex/internal-media-core` engine |

### Events Emitted

| Event | Enum Key | Payload | Description |
|-------|----------|---------|-------------|
| `callingClient:error` | `CALLING_CLIENT_EVENT_KEYS.ERROR` | `CallingClientError` | Client-level error |
| `callingClient:user_recent_sessions` | `CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO` | `CallSessionEvent` | User session info from Janus |
| `callingClient:all_calls_cleared` | `CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED` | _(none)_ | All active calls have ended |

---

## Configuration

### CallingClientConfig

```typescript
interface CallingClientConfig {
  logger?: {level: LOGGER};
  discovery?: {country: string; region: string};
  serviceData?: {indicator: ServiceIndicator; domain?: string};
  jwe?: string;
}
```

| Property | Required | Default | Description |
|----------|----------|---------|-------------|
| `logger.level` | No | `ERROR` | Log verbosity level |
| `discovery.country` | No | Auto-detected | Override country for Mobius discovery |
| `discovery.region` | No | Auto-detected | Override region for Mobius discovery |
| `serviceData.indicator` | No | `CALLING` | Backend: `calling` or `contactcenter` |
| `serviceData.domain` | No | `''` | Backend domain |
| `jwe` | No | - | JSON Web Encryption token for secure registration |

---

## Dependencies

### Runtime Dependencies

| Package | Purpose |
|---------|---------|
| `@webex/internal-media-core` | WebRTC, ROAP media connections |
| `@webex/media-helpers` | Microphone stream, noise reduction |
| `@webex/internal-plugin-metrics` | Telemetry and metrics |
| `async-mutex` | Concurrency control for registration |
| `xstate` | State machines for call and media lifecycle |
| `uuid` | Unique identifier generation |

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| `SDKConnector` | Singleton bridge to Webex SDK and Mercury WebSocket |
| `CallManager` | Singleton managing all active Call instances |
| `MetricManager` | Singleton for telemetry submission |
| `Logger` | Structured logging with file/method context |
| `Eventing<T>` | Typed event emitter base class |

---

## Subdirectory Documentation

For detailed documentation on specific subsystems:

| Subdirectory | AGENTS.md | ARCHITECTURE.md | Description |
|--------------|-----------|-----------------|-------------|
| `line/` | [line/ai-docs/AGENTS.md](../line/ai-docs/AGENTS.md) | [line/ai-docs/ARCHITECTURE.md](../line/ai-docs/ARCHITECTURE.md) | Line management, registration orchestration, call initiation |
| `registration/` | [registration/ai-docs/AGENTS.md](../registration/ai-docs/AGENTS.md) | [registration/ai-docs/ARCHITECTURE.md](../registration/ai-docs/ARCHITECTURE.md) | Device registration, keepalive, failover, web worker |

For the `calling/` subdirectory (Call, CallManager, CallerId), refer to the package-level patterns:
- [State Machine Patterns](../../../ai-docs/patterns/state-machine-patterns.md) — Call and ROAP state machines
- [Event Patterns](../../../ai-docs/patterns/event-patterns.md) — Call event types and emission
- [Error Handling Patterns](../../../ai-docs/patterns/error-handling-patterns.md) — CallError handling

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams
- [TypeScript Patterns](../../../ai-docs/patterns/typescript-patterns.md) — Naming, types, enums
- [Testing Patterns](../../../ai-docs/patterns/testing-patterns.md) — Jest setup, mocking, fixtures
- [Architecture Patterns](../../../ai-docs/patterns/architecture-patterns.md) — Singleton, factory, client patterns

---

_Last Updated: 2026-03-15_
