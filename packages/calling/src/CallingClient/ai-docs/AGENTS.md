# CallingClient Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

Do **not** use this file as your only entry point for reasoning or code generation.

- **How to proceed:**
  - For changes within the `line/` subdirectory, also load [line/ai-docs/AGENTS.md](../line/ai-docs/AGENTS.md).
  - For changes within the `registration/` subdirectory, also load [registration/ai-docs/AGENTS.md](../registration/ai-docs/AGENTS.md).
  - For changes within the `calling/` subdirectory (Call, CallManager, CallerId), refer to the calling subdirectory source files directly.
- **Important:** Load the module-specific docs in this file first, then drill into subdirectory docs as needed.

---

## Overview

The `CallingClient` is one of the significant modules in the Webex Calling SDK, responsible for the main WebRTC call flow implementation. It manages line registration, call lifecycle coordination, Mobius server discovery, and network resilience.

Applications create a `CallingClient` via the `createClient()` factory function and interact with lines and calls through it.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/CallingClient/CallingClient.ts`

**Factory:** `createClient(webex, config?) → ICallingClient`

---

### Key Capabilities

| Capability | Description  |
| ----------- | ----------- |
| **Mobius Discovery**         | Performs region-based Mobius server discovery to select optimal primary and backup endpoints for registration, calls, and media.                                 |
| **Line Registration**        | Creates and registers Lines with Mobius, establishing signaling sessions, subscribing for events, and managing registration/status. Includes Line keepalives and failover routines. |
| **Media Engine Management**  | Initializes and configures the `@webex/internal-media-core` engine to negotiate, establish, and manage WebRTC media streams for audio and video calls.           |
| **Call Keepalive**           | Periodically sends keepalive messages for both Lines and active Calls, ensuring session continuity and timely detection of network or signaling issues.           |
| **Call Control**             | Orchestrates all aspects of call initiation, handling, and features. Divided into the following subcapabilities:                                                |
| &nbsp;&nbsp;• Outbound Calls | Enables agents to initiate outbound calls using `line.makeCall()`. Handles call setup, signaling, and media path establishment, including error cases.            |
| &nbsp;&nbsp;• Inbound Calls  | Receives and processes incoming calls via `LINE_EVENTS.INCOMING_CALL`, triggers session setup, and allocates resources for the new call.                         |
| &nbsp;&nbsp;• Supplementary Services | Provides additional in-call features including hold, resume, transfer, mute, and sending DTMF using `ICall` interface methods and underlying SIP signaling. Hold and resume suspend and reestablish the audio+video media while maintaining session context. Transfer allows the redirection of calls to alternate destinations. |
| **Active Call Monitoring**   | Monitors and tracks all ongoing calls, connection state (connected, held, disconnected), participant media status, and synchronization across lines and devices.  |
| **Network Resilience**       | Detects network outages or Mercury channel disconnects; triggers reconnection, re-registration, and call state recovery logic to restore service with minimal interruption. |
| **Diagnostics & Logging**    | Collects and uploads diagnostic logs and metrics for calls, registrations, and failures to Webex cloud for troubleshooting, monitoring, and analytics purposes.   |
| **Service Indicators & Access Flows** | Supports various service flows and user types (`calling`, `guestcalling`, `contactcenter`) through the `ServiceIndicator`, enabling correct registration and feature availability based on license and context. |

---

## Public API

### ICallingClient Interface

The following methods are defined on the `ICallingClient` interface and are the officially supported public API:

| Method             | Signature                                  | Description                                     |
| ------------------ | ------------------------------------------ | ----------------------------------------------- |
| `getSDKConnector`  | `(): ISDKConnector`                        | Returns the SDK connector singleton             |
| `getLoggingLevel`  | `(): LOGGER`                               | Returns the current log level                   |
| `getLines`         | `(): Record<string, ILine>`                | Returns all the lines                           |
| `getDevices`       | `(userId?: string): Promise<DeviceType[]>` | Fetches devices from Mobius for the user        |
| `getActiveCalls`   | `(): Record<string, ICall[]>`              | Returns active calls grouped by lineId          |
| `getConnectedCall` | `(): ICall \| undefined`                   | Returns the currently connected (non-held) call |
| `mediaEngine`      | `typeof Media`                             | The `@webex/internal-media-core` engine         |

### CallingClient Class Methods (not on ICallingClient interface)

| Method       | Signature                         | Description                                          |
| ------------ | --------------------------------- | ---------------------------------------------------- |
| `uploadLogs` | `(): Promise<UploadLogsResponse>` | Uploads diagnostic logs to Webex (class method only) |

### Events Emitted

| Event                                | Enum Key                                      | Payload              | Description                  |
| ------------------------------------ | --------------------------------------------- | -------------------- | ---------------------------- |
| `callingClient:error`                | `CALLING_CLIENT_EVENT_KEYS.ERROR`             | `CallingClientError` | Client-level error           |
| `callingClient:outgoing_call`        | `CALLING_CLIENT_EVENT_KEYS.OUTGOING_CALL`     | `string` (callId)    | Outbound call initiated      |
| `callingClient:user_recent_sessions` | `CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO` | `CallSessionEvent`   | User session info from Janus |
| `callingClient:all_calls_cleared`    | `CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED` | _(none)_             | All active calls have ended  |

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

| Property                | Required | Default       | Description                                                 |
| ----------------------- | -------- | ------------- | ----------------------------------------------------------- |
| `logger.level`          | No       | `ERROR`       | Log verbosity level                                         |
| `discovery.country`     | No       | Auto-detected | Override country for Mobius discovery                       |
| `discovery.region`      | No       | Auto-detected | Override region for Mobius discovery                        |
| `serviceData.indicator` | No       | `CALLING`     | Service flow: `calling`, `guestcalling`, or `contactcenter` |
| `serviceData.domain`    | No       | `''`          | RTMS domain required for contact center flow                |
| `jwe`                   | No       | -             | JSON Web Encryption token having destination information. This is only required for guest calling flow |

---

## Examples and Use Cases

### Getting Started

#### Create and Initialize a CallingClient

```typescript
import {createClient, ServiceIndicator} from '@webex/calling';

