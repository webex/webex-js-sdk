# TypeScript Patterns - Contact Center SDK

> **Purpose**: TypeScript conventions and patterns specific to the Contact Center SDK.

---

## Type Definition Patterns

### Const Object + Type Pattern (for Enums)

The SDK uses const objects instead of TypeScript enums for better tree-shaking and runtime access:

```typescript
// Step 1: Define const object
export const CC_EVENTS = {
  AGENT_LOGIN: 'AgentLogin',
  AGENT_LOGOUT: 'AgentLogout',
  AGENT_STATE_CHANGE: 'AgentStateChange',
} as const;

// Step 2: Create union type from values
type Enum<T extends Record<string, unknown>> = T[keyof T];
export type CC_EVENTS = Enum<typeof CC_EVENTS>;

// Usage:
const event: CC_EVENTS = CC_EVENTS.AGENT_LOGIN; // ✅ Type-safe
const event2: CC_EVENTS = 'InvalidEvent';        // ❌ Compile error
```

### Failure Type Pattern

Error responses use the `Failure` type:

```typescript
// From services/core/GlobalTypes.ts

// Base message type — all WebSocket messages extend this
export type Msg<T = any> = {
  type: string;
  orgId: string;
  trackingId: string;
  data: T;
};

// Failure wraps error details inside Msg
export type Failure = Msg<{
  agentId: string;
  trackingId: string;
  reasonCode: number;
  orgId: string;
  reason: string;
}>;

// Usage in catch blocks:
const failure = error.details as Failure;
// Access: failure.trackingId, failure.data.reason, failure.data.reasonCode
LoggerProxy.error(`Operation failed`, {
  module: CC_FILE,
  method: 'methodName',
  trackingId: failure.trackingId,
});
```

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| Class files | PascalCase | `TaskManager.ts`, `WebSocketManager.ts` |
| Type files | lowercase | `types.ts` |
| Constant files | lowercase | `constants.ts` |
| Index files | lowercase | `index.ts` |
| Utility files | PascalCase | `Utils.ts`, `Err.ts` |

### Code Elements

```typescript
// Classes: PascalCase
class ContactCenter { }
class TaskManager { }

// Interfaces: PascalCase with I prefix for contracts
// (e.g., IContactCenter, ITask, IVoice, IDigital)
// Types: PascalCase without prefix
type AgentLogin = { };
type Profile = { };

// Constants: SCREAMING_SNAKE_CASE
const CC_FILE = 'ContactCenter';
const METRIC_EVENT_NAMES = { };

// Methods: camelCase
public async stationLogin() { }
private handleWebsocketMessage() { }

// Properties: camelCase
private agentConfig: Profile;
private eventEmitter: EventEmitter;

// SDK references: $ prefix
private $webex: WebexSDK;
private $config: CCPluginConfig;
```

---

## Import Patterns

### Import Order

```typescript
// 1. External packages
import {WebexPlugin} from '@webex/webex-core';
import EventEmitter from 'events';
import {v4 as uuidv4} from 'uuid';

// 2. Package-level imports (types, constants)
import {
  WebexSDK,
  CCPluginConfig,
  AgentLogin,
  StationLoginResponse,
} from './types';
import {READY, CC_FILE, METHODS} from './constants';

// 3. Service imports
import Services from './services';
import LoggerProxy from './logger-proxy';

// 4. Utility imports
import {getErrorDetails} from './services/core/Utils';
import {Failure} from './services/core/GlobalTypes';

// 5. Type-only imports (when applicable)
import type {Profile} from './services/config/types';
```

### Re-exports

```typescript
// types.ts - Central export file
export {Profile, CC_EVENTS} from './services/config/types';
export {AGENT_EVENTS, StationLoginSuccess} from './services/agent/types';
export {TASK_EVENTS, ITask} from './services/task/types';
```

---

## Type Derivation Patterns

### Pick for Subset Types

```typescript
// Original type
type FullProfile = {
  agentId: string;
  teamId: string;
  state: string;
  dialNumber: string;
  permissions: string[];
};

// Derived subset
type LoginInfo = Pick<FullProfile, 'agentId' | 'teamId' | 'dialNumber'>;
```

