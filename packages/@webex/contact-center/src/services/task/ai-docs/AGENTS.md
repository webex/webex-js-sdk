# Task Service - AI Agent Guide

## Purpose

Manage task lifecycle including inbound/outbound calls, hold/resume, consult, transfer, conference, and wrapup.

---

## File Structure

```
services/task/
├── Task.ts                # Task class (ITask implementation)
├── TaskManager.ts         # Singleton task manager
├── contact.ts             # Contact operations (AQM)
├── dialer.ts              # Outbound dialing (AQM)
├── AutoWrapup.ts          # Auto wrapup handler
├── TaskUtils.ts           # Helper functions
├── types.ts               # Task types and events
├── constants.ts           # Task constants
├── TaskFactory.ts         # Task factory
├── taskDataNormalizer.ts  # Task data normalization helpers
├── digital/               # Digital task implementations
│   └── Digital.ts
├── voice/                 # Voice task implementations
│   ├── Voice.ts
│   └── WebRTC.ts
├── state-machine/         # XState task lifecycle engine
│   ├── TaskStateMachine.ts
│   ├── actions.ts
│   ├── guards.ts
│   ├── uiControlsComputer.ts
│   ├── constants.ts
│   ├── types.ts
│   └── ai-docs/
│       ├── AGENTS.md
│       └── ARCHITECTURE.md
└── ai-docs/
    ├── AGENTS.md          # Usage documentation
    └── ARCHITECTURE.md    # Task service architecture
```

## Source of Truth

- Task creation: `TaskFactory.ts`
- Task APIs and behavior: `Task.ts`, `voice/Voice.ts`, `voice/WebRTC.ts`, `digital/Digital.ts`
- Task management: `TaskManager.ts`
- Shared task types: `types.ts`, `constants.ts`
- Task lifecycle state machine: `state-machine/TaskStateMachine.ts`
- State machine types/events: `state-machine/constants.ts`, `state-machine/types.ts`

## Public Types and Constants

- `TASK_EVENTS` enum (`types.ts`)
- `TaskData`, `TaskId`, `TaskResponse`, `TaskUIControls` (`types.ts`)
- `ITask`, `IVoice`, `IWebRTC`, `IDigital` (`types.ts`)
- `MEDIA_CHANNEL`, `TASK_CHANNEL_TYPE`, `VOICE_VARIANT` (`types.ts`)
- State machine: `TaskState`, `TaskEvent` (`state-machine/constants.ts`)

## Key Capabilities

- **Task Creation by Channel**: `TaskFactory.ts` chooses `WebRTC`, `Voice`, or `Digital` based on `MEDIA_CHANNEL` and `webCallingService.loginOption`, so each task class exposes the correct capabilities for the media type.
- **Task Orchestration**: `TaskManager.ts` owns task lifecycle wiring—initializes listeners, receives task events, creates/updates tasks, emits SDK events, and exposes task collections for consumers.
- **Event Emission and Public APIs**: Task objects register listeners, update context, emit SDK events (e.g., `task:*`), and expose public methods that delegate to `contact.ts` for call control and to the state machine for transition validation.
- **AQM Contact Operations**: `contact.ts` builds the AQM request surface for call control (accept, hold, consult, transfer, wrapup, end) and is the primary bridge from `Task`/`Voice`/`WebRTC`/`Digital` methods to WCC task APIs.
- **Outbound Dialing**: `dialer.ts` exposes the AQM dialer request (`startOutdial`) used by `cc.startOutdial()` to create outbound voice tasks with success/failure event mapping.
- **State Machine Driven UI Controls**: The `state-machine/` folder provides the XState engine (`TaskStateMachine.ts`) plus `actions.ts`, `guards.ts`, `uiControlsComputer.ts`, `constants.ts`, and `types.ts` to compute valid transitions and UI control state. Capability-level details live in `state-machine/ai-docs/AGENTS.md`.

---

## Task Layer Overview

This section describes how the task layer constructs tasks, initializes the state machine, and wires AQM calls to task methods. It provides context for how the state machine fits into the end-to-end flow.

### Task Class Hierarchy

- **Hierarchy**: `Task` (base) → `Voice` → `WebRTC`; `Digital` extends `Task`.
- **`Task` (base)**: Holds task data, emits SDK events, and provides default (unsupported) implementations for call control APIs.
- **`Voice`**: Adds hold/resume and consult-related capabilities for telephony tasks.
- **`WebRTC`**: Overrides `accept/decline` for WebRTC calls and hooks media events.
- **`Digital`**: Implements `accept` and refreshes digital task data/UI controls.

### Task Creation and State Machine Initialization

- **Factory**: `TaskFactory.ts` selects `WebRTC`, `Voice`, or `Digital` based on `MEDIA_CHANNEL` and `webCallingService.loginOption`.
- **Initialization**: `Task.ts` creates a state machine actor using `createTaskStateMachine(...)`, wires action overrides (emitters), and starts the actor.
- **Task State**: The task holds `stateMachineService` and uses it to send `TaskEvent` payloads.

