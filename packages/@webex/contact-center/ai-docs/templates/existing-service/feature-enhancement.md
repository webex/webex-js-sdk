# Feature Enhancement Template

> **Purpose**: Workflow for adding new features to existing services.

---

## Step 0: Feature Placement Triage (MANDATORY)

**STOP. Before any implementation, present these triage questions to the developer and wait for answers.**

> **Note:** If you arrived here via **Type F (Modify Existing Method)** from the root [`AGENTS.md`](../../../AGENTS.md), skip this Step 0 entirely — the method already exists in an existing service. Jump to Step 0B (Pre-Enhancement Questions).

### Triage Questions — Always Ask These (All Mandatory)

> **All 6 questions must be answered before proceeding.** If the developer is unsure about a question, help them reason through it using the decision signals below. Do not skip questions or infer answers — each one informs the placement decision.

1. **"Does this feature fit within the responsibility of an existing service, or does it introduce a new domain/responsibility?"**

2. **"Do you expect this feature to grow into multiple related methods in future iterations?"**

3. **"Should this feature have independent ownership (its own state, events, dependencies) separate from current services?"**

4. **"Is there an existing service you want to add this to? Or should it be a new standalone service/module?"**

5. **"Are there backward compatibility constraints if we add this to an existing service?"**

6. **"If this becomes a new service, do you have a preferred name for it?"**

### Triage Decision Guide

After the developer answers, use these signals to decide placement:

**Existing service** when:
- Feature naturally extends current service responsibility
- Only 1-2 methods are needed in the same domain
- Existing service already owns required events/state/API integration
- Developer explicitly says "add it to [service]"

**New service** when:
- Feature introduces a distinct domain boundary/responsibility
- It needs its own lifecycle/dependencies/state orchestration
- It is expected to grow into multiple related methods/classes
- Adding it to an existing service would create low cohesion or cross-domain coupling
- Developer explicitly wants a standalone module

### Routing Rule

- If triage => **existing service**: continue with this template (Step 0B below).
- If triage => **new service**: switch to [`../new-service/00-master.md`](../new-service/00-master.md).
- If still unclear after developer answers: ask one more clarifying question rather than guessing.

---

## Step 0B: Pre-Enhancement Questions (MANDATORY)

**Present these questions to the developer and wait for answers.** Do not start designing or implementing until all MANDATORY fields have explicit answers.

### 1. Feature Definition (MANDATORY)

7. **"What is this feature called? (Brief name)"**

8. **"What does this feature do? Describe the expected behavior."**

9. **"When would a developer use this feature? What is the use case?"**

### 2. Scope and Placement (MANDATORY)

10. **"Which existing files will be affected?"**
    - [ ] `cc.ts` (main plugin)
    - [ ] `services/[name]/index.ts`
    - [ ] `types.ts`
    - [ ] Other: ___

11. **"Will this introduce any breaking changes to existing APIs?"**
    - If yes: "What is the migration path?"

### 3. API Contract (MANDATORY)

For each new or updated API call, ask:

12. **"What API endpoint does this feature call? Provide:"**

    | Field | What to Ask |
    |---|---|
    | HTTP Method | "Is this a GET, POST, PUT, PATCH, or DELETE?" |
    | Endpoint | "What is the full resource path?" |
    | Request Payload | "What fields does the request contain? Which are required vs optional?" |
    | Response Structure | "What does the response look like? (`data`, `trackingId`, metadata)" |
    | Error Shape | "What error reason codes can this return?" |

    **If any field is unknown, STOP and ask the developer. Do not guess.**

### 4. Event Contract (MANDATORY if the feature uses events, otherwise skip)

13. **"Does this feature emit or listen to any events?"**
    - If YES, for each event ask:

    | Field | What to Ask |
    |---|---|
    | Event Name | "What is the event name?" |
    | Direction | "Is this incoming (WebSocket) or outgoing (emitted by SDK)?" |
    | Emitted/Received On | "On which object is this event emitted or received?" (`cc`, `task`, `taskManager`, or a service instance) |
    | Payload Type/Shape | "What data does the event carry?" |
    | Emitted From | "Which class/file emits this event?" |
    | Emission Trigger | "What causes this event to fire?" |

    - If NO: note "No events"

