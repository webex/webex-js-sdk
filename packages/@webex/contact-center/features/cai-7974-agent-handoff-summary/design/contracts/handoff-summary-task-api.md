# Contract - Handoff Summary Task API

> Belongs to [`feature-design.md`](../feature-design.md). Standing catalog: [`CONTRACTS.md`](../../../../ai-docs/CONTRACTS.md).

## Metadata
| Field | Value |
|---|---|
| Interface | Handoff Summary Task API |
| Kind | SDK public API / event |
| Change type | new |
| Producer | `src/services/task/index.ts`, `src/services/task/types.ts` |
| Consumer(s) | SDK consumers/widgets |
| Canonical schema / API source | TypeScript source and generated TypeDoc/API report |
| Feature | `../feature-design.md` |
| Generated from | `contract` @ SDLC template library `0.2.0` |

## Summary
Adds task-level helpers and events so consumers can request a mid-call handoff summary, receive backend summary payloads, and respond with a typed handoff action.

## Definition
- **Canonical source:** `src/services/task/index.ts`, `src/services/task/types.ts`
- **Inline definition if no canonical source exists:**

```ts
type HandoffSummaryAction = 'CANCEL' | 'CONSULT' | 'TRANSFER';

type HandoffSummaryRequestPayload = {
  interactionId?: string;
  eventData?: Record<string, unknown>;
};

type HandoffSummaryResponsePayload = {
  action: HandoffSummaryAction;
  interactionId?: string;
  eventData?: Record<string, unknown>;
};

interface ITask {
  requestHandoffSummary(payload?: HandoffSummaryRequestPayload): Promise<Record<string, unknown>>;
  respondToHandoffSummary(payload: HandoffSummaryResponsePayload): Promise<Record<string, unknown>>;
}
```

## Error / Failure Catalog
| Condition | Code / signal | Meaning | Consumer action |
|---|---|---|---|
| Feature flag absent or false | rejected promise / task error | Generated consult-transfer summaries are not enabled for this agent/session. | Do not show summary request affordance; wait for config or enablement update. |
| AI Assistant service missing | rejected promise / task error | SDK cannot resolve AI Assistant transport. | Treat as transient setup/config failure and surface fallback UI. |
| AI Assistant `/event` request fails | rejected promise from helper | Backend rejected or transport failed. | Follow existing SDK error handling and retry policy for user action. |

## Backward Compatibility
- **Compatible?** yes - additive public helpers/events; no existing task method or event is removed.
- **Consumer transition / deprecation:** no deprecation. Consumers opt into new helpers/events.

## Delivery & Ordering Guarantees
- Task events are emitted from existing WCC websocket message processing. Ordering is the same as the websocket stream order observed by `TaskManager`.
- No replay or exactly-once guarantee is added by the SDK.

## Validation
- Unit tests in `test/unit/spec/services/task/index.ts` cover helper request/response behavior.
- Unit tests in `test/unit/spec/services/task/TaskManager.ts` cover emitted task events.

## References
- Feature design: `../feature-design.md`
- Owning module spec: `../../../../src/services/task/ai-docs/task-lifecycle-spec.md`
- Baseline: package SDD baseline.
