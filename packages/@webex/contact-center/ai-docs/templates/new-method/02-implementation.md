# New Method - Implementation

> **Purpose**: Implement the new method following SDK patterns.

---

## Method Invocation Patterns

There are two common patterns for where methods are implemented. The public method lives on whichever object owns the feature's scope (currently `cc` for SDK-level operations, `task` for per-interaction operations, or a public service accessor for domain-specific queries). New public objects may be introduced in the future.

1. **Public wrapper + internal service call**: The public method is defined on the owning object, but the actual implementation lives in a service module. The public method delegates internally.
   ```typescript
   // Example A: cc.ts — SDK-level method delegates to agent service
   public async getBuddyAgents(data: BuddyAgents): Promise<BuddyAgentsResponse> {
     const resp = await this.services.agent.buddyAgents({
       data: {agentProfileId: this.agentConfig.agentProfileID, ...data},
     });
     return resp;
   }

   // Example B: Task.ts — per-interaction method delegates to contact service
   public async hold(): Promise<TaskResponse> {
     return this.contact.hold({...});
   }
   ```

2. **Direct service access**: Sometimes consumers call a service method directly via a public service accessor on `cc`.
   ```typescript
   // Consumer code calling service directly via public accessor
   const queues = await cc.queue.getQueues();
   const entries = await cc.addressBook.getEntries();
   ```
   > **Note:** Use `cc.<serviceName>` (e.g., `cc.queue`, `cc.addressBook`), NOT `cc.services.<serviceName>`. The `services` object is internal.

Determine which pattern applies based on the requirements gathered in Step 1.

---

## Method Template

```typescript
/**
 * Brief description of what this method does.
 *
 * @description
 * Detailed description including:
 * - What the method accomplishes
 * - When to use it
 * - Prerequisites (e.g., must be logged in)
 *
 * @param {ParamType} data - Description of parameters
 * @param {string} data.requiredField - Description
 * @param {number} [data.optionalField] - Optional field description
 *
 * @returns {Promise<ReturnType>} Description including:
 *   - field1: What this field contains
 *   - field2: What this field contains
 *
 * @throws {Error} When operation fails with reason in error.message
 *
 * @public
 *
 * @example
 * ```typescript
 * const cc = webex.cc;
 * await cc.register();
 * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
 *
 * // Basic usage
 * const result = await cc.methodName({
 *   requiredField: 'value',
 * });
 *
 * // With optional params
 * const result = await cc.methodName({
 *   requiredField: 'value',
 *   optionalField: 42,
 * });
 * ```
 */
public async methodName(data: ParamType): Promise<ReturnType> {
  // 1. Log start of operation
  LoggerProxy.info('Starting operation', {
    module: CC_FILE,
    method: METHODS.METHOD_NAME,
  });
  
  try {
    // 2. Start timing for metrics
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.OPERATION_SUCCESS,
      METRIC_EVENT_NAMES.OPERATION_FAILED,
    ]);
    
    // 3. Validate input if needed
    if (!data.requiredField) {
      throw new Error('requiredField is required');
    }
    
    // 4. Call service method
    const result = await this.services.someService.method({
      data: {
        ...data,
        // Add any additional fields from agentConfig if needed
        agentId: this.agentConfig.agentId,
      },
    });
    
    // 5. Track success metrics
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.OPERATION_SUCCESS,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        // Add operation-specific fields
        customField: data.requiredField,
      },
      ['behavioral', 'operational']  // Adjust metric types as needed
    );
    
    // 6. Log success
    LoggerProxy.log('Operation completed successfully', {
      module: CC_FILE,
      method: METHODS.METHOD_NAME,
      trackingId: result.trackingId,
    });
    
    // 7. Return result (transform if needed)
    return result;
    
  } catch (error) {
    // 8. Cast error details
    const failure = error.details as Failure;
    
    // 9. Track failure metrics
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.OPERATION_FAILED,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
        customField: data.requiredField,
      },
      ['behavioral', 'operational']
    );
    
    // 10. Get detailed error (this logs and uploads logs automatically)
    const {error: detailedError} = getErrorDetails(
      error,
      METHODS.METHOD_NAME,
      CC_FILE
    );
    
    // 11. Throw augmented error
    throw detailedError;
  }
}
```

