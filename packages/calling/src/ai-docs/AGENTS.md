# @webex/calling — Source Package Guide

## Overview

`@webex/calling` is a browser-based TypeScript SDK for Webex Calling services. It provides a unified API surface for line registration, real-time call control, call history, call settings, contacts management, and voicemail — working transparently across three calling backends: **Webex Calling (WxC)**, **Broadworks (BWRKS)**, and **Unified Communications Manager (UCM)**.

The package is organized as a modular monolith inside `packages/calling/src/`. Each subdirectory owns a domain concern and exposes its contract through TypeScript interfaces. Shared infrastructure (SDK bridge, logging, metrics, eventing, errors) is consumed by all domain modules.

---

## Module Map

| Module | Directory | Purpose |
|---|---|---|
| **CallingClient** | `CallingClient/` | Top-level orchestrator for line registration and call control (Mobius) |
| **CallHistory** | `CallHistory/` | Retrieve, update, and delete call history records (Janus) |
| **CallSettings** | `CallSettings/` | Get/set call waiting, DND, call forwarding, voicemail settings |
| **Contacts** | `Contacts/` | CRUD operations on user contacts and contact groups |
| **Voicemail** | `Voicemail/` | Voicemail listing, playback, read/unread state, deletion, transcription |
| **SDKConnector** | `SDKConnector/` | Singleton bridge to the Webex JS SDK for HTTP and Mercury WebSocket |
| **Logger** | `Logger/` | Leveled structured logging wrapper (delegates to Webex SDK logger) |
| **Metrics** | `Metrics/` | Telemetry submission for registration, calls, media, voicemail, connectivity |
| **Events** | `Events/` | Typed `EventEmitter` base class (`Eventing<T>`) and all event type maps |
| **Errors** | `Errors/` | Custom error hierarchy — `ExtendedError`, `CallError`, `LineError`, `CallingClientError` |
| **common** | `common/` | Shared types, constants, and utility functions used across all modules |

---

## Public API Surface

The package exposes two entry points:

### `index.ts` — Consumer-facing exports

Factory functions for creating module instances:

```typescript
import {
  createClient,            // CallingClient
  createCallHistoryClient, // CallHistory
  createCallSettingsClient,// CallSettings
  createContactsClient,    // Contacts
  createVoicemailClient,   // Voicemail
  Logger,                  // Logger singleton
} from '@webex/calling';
```

Key interfaces and types re-exported:

- `ICallingClient`, `ILine`, `ICall` — calling & line control
- `ICallHistory`, `JanusResponseEvent`, `UserSession` — call history
- `ICallSettings`, `CallForwardSetting`, `VoicemailSetting`, `ToggleSetting` — settings
- `IContacts`, `Contact`, `ContactResponse`, `GroupType` — contacts
- `IVoicemail`, `SummaryInfo`, `VoicemailResponseEvent` — voicemail
- `CallError`, `LineError`, `ERROR_LAYER`, `ERROR_TYPE` — errors
- Event key enums: `CALLING_CLIENT_EVENT_KEYS`, `CALL_EVENT_KEYS`, `LINE_EVENT_KEYS`, `COMMON_EVENT_KEYS`
- Common types: `CallDetails`, `CallDirection`, `CallType`, `SORT`, `SORT_BY`, `ServiceIndicator`
- `CallingClientConfig`, `LOGGER`, `TransferType`, `CallerIdDisplay`, `Disposition`

### `api.ts` — Internal/advanced exports

Re-exports concrete classes (`CallingClient`, `CallHistory`, `CallSettings`, `ContactsClient`, `Voicemail`) in addition to interfaces and factory functions. Used by internal consumers and tests.

---

## Factory Functions

All module instances are created via factory functions. This is the **only** supported instantiation path.

| Factory | Returns | Parameters |
|---|---|---|
| `createClient(webex, config)` | `ICallingClient` | `WebexSDK`, `CallingClientConfig` |
| `createCallHistoryClient(webex, logger)` | `ICallHistory` | `WebexSDK`, `LoggerInterface` |
| `createCallSettingsClient(webex, logger)` | `ICallSettings` | `WebexSDK`, `LoggerInterface` |
| `createContactsClient(webex, logger)` | `IContacts` | `WebexSDK`, `LoggerInterface` |
| `createVoicemailClient(webex, logger)` | `IVoicemail` | `WebexSDK`, `LoggerInterface` |

