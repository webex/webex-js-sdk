# New Method - Requirements

> **Purpose**: Define requirements for the new method.

---

## Required Information

### 1. Method Identity

**Target File**: (e.g., `cc.ts`, `services/agent/index.ts`)

**Method Name**: (camelCase, e.g., `getTeamStats`)

**Purpose**: (One sentence description)

### 2. Method Signature

**Parameters**:
```typescript
type MethodParams = {
  requiredParam: string;
  optionalParam?: number;
};
```

**Return Type**:
```typescript
type MethodResponse = {
  data: {
    // response fields
  };
  trackingId?: string;
};
```

### 3. API Integration (if applicable)

**HTTP Method**: GET / POST / PUT / DELETE

**Endpoint**: `/v1/endpoint`

**Request Body** (for POST/PUT):
```typescript
{
  field: 'value'
}
```

### 4. Events (if applicable)

**Events to Emit**:
- Success: `event:nameSuccess`
- Failure: `event:nameFailed`

**Needs New Event Constants?** Yes/No

### 5. Metrics

**Metric Events Needed**:
- `OPERATION_SUCCESS`
- `OPERATION_FAILED`

**Needs New Metric Constants?** Yes/No

---

## Example: Adding getBuddyAgents

```
Target File: cc.ts
Method Name: getBuddyAgents
Purpose: Get list of available agents for consult/transfer

Parameters:
  type BuddyAgents = {
    state: string;
    mediaType: string;
  };

Return Type:
  type BuddyAgentsResponse = {
    data: {
      agentList: Agent[];
    };
    trackingId: string;
  };

HTTP Method: POST
Endpoint: /v1/agents/buddyList

Events: None (promise-based only)

Metrics:
  - FETCH_BUDDY_AGENTS_SUCCESS
  - FETCH_BUDDY_AGENTS_FAILED
```

---

## Next Step

Proceed to: [`02-implementation.md`](02-implementation.md)
