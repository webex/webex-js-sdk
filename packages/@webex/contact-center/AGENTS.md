# Contact Center SDK - AI Agent Guide

## Purpose

This is the main orchestrator for AI assistants working with the package `@webex/contact-center` in this repository. It routes you to the correct templates and documentation based on the developer's task and provides critical rules for code generation.

**For every developer request:**  
(1) Identify task type (A-E below) under Task Type Routing.  
(2) If the work is in an existing service/module, load that scope's ai-docs and follow its `AGENTS.md` + `ARCHITECTURE.md`.  
(3) Open the template for that type and complete its mandatory pre-steps before code changes (unless explicitly waived by the developer).  
(4) If the prompt mixes multiple task types, split into scoped subtasks and execute sequentially.  
(5) Then follow the rest of this guide and the selected template.

---

## Quick Start Workflow

When a developer provides a task, follow this workflow:

1. **Understand the task** - Identify what type of work is needed.
2. **Break down large or multi-part tasks** - If the prompt mixes multiple tasks (for example, "add a method" and "fix a bug"), split into smaller scoped subtasks and execute them one by one.
3. **Route to the appropriate template** - Use task-type routing below; for "Add Feature", run placement triage (existing service vs new service).
4. **Load service ai-docs for the target scope** - Read that scope's `ai-docs/AGENTS.md` and `ai-docs/ARCHITECTURE.md`.
5. **Complete mandatory template pre-steps** - Do not generate code until pre-steps are done unless explicitly waived.
6. **Generate/fix code** - Follow established package patterns.
7. **Validate functionality and quality** - Verify behavior, tests, lint, and type checks.
8. **Update documentation** - Keep ai-docs aligned with code changes.
9. **Ask for review** - Confirm completion and offer adjustments.

---

## Task Type Routing

**A. Create New Service**
- Use when adding a new service module (for example AddressBook/Queue/EntryPoint style additions).
- **Route to:** [`templates/new-service/00-master.md`](templates/new-service/00-master.md)
- **Follow:** Full new-service workflow including validation and docs updates.

**B. Add New Method**
- Use when extending an existing service with a new method/API.
- **Route to:** [`templates/new-method/00-master.md`](templates/new-method/00-master.md)
- **Follow:** Method signature, implementation, tests, and validation checklist.

**C. Fix Bug**
- Use when behavior is incorrect or regressions are reported.
- **Route to:** [`templates/existing-service/bug-fix.md`](templates/existing-service/bug-fix.md)
- **Follow:** Reproduce -> root cause -> fix -> regression validation.

**D. Add Feature**
- Use when enhancing capabilities, then decide placement via triage:
  - existing service/module enhancement, or
  - new standalone service/module creation.
- **Route to:** [`templates/existing-service/feature-enhancement.md`](templates/existing-service/feature-enhancement.md)
- **Follow:** Run mandatory feature placement triage. If triage indicates a new service/module, reroute to [`templates/new-service/00-master.md`](templates/new-service/00-master.md).

**E. Understand Architecture**
- Use when the task is analysis/explanation and no immediate code generation is required.
- **Route to:** Relevant service-level `ai-docs/AGENTS.md` and `ai-docs/ARCHITECTURE.md`.
- **Follow:** Read-only architecture exploration with clear explanation.

If a developer request includes multiple task types, split into ordered subtasks and execute sequentially.

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

### 6. Scope ai-docs Are Authoritative (MANDATORY)

When working inside a service scope (`agent`, `task`, `config`, `core`), treat that scope's `ai-docs/AGENTS.md` and `ai-docs/ARCHITECTURE.md` as implementation authority for that scope.

- Root `AGENTS.md` is the orchestrator.
- Service `ai-docs` define scope-specific behavior and architecture.
- If there is any conflict, prefer scope docs for that scope.

---

### 7. Complete Pre-Steps Before Code (MANDATORY)

Do not implement code until template pre-steps are complete or the developer explicitly asks to skip.

| Task Type | Template | Mandatory Pre-Step |
|---|---|---|
| A. Create New Service | `templates/new-service/00-master.md` | Confirm service contract, dependencies, API surface, and tests |
| B. Add New Method | `templates/new-method/00-master.md` | Confirm method signature, return type, call path, success/failure behavior |
| C. Fix Bug | `templates/existing-service/bug-fix.md` | Confirm repro steps, root-cause scope, expected behavior |
| D. Add Feature | `templates/existing-service/feature-enhancement.md` | Run placement triage (existing service vs new service), then confirm requirements, compatibility, and impacted APIs; reroute to `templates/new-service/00-master.md` if needed |
| E. Understand Architecture | Service `ai-docs` | No pre-step gate (read-only) |

---

### 8. Context Guardrail (APPLIES EVERYWHERE)

For **every** task type (new service, new method, bug fix, feature enhancement, architecture), gather context in this order:

1. Same package code under `@webex/contact-center`
2. Same package ai-docs (`AGENTS.md`, `ARCHITECTURE.md`, templates, patterns)
3. Same package tests

Only use references from other plugins/modules/packages when the developer explicitly requests it.

Mandatory behavior:
- Prefer local package implementations/patterns before external references.
- If required context is missing, ask targeted clarification questions instead of guessing.
- Document what local references were used before implementation.

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

## Functionality Validation Gate (CRITICAL)

Before marking any coding task complete, verify:

1. **API/Type correctness**
   - method signatures and payload types align with existing contracts
   - no accidental breaking API changes
2. **Pattern compliance**
   - `LoggerProxy`, `MetricsManager`, `getErrorDetails`, event constants
3. **Behavior correctness**
   - success/failure paths covered
   - state/event flow is correct for affected service
4. **Quality checks**
   - relevant unit tests pass
   - lint/type checks pass

If any gate fails, fix before completion.

---

## Documentation Update Gate

After code changes, verify whether docs must be updated:

- service `ai-docs/AGENTS.md` (usage/workflow changes)
- service `ai-docs/ARCHITECTURE.md` (flow/architecture changes)
- root templates/pattern docs (if a new reusable pattern is introduced)

---

## Common Questions to Ask

- Is this a new method, bug fix, feature enhancement, or architecture question?
- Which service scope is affected (`agent`, `task`, `config`, `core`)?
- Are there compatibility constraints with existing API behavior?
- Should tests and docs be updated in this change?

---

## Success Criteria

- Follows required coding patterns (`LoggerProxy`, metrics, error handling, event constants)
- Implements intended behavior without regressions
- Includes/updates tests where needed
- Passes lint/type/test checks
- Updates docs when behavior or architecture changes

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