### 5. Dependencies (MANDATORY)

14. **"Does this feature require new API endpoints that don't exist yet?"**

15. **"Does this feature require new types?"**
    - If yes: "What should the type names be?"

### Completion Gate

**Before proceeding, verify:**

- [ ] Feature name and description provided by developer
- [ ] Use case described
- [ ] Placement decision confirmed (existing service or new service)
- [ ] Affected files identified
- [ ] Breaking changes assessed
- [ ] API contract fully specified (or developer confirmed no new API calls)
- [ ] Event contract captured (or developer confirmed no events)
- [ ] Dependencies identified

**If any MANDATORY field is missing, ask a follow-up question. Do not proceed.**

---

## Spec Summary (MANDATORY — present before implementation)

Once all questions are answered, present this summary to the developer:

```
## Spec Summary — Feature Enhancement

**Feature**: [name]
**Description**: [what it does]
**Use case**: [when a developer would use this]
**Placement**: [existing service name] (or rerouted to new service)
**Breaking changes**: [Yes/No — details if yes]

### Affected Files:
1. [file path] — [what changes]
2. [file path] — [what changes]

### API Contract:
| Method | HTTP | Endpoint | Request | Response |
|---|---|---|---|---|
| [method] | [verb] | [path] | [payload] | [response] |
(or "No new API calls")

### Events:
| Event | Direction | Object | Payload | Trigger |
|---|---|---|---|---|
| [event] | [in/out] | [object] | [payload] | [trigger] |
(or "No events")

### New Types: [list or "None"]
### New Constants: [list or "None"]

---
Does this match your intent? (Yes / No / Adjust)
```

**Wait for developer approval. Do not proceed to implementation until confirmed.**

---

## Step 1: Design the Feature

Define the public API contract and data flow before writing any implementation code.

### API Design

Define the public interface:

```typescript
/**
 * What the feature does
 * @param params - Description
 * @returns Description
 */
async featureName(params: FeatureParams): Promise<FeatureResponse>
```

### Data Flow

```
User calls cc.featureName(params)
    |
    v
Validate input
    |
    v
Call service/API
    |
    v
Process response
    |
    v
Return/emit result
```

---

## Step 2: Update Types

### Add New Types

In appropriate types file:

```typescript
/**
 * Parameters for feature operation
 * @public
 */
export type FeatureParams = {
  /** Description */
  field: string;
};

/**
 * Response from feature operation
 * @public
 */
export type FeatureResponse = {
  /** Description */
  data: FeatureData;
};
```

### Export Types

In `src/types.ts`:

```typescript
export type {FeatureParams, FeatureResponse} from './services/[location]';
```

---

## Step 3: Implement Feature

### Service Layer (if needed)

Add method to existing service:

```typescript
// In services/[name]/index.ts
featureMethod: routing.req((p: {data: FeatureParams}) => ({
  url: '/v1/feature',
  host: WCC_API_GATEWAY,
  data: p.data,
  err: createErrDetailsObject,
  method: HTTP_METHODS.POST,
  notifSuccess: {
    bind: {type: CC_EVENTS.FEATURE_SUCCESS, data: {type: CC_EVENTS.FEATURE_SUCCESS}},
    msg: {} as FeatureResponse,
  },
  notifFail: {
    bind: {type: CC_EVENTS.FEATURE_FAILED, data: {type: CC_EVENTS.FEATURE_FAILED}},
    errId: 'Service.aqm.feature.failed',
  },
})),
```

### Public API Layer — if the feature is exposed to consumers

> **Determine the owning object.** Public methods are added to the object that owns the feature's scope. Currently the SDK exposes:
> - **`cc`** (in `cc.ts`) — SDK-level operations (e.g., `cc.stationLogin()`, `cc.setAgentState()`)
> - **`task`** (in `Task.ts`) — per-interaction operations (e.g., `task.hold()`, `task.transfer()`, `task.end()`)
>
> New public objects may be introduced in the future. If the feature is internal to a service or only consumed by other services, skip this step entirely.

