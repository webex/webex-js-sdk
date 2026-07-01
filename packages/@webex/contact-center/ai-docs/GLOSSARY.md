# Glossary - @webex/contact-center

| Term | Meaning | Code location |
|---|---|---|
| AQM | Agent Queue Management request/notification path used for agent and task operations | `src/services/core/aqm-reqs.ts`, `src/services/agent/index.ts`, `src/services/task/contact.ts` |
| ContactCenter | Main SDK plugin facade exposed as `webex.cc` | `src/cc.ts`, `src/index.ts` |
| CC_EVENTS | WCC event bridge enum used by agent/task/config flows | `src/services/config/types.ts` |
| TASK_EVENTS | SDK task EventEmitter event enum | `src/services/task/types.ts` |
| AGENT_EVENTS | SDK agent EventEmitter event enum | `src/services/agent/types.ts` |
| Task | Client-side representation of an active contact/task interaction | `src/services/task/index.ts` |
| TaskManager | Maintains active tasks and routes incoming WCC events to SDK task events | `src/services/task/TaskManager.ts` |
| WebSocketManager | Subscribes to WCC realtime endpoint and emits parsed events | `src/services/core/websocket/WebSocketManager.ts` |
| ConnectionService | Tracks connection-loss and online/offline signals | `src/services/core/websocket/connection-service.ts` |
| PageCache | In-memory cache for paginated lookup APIs | `src/utils/PageCache.ts` |
| Web Calling | Browser calling integration through `@webex/calling` | `src/services/WebCallingService.ts` |
| AI Assistant | WCC AI Assistant events and historic transcript API | `src/services/ApiAiAssistant.ts` |
| Handoff summary | Generated mid-call summary used during consult/transfer handoff flows | `src/services/task/index.ts`, `src/services/task/TaskManager.ts` |
| FEATURE_ENABLEMENT | Optional backend event carrying runtime AI feature enablement state such as `consultTransferSummariesEnabled` | `src/services/config/types.ts`, `src/services/task/TaskManager.ts` |
| Wrapup | Post-contact completion/disposition state and payload | `src/services/task/index.ts`, `src/services/config/types.ts` |
| Campaign preview | Dialer preview reservation flow for accept/skip/remove | `src/cc.ts`, `src/services/task/dialer.ts`, `src/services/task/types.ts` |
| Relogin | Automated or explicit agent session recovery after connection/session disruption | `src/cc.ts`, `src/services/agent/index.ts` |
| Tracking fields | Response identifiers captured for metrics/diagnostics | `src/metrics/MetricsManager.ts`, `src/services/core/Utils.ts` |
