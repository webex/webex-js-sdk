# Task State Machine - AI Agent Guide

## Purpose
Guide AI agents working on task lifecycle transitions, guard logic, executable actions and UI control computation in the XState-based task state machine.

---

## Scope

This guide is for internal state management for the task lifecycle in:
- State machine configuration: `TaskStateMachine.ts`
- Actions and context mutation: `actions.ts`
- Guard logic: `guards.ts`
- UI control computation: `uiControlsComputer.ts`
- Event types and payloads: `constants.ts`, `types.ts`

Use this doc when implementing:
- new state transitions
- event mapping and payload extensions
- guard/action fixes
- UI control behavior changes tied to task state

---

## File Structure

```text
state-machine/
├── TaskStateMachine.ts      # State graph and transition configuration
├── actions.ts               # Assign actions and emitter placeholders
├── guards.ts                # Pure guard predicates
├── uiControlsComputer.ts    # Voice/Digital UI control computation
├── constants.ts             # TaskState, TaskEvent, machine constants
├── types.ts                 # Context and typed event payload map
├── index.ts                 # Public exports
└── ai-docs/
    ├── AGENTS.md            # AI coding guide
    └── ARCHITECTURE.md      # This file
```

---

## Source of Truth
- Task lifecycle state machine: `TaskStateMachine.ts`
- State machine types/events: `constants.ts`, `types.ts`
- Guard logic: `guards.ts`
- Actions and context mutation: `actions.ts`
- UI control computation: `uiControlsComputer.ts`

---

## Key Capabilities

- **State Graph and Transition Rules**: `TaskStateMachine.ts` defines all states, transition tables, and event handlers that drive the task lifecycle.
- **Deterministic Context Updates**: `actions.ts` implements XState actions for task context mutation and provides emitter placeholders that `Task` overrides to surface SDK events.
- **Transition Eligibility**: `guards.ts` contains pure predicates that gate transitions based on current context, task data, and backend state.
- **UI Controls Computation**: `uiControlsComputer.ts` derives `TaskUIControls` from state and context for voice/digital channels, keeping UI enablement centralized.
- **Typed Event Contracts**: `constants.ts` and `types.ts` define `TaskState`, `TaskEvent`, and the `TaskEventPayloadMap` so transitions and payloads stay type-safe.
- **Public Exports**: `index.ts` exposes the state machine factory, event enums, and types for consumption by the task layer.

---

## State Machine Overview
**Transition Source**: `getTaskStateMachineConfig()` in `TaskStateMachine.ts`

API-driven transition from `voice/Voice.ts`:
```typescript
// task.hold() / task.resume() -> holdResume()
stateMachineService.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId});
// ... backend call succeeds
stateMachineService.send({type: TaskEvent.HOLD_SUCCESS, mediaResourceId});
```

Backend-driven transition from `TaskManager.ts`:
```typescript
const eventPayload = TaskManager.mapEventToTaskStateMachineEvent(
  CC_EVENTS.AGENT_CONTACT_RESERVED,
  taskData
);
if (eventPayload) {
  task.sendStateMachineEvent(eventPayload);
}
```
---

### Transition Contract
Backend CC events from WebSocket are mapped to `TaskEvent` in `TaskManager.mapEventToTaskStateMachineEvent`.
The state machine consumes only `TaskEvent` and never raw CC events.


### Payload Contract
Source of truth: `TaskEventPayloadMap` in `types.ts`.
All new events must add a typed payload entry in `TaskEventPayloadMap`.

---

## Non-goals
- API contracts for external services.
- Mercury or CC WebSocket protocols (see `TaskManager.ts` mapping).


## Guards
Guards are boolean conditions that determine determine if a state transition is allowed. These functions validate the current context before allowing transitions.
 
### Principles
- Guards must be pure and must return boolean only
- No mutation or side-effects.
- Reuse helper accessors (e.g., `getTaskDataFromEvent`).

### State-Based Guards

```typescript
// Check if interaction is in terminated state
isInteractionTerminated(context, event) {
  return event.taskData?.interaction?.state === 'terminated';
}

// Check if interaction is consulting
isInteractionConsulting(context, event) {
  return event.taskData?.interaction?.state === 'consulting';
}

// Check if interaction is held
isInteractionHeld(context, event) {
  return event.taskData?.isOnHold === true;
}

// Check if interaction is connected
isInteractionConnected(context, event) {
  return event.taskData?.interaction?.state === 'connected';
}
```

### Consult Guards

```typescript
// Check if this is a consulting assignment
isConsultingAssignment(context, event) {
  return event.taskData?.isConsulted === true;
}

// Check if current agent initiated consult
isConsultInitiator(context, event) {
  return context.consultInitiator === context.agentId;
}

// Check if current agent received consult
isConsultedAgent(context, event) {
  return context.consultDestinationAgentId === context.agentId;
}
```

### Conference Guards

```typescript
// Check if conference is in progress by participants
isConferencingByParticipants(context, event) {
  const participants = event.taskData?.interaction?.participants;
  return Object.keys(participants || {}).length > 2;
}

// Check if last participant in conference
isLastParticipant(context, event) {
  return context.activeParticipants?.length <= 2;
}
```

### Wrapup Guards

```typescript
// Check if wrapup is required
shouldWrapUp(context, event) {
  return event.taskData?.wrapUpRequired === true;
}
```

