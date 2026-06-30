# Service State - @webex/contact-center

## Current As-Built Registry
| Surface / component | Current state | Owner doc |
|---|---|---|
| Package export map | `.` exports `dist/webex.js` and `dist/types/index.d.ts`; `./package` exports package metadata | [Contracts](CONTRACTS.md) |
| `webex.cc` plugin | registered in `src/index.ts` with config from `src/config.ts` | [Plugin spec](../src/ai-docs/contact-center-plugin-spec.md) |
| Agent operations | AQM-backed station login/logout/state/buddy agents through `routingAgent` | [Agent spec](../src/services/agent/ai-docs/agent-session-spec.md) |
| Task operations | Task methods plus contact/dialer route builders and generated handoff summary helpers/events | [Task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) |
| Realtime connection | WCC WebSocket subscription, keepalive worker, connection-loss events | [Core spec](../src/services/core/ai-docs/realtime-request-core-spec.md) |
| Config lookup | Profile/config fetches plus address book, entry point, queue, outdial ANI | [Config spec](../src/services/config/ai-docs/configuration-lookup-apis-spec.md) |
| Web Calling | Web Calling registration and media/call task mapping | [Web Calling spec](../src/services/ai-docs/web-calling-spec.md) |
| AI Assistant | event send for transcripts and generated handoff summaries plus historic transcript fetch | [AI Assistant spec](../src/services/ai-docs/ai-assistant-spec.md) |
| Metrics/logging | singleton metrics manager, taxonomy, logger proxy | [Metrics spec](../src/metrics/ai-docs/metrics-observability-spec.md) |

## Runtime State Inventory
| State | Owner | Lifetime |
|---|---|---|
| profile and config | `ContactCenter` | register until deregister/update |
| WebSocket subscription | `WebSocketManager` | register until close/deregister/recovery |
| pending AQM promises | `AqmReqs` | request until notification, cancel, failure, or timeout |
| active tasks | `TaskManager` | task assignment until cleanup/removal |
| task data snapshots | `Task` | task lifetime |
| page lookup cache | `PageCache` | 5 minute default TTL or clear |
| call-to-task map | `WebCallingService` | call/task lifetime |
| AI feature flags | `ApiAIAssistant` | register/update until changed by config or feature enablement event |
| pending metrics queues | `MetricsManager` | until metrics plugin submit |

## Known Bootstrap Gaps
- No package-owned datastore or migration files were found.
- No native OpenAPI/AsyncAPI schemas were found in package scope.
- Independent two-runtime spec validation has not been run by this Codex generation pass.
