# Contracts Catalog - @webex/contact-center

> Public-surface index for the package. Detailed behavior lives in owning module specs and TypeDoc generated from `src/index.ts`.

## Exported API & Types
| Contract ID | Owner | Symbol | Signature / shape | Stability / deprecation | Detail link | Defined at |
|---|---|---|---|---|---|---|
| `cc.package.default` | `src/` | default export | `ContactCenter` | public package surface | [plugin spec](../src/ai-docs/contact-center-plugin-spec.md) | `src/index.ts` |
| `cc.package.ContactCenter` | `src/` | `ContactCenter` | class export | public package surface | [plugin spec](../src/ai-docs/contact-center-plugin-spec.md) | `src/index.ts`, `src/cc.ts` |
| `cc.package.Task` | `src/services/task/` | `Task` | class export | public package surface | [task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) | `src/index.ts`, `src/services/task/index.ts` |
| `cc.package.routingAgent` | `src/services/agent/` | `routingAgent` | route factory | exported; treat as compatibility-sensitive | [agent spec](../src/services/agent/ai-docs/agent-session-spec.md) | `src/index.ts`, `src/services/agent/index.ts` |
| `cc.package.AddressBook` | lookup APIs | `AddressBook` | class export | public package surface | [config/lookup spec](../src/services/config/ai-docs/configuration-lookup-apis-spec.md) | `src/index.ts`, `src/services/AddressBook.ts` |
| `cc.package.ApiAIAssistant` | AI Assistant | `ApiAIAssistant` | class export | public package surface | [AI Assistant spec](../src/services/ai-docs/ai-assistant-spec.md) | `src/index.ts`, `src/services/ApiAiAssistant.ts` |
| `cc.events.task` | task | `TASK_EVENTS` | enum of `task:*` events | additive events are compatible; renames/removals are breaking | [task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) | `src/services/task/types.ts` |
| `cc.task.handoffSummary` | task | `HANDOFF_SUMMARY_ACTION`, `HandoffSummary*` payload/action types, `Task.requestHandoffSummary`, `Task.respondToHandoffSummary` | generated handoff summary request/response API | additive public task API and types | [handoff task contract](../features/cai-7974-agent-handoff-summary/design/contracts/handoff-summary-task-api.md) | `src/index.ts`, `src/services/task/index.ts`, `src/services/task/types.ts` |
| `cc.events.agent` | agent | `AGENT_EVENTS` | enum of `agent:*` events | additive events are compatible; renames/removals are breaking | [agent spec](../src/services/agent/ai-docs/agent-session-spec.md) | `src/services/agent/types.ts` |
| `cc.events.config` | config/task/agent bridge | `CC_EVENTS`, `CC_TASK_EVENTS`, `CC_AGENT_EVENTS` | WCC event enum bridge | compatibility-sensitive because TaskManager maps these | [task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) | `src/services/config/types.ts` |
| `cc.types` | package | exported TypeScript types | agent, task, config, lookup, SDK interfaces | generated declaration output is public | TypeDoc and owning specs | `src/index.ts`, `src/types.ts`, module `types.ts` files |

## ContactCenter Public Methods
| Contract ID | Owner | Method | Purpose | Detail link | Defined at |
|---|---|---|---|---|---|
| `cc.register` | plugin facade | `register(): Promise<Profile>` | initialize config/services/WebSocket/task/calling/metrics state | [plugin spec](../src/ai-docs/contact-center-plugin-spec.md) | `src/cc.ts` |
| `cc.deregister` | plugin facade | `deregister(): Promise<void>` | clean up registration/session resources | [plugin spec](../src/ai-docs/contact-center-plugin-spec.md) | `src/cc.ts` |
| `cc.stationLogin` | agent | `stationLogin(data)` | login agent to station/device type | [agent spec](../src/services/agent/ai-docs/agent-session-spec.md) | `src/cc.ts`, `src/services/agent/index.ts` |
| `cc.stationLogout` | agent | `stationLogout(data)` | logout agent | [agent spec](../src/services/agent/ai-docs/agent-session-spec.md) | `src/cc.ts`, `src/services/agent/index.ts` |
| `cc.setAgentState` | agent | `setAgentState(data)` | change availability/aux state | [agent spec](../src/services/agent/ai-docs/agent-session-spec.md) | `src/cc.ts`, `src/services/agent/index.ts` |
| `cc.getBuddyAgents` | agent | `getBuddyAgents(data)` | fetch buddy agents by profile/media/state filter | [agent spec](../src/services/agent/ai-docs/agent-session-spec.md) | `src/cc.ts`, `src/services/agent/index.ts` |
| `cc.startOutdial` | task/dialer | `startOutdial(data)` | initiate outbound task/call | [task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) | `src/cc.ts`, `src/services/task/dialer.ts` |
| `cc.acceptPreviewContact` | task/dialer | `acceptPreviewContact(data)` | accept campaign preview reservation | [task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) | `src/cc.ts`, `src/services/task/dialer.ts` |
| `cc.skipPreviewContact` | task/dialer | `skipPreviewContact(data)` | skip campaign preview contact | [task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) | `src/cc.ts`, `src/services/task/dialer.ts` |
| `cc.removePreviewContact` | task/dialer | `removePreviewContact(data)` | remove campaign preview contact | [task spec](../src/services/task/ai-docs/task-lifecycle-spec.md) | `src/cc.ts`, `src/services/task/dialer.ts` |
| `cc.getOutdialAniEntries` | config | `getOutdialAniEntries(params)` | fetch outdial ANI options | [config spec](../src/services/config/ai-docs/configuration-lookup-apis-spec.md) | `src/cc.ts`, `src/services/config/index.ts` |
| `cc.getEntryPoints` | lookup | `getEntryPoints(params)` | fetch entry point pages | [config spec](../src/services/config/ai-docs/configuration-lookup-apis-spec.md) | `src/cc.ts`, `src/services/EntryPoint.ts` |
| `cc.getQueues` | lookup | `getQueues(params)` | fetch queue pages | [config spec](../src/services/config/ai-docs/configuration-lookup-apis-spec.md) | `src/cc.ts`, `src/services/Queue.ts` |
| `cc.uploadLogs` | core/observability | `uploadLogs(...)` | submit diagnostic logs through support plugin | [core spec](../src/services/core/ai-docs/realtime-request-core-spec.md) | `src/cc.ts`, `src/services/core/WebexRequest.ts` |
| `cc.updateAgentProfile` | plugin facade/config | `updateAgentProfile(...)` | update local profile/device configuration | [plugin spec](../src/ai-docs/contact-center-plugin-spec.md) | `src/cc.ts` |

