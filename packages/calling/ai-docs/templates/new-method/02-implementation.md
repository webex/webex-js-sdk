# New Method -- Implementation Guide

> **Prerequisites**: Complete [`01-requirements.md`](01-requirements.md) and get developer approval on the spec summary before implementing.

---

## Invocation Patterns

Methods in the calling SDK follow one of two invocation patterns:

### Pattern 1: Public Interface Method on Class

The consumer calls the method directly on the class instance. The method is defined on the class and declared in the corresponding interface.

```typescript
// In types.ts — interface declaration
export interface ICall {
  parkCall(): void;
}

// In call.ts — class implementation
export class Call extends Eventing<CallEventTypes> implements ICall {
  public parkCall = (): void => {
    // implementation
  };
}

// Consumer usage
call.parkCall();
```

### Pattern 2: Factory + Internal Delegation

A public method delegates to a private handler, often via a state machine transition. This is the pattern used by hold/resume and other supplementary services.

```typescript
// Public method — triggers state machine event
public doHoldResume = (): void => {
  if (this.held) {
    this.sendCallStateMachineEvt({type: 'E_CALL_RESUME'});
  } else {
    this.sendCallStateMachineEvt({type: 'E_CALL_HOLD'});
  }
};

// Private handler — invoked by the state machine action
private async handleCallHold(event: CallEvent) {
  // actual API call, metrics, error handling
}
```

Choose the pattern based on whether the operation needs state machine coordination. If the method triggers a supplementary service (hold, resume, transfer, park), use Pattern 2. If it is a simple query or direct action, use Pattern 1.

---

## Method Implementation Template

Use this 13-step template for any method that calls the Mobius API. Adapt as needed for simpler methods.

```typescript
/**
 * <Brief description of what this method does.>
 *
 * @param param1 - <Description of param1.>
 * @param param2 - <Description of param2.>
 * @returns <Description of return value.>
 */
public async methodName(param1: ParamType, param2?: OptionalType): Promise<ReturnType> {
  // Step 1: Define log context
  const logContext = {
    file: CALL_FILE,                    // Use the appropriate *_FILE constant
    method: METHODS.METHOD_NAME,        // Use the METHODS constant
  };

  // Step 2: Log method entry
  log.info(`${METHOD_START_MESSAGE} with: ${this.getCorrelationId()}`, logContext);

  // Step 3: Validate preconditions
  if (!this.connected) {
    log.warn('Cannot perform operation: call is not connected', logContext);
    return;
  }

  try {
    // Step 4: Call Mobius API
    const response = await this.postSSRequest(param1, SUPPLEMENTARY_SERVICES.OPERATION);

    // Step 5: Submit success metric
    this.metricManager.submitCallMetric(
      METRIC_EVENT.CALL,
      'method_action_name',
      METRIC_TYPE.BEHAVIORAL,
      this.getCallId(),
      this.getCorrelationId(),
      undefined
    );

    // Step 6: Send state machine event (if applicable)
    this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED'});

    // Step 7: Log success
    log.info(`Response code: ${response.statusCode}`, logContext);

    // Step 8: Return result (if applicable)
    return response.body;
  } catch (e) {
    // Step 9: Log error
    log.error(`Failed to perform operation: ${JSON.stringify(e)}`, logContext);

    // Step 10: Create typed error
    const errData = e as MobiusCallResponse;
    const callError = createCallError(
      'A user-friendly error message describing what went wrong.',
      logContext as ErrorContext,
      ERROR_TYPE.CALL_ERROR,
      this.getCorrelationId(),
      ERROR_LAYER.CALL_CONTROL
    );

    // Step 11: Submit failure metric
    this.submitCallErrorMetric(callError);

    // Step 12: Emit error event
    this.emit(CALL_EVENT_KEYS.METHOD_ERROR, callError);

    // Step 13: Throw or handle
    // Option A: Throw (if consumer should catch)
    throw callError;
    // Option B: Send state machine event (if state machine should recover)
    // this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});
  }
}
```

---

## Event Emission Patterns

### Pattern A: Mobius WebSocket -> State Machine -> Emit

For operations where the state change is confirmed by a Mercury WebSocket event (hold, resume, park). The HTTP response only confirms the request was accepted; the actual state change arrives asynchronously.

```
Consumer calls method
  -> State machine transitions to pending state (e.g., S_CALL_HOLD)
  -> HTTP POST to Mobius (200 OK = request accepted)
  -> Mercury WebSocket delivers callInfo event (callState: 'HELD')
  -> handleMidCallEvent processes the WebSocket event
  -> Emit success event to consumer (CALL_EVENT_KEYS.HELD)
  -> If WebSocket event never arrives within timeout, emit error event
```

### Pattern B: Direct Emit

For operations where the HTTP response itself is the confirmation (transfer, disconnect).

```
Consumer calls method
  -> HTTP POST to Mobius
  -> Success response received
  -> Submit success metric
  -> Emit success event to consumer immediately
```

### Real Example: doHoldResume Flow

This is the actual pattern from `src/CallingClient/calling/call.ts`:

