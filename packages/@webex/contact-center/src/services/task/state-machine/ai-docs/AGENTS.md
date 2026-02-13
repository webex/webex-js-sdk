# Task State Machine - AI Agent Guide

> **Purpose**: Guide AI agents working on task lifecycle transitions, guard logic, and UI control computation in the XState-based task state machine.

---

## Scope

This guide is for internal state management for the task lifecycle in:
- `TaskStateMachine.ts`
- `actions.ts`
- `guards.ts`
- `uiControlsComputer.ts`
- `types.ts`
- `constants.ts`

Use this doc when implementing:
- new state transitions
- event mapping and payload extensions
- guard/action fixes
- UI control behavior changes tied to task state

---

## Quick Start (Internal)

```typescript
import {createTaskStateMachine, TaskEvent} from '../state-machine';
import {createActor} from 'xstate';

const machine = createTaskStateMachine(uiControlConfig, {
  actions: {
    emitTaskIncoming: ({event}) => {
      // Bridge state-machine event to Task emitter
      if (event.type === TaskEvent.TASK_INCOMING) {
        task.emit('task:incoming', task);
      }
    },
  },
});

const actor = createActor(machine);
actor.start();
actor.send({type: TaskEvent.TASK_INCOMING, taskData});
```

---

## Key Concepts

- **State source of truth**: `TaskState` enum in `constants.ts`
- **Event contract**: `TaskEvent` + `TaskEventPayload` in `constants.ts` and `types.ts`
- **Transition graph**: `getTaskStateMachineConfig()` in `TaskStateMachine.ts`
- **Pure transition checks**: all reusable guards in `guards.ts`
- **Context mutation logic**: deterministic actions in `actions.ts`
- **UI behavior**: computed from `(TaskState, TaskContext)` in `uiControlsComputer.ts`

---

## File Responsibilities

| File | Responsibility |
|------|----------------|
| `TaskStateMachine.ts` | States, transitions, root event handlers |
| `actions.ts` | Context updates + emitter placeholders |
| `guards.ts` | Transition eligibility logic |
| `uiControlsComputer.ts` | Dynamic task control availability |
| `types.ts` | Typed event payload map + context schema |
| `constants.ts` | States/events/constants for state machine |

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

## Mandatory Patterns

### Keep Guards Pure

- Guards must return boolean only
- Do not mutate context in guards
- Reuse helpers (`getTaskDataFromEvent`, ownership checks, conference checks)

### Keep Actions Deterministic

- Context mutations should be centralized in `assign(...)` actions
- Event emitter actions remain pluggable placeholders and are overridden by `Task`

### Keep Event Types Strict

- Never use untyped payload shapes
- Every new event needs a `TaskEventPayloadMap` entry

### Keep State/Backend Consistency

- Respect hydrated backend state (`HYDRATE`) for reconnect/refresh recovery
- Prefer event `taskData` when available; fall back to context only when necessary

---

## Testing Checklist

- [ ] Added event is defined in `TaskEvent`
- [ ] Added payload is typed in `TaskEventPayloadMap`
- [ ] Transition paths validated for success and failure
- [ ] Guard edge cases covered (missing taskData, ownership mismatch, consult/conference race)
- [ ] UI controls validated for voice and digital where applicable
- [ ] Reconnect/hydrate behavior validated

---

## Related Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) - State machine internals and flow diagrams
- [../../ai-docs/AGENTS.md](../../ai-docs/AGENTS.md) - Task service usage guide
- [../../ai-docs/ARCHITECTURE.md](../../ai-docs/ARCHITECTURE.md) - Task service architecture
