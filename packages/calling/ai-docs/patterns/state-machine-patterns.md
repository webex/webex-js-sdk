# State Machine Patterns

> Quick reference for LLMs working with XState state machines in the `@webex/calling` package.

---

## Rules

- **MUST** use XState (`createMachine` + `interpret`) for call and media (ROAP) state management
- **MUST** define state machine events as discriminated union types (`CallEvent`, `RoapEvent`)
- **MUST** use named states prefixed with `S_` and named events prefixed with `E_`
- **MUST** define actions that map to class methods for side effects
- **MUST** use `after` timeouts for state-level timeouts (e.g., 10s for unanswered call setup)
- **MUST** start the machine with `interpret(machine).start()` and stop it during cleanup
- **NEVER** mutate call state directly — always go through the state machine via `send()`
- **NEVER** perform side effects inside state machine definitions — use action callbacks

---

## Overview

The calling package uses two XState state machines per call:

1. **Call State Machine** — Manages the call signaling lifecycle (setup, progress, connect, hold, disconnect)
2. **Media State Machine (ROAP)** — Manages the WebRTC offer/answer negotiation (ROAP protocol)

Both machines are created inside the `Call` constructor and drive side effects through action maps.

---

## Call State Machine

### State Diagram

```
                     ┌────────────────────────────────────────────────────────────┐
                     │                                                            │
  ┌──────┐    E_SEND_CALL_SETUP    ┌──────────────────┐   E_RECV_CALL_PROGRESS   │
  │S_IDLE├─────────────────────────►S_SEND_CALL_SETUP ├──────────────────────────►│
  │      │                         │  (10s timeout)   │                           │
  │      │    E_RECV_CALL_SETUP    └────────┬─────────┘   ┌───────────────────┐   │
  │      ├─────────────────────────►S_RECV_ │             │S_RECV_CALL_PROGRESS│  │
  └──┬───┘                         CALL_    │             │                   ├──►│
     │                             SETUP    │             └───────────────────┘   │
     │                             (10s)    │                                     │
     │                                      │     ┌────────────────────┐          │
     │         E_RECV_CALL_DISCONNECT       └────►│ S_RECV_CALL_CONNECT│          │
     ├──────────────────────────────────────────► │                    ├──────────┤
     │         E_SEND_CALL_DISCONNECT             └────────────────────┘          │
     ├──────────────────────────────────────────────────────────────────────┐     │
     │                                                                     │     │
     │                                     ┌───────────────────────┐       │     │
     │                                     │   S_CALL_ESTABLISHED  │◄──────┘     │
     │                                     │                       │             │
     │                                     │  E_CALL_HOLD ──► S_CALL_HOLD       │
     │                                     │  E_CALL_RESUME ◄── S_CALL_HOLD     │
     │                                     └───────┬───────────────┘             │
     │                                             │                             │
     │                                    E_*_DISCONNECT                         │
     │                                             │                             │
     │                                             ▼                             │
     │                                  ┌─────────────────────┐                  │
     │                                  │S_RECV/SEND_CALL_    │                  │
     │                                  │    DISCONNECT       │                  │
     │                                  └────────┬────────────┘                  │
     │                                           │ (10s timeout)                 │
     │                                           ▼                               │
     │                                  ┌─────────────────┐                      │
     └─────────────────────────────────►│ S_CALL_CLEARED  │◄─────────────────────┘
                                        └─────────────────┘
```

### Event Types (Discriminated Union)

```typescript
export type CallEvent =
  /* Received Events */
  | {type: 'E_RECV_CALL_SETUP'; data?: unknown}
  | {type: 'E_RECV_CALL_PROGRESS'; data?: unknown}
  | {type: 'E_RECV_CALL_CONNECT'; data?: unknown}
  | {type: 'E_RECV_CALL_DISCONNECT'; data?: unknown}

  /* Sent Events */
  | {type: 'E_SEND_CALL_SETUP'; data?: unknown}
  | {type: 'E_SEND_CALL_ALERTING'; data?: unknown}
  | {type: 'E_SEND_CALL_CONNECT'; data?: unknown}
  | {type: 'E_SEND_CALL_DISCONNECT'; data?: unknown}

  /* Common Events */
  | {type: 'E_CALL_ESTABLISHED'; data?: unknown}
  | {type: 'E_CALL_INFO'; data?: unknown}
  | {type: 'E_UNKNOWN'; data?: unknown}
  | {type: 'E_CALL_CLEARED'; data?: unknown}
  | {type: 'E_CALL_HOLD'; data?: unknown}
  | {type: 'E_CALL_RESUME'; data?: unknown};
```

### Machine Definition

```typescript
const callMachine = createMachine(
  {
    schema: {
      context: {},
      events: {} as CallEvent,
    },
    id: 'call-state',
    initial: 'S_IDLE',
    context: {},
    states: {
      S_IDLE: {
        on: {
          E_RECV_CALL_SETUP: {target: 'S_RECV_CALL_SETUP', actions: ['incomingCallSetup']},
          E_SEND_CALL_SETUP: {target: 'S_SEND_CALL_SETUP', actions: ['outgoingCallSetup']},
          E_RECV_CALL_DISCONNECT: {target: 'S_RECV_CALL_DISCONNECT', actions: ['incomingCallDisconnect']},
          E_SEND_CALL_DISCONNECT: {target: 'S_SEND_CALL_DISCONNECT', actions: ['outgoingCallDisconnect']},
          E_UNKNOWN: {target: 'S_UNKNOWN', actions: ['unknownState']},
        },
      },
      S_SEND_CALL_SETUP: {
        after: {
          10000: {target: 'S_CALL_CLEARED', actions: ['triggerTimeout']},
        },
        on: {
          E_RECV_CALL_PROGRESS: {target: 'S_RECV_CALL_PROGRESS', actions: ['incomingCallProgress']},
          E_RECV_CALL_CONNECT: {target: 'S_RECV_CALL_CONNECT', actions: ['incomingCallConnect']},
          E_RECV_CALL_DISCONNECT: {target: 'S_RECV_CALL_DISCONNECT', actions: ['incomingCallDisconnect']},
          E_SEND_CALL_DISCONNECT: {target: 'S_SEND_CALL_DISCONNECT', actions: ['outgoingCallDisconnect']},
        },
      },
      S_CALL_ESTABLISHED: {
        on: {
          E_CALL_HOLD: {target: 'S_CALL_HOLD', actions: ['callHold']},
          E_RECV_CALL_DISCONNECT: {target: 'S_RECV_CALL_DISCONNECT', actions: ['incomingCallDisconnect']},
          E_SEND_CALL_DISCONNECT: {target: 'S_SEND_CALL_DISCONNECT', actions: ['outgoingCallDisconnect']},
          E_CALL_INFO: {actions: ['callInfo']},
        },
      },
      S_CALL_HOLD: {
        on: {
          E_CALL_RESUME: {target: 'S_CALL_ESTABLISHED', actions: ['callResume']},
          E_RECV_CALL_DISCONNECT: {target: 'S_RECV_CALL_DISCONNECT', actions: ['incomingCallDisconnect']},
          E_SEND_CALL_DISCONNECT: {target: 'S_SEND_CALL_DISCONNECT', actions: ['outgoingCallDisconnect']},
        },
      },
      S_CALL_CLEARED: {type: 'final'},
      // ... additional states
    },
  },
  {
    actions: {
      incomingCallSetup: () => { /* side effect */ },
      outgoingCallSetup: () => { /* side effect */ },
      incomingCallDisconnect: () => { /* side effect */ },
      outgoingCallDisconnect: () => { /* side effect */ },
      triggerTimeout: () => { /* handle timeout */ },
      // ...
    },
  }
);
```

### Starting and Using the Machine

```typescript
// In Call constructor
this.callStateMachine = interpret(callMachine);
this.callStateMachine.start();

// Sending events to the machine
this.callStateMachine.send({type: 'E_SEND_CALL_SETUP'});
this.callStateMachine.send({type: 'E_RECV_CALL_PROGRESS'});
this.callStateMachine.send({type: 'E_CALL_ESTABLISHED'});
this.callStateMachine.send({type: 'E_CALL_HOLD'});
this.callStateMachine.send({type: 'E_CALL_RESUME'});
this.callStateMachine.send({type: 'E_SEND_CALL_DISCONNECT'});
```

---

## Media (ROAP) State Machine

### ROAP Event Types

```typescript
export type RoapEvent =
  | {type: 'E_SEND_ROAP_OFFER'; data?: unknown}
  | {type: 'E_SEND_ROAP_ANSWER'; data?: unknown}
  | {type: 'E_RECV_ROAP_OFFER'; data?: unknown}
  | {type: 'E_RECV_ROAP_ANSWER'; data?: unknown}
  | {type: 'E_ROAP_ERROR'; data?: unknown}
  | {type: 'E_ROAP_OK'; data?: unknown}
  | {type: 'E_RECV_ROAP_OFFER_REQUEST'; data?: unknown}
  | {type: 'E_ROAP_TEARDOWN'; data?: unknown};
```

### ROAP Message Type

```typescript
export interface RoapMessage {
  seq: number;
  messageType: 'OFFER' | 'ANSWER' | 'OK' | 'ERROR' | 'OFFER_REQUEST';
  offererSessionId?: string;
  answererSessionId?: string;
  sdp?: string;
  version?: string;
  tieBreaker?: string;
  errorType?: string;
}
```

### Typical ROAP Flow

```
Outbound Call:
  Client                          Server
    │  E_SEND_ROAP_OFFER            │
    ├───────────────────────────────►│
    │  E_RECV_ROAP_ANSWER           │
    │◄───────────────────────────────┤
    │  E_ROAP_OK                    │
    ├───────────────────────────────►│

Inbound Call:
  Client                          Server
    │  E_RECV_ROAP_OFFER            │
    │◄───────────────────────────────┤
    │  E_SEND_ROAP_ANSWER           │
    ├───────────────────────────────►│
    │  E_ROAP_OK                    │
    │◄───────────────────────────────┤

Hold/Resume (re-negotiation):
  Client                          Server
    │  E_RECV_ROAP_OFFER_REQUEST    │
    │◄───────────────────────────────┤
    │  E_SEND_ROAP_OFFER            │
    ├───────────────────────────────►│
    │  E_RECV_ROAP_ANSWER           │
    │◄───────────────────────────────┤
    │  E_ROAP_OK                    │
    ├───────────────────────────────►│
```

---

## Timeout Pattern

State-level timeouts use XState's `after` property.

```typescript
S_SEND_CALL_SETUP: {
  after: {
    10000: {
      target: 'S_CALL_CLEARED',
      actions: ['triggerTimeout'],
    },
  },
  on: { /* transitions */ },
},
```

When no response arrives within 10 seconds, the machine auto-transitions to `S_CALL_CLEARED` and fires the `triggerTimeout` action.

---

## Action Map Pattern

Actions connect state machine transitions to `Call` class methods.

```typescript
const callMachine = createMachine(
  { /* states */ },
  {
    actions: {
      incomingCallSetup: () => {
        this.emit(CALL_EVENT_KEYS.ALERTING, this.correlationId);
      },
      outgoingCallSetup: () => {
        this.sendCallSetup();
      },
      incomingCallDisconnect: () => {
        this.handleDisconnect();
        this.emit(CALL_EVENT_KEYS.DISCONNECT, this.correlationId);
      },
      callHold: () => {
        this.held = true;
        this.emit(CALL_EVENT_KEYS.HELD, this.correlationId);
      },
      callResume: () => {
        this.held = false;
        this.emit(CALL_EVENT_KEYS.RESUMED, this.correlationId);
      },
      triggerTimeout: () => {
        log.warn('Call timed out waiting for response', {file: CALL_FILE, method: 'timeout'});
        this.handleDisconnect();
      },
    },
  }
);
```

---

## Naming Conventions

| Category | Prefix | Example |
|----------|--------|---------|
| States | `S_` | `S_IDLE`, `S_CALL_ESTABLISHED`, `S_CALL_HOLD` |
| Events (received) | `E_RECV_` | `E_RECV_CALL_SETUP`, `E_RECV_ROAP_OFFER` |
| Events (sent) | `E_SEND_` | `E_SEND_CALL_SETUP`, `E_SEND_ROAP_ANSWER` |
| Events (common) | `E_` | `E_CALL_ESTABLISHED`, `E_CALL_CLEARED` |
| Actions | camelCase | `incomingCallSetup`, `outgoingCallDisconnect` |

---

## Related

- [Architecture Patterns](./architecture-patterns.md)
- [Event Patterns](./event-patterns.md)
- [Error Handling Patterns](./error-handling-patterns.md)
- [TypeScript Patterns](./typescript-patterns.md)
