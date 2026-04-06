# Calling Sub-Module - Agent Specification

## Overview

The `calling/` sub-module within `CallingClient` contains the core call management logic for the Webex Calling SDK. It consists of two primary classes -- `Call` and `CallManager` -- along with the `CallerId` sub-module for caller identity resolution. Together, these classes handle the full lifecycle of voice calls: creation, signaling via Mobius, WebRTC media negotiation via ROAP, mid-call operations, and termination.

## Key Capabilities

### 1. Call Lifecycle Orchestration
- Creates and manages outbound and inbound call instances with stable `correlationId` mapping.
- Drives call progression from setup to established, held/resumed, transfer, and disconnect states.
- Cleans up call resources and collection state when calls terminate.

### 2. Mobius Event Intake and Routing
- Subscribes to `event:mobius` via `SDKConnector` and processes signaling/media events.
- Routes each event to the correct `Call` object based on `correlationId` and `callId` matching.
- Handles out-of-order event scenarios (for example, media before setup) safely.

### 3. Signaling and Media State Machine Coordination
- Maintains call signaling and ROAP media state machines per call.
- Coordinates HTTP signaling operations with asynchronous WebSocket-driven transitions.
- Preserves deterministic behavior through explicit event-driven transitions.

### 4. Mid-Call Operations and Supplementary Services
- Supports hold/resume, transfer, mute, DTMF, and media updates during active calls.
- Enforces supplementary-service timeout behavior and emits typed error events on failure.
- Tracks connected/held/muted state transitions for accurate client behavior.

### 5. Caller Identity Resolution
- Resolves caller display details from SIP headers (`p-asserted-identity`, `from`) and Broadworks metadata.
- Performs SCIM-backed resolution where applicable and emits caller ID updates through typed events.

### 6. Typed Events, Errors, and Metrics
- Emits strongly typed lifecycle and error events through shared event enums/type maps.
- Uses call-scoped typed errors (`CallError`) with correlation and layer context.
- Submits call and media metrics for both success and failure paths.

---

## Files

| File | Class | Interface | Description |
|------|-------|-----------|-------------|
| `call.ts` | `Call` | `ICall` | Individual call instance managing signaling and media state machines |
| `callManager.ts` | `CallManager` | `ICallManager` | Singleton managing the collection of active calls and routing Mobius WebSocket events |
| `types.ts` | - | - | All types, enums, and interfaces for call management |
| `CallerId/index.ts` | `CallerId` | `ICallerId` | Caller identity resolution from SIP headers and SCIM |
| `CallerId/types.ts` | - | - | CallerId types |

### Import Paths

All paths are relative to `CallingClient/calling/` (the directory containing `call.ts` and `callManager.ts`).

| Symbol(s) | Import Path |
|-----------|-------------|
| `ICall`, `ICallManager`, `MobiusEventType`, `MediaState`, `MobiusCallEvent`, `MobiusCallData`, `MobiusCallResponse`, `PatchResponse`, `SSResponse`, `TransferContext`, `CallRtpStats`, `DisconnectCode`, `DisconnectCause`, `TransferType`, `MUTE_TYPE`, `MidCallEventType`, `MobiusCallState`, `MidCallEvent` | `./types` |
| `CALL_EVENT_KEYS`, `CallerIdInfo`, `CallEvent`, `CallEventTypes`, `RoapEvent`, `RoapMessage`, `SUPPLEMENTARY_SERVICES`, `LINE_EVENT_KEYS`, `CALLING_CLIENT_EVENT_KEYS`, `MEDIA_CONNECTION_EVENT_KEYS`, `MOBIUS_MIDCALL_STATE` | `../../Events/types` |
| `Eventing` | `../../Events/impl` |
| `CallError`, `createCallError` | `../../Errors/catalog/CallError` |
| `ERROR_LAYER`, `ERROR_TYPE`, `ErrorContext` | `../../Errors/types` |
| `handleCallErrors`, `modifySdpForIPv4`, `parseMediaQualityStatistics`, `serviceErrorCodeHandler`, `uploadLogs` | `../../common/Utils` |
| `CallDetails`, `CallDirection`, `CallId`, `CorrelationId`, `DisplayInformation`, `HTTP_METHODS`, `ServiceIndicator`, `WebexRequestPayload`, `ALLOWED_SERVICES` | `../../common/types` |
| `SDKConnector` | `../../SDKConnector` |
| `ISDKConnector`, `WebexSDK` | `../../SDKConnector/types` |
| `ILine` | `../line/types` |
| Constants (`DEFAULT_SESSION_TIMER`, `SUPPLEMENTARY_SERVICES_TIMEOUT`, `MAX_CALL_KEEPALIVE_RETRY_COUNT`, `INITIAL_SEQ_NUMBER`, endpoint resources, `METHODS`) | `../constants` |
| `RoapMediaConnection`, `LocalMicrophoneStream`, `MediaConnectionEventNames`, `LocalStreamEventNames` | `@webex/internal-media-core` |
| `RtcMetrics` | `@webex/internal-plugin-metrics` |
| `EffectEvent`, `TrackEffect` | `@webex/media-helpers` |
| `createMachine`, `interpret` | `xstate` |

