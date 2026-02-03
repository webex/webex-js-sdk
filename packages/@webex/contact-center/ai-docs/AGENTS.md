# Contact Center SDK - AI Agent Guide

> **Purpose**: Main orchestrator for AI assistants working with the `@webex/contact-center` package.
> Routes to correct templates and provides critical rules for code generation.

---

## Quick Start Workflow

```
1. Identify Task Type → 2. Load Context → 3. Route to Template → 4. Generate/Fix Code → 5. Validate → 6. Update Docs
```

---

## Task Type Routing

| Task Type | Template | When to Use |
|-----------|----------|-------------|
| **A. Create New Service** | [`templates/new-service/00-master.md`](templates/new-service/00-master.md) | Adding services like AddressBook, Queue, EntryPoint |
| **B. Add New Method** | [`templates/new-method/00-master.md`](templates/new-method/00-master.md) | Adding methods to existing services |
| **C. Fix Bug** | [`templates/existing-service/bug-fix.md`](templates/existing-service/bug-fix.md) | Fixing issues in existing code |
| **D. Add Feature** | [`templates/existing-service/feature-enhancement.md`](templates/existing-service/feature-enhancement.md) | Enhancing existing functionality |
| **E. Understand Architecture** | Service-level `ai-docs/` | Deep dive into specific service |

---

## ⚠️ CRITICAL RULES (Always Apply)

### 1. LoggerProxy Usage (MANDATORY)

**NEVER use `console.log()`.** Always use `LoggerProxy` with proper context:

```typescript
import LoggerProxy from '../../logger-proxy';

// ✅ CORRECT - Always include module and method
LoggerProxy.info('Starting operation', {
  module: 'MyService',      // File/class name
  method: 'myMethod',       // Method name
});

LoggerProxy.log('Operation successful', {
  module: 'MyService',
  method: 'myMethod',
  trackingId: response.trackingId,  // Optional: for request correlation
});

LoggerProxy.error(`Operation failed: ${error}`, {
  module: 'MyService',
  method: 'myMethod',
  trackingId: failure?.trackingId,
});

// ❌ WRONG - Never do this
console.log('something happened');
LoggerProxy.log('message');  // Missing context
```

**Available methods**: `log`, `info`, `warn`, `trace`, `error`

**Context properties**:
- `module` (required): File or class name
- `method` (required): Method name
- `trackingId` (optional): Request correlation ID
- `interactionId` (optional): Task/interaction ID
- `data` (optional): Additional data object
- `error` (optional): Error object

---

### 2. MetricsManager Usage (MANDATORY)

All operations must track metrics. Pattern:

```typescript
import MetricsManager from '../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

// Step 1: Start timing at method start
this.metricsManager.timeEvent([
  METRIC_EVENT_NAMES.OPERATION_SUCCESS,
  METRIC_EVENT_NAMES.OPERATION_FAILED,
]);

try {
  const result = await this.performOperation();
  
  // Step 2: Track success
  this.metricsManager.trackEvent(
    METRIC_EVENT_NAMES.OPERATION_SUCCESS,
    {
      ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
      customField: 'value',
    },
    ['behavioral', 'operational']  // or ['behavioral', 'business', 'operational']
  );
  
  return result;
} catch (error) {
  const failure = error.details as Failure;
  
  // Step 3: Track failure
  this.metricsManager.trackEvent(
    METRIC_EVENT_NAMES.OPERATION_FAILED,
    {
      ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
      customField: 'value',
    },
    ['behavioral', 'operational']
  );
  
  throw error;
}
```

**Metric types**:
- `behavioral`: User actions (login, state change)
- `operational`: System operations (websocket connect, API calls)
- `business`: Business outcomes (call completed, transfer success)

---

### 3. Error Handling Pattern (MANDATORY)

Always use `getErrorDetails` for consistent error handling:

