# New Service - Integration

> **Purpose**: Integrate the new service into the ContactCenter plugin.

---

## Integration Steps

### Step 1: Import in cc.ts

Add import at the top of `src/cc.ts`:

```typescript
import ServiceName from './services/ServiceName';
import type {ServiceListResponse, ServiceSearchParams} from './services/ServiceName';
```

### Step 2: Add Property

Add private/public property to ContactCenter class:

```typescript
export default class ContactCenter extends WebexPlugin implements IContactCenter {
  // ... existing properties
  
  /**
   * API instance for managing [service items]
   * Provides functionality to fetch items with caching support
   * @type {ServiceName}
   * @public
   * @example
   * ```typescript
   * const cc = webex.cc;
   * await cc.register();
   * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
   *
   * const response = await cc.serviceName.getItems({
   *   page: 0,
   *   pageSize: 50
   * });
   * ```
   */
  public serviceName: ServiceName;  // or private if internal only
```

### Step 3: Initialize in Constructor

In the `$webex.once(READY, ...)` block:

```typescript
this.$webex.once(READY, () => {
  // ... existing initialization
  
  // Initialize new service
  // Option A: Simple initialization
  this.serviceName = new ServiceName(this.$webex);
  
  // Option B: With dependency from agent profile
  this.serviceName = new ServiceName(
    this.$webex,
    () => this.agentConfig?.someProfileField
  );
});
```

### Step 4: Export Types (if public)

Add to `src/types.ts`:

```typescript
// Export public types
export type {
  ServiceItem,
  ServiceSearchParams,
  ServiceListResponse,
} from './services/ServiceName';
```

### Step 5: Add Wrapper Method (optional)

If you want a direct method on `cc`:

```typescript
/**
 * Fetches [items] for the organization.
 * Wrapper around internal ServiceName instance.
 *
 * @param {ServiceSearchParams} params - Search parameters
 * @returns {Promise<ServiceListResponse>} Paginated list
 * @public
 */
public async getItems(params: ServiceSearchParams = {}): Promise<ServiceListResponse> {
  return this.serviceName.getItems(params);
}
```

---

## Verification

After integration, verify:

```typescript
// Should compile without errors
const cc = webex.cc;
await cc.register();
await cc.stationLogin({ teamId: 'team', loginOption: 'BROWSER' });

// Access service
const result = await cc.serviceName.getItems();
```

---

## Next Step

Proceed to: [`04-test-generation.md`](04-test-generation.md)