---

## CallManager

### Purpose

`CallManager` is a **singleton** that serves as the central hub for all call-related operations. It:
- Maintains the collection of active `Call` objects keyed by `correlationId`
- Listens for Mobius WebSocket events (`event:mobius`) via the `SDKConnector`
- Routes incoming Mobius events to the correct `Call` instance
- Creates new `Call` objects for incoming calls
- Emits `ALL_CALLS_CLEARED` when the last call is removed from the collection
- Emits `INCOMING_CALL` to signal the Line about new incoming calls

### Singleton Pattern

```typescript
let callManager: ICallManager;

export const getCallManager = (webex: WebexSDK, indicator: ServiceIndicator): ICallManager => {
  if (!callManager) {
    callManager = new CallManager(webex, indicator);
  }
  return callManager;
};
```

### ICallManager Interface

`ICallManager` is the contract for the `CallManager` class. It defines the core methods `CallManager` must expose for call creation, lookup, lifecycle tracking, and line/Mobius context updates.  
In practice, this interface ensures a consistent API surface between the singleton accessor (`getCallManager`) and the concrete `CallManager` implementation.

```typescript
interface ICallManager extends Eventing<CallEventTypes> {
  createCall(direction: CallDirection, deviceId: string, lineId: string, destination?: CallDetails): ICall;
  getCall(correlationId: CorrelationId): ICall;
  getActiveCalls(): Record<string, ICall>;
  updateActiveMobius(url: string): void;
  updateLine(deviceId: string, line: ILine): void;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `callCollection` | `Record<CorrelationId, ICall>` | Active calls keyed by client-side correlation ID |
| `activeMobiusUrl` | `string` | Current active Mobius server URL |
| `serviceIndicator` | `ServiceIndicator` | Service type (`calling`, `contactcenter`, `guestcalling`) |
| `lineDict` | `Record<string, ILine>` | Lines keyed by device ID, for resolving `lineId` from incoming events |


### Methods

| Method | Signature | Scope | Purpose |
|--------|-----------|-------|---------|
| `constructor` | `constructor(webex: WebexSDK, indicator: ServiceIndicator)` | Public | Initializes manager state, connector references, and Mobius listener registration |
| `createCall` | `createCall(direction: CallDirection, deviceId: string, lineId: string, destination?: CallDetails): ICall` | Public | Creates a `Call` instance, stores it in `callCollection`, and wires delete callback |
| `getCall` | `getCall(correlationId: CorrelationId): ICall` | Public | Returns the active call for a correlation ID |
| `getActiveCalls` | `getActiveCalls(): Record<string, ICall>` | Public | Returns the current active call map |
| `updateActiveMobius` | `updateActiveMobius(url: string): void` | Public | Updates active Mobius URL used by newly created calls |
| `updateLine` | `updateLine(deviceId: string, line: ILine): void` | Public | Stores/updates line mapping used for incoming call routing |
| `listenForWsEvents` | `listenForWsEvents(): void` | Private | Registers `event:mobius` listener and forwards inbound payloads for processing |
| `dequeueWsEvents` | `dequeueWsEvents(eventData: MobiusCallEvent): void` | Private | Routes Mobius call/media/disconnect events to the correct `Call` instance |
| `getLineId` | `getLineId(deviceId: string): string` | Private | Resolves line ID from `lineDict` for inbound call creation/routing |

### Mobius Event Routing

The `CallManager` registers a listener for `event:mobius` on the `SDKConnector`. When a Mobius event arrives, `dequeueWsEvents()` processes it based on `eventType`:

| Mobius Event Type | Enum Value | Action |
|-------------------|------------|--------|
| `CALL_SETUP` | `mobius.call` | Create incoming call or handle mid-call event, resolve caller ID, emit `INCOMING_CALL`, send `E_RECV_CALL_SETUP` |
| `CALL_PROGRESS` | `mobius.callprogress` | Resolve caller ID, send `E_RECV_CALL_PROGRESS` to call |
| `CALL_CONNECTED` | `mobius.callconnected` | Send `E_RECV_CALL_CONNECT` to call |
| `CALL_MEDIA` | `mobius.media` | Route ROAP message (`OFFER`, `ANSWER`, `OFFER_REQUEST`, `OK`, `ERROR`) to call's media state machine |
| `CALL_DISCONNECTED` | `mobius.calldisconnected` | Send `E_RECV_CALL_DISCONNECT` to call |

### Call Creation Logic (Incoming)

When a `CALL_SETUP` event arrives, the CallManager:
1. Checks if the event contains `midCallService` data -- if so, routes to existing call's `handleMidCallEvent()`
2. Searches `callCollection` for a call matching the `callId` (handles case where `CALL_MEDIA` arrived before `CALL_SETUP`)
3. If no match found, creates a new `INBOUND` call via `createCall()`
4. Sets the Mobius `callId` and optional `broadworksCorrelationInfo` on the call
5. Starts caller ID resolution
6. Emits `LINE_EVENT_KEYS.INCOMING_CALL` with the call object
7. Sends `E_RECV_CALL_SETUP` to the call's state machine

### Call Deletion and Cleanup

When a call is created, a `deleteCb` callback is passed that:
1. Removes the call from `callCollection`
2. If `callCollection` becomes empty, emits `CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED`

This `ALL_CALLS_CLEARED` event is consumed by `CallingClient` to trigger deferred re-registration when connectivity was lost during an active call.

---

## Call

### Purpose

The `Call` class represents a single voice call instance. It manages:
- Two XState state machines: **call signaling** and **media (ROAP) negotiation**
- WebRTC media connection via `RoapMediaConnection` from `@webex/internal-media-core`
- Mobius API calls for call setup, progress, hold/resume, transfer, and disconnect
- Caller ID resolution via the `CallerId` sub-module
- RTP statistics collection
- Supplementary services (hold, resume, transfer)
- Event emission for application-facing call lifecycle events

### Factory Function

```typescript
export const createCall = (
  activeUrl: string,
  webex: WebexSDK,
  direction: CallDirection,
  deviceId: string,
  lineId: string,
  deleteCb: DeleteRecordCallBack,
  indicator: ServiceIndicator,
  destination?: CallDetails
): ICall => new Call(activeUrl, webex, direction, deviceId, lineId, deleteCb, indicator, destination);
```

### ICall Interface

`ICall` is the contract for the `Call` class. It defines the methods a call object must expose for call control operations, state checks, media updates, event handling hooks, and call metadata access.

```typescript
// Contract implemented by Call class.
// Eventing<CallEventTypes> means consumers can subscribe to strongly typed call events.
interface ICall extends Eventing<CallEventTypes> {
  // Call control operations
  dial(localAudioStream: LocalMicrophoneStream): void;
  answer(localAudioStream: LocalMicrophoneStream): void;
  end(): void;
  doHoldResume(): void;
  completeTransfer(
    transferType: TransferType,
    transferCallId?: CallId,
    transferTarget?: string
  ): void;
  sendDigit(tone: string): void;