```typescript
import {getErrorDetails} from './services/core/Utils';
import {Failure} from './services/core/GlobalTypes';

try {
  // ... operation
} catch (error) {
  const failure = error.details as Failure;
  
  // Track failure metrics
  this.metricsManager.trackEvent(
    METRIC_EVENT_NAMES.OPERATION_FAILED,
    MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
    ['operational']
  );
  
  // Get detailed error (also logs and uploads logs automatically)
  const {error: detailedError, reason} = getErrorDetails(
    error,
    'methodName',   // Method where error occurred
    'ModuleName'    // Module/file name
  );
  
  throw detailedError;
}
```

---

### 4. Event Emission Pattern

Use defined event constants, never raw strings:

```typescript
import {CC_EVENTS} from './services/config/types';
import {AGENT_EVENTS} from './services/agent/types';
import {TASK_EVENTS} from './services/task/types';

// ✅ CORRECT - Use event constants
this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData);
this.emit(TASK_EVENTS.TASK_INCOMING, task);

// ❌ WRONG - Never use raw strings
this.emit('stateChange', eventData);
```

---

### 5. WebexPlugin Extension Pattern

When creating new plugin methods:

```typescript
// cc.ts - Main plugin class pattern
export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'cc';
  
  private $webex: WebexSDK;
  private $config: CCPluginConfig;
  
  constructor(...args) {
    super(...args);
    this.$webex = this.webex;
    
    this.$webex.once(READY, () => {
      this.$config = this.config;
      // Initialize services here
    });
  }
  
  /**
   * Method description with @public tag for public API
   * @param {ParamType} param - Description
   * @returns {Promise<ReturnType>} Description
   * @throws {Error} When something fails
   * @public
   * @example
   * ```typescript
   * const result = await cc.methodName({ param: 'value' });
   * ```
   */
  public async methodName(data: ParamType): Promise<ReturnType> {
    LoggerProxy.info('Starting operation', {
      module: CC_FILE,
      method: 'methodName',
    });
    
    try {
      this.metricsManager.timeEvent([SUCCESS_EVENT, FAILED_EVENT]);
      
      const result = await this.services.someService.method({data});
      
      this.metricsManager.trackEvent(SUCCESS_EVENT, {...}, ['operational']);
      
      LoggerProxy.log('Operation completed successfully', {
        module: CC_FILE,
        method: 'methodName',
        trackingId: result.trackingId,
      });
      
      return result;
    } catch (error) {
      // ... error handling pattern
    }
  }
}
```

---

## Context Loading by Task Type

### For New Service/Method:
1. Read [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)
2. Read [`patterns/sdk-plugin-patterns.md`](patterns/sdk-plugin-patterns.md)
3. Read [`patterns/testing-patterns.md`](patterns/testing-patterns.md)
4. Read existing service in same category (e.g., `AddressBook.ts` for new data service)

### For Bug Fix:
1. Read the affected service's `ai-docs/ARCHITECTURE.md`
2. Read [`patterns/testing-patterns.md`](patterns/testing-patterns.md)
3. Read related test files

### For Feature Enhancement:
1. Read [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)
2. Read the affected service's `ai-docs/AGENTS.md`
3. Read related existing implementation

---

## Repository Structure

