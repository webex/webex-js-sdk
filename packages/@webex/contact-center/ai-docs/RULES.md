# Contact Center SDK - Coding Standards & Rules

> **Purpose**: Defines the coding standards, conventions, and architectural rules that all code in `@webex/contact-center` must follow.

---

## TypeScript Standards

### Strict Mode
- TypeScript strict mode is enabled
- Avoid `any` type unless absolutely necessary (document justification with `// eslint-disable-line`)
- Prefer `unknown` over `any` for unknown types
- All public APIs must have explicit return types

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `ContactCenter`, `TaskManager` |
| Interfaces | PascalCase with `I` prefix for contracts | `IContactCenter`, `ITask`, `IVoice` |
| Types | PascalCase | `SetStateResponse`, `BuddyAgentsResponse` |
| Enums/Constants | SCREAMING_SNAKE_CASE | `CC_EVENTS`, `METRIC_EVENT_NAMES` |
| Methods | camelCase | `stationLogin`, `setAgentState` |
| Private properties | camelCase with `$` prefix for SDK references | `$webex`, `$config` |
| Regular private | camelCase | `agentConfig`, `eventEmitter` |
| Module constants | SCREAMING_SNAKE_CASE | `CC_FILE`, `READY` |

### File Naming
- Component files: `PascalCase.ts` (e.g., `TaskManager.ts`, `WebSocketManager.ts`)
- Type files: `types.ts` in service folders
- Constant files: `constants.ts` in service folders
- Index files: `index.ts` for exports

---

## JSDoc Standards

### Public APIs (MANDATORY)

All public methods and types must have comprehensive JSDoc:

```typescript
/**
 * Brief description of what this does.
 *
 * @description
 * Longer description if needed with:
 * - Bullet points for features
 * - Multiple lines for clarity
 *
 * @param {ParamType} paramName - Description of the parameter
 * @returns {Promise<ReturnType>} Description of return value
 * @throws {Error} Description of when errors are thrown
 *
 * @public
 *
 * @example
 * ```typescript
 * const result = await cc.methodName({
 *   param: 'value',
 * });
 * console.log(result);
 * ```
 */
public async methodName(data: ParamType): Promise<ReturnType> {
  // implementation
}
```

### Private/Internal APIs

Use `@private` or `@ignore` tag:

```typescript
/**
 * Internal utility function.
 * @private
 * @ignore
 */
private helperMethod(): void {
  // implementation
}
```

### Type Definitions

```typescript
/**
 * Description of what this type represents.
 * @public
 */
export type MyType = {
  /** Description of this field */
  fieldName: string;
  /** Optional field description */
  optionalField?: number;
};
```

---

## Logging Standards

### Always Use LoggerProxy

```typescript
// ✅ REQUIRED pattern
import LoggerProxy from '../../logger-proxy';

LoggerProxy.info('Starting operation', {
  module: 'ModuleName',
  method: 'methodName',
});
```

### Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `trace` | Detailed debugging | Entry/exit of complex functions |
| `log` | General information | Operation completed successfully |
| `info` | Important milestones | Starting registration, login |
| `warn` | Potential issues | Deprecated usage, fallback behavior |
| `error` | Failures | API errors, exceptions |

### Logging Context (Required)

```typescript
// All log calls MUST include module and method
{
  module: 'FileName',      // Required: Class/file name
  method: 'methodName',    // Required: Current method name
  trackingId?: string,     // Optional: Request correlation ID
  interactionId?: string,  // Optional: Task/call ID
  data?: object,           // Optional: Additional context
  error?: Error,           // Optional: Error object for error logs
}
```

---

## Error Handling Standards

### Standard Error Pattern

```typescript
import {getErrorDetails} from './services/core/Utils';
import {Failure} from './services/core/GlobalTypes';

try {
  const result = await this.riskyOperation();
  return result;
} catch (error) {
  const failure = error.details as Failure;
  
  // 1. Track failure metrics
  this.metricsManager.trackEvent(
    METRIC_EVENT_NAMES.OPERATION_FAILED,
    MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
    ['operational']
  );
  
  // 2. Get detailed error (logs automatically)
  const {error: detailedError} = getErrorDetails(
    error,
    'methodName',
    'ModuleName'
  );
  
  // 3. Throw augmented error
  throw detailedError;
}
```

### Never Swallow Errors

```typescript
// ❌ WRONG - silently swallowing errors
try {
  await riskyOperation();
} catch (error) {
  // doing nothing
}

// ✅ CORRECT - at minimum log the error
try {
  await riskyOperation();
} catch (error) {
  LoggerProxy.error(`Operation failed: ${error}`, {
    module: 'ModuleName',
    method: 'methodName',
  });
  throw error;
}
```

---

## Metrics Standards

### All Operations Must Track Metrics

```typescript
// Start timing at method entry
this.metricsManager.timeEvent([
  METRIC_EVENT_NAMES.SUCCESS_EVENT,
  METRIC_EVENT_NAMES.FAILED_EVENT,
]);

// Track on success
this.metricsManager.trackEvent(
  METRIC_EVENT_NAMES.SUCCESS_EVENT,
  {
    ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
    // Add operation-specific fields
  },
  ['behavioral', 'operational']
);

// Track on failure (in catch block)
this.metricsManager.trackEvent(
  METRIC_EVENT_NAMES.FAILED_EVENT,
  {
    ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
  },
  ['behavioral', 'operational']
);
```