  // Media operations
  mute(localAudioStream: LocalMicrophoneStream, muteType?: MUTE_TYPE): void;
  updateMedia(newAudioStream: LocalMicrophoneStream): void;
  getCallRtpStats(): Promise<CallRtpStats>;

  // State checks
  isMuted(): boolean;
  isConnected(): boolean;
  isHeld(): boolean;

  // Identifiers and call metadata
  getCallId(): string;
  setCallId(callId: CallId): void;
  getCorrelationId(): string;
  getDirection(): CallDirection;
  getDisconnectReason(): DisconnectReason;
  getBroadworksCorrelationInfo(): string | undefined;
  setBroadworksCorrelationInfo(info: string): void;

  // Caller identity
  getCallerInfo(): DisplayInformation;
  startCallerIdResolution(callerInfo: CallerIdInfo): void;

  // Internal event pathways exposed on the interface
  handleMidCallEvent(event: MidCallEvent): void;
  sendCallStateMachineEvt(event: CallEvent): void;
  sendMediaStateMachineEvt(event: RoapEvent): void;
  postStatus(): Promise<WebexRequestPayload>;
}
```

### Properties

| Property | Type | Visibility | Description |
|----------|------|-----------|-------------|
| `direction` | `CallDirection` | private | `INBOUND` or `OUTBOUND` |
| `callId` | `CallId` | private | Server-assigned Mobius call ID (initially `DefaultLocalId_{uuid}`) |
| `correlationId` | `CorrelationId` | private | Client-generated UUID for this call |
| `deviceId` | `string` | private | Mobius device ID |
| `lineId` | `string` | public | Associated line ID |
| `destination` | `CallDetails` | private | Target address for outgoing calls |
| `connected` | `boolean` | private | Whether call is in connected/established state |
| `held` | `boolean` | private | Whether call is currently on hold |
| `muted` | `boolean` | private | Whether local audio is muted |
| `earlyMedia` | `boolean` | private | Whether early media (inband ROAP) was detected |
| `mediaInactivity` | `boolean` | private | Whether media inactivity was detected |
| `mediaNegotiationCompleted` | `boolean` | private | Whether ROAP negotiation finished |
| `mediaConnection` | `RoapMediaConnection` | public | WebRTC media connection instance |
| `localAudioStream` | `LocalMicrophoneStream` | private | Local microphone stream |
| `mobiusUrl` | `string` | private | Active Mobius server URL for this call |
| `callStateMachine` | XState interpreter | private | Call signaling state machine |
| `mediaStateMachine` | XState interpreter | private | ROAP media state machine |
| `seq` | `number` | private | ROAP sequence number (starts at 1) |
| `localRoapMessage` | `RoapMessage` | private | Last local ROAP message |
| `remoteRoapMessage` | `RoapMessage \| null` | private | Last remote ROAP message (buffered) |
| `disconnectReason` | `DisconnectReason` | private | Reason for disconnect (code + cause) |
| `callerInfo` | `DisplayInformation` | private | Resolved caller display info |
| `callerId` | `ICallerId` | private | CallerId resolver instance |
| `sessionTimer` | `NodeJS.Timeout` | private | 10-minute session inactivity timer |
| `supplementaryServicesTimer` | `NodeJS.Timeout` | private | 10-second timeout for hold/resume responses |
| `broadworksCorrelationInfo` | `string` | private | Broadworks correlation ID (used for WxCC) |
| `serviceIndicator` | `ServiceIndicator` | private | Service type (`calling`, `contactcenter`, `guestcalling`) |
| `metricManager` | `IMetricManager` | private | Metrics submission |
| `rtcMetrics` | `RtcMetrics` | private | WebRTC metrics from `@webex/internal-plugin-metrics` |
| `receivedRoapOKSeq` | `number` | private | Tracks the sequence number of the last received ROAP OK |
| `callKeepaliveRetryCount` | `number` | private | Keepalive retry counter (max 4) |


### Method

| Method | Signature | Description |
|--------|-----------|-------------|
| `dial` | `dial(localAudioStream: LocalMicrophoneStream): void` | Initiate an outgoing call |
| `answer` | `answer(localAudioStream: LocalMicrophoneStream): void` | Answer an incoming call |
| `end` | `end(): void` | Disconnect the call |
| `mute` | `mute(localAudioStream: LocalMicrophoneStream, muteType?: MUTE_TYPE): void` | Toggle mute |
| `isMuted` | `isMuted(): boolean` | Check mute state |
| `isConnected` | `isConnected(): boolean` | Check connected state |
| `isHeld` | `isHeld(): boolean` | Check hold state |
| `doHoldResume` | `doHoldResume(): void` | Toggle hold/resume |
| `sendDigit` | `sendDigit(tone: string): void` | Send DTMF tone |
| `completeTransfer` | `completeTransfer(transferType: TransferType, transferCallId?: CallId, transferTarget?: string): void` | Complete blind or consult transfer |
| `updateMedia` | `updateMedia(newAudioStream: LocalMicrophoneStream): void` | Change audio stream |
| `getCallId` | `getCallId(): string` | Get Mobius call ID |
| `getCorrelationId` | `getCorrelationId(): string` | Get client correlation ID |
| `getDirection` | `getDirection(): CallDirection` | Get call direction |
| `setCallId` | `setCallId(callId: CallId): void` | Set Mobius call ID |
| `getCallerInfo` | `getCallerInfo(): DisplayInformation` | Get resolved caller display info |
| `startCallerIdResolution` | `startCallerIdResolution(callerInfo: CallerIdInfo): void` | Trigger caller ID resolution |
| `handleMidCallEvent` | `handleMidCallEvent(event: MidCallEvent): void` | Process mid-call events |
| `getDisconnectReason` | `getDisconnectReason(): DisconnectReason` | Get disconnect reason |
| `getBroadworksCorrelationInfo` | `getBroadworksCorrelationInfo(): string \| undefined` | Get Broadworks correlation info |
| `setBroadworksCorrelationInfo` | `setBroadworksCorrelationInfo(info: string): void` | Set Broadworks correlation info |
| `getCallRtpStats` | `getCallRtpStats(): Promise<CallRtpStats>` | Get RTP statistics |
| `postStatus` | `postStatus(): Promise<WebexRequestPayload>` | Send call keepalive to Mobius |
| `sendCallStateMachineEvt` | `sendCallStateMachineEvt(event: CallEvent): void` | Send event to call state machine |
| `sendMediaStateMachineEvt` | `sendMediaStateMachineEvt(event: RoapEvent): void` | Send event to media state machine |
| `postSSRequest` | `postSSRequest(context: unknown, type: SUPPLEMENTARY_SERVICES): Promise<SSResponse>` | Send supplementary service request (hold, resume, transfer) to Mobius |

### Private Methods

These are internal methods on the `Call` class. They are not exposed via `ICall` but are essential for understanding call internals when implementing new features or modifying existing flows.

#### Media Infrastructure

| Method | Signature | Description |
|--------|-----------|-------------|
| `initMediaConnection` | `private initMediaConnection(localAudioTrack: MediaStreamTrack, debugId?: string): void` | Creates `RoapMediaConnection` with local audio track, registers ROAP and track listeners |
| `mediaRoapEventsListener` | `private mediaRoapEventsListener(): void` | Listens for `ROAP_MESSAGE_TO_SEND` from media SDK, stores local ROAP message and drives media state machine |
| `mediaTrackListener` | `private mediaTrackListener(): void` | Listens for `REMOTE_TRACK_ADDED` and emits `CALL_EVENT_KEYS.REMOTE_MEDIA` |
| `registerListeners` | `private registerListeners(localAudioStream: LocalMicrophoneStream): void` | Registers effect and track change listeners on local audio stream |
| `unregisterListeners` | `private unregisterListeners(): void` | Removes all event listeners from local audio stream and effects |
| `registerEffectListener` | `private registerEffectListener(addedEffect: TrackEffect): void` | Registers enabled/disabled listeners for a specific audio effect (e.g., BNR) |
| `updateTrack` | `private updateTrack = (audioTrack: MediaStreamTrack): void` | Updates local audio track in media connection |

#### HTTP Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `post` | `private post = async (roapMessage: RoapMessage): Promise<MobiusCallResponse>` | POST `/devices/{deviceId}/call` -- outgoing call setup with ROAP offer |
| `patch` | `private async patch(state: MobiusCallState): Promise<PatchResponse>` | PATCH `/devices/{deviceId}/calls/{callId}` -- update call state (alerting, connected) |
| `delete` | `private async delete(): Promise<MobiusCallResponse>` | DELETE `/devices/{deviceId}/calls/{callId}` -- disconnect call with metrics and reason |
| `postMedia` | `private async postMedia(roapMessage: RoapMessage): Promise<WebexRequestPayload>` | POST `/devices/{deviceId}/calls/{callId}/media` -- send ROAP message, applies `modifySdpForIPv4()` for SDP payloads |

#### State Machine Action Handlers

| Method | Signature | Description |
|--------|-----------|-------------|
| `handleIncomingCallSetup` | `private handleIncomingCallSetup(event: CallEvent): void` | Sends `E_SEND_CALL_ALERTING` to begin alerting flow |
| `handleOutgoingCallSetup` | `private async handleOutgoingCallSetup(event: CallEvent): void` | POSTs to `/call` endpoint, sets server-assigned `callId` |
| `handleIncomingCallProgress` | `private handleIncomingCallProgress(event: CallEvent): void` | Processes inband media flag, emits `PROGRESS` |
| `handleOutgoingCallAlerting` | `private async handleOutgoingCallAlerting(event: CallEvent): void` | PATCHes call state to `sig_alerting` |
| `handleIncomingCallConnect` | `private handleIncomingCallConnect(event: CallEvent): void` | Emits `CONNECT` event |
| `handleOutgoingCallConnect` | `private async handleOutgoingCallConnect(event: CallEvent): void` | Processes buffered ROAP offer, PATCHes to `sig_connected` |
| `handleCallEstablished` | `private handleCallEstablished(event: CallEvent): void` | Emits `ESTABLISHED`, starts `sessionTimer` for keepalive |
| `handleCallHold` | `private async handleCallHold(event: CallEvent): void` | POSTs to `/callhold/hold`, starts `supplementaryServicesTimer` |
| `handleCallResume` | `private async handleCallResume(event: CallEvent): void` | POSTs to `/callhold/resume`, starts `supplementaryServicesTimer` |
| `handleIncomingCallDisconnect` | `private async handleIncomingCallDisconnect(event: CallEvent): void` | Sets disconnect reason, cleans up resources, emits `DISCONNECT` |
| `handleOutgoingCallDisconnect` | `private async handleOutgoingCallDisconnect(event: CallEvent): void` | DELETEs call, cleans up resources, emits `DISCONNECT` |
| `handleUnknownState` | `private async handleUnknownState(event: CallEvent): void` | Handles unexpected state, cleans up and deletes call |
| `handleTimeout` | `private async handleTimeout(): void` | Handles state timeout, emits error and cleans up |

#### ROAP Action Handlers

| Method | Signature | Description |
|--------|-----------|-------------|
| `handleOutgoingRoapOffer` | `private async handleOutgoingRoapOffer(context: MediaContext, event: RoapEvent): void` | Calls `mediaConnection.initiateOffer()` or sends ROAP offer via `postMedia()` |
| `handleOutgoingRoapAnswer` | `private async handleOutgoingRoapAnswer(context: MediaContext, event: RoapEvent): void` | Sends SDP answer via `postMedia()` |
| `handleIncomingRoapOffer` | `private handleIncomingRoapOffer(context: MediaContext, event: RoapEvent): void` | Buffers or forwards OFFER to `mediaConnection.roapMessageReceived()` |
| `handleIncomingRoapAnswer` | `private handleIncomingRoapAnswer(context: MediaContext, event: RoapEvent): void` | Forwards ANSWER to `mediaConnection.roapMessageReceived()` |
| `handleIncomingRoapOfferRequest` | `private handleIncomingRoapOfferRequest(context: MediaContext, event: RoapEvent): void` | Buffers or forwards offer request to media connection |
| `handleRoapEstablished` | `private async handleRoapEstablished(context: MediaContext, event: RoapEvent): void` | Sends ROAP OK, sets `mediaNegotiationCompleted`, triggers `E_CALL_ESTABLISHED` |
| `handleRoapError` | `private async handleRoapError(context: MediaContext, event: RoapEvent): void` | POSTs error to `/media`, disconnects if not connected |

#### Metrics and Utilities

| Method | Signature | Description |
|--------|-----------|-------------|
| `getCallStats` | `private async getCallStats(): Promise<CallRtpStats>` | Retrieves RTP statistics from media connection |
| `forceSendStatsReport` | `private async forceSendStatsReport({callFrom}: {callFrom?: string}): Promise<void>` | Sends WebRTC telemetry dump via media core metrics |
| `submitCallErrorMetric` | `private submitCallErrorMetric(error: CallError, transferMetricAction?: TRANSFER_ACTION): void` | Submits error metrics based on error layer and current state |
| `onEffectEnabled` | `private onEffectEnabled = (): void` | Submits BNR enabled metric |
| `onEffectDisabled` | `private onEffectDisabled = (): void` | Submits BNR disabled metric |
| `setDisconnectReason` | `private setDisconnectReason(): void` | Sets disconnect code/cause based on call state (mediaInactivity, connected, direction) |
| `getEmitterCallback` | `private getEmitterCallback(errData: MobiusCallResponse): (error: CallError) => void` | Returns error emitter callback that emits the correct error event based on current state machine state |

#### Keepalive

| Method | Signature | Description |
|--------|-----------|-------------|
| `scheduleCallKeepaliveInterval` | `private scheduleCallKeepaliveInterval = (): void` | Schedules periodic `postStatus()` call to Mobius |
| `callKeepaliveRetryCallback` | `private callKeepaliveRetryCallback = (interval: number): void` | Retries keepalive POST after error with given interval |
| `handleCallKeepaliveError` | `private handleCallKeepaliveError = async (err: unknown): Promise<void>` | Handles keepalive errors, increments retry count, force-disconnects after max retries |

### Call Events Emitted

| Event | Enum Key | Payload | When Emitted |
|-------|----------|---------|-------------|
| `progress` | `CALL_EVENT_KEYS.PROGRESS` | `CorrelationId` | Call progress received |
| `connect` | `CALL_EVENT_KEYS.CONNECT` | `CorrelationId` | Remote answered or call connected |
| `established` | `CALL_EVENT_KEYS.ESTABLISHED` | `CorrelationId` | Call fully established with media |
| `held` | `CALL_EVENT_KEYS.HELD` | `CorrelationId` | Call placed on hold |
| `resumed` | `CALL_EVENT_KEYS.RESUMED` | `CorrelationId` | Call resumed from hold |
| `disconnect` | `CALL_EVENT_KEYS.DISCONNECT` | `CorrelationId` | Call disconnected |
| `remote_media` | `CALL_EVENT_KEYS.REMOTE_MEDIA` | `MediaStreamTrack` | Remote media track available |
| `caller_id` | `CALL_EVENT_KEYS.CALLER_ID` | `{ correlationId: CorrelationId, callerId: DisplayInformation }` | Caller ID resolved |
| `call_error` | `CALL_EVENT_KEYS.CALL_ERROR` | `CallError` | Error in call signaling |
| `hold_error` | `CALL_EVENT_KEYS.HOLD_ERROR` | `CallError` | Error placing call on hold |
| `resume_error` | `CALL_EVENT_KEYS.RESUME_ERROR` | `CallError` | Error resuming call |
| `transfer_error` | `CALL_EVENT_KEYS.TRANSFER_ERROR` | `CallError` | Error in call transfer |

---

## CallerId

### Purpose

The `CallerId` sub-module resolves caller identity from SIP headers present in Mobius call events.

### Resolution Priority

1. **P-Asserted-Identity** (`p-asserted-identity`) -- Highest priority, parsed as SIP URI
2. **From header** (`from`) -- Secondary, parsed as SIP URI
3. **x-broadworks-remote-party-info** -- Async resolution for external caller ID via SCIM query

### Resolution Flow

```
CallerIdInfo received
│
├── Has p-asserted-identity? ──→ parseSipUri() ──→ DisplayInformation
│
├── Has from header? ──→ parseSipUri() ──→ DisplayInformation
│
└── Has x-broadworks-remote-party-info? ──→ parseRemotePartyInfo() ──→ resolveCallerId()
                                                                            │
                                                                     SCIM query to Webex
                                                                            │
                                                                     DisplayInformation
                                                                            │
                                                                     emit CALLER_ID event