```
packages/@webex/contact-center/
├── src/
│   ├── cc.ts                          # Main plugin class (WebexPlugin)
│   ├── types.ts                       # Public types and interfaces
│   ├── constants.ts                   # Package constants
│   ├── logger-proxy.ts                # LoggerProxy implementation
│   ├── metrics/
│   │   ├── MetricsManager.ts          # Singleton metrics manager
│   │   ├── behavioral-events.ts       # Behavioral event taxonomy
│   │   └── constants.ts               # METRIC_EVENT_NAMES
│   └── services/
│       ├── index.ts                   # Services singleton
│       ├── AddressBook.ts             # Address book service
│       ├── EntryPoint.ts              # Entry point service
│       ├── Queue.ts                   # Queue service
│       ├── WebCallingService.ts       # WebRTC calling service
│       ├── agent/                     # Agent operations
│       │   ├── index.ts               # Agent service factory
│       │   └── types.ts               # Agent types and events
│       ├── task/                      # Task management
│       │   ├── TaskManager.ts         # Task lifecycle manager
│       │   ├── contact.ts             # Contact operations
│       │   ├── dialer.ts              # Outbound dialing
│       │   ├── AutoWrapup.ts          # Auto wrapup handler
│       │   └── types.ts               # Task types and events
│       ├── config/                    # Configuration
│       │   ├── index.ts               # Config service
│       │   ├── types.ts               # CC_EVENTS, Profile, etc.
│       │   └── constants.ts           # Config constants
│       └── core/                      # Core utilities
│           ├── WebexRequest.ts        # HTTP request handler
│           ├── Utils.ts               # Utility functions
│           ├── Err.ts                 # Error classes
│           ├── GlobalTypes.ts         # Failure, AugmentedError
│           ├── aqm-reqs.ts            # AQM request handler
│           └── websocket/
│               ├── WebSocketManager.ts # WebSocket handler
│               └── connection-service.ts
├── test/
│   └── unit/
│       └── spec/
│           └── cc.ts                  # Main test file (reference)
└── ai-docs/                           # This documentation
    ├── AGENTS.md                      # You are here
    ├── RULES.md                       # Coding standards
    ├── README.md                      # Package overview
    ├── patterns/                      # Pattern documentation
    └── templates/                     # Code generation templates
```

---

## Key Type Patterns

### Enum Pattern (const object + type)
```typescript
// Define const object
export const CC_EVENTS = {
  AGENT_LOGIN: 'AgentLogin',
  AGENT_LOGOUT: 'AgentLogout',
} as const;

// Extract union type
type Enum<T extends Record<string, unknown>> = T[keyof T];
export type CC_EVENTS = Enum<typeof CC_EVENTS>;
```

### Response Type Pattern
```typescript
export type SomeResponse = {
  data: {
    // Response payload
  };
  trackingId: string;
};
```

### Failure Type Pattern
```typescript
import {Failure} from './services/core/GlobalTypes';

// In catch blocks:
const failure = error.details as Failure;
// Access: failure.trackingId, failure.data.reason, failure.data.reasonCode
```

---

## Validation Checklist (After Code Generation)

- [ ] **LoggerProxy**: All methods use LoggerProxy with `module` and `method` context
- [ ] **Metrics**: Operations track success/failure with `timeEvent` + `trackEvent`
- [ ] **Error Handling**: Uses `getErrorDetails` pattern
- [ ] **Types**: All public types have JSDoc with `@public` tag
- [ ] **Events**: Uses event constants (CC_EVENTS, AGENT_EVENTS, TASK_EVENTS)
- [ ] **Tests**: Added/updated unit tests with MockWebex
- [ ] **Exports**: New types exported from `types.ts`
- [ ] **No console.log**: Zero instances of console.log/warn/error

---

## Service-Level Documentation

For deep understanding of specific services, read their `ai-docs/`:

| Service | Location | Purpose |
|---------|----------|---------|
| Agent | `src/services/agent/ai-docs/` | Login, logout, state changes |
| Task | `src/services/task/ai-docs/` | Task lifecycle, operations |
| Config | `src/services/config/ai-docs/` | Agent profile, settings |
| Core | `src/services/core/ai-docs/` | WebSocket, HTTP, utilities |

---

## Need More Context?

- **TypeScript patterns**: [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)
- **Testing patterns**: [`patterns/testing-patterns.md`](patterns/testing-patterns.md)
- **Event patterns**: [`patterns/event-driven-patterns.md`](patterns/event-driven-patterns.md)
- **WebSocket patterns**: [`patterns/websocket-patterns.md`](patterns/websocket-patterns.md)
- **Plugin patterns**: [`patterns/sdk-plugin-patterns.md`](patterns/sdk-plugin-patterns.md)
