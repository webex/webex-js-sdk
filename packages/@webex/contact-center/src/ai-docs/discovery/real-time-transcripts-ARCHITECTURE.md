# Real-Time Transcripts — Architecture Addendum

**Feature:** Real-time transcript streaming for active calls  
**Companion Spec:** `real-time-transcripts-DISCOVERY.md`  
**Primary Reference:** [SPIKE Discovery: Real Time Transcripts using WxCC-SDK](https://confluence-eng-gpk2.cisco.com/conf/spaces/WSDK/pages/790253498/SPIKE+Discovery+Real+Time+Transcripts+using+WxCC-SDK)

---

## 1) Scope of This Addendum

This file focuses on architecture and runtime behavior only:

- event flow
- lifecycle sequencing
- error/recovery transitions
- integration boundaries (`@webex/calling` <-> WxCC consumer)

For API and payload contracts, use `real-time-transcripts-DISCOVERY.md`.

---

## 2) Component Boundaries

```mermaid
flowchart LR
    App[Application / Agent Desktop]
    WxCC[WxCC Service Layer]
    Call[Call / ICall]
    Events[Typed Eventing: CALL_EVENT_KEYS]
    Backend[Transcript Backend Stream]

    App --> WxCC
    WxCC --> Call
    Call --> Events
    Events --> WxCC
    WxCC --> App
    Call <--> Backend
```

---

## 3) Lifecycle Sequence

### 3.1 Start + Stream + Stop

```mermaid
sequenceDiagram
    participant App as Application
    participant W as WxCC Service
    participant C as Call
    participant B as Transcript Backend

    App->>W: subscribeToTranscript(callId)
    W->>C: startTranscript(options?)
    C->>B: Open transcript stream
    B-->>C: stream opened
    C-->>W: emit TRANSCRIPT_STARTED

    loop while call active
        B-->>C: interim chunk (seq=n)
        C-->>W: emit TRANSCRIPT_PARTIAL
        B-->>C: final chunk (seq=n+1)
        C-->>W: emit TRANSCRIPT_FINAL
    end

    App->>W: stopTranscript(callId) OR call disconnect
    W->>C: stopTranscript()
    C->>B: close stream
    C-->>W: emit TRANSCRIPT_STOPPED
```

### 3.2 Error and Recovery

```mermaid
sequenceDiagram
    participant W as WxCC Service
    participant C as Call
    participant B as Transcript Backend

    B--x C: transient network error
    C-->>W: emit TRANSCRIPT_ERROR (recoverable=true, retryInMs)
    C->>C: state active -> reconnecting
    C->>B: retry open stream

    alt recovery succeeds
        B-->>C: stream resumed
        C->>C: state reconnecting -> active
        C-->>W: emit TRANSCRIPT_STARTED (resumed=true)
    else recovery fails terminally
        C->>C: state reconnecting -> error
        C-->>W: emit TRANSCRIPT_ERROR (recoverable=false)
        C-->>W: emit TRANSCRIPT_STOPPED
    end
```

---

## 4) Event Flow Contract (Runtime)

```mermaid
flowchart TD
    A[CALL_EVENT_KEYS.ESTABLISHED] --> B{autoStartOnCallEstablished?}
    B -- yes --> C[startTranscript]
    B -- no --> D[Wait for explicit start]
    C --> E[emit TRANSCRIPT_STARTED]
    D --> E2[startTranscript by consumer]
    E2 --> E
    E --> F[emit TRANSCRIPT_PARTIAL / TRANSCRIPT_FINAL]
    F --> G{disconnect / explicit stop / terminal error}
    G -- stop/disconnect --> H[emit TRANSCRIPT_STOPPED]
    G -- terminal error --> I[emit TRANSCRIPT_ERROR]
    I --> H
```

---

## 5) State Model

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> starting: startTranscript()
    starting --> active: stream_opened
    active --> reconnecting: transient_error
    reconnecting --> active: resumed
    reconnecting --> error: terminal_failure
    active --> stopped: stop/disconnect
    starting --> stopped: stop/disconnect
    error --> stopped
    stopped --> [*]
```

---

## 6) Integration Notes for WxCC Consumer

- Prefer subscribing via typed SDK events instead of raw backend payload parsing.
- Treat `TRANSCRIPT_PARTIAL` as replaceable; treat `TRANSCRIPT_FINAL` as immutable.
- Use `(callId, sequence)` for dedupe and ordering.
- Preserve `recoverable` and `retryInMs` from `TRANSCRIPT_ERROR` for UX hints.

---

## 7) Edge Cases to Validate

1. Call ends while transcript stream is reconnecting.
2. Duplicate transcript sequence from backend replay.
3. Late partial arrives after final for same segment.
4. Transfer/handoff scenario where call context changes.
5. Consumer unsubscribes before stream close ack.

---

## 8) Traceability

- Public/API contract: `real-time-transcripts-DISCOVERY.md`
- Package-level architecture: `packages/calling/src/ai-docs/ARCHITECTURE.md`
- Package-level routing/spec guide: `packages/calling/src/ai-docs/AGENTS.md`
