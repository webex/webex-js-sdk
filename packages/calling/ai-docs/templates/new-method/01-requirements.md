# New Method - Requirements Questionnaire

> **Purpose**: Gather all required information before implementing a new method.

---

## MANDATORY Questions (must have answers before coding)

### A. Method Identity

1. **Method name**: What should the method be called? (camelCase)
2. **Target module**: Which module does this belong to? (CallingClient, Call, Line, CallHistory, CallSettings, Contacts, Voicemail, etc.)
3. **Target file**: Which file will contain this method?
4. **Visibility**: Is this public (on the interface) or private/internal?

### B. Method Signature

5. **Parameters**: List each parameter with name, type, and whether it's required or optional.
6. **Return type**: What does the method return? (`void`, `Promise<T>`, specific type, etc.)
7. **Async**: Is this method async? (Does it make API calls or await other async operations?)

### C. API Integration (if applicable)

8. **HTTP method**: GET, POST, PATCH, PUT, DELETE?
9. **Endpoint**: What Mobius/backend URL path? (e.g., `/calling/web/devices`)
10. **Request body**: What is the request payload structure?
11. **Response body**: What is the response payload structure?
12. **Authentication**: Uses `addAuthHeader: true`? Custom headers?

### D. Events (if applicable)

13. **Events emitted**: Does this method emit any events? List each with:
    - Event key enum (e.g., `CALL_EVENT_KEYS.NEW_EVENT`)
    - Payload type
    - When it's emitted (success, failure, state change)
14. **New event keys needed**: Do you need to add new entries to event key enums?

### E. Metrics

15. **Success metric**: What `METRIC_EVENT` should be submitted on success?
16. **Failure metric**: What `METRIC_EVENT` should be submitted on failure?
17. **Metric type**: `OPERATIONAL` or `BEHAVIORAL`?
18. **New metric events needed**: Do you need to add new `METRIC_EVENT` entries?

### F. Error Handling

19. **Error class**: Which error class? (`CallError`, `LineError`, `CallingClientError`)
20. **Error scenarios**: List each error condition and the `ERROR_TYPE` to use.

### G. Behavior

21. **Preconditions**: What state must exist before this method can be called? (e.g., line must be registered, call must be connected)
22. **Side effects**: Does this method modify state, start timers, or affect other components?
23. **Concurrency**: Does this need mutex serialization? (e.g., registration operations use `async-mutex`)

---

## OPTIONAL Questions

24. **Backend support**: Does this work across all backends (WXC, UCM, BroadWorks) or only specific ones?
25. **State machine impact**: Does this affect the call state machine or ROAP state machine?
26. **Related methods**: Are there existing methods this is similar to? (Use as reference implementation)
27. **Breaking changes**: Does this change any existing public API surface?

---

## Output: Requirements Summary

After gathering answers, produce this summary before proceeding:

```
## Method Requirements Summary

**Method**: `moduleName.methodName(params): ReturnType`
**Module**: [module name]
**File**: [file path]
**Visibility**: [public/private]

### API Contract (if applicable)
- HTTP: [METHOD] [endpoint]
- Request: [structure]
- Response: [structure]

### Events (if applicable)
| Event Key | Payload | Trigger |
|---|---|---|
| [key] | [type] | [when] |

### Metrics
- Success: [METRIC_EVENT value]
- Failure: [METRIC_EVENT value]

### Error Handling
| Condition | ERROR_TYPE | Error Class |
|---|---|---|
| [condition] | [type] | [class] |

### Preconditions
- [list preconditions]

Confirmed? (Yes / Adjust)
```