---

## Event Emission (if applicable)

If the method needs to emit events, understand the two-step flow used in the SDK:

### How it works: WebSocket trigger → EventEmitter emit

For methods that go through `aqm-reqs` (used by all AQM-integrated services — agent, task, etc., except config service GET methods), the flow is:

1. **cc.ts** public method calls a service method (e.g., `this.services.agent.stationLogin()`)
2. **aqm-reqs.ts** sends an HTTP request AND registers pending handlers for the expected WebSocket success/fail messages (via `notifSuccess`/`notifFail` bindings)
3. **Backend** processes the request and sends the result back via **WebSocket**
4. **aqm-reqs.onMessage()** receives the WS message, matches it to the pending request, and resolves/rejects the Promise
5. **cc.ts `handleWebsocketMessage()`** also receives the same WS message and uses `trigger` to fire events for consumers

```
HTTP request → Backend → WS message
                            ├─→ aqm-reqs.onMessage() → resolves/rejects Promise
                            └─→ cc.ts handleWebsocketMessage() → this.trigger(EVENT)
```

### Real example: `setAgentState` in cc.ts

**Step 1 — Service defines WS bindings** (in `services/agent/index.ts`):
```typescript
stateChange: routing.req((p: {data: Agent.StateChange}) => ({
  url: '/v1/agents/state',
  host: WCC_API_GATEWAY,
  data: p.data,
  err,
  notifSuccess: {
    bind: { type: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS },
    msg: {} as Agent.StateChangeSuccess,
  },
  notifFail: {
    bind: { type: CC_EVENTS.AGENT_STATE_CHANGE_FAILED },
    errId: 'Service.aqm.agent.stateChange',
  },
})),
```

**Step 2 — WS message triggers event** (in `cc.ts handleWebsocketMessage()`):
```typescript
case CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS:
  // cc.ts extends WebexPlugin — use trigger, not emit
  // @ts-ignore
  this.trigger(AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, eventData.data);
  break;
case CC_EVENTS.AGENT_STATE_CHANGE_FAILED:
  // @ts-ignore
  this.trigger(AGENT_EVENTS.AGENT_STATE_CHANGE_FAILED, eventData.data);
  break;
```

**Step 3 — Consumer listens** using `.on()`:
```typescript
const handleStateChangeSuccess = (data) => {
  // Handle state change success
};
cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, handleStateChangeSuccess);
```

### Task-level events (method-level emit)

For Task methods (which extend `EventEmitter`), events are emitted directly using `emit`:
```typescript
// Task.ts extends EventEmitter — emit works natively
// On success, emit directly:
this.emit(TASK_EVENTS.TASK_AUTO_ANSWERED, this);
```

> **When to emit events**: Emit events when consumers need to react asynchronously to state changes (WS-driven methods like `stationLogin`, `setAgentState`). For simple request-response methods (like `getBuddyAgents`), the returned Promise is sufficient — no events needed.

---

## Adding Method Constants

In `src/constants.ts`, add method name:

```typescript
export const METHODS = {
  // ... existing
  METHOD_NAME: 'methodName',
} as const;
```

---

## Adding Metric Constants

In `src/metrics/constants.ts`:

```typescript
export const METRIC_EVENT_NAMES = {
  // ... existing
  OPERATION_SUCCESS: 'operation success',
  OPERATION_FAILED: 'operation failed',
} as const;
```

---

## Adding Types

In `src/types.ts` or appropriate service types file:

```typescript
/**
 * Parameters for methodName operation
 * @public
 */
export type ParamType = {
  /** Description of required field */
  requiredField: string;
  /** Description of optional field */
  optionalField?: number;
};

/**
 * Response from methodName operation
 * @public
 */
export type ReturnType = {
  /** Description of data */
  data: {
    /** Field description */
    field: string;
  };
  /** Request tracking ID */
  trackingId: string;
};
```

---

## Next Step

Proceed to: [`03-tests.md`](03-tests.md)