### Partial for Optional Updates

```typescript
type AgentUpdate = Partial<AgentProfile>;

// Usage: all fields optional
function updateAgent(update: AgentUpdate) {
  // Only specified fields will be updated
}
```

### Omit for Exclusion

```typescript
type PublicProfile = Omit<FullProfile, 'permissions' | 'internalId'>;
```

---

## Generic Patterns

### Type Parameter for Response Data

```typescript
// Generic request handler
async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  const response = await fetch(config.url);
  return response.json() as ApiResponse<T>;
}

// Usage with specific type
const result = await request<AgentData>(config);
// result.data is typed as AgentData
```

### Conditional Types (Advanced)

```typescript
// Used in event handling
type EventDataMap = {
  [CC_EVENTS.AGENT_LOGIN]: LoginData;
  [CC_EVENTS.AGENT_LOGOUT]: LogoutData;
  [CC_EVENTS.AGENT_STATE_CHANGE]: StateChangeData;
};

type EventData<T extends CC_EVENTS> = EventDataMap[T];
```

---

## JSDoc Patterns

### Public API Documentation

```typescript
/**
 * Logs the agent into their assigned station.
 *
 * @description
 * This method authenticates the agent and establishes their connection
 * to the Contact Center system. The agent must be registered before
 * calling this method.
 *
 * @param {AgentLogin} data - Login configuration
 * @param {string} data.teamId - Team to log into
 * @param {LoginOption} data.loginOption - Device type (BROWSER, EXTENSION, AGENT_DN)
 * @param {string} [data.dialNumber] - Required for EXTENSION/AGENT_DN
 *
 * @returns {Promise<StationLoginResponse>} Login result with session info
 *
 * @throws {Error} If login fails with reason in error.data.reason
 *
 * @fires agent:stationLoginSuccess When login succeeds
 * @fires agent:stationLoginFailed When login fails
 *
 * @public
 *
 * @example
 * ```typescript
 * // Browser-based login
 * const result = await cc.stationLogin({
 *   teamId: 'team-123',
 *   loginOption: 'BROWSER',
 * });
 *
 * // Extension-based login
 * const result = await cc.stationLogin({
 *   teamId: 'team-123',
 *   loginOption: 'EXTENSION',
 *   dialNumber: '1234',
 * });
 * ```
 */
public async stationLogin(data: AgentLogin): Promise<StationLoginResponse> {
  // Implementation
}
```

### Type Documentation

```typescript
/**
 * Configuration for agent login operation.
 *
 * @public
 */
export type AgentLogin = {
  /**
   * The team ID to log into.
   * Must be a valid team from the agent's profile.
   */
  teamId: string;

  /**
   * Device type for the login.
   * - BROWSER: WebRTC-based softphone
   * - EXTENSION: Desk phone extension
   * - AGENT_DN: Direct dial number
   */
  loginOption: LoginOption;

  /**
   * Phone number or extension.
   * Required when loginOption is EXTENSION or AGENT_DN.
   */
  dialNumber?: string;
};
```

---

## Async Patterns

### Standard Async/Await

```typescript
// Preferred pattern
public async fetchData(): Promise<Data> {
  try {
    const result = await this.service.getData();
    return result;
  } catch (error) {
    // Handle error
    throw error;
  }
}
```

### Promise Chaining (When Necessary)

```typescript
// Used in some initialization flows
this.$webex.once(READY, () => {
  this.services = Services.getInstance({...});
  
  this.services.webSocketManager
    .initWebSocket({body: config})
    .then((data) => {
      // Handle success
    })
    .catch((error) => {
      // Handle error
    });
});
```

---

## Type Guards

### Type Narrowing

```typescript
// Check for specific error type
function isFailure(error: unknown): error is {details: Failure} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'details' in error
  );
}

// Usage
if (isFailure(error)) {
  const failure = error.details;
  // TypeScript knows failure is Failure type
}
```

### Event Type Guards

```typescript
function isAgentEvent(event: CC_EVENTS): event is keyof typeof CC_AGENT_EVENTS {
  return Object.values(CC_AGENT_EVENTS).includes(event as any);
}
```
