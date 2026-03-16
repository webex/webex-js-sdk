# Call Management Sub-Module - Architecture Specification

## Table of Contents

- [Class Diagram](#class-diagram)
- [Call Construction and Initialization](#call-construction-and-initialization)
- [Call State Machine (XState)](#call-state-machine-xstate)
- [Media ROAP State Machine (XState)](#media-roap-state-machine-xstate)
- [CallManager Event Processing Pipeline](#callmanager-event-processing-pipeline)
- [Outgoing Call Flow (Detailed)](#outgoing-call-flow-detailed)
- [Incoming Call Flow (Detailed)](#incoming-call-flow-detailed)
- [Hold and Resume Flow](#hold-and-resume-flow)
- [Transfer Flow](#transfer-flow)
- [Media Connection Lifecycle](#media-connection-lifecycle)
- [Disconnect and Cleanup Flow](#disconnect-and-cleanup-flow)
- [API Endpoints (Call-Specific)](#api-endpoints-call-specific)
- [Types Reference](#types-reference)
- [Error Handling](#error-handling)

---

## Class Diagram

```
┌───────────────────────────────────────────────────────────┐
│                    CallManager (singleton)                 │
│                implements ICallManager                     │
│                extends Eventing<CallEventTypes>            │
│                                                           │
│  Properties:                                              │
│    callCollection: Record<CorrelationId, ICall>           │
│    activeMobiusUrl: string                                │
│    serviceIndicator: ServiceIndicator                     │
│    lineDict: Record<string, ILine>                        │
│                                                           │
│  Methods:                                                 │
│    createCall(direction, deviceId, lineId, dest?) → ICall │
│    getCall(correlationId) → ICall                         │
│    getActiveCalls() → Record<string, ICall>               │
│    updateActiveMobius(url)                                │
│    updateLine(deviceId, line)                             │
│    [private] listenForWsEvents()                          │
│    [private] dequeueWsEvents(event)                       │
│    [private] getLineId(deviceId) → string                 │
│                                                           │
│  Listens: SDKConnector('event:mobius')                    │
│  Emits:   INCOMING_CALL, ALL_CALLS_CLEARED               │
└────────────────────────┬──────────────────────────────────┘
                         │ creates & manages
                         v
┌───────────────────────────────────────────────────────────┐
│                       Call                                │
│                implements ICall                            │
│                extends Eventing<CallEventTypes>            │
│                                                           │
│  State Machines:                                          │
│    callStateMachine  (XState - call signaling)            │
│    mediaStateMachine (XState - ROAP media)                │
│                                                           │
│  Properties:                                              │
│    callId, correlationId, deviceId, lineId, direction     │
│    connected, held, muted, earlyMedia                     │
│    mediaConnection (RoapMediaConnection)                  │
│    disconnectReason, callerInfo                           │
│    seq, localRoapMessage, remoteRoapMessage               │
│    sessionTimer, supplementaryServicesTimer               │
│    callKeepaliveRetryCount                                │
│                                                           │
│  Public Methods:                                          │
│    dial(), answer(), end(), mute(), doHoldResume()        │
│    sendDigit(), completeTransfer(), updateMedia()         │
│    getCallId(), getCorrelationId(), getDirection()        │
│    getCallerInfo(), getCallRtpStats(), postStatus()       │
│    handleMidCallEvent(), startCallerIdResolution()        │
│                                                           │
│  Private Methods:                                         │
│    post(), patch(), postSSRequest(), postMedia()          │
│    initMediaConnection(), mediaRoapEventsListener()       │
│    mediaTrackListener(), registerListeners()              │
│    handleIncoming/Outgoing[CallSetup|CallProgress|...]    │
│    handleIncoming/Outgoing[RoapOffer|RoapAnswer|...]      │
│    handleCallEstablished(), handleRoapEstablished()       │
│    handleTimeout(), forceSendStatsReport()                │
│                                                           │
│  Emits: ALERTING, PROGRESS, CONNECT, ESTABLISHED,        │
│         HELD, RESUMED, DISCONNECT, REMOTE_MEDIA,          │
│         CALLER_ID, CALL_ERROR, HOLD_ERROR,                │
│         RESUME_ERROR, TRANSFER_ERROR                      │
└────────────────────────┬──────────────────────────────────┘
                         │ uses
                         v
┌───────────────────────────────────────────────────────────┐
│                     CallerId                              │
│                implements ICallerId                        │
│                                                           │
│  Methods:                                                 │
│    fetchCallerDetails(callerInfo) → DisplayInformation    │
│    [private] parseSipUri(paid) → DisplayInformation       │
│    [private] parseRemotePartyInfo(data) → async           │
│    [private] resolveCallerId(filter) → async              │
└───────────────────────────────────────────────────────────┘
```

---

## Call Construction and Initialization

When a `Call` is created (via `createCall` factory):

```
new Call(activeUrl, webex, direction, deviceId, lineId, deleteCb, indicator, destination)
│
├── Generate correlationId (uuid)
├── Generate initial callId ("DefaultLocalId_{uuid}")
├── Initialize SDKConnector, MetricManager
├── Create CallerId instance with emitter callback
├── Set defaults: connected=false, held=false, muted=false, earlyMedia=false
├── Initialize disconnectReason: {code: NORMAL(0), cause: 'Normal Disconnect.'}
├── Create RtcMetrics instance
│
├── Create Call State Machine (XState createMachine)
│   ├── id: 'call-state'
│   ├── initial: 'S_IDLE'
│   ├── 15 states with transitions and actions
│   └── interpret().onTransition(submitCallMetric).start()
│
├── Create Media State Machine (XState createMachine)
│   ├── id: 'roap-state'
│   ├── initial: 'S_ROAP_IDLE'
│   ├── 9 states with transitions and actions
│   └── interpret().onTransition(submitMediaMetric).start()
│
└── Set muted = false, seq = 1 (INITIAL_SEQ_NUMBER)
```

---

## Call State Machine (XState)

### Complete State Definition

```
Machine ID: 'call-state'
Initial State: S_IDLE

┌─────────────────────────────────────────────────────────────────────┐
│ S_IDLE                                                              │
│   E_RECV_CALL_SETUP      → S_RECV_CALL_SETUP   [incomingCallSetup] │
│   E_SEND_CALL_SETUP      → S_SEND_CALL_SETUP   [outgoingCallSetup] │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT [incomingDisc]   │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT [outgoingDisc]   │
│   E_UNKNOWN               → S_UNKNOWN           [unknownState]      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_RECV_CALL_SETUP (timeout: 10000ms → S_CALL_CLEARED)              │
│   E_SEND_CALL_ALERTING    → S_SEND_CALL_PROGRESS [outCallAlerting] │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_SEND_CALL_SETUP (timeout: 10000ms → S_CALL_CLEARED)              │
│   E_RECV_CALL_PROGRESS    → S_RECV_CALL_PROGRESS [inCallProgress]  │
│   E_RECV_CALL_CONNECT     → S_RECV_CALL_CONNECT  [inCallConnect]   │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_RECV_CALL_PROGRESS (timeout: 60000ms → S_CALL_CLEARED)           │
│   E_RECV_CALL_CONNECT     → S_RECV_CALL_CONNECT                    │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_RECV_CALL_PROGRESS    → S_RECV_CALL_PROGRESS (self-loop)       │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_SEND_CALL_PROGRESS (timeout: 60000ms → S_CALL_CLEARED)           │
│   E_SEND_CALL_CONNECT     → S_SEND_CALL_CONNECT  [outCallConnect]  │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_RECV_CALL_CONNECT (timeout: 10000ms → S_CALL_CLEARED)            │
│   E_CALL_ESTABLISHED      → S_CALL_ESTABLISHED   [callEstablished] │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_SEND_CALL_CONNECT (timeout: 10000ms → S_CALL_CLEARED)            │
│   E_CALL_ESTABLISHED      → S_CALL_ESTABLISHED   [callEstablished] │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_CALL_ESTABLISHED                                                  │
│   E_CALL_HOLD             → S_CALL_HOLD          [initiateHold]    │
│   E_CALL_RESUME           → S_CALL_RESUME        [initiateResume]  │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_CALL_ESTABLISHED      → S_CALL_ESTABLISHED   (self-loop)       │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_CALL_HOLD                                                         │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_CALL_ESTABLISHED      → S_CALL_ESTABLISHED   [callEstablished] │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ S_CALL_RESUME                                                       │
│   E_RECV_CALL_DISCONNECT  → S_RECV_CALL_DISCONNECT                  │
│   E_SEND_CALL_DISCONNECT  → S_SEND_CALL_DISCONNECT                  │
│   E_CALL_ESTABLISHED      → S_CALL_ESTABLISHED   [callEstablished] │
│   E_UNKNOWN               → S_UNKNOWN                               │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ S_RECV_CALL_DISCONNECT                          │
│   E_CALL_CLEARED → S_CALL_CLEARED              │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ S_SEND_CALL_DISCONNECT                          │
│   E_CALL_CLEARED → S_CALL_CLEARED              │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ S_UNKNOWN                                       │
│   E_CALL_CLEARED → S_CALL_CLEARED              │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ S_ERROR                                         │
│   E_CALL_CLEARED → S_CALL_CLEARED              │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ S_CALL_CLEARED (final state)                    │
└────────────────────────────────────────────────┘
```

### State Machine Action Handlers

| Action Name | Handler Method | Triggered On |
|------------|---------------|-------------|
| `incomingCallSetup` | `handleIncomingCallSetup()` | Incoming call received |
| `outgoingCallSetup` | `handleOutgoingCallSetup()` | Outgoing call initiated - POST /call to Mobius |
| `incomingCallProgress` | `handleIncomingCallProgress()` | Remote alerting/progress received |
| `outgoingCallAlerting` | `handleOutgoingCallAlerting()` | Send alerting - PATCH call state to Mobius |
| `incomingCallConnect` | `handleIncomingCallConnect()` | Remote connected, emit CONNECT |
| `outgoingCallConnect` | `handleOutgoingCallConnect()` | Answer call - process buffered ROAP, PATCH connected |
| `callEstablished` | `handleCallEstablished()` | Call fully established, emit ESTABLISHED, start session timer |
| `initiateCallHold` | `handleCallHold()` | POST to /callhold/hold |
| `initiateCallResume` | `handleCallResume()` | POST to /callhold/resume |
| `incomingCallDisconnect` | `handleIncomingCallDisconnect()` | Remote disconnect - cleanup, emit DISCONNECT |
| `outgoingCallDisconnect` | `handleOutgoingCallDisconnect()` | Local disconnect - DELETE call, cleanup |
| `unknownState` | `handleUnknownState()` | Unknown event - cleanup |
| `triggerTimeout` | `handleTimeout()` | State timeout - cleanup, emit error |

---

## Media ROAP State Machine (XState)

### Complete State Definition

```
Machine ID: 'roap-state'
Initial State: S_ROAP_IDLE

┌────────────────────────────────────────────────────────────────────┐
│ S_ROAP_IDLE                                                        │
│   E_RECV_ROAP_OFFER_REQUEST → S_RECV_ROAP_OFFER_REQUEST           │
│   E_RECV_ROAP_OFFER         → S_RECV_ROAP_OFFER                   │
│   E_SEND_ROAP_OFFER         → S_SEND_ROAP_OFFER                   │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ S_RECV_ROAP_OFFER_REQUEST                                          │
│   E_SEND_ROAP_OFFER  → S_SEND_ROAP_OFFER   [outgoingRoapOffer]   │
│   E_ROAP_OK          → S_ROAP_OK            [roapEstablished]     │
│   E_ROAP_ERROR       → S_ROAP_ERROR         [roapError]           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ S_RECV_ROAP_OFFER                                                  │
│   E_SEND_ROAP_ANSWER → S_SEND_ROAP_ANSWER  [outgoingRoapAnswer]  │
│   E_ROAP_OK          → S_ROAP_OK            [roapEstablished]     │
│   E_ROAP_ERROR       → S_ROAP_ERROR         [roapError]           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ S_SEND_ROAP_OFFER                                                  │
│   E_RECV_ROAP_ANSWER → S_RECV_ROAP_ANSWER  [incomingRoapAnswer]  │
│   E_SEND_ROAP_ANSWER → S_SEND_ROAP_ANSWER  [outgoingRoapAnswer]  │
│   E_SEND_ROAP_OFFER  → S_SEND_ROAP_OFFER   [outgoingRoapOffer]   │
│   E_ROAP_ERROR       → S_ROAP_ERROR         [roapError]           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ S_RECV_ROAP_ANSWER                                                 │
│   E_ROAP_OK    → S_ROAP_OK      [roapEstablished]                 │
│   E_ROAP_ERROR → S_ROAP_ERROR   [roapError]                       │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ S_SEND_ROAP_ANSWER                                                 │
│   E_RECV_ROAP_OFFER_REQUEST → S_RECV_ROAP_OFFER_REQUEST           │
│   E_RECV_ROAP_OFFER         → S_RECV_ROAP_OFFER                   │
│   E_ROAP_OK                 → S_ROAP_OK     [roapEstablished]     │
│   E_SEND_ROAP_ANSWER        → S_SEND_ROAP_ANSWER (self-loop)     │
│   E_ROAP_ERROR              → S_ROAP_ERROR  [roapError]           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ S_ROAP_OK (stable media state)                                     │
│   E_RECV_ROAP_OFFER_REQUEST → S_RECV_ROAP_OFFER_REQUEST           │
│   E_RECV_ROAP_OFFER         → S_RECV_ROAP_OFFER                   │
│   E_ROAP_OK                 → S_ROAP_OK     (self-loop)           │
│   E_SEND_ROAP_OFFER         → S_SEND_ROAP_OFFER (renegotiation)  │
│   E_ROAP_ERROR              → S_ROAP_ERROR                        │
│   E_ROAP_TEARDOWN           → S_ROAP_TEARDOWN                     │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ S_ROAP_ERROR                                                       │
│   E_ROAP_TEARDOWN           → S_ROAP_TEARDOWN                     │
│   E_RECV_ROAP_OFFER_REQUEST → S_RECV_ROAP_OFFER_REQUEST           │
│   E_RECV_ROAP_OFFER         → S_RECV_ROAP_OFFER                   │
│   E_RECV_ROAP_ANSWER        → S_RECV_ROAP_ANSWER                  │
│   E_ROAP_OK                 → S_ROAP_OK                           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ S_ROAP_TEARDOWN (final state)                   │
└────────────────────────────────────────────────┘
```

### ROAP Action Handlers

| Action Name | Handler Method | Description |
|------------|---------------|-------------|
| `outgoingRoapOffer` | `handleOutgoingRoapOffer()` | Generate and send SDP offer via `postMedia()` |
| `outgoingRoapAnswer` | `handleOutgoingRoapAnswer()` | Generate and send SDP answer via `postMedia()` |
| `incomingRoapOffer` | `handleIncomingRoapOffer()` | Process received SDP offer, forward to `mediaConnection.roapMessageReceived()` |
| `incomingRoapAnswer` | `handleIncomingRoapAnswer()` | Process received SDP answer, forward to `mediaConnection.roapMessageReceived()` |
| `incomingRoapOfferRequest` | `handleIncomingRoapOfferRequest()` | Handle request from server to generate a new offer |
| `roapEstablished` | `handleRoapEstablished()` | Media negotiation complete, send ROAP OK to server, set `mediaNegotiationCompleted`, transition call state to `E_CALL_ESTABLISHED` |
| `roapError` | `handleRoapError()` | Media error, emit `CALL_ERROR`, disconnect call |

---

## CallManager Event Processing Pipeline

```
Mercury WebSocket
│
│  event:mobius
│
└──► SDKConnector.registerListener('event:mobius')
     │
     └──► CallManager.dequeueWsEvents(event)
          │
          ├── Parse MobiusCallEvent: { data: { eventType, callId, correlationId, ... } }
          │
          ├── CALL_SETUP (mobius.call)
          │   ├── midCallService present?
          │   │   └── YES: call.handleMidCallEvent() for each midcall event → return
          │   ├── Find existing call by callId in callCollection
          │   ├── Not found? → createCall(INBOUND, deviceId, lineId)
          │   │                 setCallId(), setBroadworksCorrelationInfo()
          │   ├── startCallerIdResolution(callerId)
          │   ├── emit(INCOMING_CALL, call)
          │   └── call.sendCallStateMachineEvt({type: 'E_RECV_CALL_SETUP', data})
          │
          ├── CALL_PROGRESS (mobius.callprogress)
          │   ├── getCall(correlationId)
          │   ├── startCallerIdResolution(callerId)
          │   └── call.sendCallStateMachineEvt({type: 'E_RECV_CALL_PROGRESS', data})
          │
          ├── CALL_CONNECTED (mobius.callconnected)
          │   ├── getCall(correlationId)
          │   └── call.sendCallStateMachineEvt({type: 'E_RECV_CALL_CONNECT', data})
          │
          ├── CALL_MEDIA (mobius.media)
          │   ├── correlationId present?
          │   │   ├── YES: getCall(correlationId)
          │   │   └── NO: Search by callId or create new INBOUND call
          │   └── Route by message.messageType:
          │       ├── OFFER  → call.sendMediaStateMachineEvt({type: 'E_RECV_ROAP_OFFER'})
          │       ├── ANSWER → call.sendMediaStateMachineEvt({type: 'E_RECV_ROAP_ANSWER'})
          │       ├── OFFER_REQUEST → call.sendMediaStateMachineEvt({type: 'E_RECV_ROAP_OFFER_REQUEST'})
          │       ├── OK     → call.sendMediaStateMachineEvt({type: 'E_ROAP_OK'})
          │       └── ERROR  → log
          │
          └── CALL_DISCONNECTED (mobius.calldisconnected)
              ├── getCall(correlationId)
              └── call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'})
```

---

## Outgoing Call Flow (Detailed)

```
Application            Line           CallManager         Call                   Mobius
│                       │                 │                 │                      │
│ makeCall(dest)        │                 │                 │                      │
│──────────────────────►│                 │                 │                      │
│                       │ createCall(OUT) │                 │                      │
│                       │────────────────►│                 │                      │
│                       │                 │ new Call(OUT)   │                      │
│                       │                 │────────────────►│                      │
│                       │                 │                 │ callStateMachine     │
│                       │                 │                 │ starts at S_IDLE     │
│                       │                 │                 │ mediaStateMachine    │
│                       │  return call    │                 │ starts at S_ROAP_IDLE│
│◄──────────────────────│                 │                 │                      │
│                       │                 │                 │                      │
│ call.dial(stream)     │                 │                 │                      │
│─────────────────────────────────────────────────────────►│                      │
│                       │                 │                 │                      │
│                       │                 │                 │ initMediaConnection()│
│                       │                 │                 │ mediaRoapEventsListener()
│                       │                 │                 │ mediaTrackListener() │
│                       │                 │                 │                      │
│                       │                 │                 │ E_SEND_ROAP_OFFER    │
│                       │                 │                 │ → S_SEND_ROAP_OFFER  │
│                       │                 │                 │                      │
│                       │                 │                 │ handleOutgoingRoapOffer()
│                       │                 │                 │ mediaConnection      │
│                       │                 │                 │  .initiateOffer()    │
│                       │                 │                 │                      │
│                       │                 │                 │ ROAP_MESSAGE_TO_SEND │
│                       │                 │                 │ (from mediaConnection)
│                       │                 │                 │                      │
│                       │                 │                 │ E_SEND_CALL_SETUP    │
│                       │                 │                 │ → S_SEND_CALL_SETUP  │
│                       │                 │                 │                      │
│                       │                 │                 │ handleOutgoingCallSetup()
│                       │                 │                 │──── POST ────────────►│
│                       │                 │                 │ /devices/{id}/call   │
│                       │                 │                 │ {device, localMedia,  │
│                       │                 │                 │  callee}             │
│                       │                 │                 │                      │
│                       │                 │                 │◄──── 200 ────────────│
│                       │                 │                 │ {callId, callState}  │
│                       │                 │                 │ setCallId(callId)    │
│                       │                 │                 │                      │
│                       │                 │  mobius.callprogress                   │
│                       │                 │◄───────────────────────────────────────│
│                       │                 │  E_RECV_CALL_PROGRESS                  │
│                       │                 │────────────────►│                      │
│                       │                 │                 │ → S_RECV_CALL_PROGRESS
│                       │                 │                 │ emit(PROGRESS)       │
│◄──── PROGRESS ────────────────────────────────────────────│                      │
│                       │                 │                 │                      │
│                       │                 │  mobius.media (ANSWER)                 │
│                       │                 │◄───────────────────────────────────────│
│                       │                 │  E_RECV_ROAP_ANSWER                    │
│                       │                 │────────────────►│                      │
│                       │                 │                 │ → S_RECV_ROAP_ANSWER │
│                       │                 │                 │ mediaConnection      │
│                       │                 │                 │  .roapMessageReceived()
│                       │                 │                 │                      │
│                       │                 │  mobius.callconnected                  │
│                       │                 │◄───────────────────────────────────────│
│                       │                 │  E_RECV_CALL_CONNECT                   │
│                       │                 │────────────────►│                      │
│                       │                 │                 │ → S_RECV_CALL_CONNECT│
│                       │                 │                 │ emit(CONNECT)        │
│◄──── CONNECT ─────────────────────────────────────────────│                      │
│                       │                 │                 │                      │
│                       │                 │                 │ E_ROAP_OK            │
│                       │                 │                 │ → S_ROAP_OK          │
│                       │                 │                 │ handleRoapEstablished()
│                       │                 │                 │──── POST media ──────►│
│                       │                 │                 │ (ROAP OK message)    │
│                       │                 │                 │                      │
│                       │                 │                 │ E_CALL_ESTABLISHED   │
│                       │                 │                 │ → S_CALL_ESTABLISHED │
│                       │                 │                 │ emit(ESTABLISHED)    │
│◄──── ESTABLISHED ─────────────────────────────────────────│                      │
│                       │                 │                 │ start sessionTimer   │
│                       │                 │                 │ (600000ms)           │
```

---

## Incoming Call Flow (Detailed)

```
Mobius          Mercury WS      CallManager            Call                Application
│                  │                │                    │                      │
│ event:mobius     │                │                    │                      │
│ (CALL_SETUP)    │                │                    │                      │
│─────────────────►│               │                    │                      │
│                  │ dequeueWsEvents                    │                      │
│                  │───────────────►│                    │                      │
│                  │                │ createCall(INBOUND)│                      │
│                  │                │──────────────────►│                      │
│                  │                │ setCallId()        │                      │
│                  │                │ startCallerIdResolution()                 │
│                  │                │                    │                      │
│                  │                │ emit(INCOMING_CALL)│                      │
│                  │                │──────────────────────────────────────────►│
│                  │                │                    │                      │
│                  │                │ E_RECV_CALL_SETUP  │                      │
│                  │                │──────────────────►│                      │
│                  │                │                    │ → S_RECV_CALL_SETUP  │
│                  │                │                    │ handleIncomingCallSetup()
│                  │                │                    │ E_SEND_CALL_ALERTING │
│                  │                │                    │ → S_SEND_CALL_PROGRESS
│                  │                │                    │ handleOutgoingCallAlerting()
│                  │                │                    │─── PATCH (alerting) ─►│
│                  │                │                    │                      │
│                  │                │                    │  call.answer(stream)  │
│                  │                │                    │◄─────────────────────│
│                  │                │                    │                      │
│                  │                │                    │ initMediaConnection() │
│                  │                │                    │ E_SEND_CALL_CONNECT  │
│                  │                │                    │ → S_SEND_CALL_CONNECT│
│                  │                │                    │ handleOutgoingCallConnect()
│                  │                │                    │ mediaConnection      │
│                  │                │                    │  .roapMessageReceived()
│                  │                │                    │  (buffered offer)    │
│                  │                │                    │─── PATCH (connected)─►│
│                  │                │                    │                      │
│                  │                │                    │ ROAP OFFER → ANSWER  │
│                  │                │                    │◄────────────────────►│
│                  │                │                    │                      │
│                  │                │                    │ E_ROAP_OK            │
│                  │                │                    │ → S_ROAP_OK          │
│                  │                │                    │                      │
│                  │                │                    │ E_CALL_ESTABLISHED   │
│                  │                │                    │ → S_CALL_ESTABLISHED │
│                  │                │                    │ emit(ESTABLISHED)    │
│                  │                │                    │─────────────────────►│
```

---

## Hold and Resume Flow

```
Application          Call                                   Mobius
│                     │                                       │
│ doHoldResume()      │                                       │
│ (held=false)        │                                       │
│────────────────────►│                                       │
│                     │ E_CALL_HOLD                            │
│                     │ → S_CALL_HOLD                          │
│                     │ handleCallHold()                       │
│                     │──── POST /callhold/hold ──────────────►│
│                     │     {device, callId}                   │
│                     │◄──── 200 ─────────────────────────────│
│                     │                                       │
│                     │ Start supplementaryServicesTimer (10s)  │
│                     │                                       │
│                     │ [Mobius sends midcall event via CALL_SETUP]
│                     │ handleMidCallEvent({callState: HELD})  │
│                     │ held = true                            │
│                     │ clearTimeout(supplementaryServicesTimer)│
│                     │ emit(HELD, correlationId)              │
│◄──── HELD ──────────│                                       │
│                     │                                       │
│ doHoldResume()      │                                       │
│ (held=true)         │                                       │
│────────────────────►│                                       │
│                     │ E_CALL_RESUME                          │
│                     │ → S_CALL_RESUME                        │
│                     │ handleCallResume()                     │
│                     │──── POST /callhold/resume ────────────►│
│                     │     {device, callId}                   │
│                     │◄──── 200 ─────────────────────────────│
│                     │                                       │
│                     │ Start supplementaryServicesTimer (10s)  │
│                     │                                       │
│                     │ handleMidCallEvent({callState: CONNECTED})
│                     │ held = false                           │
│                     │ clearTimeout(supplementaryServicesTimer)│
│                     │ emit(RESUMED, correlationId)           │
│◄──── RESUMED ───────│                                       │
│                     │                                       │
│                     │ E_CALL_ESTABLISHED                     │
│                     │ → S_CALL_ESTABLISHED                   │
```

---

## Transfer Flow

### Blind Transfer

```
Application          Call                                   Mobius
│                     │                                       │
│ completeTransfer(   │                                       │
│   BLIND,            │                                       │
│   undefined,        │                                       │
│   '5998')           │                                       │
│────────────────────►│                                       │
│                     │ postSSRequest({                        │
│                     │   transferorCallId: this.callId,      │
│                     │   destination: '5998'                  │
│                     │ }, TRANSFER)                           │
│                     │                                       │
│                     │──── POST /calltransfer/commit ────────►│
│                     │     { device, callId,                  │
│                     │       blindTransferContext,             │
│                     │       transferType: 'BLIND' }          │
│                     │◄──── 200 ─────────────────────────────│
│                     │                                       │
│                     │ Submit BLIND transfer metric           │
│                     │                                       │
│                     │ [Mobius sends calldisconnected]        │
│                     │ E_RECV_CALL_DISCONNECT                │
│                     │ emit(DISCONNECT)                      │
│◄──── DISCONNECT ────│                                       │
```

### Consult Transfer

```
Application          Call-A               Call-B             Mobius
│                     │                     │                  │
│ completeTransfer(   │                     │                  │
│   CONSULT,          │                     │                  │
│   callB.getCallId(),│                     │                  │
│   undefined)        │                     │                  │
│────────────────────►│                     │                  │
│                     │ postSSRequest({      │                  │
│                     │   transferorCallId,  │                  │
│                     │   transferToCallId   │                  │
│                     │ }, TRANSFER)         │                  │
│                     │                     │                  │
│                     │──── POST /calltransfer/commit ─────────►│
│                     │     { device, callId,                   │
│                     │       consultTransferContext,            │
│                     │       transferType: 'CONSULT' }         │
│                     │◄──── 200 ──────────────────────────────│
```

---

## Media Connection Lifecycle

### Initialization

```
initMediaConnection(localAudioTrack, debugId?)
│
├── Create RoapMediaConnection({
│     localTracks: { audio: localAudioTrack },
│     iceServers: [],
│     skipInactiveTransceivers: false,
│     debugId: debugId || correlationId
│   })
│
├── mediaRoapEventsListener()
│   └── mediaConnection.on(ROAP_MESSAGE_TO_SEND, (event) => {
│       ├── Parse ROAP message type
│       ├── OFFER → store localRoapMessage, send E_SEND_ROAP_OFFER (or E_SEND_CALL_SETUP for initial)
│       ├── ANSWER → store localRoapMessage, send E_SEND_ROAP_ANSWER
│       └── OK → send E_ROAP_OK
│   })
│
├── mediaTrackListener()
│   └── mediaConnection.on(REMOTE_TRACK_ADDED, (event) => {
│       └── emit(CALL_EVENT_KEYS.REMOTE_MEDIA, track)
│   })
│
└── registerListeners(localAudioStream)
    ├── localAudioStream.on(EFFECT_ADDED, onEffectEnabled)
    └── localAudioStream.on(EFFECT_REMOVED, onEffectDisabled)
```

### SDP Processing

ROAP messages are sent to Mobius via `postMedia()`:

```
POST {mobiusUrl}/devices/{deviceId}/calls/{callId}/media
{
  device: { deviceId, correlationId },
  callId,
  localMedia: {
    roap: {
      seq, messageType, sdp, ...
    },
    mediaId
  }
}
```

SDP is modified for IPv4 compatibility via `modifySdpForIPv4()` before sending.

---

## Disconnect and Cleanup Flow

### Local Disconnect (`end()`)

```
call.end()
│
├── sendCallStateMachineEvt({type: 'E_SEND_CALL_DISCONNECT'})
│   → S_SEND_CALL_DISCONNECT
│   → handleOutgoingCallDisconnect()
│
├── forceSendStatsReport()     // Force send RTC metrics
├── getCallStats()             // Collect final RTP stats
│
├── DELETE {mobiusUrl}/devices/{deviceId}/calls/{callId}
│   Body: { device, callId, callStats, cause }
│
├── clearTimeout(sessionTimer)
├── mediaStateMachine.send('E_ROAP_TEARDOWN')
├── mediaConnection.close()
├── unregisterListeners()
│
├── emit(CALL_EVENT_KEYS.DISCONNECT, correlationId)
│
├── deleteCb(correlationId)     // Remove from CallManager
│
└── sendCallStateMachineEvt({type: 'E_CALL_CLEARED'})
    → S_CALL_CLEARED (final)
```

### Remote Disconnect

```
mobius.calldisconnected received
│
├── CallManager.dequeueWsEvents()
├── call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'})
│   → S_RECV_CALL_DISCONNECT
│   → handleIncomingCallDisconnect()
│
├── setDisconnectReason(causecode, cause)
├── forceSendStatsReport()
├── getCallStats()
│
├── clearTimeout(sessionTimer)
├── mediaStateMachine.send('E_ROAP_TEARDOWN')
├── mediaConnection.close()
├── unregisterListeners()
│
├── emit(CALL_EVENT_KEYS.DISCONNECT, correlationId)
│
├── deleteCb(correlationId)
│
└── sendCallStateMachineEvt({type: 'E_CALL_CLEARED'})
    → S_CALL_CLEARED (final)
```

---

## API Endpoints (Call-Specific)

All endpoints relative to `{mobiusUrl}` (which is `{mobiusHost}/api/v1/calling/web/`).

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| `POST` | `/devices/{deviceId}/call` | `post()` | Initiate outgoing call with ROAP offer |
| `PATCH` | `/devices/{deviceId}/calls/{callId}` | `patch()` | Update call state (alerting, connected) |
| `DELETE` | `/devices/{deviceId}/calls/{callId}` | `delete()` | Disconnect call with final stats |
| `POST` | `/devices/{deviceId}/calls/{callId}/media` | `postMedia()` | Send ROAP message (offer, answer, OK) |
| `POST` | `/devices/{deviceId}/calls/{callId}/status` | `postStatus()` | Call keepalive status check |
| `POST` | `/services/callhold/hold` | `postSSRequest()` | Place call on hold |
| `POST` | `/services/callhold/resume` | `postSSRequest()` | Resume call from hold |
| `POST` | `/services/calltransfer/commit` | `postSSRequest()` | Complete blind or consult transfer |

### Request Body Patterns

**POST call (outgoing setup):**
```json
{
  "device": { "deviceId": "...", "correlationId": "..." },
  "localMedia": {
    "roap": { "seq": 1, "messageType": "OFFER", "sdp": "..." },
    "mediaId": "uuid"
  },
  "callee": { "type": "uri|tel", "address": "..." }
}
```

**PATCH call (state update):**
```json
{
  "device": { "deviceId": "...", "correlationId": "..." },
  "callId": "...",
  "callState": "sig_alerting|sig_connected",
  "inbandMedia": false
}
```

**POST media (ROAP):**
```json
{
  "device": { "deviceId": "...", "correlationId": "..." },
  "callId": "...",
  "localMedia": {
    "roap": { "seq": 2, "messageType": "ANSWER", "sdp": "..." },
    "mediaId": "uuid"
  }
}
```

**POST supplementary service (hold/resume):**
```json
{
  "device": { "deviceId": "...", "correlationId": "..." },
  "callId": "..."
}
```

**POST transfer (blind):**
```json
{
  "device": { "deviceId": "...", "correlationId": "..." },
  "callId": "...",
  "blindTransferContext": {
    "transferorCallId": "...",
    "destination": "5998"
  },
  "transferType": "BLIND"
}
```

**POST transfer (consult):**
```json
{
  "device": { "deviceId": "...", "correlationId": "..." },
  "callId": "...",
  "consultTransferContext": {
    "transferorCallId": "...",
    "transferToCallId": "..."
  },
  "transferType": "CONSULT"
}
```

---

## Types Reference

### Mobius Types

```typescript
enum MobiusEventType {
  CALL_SETUP = 'mobius.call',
  CALL_PROGRESS = 'mobius.callprogress',
  CALL_CONNECTED = 'mobius.callconnected',
  CALL_MEDIA = 'mobius.media',
  CALL_DISCONNECTED = 'mobius.calldisconnected',
}

enum MediaState {
  OFFER = 'OFFER',
  ANSWER = 'ANSWER',
  OFFER_REQUEST = 'OFFER_REQUEST',
  OK = 'OK',
  ERROR = 'ERROR',
}

enum MobiusCallState {
  PROCEEDING = 'sig_proceeding',
  PROGRESS = 'sig_progress',
  ALERTING = 'sig_alerting',
  CONNECTED = 'sig_connected',
}

type MobiusCallData = {
  callProgressData?: { alerting: boolean; inbandMedia: boolean };
  message?: RoapMessage;
  callerId: { from: string };
  midCallService?: Array<MidCallEvent>;
  callId: CallId;
  callUrl: string;
  deviceId: string;
  correlationId: string;
  eventType: MobiusEventType;
  broadworksCorrelationInfo?: string;
};
```

### Call Types

```typescript
enum DisconnectCode { BUSY = 115, NORMAL = 0, MEDIA_INACTIVITY = 131 }
enum DisconnectCause { BUSY = 'User Busy.', NORMAL = 'Normal Disconnect.', MEDIA_INACTIVITY = 'Media Inactivity.' }
type DisconnectReason = { code: DisconnectCode; cause: DisconnectCause };

enum TransferType { BLIND = 'BLIND', CONSULT = 'CONSULT' }
enum MUTE_TYPE { USER = 'user_mute', SYSTEM = 'system_mute' }
enum MidCallEventType { CALL_INFO = 'callInfo', CALL_STATE = 'callState' }

type TransferContext = {
  transferorCallId: CallId;
  destination?: string;
  transferToCallId?: CallId;
};

type CallRtpStats = {
  'rtp-rxstat': ReceiveStatistics;
  'rtp-txstat': TransmitStatistics;
};
```

### Callback Types

```typescript
type DeleteRecordCallBack = (callId: CallId) => void;
type CallEmitterCallBack = (callerInfo: DisplayInformation) => void;
type CallErrorEmitterCallBack = (error: CallError) => void;
type RetryCallBack = (interval: number) => void;
```

---

## Error Handling

All call errors use the `CallError` class with `ERROR_LAYER` distinguishing call control vs media errors.

### Error Emission Pattern

```typescript
handleCallErrors(
  (error: CallError) => {
    this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
    this.submitCallErrorMetric(error);
    this.sendCallStateMachineEvt({type: 'E_UNKNOWN', data: errData});
  },
  ERROR_LAYER.CALL_CONTROL,
  retryCallback,
  this.getCorrelationId(),
  errData,
  methodName,
  fileName
);
```

### Error Scenarios

| Scenario | Error Event | Recovery |
|----------|------------|---------|
| Call setup POST fails | `CALL_ERROR` | Transition to `S_UNKNOWN`, upload logs |
| Call alerting PATCH fails | `CALL_ERROR` | Transition to `S_UNKNOWN`, upload logs |
| Hold POST fails | `HOLD_ERROR` | Transition back to `S_CALL_ESTABLISHED`, upload logs |
| Resume POST fails | `RESUME_ERROR` | Transition back to `S_CALL_ESTABLISHED`, upload logs |
| Hold/Resume timeout (10s) | `HOLD_ERROR` / `RESUME_ERROR` | Timer fires, emit timeout error |
| Transfer fails | `TRANSFER_ERROR` | Upload logs |
| ROAP error | `CALL_ERROR` (MEDIA layer) | Disconnect call |
| State timeout | `CALL_ERROR` | Transition to `S_CALL_CLEARED`, upload logs |
| No local audio track | `DISCONNECT` | Immediate disconnect or delete from collection |
| Call keepalive fails | `E_SEND_CALL_DISCONNECT` | Disconnect call (max 4 retries) |
