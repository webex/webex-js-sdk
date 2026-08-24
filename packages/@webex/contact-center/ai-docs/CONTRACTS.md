# Contracts Catalog — @webex/contact-center

> Start here → root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Machine source: `.sdd/manifest.json`.

### Exported API & Types
| Contract ID | Owner module/package | Symbol | Signature / shape | Stability / deprecation | Schema / detail link | Defined at |
|---|---|---|---|---|---|---|
| `contact-center.plugin` | Contact Center | `ContactCenter` / default plugin | WebexPlugin implementing `IContactCenter` | semver public | `ai-docs/contact-center-spec.md` | `src/index.ts` |
| `contact-center.routing-agent` | Agent/Core | `routingAgent` | `(routing: AqmReqs) => {stationLogin, logout, stateChange, buddyAgents, reload}` | semver public export; returned methods follow backend contracts | `src/services/agent/ai-docs/agent-spec.md` | `src/index.ts`, `src/services/agent/index.ts` |
| `contact-center.task` | Task | `Task`, `ITask`, task payload/control types | task instance and compatibility interface | semver public | `src/services/task/ai-docs/task-spec.md` | `src/index.ts` |
| `contact-center.events` | Agent/Task/Config | `AGENT_EVENTS`, `TASK_EVENTS`, `CC_AGENT_EVENTS`, `CC_TASK_EVENTS`, `CC_EVENTS` | typed string event contracts | additive; removals or semantic changes are breaking | owning module specs | `src/index.ts` |
| `contact-center.data` | Services/Utils | `AddressBook`, `ApiAIAssistant`, SDK data response/search types | SDK data and AI-assistant access | semver public | Services/Utils specs | `src/index.ts` |
| `contact-center.consult-transfer-lists` | Contact Center/Services | Existing `getQueues`, `getEntryPoints`, `ContactServiceQueueSearchParams`, `EntryPointSearchParams`, `ContactServiceQueuesResponse`, `EntryPointListResponse`, `ContactServiceQueue`, and `EntryPointRecord` with optional mapped `number` | Queue telephony eligibility/profile views/`name,ASC` and entry-point desktop-profile dial-number mapping/`entryPointName,ASC` are defaults on the existing methods; compatible search/filter/sort parameters remain available and backend row order is preserved | behavioral default correction on existing public methods; no specialized methods or projected response wrappers; `EntryPointRecord.number` is additive and raw configuration-only fields are optional | `ai-docs/features/consult-transfer-list-policy/spec/feature-spec.md` | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/types.ts` |
| `contact-center.user-preference` | Services/Config | `UserPreference`, `cc.userPreference`, `UserPreferenceData`, request/response types | `getUserPreference(params?)`, `createUserPreference(data)`, `updateUserPreference(userId, data)`, `deleteUserPreference(userId)` | semver public | `src/services/ai-docs/services-spec.md` | `src/index.ts`, `src/cc.ts`, `src/services/UserPreference.ts`, `src/services/config/types.ts` |
| `contact-center.preview-campaign` | Contact Center/Task | `acceptPreviewContact`, `skipPreviewContact`, `removePreviewContact` | `(payload: PreviewContactPayload) => Promise<TaskResponse>` | semver public | `ai-docs/contact-center-spec.md`, `src/services/task/ai-docs/task-spec.md` | `src/cc.ts`, `src/services/task/dialer.ts`, `src/services/task/types.ts` |
| `contact-center.state-controls` | Task state machine | `getDefaultUIControls`, `TaskUIControls` with ordered `consultTransferDestinations` arrays | Task controls include per-leg action state plus ordered `consult`/`transfer` destination categories derived from profile and interaction policy | additive semver public field; destination arrays are SDK-owned and first item is the consumer default | `src/services/task/state-machine/ai-docs/task-state-machine-spec.md` | `src/index.ts`, `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts` |
| `contact-center.conference-participant-drop` | Task | `DropConferenceParticipantPayload`, `ITask.dropConferenceParticipant` | `(payload: {participantId: string}) => Promise<TaskResponse>`; Voice resolves from correlated `ParticipantLeftConference`, while non-voice base Task rejects as unsupported. Existing participant/consult lifecycle events may resolve one unique child-keyed task by `mainInteractionId`; no new public event is introduced. | semver public | `src/services/task/ai-docs/task-spec.md` | `src/index.ts`, `src/services/task/types.ts`, `src/services/task/voice/Voice.ts`, `src/services/task/contact.ts`, `src/services/task/TaskManager.ts` |
| `contact-center.wxapp-answer` | Contact Center / Task | `enableWxBetterTogether`, `isWxBetterTogetherEnabled()`, `getWxAppMuted`, `syncWxAppMuteFromCallDetails`, unified task telephony (`ITask.accept`, `decline`, `toggleMute({ muted?, lineOwnerId? })`, `transmitDtmf({ dtmf, lineOwnerId? })`) | init flag ON → usersub `true` + Mercury on supported station login **and silent relogin**; init flag OFF → force usersub `false` on supported station login **and silent relogin** (clears stale suppression after refresh); **Phase 1 init-only** — change flag via re-init; multi-login supported; mute backfill via GET call details + `getWxAppMuted()` on hydrate/refresh; shared-line `lineOwnerId` defaults from participant; SDK `Voice` routes wxApp telephony when flag active | semver public | `src/services/task/ai-docs/task-spec.md`, `ai-docs/contact-center-spec.md`, `src/services/ai-docs/services-spec.md` | `src/cc.ts`, `src/services/task/voice/Voice.ts`, `src/services/task/voice/wxAppVoiceMethods.ts` |

### Events

| Contract ID | Owner module | Event / topic | Direction | Payload schema link | Delivery guarantees | Compatibility / deprecation | Defined at |
|---|---|---|---|---|---|---|---|
| `agent.events` | Agent | `agent:*` | publish to application | agent spec/types | realtime; backend ordering/correlation | additive constants | `src/services/agent/types.ts` |
| `task.events` | Task | `task:*` | publish to application/task | task spec/types | event-driven; state guarded | additive constants | `src/services/task/types.ts` |
| `task.wxapp-mute.events` | Task | `task:wxapp-mute-state-updated` | publish to application/task | task spec/types | event-driven | additive | `src/services/task/types.ts`, `src/services/task/voice/Voice.ts` |
| `cc.events` | Config/Core | backend CC_EVENTS | consume/map | config/core specs | remote WebSocket delivery; AQM correlation where configured | backend contract | `src/services/config/types.ts` |
| `rtd.events` | Task | realtime transcription/suggestion | consume then publish per task | task spec | websocket best-effort according to remote service | additive payloads | `src/services/task/TaskManager.ts` |

## Requires — what this repo depends on

| Dependency | What is consumed | Schema / detail link | Availability assumption | Fallback on failure | Version floor |
|---|---|---|---|---|---|
| `@webex/webex-core` | plugin host, request/service routing | package declarations | required | fail operation | workspace version |
| WCC REST/WebSocket | agent/task/config/realtime contracts | module specs and source constants | required for runtime operations | structured error, reconnect, or timeout | remote compatible contract |
| `@webex/calling` | browser line/call lifecycle | Services/Task specs | required for BROWSER login | surface calling failure | workspace version |
| internal metrics/mercury/support/auth/logger | telemetry, realtime, support, identity, logging | package declarations | host-dependent | module-specific nonblocking/error path | workspace version |

## Compatibility & Deprecation Policy

- **Breaking-change rule:** no removal, rename, payload reinterpretation, or semantic break without major-version migration and consumer notes.
- **Deprecation:** mark symbols/types in source/JSDoc, retain through an announced transition, and update changelog/spec/catalog together.

## Detailed Interface Docs

- No OpenAPI/AsyncAPI/proto schema was found in scope; exact SDK and event contracts remain in TypeScript declarations and owning module specs.

## Maintenance

- Update this catalog, the owning module spec, TypeScript declarations, and manifest in the same change as a contract.
