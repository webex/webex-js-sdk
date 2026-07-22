# Rules — @webex/contact-center

> Start here → root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). These rules are extracted from current package code and reviewed package documentation.

## Coverage Map (which docs/specs to trust)
| Module | Manifest coverage state | What it means here |
|---|---|---|
| `src` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/metrics` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/services` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/services/agent` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/services/config` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/services/core` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/services/task` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/services/task/state-machine` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |
| `src/utils` | Partial | Existing docs help, but code must be cross-checked until migration, coverage, and validation pass. |

## Autonomy & Ask-First
- **May proceed:** read-only inspection and approved low-risk documentation maintenance.
- **Ask first / plan + confirm:** code changes, public contract changes, state-machine changes, security-sensitive work, or new dependencies.
- **Never without explicit human approval:** push, publish, deploy, delete, or post externally.

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

## Naming
- Use PascalCase classes/files, camelCase methods, SCREAMING_SNAKE_CASE constants, and typed event constants from their owning module.

> **Purpose**: Defines the coding standards, conventions, and architectural rules that all code in `@webex/contact-center` must follow.

- TypeScript strict mode is enabled

- Avoid `any` type unless absolutely necessary (document justification with `// eslint-disable-line`)

- Prefer `unknown` over `any` for unknown types

- All public APIs must have explicit return types

| Element | Convention | Example |
|---|---|---|
| Classes | PascalCase | `ContactCenter`, `TaskManager` |

| Element | Convention | Example |
|---|---|---|
| Interfaces | PascalCase with `I` prefix for contracts | `IContactCenter`, `ITask`, `IVoice` |

| Element | Convention | Example |
|---|---|---|
| Types | PascalCase | `SetStateResponse`, `BuddyAgentsResponse` |

| Element | Convention | Example |
|---|---|---|
| Enums/Constants | SCREAMING_SNAKE_CASE | `CC_EVENTS`, `METRIC_EVENT_NAMES` |

| Element | Convention | Example |
|---|---|---|
| Methods | camelCase | `stationLogin`, `setAgentState` |

| Element | Convention | Example |
|---|---|---|
| Private properties | camelCase with `$` prefix for SDK references | `$webex`, `$config` |

| Element | Convention | Example |
|---|---|---|
| Regular private | camelCase | `agentConfig`, `eventEmitter` |

| Element | Convention | Example |
|---|---|---|
| Module constants | SCREAMING_SNAKE_CASE | `CC_FILE`, `READY` |

- Component files: `PascalCase.ts` (e.g., `TaskManager.ts`, `WebSocketManager.ts`)

- Type files: `types.ts` in service folders

- Constant files: `constants.ts` in service folders

- Index files: `index.ts` for exports

All public methods and types must have comprehensive JSDoc:

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

Add new events to `src/metrics/constants.ts`:

```typescript
export const METRIC_EVENT_NAMES = {
  // Existing events...
  NEW_OPERATION_SUCCESS: 'new operation success',
  NEW_OPERATION_FAILED: 'new operation failed',
} as const;
```

- **TypeScript patterns**: [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)

- **Testing patterns**: [`patterns/testing-patterns.md`](patterns/testing-patterns.md)

- **Event patterns**: [`patterns/event-driven-patterns.md`](patterns/event-driven-patterns.md)

## Logging
- Use LoggerProxy with module/method context and tracking identifiers; never use console logging in implementation or log credentials/sensitive data.

```typescript
// ✅ REQUIRED pattern
import LoggerProxy from '../../logger-proxy';

LoggerProxy.info('Starting operation', {
  module: 'ModuleName',
  method: 'methodName',
});
```

| Level | Use Case | Example |
|---|---|---|
| `trace` | Detailed debugging | Entry/exit of complex functions |

| Level | Use Case | Example |
|---|---|---|
| `log` | General information | Operation completed successfully |

| Level | Use Case | Example |
|---|---|---|
| `info` | Important milestones | Starting registration, login |

| Level | Use Case | Example |
|---|---|---|
| `warn` | Potential issues | Deprecated usage, fallback behavior |

| Level | Use Case | Example |
|---|---|---|
| `error` | Failures | API errors, exceptions |

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

## Error Handling
- Preserve structured backend details and tracking ids through shared Core helpers; never swallow failures or synthesize success.

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

## Imports / Dependencies
- External packages first, then package types/constants, service imports, local utilities, and type-only imports. New runtime dependencies require approval.

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

- Public types: Export from `src/types.ts`

- Internal types: Export from service-level `types.ts`

- Services: Use default export for main class, named exports for types

## Testing
- Mirror source paths under `test/unit/spec/`; cover positive and negative behavior and retain the 85% global coverage threshold.

For full testing patterns including test file location, MockWebex setup, singleton mocking, LoggerProxy mocking, and test structure, see [`patterns/testing-patterns.md`](patterns/testing-patterns.md).

## Security
- Credentials come from the host Webex SDK; validate inputs, use authenticated service routing, and follow `SECURITY.md`.

Never commit:

- API keys, tokens, secrets

- Passwords or authentication data

- Private keys or certificates

## Spec-Currency & Drift Thresholds
- Update specs/docs in the same change as behavior, contracts, state, events, or public types.
- Partial modules require code cross-checking and characterization before risky changes.

## Secrets Policy
- No hardcoded secrets, tokens, keys, or connection strings; never log them.

## Concurrency & Async
- Preserve listener identity for cleanup, avoid blocking the event loop, maintain AQM correlation/timeouts, and keep metrics non-blocking.

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

Always use event constants:

```typescript
import {AGENT_EVENTS} from './services/agent/types';

// ✅ CORRECT
this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData);

// ❌ WRONG
this.emit('stateChange', eventData);
```

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

## Strict-Compliance Mode
- In rigorous SDD runs, stop on unresolved questionnaire facts, source-fidelity failures, template-conformance blockers, or validator findings. Generated specs require review by the manifest-configured independent runtime.

## Maintenance
- Add a rule when a review correction recurs; remove duplication when tooling enforces it. Patterns remain in `patterns/`.