### Metric Event Naming

Add new events to `src/metrics/constants.ts`:

```typescript
export const METRIC_EVENT_NAMES = {
  // Existing events...
  NEW_OPERATION_SUCCESS: 'new operation success',
  NEW_OPERATION_FAILED: 'new operation failed',
} as const;
```

---

## Service Architecture Standards

### Singleton Pattern

Services use singleton pattern via `Services` class:

```typescript
// Access services through Services singleton
this.services = Services.getInstance({
  webex: this.$webex,
  connectionConfig: this.getConnectionConfig(),
});

// Use services
await this.services.agent.stationLogin({data});
await this.services.config.getAgentConfig(orgId, agentId);
```

### Service Factory Pattern

Agent/contact services use factory pattern:

```typescript
// services/agent/index.ts
export default function routingAgent(routing: AqmReqs) {
  return {
    methodName: routing.req((p: {data: ParamType}) => ({
      url: '/v1/endpoint',
      host: WCC_API_GATEWAY,
      data: p.data,
      err: createErrDetailsObject,
      method: HTTP_METHODS.POST,  // Optional, defaults to POST
      notifSuccess: {
        bind: {
          type: CC_EVENTS.SUCCESS_EVENT,
          data: {type: CC_EVENTS.SUCCESS_EVENT},
        },
        msg: {} as SuccessType,
      },
      notifFail: {
        bind: {
          type: CC_EVENTS.FAIL_EVENT,
          data: {type: CC_EVENTS.FAIL_EVENT},
        },
        errId: 'Service.aqm.agent.methodName',
      },
    })),
  };
}
```

---

## Event Standards

### Event Constant Objects

Define events as const objects with `as const`:

```typescript
export const MY_EVENTS = {
  SUCCESS: 'MySuccess',
  FAILED: 'MyFailed',
} as const;

// Extract union type
type Enum<T extends Record<string, unknown>> = T[keyof T];
export type MY_EVENTS = Enum<typeof MY_EVENTS>;
```

### Event Emission

Always use event constants:

```typescript
import {AGENT_EVENTS} from './services/agent/types';

// ✅ CORRECT
this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData);

// ❌ WRONG
this.emit('stateChange', eventData);
```

---

## Testing Standards

For full testing patterns including test file location, MockWebex setup, singleton mocking, LoggerProxy mocking, and test structure, see [`patterns/testing-patterns.md`](patterns/testing-patterns.md).

---

## Import Standards

### Import Order

1. External packages (`@webex/*`, `events`, `uuid`)
2. Internal absolute imports (types, constants)
3. Relative imports (local files)

```typescript
// 1. External
import {WebexPlugin} from '@webex/webex-core';
import EventEmitter from 'events';
import {v4 as uuidv4} from 'uuid';

// 2. Internal types/constants
import {WebexSDK, CCPluginConfig, AgentLogin} from './types';
import {READY, CC_FILE, METHODS} from './constants';

// 3. Relative imports
import Services from './services';
import LoggerProxy from './logger-proxy';
import {getErrorDetails} from './services/core/Utils';
```

### Export Standards

- Public types: Export from `src/types.ts`
- Internal types: Export from service-level `types.ts`
- Services: Use default export for main class, named exports for types

---

## Accessibility & Security

### No Hardcoded Credentials

Never commit:
- API keys, tokens, secrets
- Passwords or authentication data
- Private keys or certificates

### Sensitive Data Logging

Never log sensitive data:

```typescript
// ❌ WRONG
LoggerProxy.log(`User token: ${token}`);

// ✅ CORRECT
LoggerProxy.log('Token received', {
  module: 'Auth',
  method: 'login',
  // No sensitive data in logs
});
```

---

## Performance Standards

### Async/Await

Always use async/await over raw Promises:

```typescript
// ✅ CORRECT
public async fetchData(): Promise<Data> {
  const result = await this.service.getData();
  return result;
}

// ❌ AVOID (when possible)
public fetchData(): Promise<Data> {
  return this.service.getData().then(result => result);
}
```

### Cleanup on Deregistration

Always clean up resources:

```typescript
public async deregister(): Promise<void> {
  // Remove event listeners
  this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
  this.services.webSocketManager.off('message', this.handleWebsocketMessage);
  
  // Close connections
  if (!this.services.webSocketManager.isSocketClosed) {
    this.services.webSocketManager.close(false, 'Reason');
  }
  
  // Clear state
  this.agentConfig = null;
}
```

---

## Code Review Checklist

Before submitting code:

- [ ] All public APIs have JSDoc with `@public`, `@param`, `@returns`, `@example`
- [ ] LoggerProxy used for all logging with module/method context
- [ ] MetricsManager tracks success/failure for all operations
- [ ] Error handling follows `getErrorDetails` pattern
- [ ] No `console.log` or `console.error`
- [ ] No hardcoded credentials or sensitive data
- [ ] Event constants used (not string literals)
- [ ] Types exported appropriately
- [ ] Unit tests added/updated
- [ ] No `any` types without justification

## Need More Context?

- **TypeScript patterns**: [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)
- **Testing patterns**: [`patterns/testing-patterns.md`](patterns/testing-patterns.md)
- **Event patterns**: [`patterns/event-driven-patterns.md`](patterns/event-driven-patterns.md)