Add public method:

```typescript
/**
 * Feature description.
 *
 * @param {FeatureParams} params - Parameters
 * @returns {Promise<FeatureResponse>} Result
 * @throws {Error} If operation fails
 *
 * @public
 *
 * @example
 * ```typescript
 * const result = await cc.featureName({
 *   field: 'value',
 * });
 * ```
 */
public async featureName(params: FeatureParams): Promise<FeatureResponse> {
  LoggerProxy.info('Starting feature operation', {
    module: CC_FILE,
    method: METHODS.FEATURE_NAME,
  });

  try {
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.FEATURE_SUCCESS,
      METRIC_EVENT_NAMES.FEATURE_FAILED,
    ]);

    const result = await this.services.someService.featureMethod({
      data: params,
    });

    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.FEATURE_SUCCESS,
      {...MetricsManager.getCommonTrackingFieldForAQMResponse(result)},
      ['behavioral', 'operational']
    );

    LoggerProxy.log('Feature operation completed successfully', {
      module: CC_FILE,
      method: METHODS.FEATURE_NAME,
      trackingId: result.trackingId,
    });

    return result;
  } catch (error) {
    const failure = error.details as Failure;
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.FEATURE_FAILED,
      {...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure)},
      ['behavioral', 'operational']
    );
    const {error: detailedError} = getErrorDetails(error, METHODS.FEATURE_NAME, CC_FILE);
    throw detailedError;
  }
}
```

---

## Step 4: Add Constants

### Method Constants

```typescript
// src/constants.ts
export const METHODS = {
  // ... existing
  FEATURE_NAME: 'featureName',
} as const;
```

### Metric Constants

```typescript
// src/metrics/constants.ts
export const METRIC_EVENT_NAMES = {
  // ... existing
  FEATURE_SUCCESS: 'feature success',
  FEATURE_FAILED: 'feature failed',
} as const;
```

### Event Constants (if needed)

```typescript
// services/config/types.ts
export const CC_FEATURE_EVENTS = {
  FEATURE_SUCCESS: 'FeatureSuccess',
  FEATURE_FAILED: 'FeatureFailed',
} as const;
```

---

## Step 5: Update Tests

### Add Feature Tests

```typescript
describe('cc.featureName', () => {
  const mockParams = {
    field: 'value',
  };

  const mockResponse = {
    data: { /* ... */ },
    trackingId: 'track-123',
  };

  it('should complete feature operation successfully', async () => {
    mockServicesInstance.someService.featureMethod.mockResolvedValue(mockResponse);

    const result = await webex.cc.featureName(mockParams);

    expect(result).toEqual(mockResponse);
  });

  it('should handle errors correctly', async () => {
    mockServicesInstance.someService.featureMethod.mockRejectedValue(mockError);

    await expect(webex.cc.featureName(mockParams)).rejects.toThrow();
  });
});
```

---

## Step 6: Update Documentation

### Update Service-Level Docs

If the affected service has ai-docs, update them (find the right file via the root [`AGENTS.md` Service Routing Table](../../../AGENTS.md#service-routing-table)):
- Service `AGENTS.md` — add new method to API reference, add usage example
- Service `ARCHITECTURE.md` — update data flow if architecture changed

### Update Root AGENTS.md

If feature is significant, update the root [`AGENTS.md`](../../../AGENTS.md):
- Add to relevant section
- Update examples if needed

---

## Validation Checklist

- [ ] Types defined with JSDoc
- [ ] Types exported from `src/types.ts`
- [ ] Method implemented following patterns
- [ ] LoggerProxy used throughout
- [ ] MetricsManager tracking added
- [ ] Error handling follows pattern
- [ ] Constants added (methods, metrics, events)
- [ ] Unit tests added
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Documentation updated

```bash
yarn workspace @webex/contact-center test:style
yarn workspace @webex/contact-center test:unit
yarn workspace @webex/contact-center build:src
```

---

## Complete!

Feature enhancement is complete when all checkboxes are checked.
