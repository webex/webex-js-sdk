# Calling Package - Agent Specification

## Overview

The `@webex/calling` package provides a comprehensive set of APIs for Webex Calling functionalities including line registration, call management, call history, call settings, contacts, and voicemail. It is built as a modular TypeScript SDK that integrates with the Webex platform via the `SDKConnector` and communicates with the Mobius signaling backend for call control operations.

## Package Entry Point

The package exports its public API through `src/index.ts`, exposing factory functions for each module:

```typescript
import {
  createClient,              // CallingClient
  createCallHistoryClient,   // CallHistory
  createCallSettingsClient,  // CallSettings
  createContactsClient,      // Contacts
  createVoicemailClient,     // Voicemail
  Logger,
} from '@webex/calling';
```

## Module Index

| Module | Main Class | Factory Function | Interface | Description |
|--------|-----------|-----------------|-----------|-------------|
| **CallingClient** | `CallingClient` | `createClient()` | `ICallingClient` | Core module for line registration and call management |
| **CallHistory** | `CallHistory` | `createCallHistoryClient()` | `ICallHistory` | Retrieval, update, and deletion of call history records |
| **CallSettings** | `CallSettings` | `createCallSettingsClient()` | `ICallSettings` | Call waiting, DND, call forwarding, voicemail settings |
| **Contacts** | `ContactsClient` | `createContactsClient()` | `IContacts` | Contact and contact group management |
| **Voicemail** | `Voicemail` | `createVoicemailClient()` | `IVoicemail` | Voicemail list, content, summary, read/unread, delete, transcripts |

## Supporting Modules

| Module | Purpose |
|--------|---------|
| **Errors** | Hierarchical error classes: `ExtendedError` -> `CallingClientError`, `LineError`, `CallError` |
| **Events** | `Eventing<T>` base class (typed `EventEmitter`) and all event enums/types |
| **Logger** | Logging singleton with configurable levels (`ERROR`, `WARN`, `LOG`, `INFO`, `TRACE`) |
| **Metrics** | `MetricManager` for submitting registration, connection, and call metrics |
| **SDKConnector** | Singleton bridge to the Webex SDK for HTTP requests and Mercury event listeners |
| **common** | Shared types, constants, and utility functions used across modules |

## Module Documentation References

Each module maintains its own `ai-docs/` folder with detailed specifications:

| Module | Documentation Path |
|--------|-------------------|
| CallingClient | `src/CallingClient/ai-docs/` |
| CallHistory | `src/CallHistory/ai-docs/` (planned) |
| CallSettings | `src/CallSettings/ai-docs/` (planned) |
| Contacts | `src/Contacts/ai-docs/` (planned) |
| Voicemail | `src/Voicemail/ai-docs/` (planned) |

Each `ai-docs/` folder contains:
- **Agents.md** - Module purpose, key capabilities, and high-level behavior
- **Architecture.md** - Low-level specifications including state machines, events, APIs, and architectural diagrams

## Architecture Overview

```
+-----------------------------------------------------------+
|                    Application Layer                       |
+-----------------------------------------------------------+
         |                                    |
         v                                    v
+------------------+    +--------------------------------------------+
|  CallingClient   |    |  CallHistory / CallSettings / Contacts /   |
|  (ICallingClient)|    |  Voicemail                                 |
+------------------+    +--------------------------------------------+
    |         |                        |
    v         v                        v
+-------+  +-------------+     +---------------+
|  Line |  | CallManager |     | SDKConnector  |
| (ILine)|  |(ICallManager)|    | (singleton)   |
+-------+  +-------------+     +---------------+
    |           |                      |
    v           v                      v
+----------------+  +------+    +-----------+
| Registration   |  | Call |    | Webex SDK |
| (IRegistration)|  |(ICall)|   |  (webex)  |
+----------------+  +------+    +-----------+
    |                  |              |
    v                  v              v
+-----------------------------------------------------------+
|              Mobius Signaling Backend                      |
|  (Registration, Call Control, Keepalive, Failover)        |
+-----------------------------------------------------------+
         |                        |
         v                        v
+------------------+    +-------------------+
| Mercury WebSocket|    | ROAP Media (via   |
| (event:mobius)   |    | @webex/internal-  |
|                  |    |  media-core)      |
+------------------+    +-------------------+
```

## Calling Backend Support

The package supports three calling backends, determined by `ServiceIndicator`:

| Backend | Enum Value | Indicator |
|---------|-----------|-----------|
| Webex Calling | `CALLING_BACKEND.WXC` | `ServiceIndicator.CALLING` |
| Broadworks | `CALLING_BACKEND.BWRKS` | `ServiceIndicator.CALLING` |
| UCM (Unified Communications Manager) | `CALLING_BACKEND.UCM` | `ServiceIndicator.CALLING` |
| Contact Center | - | `ServiceIndicator.CONTACT_CENTER` |
| Guest Calling | - | `ServiceIndicator.GUEST_CALLING` |

The `CallSettings` and `Voicemail` modules use a **Strategy Pattern** with backend-specific connectors (`WxCallBackendConnector`, `UcmBackendConnector`, `BroadworksBackendConnector`) selected based on the detected calling backend.

## Key Dependencies

| Dependency | Purpose |
|------------|---------|
| `@webex/internal-media-core` | WebRTC media engine, `LocalMicrophoneStream`, `RoapMediaConnection` |
| `async-mutex` | Thread-safe mutex for registration and call operations |
| `uuid` | Unique identifier generation for line IDs and correlation IDs |
| `typed-emitter` | Type-safe event emitter base |
| `xstate` | State machine implementation for call and media (ROAP) state management |