Example (state machine init inside a task object):

```typescript
const machine = createTaskStateMachine(uiControlConfig, {
  actions: {
    emitTaskIncoming: ({event}) => task.emit('task:incoming', task),
  },
});
const actor = createActor(machine);
actor.start();
```

### TaskManager Lifecycle Orchestration

- **Listener Setup**: Registers WebSocket listeners to receive CC events and map them to `TaskEvent` payloads.
- **Task Registry**: Creates tasks via `TaskFactory`, stores them in the task collection, and updates task data on incoming events.
- **Event Emission**: Re-emits `task:*` events on the task or `cc` object for SDK consumers.
- **Hydration/Recovery**: Handles state updates and transitions during reconnect/hydrate flows.

Example (backend event to state machine):

```typescript
const payload = TaskManager.mapEventToTaskStateMachineEvent(event, taskData);
if (payload) {
  task.sendStateMachineEvent(payload);
}
```

### AQM Call Control Integration

- **`contact.ts`**: Builds the AQM request surface for call control (hold, consult, transfer, wrapup, end). Task methods delegate to these calls, then drive state transitions based on success/failure events.
- **`dialer.ts`**: Exposes the `startOutdial` AQM request used by `cc.startOutdial()` to create outbound tasks.

Example (task method delegating to AQM):

```typescript
// task.hold() -> contact.hold(...) -> stateMachine events on response
await contact.hold({interactionId});
stateMachineService.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId});
```

### Sequential Flow (End-to-End)

1. **WebSocket event arrives** → `TaskManager` maps CC event to `TaskEvent`.
2. **Task creation** (if new) → `TaskFactory` builds `Voice`/`WebRTC`/`Digital`.
3. **State machine actor starts** → `Task` wires emitters + UI control updates.
4. **Task method called** (e.g., hold/transfer) → delegates to `contact.ts` or `dialer.ts`.
5. **State transitions** → guards/actions update context and emit `task:*` events.
6. **SDK consumers update UI** → `TaskUIControls` reflect the latest state.

```mermaid
flowchart TD
  A[WebSocket event arrives] --> B[TaskManager maps CC event to TaskEvent]
  B --> C{Task exists?}
  C -- No --> D[TaskFactory creates Voice/WebRTC/Digital]
  C -- Yes --> E[Use existing task]
  D --> F[Task initializes state machine actor]
  E --> F
  F --> G[Task method called (hold/transfer/etc)]
  G --> H[contact.ts or dialer.ts API call]
  H --> I[State machine transition]
  I --> J[Actions + guards update context]
  J --> K[Emit task:* events]
  K --> L[TaskUIControls updated for SDK UI]
```

---

## Quick Start

```typescript
// Listen for incoming tasks
cc.on('task:incoming', async (task) => {
  console.log('Incoming task:', task.data.interactionId);

  // Accept the task
  await task.accept();

  // Task operations
  await task.hold();
  await task.resume();
  await task.end();
  await task.wrapup({
    wrapUpReason: 'Resolved',
    auxCodeId: 'wrapup-code',
  });
});
```

---

## Task Events

### Emitted on `cc` object(ContactCenter)

| Event           | When Emitted                 |
| --------------- | ---------------------------- |
| `task:incoming` | New task offered to agent    |
| `task:hydrate`  | Task data updated            |
| `task:merged`   | Tasks merged (EPDN transfer) |

### Emitted on `task` object(ITask)

| Event                                                                       | When Emitted                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| `task:assigned`                                                             | Task assigned to agent                           |
| `task:media`                                                                | Media stream/track updates are available         |
| `task:unassigned`                                                           | Task is unassigned from agent                    |
| `task:offerContact`                                                         | Contact offer received/updated                   |
| `task:offerConsult`                                                         | Consult offer received                           |
| `task:hold`                                                                 | Task placed on hold                              |
| `task:resume`                                                               | Task resumed from hold                           |
| `task:end`                                                                  | Task ended                                       |
| `task:rejected`                                                             | Task rejected / failure path emitted             |
| `task:wrapup`                                                               | Task entering wrapup                             |
| `task:wrappedup`                                                            | Wrapup completed                                 |
| `task:consulting`                                                           | Consult is in progress                           |
| `task:consultAccepted`                                                      | Consult accepted by destination party            |
| `task:consultCreated`                                                       | Consultation started                             |
| `task:consultEnd`                                                           | Consultation ended                               |
| `task:autoAnswered`                                                         | Task was auto-answered                           |
| `task:recordingStarted` / `task:recordingPaused` / `task:recordingResumed`  | Recording lifecycle updates                      |
| `task:conferenceStarted` / `task:conferenceEnded` / `task:conferenceFailed` | Conference lifecycle updates                     |
| `task:participantJoined` / `task:participantLeft`                           | Conference participant updates                   |
| `task:switchCall`                                                           | Switched between consult and main call           |
| `task:outdialFailed`                                                        | Outdial operation failed                         |
| `task:ui-controls-updated`                                                  | UI controls changed due to state transition      |
| `task:cleanup`                                                              | Internal cleanup signal emitted by state machine |

