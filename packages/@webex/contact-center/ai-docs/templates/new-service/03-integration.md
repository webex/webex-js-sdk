# New Service - Integration

> **Purpose**: Integrate the new service into the SDK based on its placement decision.

---

## Choose Integration Path

Based on the placement decision from pre-questions (Q3):

| Placement | Integration point | Types location | Constants location |
|---|---|---|---|
| **Folder-based** | `cc.ts` or `Services` singleton | Service folder's `types.ts` | Service folder's `constants.ts` |
| **Single-file** | `cc.ts` directly | Root `src/types.ts` | `src/services/constants.ts` |
| **Sub-module** | Parent service | Parent's `types.ts` | Parent's `constants.ts` |

---

## Path A: Folder-Based Service Integration

Study how existing folder-based services are wired in:
- **AQM services** (`agent`, `contact`, `dialer`): instantiated via the `Services` singleton in `src/services/index.ts`
- **Config service**: instantiated in `Services` singleton as `AgentConfigService`
- **Non-AQM services**: can be instantiated directly in `cc.ts`

### Step A1: If AQM-based — add to Services singleton

In `src/services/index.ts`:

```typescript
import routingServiceName from './ServiceName';

export default class Services {
  public readonly serviceName: ReturnType<typeof routingServiceName>;

  constructor(options: {...}) {
    // ... existing initialization
    this.serviceName = routingServiceName(aqmReq);
  }
}
```

Then access via `this.services.serviceName` from `cc.ts`.

### Step A2: If non-AQM — instantiate in cc.ts

```typescript
import ServiceName from './services/ServiceName';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  public serviceName: ServiceName;  // or private if internal (Q7)

  // In $webex.once(READY, ...) block:
  this.serviceName = new ServiceName(this.$webex);
}
```

### Step A3: Export types (if public — Q7)

Types stay in the service folder's `types.ts`. Re-export from `src/types.ts`:

```typescript
// src/types.ts
export type {ServiceResponse, ServiceRequest} from './services/ServiceName/types';
```

---

## Path B: Single-File Service Integration

Follow the exact pattern of `AddressBook`, `EntryPoint`, `Queue`:

### Step B1: Import and add property in cc.ts

```typescript
import ServiceName from './services/ServiceName';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  /**
   * [Service purpose — from Q2]
   * @type {ServiceName}
   * @public
   */
  public serviceName: ServiceName;
```

### Step B2: Initialize in constructor

In the `$webex.once(READY, ...)` block:

```typescript
this.$webex.once(READY, () => {
  // ... existing initialization

  this.serviceName = new ServiceName(this.$webex);

  // If service needs profile dependency (Q6):
  // this.serviceName = new ServiceName(
  //   this.$webex,
  //   () => this.agentConfig?.someProfileField
  // );
});
```

### Step B3: Types already in src/types.ts

Since single-file service types are defined in `src/types.ts` (Step 1 of code generation), they're already available to consumers. No separate re-export needed.

---

## Path C: Sub-Module Integration

### Step C1: Instantiate in parent service

In the parent service file (e.g., `TaskManager.ts`):

```typescript
import ServiceName from './ServiceName';

// As a property
private serviceName: ServiceName;

// In constructor or init method
this.serviceName = new ServiceName(this.webex);
```

### Step C2: Expose through parent if needed

If the sub-module's methods should be callable through the parent service:

```typescript
public async methodThatUsesSubModule(data: SomeType): Promise<SomeResponse> {
  return this.serviceName.methodOne(data);
}
```

### Step C3: Types in parent's types.ts

Since sub-module types are defined in the parent's `types.ts` (from code generation), they're already available. Re-export from `src/types.ts` if the sub-module is public.

---

## Add Metric Event Names

For all placement types, add new metric events to `src/metrics/constants.ts`:

```typescript
export const METRIC_EVENT_NAMES = {
  // ... existing events
  METHOD_ONE_SUCCESS: 'method one success',
  METHOD_ONE_FAILED: 'method one failed',
} as const;
```

---

## Verification

After integration, verify:

```typescript
// For public top-level / single-file service:
const cc = webex.cc;
await cc.register();
const result = await cc.serviceName.methodOne(params);

// For AQM service accessed through Services:
// Verify through cc.ts methods that delegate to this.services.serviceName

// For sub-module:
// Verify through parent service's API or internal tests
```

---

## Next Step

Proceed to: [`04-test-generation.md`](04-test-generation.md)
