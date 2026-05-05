# Discovery: Real-Time Transcripts using WxCC-SDK

**Feature:** Real-time transcript streaming during active calls  
**Primary Reference:** [SPIKE Discovery: Real Time Transcripts using WxCC-SDK](https://confluence-eng-gpk2.cisco.com/conf/spaces/WSDK/pages/790253498/SPIKE+Discovery+Real+Time+Transcripts+using+WxCC-SDK)  
**Status:** Draft  
**Owner:** TBD  
**Last Updated:** 2026-04-01

---

## 1) Problem Statement

Applications integrating `@webex/calling` and WxCC need typed, near real-time call transcript events to power assist workflows (agent assist, note support, analytics hooks) while a call is in progress.

Current call APIs expose call/media lifecycle events but do not define a first-class transcript contract in this package-level spec.

### In Scope

- Transcript lifecycle contract for active calls
- Event keys and payload schemas for transcript updates
- Error and reconnection behavior
- Consumer integration points for WxCC-facing services

### Out of Scope

- Post-call archive retrieval APIs
- Summarization/LLM generation
- UI rendering details

---

## 2) Goals and Non-Goals

### Goals

- Define implementation-ready API and event contracts
- Define payload validation and ordering rules
- Define retry/recovery behavior on network or backend errors
- Define testing and acceptance criteria

### Non-Goals

- Persisting transcript history in SDK storage
- New auth model beyond existing call/session auth

---

## 3) Existing System Context

### Relevant Code Areas

- `packages/calling/src/Events/types.ts`
- `packages/calling/src/CallingClient/calling/types.ts`
- `packages/calling/src/CallingClient/calling/call.ts`
- `packages/calling/src/CallingClient/calling/callManager.ts`
- `packages/@webex/plugin-cc/src/services/WebCallingService.ts`

### Existing Specs to Reuse

- `packages/calling/src/ai-docs/AGENTS.md`
- `packages/calling/src/ai-docs/ARCHITECTURE.md`

---

## 4) Proposed Behavior (End-to-End)

1. Call reaches established state.
2. Transcript stream starts (auto-start or explicit start API based on config).
3. Transcript events are emitted as partial and final chunks.
4. On recoverable failures, emit typed error and attempt resume.
5. On call end or explicit stop, emit transcript stopped event and finalize stream.

---

## 5) Public API Contract (Proposed)

### 5.1 Call-level Transcript APIs

| Module | Interface/Class | Proposed Method | Purpose |
|---|---|---|---|
| Calling | `ICall` / `Call` | `startTranscript(options?: TranscriptOptions): Promise<void>` | Start transcript stream for current call |
| Calling | `ICall` / `Call` | `stopTranscript(reason?: TranscriptStopReason): Promise<void>` | Stop transcript stream |
| Calling | `ICall` / `Call` | `getTranscriptState(): TranscriptState` | Return transcript lifecycle state |

### 5.2 Config Surface (Proposed)

```typescript
type TranscriptConfig = {
  enabled?: boolean;
  autoStartOnCallEstablished?: boolean;
  includeInterim?: boolean;
  languageCode?: string;
  diarization?: boolean;
};
```

Add under calling client config or call-level options based on code-owner decision.

---

## 6) Event Contract (Listen + Emit)

### 6.1 New Event Keys (Proposed additions in `CALL_EVENT_KEYS`)

- `TRANSCRIPT_STARTED`
- `TRANSCRIPT_PARTIAL`
- `TRANSCRIPT_FINAL`
- `TRANSCRIPT_STOPPED`
- `TRANSCRIPT_ERROR`

### 6.2 Event Payload Schemas (Proposed)

```typescript
type TranscriptBasePayload = {
  callId: string;
  correlationId: string;
  transcriptId?: string;
  sequence: number;
  timestampMs: number;
  speaker?: 'agent' | 'customer' | 'unknown';
  channel?: 'inbound' | 'outbound' | 'mixed';
};

type TranscriptPartialPayload = TranscriptBasePayload & {
  text: string;
  isFinal: false;
  confidence?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
};

type TranscriptFinalPayload = TranscriptBasePayload & {
  text: string;
  isFinal: true;
  confidence?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
};

type TranscriptErrorPayload = TranscriptBasePayload & {
  code: string;
  message: string;
  recoverable: boolean;
  retryInMs?: number;
};
```

### 6.3 Ordering Rules

- `TRANSCRIPT_STARTED` emitted once before first transcript chunk.
- `sequence` is monotonically increasing per call.
- `TRANSCRIPT_FINAL` chunks are immutable.
- `TRANSCRIPT_STOPPED` emitted at most once per active transcript session.

---

## 7) Payload Handling Rules

### Input Validation

- Ignore chunks with missing `callId` or `sequence`.
- Ignore empty text chunks unless metadata-only updates are explicitly supported.

### Normalization

- Normalize whitespace and newline patterns.
- Preserve speaker/channel metadata when available.

### Deduplication

- Drop duplicates by `(callId, sequence)` key.

---

## 8) State and Lifecycle

### Transcript State Model

`idle -> starting -> active -> stopped`

Recovery branches:

- `active -> reconnecting -> active`
- `active|starting|reconnecting -> error -> stopped` (terminal)

### Trigger Mapping

- Auto start (if enabled) on `CALL_EVENT_KEYS.ESTABLISHED`.
- Force stop on call disconnect/end.

---

## 9) Error Handling

### Categories

- Authentication/authorization
- Backend unavailable/timeouts
- Rate limiting/throttling
- Invalid transcript config

### Behavior

- Recoverable failures: emit `TRANSCRIPT_ERROR` with `recoverable = true`, schedule retry.
- Non-recoverable failures: emit `TRANSCRIPT_ERROR`, then `TRANSCRIPT_STOPPED`.

---

## 10) Logging and Metrics

### Logging

- `info`: start/stop/resume transcript
- `warn`: retry/recoverable interruption
- `error`: terminal transcript failure

Context fields: `file`, `method`, `callId`, `correlationId`, `transcriptId`.

### Metrics (Proposed)

- `TRANSCRIPT_START_ATTEMPT`
- `TRANSCRIPT_START_SUCCESS`
- `TRANSCRIPT_START_FAILURE`
- `TRANSCRIPT_PARTIAL_RECEIVED`
- `TRANSCRIPT_FINAL_RECEIVED`
- `TRANSCRIPT_RECOVERY_ATTEMPT`
- `TRANSCRIPT_STOP`

---

## 11) Backward Compatibility

- Additive change only (new APIs/events).
- Existing call flows remain unaffected when transcript feature disabled.

---

## 12) Security and Privacy

- Treat transcript text as sensitive content.
- Do not log raw transcript payload by default.
- Apply redaction rules to telemetry/log export paths.

---

## 13) Implementation Plan (File-Level)

| Step | File(s) | Change |
|---|---|---|
| 1 | `packages/calling/src/Events/types.ts` | Add transcript event keys and typed callback signatures |
| 2 | `packages/calling/src/CallingClient/calling/types.ts` | Add transcript payload and state types |
| 3 | `packages/calling/src/CallingClient/calling/call.ts` | Implement transcript lifecycle methods and emit events |
| 4 | `packages/calling/src/CallingClient/types.ts` | Add transcript config surface if needed |
| 5 | `packages/@webex/plugin-cc/src/services/WebCallingService.ts` | Consume and forward transcript events for WxCC |
| 6 | calling/plugin-cc tests | Add unit and integration tests for transcript flows |

---

## 14) Test Plan

### Unit

- Transcript start/stop API behavior
- Event order and payload shape validation
- Partial/final dedupe and update behavior
- Error and retry branch coverage

### Integration

- Call established -> transcript start
- Network disruption -> transcript recovery behavior
- Call end -> transcript stop and cleanup

### Negative

- Invalid payloads
- Missing metadata
- 401/429/5xx backend responses

---

## 15) Acceptance Criteria

- [ ] Transcript API/event contract finalized with code owners
- [ ] Typed payloads added and validated
- [ ] Recovery/error behavior implemented and tested
- [ ] WxCC consumer path integrated
- [ ] Docs updated in AGENTS/ARCHITECTURE references

---

## 16) Open Questions

1. Auto-start policy defaults for `calling` vs `contactcenter` flows?
2. Speaker attribution source and confidence handling contract?
3. Behavior across transfer/consult/conference boundaries?
4. Resume vs restart policy after reconnect?
5. Need server-acknowledged sequence checkpointing?
