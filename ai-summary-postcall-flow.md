# AI Post-Call Summary Flow

This companion view follows the implemented post-call path. The authoritative
contract is `ai-summary.md`, which is synchronized to
`design/default/design_spec.md`.

## Component Map

```mermaid
flowchart LR
  App[Consumer application]
  Task[Task]
  Coord[AISummaryCoordinator]
  API[ApiAIAssistant]
  Backend[api-ai-assistant]
  RTD[Realtime websocket]
  TM[TaskManager]

  App -->|requestPostCallSummary| Task
  Task -->|register POST_CALL_SUMMARY by conversationId| Coord
  Task -->|sendSummaryGetEvent| API
  API -->|POST /event| Backend
  Backend --> RTD
  RTD --> TM
  TM -->|resolve pending result| Coord
  Coord -->|Promise payload| Task
  Task --> App
  App -->|wrapup first| Task
  App -->|sendPostCallSummaryResponse| Task
  Task --> API
```

There is no public `task:postCallSummary` completion event in this SDK slice.
The initiating consumer receives the summary through the returned Promise.

## Happy Path

```mermaid
sequenceDiagram
  actor App
  participant Task
  participant Coord as AISummaryCoordinator
  participant API as ApiAIAssistant
  participant Backend
  participant TM as TaskManager

  App->>Task: requestPostCallSummary()
  Task->>Task: read current org flags and feature snapshot
  alt wrapUpSummariesEnabled !== true or postCallEnabled !== true
    Task-->>App: reject POST_CALL_SUMMARY_DISABLED
  else enabled
    Task->>Task: capture {conversationId, interactionId}
    Task->>Coord: register POST_CALL_SUMMARY
    Coord-->>Task: {requestToken, result}
    Task->>API: sendSummaryGetEvent(GET_POST_CALL_SUMMARY)
    Task->>Task: Promise.all(result, acknowledgement)
    API->>Backend: POST /event
    Backend-->>API: 2xx acknowledgement
    Backend->>TM: RTD POST_CALL_SUMMARY
    TM->>Coord: resolve by conversationId + POST_CALL_SUMMARY
    Coord-->>Task: summary payload
    Task-->>App: resolve summary payload
    App->>Task: wrapup(...)
    Task-->>App: wrap-up completed
    App->>Task: sendPostCallSummaryResponse(payload)
    Task->>API: sendSummaryResponseEvent(POST_CALL_SUMMARY_RESPONSE)
    API->>Backend: POST /event
    Backend-->>API: 2xx acknowledgement
    Task-->>App: resolve void
  end
```

The existing wrap-up API runs before the advisory summary response. A summary
request rejection must not block wrap-up.

## IGNORED Branch

When the feature is enabled (`postCallEnabled === true`) but no summary was ever
requested — for example, the feature flag arrived after wrapup was already
initiated — the application must send `sendPostCallSummaryResponse` with `state:
'IGNORED'`, `summary: ''`, all counters at zero, and the actual `wrapUpCode`
before completing wrapup.

## Contract References

This page owns the post-call sequence only. The canonical contract defines the
rules used at each step:

- [Feature Enablement](./ai-summary.md#feature-enablement) — organization and
  interaction gating.
- [Correlation](./ai-summary.md#correlation) and
  [Lifecycle](./ai-summary.md#lifecycle) — request-time identifiers, retained
  response context, and cleanup.
- [Request Coordination](./ai-summary.md#request-coordination) — overlap,
  cancellation tokens, timeout, and ownership.
- [Response Payload Rules](./ai-summary.md#response-payload-rules) and
  [Transport](./ai-summary.md#transport) — response branches, counters,
  timestamps, and wire-key omission.
- [Metrics And Privacy](./ai-summary.md#metrics-and-privacy) — final outcomes,
  recovery, and sensitive-data exclusions.