> Full list is defined in `TASK_EVENTS` (`types.ts`).

### AI Assistant events on `task`

| Event | When Emitted |
| --- | --- |
| `REAL_TIME_TRANSCRIPTION` | A realtime transcript payload is received for the task interaction |
| `SUGGESTED_RESPONSE` | A final AI Assistant suggestion payload is received for the task interaction |

---

## API Reference

### `cc.startOutdial(destination, origin)`

Initiate outbound call.

**Parameters**:

- `destination` (string): Phone number to call
- `origin` (string): Outbound ANI/caller ID

**Returns**: `Promise<TaskResponse>` (AQM response, not a Task instance)

**Example**:

```typescript
const response = await cc.startOutdial('+14155551234', '+18005551000');

// Outdial task object is created asynchronously via TaskManager.
// Listen on cc/task events instead of treating startOutdial response as an ITask.
cc.on('task:incoming', (task) => {
  task.on('task:assigned', () => {
    console.log('Call connected');
  });

  task.on('task:end', () => {
    console.log('Call ended');
  });
});
```

---

### `task.accept()`

Accept an incoming task.

**Returns**: `Promise<TaskResponse>`

**Example**:

```typescript
cc.on('task:incoming', async (task) => {
  await task.accept();
});
```

---

### `task.hold(mediaResourceId?)` / `task.resume(mediaResourceId?)`

Put task on hold or resume.

**Parameters**:

- `mediaResourceId` (optional `string`): Media resource ID for the hold/resume operation

**Returns**: `Promise<TaskResponse>`

**Example**:

```typescript
// Put on hold
await task.hold();

// Resume
await task.resume();
```

---

### `task.end()`

End the current task.

**Returns**: `Promise<TaskResponse>`

**Example**:

```typescript
await task.end();
```

---

### `task.wrapup(params)`

Complete task with wrapup code.

**Parameters**:

- `wrapUpReason` (string, required): Wrapup reason text
- `auxCodeId` (string, required): Wrapup code ID

**Returns**: `Promise<TaskResponse>`

**Example**:

```typescript
await task.wrapup({
  wrapUpReason: 'Customer issue resolved',
  auxCodeId: 'resolved-code',
});
```

---

### `task.transfer(params)`

Transfer task to another destination.

**Parameters**:

- `to` (string): Agent ID, queue ID, or phone number
- `destinationType` ('queue' | 'agent' | 'dialNumber'): Destination type

**Returns**: `Promise<TaskResponse>`

**Example**:

```typescript
// Transfer to queue
await task.transfer({
  to: 'queue-123',
  destinationType: 'queue',
});

// Transfer to agent
await task.transfer({
  to: 'agent-456',
  destinationType: 'agent',
});
```

---

### `task.consult(params)`

Start consultation.

**Parameters**:

- `to` (string): Agent/queue/phone to consult
- `destinationType` ('queue' | 'agent' | 'dialNumber' | 'entryPoint'): Type

**Returns**: `Promise<TaskResponse>`

**Example**:

```typescript
await task.consult({
  to: 'agent-456',
  destinationType: 'agent',
});

// Later: complete transfer (consulting voice flow uses transfer())
await task.transfer({
  to: 'queue-123',
  destinationType: 'queue',
});
// Or end consult
await task.endConsult();
```

---

### `task.endConsult(consultEndPayload?)`

End consultation without transfer.

**Parameters**:

- `consultEndPayload` (optional `ConsultEndPayload`)

**Returns**: `Promise<TaskResponse>`

---

## Media Channels

| Channel     | Description        |
| ----------- | ------------------ |
| `telephony` | Voice calls        |
| `chat`      | Web chat           |
| `email`     | Email interactions |
| `social`    | Social media       |
| `sms`       | SMS messages       |
| `facebook`  | Facebook Messenger |
| `whatsapp`  | WhatsApp messages  |

---

## Error Handling

```typescript
try {
  await task.transfer({
    to: 'queue-123',
    destinationType: 'queue',
  });
} catch (error) {
  console.error('Transfer failed:', error.message);
  // error.data contains structured error info
}
```

---

## Auto Wrapup

If enabled in agent profile, wrapup completes automatically after timeout:

```typescript
task.on('task:wrappedup', () => {
  console.log('Task wrapup completed');
});
```

---

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [TaskManager.ts](../TaskManager.ts) - Manager implementation
- [types.ts](../types.ts) - Type definitions
- [../state-machine/ai-docs/AGENTS.md](../state-machine/ai-docs/AGENTS.md) - State machine implementation guide
- [../state-machine/ai-docs/ARCHITECTURE.md](../state-machine/ai-docs/ARCHITECTURE.md) - State machine internals
