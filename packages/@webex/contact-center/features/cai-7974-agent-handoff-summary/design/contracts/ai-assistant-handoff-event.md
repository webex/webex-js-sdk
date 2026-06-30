# Contract - AI Assistant Handoff Summary Events

> Belongs to [`feature-design.md`](../feature-design.md). Standing catalog: [`CONTRACTS.md`](../../../../ai-docs/CONTRACTS.md).

## Metadata
| Field | Value |
|---|---|
| Interface | AI Assistant `/event` handoff summary usage |
| Kind | network API / SDK transport |
| Change type | modify |
| Producer | `ApiAIAssistant` client |
| Consumer(s) | WCC AI Assistant service |
| Canonical schema / API source | `src/services/ApiAiAssistant.ts`; backend machine-readable schema not present in this repo |
| Feature | `../feature-design.md` |
| Generated from | `contract` @ SDLC template library `0.2.0` |

## Summary
Extends the existing AI Assistant `/event` helper so task flows can send `GET_MID_CALL_SUMMARY` and `MID_CALL_SUMMARY_RESPONSE` events with optional additional event details while preserving transcript `START`/`STOP` behavior.

## Definition
- **Canonical source:** `src/services/ApiAiAssistant.ts`
- **Inline definition if no canonical source exists:**

```ts
sendEvent(
  agentId: string,
  interactionId: string,
  eventType: AIAssistantEventType,
  eventName: AIAssistantEventName,
  action?: AIAssistantEventAction,
  eventData?: Record<string, unknown>
): Promise<Record<string, unknown>>
```

Body shape remains the existing `/event` envelope:

```ts
{
  agentId,
  orgId,
  eventType,
  eventName,
  eventDetails: {
    data: {
      interactionId,
      action?,          // present for transcript start/stop and handoff responses
      actionTimeStamp,
      ...eventData
    }
  }
}
```

## Error / Failure Catalog
| Condition | Code / signal | Meaning | Consumer action |
|---|---|---|---|
| WCC API gateway URL not mapped | `AI_ASSISTANT_BASE_URL_NOT_AVAILABLE` | AI Assistant base URL cannot be derived. | Treat as environment/service discovery failure. |
| `/event` request rejects | detailed SDK error | AI Assistant service rejected or network request failed. | Surface operation failure and allow retry when user action is retryable. |

## Backward Compatibility
- **Compatible?** yes - existing transcript callers still pass `START`/`STOP`; action is now optional for request events that do not need one.
- **Consumer transition / deprecation:** none.

## Delivery & Ordering Guarantees
- `/event` delivery follows existing Webex SDK request semantics. The SDK does not add retry, de-duplication, or ordering guarantees.

## Validation
- Unit tests in `test/unit/spec/services/ApiAiAssistant.ts` cover existing transcript body shape and optional event detail behavior.

## References
- Feature design: `../feature-design.md`
- Owning module spec: `../../../../src/services/ai-docs/ai-assistant-spec.md`
- Baseline: package SDD baseline.