Every factory internally calls `SDKConnector.setWebex(webex)` if not already initialized.

---

## Configuration

`CallingClientConfig` controls the `CallingClient` module:

```typescript
interface CallingClientConfig {
  logger?: { level: LOGGER };       // 'error' | 'warn' | 'log' | 'info' | 'trace'
  discovery?: {
    country: string;                 // Country code for Mobius region discovery
    region: string;                  // Client region hint
  };
  serviceData?: {
    indicator: ServiceIndicator;     // 'calling' | 'contactcenter' | 'guestcalling'
    domain?: string;
  };
  jwe?: string;                      // Optional JWE token for guest calling
}
```

All other modules accept `{ level: LOGGER }` as their logger configuration.

---

## Quick Start

```typescript
import { createClient, createCallHistoryClient, SORT, SORT_BY } from '@webex/calling';

// 1. Create the CallingClient (handles registration & calls)
const callingClient = await createClient(webex, {
  logger: { level: 'info' },
  serviceData: { indicator: 'calling' },
});

// 2. Get lines and register
const lines = callingClient.getLines();
const line = Object.values(lines)[0];
line.register();

// 3. Listen for registration status
line.on('registered', (lineInfo) => { /* ready to make/receive calls */ });
line.on('error', (err) => { /* handle registration error */ });

// 4. Make a call
const call = line.makeCall({ type: 'uri', address: 'user@example.com' });
call.on('connect', () => { /* call connected */ });
call.on('disconnect', () => { /* call ended */ });

// 5. Use standalone modules
const callHistory = createCallHistoryClient(webex, { level: 'info' });
const records = await callHistory.getCallHistoryData(7, 50, SORT.DESC, SORT_BY.END_TIME);
```

---

## Calling Backend Detection

The SDK automatically detects the user's calling backend from their Webex entitlements:

| Backend | Entitlement | Enum |
|---|---|---|
| Webex Calling | `bc-sp-standard` | `CALLING_BACKEND.WXC` |
| Broadworks | `broadworks-connector` | `CALLING_BACKEND.BWRKS` |
| UCM | `NATIVE_SIP_CALL_TO_UCM` | `CALLING_BACKEND.UCM` |

The `CallSettings` and `Voicemail` modules use the **Strategy pattern** to select the appropriate backend connector class at construction time. The `CallingClient` module always communicates with the Mobius service regardless of backend.

---

## Event System

All modules that emit events extend `Eventing<T>`, a generic typed `EventEmitter` from `Events/impl`. Event type maps are defined in `Events/types.ts`.

| Module | Event Type Map | Key Events |
|---|---|---|
| `ILine` | `LineEventTypes` | `registered`, `unregistered`, `reconnecting`, `reconnected`, `error`, `incoming_call` |
| `ICall` | `CallEventTypes` | `alerting`, `connect`, `established`, `held`, `resumed`, `disconnect`, `call_error`, `remote_media`, `caller_id` |
| `ICallingClient` | `CallingClientEventTypes` | `callingClient:error`, `callingClient:outgoing_call`, `callingClient:user_recent_sessions`, `callingClient:all_calls_cleared` |
| `ICallHistory` | `CallHistoryEventTypes` | `callHistory:user_recent_sessions`, `callHistory:user_viewed_sessions`, `callHistory:user_sessions_deleted` |
| `IVoicemail` | `VoicemailEventTypes` | `call_back_voicemail_content_get` |

---

## Error Hierarchy

All custom errors extend `ExtendedError`:

```
ExtendedError
├── CallError        — correlationId, errorLayer (call_control | media)
├── LineError        — status (RegistrationStatus)
└── CallingClientError — correlationId, errorLayer
```

Errors carry `ERROR_TYPE` (semantic category) and `ERROR_CODE` (HTTP or SDK status code). Factory functions `createCallError()` and `createClientError()` are the standard instantiation path.

---

## Logging Levels

The `Logger` module uses a numeric level hierarchy:

| Level | Value | Includes |
|---|---|---|
| `error` | 1 | Errors only |
| `warn` | 2 | Errors + warnings |
| `log` | 3 | + general messages |
| `info` | 4 | + informational |
| `trace` | 5 | + full stack traces |

Log format: `Calling SDK: <UTC timestamp>: [LEVEL]: file:<filename> - method:<methodName> - message:<content>`

---

## Sub-Module Documentation

For detailed documentation on specific modules, refer to the `ai-docs/` folder within each subdirectory:

| Module | Path |
|---|---|
| CallingClient | `CallingClient/ai-docs/AGENTS.md`, `CallingClient/ai-docs/ARCHITECTURE.md` |
| CallingClient > Line | `CallingClient/line/ai-docs/AGENTS.md`, `CallingClient/line/ai-docs/ARCHITECTURE.md` |
| CallingClient > Registration | `CallingClient/registration/ai-docs/AGENTS.md`, `CallingClient/registration/ai-docs/ARCHITECTURE.md` |
| SDKConnector | `SDKConnector/ai-docs/AGENTS.md`, `SDKConnector/ai-docs/ARCHITECTURE.md` |

---

## Key Interfaces Quick Reference

### ICallingClient

```typescript
interface ICallingClient extends Eventing<CallingClientEventTypes> {
  mediaEngine: typeof Media;
  getLines(): Record<string, ILine>;
  getActiveCalls(): Record<string, ICall[]>;
  getConnectedCall(): ICall | undefined;
  getDevices(userId?: string): Promise<DeviceType[]>;
}
```

### ILine

```typescript
interface ILine extends Eventing<LineEventTypes> {
  lineId: string;
  userId: string;
  phoneNumber?: string;
  extension?: string;
  registration: IRegistration;
  register(): void;
  deregister(): void;
  makeCall(dest?: CallDetails): ICall | undefined;
  getCall(correlationId: CorrelationId): ICall;
  getStatus(): RegistrationStatus;
  getDeviceId(): MobiusDeviceId | undefined;
  getActiveMobiusUrl(): string;
}
```

### ICallHistory

```typescript
interface ICallHistory extends Eventing<CallHistoryEventTypes> {
  getCallHistoryData(days: number, limit: number, sort: SORT, sortBy: SORT_BY): Promise<JanusResponseEvent>;
  updateMissedCalls(endTimeSessionIds: EndTimeSessionId[]): Promise<UpdateMissedCallsResponse>;
  deleteCallHistoryRecords(deleteSessionIds: EndTimeSessionId[]): Promise<DeleteCallHistoryRecordsResponse>;
}
```

### ICallSettings

```typescript
interface ICallSettings {
  getCallWaitingSetting(): Promise<CallSettingResponse>;
  getDoNotDisturbSetting(): Promise<CallSettingResponse>;
  setDoNotDisturbSetting(flag: boolean): Promise<CallSettingResponse>;
  getCallForwardSetting(): Promise<CallSettingResponse>;
  setCallForwardSetting(request: CallForwardSetting): Promise<CallSettingResponse>;
  getVoicemailSetting(): Promise<CallSettingResponse>;
  setVoicemailSetting(request: VoicemailSetting): Promise<CallSettingResponse>;
  getCallForwardAlwaysSetting(directoryNumber?: string): Promise<CallSettingResponse>;
}
```

### IContacts

```typescript
interface IContacts {
  getContacts(): Promise<ContactResponse>;
  createContactGroup(displayName: string, encryptionKeyUrl?: string, groupType?: GroupType): Promise<ContactResponse>;
  deleteContactGroup(groupId: string): Promise<ContactResponse>;
  createContact(contactInfo: Contact): Promise<ContactResponse>;
  deleteContact(contactId: string): Promise<ContactResponse>;
}
```

### IVoicemail

```typescript
interface IVoicemail {
  init(): VoicemailResponseEvent | Promise<VoicemailResponseEvent>;
  getVoicemailList(offset: number, offsetLimit: number, sort: SORT, refresh?: boolean): Promise<VoicemailResponseEvent>;
  getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent>;
  getVoicemailSummary(): Promise<VoicemailResponseEvent | null>;
  voicemailMarkAsRead(messageId: string): Promise<VoicemailResponseEvent>;
  voicemailMarkAsUnread(messageId: string): Promise<VoicemailResponseEvent>;
  deleteVoicemail(messageId: string): Promise<VoicemailResponseEvent>;
  getVMTranscript(messageId: string): Promise<VoicemailResponseEvent | null>;
  resolveContact(callingPartyInfo: CallingPartyInfo): Promise<DisplayInformation | null>;
}
```

### ISDKConnector

```typescript
interface ISDKConnector {
  setWebex(webex: WebexSDK): void;
  getWebex(): WebexSDK;
  registerListener(listener: Function, scope: string, callback: Function): void;
  unregisterListener(listener: Function, scope: string): void;
}
```