```

### DisplayInformation Type

```typescript
type DisplayInformation = {
  avatarSrc: AvatarId | undefined;
  name: DisplayName | undefined;
  num: string | undefined;
  id: string | undefined;
};
```

---

## Mid-Call Events

The `Call` class handles mid-call events delivered through `CALL_SETUP` messages with `midCallService` data.

### Mid-Call Event Types

| Type | Enum | Description |
|------|------|-------------|
| `callInfo` | `MidCallEventType.CALL_INFO` | Caller ID update during an active call |
| `callState` | `MidCallEventType.CALL_STATE` | Call state change (hold/resume confirmation from server) |

### Mid-Call State Values

| State | Enum | Description |
|-------|------|-------------|
| `HELD` | `MOBIUS_MIDCALL_STATE.HELD` | Call confirmed as held by server |
| `CONNECTED` | `MOBIUS_MIDCALL_STATE.CONNECTED` | Call confirmed as resumed/connected by server |

When a `callState` mid-call event with `HELD` state is received, the Call emits `CALL_EVENT_KEYS.HELD` and sets `held = true`. When `CONNECTED` is received, it emits `CALL_EVENT_KEYS.RESUMED` and sets `held = false`. Both clear the `supplementaryServicesTimer`.

---

## Supplementary Services

### SUPPLEMENTARY_SERVICES Enum

```typescript
// From ../../Events/types
enum SUPPLEMENTARY_SERVICES {
  HOLD = 'hold',
  RESUME = 'resume',
  DIVERT = 'divert',
  TRANSFER = 'transfer',
  PARK = 'park',
}
```

This enum is used by `postSSRequest(context, type)` to determine which Mobius endpoint to call for supplementary service operations.

### Hold/Resume

- `doHoldResume()` checks the `held` flag and sends either `E_CALL_HOLD` or `E_CALL_RESUME` to the call state machine
- The state machine transitions to `S_CALL_HOLD` or `S_CALL_RESUME` and calls `handleCallHold()` or `handleCallResume()`
- These handlers POST to the Mobius hold/resume endpoint
- A `supplementaryServicesTimer` (10 seconds) is set to emit `HOLD_ERROR` or `RESUME_ERROR` if Mobius doesn't respond with a mid-call state event in time
- On success, a mid-call event with `HELD` or `CONNECTED` state arrives and the timer is cleared

### Transfer

Two transfer types are supported:

| Type | Enum | Required Parameters |
|------|------|-------------------|
| Blind | `TransferType.BLIND` | `transferTarget` (destination number) |
| Consult | `TransferType.CONSULT` | `transferCallId` (call ID of second call) |

Both are executed via `postSSRequest()` to the `/calltransfer/commit` endpoint.

### Mute

The `mute()` method handles two mute types:
- `MUTE_TYPE.USER` -- User-initiated mute, toggles `localAudioStream.setUserMuted()`
- `MUTE_TYPE.SYSTEM` -- System-initiated mute (e.g., noise reduction), respects user mute state