const callingClient = await createClient(webex, {
  logger: {level: 'info'},
  serviceData: {indicator: ServiceIndicator.CALLING, domain: ''},
});
```

The `createClient` factory instantiates `CallingClient` and calls `init()`, which:

1. Performs ICE warmup (Windows Chromium only)
2. Discovers Mobius servers for the client region (via `ds.ciscospark.com`)
3. Creates a Line object internally

**Note:** `init()` does NOT register the line. The application must call `line.register()` explicitly after obtaining the line via `getLines()`.

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

## Dependencies

### Runtime Dependencies

| Package                          | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| `@webex/internal-media-core`     | WebRTC, ROAP media connections              |
| `@webex/media-helpers`           | Microphone stream, noise reduction          |
| `@webex/internal-plugin-metrics` | Telemetry and metrics                       |
| `async-mutex`                    | Concurrency control for registration        |
| `xstate`                         | State machines for call and media lifecycle |
| `uuid`                           | Unique identifier generation                |

### Internal Dependencies

| Module          | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `SDKConnector`  | Singleton bridge to Webex SDK and Mercury WebSocket |
| `CallManager`   | Singleton managing all active Call instances        |
| `MetricManager` | Singleton for telemetry submission                  |
| `Logger`        | Structured logging with file/method context         |
| `Eventing<T>`   | Typed event emitter base class                      |

---

## Subdirectory Documentation

For detailed documentation on specific subsystems:

| Subdirectory    | AGENTS.md                                                           | ARCHITECTURE.md                                                                 | Description                                                  |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `line/`         | [line/ai-docs/AGENTS.md](../line/ai-docs/AGENTS.md)                 | [line/ai-docs/ARCHITECTURE.md](../line/ai-docs/ARCHITECTURE.md)                 | Line management, registration orchestration, call initiation |
| `registration/` | [registration/ai-docs/AGENTS.md](../registration/ai-docs/AGENTS.md) | [registration/ai-docs/ARCHITECTURE.md](../registration/ai-docs/ARCHITECTURE.md) | Device registration, keepalive, failover, web worker         |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams
