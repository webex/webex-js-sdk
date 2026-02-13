# Task Service - AI Agent Guide

> **Purpose**: Manage task lifecycle including inbound/outbound calls, hold/resume, consult, transfer, conference, and wrapup.

---

## Quick Start

```typescript
const cc = webex.cc;
await cc.register();
await cc.stationLogin({ teamId: 'team-123', loginOption: 'BROWSER' });
await cc.setAgentState({ state: 'Available', auxCodeId: '0' });

// Listen for incoming tasks
cc.on('task:incoming', async (task) => {
  console.log('Incoming task:', task.data.interactionId);
  
  // Accept the task
  await task.accept();
  
  // Task operations
  await task.hold();
  await task.unHold();
  await task.end();
  await task.wrapup({ auxCodeId: 'wrapup-code' });
});
```

---

## Key Capabilities

- **Inbound Tasks**: Handle incoming calls/chats via events
- **Outbound Calls**: Initiate outbound calls via `cc.startOutdial()`
- **Hold/Resume**: Put tasks on hold and resume
- **Transfer**: Blind transfer, consult transfer, vteam transfer
- **Conference**: Multi-party conferencing
- **Wrapup**: Complete tasks with wrapup codes
- **State Machine Driven UI Controls**: Task controls and transitions are governed by the XState state machine

---

## Task Object

When a task arrives, you receive an `ITask` object with:

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `data.interactionId` | string | Unique task identifier |
| `data.mediaType` | string | 'telephony', 'chat', 'email' |
| `data.state` | string | Current task state |
| `data.isOnHold` | boolean | Whether task is on hold |
| `data.wrapUpRequired` | boolean | Whether wrapup is needed |

### Methods

| Method | Description |
|--------|-------------|
| `accept()` | Accept incoming task |
| `hold()` | Put task on hold |
| `unHold()` | Resume from hold |
| `end()` | End the task |
| `wrapup(params)` | Complete task with wrapup code |
| `consult(params)` | Start consultation |
| `blindTransfer(params)` | Transfer without consultation |
| `consultTransfer(params)` | Transfer after consultation |
| `cancelTask()` | Cancel/decline the task |

---

## Task Events

### Emitted on `cc` (ContactCenter)

| Event | When Emitted |
|-------|--------------|
| `task:incoming` | New task offered to agent |
| `task:hydrate` | Task data updated |
| `task:merged` | Tasks merged (EPDN transfer) |

### Emitted on `task` (ITask object)

| Event | When Emitted |
|-------|--------------|
| `task:assigned` | Task assigned to agent |
| `task:hold` | Task placed on hold |
| `task:resume` | Task resumed from hold |
| `task:ended` | Task ended |
| `task:wrapup` | Task entering wrapup |
| `task:wrappedup` | Wrapup completed |
| `task:consultCreated` | Consultation started |
| `task:consultEnd` | Consultation ended |
| `task:transferred` | Task transferred |
| `task:uiControlsUpdated` | UI control states changed due to state transition |

---

## API Reference

### `cc.startOutdial(destination, origin)`

Initiate outbound call.

**Parameters**:
- `destination` (string): Phone number to call
- `origin` (string): Outbound ANI/caller ID

**Returns**: `Promise<TaskResponse>`

**Example**:
```typescript
const task = await cc.startOutdial('+14155551234', '+18005551000');

task.on('task:established', () => {
  console.log('Call connected');
});

task.on('task:ended', () => {
  console.log('Call ended');
});
```

---

### `task.accept()`

Accept an incoming task.

**Returns**: `Promise<void>`

**Example**:
```typescript
cc.on('task:incoming', async (task) => {
  await task.accept();
});
```

---

### `task.hold()` / `task.unHold()`

Put task on hold or resume.

**Returns**: `Promise<void>`

**Example**:
```typescript
// Put on hold
await task.hold();

// Resume
await task.unHold();
```

---

### `task.end()`

End the current task.

**Returns**: `Promise<void>`

**Example**:
```typescript
await task.end();
```

---

### `task.wrapup(params)`

Complete task with wrapup code.

**Parameters**:
- `auxCodeId` (string): Wrapup code ID

**Returns**: `Promise<void>`

**Example**:
```typescript
await task.wrapup({
  auxCodeId: 'resolved-code',
});
```

---

### `task.blindTransfer(params)`

Transfer without consultation.

**Parameters**:
- `destination` (string): Agent ID, queue ID, or phone number
- `destinationType` ('queue' | 'agent' | 'dialNumber'): Destination type

**Returns**: `Promise<void>`

**Example**:
```typescript
// Transfer to queue
await task.blindTransfer({
  destination: 'queue-123',
  destinationType: 'queue',
});

// Transfer to agent
await task.blindTransfer({
  destination: 'agent-456',
  destinationType: 'agent',
});
```

---

### `task.consult(params)`

Start consultation.

**Parameters**:
- `destination` (string): Agent/queue/phone to consult
- `destinationType` ('queue' | 'agent' | 'dialNumber' | 'entryPoint'): Type

**Returns**: `Promise<void>`

**Example**:
```typescript
await task.consult({
  destination: 'agent-456',
  destinationType: 'agent',
});

// Later: complete transfer or end consult
await task.consultTransfer();
// or
await task.consultEnd();
```

---

### `task.consultTransfer()`

Transfer to consulted party.

**Returns**: `Promise<void>`

---

### `task.consultEnd()`

End consultation without transfer.

**Returns**: `Promise<void>`

---

## Media Channels

| Channel | Description |
|---------|-------------|
| `telephony` | Voice calls |
| `chat` | Web chat |
| `email` | Email interactions |
| `social` | Social media |
| `sms` | SMS messages |
| `facebook` | Facebook Messenger |
| `whatsapp` | WhatsApp messages |

---

## Task States

| State | Description |
|-------|-------------|
| `new` | Task offered, not yet accepted |
| `connected` | Task active with agent |
| `hold` | Task on hold |
| `wrapup` | Task in wrapup phase |
| `ended` | Task completed |

---

## Error Handling

```typescript
try {
  await task.transfer({
    destination: 'queue-123',
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