---

## Actions
Actions are side effects executed during state machine transitions from current state to target state(next state).
Actions contain:
- Context synchronization (`updateTaskData`, `setHoldState`, consult flags)
- Lifecycle mutations (`clearConsultState`, `markEnded`)
- Integration hooks (`requestAutoAnswer`, `requestCleanup`, emitter placeholders)

### Principles
- Context mutations should be centralized in `assign(...)` actions
- Emitter actions intentionally no-op defaults and overridden by `Task` to bridge machine transitions to SDK events.
- Deterministic updates from `taskData`.


### Context Update Actions

```typescript
// Update task data from event
updateTaskData(context, event) {
  context.taskData = event.taskData;
}

// Mark task as held
markHeld(context, event) {
  context.isHeld = true;
  context.mediaResourceId = event.mediaResourceId;
}

// Mark task as ended
markEnded(context, event) {
  context.hasEnded = true;
  context.endTime = Date.now();
}

// Set consult initiator
setConsultInitiator(context, event) {
  context.consultInitiator = determineConsultInitiator(event.taskData);
}

// Set consult agent joined flag
setConsultAgentJoined(context, event) {
  context.consultDestinationAgentJoined = true;
}

// Mark conference started
markConferenceStarted(context, event) {
  context.isConferenceInProgress = true;
  context.activeParticipants = getActiveParticipants(event.taskData);
}
```

### Event Emission Actions

```typescript
// Emit task incoming
emitTaskIncoming(context, event) {
  task.emit(TASK_EVENTS.TASK_INCOMING, task);
}

// Emit task assigned
emitTaskAssigned(context, event) {
  task.emit(TASK_EVENTS.TASK_ASSIGNED, task);
}

// Emit task hold
emitTaskHold(context, event) {
  task.emit(TASK_EVENTS.TASK_HOLD, task);
}

// Emit task wrapup
emitTaskWrapup(context, event) {
  if (context.taskData.wrapUpRequired) {
    task.emit(TASK_EVENTS.TASK_WRAPUP, task);
  }
}

// ... more emission actions for each event type
```

### Cleanup Actions

```typescript
// Request cleanup (remove from collection, keep task object)
requestCleanup(context, event) {
  task.emit(TASK_EVENTS.TASK_CLEANUP, task, {removeFromCollection: false});
}

// Cleanup resources (remove from collection)
cleanupResources(context, event) {
  task.emit(TASK_EVENTS.TASK_CLEANUP, task, {removeFromCollection: true});
}
```

### Auto-Answer Actions

```typescript
// Request auto-answer
requestAutoAnswer(context, event) {
  if (event.taskData?.isAutoAnswering) {
    // Trigger accept() method
    autoAnswerIfNeeded();
  }
}
```

---

## UI Controls
`uiControlsComputer.ts` computes `TaskUIControls` from:
- current machine state
- current context
- channel type (voice vs digital)
- call/participant metadata from `taskData`
- config flags (`isEndTaskEnabled`, recording toggles, voice variant)

This keeps all control enablement/visibility logic centralized and testable.

### Source of truth
`computeUIControls()` in `uiControlsComputer.ts`.

### Inputs
- `TaskState`
- `TaskContext` (including `taskData`)
- `UIControlConfig` (channel type, agentId, voice variant, recording flags)

### Output
- `TaskUIControls` with per-control visibility and enabled state.

---

## Common Workflows

### Add New Event

1. Add event in `TaskEvent` (`constants.ts`)
2. Add typed payload in `TaskEventPayloadMap` (`types.ts`)
3. Wire transitions in `TaskStateMachine.ts`
4. Add/adjust actions in `actions.ts`
5. Add guard(s) in `guards.ts` if needed
6. Update `TaskManager` event mapping and unit tests

### Add New Transition Rule

1. Implement pure guard in `guards.ts`
2. Use guard in `TaskStateMachine.ts` transition array
3. Keep side-effects in actions only (no side-effects in guards)
4. Add tests for positive and negative transition paths

### Update UI Controls

1. Update control logic in `computeVoiceUIControls()` or `computeDigitalUIControls()`
2. Preserve `getDefaultUIControls()` shape compatibility
3. Verify behavior across `CONNECTED`, `HELD`, `CONSULTING`, `CONFERENCING`, `WRAPPING_UP`
4. Add or update UI-control unit coverage

---

## Testing Checklist

- [ ] Added event is defined in `TaskEvent`
- [ ] Added payload is typed in `TaskEventPayloadMap`
- [ ] Add transition(s) in `TaskStateMachine.ts` and validate it for success and failure
- [ ] Update mapping in `TaskManager.mapEventToTaskStateMachineEvent`
- [ ] Add/update guards and actions
- [ ] Update UI controls if state impacts UX and validate them for voice and digital where applicable
- [ ] Reconnect/hydrate behavior validated
- [ ] Add/adjust unit tests.
- [ ] Update diagrams + mapping tables in `ARCHITECTURE.md`.

---

## Related Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) - State machine internals and flow diagrams
- [../../ai-docs/AGENTS.md](../../ai-docs/AGENTS.md) - Task service usage guide
- [../../ai-docs/ARCHITECTURE.md](../../ai-docs/ARCHITECTURE.md) - Task service architecture