```typescript
// PUBLIC: Consumer calls this
public doHoldResume = (): void => {
  if (this.held) {
    this.sendCallStateMachineEvt({type: 'E_CALL_RESUME'});
  } else {
    this.sendCallStateMachineEvt({type: 'E_CALL_HOLD'});
  }
};

// PRIVATE: State machine action invokes this
private async handleCallHold(event: CallEvent) {
  log.info(`${METHOD_START_MESSAGE} with: ${this.getCorrelationId()}`, {
    file: CALL_FILE,
    method: METHODS.HANDLE_CALL_HOLD,
  });

  try {
    const response = await this.postSSRequest(undefined, SUPPLEMENTARY_SERVICES.HOLD);

    log.log(`Response code: ${response.statusCode}`, {
      file: CALL_FILE,
      method: METHODS.HANDLE_CALL_HOLD,
    });

    // HTTP 200 only means request accepted — wait for Mercury WS event
    // Set a timeout in case the WebSocket event never arrives
    if (this.isHeld() === false) {
      this.supplementaryServicesTimer = setTimeout(async () => {
        const errorContext = {file: CALL_FILE, method: METHODS.HANDLE_CALL_HOLD};

        log.warn('Hold response timed out', {
          file: CALL_FILE,
          method: METHODS.HANDLE_CALL_HOLD,
        });

        const callError = createCallError(
          'An error occurred while placing the call on hold. Wait a moment and try again.',
          errorContext as ErrorContext,
          ERROR_TYPE.TIMEOUT,
          this.getCorrelationId(),
          ERROR_LAYER.CALL_CONTROL
        );

        this.emit(CALL_EVENT_KEYS.HOLD_ERROR, callError);
        this.submitCallErrorMetric(callError);
      }, SUPPLEMENTARY_SERVICES_TIMEOUT);
    }
  } catch (e) {
    log.error(`Failed to put the call on hold: ${JSON.stringify(e)}`, {
      file: CALL_FILE,
      method: METHODS.HANDLE_CALL_HOLD,
    });
    const errData = e as MobiusCallResponse;

    handleCallErrors(
      (error: CallError) => {
        this.emit(CALL_EVENT_KEYS.HOLD_ERROR, error);
        this.submitCallErrorMetric(error);
        this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});
      },
      ERROR_LAYER.CALL_CONTROL,
      /* istanbul ignore next */ (interval: number) => undefined,
      this.getCorrelationId(),
      errData,
      METHODS.HANDLE_CALL_HOLD,
      CALL_FILE
    );
  }
}
```

---

## Adding Constants

### Add method name to `METHODS` in `src/CallingClient/constants.ts`

```typescript
export const METHODS = {
  // ... existing methods ...
  PARK_CALL: 'parkCall',           // Add new method constant
  HANDLE_CALL_PARK: 'handleCallPark',  // Add handler constant if Pattern 2
};
```

### Add metric event to `METRIC_EVENT` in `src/Metrics/types.ts` (if new metric needed)

Most new methods use existing metric events (`METRIC_EVENT.CALL`, `METRIC_EVENT.CALL_ERROR`). Only add a new enum value if the method represents a genuinely new category of operation.

```typescript
export enum METRIC_EVENT {
  // ... existing events ...
  PARK = 'web-calling-sdk-park',           // Only if needed
  PARK_ERROR = 'web-calling-sdk-park-error', // Only if needed
}
```

### Add event keys to `CALL_EVENT_KEYS` in `src/Events/types.ts`

```typescript
export enum CALL_EVENT_KEYS {
  // ... existing keys ...
  PARKED = 'parked',
  PARK_ERROR = 'park_error',
}
```

### Add event handler types to `CallEventTypes` in `src/Events/types.ts`

```typescript
export type CallEventTypes = {
  // ... existing event types ...
  [CALL_EVENT_KEYS.PARKED]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.PARK_ERROR]: (error: CallError) => void;
};
```

---

## Adding Types

### Add to the module's `types.ts`

Add parameter types, response types, and the method to the public interface:

```typescript
// In src/CallingClient/calling/types.ts

// Add to the ICall interface
export interface ICall {
  // ... existing methods ...
  parkCall(): void;
}

// Add any new types needed by the method
export type ParkResponse = {
  statusCode: number;
  body: {
    parkExtension: string;
  };
};
```

### Add supplementary service type to `src/Events/types.ts` (if applicable)

The `SUPPLEMENTARY_SERVICES` enum already includes common services. Add a new entry only if needed:

```typescript
export enum SUPPLEMENTARY_SERVICES {
  HOLD = 'hold',
  RESUME = 'resume',
  DIVERT = 'divert',
  TRANSFER = 'transfer',
  PARK = 'park',        // Already exists in the codebase
}
```

---

## State Machine Integration (if applicable)

If the method requires a new state machine state or transition:

### Add the event type to `CallEvent` in `src/Events/types.ts`

```typescript
export type CallEvent =
  // ... existing events ...
  | {type: 'E_CALL_PARK'; data?: unknown};
```

### Add the state and transition to the call state machine in `call.ts`

```typescript
// In the createMachine call within the Call constructor
states: {
  // ... existing states ...
  S_CALL_PARK: {
    on: {
      E_CALL_ESTABLISHED: {target: 'S_CALL_ESTABLISHED', actions: ['callEstablished']},
      E_RECV_CALL_DISCONNECT: {target: 'S_RECV_CALL_DISCONNECT', actions: ['incomingCallDisconnect']},
    },
    entry: ['initiateCallPark'],
  },
}
```

### Add the action mapping

```typescript
actions: {
  // ... existing actions ...
  initiateCallPark: (context, event: CallEvent) => this.handleCallPark(event),
}
```

---

## Next Step

Once the method is implemented, proceed to **[03-tests.md](03-tests.md)** to write unit tests.