## Events
| Contract ID | Owner | Event / topic | Direction | Payload schema link | Delivery guarantees | Compatibility / deprecation | Defined at |
|---|---|---|---|---|---|---|---|
| `task.events` | task | `task:*` enum values including incoming, assigned, media, hold/resume, consult, transfer, wrapup, campaign preview, handoff summary, multi-login hydrate | emit | `src/services/task/types.ts` | best effort from WCC realtime into local EventEmitter | additive only without deprecation plan | `src/services/task/types.ts`, `src/services/task/TaskManager.ts` |
| `task.handoffSummary.events` | task | `task:handoffSummary`, `task:handoffSummaryResponse`, `task:handoffSummaryFeatureEnablement` | emit | [handoff task contract](../features/cai-7974-agent-handoff-summary/design/contracts/handoff-summary-task-api.md) | same best-effort ordering as WCC websocket delivery | additive only without deprecation plan | `src/services/task/types.ts`, `src/services/task/TaskManager.ts` |
| `agent.events` | agent | `agent:*` enum values for state/login/logout/relogin/multi-login | emit | `src/services/agent/types.ts` | best effort from WCC realtime/AQM response | additive only without deprecation plan | `src/services/agent/types.ts`, `src/services/agent/index.ts` |
| `cc.events.bridge` | config/task | `CC_EVENTS`, `CC_TASK_EVENTS`, `CC_AGENT_EVENTS` | consume/emit bridge | `src/services/config/types.ts` | maps WCC messages to SDK events | mapping changes are breaking unless compatibility is preserved | `src/services/config/types.ts`, `src/services/task/TaskManager.ts` |
| `webcalling.events` | Web Calling | call events from `@webex/calling` | consume/emit | `@webex/calling` types | dependent on Calling SDK event delivery | do not rename local task mapping behavior silently | `src/services/WebCallingService.ts` |

## Requires - what this package depends on
| Dependency | What is consumed | Schema / detail link | Availability assumption | Fallback on failure | Version floor |
|---|---|---|---|---|---|
| Webex Core | plugin registration, credentials, request/services | `src/index.ts`, `src/cc.ts` | host initialized before use | public calls reject/fail if credentials/services missing | workspace |
| WCC REST resources | agent config, org/profile/team/aux codes, AQM, lookups, AI, outdial ANI | owning module specs | available through service discovery | caller-visible errors from `WebexRequest`/module handlers | service contract |
| WCC WebSocket | task/agent/routing realtime events | core/task/agent specs | subscribe returns welcome and events | welcome timeout, connection lost, relogin paths | service contract |
| AI Assistant service | `/event` handling for transcripts and generated handoff summaries | [AI Assistant handoff contract](../features/cai-7974-agent-handoff-summary/design/contracts/ai-assistant-handoff-event.md) | URL mapping and feature flags available from WCC config | helper promises reject on request/base URL failure | service contract |
| `@webex/calling` | WebRTC line registration and call control | Web Calling spec | browser media runtime available | registration timeout and cleanup | workspace |
| Internal metrics/support/logger plugins | metrics submission, log upload, logging | metrics/core/security specs | host plugin available in Webex SDK | queue or reject depending operation | workspace |

## Compatibility & Deprecation Policy
- Breaking-change rule: no removal or semantic change to exports, `webex.cc` methods, event names, payload expectations, or public TypeScript types without a versioning and migration plan.
- Deprecation: mark in TypeDoc/source comments and this catalog, keep transition notes in the owning module spec.
- Additive events/types/options are compatible only when existing behavior remains unchanged.

## Detailed Interface Docs
- Package API detail: `src/index.ts`, `typedoc.json`, generated TypeDoc output.
- Task operation detail: [task-lifecycle-spec.md](../src/services/task/ai-docs/task-lifecycle-spec.md).
- WCC REST/WebSocket detail is code-owned in route builders and type files; no OpenAPI/AsyncAPI file was found in package scope.

## Maintenance
- Public surface changes update this file and the owning module spec in the same change.
- Tests live under `test/unit/spec/` and should mirror the source module being changed.
