# Contact Center SDK multi-region recovery design

## Overview

Design target: `@webex/contact-center`, `packages/@webex/contact-center`, in the current checkout. Unless a section explicitly gives another base, file paths are package-relative (`src/...`, `docs/...`); DAG `files` paths and command working directories start at the workspace root. Test Strategy suite paths and `--targets` values are relative to the package `test/unit/spec/` directory. Root proposal documents are explicitly identified as workspace-root inputs. Authority is the complete 318-line root `requirement.md`, SHA-256 `a3b4d3ae7a0163e1fb145f4a8b36a6a2858490a1544e6fca99561239f57a4bb5`. The requirement records source baseline `d90e192166646e74dd39e95277607ac0b7e8d25a`; current-state statements below were checked against source, not inferred from that identifier. This is a proposed implementation, not a feature-test, independent-validation, or release-pass claim.

Preserve the valid decisions in root `implementation-plan.md` and `validation-and-evidence.md`: backend-only entitlement, independent live settings hydration, fresh admission, distinct ordinary/DR retry policies, two-stage interruption/cleanup, ordered station policy, conditional auto-Available, host-owned restart, and existing voice/Task/XState/RTD ownership. The requirement resolves target behavior where older proposal commentary differs. No prior `design/default/` deliverables existed.

An entitled switch synchronously fences old work and reconnects, then follows REQ-MR-012’s ordered policy after replacement Welcome. Automatic station restoration is attempted only for a prior backend-confirmed active station with `allowAutomatedRelogin` enabled and a usable snapshot. Earlier branches report `stationLoginRequired`: no prior station skips station wipe/reload/login; automation disabled skips automatic session requests; a missing usable snapshot reports `session-restore-failed` without those requests. Hosts receive complete `region:stateChange` snapshots distinguishing recovering, ready, manual station login, restart and unavailable. Registration still returns a complete Profile at its existing boundary; ready requires station success but promises neither Available nor uninterrupted audio. Ordinary network reconnection has no regional task wipe. No new SDK setting, Split/CDN gate, hostname hosting restriction, dependency, workspace or persistent store is introduced.

System boundary: a browser-oriented SDK/library and its documentation/tests. Host presentation/navigation, platform failover/entitlement provisioning, live operator execution, repository delivery operations and dependency/environment preparation belong to the flow/runtime and their existing owners. Dependency installation, including root `postinstall` (`patch-package && husky install`) and Husky’s `core.hooksPath` write to `.git/config`, is runner-owned preparation and never task acceptance or a prerequisite probe. This design adds no application route, visual harness or UI. The supplied `ux_required:true` contract is retained; a required root `CCSDK_UX_PREFLIGHT` receipt check must confirm that the flow accepts all eleven `requirements_design` library states with non-visual Jest evidence and without rendered captures before MR-01 or any other task starts. A missing or incompatible receipt is an environment/gate result, owned by the flow; implementors must not manufacture it. UX Evidence and Cross-Cutting Concerns define that admission contract.

Implementation uses Node 22.14.x, Yarn 3.4.1, package TypeScript 5.4.5, Babel/legacy tools, CommonJS declaration output, Jest 27, EventEmitter, WebexPlugin and XState 5.24.0. Keep existing exports, public method signatures, voice snapshots, task controls and backend event payloads compatible. The manifest’s modules remain Partial. MR-09 delivers diagnostics, host guidance and product integration tests; MR-10 depends only on that product node. MR-11 separately updates canonical documentation after MR-09 and requires fresh generator/validator runtime identity, source/spec content fingerprints and authorized different-runtime semantic validation before its canonical-spec stage completes. Git-derived `validation.source_commit`/`base_ref` and any other commit- or branch-keyed provenance are flow-owned delivery metadata: MR-09/MR-11 leave them unchanged and do not create or inspect commits or derive Git references. Historical Git fields are not fresh content provenance and no acceptance or prerequisite depends on them.

Product acceptance consists only of the package-scoped MR-01–MR-10 commands. MR-11 has separate documentation consistency and flow-owned canonical-validation checks. Root flow `prog-mini-js.config.json` commands `yarn run build` and `yarn run test` are not this design’s acceptance and are not required to pass for it; the root build also invokes installation and a monorepo build. Dependency installation/compilation remains runner-owned preparation.

## Feature Disposition Matrix

| Fix # | Disposition | Reference |
| --- | --- | --- |
| REQ-001 | Out-of-Scope | requirement.md:L3-L5 -> Branch/delivery selection is flow-owned; no repository lifecycle operation or repository Git metadata is an implementation task or acceptance condition. Manifest `validation.source_commit`, `base_ref` and all commit/branch references are flow-owned delivery metadata, left unchanged by MR-09/MR-11 and never set or derived by implementors. Fresh canonical provenance uses flow-supplied runtime identities and source/spec content fingerprints; no acceptance or prerequisite depends on commit/branch metadata. |
| REQ-002 | Addressed | requirement.md:L9-L21 -> [Component: Documentation and engineering verification](#component-documentation-and-engineering-verification); preserve package/baseline/proposal status and canonical routing. |
| REQ-003 | Addressed | requirement.md:L23-L27 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation). |
| REQ-004 | Addressed | requirement.md:L31-L31 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration). |
| REQ-005 | Addressed | requirement.md:L32-L32 -> [Component: Public recovery contracts](#component-public-recovery-contracts). |
| REQ-006 | Addressed | requirement.md:L33-L33 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling) / MR-03 preserves authentication and ordinary scheduling; [Component: Request interruption and correlation](#component-request-interruption-and-correlation) / MR-04 preserves ordinary request and task-control ownership; [Component: Task invalidation and owned media](#component-task-invalidation-and-owned-media) and [Component: Browser calling preservation](#component-browser-calling-preservation) / MR-05 preserve Task/XState controls and voice semantics; [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration) / MR-06 preserves ordinary authenticated silent relogin without regional cleanup. T-003/T-004/T-007/T-008/T-009 cover these obligations. |
| REQ-007 | Addressed | requirement.md:L34-L34 -> [Component: Failure isolation and diagnostics](#component-failure-isolation-and-diagnostics). |
| REQ-008 | Addressed | requirement.md:L38-L44 -> [Component: Documentation and engineering verification](#component-documentation-and-engineering-verification); maintainers, host developers, platform owners, QA/operators and agents retain their stated responsibilities. |
| REQ-009 | Addressed | requirement.md:L46-L48 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration); SDK-owned recovery only, without a media-continuity assertion. |
| REQ-010 | Addressed | requirement.md:L52-L52 -> [Component: Authoritative MR eligibility](#component-authoritative-mr-eligibility). |
| REQ-011 | Addressed | requirement.md:L53-L53 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling). |
| REQ-012 | Addressed | requirement.md:L54-L54 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation). |
| REQ-013 | Addressed | requirement.md:L55-L55 -> [Component: Browser calling preservation](#component-browser-calling-preservation). |
| REQ-014 | Out-of-Scope | requirement.md:L56-L56 -> QA/platform owners supply the entitled org, credentials, deployed versions and coordinated window; implementation does not acquire credentials or operate failover. Release evidence remains required. |
| REQ-015 | Out-of-Scope | requirement.md:L57-L57 -> Flow-owned library-only UX admission is a required root receipt check before MR-01; independent-validator integration is checked only at the separate MR-11 canonical-spec stage. Cross-Cutting Concerns defines environment/gate results; no SDK runtime configuration or prerequisite-setup task. |
| REQ-016 | Addressed | requirement.md:L61-L70 -> [Component: Authoritative MR eligibility](#component-authoritative-mr-eligibility); live array/first-record decoding and registration-scoped hydration. |
| REQ-017 | Addressed | requirement.md:L72-L86 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation); exact SystemRegionSwitch wire contract. |
| REQ-018 | Addressed | requirement.md:L88-L131 -> [Component: Public recovery contracts](#component-public-recovery-contracts); additive exports and complete snapshots. |
| REQ-019 | Addressed | requirement.md:L133-L133 -> [Component: Public recovery contracts](#component-public-recovery-contracts); ready and operation-Promise boundaries. |
| REQ-020 | Addressed | requirement.md:L135-L135 -> [Component: Deferred auto-Available](#component-deferred-auto-available); independently observable action outcomes. |
| REQ-021 | Addressed | requirement.md:L137-L137 -> [Component: Public recovery contracts](#component-public-recovery-contracts); plain Error/data.reason catalog. |
| REQ-MR-001 | Addressed | requirement.md:L141-L145 -> [Component: Authoritative MR eligibility](#component-authoritative-mr-eligibility). |
| REQ-MR-002 | Addressed | requirement.md:L147-L151 -> [Component: Authoritative MR eligibility](#component-authoritative-mr-eligibility). |
| REQ-MR-003 | Addressed | requirement.md:L153-L157 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation). |
| REQ-MR-004 | Addressed | requirement.md:L159-L163 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation). |
| REQ-MR-005 | Addressed | requirement.md:L165-L169 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling). |
| REQ-MR-006 | Addressed | requirement.md:L171-L175 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling). |
| REQ-MR-007 | Addressed | requirement.md:L177-L181 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling). |
| REQ-MR-008 | Addressed | requirement.md:L183-L187 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling). |
| REQ-MR-009 | Addressed | requirement.md:L189-L193 -> [Component: Host restart integration](#component-host-restart-integration). |
| REQ-MR-010 | Addressed | requirement.md:L195-L199 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration). |
| REQ-MR-011 | Addressed | requirement.md:L201-L205 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration). |
| REQ-MR-012 | Addressed | requirement.md:L207-L226 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration); [Component: Deferred auto-Available](#component-deferred-auto-available). |
| REQ-MR-013 | Addressed | requirement.md:L228-L234 -> [Component: Request interruption and correlation](#component-request-interruption-and-correlation). |
| REQ-MR-014 | Addressed | requirement.md:L236-L240 -> [Component: Task invalidation and owned media](#component-task-invalidation-and-owned-media). |
| REQ-MR-015 | Addressed | requirement.md:L242-L246 -> [Component: Task invalidation and owned media](#component-task-invalidation-and-owned-media). |
| REQ-MR-016 | Addressed | requirement.md:L248-L252 -> [Component: Browser calling preservation](#component-browser-calling-preservation). |
| REQ-MR-017 | Addressed | requirement.md:L254-L258 -> [Component: Realtime restoration](#component-realtime-restoration). |
| REQ-MR-018 | Addressed | requirement.md:L260-L264 -> [Component: Public recovery contracts](#component-public-recovery-contracts). |
| REQ-MR-019 | Addressed | requirement.md:L266-L270 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation). |
| REQ-MR-020 | Addressed | requirement.md:L272-L276 -> [Component: Failure isolation and diagnostics](#component-failure-isolation-and-diagnostics). |
| REQ-MR-021 | Addressed | requirement.md:L280-L284 -> [Component: Failure isolation and diagnostics](#component-failure-isolation-and-diagnostics). |
| REQ-022 | Addressed | requirement.md:L286-L288 -> [Component: Documentation and engineering verification](#component-documentation-and-engineering-verification); entitlement-driven rollout and next-registration changes. |
| REQ-023 | Addressed | requirement.md:L290-L290 -> [Component: Documentation and engineering verification](#component-documentation-and-engineering-verification); local checks and fresh independent-validation provenance. |
| REQ-024 | Addressed | requirement.md:L292-L292 -> [Component: Documentation and engineering verification](#component-documentation-and-engineering-verification); release record requires authoritative fixture, isolation evidence, compatibility review and separately executed AC-021. |
| REQ-025 | Addressed | requirement.md:L296-L296 -> [Component: Documentation and engineering verification](#component-documentation-and-engineering-verification); preserve local/release evidence separation. |
| AC-001 | Addressed | requirement.md:L298-L298 -> [Component: Authoritative MR eligibility](#component-authoritative-mr-eligibility); T-001. |
| AC-002 | Addressed | requirement.md:L299-L299 -> [Component: Authoritative MR eligibility](#component-authoritative-mr-eligibility); T-001. |
| AC-003 | Addressed | requirement.md:L300-L300 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation); T-002. |
| AC-004 | Addressed | requirement.md:L301-L301 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling); T-003. |
| AC-005 | Addressed | requirement.md:L302-L302 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling); T-003. |
| AC-006 | Addressed | requirement.md:L303-L303 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling); T-004. |
| AC-007 | Addressed | requirement.md:L304-L304 -> [Component: Admission and reconnect scheduling](#component-admission-and-reconnect-scheduling); T-005. |
| AC-008 | Addressed | requirement.md:L305-L305 -> [Component: Host restart integration](#component-host-restart-integration); T-006. |
| AC-009 | Addressed | requirement.md:L306-L306 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration); T-007. |
| AC-010 | Addressed | requirement.md:L307-L307 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration); T-007. |
| AC-011 | Addressed | requirement.md:L308-L308 -> [Component: Station snapshot and restoration](#component-station-snapshot-and-restoration); T-007. |
| AC-012 | Addressed | requirement.md:L309-L309 -> [Component: Deferred auto-Available](#component-deferred-auto-available); T-007. |
| AC-013 | Addressed | requirement.md:L310-L310 -> [Component: Request interruption and correlation](#component-request-interruption-and-correlation); [Component: Task invalidation and owned media](#component-task-invalidation-and-owned-media); T-008. |
| AC-014 | Addressed | requirement.md:L311-L311 -> [Component: Task invalidation and owned media](#component-task-invalidation-and-owned-media); T-009. |
| AC-015 | Addressed | requirement.md:L312-L312 -> [Component: Browser calling preservation](#component-browser-calling-preservation); T-009. |
| AC-016 | Addressed | requirement.md:L313-L313 -> [Component: Realtime restoration](#component-realtime-restoration); T-010. |
| AC-017 | Addressed | requirement.md:L314-L314 -> [Component: Public recovery contracts](#component-public-recovery-contracts); T-011. |
| AC-018 | Addressed | requirement.md:L315-L315 -> [Component: Switch coordination and lifecycle cancellation](#component-switch-coordination-and-lifecycle-cancellation); T-012. |
| AC-019 | Addressed | requirement.md:L316-L316 -> [Component: Failure isolation and diagnostics](#component-failure-isolation-and-diagnostics); T-012. |
| AC-020 | Addressed | requirement.md:L317-L317 -> [Component: Failure isolation and diagnostics](#component-failure-isolation-and-diagnostics); T-013. |
| AC-021 | Out-of-Scope | requirement.md:L318-L318 -> Human/operator-executed release acceptance is outside autonomous product implementation. QA/platform owners must record actual org/settings, admission, station, new-call, RTD and voice evidence for DN/extension/browser and both switch directions. Not executed until that evidence exists; no local mock or task passes this gate. |

## Current State and Reuse Analysis

Inspected end-to-end chains and disposition against the target. All file paths in this table are relative to the package root; unqualified class/method references are symbols:

| Mechanism and inspected symbols | Current behavior | Decision and target extension |
| --- | --- | --- |
| `src/index.ts`; `src/cc.ts` constructor, `register`, `connectWebsocket`; `src/services/index.ts` constructor/`getInstance` | Webex READY creates singleton collaborators; register attaches messages, awaits primary Welcome, complete `getAgentConfig`, optional silent relogin; returns Profile. | **Preserve/extend.** Keep completion semantics and composition; reset registration-scoped ownership on every register. Add no global recovery singleton. |
| `src/services/config/index.ts` `getAgentConfig`, `getOrgDesktopLoginConfig`, `getUserDesktopLoginConfig`; `src/services/config/Util.ts` `parseAgentConfigs` | User aggregate is awaited, then five dependent results use `Promise.all`; any normal failure rethrows. MR is absent from the source API. | **Preserve/extend.** Add one separate live settings method. Do not add it to the aggregate Promise.all, change Profile or use aggregate omission as a gate. |
| `src/services/core/WebexRequest.ts` `request`; WebSocketManager `register` | Authenticated logical service routing already exists; subscribe adds the INT organization header and validates `wss:`/RoutingNotifs hosts. | **Preserve/extend.** Reuse logical `wcc-api-gateway`, host auth and URL checks; use attempt-local admission results, not shared last URL. |
| `src/services/core/websocket/WebSocketManager.ts` `initWebSocket`, `connect`, `close`, `webSocketOnCloseHandler` | Fresh subscribe already rethrows; Welcome has only a stored resolver; close can leave it pending. `WELCOME_TIMEOUT` is unused. Connect logs the signed URL; callbacks access mutable socket fields. | **Replace** unsafe settlement, callback/socket ownership and full-URL logging. Keep socket/worker protocol. |
| `WebSocketManager.connect` raw AGENT_MULTI_LOGIN close; `src/cc.ts::handleWebsocketMessage` nested AgentMultiLoginCloseSession/session check | Transport closes on the broad wire type, while the façade has session-specific termination context. | **Replace** the transport's blanket close with ContactCenter's validated current-session termination decision, so cancellation and close share one owner. |
| `src/services/core/websocket/connection-service.ts` `onSocketClose`, `handleSocketClose`, `onPing`, `handleRestoreFailed` | Async five-second interval may overlap and reject uncaught. Any message rearms liveness/restore timers. Effective timeout is 50 seconds; `setConnectionProp` has no production caller. | **Replace** interval concurrency with a single scheduler and guards; **preserve** ordinary cadence/effective timeout and existing `ConnectionLostDetails`. Extend with DR mode; do not wire Profile timeout. |
| `src/services/core/aqm-reqs.ts` `createPromise`, `onMessage`, `bindCheck`; `src/services/core/types.ts` `Pending`, `Req`; `src/services/agent/index.ts` `routingAgent` | AQM owns HTTP plus WS completion and duplicate bind rejection. Timeout handles/rejects are not retained. Agent-state binds match event/subtype without request ID. `Req.headers` exists but createPromise does not forward it. | **Extend/replace** pending ownership and agent-state correlation. Keep other backend binds and Err semantics. A cleared map alone cannot fence HTTP/media continuations. |
| `src/cc.ts` `stationLogin`, `stationLogout`, `silentRelogin`, `handleDeviceType`, `updateAgentProfile`, `updateWellnessSession`, `ensureWxAppPostStationLogin` | Effective login payload uses default aux `''`; profile updates logout then login. Reload applies team/timestamps/wellness/device effects; only AGENT_NOT_FOUND is special. Current disconnect rule can cache Available after a failed request. | **Extend** successful station snapshot and result application; **replace** premature Available caching with acknowledgment-only application. Add DR-only retry/policy/auto-state behavior; preserve normal public signatures and ordinary relogin policy. |
| `src/services/task/Task.ts` `computeUIControls`, `updateUiControls`, `stopStateMachine`, `autoAnswerIfNeeded`, mutating APIs; `src/services/task/TaskManager.ts` `registerTaskListeners`, `setupTaskListeners`, `handleTaskCleanup`, `removeTaskFromCollection`; `TaskFactory.createTask` | Typed hydration and Task/XState ownership exist, without a bulk invalidate API. Cleanup currently follows backend events. | **Extend.** Block commands at entry, later stop actors and invalidate actual retained instances through Task. Reuse hydration. **Remove no backend event/state.** Never emulate ContactEnded/wrap-up to clean up. |
| `src/services/task/voice/WebRTC.ts` `accept`, `unregisterWebCallListeners`; `src/services/task/voice/Voice.ts` and `src/services/task/voice/wxAppVoiceMethods.ts` awaited call-control chains | WebRTC acquires getUserMedia then answers immediately, and lacks explicit owned-track disposal. wxApp helpers also mutate after awaits. | **Extend** shared Task guards into each producer/continuation, plus owned-track disposal. Non-idempotent requests already dispatched are not replayed or undone. |
| `src/services/WebCallingService.ts` `isVoiceReady`, `isBrowserVoiceRequired`, `registerWebCallingLine`, `cleanupWebCallingRegistration`, `cleanUpCall` | Line/Mobius state is already separate; registration replaces/deregisters an existing line. `cleanUpCall` removes listeners/maps without ending a call; `handleDisconnectEvent` does call end. | **Preserve/extend.** Add DR ensure path and call only non-ending cleanup. Do not invoke disconnect handler or replace a healthy line. |
| `src/cc.ts` `handleRTDWebsocketMessage`, feature condition in `connectWebsocket`; `TaskManager.clearAISummaryState`, `handleRealtimeWebsocketEvent`; `ApiAiAssistant.clearAllRtdRequests` | RTD is a second WebSocketManager without its own reconnect driver. Existing complete feature condition includes transcripts, suggestions, both summary flags and wellness. | **Extend** pause/fresh subscription/stale-delivery guards. Reuse existing owners and current feature condition, with no invented subscriptions. |
| `src/cc.ts` `setupEventListeners`, `deregister`; TaskManager `registerTaskListeners`; `src/services/core/Utils.ts` error helpers; `src/metrics/MetricsManager.ts` `timeEvent`/`trackEvent` | Bound/unbound listener mismatch and anonymous handlers outlive teardown. Error helpers translate to plain Error but discard lifecycle reason; diagnostics can throw. | **Replace** affected listener ownership; **extend** lifecycle-error passthrough and best-effort diagnostics. Keep unrelated error translation and public payloads. |

The proposed mechanisms cannot be obtained by merely calling existing reconnect or clearing TaskManager's map: neither cancels AQM handles, fences getUserMedia/wxApp continuations, preserves calling registration, nor restores RTD. Extend their owners directly; there is no parallel retry service, task-permission store, transport bus or new package.

Additional wire evidence inspected locally: Desktop `packages/agentx-services/src/services/cms/cms-service.ts::fetchOrganizationSettings`, `cms/types/cms-service.types.ts::OrganizationSettingsResponse` and `core/http-reqs.ts::createPromise` under `/Users/rsarika/dev/CCSDK/wxcc-desktop/` show an array HTTP payload returned from `res.data`; `agentx/src/app/utils/Utils.ts::updateOrgSettings` reads `[0]`. In this SDK's Webex HTTP envelope the payload is `response.body`. These are adapter/shape evidence, not a deployed positive fixture. Webex core `src/interceptors/webex-tracking-id.js::onRequest` preserves a supplied `trackingid`; agent response types distinguish outer notification tracking ID from `data.trackingId` documenting the request ID. Contract tests must prove that state requests use that nested request ID; no type-only fallback is acceptable.

## Target Architecture and Package Layout

Retain the existing package and all source directories. No runtime, test, dependency, asset or configuration file is added or removed. All new symbols go into existing owners. Inline sanitized fixtures and new describe blocks belong in the existing mirrored suites. This avoids duplicating existing config, transport, Task, calling and metrics abstractions. No changes to `package.json`, `yarn.lock`, TS/Babel/Jest/Playwright configs, `src/config.ts`, calling workspace source, generated dist/UMD or keepalive worker protocol are required.

| Modified files | Responsibility / dependency edge | DAG owners |
| --- | --- | --- |
| `src/{types,constants,index}.ts` | Additive public recovery contract and direct re-exports; no dependency on internals from the root constants catalog. | MR-01 |
| `src/services/config/{index,types,constants,Util}.ts` | Live MR reader, typed first-record decoder, wire event vocabulary; uses WebexRequest/Core utilities. Normal Profile aggregation retained. | MR-01, MR-02 |
| `src/services/core/{types,Utils,Err,aqm-reqs}.ts` | Normalized non-sensitive failures, lifecycle error creation/passthrough, compatible optional error diagnostics, pending request cancellation and per-state-request correlation. | MR-01, MR-04 |
| `src/services/core/constants.ts`, `src/services/core/websocket/{WebSocketManager,connection-service,types}.ts` | Attempt ownership, deadlines, safe region metadata, ordinary/DR scheduling; Core has no agent policy. | MR-03 |
| `src/services/index.ts`, `src/services/agent/index.ts` | Retain AqmReqs for lifecycle control; declare request kind and state correlation using existing service factory. | MR-04 |
| `src/cc.ts` | Registration/org/recovery context, hydration launch, switch coordinator, station policy, auto-state owner, lifecycle/RTD orchestration, snapshots. Depends on services; services never import ContactCenter. | MR-02, MR-06, MR-07, MR-08, MR-09 |
| `src/services/task/{Task,TaskManager,TaskFactory,types}.ts`, `src/services/task/voice/{Voice,WebRTC,wxAppVoiceMethods}.ts`, `src/services/task/digital/Digital.ts` | Task guards, retained-object invalidation, guarded media/async paths, factory binding and cleanup ownership. | MR-05, MR-08 |
| `src/services/task/state-machine/uiControlsComputer.ts` | Pure existing-shape disable adapter; Task owns actor stop, with no fabricated transition. | MR-05 |
| `src/services/WebCallingService.ts`, `src/services/ApiAiAssistant.ts` | DR line ensure, non-ending cleanup and cancellable RTD requests/continuations. | MR-05, MR-08 |
| `src/metrics/{constants,behavioral-events}.ts`, `src/constants.ts` | Safe recovery stage taxonomy and affected method names. | MR-01, MR-09 |
| Existing mirrored suites named in Test Strategy and exhaustive DAG file lists | Characterization, contract, unit, concurrency and in-process cross-owner integration. | MR-01–MR-10 |
| `README.md`, `docs/getting-started.md` | Package recovery/rollout guidance and the exact tested host restart example; independent of canonical validation. | MR-09 |
| `docs/architecture.md`, `docs/specs/README.md`, `src/docs/README.md`, `src/metrics/docs/README.md`, `src/services/docs/README.md`, `src/services/{agent,config,core,task}/docs/README.md`, `src/services/task/state-machine/docs/README.md`, `.sdd/manifest.json` | Canonical contract index, owning module specs and runtime/content-fingerprint provenance only. Git-derived provenance remains unchanged and flow-owned. These are future implementation changes; this design phase does not edit them. | MR-11 |

`src/services/task/types.ts` holds internal Task lifecycle types with `@internal`; public `ITask`, TaskUIControls and constructor inputs retain their required fields. `src/services/core/types.ts` holds request/transport ownership types. Keep memory scoped to a registration or station rather than changing singleton construction. Fresh registration reattaches exactly one stored handler per source, since Services and TaskManager can survive deregistration.

Dependency direction remains Host → ContactCenter → service factories/Task owners → Core/Webex auth and calling; Task → existing state-machine helpers. Core accepts an opaque post-Welcome callback from ContactCenter so it can serialize the entire attempt, but does not import station/Profile policy. No cycles or cross-workspace source imports are added.

## Component: Public recovery contracts

**Coverage / task:** REQ-005, REQ-018, REQ-019, REQ-021, REQ-MR-018, AC-017; MR-01 and MR-06. Externally visible behavior is the additive complete-snapshot event and structural plain-Error failures.

In `src/constants.ts` add, then directly re-export values from `src/index.ts`:

```ts
export const REGION_RECOVERY_EVENTS = {STATE_CHANGE: 'region:stateChange'} as const;
export const REGION_RECOVERY_ERROR_CODES = {
  RECOVERY_INTERRUPTED: 'RECOVERY_INTERRUPTED',
  RECOVERY_IN_PROGRESS: 'RECOVERY_IN_PROGRESS',
  STALE_TASK: 'STALE_TASK',
  REGION_RELOAD_REQUIRED: 'REGION_RELOAD_REQUIRED',
} as const;
```

In `src/types.ts` define and directly type-re-export these five public types from `src/index.ts`:

```ts
export type RegionRecoveryErrorCode =
  (typeof REGION_RECOVERY_ERROR_CODES)[keyof typeof REGION_RECOVERY_ERROR_CODES];
export type RegionRecoveryStatus =
  | 'recovering' | 'ready' | 'reloadRequired' | 'stationLoginRequired' | 'unavailable';
export type RegionRecoveryReason =
  | 'initial-login' | 'region-switch' | 'region-mismatch' | 'not-eligible'
  | 'session-restore-failed' | 'automatic-relogin-disabled'
  | 'authentication-failed' | 'recovery-failed';
export type RegionAutoAvailableStatus =
  | 'waitingForVoice' | 'requesting' | 'succeeded' | 'failed' | 'cancelled';
export type RegionRecoveryState = {
  status: RegionRecoveryStatus;
  reason: RegionRecoveryReason;
  trackingId?: string;
  operation?: 'FAILOVER' | 'FAILBACK';
  scope?: 'REGION' | 'ORG';
  homeRegion?: string;
  servingRegion?: string;
  limitedService?: boolean;
  retryAfterMs?: number;
  autoAvailable?: RegionAutoAvailableStatus;
};
```

The five types comprise four recovery event types and the error-code type. Do not add a public refresh/recover method or Error subclass. Existing `register(): Promise<Profile>`, `stationLogin(data: AgentLogin): Promise<StationLoginResponse>`, `setAgentState(data: StateChange): Promise<SetStateResponse>`, `stationLogout(data: Logout): Promise<StationLogoutResponse>` and `deregister(): Promise<void>` retain signatures and promise ownership.

Add Core utility signatures in `src/services/core/Utils.ts`:

```ts
export function createRegionRecoveryError(
  reason: RegionRecoveryErrorCode,
  diagnostics?: Readonly<{trackingId?: string; status?: number}>
): AugmentedError;
export function isRegionRecoveryError(error: unknown): error is AugmentedError;
```

Create `new Error(reason)` with `data.reason` and only supplied safe diagnostics. Recognition uses `isRecord` plus membership in the const catalog, never instanceof. Add early passthrough to `getErrorDetails` and `generateTaskErrorObject` so normal service catches do not replace lifecycle codes. Preserve compatible existing non-sensitive `.data` fields; leave other backend translations and `Err.Message`/`Err.Details` unchanged. An already-settled operation gets no second rejection or fabricated backend event.

In ContactCenter add `private publishRegionState(state: RegionRecoveryState): void` and `private buildRegionState(status: RegionRecoveryStatus, reason: RegionRecoveryReason, retryAfterMs?: number): RegionRecoveryState`. Build a new object using current known context only, assign the last snapshot before calling `this.trigger(REGION_RECOVERY_EVENTS.STATE_CHANGE, Object.freeze({...state}))`, and catch observer errors at that publication boundary. Compare fields using existing lodash `isEqual`; emit only on change. Optional undefined/null data is omitted, never serialized as null, empty string, false or a prior generation's value. `retryAfterMs` is the finite scheduled wait, clamped at zero, not a keepalive countdown. Begin each recovery/session generation with no auto-Available outcome; terminal outcomes retain current initiating metadata until that generation ends.

In Core constants add `REFERENCE_SERVING_REGIONS` containing exactly `intgus1`, `qaus1`, `loadus1`, `loadus2`, `produs1`, `produs2`, `prodanz1`, `prodca1`, `prodeu1`, `prodeu2`, `prodin1`, `prodjp1`, `prodsg1`. Internal named export `export function parseServingRegion(webSocketUrl: string): string | undefined` in WebSocketManager's existing module parses only `new URL(...).hostname.toLowerCase().split('.')` and returns the matching complete label; invalid/no label returns undefined. Do not match substrings or the query. Record placement for an admitted current socket at Welcome, reset it on new attempts. Normalize home and serving strings by trim/lowercase. Include limitedService only with enabled eligibility and both known strings; equal → false, unequal → true. This registry does not authorize a URL.

Ready requires an accepted backend station session. Initial success emits ready/initial-login; DR success retains region-switch and its tracking/operation/scope. Socket-only success emits no ready. A ready session can separately report any autoAvailable outcome. No payload contains URLs, auth data, DN, media or login snapshots. Storage/migration: Not applicable - all new values are in memory, with no Profile schema change. UI rendering: Not applicable - host-owned; see Host restart integration. Tests: T-011 full-snapshot omission/13 labels/ready boundary and T-013 exports/error compatibility; T-007 outcome retention.

## Component: Authoritative MR eligibility

**Coverage / task:** REQ-010, REQ-016, REQ-MR-001, REQ-MR-002, AC-001, AC-002; MR-02. Recovery is automatically enabled only for the authenticated registration's live confirmed true result.

Extend existing Config files, not `getAgentConfig` or Profile. `src/services/config/types.ts` adds internal `MultiRegionSettings = {multiRegionEnabled?: boolean; homeRegion?: string}` and `OrganizationSettingsResponse = MultiRegionSettings[]`. An authoritative first record must be a non-null, non-array object with at least one own wire field; an empty object is malformed/unknown. Extra wire fields are ignored after this validation; first-record MR absent/false → disabled; literal true → enabled; present nonboolean/null → invalid/unknown. A homeRegion value is accepted only as a nonblank string and normalized; invalid/missing homeRegion does not invalidate true entitlement. Do not inspect a later item to rescue an invalid first one.

```ts
// src/services/config/constants.ts
endPointMap.organizationSettings: (orgId: string) => string;
// src/services/config/Util.ts
export function decodeMultiRegionSettings(body: unknown): MultiRegionSettings | undefined;
// src/services/config/index.ts, AgentConfigService, internal API
public async getMultiRegionSettings(
  orgId: string, signal?: AbortSignal
): Promise<MultiRegionSettings>;
// cc.ts
private async hydrateMultiRegionSettings(
  registration: number, orgId: string, signal: AbortSignal
): Promise<void>;
```

The endpoint is `organization/${encodeURIComponent(orgId)}/organization-setting`, GET via existing `WebexRequest.request({service: WCC_API_GATEWAY, resource, method: HTTP_METHODS.GET})`; never send credentials directly. Validate nonblank orgId and reject unsuccessful status before decoding `response.body`. The Webex HTTP envelope is unwrapped once; do not use the desktop-login aggregate or accept speculative nested `.data` alternatives. Empty/non-array/malformed-first/invalid-MR responses reject this narrow read as invalid data so the bounded hydration retries them. A sanitized fixture in existing `test/unit/spec/services/config/index.ts` uses the actual Webex envelope with array body; include sanitized id/licenseVersion fields matching the inspected Desktop wire type plus MR fields, and a nonempty legacy record with no MR property. Test an empty first object as malformed rather than certifying disabled from no record content. Do not require unrelated id/license fields to decode a record that otherwise has content under the stated narrow contract. Label constructed contract fixtures separately from a future QA-supplied deployed positive fixture.

Control flow:

1. At `register()` entry invalidate old MR hydration/eligibility, increment registration generation, capture active org and agent identity, clear accepted switch history. New fields initialize to `eligibility: 'unknown'`, no homeRegion. Old requests remain caught and cannot publish to the new generation.
2. After valid primary Welcome and successful complete `getAgentConfig`, start exactly one fire-and-forget `hydrateMultiRegionSettings(...).catch(...)` for this registration, before continuing existing registration work. Do not await it when returning Profile, returning a partial Profile, or completing normal silent relogin. Normal Profile failure still rejects register and starts no hydration.
3. Make at most five serial reads. Transient HTTP/network/invalid data failures wait 1000, 2000, 3000, 4000 ms before attempts 2–5. Other non-retryable reader failures retain unknown and stop; final failure does likewise. No Profile retry, polling or public refresh. On terminal 401/403 after host auth handling, stop just this cycle. No logout, socket close, unavailable event or host credential change is initiated by this reader.
4. After each await and before applying the decoded result check registration/org/agent/signal. Assign enabled/disabled and homeRegion once for the current cycle. If a current recovery snapshot already exists, rebuild and publish it only if its metadata changed, preserving status/reason and never manufacturing ready or unavailable from settings completion alone. Unknown events during hydration are not queued and do not enter dedup history. Ordinary reconnect and DR restoration never call the reader.

AbortSignal is a local cancellation fence: the current WebexRequest API does not expose AbortSignal, so do not promise physical HTTP abort or pass an unverified option. Race against cancellation, retain caught completion handlers, and discard late results. Host HTTP timeout/auth remains authoritative. Timers are cleared and abort listeners detached in finally. The retry count is bounded; no new runtime timeout/toggle is added. Persistence/schema migration: Not applicable - results live only for one registration. Observability uses safe stage/outcome/count, never settings bodies. Tests T-001 cover first-item-only arrays including a later true, all zero/invalid inputs, retry timing, terminal auth isolation, initial hydration ignored switch, complete Profile retention and new-org generation cancellation.

## Component: Admission and reconnect scheduling

**Coverage / task:** REQ-006, REQ-011, REQ-MR-005, REQ-MR-006, REQ-MR-007, REQ-MR-008, AC-004, AC-005, AC-006, AC-007; MR-03. Preserve trusted admission and ordinary timing; replace unsafe overlap and unsettled initialization.

REQ-006 preservation: retain the existing authenticated Webex request/refresh path and task-control owners; ordinary recovery keeps its cadence and never enters regional interruption, Task invalidation or station policy. T-003 `preservesHostAuthentication` and T-004 `ordinaryReconnectDoesNotEnterDrPolicy` pin those boundaries, with real-owner ordinary session checks in MR-06.

Extend existing `WebSocketManager`, `ConnectionService`, their `src/services/core/websocket/types.ts` and Core constants. No separate reconnection class, worker or forced U2C request is needed.

```ts
// WebSocketManager
public async initWebSocket(options: {
  body: SubscribeRequest; resource: string; signal?: AbortSignal;
}): Promise<WelcomeResponse>;
public cancelPending(error: Error): void;
public close(shouldReconnect: boolean, reason?: string): void;
public getServingRegion(): string | undefined;
// ConnectionService
public reset(options: {subscribeRequest: SubscribeRequest; signal: AbortSignal}): void;
public pause(): void;
public stop(): void;
public async recoverRegion(options: {
  signal: AbortSignal;
  onScheduled: (attempt: number, retryAfterMs: number) => void;
  afterWelcome: (welcome: WelcomeResponse, signal: AbortSignal) => Promise<void>;
}): Promise<void>;
```

`ConnectionService` retains one scheduler mode (`ordinary | region | stopped`), one timer, one in-flight attempt, an ordinary watchdog, attempt counter and stored listener references. `reset` cancels/detaches previous ownership and installs new registration ownership. Ordinary `ConnectionLostDetails` is unchanged. The opaque afterWelcome callback is the concrete integration seam for ContactCenter station restoration; it introduces no Core import of agent policy. The attempt stays in flight while that callback runs.

WebSocketManager stores the following internal attempt type in `src/services/core/websocket/types.ts`; socket-local callbacks close over their own socket/id:

```ts
type SocketAttempt = {
  id: number;
  controller: AbortController;
  phase: 'subscribe' | 'welcome';
  settled: boolean;
  resolve: (value: WelcomeResponse) => void;
  reject: (error: Error) => void;
  deadline?: ReturnType<typeof setTimeout>;
  socket?: WebSocket;
  removeAbortListener?: () => void;
};
```

Initial admission also occupies this slot. Timeout/cancel settles the local caller before releasing the slot; a prior HTTP response can never assign `this.websocket`, URL, flags or placement to a replacement attempt. The old underlying HTTP may finish after cancellation; its result is inert and its rejection is consumed.

Each attempt: arm a 20-second subscribe deadline; POST fresh `SUBSCRIBE_API` through logical gateway using the current body and existing INT header rule; pass supported `timeout: TIMEOUT_REQ` to direct host request as well as enforcing local settlement. Validate response URL with existing `wss:` and `ALLOWED_ROUTING_NOTIFS_DOMAINS` checks. Keep the returned URL only in that attempt. On accepted admission clear subscribe timer and immediately start one 30-second socket-plus-Welcome deadline (not 30 seconds after open). Open this URL, send existing keepalive and await a correctly parsed object with type Welcome and valid data/agent identity for the registration. Socket open alone cannot resolve. Error, close-before-Welcome, timeout or abort rejects once and closes/detaches that attempt's socket. Resolve internal Welcome before application message fan-out; observer exceptions must not strand settlement. Validate JSON and discard malformed data safely. All primary/RTD message callbacks reject superseded socket IDs before emitting any message, so stale non-keepalives cannot rearm timers either.

`close(false, ...)` always disables reconnect and cancels pending admission, even when the existing `isSocketClosed`/`shouldReconnect` flags would previously skip cleanup. Close only an installed actual socket, terminate keepalive work, clear Welcome ownership and detach callback/abort references. No stale onopen callback may set shouldReconnect true. Create the worker/Blob URL lazily for the current connection, stop and terminate that worker and revoke its URL when the attempt/socket is disposed, and create a new worker for the next connection; keep the worker message protocol unchanged. No worker callback may send on an old/replaced socket. `close(true, ...)` may notify the active ordinary driver, never recursively create another.

Retry policies:

| Path | Exact scheduling / completion |
| --- | --- |
| Initial register | One admission attempt; reject on failure; host can call register again. |
| Ordinary network loss | Five-second slots from close, skipping slots while an attempt is in flight and scheduling the next future slot after settlement. No catch-up burst. Preserve 8-second liveness and effective 50-second restore watchdog. Valid current-stream messages retain existing ordinary reset behavior. Do not apply parsed Profile timeout. |
| Confirmed eligible DR | Immediately cancel ordinary timer/watchdog; schedule 100000, 60000, 30000, 15000 ms, repeating the last base. For each scheduled wait draw new `base * (1 + 0.5 * Math.random())`; expose the actual nonnegative wait. No overall duration limit or 50-second watchdog in DR. Wait precedes the first attempt. |
| Replacement socket lost during station restore | Abort that attempt's child signal immediately, including AQM restore work. Continue the same DR scheduler/attempt sequence; no concurrent restore/admission. |
| Manual outcome or ready | afterWelcome returns; leave a monitored primary connection. Subsequent ordinary loss uses ordinary policy; while manual login is required, do not invoke automated session restore. |
| Cancellation / terminal result | Clear wait/deadlines/listeners, settle active promises and stop scheduling. Late results remain inert. |

Add Core utility `normalizeRecoveryFailure(error: unknown): RecoveryFailure` and `getSubscriptionMismatchReason(error: unknown): string | undefined`. `RecoveryFailure` in `src/services/core/types.ts` contains only optional `status: number`, `reason: string`, `reasonCode: number`, `trackingId: string`, `id: string`; preserve structured input internally until classification. Read HTTP status from the first finite numeric statusCode/status, response.statusCode/response.status, then details.status. Choose the first record body from body, response.body, response.data, details.msg; choose detail data from details.data, body.data, body.error, then body. Read reasonCode from detail data, details.reasonCode, then the public safe data.reasonCode; normalize finite integers or all-digit numeric strings only. Read a nonblank reason from detail data.reason, details.reason, then safe data.reason; semantic values remain case-sensitive. Read request tracking from detail data.trackingId, details.trackingId or case-insensitive HTTP trackingid, and id from the existing Err identifier. Do not recursively search arbitrary fields or stringify unknown objects. Use numeric reasonCode when present to select a code category and semantic aliases when no code is present; cancellation and terminal auth guards always run first. This helper must not alter unrelated public errors. Subscription mismatch uses its separately specified header/body precedence rather than this generic reason order.

Mismatch classification is called only in the subscribe catch. Require HTTP 409. Read `x-wxcc-region-reason` by case-insensitive header name; choose first nonblank string in header → body.reason → body.error.reason order, trim once and compare values exactly. Recognized values are precisely REGION_MISMATCH_REGION_FAILOVER, REGION_MISMATCH_ORG_OVERRIDE, REGION_MISMATCH_ORG_OVERRIDE_SUPERSEDED, REGION_MISMATCH_NO_OVERRIDE. A nonblank unknown header wins over a recognized body; wrong-case reason values, missing reason, other methods/statuses and REGION_MISMATCH_ORG_NOT_ELIGIBLE retain ordinary error classification. Carry a recognized mismatch as safe structured attempt failure to ContactCenter; no raw response/URL event.

Terminal post-auth 401/403 on admission/session stops DR with unavailable/authentication-failed. Offline, 429, 5xx and ordinary transport failures remain caught/paced under the active scheduler; unsuccessful URL validation never opens the old socket or bypasses authorization. Initial failures always reject their own register. Storage/migrations: Not applicable - timer/attempt state is in memory. Tests: T-003 fresh per-attempt URL and 20/30-second boundaries, T-004 fake-clock ordinary/DR pacing/overlap/watchdog, T-005 parametrized reason precedence/case/status matrix; socket supersession and close/error race coverage is mandatory.

## Component: Switch coordination and lifecycle cancellation

**Coverage / task:** REQ-003, REQ-012, REQ-017, REQ-MR-003, REQ-MR-004, REQ-MR-019, AC-003, AC-018; MR-06 and MR-08. ContactCenter owns policy and current identity; Core owns transport installation.

Add `SYSTEM_REGION_SWITCH: 'SYSTEM_REGION_SWITCH'` to the existing backend vocabulary in `src/services/config/types.ts` and internal type:

```ts
type SystemRegionSwitch = {
  type: 'SYSTEM_REGION_SWITCH'; orgId: string; trackingId: string;
  data?: {operation?: 'FAILOVER' | 'FAILBACK'; scope?: 'REGION' | 'ORG'};
};
// src/cc.ts, private implementation signatures
private normalizeRegionSwitch(payload: unknown): SystemRegionSwitch | undefined;
private handleRegionSwitch(event: SystemRegionSwitch): void;
private cancelRegionRecovery(reason: RegionRecoveryErrorCode): void;
private async restoreRegionSession(signal: AbortSignal): Promise<void>;
```

Keep the internal context in `src/cc.ts`, using an internal type in root `src/types.ts` marked `@internal` if a named type is needed: registration generation, captured orgId/agentId, registration AbortController, recovery generation/controller, eligibility (`unknown | disabled | enabled`), optional homeRegion, phase, last snapshot, accepted IDs array/Set, accepted station snapshot/active flag, station revision, state-intent revision, optional pending auto-state, optional RTD controller. Phase values are idle, waiting, subscribing, awaitingWelcome, restoringSession, ready, manualLoginRequired, reloadRequired, unavailable and cancelled. Numbers initialize at zero and only increase; missing optional objects are undefined. No credentials/URLs in the context; station data is internal memory only.

Handle switch envelopes before generic forwarding/logging. Required IDs must be nonblank strings after trimming; compare org to the authenticated active registration identity. Optional recognized enums are copied; unknown values are omitted. A malformed optional data object provides no metadata. Validate before touching any socket. Use an array plus Set with capacity 128, FIFO insertion and oldest eviction. An ignored unknown-eligibility event is not accepted/history-tracked and is never replayed. Disabled/eligible accepted IDs are remembered; duplicates, including A/B/A, do nothing. History is registration/org-scoped, not recovery-generation-scoped, so a distinct valid event can supersede ongoing recovery while duplicates remain suppressed.

Eligible entry is synchronous through the following boundary, with no await:

1. Save the latest accepted station configuration and prior-active flag, and capture the current state-intent revision. Cancel an old auto-state intent while its old context is still current; advance recovery generation and abort the old recovery/restore attempt.
2. Interrupt every still-pending old-generation AQM operation, clear timer/bind ownership, install the command/continuation/media fences and pause/drop RTD delivery. Cancel ordinary scheduling and watchdog. These protections precede publication and the first 100-second wait. Do not wipe Task/store/media state yet.
3. Build recovering/region-switch with accepted metadata and publish it safely. Immediately recheck registration/recovery/org/termination after callbacks. If an observer synchronously calls stationLogout/deregister/register, return without closing/scheduling against its replacement session.
4. Close only the old primary attempt, then start the DR driver and its first scheduled wait. Each callback/await checks ownership again. Valid Welcome invokes ordered station restoration, then resume supported RTD and publish its terminal/current snapshot.

Unknown eligibility: safe diagnostic and return, with no socket action/history/replay/DR state. This includes the entire settings hydration window. A later ordinary disconnect or recognized subscribe mismatch can still act under its own policy, but no recovery is promised for the ignored switch.

Disabled eligibility: stop ConnectionService and RTD work; abort both pending installations; close both sockets with reconnect false; emit unavailable/not-eligible once on changed snapshot. Keep the existing browser line, do not create a line/end contacts/revoke Webex credentials. Host normal deregister remains callable.

At entry to explicit `stationLogout` and `deregister`, cancel recovery and pending auto-state synchronously, clear accepted station snapshot/history as appropriate to teardown, and fence old owned work before the first await. Keep the current primary transport available long enough to correlate an explicit logout request when usable; stop automatic reopen regardless. Deregister then closes both transports through its normal teardown. Logout's own backend request is a new teardown operation permitted by the request gate. Identity replacement is detected on new register and before accepting any async result/event by comparing live credentials to captured org/agent; mismatch invalidates old work. Move the unconditional raw AGENT_MULTI_LOGIN socket-close branch out of WebSocketManager: ContactCenter checks nested AgentMultiLoginCloseSession and matching/absent active session ID, cancels first, then closes/stops transport. A different station-session notification cannot terminate this context. Deregistration retains its existing full host-owned calling/auth-related teardown behavior.

Use one arrow/stored callback for `handleConnectionLost`, primary/RTD messages, task forwarding, incoming calls and voice readiness. Replace affected `.bind(this)`/anonymous registrations with stored references. Reset/stop detaches precisely those references, leaves no interval/watchdog/auto-state listener, and reconnects them once on re-register. Preserve long-lived singleton objects rather than resetting globals behind consumers. No persistence or migration is needed. Tests T-002 and T-012 cover disabled late subscribe, hydration window, 128/129 eviction, superseding events, targeted multi-login, identity replacement, re-register, listener counts and synchronous recovering-observer teardown.

## Component: Request interruption and correlation

**Coverage / task:** REQ-006, REQ-MR-013, AC-013, REQ-MR-012; MR-04/MR-05. All old AQM callers settle immediately at accepted switch; new conflicting commands fail before backend/media work, without automatic replay.

REQ-006 preservation: ordinary AQM requests keep existing authentication/error translation, bindings and Task/XState control ownership; only accepted regional recovery activates the new interruption/gate. T-008 `ordinaryRequestAndTaskOwnershipUnchanged` characterizes that boundary.

Extend the existing AQM factory and keep one retained instance in Services (`public readonly aqmReqs: AqmReqs`, internal). No new request queue class is introduced. Existing routing contact/dialer definitions default to command; agent definitions declare query, session or teardown where appropriate.

```ts
// src/services/core/types.ts, internal fields added without changing required public inputs
type AqmOperationKind = 'command' | 'query' | 'session' | 'teardown';
type AqmRequestContext = Readonly<{generation: number; signal?: AbortSignal}>;
// Req<TRes, TErr> gains these optional fields:
// kind?: AqmOperationKind; context?: AqmRequestContext; correlationId?: string.
// Extend the existing Pending type in place:
export type Pending = {
  check: (msg: Msg) => boolean;
  handle: (msg: Msg) => void;
  alternateBind?: string;
  operationId: string;
  generation: number;
  timeoutId?: ReturnType<typeof setTimeout>;
  reject: (error: Error) => void;
  cleanup: () => void;
  settled: boolean;
};
// AqmReqs internal lifecycle API
public beginGeneration(generation: number): void;
public setRecoveryGate(gate: 'open' | 'recovering' | 'manual' | 'unavailable'): void;
public interruptPending(error: Error): void;
// Extend existing callable aliases with an optional trailing internal context:
export type Res<TRes, TReq> = (
  p: TReq, cbRes?: CbRes<TRes>, context?: AqmRequestContext
) => Promise<TRes>;
export type ResEmpty<TRes> = (
  cbRes?: CbRes<TRes>, context?: AqmRequestContext
) => Promise<TRes>;
```

Retain all current `req`/`reqEmpty` parameters and existing callback behavior for active operations; only the optional trailing internal context is additive. The factory copies this context into the generated Req before makeAPIRequest, defaulting to the active generation when omitted. Register one operation record owning its success/fail/cancel aliases before HTTP dispatch. Its idempotent finish function removes only aliases still pointing at this operation, clears timeout and abort listener, then resolves/rejects once. Never let an old clear closure delete a replacement bind. The alternate-cancel path checks existence/ownership rather than dereferencing an entry already deleted by a success callback. Keep duplicate-operation Pending behavior where no correlation ID is requested. Store even timeout-disabled operations so lifecycle interruption still settles them. AbortSignal cancellation removes only its owned operations; it is also how socket loss interrupts reload/fallback within a still-active recovery generation.

At accepted switch reject all old records with a plain RECOVERY_INTERRUPTED error synchronously; repeated interruption is harmless. After the rejected operation's awaits resume, generation/signal guards must prevent callback, state-machine, cache or media mutation. Race logical cancellation against pending HTTP to settle callers; attach a terminal catch to the underlying request. Passing a local AbortSignal does not claim the host transport can retract an HTTP request. Do not replay non-idempotent commands.

During recovering/manual, default commands reject RECOVERY_IN_PROGRESS; teardown and read-only access remain allowed. Session requests require the current ContactCenter-controlled restore/manual-login phase; public stationLogin is admitted only after transport restoration in manualLoginRequired, cancelling competing auto restore first. Keep synchronous getters unguarded. At Task invalidation, new retained-object actions use STALE_TASK before the broader gate is considered. Interruption reports the operation; region events report shared state.

For agent state, extend the existing internal service input (existing callers remain valid):

```ts
stateChange(p: {
  data: Agent.StateChange;
  requestId?: string;
}, cbRes?: CbRes<Agent.StateChangeSuccess>,
context?: AqmRequestContext): Promise<Agent.StateChangeSuccess>;
```

The ContactCenter state owner supplies a unique `WX_CC_SDK_${uuidv4()}` requestId before dispatch. Forward `Req.headers` through WebexRequest using the already-existing headers API. Set the HTTP `trackingid` header and match nested notification `data.trackingId` to the same request ID in success/failure binds, plus org/agent/session guards. The outer `trackingId` is notification tracking and must not substitute. Add wire contract fixtures that distinguish both values and prove the matching path, including notification-before-HTTP-ack. Do not fall back to event/subtype-only matching when request tracking is absent or different: an uncorrelated frame can remain an authoritative backend notification but cannot complete the wrong Promise. Contract failure is an explicit integration gate, never a self-fulfilling ID mock presented as deployed evidence.

The MR-04 task in `implementation_dag.json` carries `api_contracts`, a machine-readable SDK adapter design projection with operationId, service/method/resource, allowed request values, preconditions and source-path/hash/symbol evidence. Its stationLogin descriptor mirrors the three existing LoginOption values and effective login payload; its automaticAvailable descriptor restricts only the conditional DR action to state Available, auxCodeId 0 and the exact agent-wss-disconnect reason. The general StateChange type remains unchanged. UX api_bindings use this existing JSON deliverable as contract_path and exact pointers under `/tasks/3/api_contracts/operations/`; the descriptor cites the TypeScript producer/type/constant files and requirement as evidence. This is design-time binding metadata, adds no server API or product contract file, and is neither a runtime nor package-test dependency. Existing adapter/type/behavior tests remain the product proof.

State requests are serialized by ContactCenter as described in Deferred auto-Available; late automatic replies cannot settle an explicit operation. Preserve HTTP status/reason/code/tracking before translating it, including the station-login adapter that currently drops reason details. In `src/services/core/Err.ts` extend existing `ErrDetails` with optional `reason?: string` and `reasonCode?: number`; extend only the `Service.reqs.generic.failure` details shape with optional `status?: number`, `reason?: string`, `reasonCode?: number` and `msg?: unknown`, retaining required trackingId. In `src/services/core/Utils.ts` extend getCommonErrorDetails/createErrDetailsObject to retain those fields from the known HTTP envelope before wrapping. The station-login adapter uses the same normalized fields in its existing Err.Details construction. These additions do not change Error class identity, required existing diagnostics or unrelated public backend mappings. Lifecycle errors bypass both public error helpers' lossy translation. No schema/config migration. Tests T-008 cover pending/default/disabled timeout, failure/cancel alias races and >100-second wait; T-007 covers distinct auto/explicit correlation, notification-first HTTP and stale error/success responses.

## Component: Station snapshot and restoration

**Coverage / task:** REQ-004, REQ-006, REQ-009, REQ-MR-010, REQ-MR-011, REQ-MR-012, AC-009, AC-010, AC-011; MR-06. A replacement transport becomes ready only after accepted backend station restoration or manual station login.

REQ-006 preservation: ordinary `silentRelogin` retains its existing authenticated session and calling policy, with no regional Task/store/media wipe or deferred DR auto-state action. T-007 `ordinaryReloginKeepsTasksAndAuth` verifies real owner calls and unchanged task controls; MR-05 owns the control/voice implementations.

Keep orchestration in `src/cc.ts`; reuse `services.agent.reload`, `stationLogin`, `getDeviceId`, `handleDeviceType`, `updateWellnessSession`, `ensureWxAppPostStationLogin`, normal Profile fields and Task hydration. Add internal helpers rather than duplicating the public login path:

```ts
private buildStationLoginPayload(data: AgentLogin): Agent.UserStationLogin;
private rememberAcceptedStation(
  payload: Agent.UserStationLogin,
  response: Agent.StationLoginSuccess | Agent.ReloginSuccess
): void;
private reconcileStationSnapshot(): Agent.UserStationLogin | undefined;
private async applyStationSession(
  response: Agent.StationLoginSuccess | Agent.ReloginSuccess,
  options: {signal: AbortSignal; calling: 'replace' | 'preserve'}
): Promise<void>;
private async restoreRegionSession(signal: AbortSignal): Promise<void>;
private async handleDeviceType(
  deviceType: LoginOption, dn: string,
  options?: {calling: 'replace' | 'preserve'; signal?: AbortSignal}
): Promise<void>;
```

Internal accepted snapshot contains orgId, agentId, station-session revision/optional backend session ID and a copy of the effective UserStationLogin payload. Payload fields retain existing wire types: teamId/teamName nullable strings, siteId string, optional dialNumber/dn/deviceId nullable strings, optional roles string[], deviceType, isExtension boolean, usesOtherDN boolean, and auxCodeId string. For automation require a nonblank accepted team, supported device mode and usable DN/extension when that mode requires it. Browser IDs use `webrtc-${agentId}`. Preserve roles/site flags from accepted data; normal login still sets roles [AGENT], teamName/siteId '', usesOtherDN false and auxCodeId ''. Null/absent optional backend device fields do not erase usable accepted fields unless a successful authoritative mode change requires it. Snapshot is never persisted or logged.

Only backend-confirmed login/reload results update accepted session/snapshot. Failed caller attempts never replace it. A backend-confirmed session discovered by register's existing silent relogin sets prior-active even without a public login in that tab. Ancillary voice readiness is not evidence that the station request failed or succeeded. Before a switch reconcile the snapshot with current accepted currentTeamId/deviceType/dn/extension and backend session identity; never use pending profile-update input or default team[0] in place of currentTeamId. Fallback always builds the effective payload with auxCodeId '' rather than replaying old auxiliary state. Clear snapshot on explicit logout/deregister/identity replacement. Successful profile update uses the same logout/login owners and promotes only successful replacement state.

After replacement Welcome evaluate the first matching branch:

| Priority | Condition captured before switch | Action / snapshot |
| --- | --- | --- |
| 1 | No backend-confirmed active station | Preserve complete Profile; skip station/task wipe and automatic reload/login; resume supported RTD; stationLoginRequired/region-switch. |
| 2 | Prior active and allowAutomatedRelogin false | Preserve accepted config; no automatic reload/fallback login; stationLoginRequired/automatic-relogin-disabled even with no snapshot. |
| 3 | Prior active, automation enabled, required config absent | No automatic session request; stationLoginRequired/session-restore-failed. |
| 4 | Prior active, automation enabled, usable config | Perform post-Welcome regional Task/session-state cleanup, then bounded reload/fallback below. |

Immediate interruption/guards/RTD pause already occurred for every branch. A manual branch keeps conflicting commands blocked and primary transport available. Public stationLogin after transport recovery cancels competing automatic work, invalidates regional task/session owners before applying any replacement data, and can publish ready on success. Invalid manual input rejects normally and keeps the manual outcome; it cannot revive old tasks. Backend task messages must not hydrate into retained old objects. Before post-Welcome cleanup drop old-session work; after cleanup the current replacement socket may hydrate new-generation tasks through existing TaskManager mapping while reload is pending, with command/auto-answer guards still closed. Validate any supplied session identity, publish no region ready until station acceptance, and invalidate these provisional current-generation tasks before a later manual replacement if restoration fails. This preserves real replacement HYDRATE frames without an unrelated frame buffer or reuse of an old Task.

Automatic branch control flow:

1. Check cancellation/identity/primary socket, invalidate regional tasks through TaskManager, clear old station-session state while preserving Profile/static configuration/snapshot. Keep backend task hydration on its existing path for the replacement session.
2. Call reload-agent through existing AQM using `services.agent.reload(undefined, {generation, signal})`; saved fallback uses `services.agent.stationLogin({data: payload}, undefined, {generation, signal})`. The signal is the current socket-attempt child signal, so cancellation/socket loss rejects those exact pending operations immediately rather than waiting for their 20-second timeout. The transport scheduler decides whether to retry another admission. Terminal 401/403 after host auth stops with unavailable/authentication-failed, not fallback login.
3. Only `Service.aqm.reqs.Timeout`, `Service.aqm.reqs.TimeoutEvent`, code 1037/reason INTERNAL_ERROR and HTTP 429/502/503 get four total reload attempts, waiting 2000/4000/8000 ms. Normalize reasonCode numbers/numeric strings explicitly. 1038/AGENT_NOT_FOUND, 1041/AGENT_DN_NOT_REGISTERED and all other non-transient reload failures go directly to saved station login. Exhausted transient retries do the same. No retry of Profile/MR hydration.
4. Submit the saved effective station payload once. If code 1035 or AGENT_SESSION_ALREADY_EXISTS, permit exactly one reload-agent request; its failure requests manual login with no further recursion/retry loop. Other fallback failure requests manual login. Successful fallback or manual login never arms auto-Available from a cached reload reason.
5. Apply successful backend team, device/DN, current state/aux, state/idle timestamps, logged-in flag and wellness session identity, then applicable Webex App effects through existing owners. Guard before/after each awaited effect. Do not preassign Available. Use calling policy preserve only for DR, while existing initial/public/ordinary replace policy remains explicit.
6. For a successful automatic reload, evaluate conditional auto-state against its actual result and DR-entry intent revision. Publish ready/region-switch independently of required voice waiting/auto-state outcome, and restore RTD without holding ready on optional RTD success.

Refactor the shared result application in silentRelogin to remove its preemptive aux assignment after failed Available. Preserve ordinary reconnect's trigger and line-replacement policy; DR-only deferral and outcomes do not leak into ordinary recovery. A line ensure failure is diagnosed through the voice contract and does not itself invalidate a backend-restored usable station or force failed auto-Available to become session-restore-failed. Existing public operation promises still report their own post-login failures. Configuration uses current allowAutomatedRelogin/voice settings; no new opt-in. Tests T-007 cover the complete branch table, register-restored prior station, current snapshot reconciliation/failed attempts/default aux, every transient and direct-fallback reason, one-time 1035 recovery, socket loss, side-effect guards and no early ready.

## Component: Deferred auto-Available

**Coverage / task:** REQ-020, REQ-MR-012, AC-012; MR-07 after MR-04/MR-06. This is a subordinate action on an already-usable DR session, not another transport driver or XState task state.

In `src/cc.ts` retain one optional auto-state record: generation/org/agent/station revision, captured DR-entry intent revision, backend disconnect precondition, unique requestId when dispatched, outcome, stored voice listener and in-flight Promise. A separate `stateIntentRevision` increments synchronously at entry to every public setAgentState, even if that explicit request later rejects. Keep a caught `stateChangeTail: Promise<void>` to serialize dispatch without blocking the event loop. Store at most the current/last automatic request identity for same-session late-response recognition; clear on generation/session replacement.

```ts
private armAutoAvailable(result: Agent.ReloginSuccess, signal: AbortSignal): void;
private async dispatchAutoAvailable(signal: AbortSignal): Promise<void>;
private cancelAutoAvailable(): void;
private async performAgentStateChange(
  data: StateChange,
  context: {source: 'explicit' | 'dr-auto'; intentRevision: number;
    stationRevision: number; generation: number; signal: AbortSignal}
): Promise<Agent.StateChangeSuccess>;
```

Public setAgentState records intent/cancels auto-state immediately, then queues its operation through performAgentStateChange; automatic work calls that internal helper without recording explicit intent. The helper retains existing validation/metrics/AQM ownership and Available browser-voice gate. The state body remains exactly the existing StateChange fields; correlation is an HTTP header/bind, not an invented body property.

Arm only after successful automatic DR reload with exact `result.data.lastStateChangeReason === 'agent-wss-disconnect'`, matching station/generation and no explicit intent newer than DR entry. Other/absent/wrong-case reasons and fallback/manual login omit autoAvailable. Keep restored aux/state/timestamps until backend acknowledgment. If required voice is unavailable, set waitingForVoice, attach exactly one named listener to WebCallingService's existing voice state event and immediately recheck readiness to close the subscribe/check race. DN/extension and any mode where `isBrowserVoiceRequired()` is false dispatch without a voice wait; a registered line with disconnected Mobius still waits.

Before dispatch check generation/session, intent revision, disconnect-state precondition and voice policy. Consume pending work and detach the voice listener before awaiting anything; publish requesting, then dispatch once with its own correlation ID. Only its matching success acknowledgment can report succeeded and apply confirmed Available aux/timestamps. For a local BROWSER_VOICE_NOT_READY failure proven to occur before HTTP dispatch, return to waitingForVoice, reattach once and recheck; it is the same intent, not an automatic retry after a sent request. Any other rejection/timeout reports failed with no hidden retry, no fabricated agent-state failure notification and no claimed rollback. The region session stays ready.

Explicit intent, logout/deregister, identity/station replacement, multi-login, superseding recovery or a newer authoritative backend state invalidating the disconnect precondition cancels waiting/in-flight intent, detaches listeners and publishes cancelled while its old context is current. Consume a sent automatic request's settlement before dispatching a queued explicit request; cancellation cannot retract that request. Catch its rejection so the queue advances. Recheck guards before dispatch and after every await, including voice/queue waits. A cancelled or old-generation completion never publishes a later auto outcome into a replacement session.

Apply agent-state notifications through one ContactCenter reconciliation helper before public forwarding. Match station/org/agent, distinguish the automatic request's own acknowledgment from independent state changes, and never use it as its own cancellation trigger. Maintain latest backend-confirmed timestamps plus accepted request intent/identity to reject an old automatic reply overwriting a newer accepted explicit state, including equal-timestamp ties. A timed-out request might still affect the server: a later valid newer authoritative backend state remains authoritative without resolving a newer request or pretending the timeout proved rejection. Retain succeeded/failed/cancelled until next recovery/session generation. No timer-based Available retry, polling, new voice event or persistent record. Tests T-007 include notification-before-HTTP, duplicate voice callbacks, pre-dispatch voice race, intent during reload/before arming, intent during automatic flight, timeout then late auto reply, every cancellation and acknowledgment-only cache changes.

## Component: Task invalidation and owned media

**Coverage / task:** REQ-006, REQ-MR-014, REQ-MR-015, AC-013, AC-014, REQ-MR-013; MR-05. Existing Task owners enforce commands, later dispose/invalidate resources and disable controls without reporting a backend task end.

Use existing files `src/services/task/Task.ts`, `src/services/task/TaskManager.ts`, `src/services/task/TaskFactory.ts`, `src/services/task/types.ts`, `src/services/task/voice/{Voice,WebRTC,wxAppVoiceMethods}.ts`, `src/services/task/digital/Digital.ts`, `src/services/task/state-machine/uiControlsComputer.ts`. No new Task lifecycle enum/state or host permission layer is needed; stopping the owning actor is an internal resource action, not a TERMINATED transition.

```ts
// src/services/task/types.ts, @internal, not root exports
type TaskRecoveryGuard = Readonly<{
  generation: number;
  signal: AbortSignal;
  assertCommandAllowed: () => void;
}>;
// Task, @internal methods; no new required member on public ITask
public bindRecoveryGuard(guard: TaskRecoveryGuard): void;
public interruptOperations(error: Error): void;
public invalidateForRegionRecovery(): void;
protected assertTaskCommandAllowed(): void;
protected async runTaskOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T>;
protected disposeRegionalResources(): void;
// TaskManager, internal methods
public interruptTaskOperations(error: Error): void;
public invalidateRegionalTasks(): void;
public setRecoveryGuard(guard: TaskRecoveryGuard): void;
public startSession(guard: TaskRecoveryGuard): void;
public stopSession(): void;
// uiControlsComputer.ts
export function disableTaskUIControls(controls: TaskUIControls): TaskUIControls;
```

TaskFactory's complete resulting internal signature is `public static createTask(contact: ReturnType<typeof routingContact>, webCallingService: WebCallingService, data: TaskData, configFlags: ConfigFlags, wrapupData?: WrapupData, agentId?: string, agentName?: string, answerCallOnWebexService?: AnswerCallOnWebexService, apiAIAssistant?: ApiAIAssistant, recoveryGuard?: TaskRecoveryGuard): Task`. Bind the optional trailing guard immediately after constructing any subclass and before publication/HYDRATE/ASSIGN/auto-answer. TaskManager passes the current guard at every factory call. Its setRecoveryGuard changes the creation context without rebinding retained old tasks. startSession at registration sets this context and idempotently attaches its stored primary/incoming-call handlers; stopSession at deregistration/identity replacement/targeted termination interrupts and invalidates old tasks and detaches those handlers. Neither startSession nor stopSession is used for the staged regional wipe; that path uses immediate interruption and later invalidateRegionalTasks. Change its private collection to `Record<TaskId, Task>` and its private setupTaskListeners/removeTaskFromCollection/handleTaskCleanup task parameters to Task (factory already returns Task); public getTask/getAllTasks and ITask stay compatible. Do not rely on optional no-op invalidation for SDK-created tasks.

At switch acceptance `interruptTaskOperations` aborts local operation scopes, cancels auto-answer/auto-wrapup dispatch and prevents task message/media continuations; it keeps task data/actors/resources until the cleanup boundary. Guard TaskManager.handleIncomingWebCall and its deferred mapping work too: a preserved calling line's old call callback must not install a call/Task mapping or answer during the recovery/manual fence. For new calls guard priority is invalidated → STALE_TASK, recovery/manual fence → RECOVERY_IN_PROGRESS, else normal semantics. An operation already running when interrupted rejects RECOVERY_INTERRUPTED immediately and never resolves again. A logical AbortSignal plus guarded underlying completion handles resources that cannot physically abort. Read-only getters retain normal data/shape.

Every mutating Task entry is covered, including subclass overrides and formerly unsupported-channel entries: accept, decline, hold, resume, holdResume, toggleMute, transmitDtmf, end, wrapup, transfer, consult/endConsult/consultTransfer/consultConference, dropConferenceParticipant, exitConference, transferConference, switchCall, pause/resumeRecording and task summary request/response actions. Central Task run/guard helpers avoid duplicating error policy. Guard before backend/media work and after each await before state/cache/actor changes, including automatic answer/wrapup and wxApp mute/DTMF tails/backfill timers. In wxAppVoiceMethods extend the existing dependency object with a lifecycle assertion/captured signal; check inside multi-await helper chains, not just around the outer Voice call. A queued operation must recheck when it actually dispatches. No replay on cancellation.

At post-Welcome automatic cleanup, or before manual replacement session application, TaskManager iterates unique Task instances (aliases can point at one object), invokes idempotent invalidate, clears collection/summary/enablement references, and removes its own named Task listeners. Task invalidate marks stale before calling observers; cancels AutoWrapup, stops the XState actor via stopStateMachine and updates controls through existing updateUiControls. Retain the subscription returned by initializeStateMachine.subscribe as a private unsubscribe handle and release it during stopStateMachine; it is not a new public event or Task state. The pure disable adapter preserves `TaskUIControls = {main: InteractionUIControls; consult: InteractionUIControls; activeLeg: 'main' | 'consult'; consultTransferDestinations: {consult: ConsultTransferDestinationType[]; transfer: ConsultTransferDestinationType[]}}`. Each interaction control has `{isVisible: boolean; isEnabled: boolean}`. Preserve all required accept/decline/hold/transfer/consult/end/recording/mute/consultTransfer/endConsult/conference/exitConference/transferConference/mergeToConference/wrapup/switch fields and optional keypad, retaining optional absence, destination order, active leg and visibility, while setting every present main/consult isEnabled false. No backend state, ContactEnded, successful wrap-up or task:end event is synthesized. `computeUIControls` returns the disabled snapshot for stale tasks so later internal callbacks cannot reenable controls. Cleanup continues in finally/per-task isolation if a consumer UI-controls observer throws. Detach SDK-owned listeners with stored references; do not remove host listeners from a shared emitter.

WebRTC retains the raw getUserMedia stream's SDK-owned tracks as well as LocalMicrophoneStream. Check the captured operation guard immediately after acquisition, before wrapping/installing/answerCall. If stale during the DR wait or after cleanup, stop every newly acquired track and reject the old operation without answering. On invalidation stop already-owned tracks once, clear stream references, and use unregisterWebCallListeners plus WebCallingService.cleanUpCall's non-ending path. Voice disposes wxApp offer observability and invalidates its pending sync/timer continuations. Do not call contact-ending APIs, call.end, decline, the disconnect handler or healthy-line deregistration. Remote/host-owned tracks never enter the owned-track set.

Config/persistence migration: Not applicable - internal flags/AbortControllers/listener sets only. Source compatibility keeps ITask/control/event shapes and existing constructor inputs; the optional factory parameter is internal. Tests T-008 exercise real Task/XState controls and retained objects at both timing boundaries; T-009 resolves media during the long wait and after invalidation, verifies all owned tracks stop, verifies no answer/end and no host-track stop, and covers wxApp chained awaits and auto-wrapup dispatch suppression.

## Component: Browser calling preservation

**Coverage / task:** REQ-006, REQ-013, REQ-MR-016, AC-015; MR-05/MR-06. Reuse a usable line during DR without confusing line/Mobius readiness with the station session.

Add `public async ensureWebCallingLine(signal?: AbortSignal): Promise<void>` inside existing WebCallingService, using existing line, registrationGeneration, registration listeners and voice snapshot. Route `handleDeviceType(..., {calling:'preserve'})` to this method only for DR. The normal replace branch still calls `registerWebCallingLine`.

If browser voice is not required (including disableWebRTCRegistration), return without creating a line. If the existing line is registered/reconnected, retain it and all line/Mobius listeners; disconnected Mobius does not cause replacement of an otherwise registered line. If the calling owner is already connecting/reconnecting, reuse its existing in-flight registration/reconnection ownership rather than starting a competing client; voice may remain unavailable and auto-state waits on the existing voice event. Register only if no usable owned line exists, reusing existing register timeout and generation guards. Store an in-flight ensure Promise so concurrent DR callers cannot replace each other's line. Logical cancellation prevents late result application; it must not deregister an unrelated healthy line created/retained by a new session. Any newly created cancelled line is disposed through the calling owner with identity checks.

`getVoiceConnectionState`, `isBrowserVoiceRequired`, `isVoiceReady`, existing line/Mobius status values and `voice:connectionStateChange` payload remain unchanged. Do not claim voice readiness from primary Welcome or region ready; Available retains its existing policy. Existing calling reconnect remains the sole calling reconnect driver. Failure is diagnosed using existing voice state/metrics without changing a restored backend session into failed restore solely for waiting/failed voice readiness. Storage/migration/new configuration: Not applicable. Tests T-009 cover healthy/absent/reconnecting/disabled lines, Mobius-disconnected readiness, simultaneous ensure, cancellation/identity replacement, and assertions that healthy line.deregister and call.end are never invoked by DR cleanup.

## Component: Realtime restoration

**Coverage / task:** REQ-MR-017, AC-016; MR-08. ContactCenter owns RTD subscription policy; TaskManager and ApiAiAssistant own task-scoped realtime state.

Factor the complete existing feature condition from connectWebsocket into `private shouldSubscribeRtd(profile: Profile): boolean`; add `private pauseRtd(): void` and `private async resumeRtd(signal: AbortSignal): Promise<void>` in `src/cc.ts`. The condition is realtimeTranscripts.enable OR suggestedResponses.enable OR generatedSummaries.wrapUpSummariesEnabled === true OR generatedSummaries.consultTransferSummariesEnabled === true OR isWellnessBreakEnabled. No new supervisor/grid/queue feed or RTD reconnect interval.

On eligible entry fence RTD delivery and cancel its admission before closing the old socket. Tag callbacks with the active RTD epoch/registration/session and drop old messages before wellness forwarding, feature buffers, summary resolution or transcript delivery. At full Task cleanup clear summary/feature caches using TaskManager.clearAISummaryState; at immediate pause cancel any still-pending RTD request/continuation that could complete an old Task. Extend existing `ApiAiAssistant.clearAllRtdRequests(error?: Error): void` compatibly to accept RECOVERY_INTERRUPTED for this path, and add `public setRecoveryGuard(guard?: Readonly<{generation: number; signal: AbortSignal}>): void` as an internal method. Keep normal callers' existing clear error behavior; capture the guard at each request and check it before/after HTTP awaits and before registering a pending RTD request or sending a summary/transcript continuation. No old request can install a new pending RTD record after clearing.

Resume with a fresh RTD_SUBSCRIBE_API admission after station recovery, or after the no-prior-station branch's transport recovery. For automation-disabled/missing-config branches with a prior station, keep task-oriented RTD paused until manual station login succeeds. The no-prior branch can receive supported non-task features; nonexistent/invalidated tasks never receive summary/transcript data. Use current complete Profile flags, reuse WebSocketManager deadlines/URL validation and retain exactly one RTD message callback. RTD failure is caught/diagnosed and never rejects a ready station or register; no station ready wait depends on RTD. Session teardown clears RTD epoch/controllers/listeners. No durable storage or new subscriptions/configuration. Tests T-010 cover all feature flags, no-prior resume, prior manual delay, new URL, stale feature/wellness/summary delivery, late HTTP registration of RTD requests and failure containment.

## Component: Host restart integration

**Coverage / task:** REQ-MR-009, AC-008; MR-06/MR-09. SDK controls no page navigation; the documented host sample demonstrates a bounded restart.

In ContactCenter add `private requireRegionReload(signal: AbortSignal): void`: on the first recognized subscription mismatch in the current generation, invalidate attempts/session work, cancel timers/listeners, interrupt operations, disable conflicting commands and emit reloadRequired/region-mismatch. Reject an interrupted initial register with plain Error/data.reason REGION_RELOAD_REQUIRED; do not wait on event consumption to settle it. Record the generation's emitted terminal outcome before callbacks. A repeated catch/callback for the same generation does not emit twice; no SDK window.location call exists.

Extend `docs/getting-started.md` with a self-contained TypeScript host event example before register, using named onRegionState and matching off at teardown. Extractable code block marker `region-recovery-host-example` lets existing cc unit tests execute its restart helper with fake dependencies; it is documentation, not a new production UI module. Helper signature in the example:

```ts
function decideRegionRestart(
  orgId: string, now: number,
  storage: Pick<Storage, 'getItem' | 'setItem'>
): 'restart' | 'blocked';
```

Use per-tab sessionStorage key `ccsdk:region-reload:${orgId}`. Validate nonblank authenticated org and finite now; read the previous timestamp. A valid timestamp less than 120000 ms old blocks; a future timestamp also blocks conservatively for clock rollback. At exactly 120000 ms a restart is allowed. Persist the new timestamp successfully before returning restart; unavailable/throwing storage, malformed nonempty guard data or invalid time fails closed to blocked. Missing guard data allows the first restart. Do not clear it during ordinary SDK teardown. The host executes its navigation only for restart and surfaces repeat failure/manual restart guidance for blocked; it never triggers backend failover or an SDK rollback. Handle operation rejections independently, replace snapshots rather than merge unknown region data, use task.uiControls for task actions, and offer manual station login only after the transport-restored outcome.

Presentation itself is host-owned: document semantic status/error announcements, station-login entry and existing state action for failed autoAvailable without supplying markup/provider/route. DOM/a11y/browser rendering for a host UI is Not applicable - none is delivered. Restart storage tests are deterministic unit contracts, not a live reload/drill/browser test. T-006 runs the exact example decision helper across same/new orgs, fresh reload contexts, 119999/120000 ms, future timestamps and throwing storage. Persistent SDK migration: Not applicable - only the example host's per-tab timestamp is persisted.

## Component: Failure isolation and diagnostics

**Coverage / task:** REQ-007, REQ-MR-020, REQ-MR-021, AC-019, AC-020; MR-09, with transport/error foundations in MR-01/MR-03/MR-04. Preserve safe structured classification and compatibility while ensuring diagnostics/observers cannot own recovery success.

Use LoggerProxy and MetricsManager; do not add a telemetry service. Extend root METHODS and each owning constants METHODS for added methods. Add `REGION_RECOVERY_SUCCESS: 'Region Recovery Success'` and `REGION_RECOVERY_FAILED: 'Region Recovery Failed'` to metrics/constants.ts and corresponding taxonomy in behavioral-events.ts (existing product, agent `user`, target `region_recovery`, verbs complete/fail). Use existing STATION_RELOGIN_SUCCESS/FAILED for actual reload result tracking rather than redeclaring them. Stages/settings reads/ignored events/retry outcomes use safe stage/outcome fields and the recovery pair where a completed attempt is being measured; waiting/cancel/drop are diagnostic outcomes, not fabricated backend/session failures.

Add a private best-effort diagnostic helper in cc.ts with full signature `private recordRecoveryDiagnostic(stage: string, outcome: string, attempt: number, startedAt: number, failure?: RecoveryFailure): void`. Payload is only stage, outcome, attempt, elapsedMs (nonnegative), optional safe status/reasonCode/id/trackingId. Sanitize bounded remote strings using sanitizeForObservability, allowlist classified reasons, and never pass a raw Error/response/event/settings/station snapshot to LoggerProxy, MetricsManager or log upload. Wrap metrics timing/tracking and logging on all affected recovery/session paths so a thrown diagnostic cannot change classification, escape cleanup or convert backend success to failure. Time cancellation clears outstanding MetricsManager timers via its existing cancelTimedEvent.

Affected WebSocketManager connect/failure/RTD logging must omit query strings and credentials even when an error string itself embeds a URL. Prefer constant messages and normalized status/reason over `${error}`/raw event interpolation. A diagnostic URL, if necessary, is constructed from protocol and hostname only, never userinfo/search/hash; serving-region parsing reads hostname directly. Do not log raw tracking envelopes, DN snapshots, bearer headers or media. Reuse public trigger ownership and catch observer exceptions at new/affected public publication points after internal state is applied. Each cleanup owner uses finally and per-resource catches to finish releasing all resources. No assertion that an exception-free log means feature success.

Terminal auth after the existing host refresh has different scope: MR read → unknown only; primary admission/session restore → stop active recovery and unavailable/authentication-failed; optional RTD → diagnostic only. Keep structured status/reason/tracking metadata until that decision, with no endless auth loop or proactive global credential revocation. Unexpected unrecoverable orchestration failures emit unavailable/recovery-failed; recoverable transport failures remain paced. Public promises/events remain separate and existing voice/backend failure events are not fabricated for local guards.

Tests T-012 inject observer/logger/metric exceptions at entry, each cleanup and successful restore, plus offline/429/5xx/terminal-auth at each dependency. T-013 asserts no query/token/DN/media secrets on success/error/retry/cancel/unknown-event paths and checks additive exports and old consumer signatures. Schema/configuration/persistence migration: Not applicable - no new dependency or stored payload.

## Component: Documentation and engineering verification

**Coverage / task:** REQ-002, REQ-008, REQ-022, REQ-023, REQ-024, REQ-025; MR-09 host guidance, MR-10 product verification and MR-11 canonical documentation. Package maintainers own implementation/proof; host developers own presentation, navigation and manual station entry; platform owners own APIs/entitlement; QA/operators own AC-021; agents consume honest outcomes.

MR-09 updates package README/getting-started guidance, the exact host example and its product tests. MR-11, dependent only on completed MR-09, updates the canonical files listed in its own DAG `files` array: architecture contract index with `contact-center-region-recovery` and its types/event/errors, dependencies and changed flows; the eight affected owning module specs with WHAT/WHY, signatures, failure/lifecycle and named test evidence; docs/specs registry; manifest contract registration and runtime/content-fingerprint provenance. Keep existing as-built content by meaning, create no new module and retain Partial coverage. Git-derived manifest fields are excluded from both nodes’ edits. Do not recreate or edit the historical ai-docs tree. Unaffected utilities/docs/ADRs and root monorepo setup remain unchanged; root proposal requirement/plan/evidence remain authoritative input, not generated output targets.

Fresh canonical provenance records only flow-supplied identities from the actual authorized generator/validator invocation and current source/spec content fingerprints, never copied historical runtime/model/run IDs. The current design’s Codex authorship does not identify a future invocation. `validation.source_commit`, `validation.base_ref` and any other commit- or branch-keyed provenance are delivery/flow-owned and remain unchanged by MR-09/MR-11; implementors must not set or derive them, create or inspect commits, or present those historical fields as identifying changed uncommitted content. No acceptance command or prerequisite depends on Git metadata. Current manifest `minimum_independence` is different-runtime; its stored validator UUID is historical and not an executable. Generator structural conformance and same-runtime inspection cannot substitute for authorized independent semantic validation. New evidence must cover current source/spec fingerprints, C1–C6, K1–K4 and X1–X3, no Blocking findings and explicitly retained other findings. Keep findings drafts unless separately authorized to publish. The flow checks these integrations at MR-11, after MR-09; unavailable integration blocks only that canonical-spec stage and cannot block MR-09 product behavior or MR-10 package verification.

The implementation report must distinguish prerequisite failures, baseline failures, executed feature tests, independent spec review and human live results. Positive authoritative organization-setting payload, independent-reader failure-isolation proof and compatibility review remain release evidence. Constructed local contract fixtures must be labelled as such. AC-021 is mandatory for release and remains not executed until QA/platform owners provide actual failover/failback records for DN/extension/browser, with org entitlement, timestamps, deployed versions, placement, station results, new-call and supported RTD/voice evidence. No local result proves active-call audio continuity.

Automatic rollout is backend entitlement plus a compatible SDK release; a new register sees changed entitlement, without polling or public refresh. Backend false stops that newly hydrated session's switch recovery; dependency failure retains unknown rather than changing backend entitlement. Existing auth/voice/Webex App configuration retains its own authority. Rollback is the delivery owner's compatible SDK release rollback and backend entitlement management, not a client-side toggle added here.

Product checks are only the package-scoped MR-01–MR-10 build/unit/style commands and focused tests below. MR-09’s T-013 `docContractLinksAndExactHostExample` checks its delivered host guidance/API links and exact example; it must not depend on MR-11’s later canonical registration. MR-11 has a separate read-only documentation/registry consistency command; generator conformance, current content fingerprints and actual independent semantic validation remain required flow-owned evidence before the canonical stage completes. Its preflight receipt or structural command alone cannot pass semantic review. MR-10 depends only on MR-09 and can execute while MR-11 is unavailable. Reports distinguish product checks, canonical-stage gate results and live release evidence. No test requires a clean tree, commit, push or Git metadata. Git delivery requirements remain flow-owned with REQ-001 explicitly Out-of-Scope.

## UX Evidence and Productionization

Input UX manifest SHA-256 is `bb01be61947a298dab541edb57d1c2bb223357916fe45ffd0fb59ffe44d10211`; UX source identity is `6c114b9456be9f9d671e4452876d9c1dba0631fa7d642b58f30700ed714ba1f7`. Retain its maximum five visual iterations and 0.5% pixel-diff limit wherever visual evidence applies; this library design does not change that policy. The only listed source was inspected in full: `requirement://sha256/a3b4d3ae7a0163e1fb145f4a8b36a6a2858490a1544e6fca99561239f57a4bb5`, physically root `requirement.md`, matching SHA-256 verified during authoring. Source ID `ux-requirement-description`, kind description/feature_specification, structural fidelity, capture_required false. Observations are source prose/API contracts, not an observed application screen:

| Evidence locator | Observed in source | Retained / productionized |
| --- | --- | --- |
| requirement.md:L88-L137 | region:stateChange name, five statuses, reasons, complete optional metadata and separate autoAvailable outcomes/errors. No UI labels, layout, route, controls or visual states supplied. | Preserve public contract exactly; implement SDK snapshots/types and document consumer state handling. Do not assert a rendered screen or pixel match. |
| requirement.md:L189-L193 | Host owns restart; one org/tab restart per 120 seconds, SDK cannot reload. | Implement SDK notification and a tested documentation example; host chooses its UI/navigation policy. |
| requirement.md:L207-L224 | Manual login policy, voice-deferred state intent and backend acknowledgment requirements. | SDK events/guards/state request ordering; no generated login form, voice overlay or Available button. |
| requirement.md:L228-L244 | Read-only getters remain; task commands fenced; invalidated actions disabled through TaskUIControls with no fake task-end. | Keep existing Task/TaskManager/XState contracts and deterministic controls tests. |

Executed read-only `mb-flow prog-mini-js ux-contract-context`; returned source_contract_sha256 `1151b7dc4cef69caded68a5958263ceaddc852ec8de66193f8994406ad05c3e2` and requirement hash matching the supplied manifest. `implementation_dag.json.ux_contract` instantiates the returned schema (schema_version, observations, states, deviations, prohibited_states). It does not copy a JSON Schema into a data field. The inspected source is prose only: its observations are the table above, witnessed by the exact requirement.md hash and line locators, while the contract's visual `observations` array is empty. The inspected runtime intentionally excludes description/feature_specification sources from visual observations. Target SDK states have basis requirements_design, empty visual source/observation IDs, exact requirement IDs/design headings and derivation reasons; they are not fabricated source screens. Every target binding names the SDK mount, owner task and externally observable contract. Server actions map to the structured SDK adapter design contracts under MR-04 api_contracts in implementation_dag.json, with exact operation IDs and allowed-value pointers derived from the inspected TypeScript services/types/constants; restart has a host navigation effect and no backend rollback/failover binding. Explicit prohibitions are retained, including SDK reload, transport-only ready, synthetic task end, stale media answer and pre-ack Available.

Figma acquisition mode none; no hosted/prototype/screenshot/Figma/local visual sources, no sealed scene-graph queries, no visual extraction or screenshot acquisitions apply. Figma MCP was not used. Acquisitions are empty; sealing hosted acquisitions is Not applicable - no hosted/Figma source was supplied. No observation invents visual evidence or changes capture requirements.

Production routes/components/providers/styles/fonts/assets, responsive breakpoints, hover/focus/active states, semantic HTML/ARIA, keyboard order/shortcuts, focus management, screen reader live regions, contrast, reduced motion, localization and content overflow: Not applicable to an SDK with no rendered UI. Host documentation recommends announcing recovering/action-required changes in a status region, preserving keyboard access to login/logout/state actions, not relying only on color and clearing omitted metadata; it does not prescribe an unowned host implementation. Browser/component journeys, automated a11y and pixel screenshots are required if a host UI is separately implemented, not evidence that this library-only DAG can honestly create.

Loading and empty-state guidance remains host-owned: a pending register/stationLogin Promise or recovering snapshot can drive existing loading presentation; no new loading status is added to RegionRecoveryStatus. A successful registration with no prior station leads to stationLoginRequired, while unknown region metadata remains omitted and an empty Task collection remains readable. Error/unavailable and reloadRequired outcomes require the host to surface the stated action without reporting ready. Host documentation must describe a screen reader status announcement for these changes and preserve the existing keyboard path to manual login, state actions and logout; this SDK task adds no rendered control or host application.

The supplied flow retains `ux_required:true`. The current harness evidence contract expects `raw-render.json`, a browser PNG/DOM with `capture_kind` production-component/production-route/production-story, `mount.entry` and visible `ux_controls`. These eleven library states have no such rendered surface. Before MR-01 or any task, the required root `authorized-library-only-ux-evidence` prerequisite reads a flow-supplied `CCSDK_UX_PREFLIGHT` receipt confirming that the runner accepts all eleven `requirements_design` states and the assertion-by-assertion Jest evidence below without `raw-render.json` or rendered captures. The flow owner must actually resolve that capability conflict in the admitted integration; implementors cannot self-approve it, fabricate captures or synthesize a UI. Missing/invalid receipt or a runner still requiring those captures returns an environment/gate result before product work. UX API bindings continue to resolve against the SDK-adapter projection in MR-04. All task acceptance phases remain implementation; no UX phase defers code/tests or claims visual, live-wire, independent canonical or AC-021 success.

Each DAG `ux_contract.states[].assertions` string names its non-visual Jest evidence and owning product task. Assertion numbers below are one-based and preserve the DAG order; all suite paths are relative to `test/unit/spec/`. These are implementation obligations, not executed-test claims.

| Library state | Assertions → named Jest evidence / owner |
| --- | --- |
| recovering | A1 → T-008 `services/core/aqm-reqs.ts::entryInterruptBefore100sWait` / MR-04, MR-06; A2 → T-008 `cc.ts::recoveringCommandsBlockedBeforeIo` and `manualLoginAndGettersAllowed` / MR-06; A3 → T-012 `cc.ts::observerReentrantLogoutDeregister` / MR-06, MR-08. |
| ready | A1 → T-007 `cc.ts::noEarlyReady` and T-011 `cc.ts::socketOnlyNeverReady` / MR-06; A2 → T-011 `cc.ts::unknownMetadataClearsPriorValues` and `enabledOnlyLimitedService` / MR-06; A3 → T-007 `cc.ts::voiceDeferredReadyAndSingleDispatch`, T-010 `cc.ts::rtdFailureLeavesCoreReady` and T-011 `cc.ts::completeSnapshotEachAutoOutcome` / MR-06, MR-07, MR-08. |
| stationLoginRequired | A1/A2 → T-007 `cc.ts::orderedPolicyCombinedCases` (assert branch precedence and zero automatic requests on each earlier manual branch) / MR-06; A3 → T-007 `cc.ts::manualLoginFailureStaysManualAndSuccessReady` and T-011 `cc.ts::firstStationLoginReady` / MR-06. |
| reloadRequired | A1 → T-005 `cc.ts::registerRejectAndSingleReloadSnapshot` and T-006 `cc.ts::firstRestartStoredBeforeNavigation` / MR-06, MR-09; A2 → T-005 `cc.ts::registerRejectAndSingleReloadSnapshot` / MR-06; A3 → T-006 `cc.ts::perOrgPerTabPersistsAcrossReloadContexts`, `119999Blocked120000Allowed` and `clockRollbackAndStorageFailureBlocked` / MR-09. |
| unavailable | A1 → T-002 `cc.ts::disabledStopsBothTransportsKeepsLine` / MR-06; A2 → T-012 `cc.ts::readerVsPrimaryVsRtdAuthBoundaries` / MR-08, MR-09; A3 → T-002 `cc.ts::lateDisabledSubscribeCannotInstall` and T-003 `services/core/websocket/WebSocketManager.ts::supersededHttpOpenWelcomeInert` / MR-03, MR-06. |
| autoAvailable-waitingForVoice | A1/A2 → T-007 `cc.ts::voiceDeferredReadyAndSingleDispatch` and `exactDisconnectAutoStateOnly`; complete metadata → T-011 `cc.ts::completeSnapshotEachAutoOutcome` / MR-07. |
| autoAvailable-requesting | A1 → T-007 `cc.ts::voiceDeferredReadyAndSingleDispatch`; A2 → T-007 `cc.ts::explicitIntentBeforeArmAndDuringFlight`; complete metadata → T-011 `cc.ts::completeSnapshotEachAutoOutcome` / MR-07. |
| autoAvailable-succeeded | A1/A2 → T-007 `cc.ts::exactDisconnectAutoStateOnly` and `authoritativeStateReconciliation`; complete metadata → T-011 `cc.ts::completeSnapshotEachAutoOutcome` / MR-07. |
| autoAvailable-failed | A1 → T-007 `cc.ts::timeoutLateReplyCannotCompleteExplicit`; A2 → T-007 `cc.ts::voiceDeferredReadyAndSingleDispatch`; A3 → T-007 `cc.ts::timeoutLateReplyCannotCompleteExplicit` and `authoritativeStateReconciliation`; complete metadata → T-011 `cc.ts::completeSnapshotEachAutoOutcome` / MR-07. |
| autoAvailable-cancelled | A1 → T-007 `cc.ts::explicitIntentBeforeArmAndDuringFlight` and T-012 `cc.ts::everyTerminationDuringEveryAwait`; A2 → T-007 `cc.ts::timeoutLateReplyCannotCompleteExplicit` and T-012 `cc.ts::lateHttpWelcomeReloadMedia`; complete metadata → T-011 `cc.ts::completeSnapshotEachAutoOutcome` / MR-07, MR-08. |
| invalidated | A1 → T-008 `services/task/{Task,TaskManager}.ts::postWelcomeStaleTaskDisabledControlsNoEnd`; A2 → T-009 `services/task/voice/WebRTC.ts::lateMediaDuringWaitAndAfterWipeStopsTracks`, `hostTracksUntouched` and `noAnswerEndOrHealthyDeregister` / MR-05. |

## Cross-Cutting Concerns

**Concurrency and resources.** Registration, recovery, transport-attempt, station-session, Task operation and RTD epochs have distinct owners. Abort invalidates a lifetime; guards check both captured identity and epoch after every await, including catch/finally state mutations, so an old registration failure cannot clear a replacement wellness/session/profile state. Ordinary timer work is suspended during DR, the active attempt includes session restoration, and state mutation has its own serialized tail. Event handlers do not await UI callbacks. Complete cleanup owns resolve/reject/timers/listener references, workers/Blob URLs, Task actors/owned tracks and RTD request maps. Disposal is idempotent and does not remove host-owned resources. No retry loop or timer can restore a deliberately ended/replaced session.

**Configuration and persistence.** No new SDK config/feature flag, Profile field, browser-hosting requirement, schema, package, lockfile, module format or build change. Backend entitlement result, accepted history and station snapshots are memory scoped. Host sample uses only a timestamp in per-tab sessionStorage; no token/DN is stored. Null/undefined are runtime-checked despite non-strict TS configuration. Existing `disableWebRTCRegistration`, `allowAutomatedRelogin`, Webex App settings and authentication remain independently authoritative.

**Trust and security.** Host Webex credentials/authenticated service resolution are reused. Org/agent/session validation precedes changes. Admission alone supplies a trusted socket URL; the region label set is metadata only. No replacement URL is read from switch events, no region URL rewrite, no private U2C catalog mutation or per-retry forced catalog refresh. Logs/events never expose signed query data or saved station payloads.

**Runner admission, outside SDK implementation.** Root prerequisites check checkout/package access, Node 22.14.x, Yarn 3.4.1, installed/compiled workspace dependencies and library-only UX acceptance before MR-01 or any task. Check authorized independent spec-validation integration only at MR-11. Dependency installation and its root `patch-package && husky install` postinstall, including Husky’s `core.hooksPath` write to `.git/config`, are runner-owned environment preparation, never acceptance or prerequisite probes. Fresh/outdated dependency compilation also stays with the runner. Root flow `yarn run build`/`yarn run test` operate beyond this package and are not required acceptance. Authoring observations: PATH node was v22.23.5, Yarn 3.4.1, and `/Users/rsarika/.nvm/versions/node/v22.14.0/bin/node --version` reported v22.14.0; the runner selects 22.14 rather than weakening the requirement. No install/build was run in this design-only task. Build uses legacy Babel CLI, @webex/calling tsc and Contact Center declaration emit; Jest uses mocked WebSocket/Worker/media. Read-only dependency probes require no daemon, browser, audio device, tenant or network fixture. Existing credentialed `test:e2e` is outside local acceptance.

MR-11’s `authorized-independent-canonical-spec-validation` prerequisite is a read-only flow-owned preflight receipt check. The runner supplies `CCSDK_VALIDATION_PREFLIGHT` pointing to current JSON `{schema_version:1, authorized:true, integration_checked:true, repository_access:true, generator_runtime:string, validator_runtime:string, minimum_independence:"different-runtime", target_package:"packages/@webex/contact-center"}`. Require distinct nonblank runtime identities; historical UUID copying/same-runtime review does not qualify. Missing receipt/integration is a canonical-stage environment/gate failure; it does not block MR-09/MR-10 product results. These are runner-only fields, never SDK configuration. Before canonical-stage completion the flow checks actual generator/validator invocation identity, current source/spec content fingerprints and actual independent semantic results; a receipt alone is not validation. No check depends on `source_commit`, `base_ref` or another commit/branch field, and these remain unchanged. No implementor creates or inspects commits.

The independent root `authorized-library-only-ux-evidence` prerequisite requires `CCSDK_UX_PREFLIGHT` pointing to a flow-issued JSON receipt with `schema_version:1`; `authorized`, `integration_checked`, `repository_access`, `library_scope_accepted` and `ux_required` all true; `target_package:"packages/@webex/contact-center"`; `basis:"requirements_design"`; `evidence_mode:"non-visual-jest"`; `rendered_captures_required:false` and `raw_render_required:false`. Its `source_contract_sha256` and `requirement_sha256` must equal the current DAG UX contract and actual requirement bytes, and `accepted_state_ids` must list each of the current eleven state IDs exactly once. The flow attests that its UX verifier supports that evidence policy, including the named Jest assertion owners above. The implementation does not generate this receipt or `raw-render.json`. If the current runner cannot accept this scope, it stops before MR-01 with an environment/gate result; canonical validation’s separate receipt cannot satisfy UX admission.

**Validation scope.** Requirements lint executed read-only: PASS, 16/16 basic checks, 21/21 normative mappings, no poison-language findings. This is structural evidence; it does not close deployed wire evidence, runtime-independent review or live release acceptance. Current code, adapter types and tests ground the target signatures; data fixtures, correlation echo and release compatibility remain mandatory proof at their stated levels. No source/tests/config/canonical specs are changed by this design phase.

## Test Strategy

All suite paths in this section and every `--targets` value are relative to the package `test/unit/spec/` directory; commands run from workspace root. Use the package's existing Jest 27 runner and real SDK collaborators, with mocked external HTTP/WebSocket/Worker/Webex calling/media boundaries. Extend existing mirrored test files, use jest fake timers and it.each for more than three similar cases, exact payload assertions and manually controlled deferred Promises for race ordering. Keep the package's 85% branch/function/line/statement thresholds; do not disable coverage or weaken commands. Pin existing ordinary timing, Profile aggregation, calling replacement, voice gate, task hydration and error mapping behavior in the same affected suites before changing it, because all affected modules are Partial.

| Test | AC coverage | Discoverable suite and named scenarios |
| --- | --- | --- |
| T-001 | AC-001/002 | `services/config/{index,Util}.ts`, `cc.ts`: authoritativeArrayFirstOnly, legacyDisabledNotAggregateOmission, unknownMalformedFirst, fiveBoundedReads, terminalReaderAuthIsolation, completeProfileUnaffected, oneCyclePerRegister, oldOrgHydrationDiscarded. |
| T-002 | AC-003 | `cc.ts`: invalidEnvelopeNoSocketAction, unknownHydrationNoReplayOrHistory, disabledStopsBothTransportsKeepsLine, lateDisabledSubscribeCannotInstall, acceptedHistoryABAAnd129, distinctSwitchSupersedes. |
| T-003 | AC-004/005 | `services/core/websocket/WebSocketManager.ts`: freshAttemptOwnsUrl, preservesIntHeaderAndAllowlist, preservesHostAuthentication, rejectsSubscribeFailure, subscribe20sWelcome30s, closeBeforeWelcome, supersededHttpOpenWelcomeInert, workerAndBlobOwnership. |
| T-004 | AC-006 | `services/core/websocket/connection-service.ts`: ordinaryFiveSecondSlots50sWatchdog, ordinaryReconnectDoesNotEnterDrPolicy, noOverlapUnderSlowAttempt, dr100603015WithFreshJitter, noDrWatchdogAt50s, repeatFinalDelay, restoreSocketLossReschedules, stoppedDriverNeverReopens. |
| T-005 | AC-007 | WS/cc suites plus `services/core/Utils.ts`: eachExactMismatch, headerNameCaseInsensitiveValueCaseSensitive, trimFirstNonblank, unknownHeaderDefeatsBody, errorReasonFallback, excludesOther409StatusAndOperation, registerRejectAndSingleReloadSnapshot. |
| T-006 | AC-008 | `cc.ts`: execute actual host example helper; perOrgPerTabPersistsAcrossReloadContexts, firstRestartStoredBeforeNavigation, 119999Blocked120000Allowed, clockRollbackAndStorageFailureBlocked. No host UI/browser scaffold. |
| T-007 | AC-009–012 | `cc.ts`, `services/agent/index.ts`, `services/core/aqm-reqs.ts`: acceptedSnapshotReconcilesLatestTeamDeviceDn, failedLoginDoesNotPromote, defaultAuxNotReplayed, registerRestoredCountsActive, orderedPolicyCombinedCases, manualLoginFailureStaysManualAndSuccessReady, ordinaryReloginKeepsTasksAndAuth, allReloadAllowlistAnd1035Paths, backendSessionEffects, noEarlyReady, exactDisconnectAutoStateOnly, voiceDeferredReadyAndSingleDispatch, explicitIntentBeforeArmAndDuringFlight, timeoutLateReplyCannotCompleteExplicit, authoritativeStateReconciliation. |
| T-008 | AC-013 | `services/core/aqm-reqs.ts`, `services/task/{Task,TaskManager}.ts`, Task subclasses: entryInterruptBefore100sWait, ordinaryRequestAndTaskOwnershipUnchanged, noSecond20sTimeoutSettlement, aliasCleanupCannotDeleteReplacement, recoveringCommandsBlockedBeforeIo, manualLoginAndGettersAllowed, postWelcomeStaleTaskDisabledControlsNoEnd, lifecycleErrorDataReasonPreserved. |
| T-009 | AC-014/015 | `services/WebCallingService.ts`, `services/task/voice/{WebRTC,Voice,wxAppVoiceMethods}.ts`, `services/task/digital/Digital.ts`, `services/task/TaskFactory.ts`, `services/task/state-machine/uiControlsComputer.ts`: lateMediaDuringWaitAndAfterWipeStopsTracks, existingOwnedTracksDisposed, hostTracksUntouched, noAnswerEndOrHealthyDeregister, chainedWxAppContinuationGuarded, preserveEnsureDisabledLine, duplicateEnsureAndCancelledCreate. |
| T-010 | AC-016 | `cc.ts`, `services/ApiAiAssistant.ts`, `services/task/TaskManager.ts`: allFiveFeatureConditions, freshRtdAdmissionAfterSession, noPriorStationResume, manualPriorStationDefers, oldRtdCannotResolveNewSummary, lateHttpCannotRearmClearedRequest, rtdFailureLeavesCoreReady. |
| T-011 | AC-017 | `cc.ts`, WebSocketManager suite: all13ExactLabels, normalizedHomeServingComparison, enabledOnlyLimitedService, unknownMetadataClearsPriorValues, firstStationLoginReady, socketOnlyNeverReady, completeSnapshotEachAutoOutcome. |
| T-012 | AC-018/019 | cc/transport/AQM suites: everyTerminationDuringEveryAwait, targetedMultiLogin, reRegisterListenerCardinality, observerReentrantLogoutDeregister, lateHttpWelcomeReloadMedia, readerVsPrimaryVsRtdAuthBoundaries, offline4295xxPacing, throwingObserverLoggerMetricsCannotStopCleanupOrSuccess. |
| T-013 | AC-020 | `index.ts`, `services/core/Utils.ts`, `metrics/behavioral-events.ts`, cc/WS suites: additiveRecoveryExportsAndTypedConsumer, plainErrorCatalogRoundTrip, oldPublicSignaturesVoiceControls, noSecretsInAllAffectedDiagnostics, docContractLinksAndExactHostExample. |

Names above are describe/it scenario contracts to add, not existing passing-test claims. Also extend the existing Task state-machine regression suite for actor-stop/no fabricated terminal-event interaction; ordinary HYDRATE mapping, conference/wrap-up and TaskUIControls behavior remain covered by its existing tests. The new disable adapter tests every control/leg/destination field without snapshot-only assertions. In-process integration in cc.ts must construct actual ContactCenter/Services/AqmReqs/TaskManager/WebSocketManager wiring (reset singleton references only in test setup as existing tests do), mock only platform/calling boundaries and drive switch → wait → Welcome → reload → ready/manual plus teardown. Detached doubles of a new coordinator cannot satisfy T-007/T-008/T-012.

Type/contract checks extend existing `test/unit/spec/index.ts` TypeScript compiler/API assertions and the package declaration build. Compile additive imports and complete snapshot unions while preserving old consumer expressions; no new TS project/reference/config is needed. Runtime contract fixtures test actual Webex `response.body` arrays and state request header → nested tracking identity with different notification IDs, no-header/body coercion, and early notifications. They establish local adapter behavior; release still requires independently supplied authoritative wire evidence.

Focused DAG commands use documented `--targets` paths relative to `test/unit/spec/` (quoted glob sets are supported by the inspected legacy collector), keeping the configured runner and thresholds. The final MR-10 gate executes, from workspace root, `yarn workspace @webex/contact-center build:src`, then full `test:unit`, then `test:style`. Fresh/outdated dependency builds use the documented `compile` as runner-owned environment preparation; no hidden installation/network fixture is assumed. Focused failures due to thresholds or baseline tooling remain failures; they are not masked with `|| true`, no-test success or coverage overrides.

No frontend/browser/a11y/visual suite applies to SDK product acceptance; the mandatory UX input is documented without inventing UI. No expensive browser suite is duplicated. AC-021 and live test:e2e are not local dependencies. MR-11 canonical structural conformance and independent semantic validation execute via the admitted flow integration after its documentation changes; missing integration halts only that stage, while MR-10 depends only on MR-09. The MR-11 documentation/registry consistency command is separate from SDK product acceptance. Root flow `yarn run build`/`yarn run test` and dependency installation are not required product acceptance. Product tests and acceptance work on uncommitted implementation files, without Git inspection as a pass criterion.

## Implementation DAG Summary

| Task | Order / dependency rationale | Product output and traceability |
| --- | --- | --- |
| MR-01 | Foundation, after root UX/tool/dependency admission | Additive contracts, lifecycle errors and safe normalization; enables all consumers. REQ-005/018/019/021, MR-018/021, T-011/013. |
| MR-02 | After MR-01 | Live settings decoder/reader and one registration hydration cycle; no Profile contract change. REQ-010/016, MR-001/002, T-001. |
| MR-03 | After MR-01 | Settled attempt/security/mismatch and serialized ordinary/DR driver; preserves host authentication and ordinary reconnect without regional policy. REQ-006/011, MR-005–008, T-003–005. |
| MR-04 | After MR-01/MR-03 | AQM owns cancel/alias/timer/correlation and service kinds, preserving ordinary request authentication and Task control ownership. REQ-006, MR-012/013/020, T-007/008. |
| MR-05 | After MR-04 | Task continuation/media/control fences and line ensure must exist before event-entry orchestration calls them. REQ-006/013, MR-013–016, T-008/009. |
| MR-06 | After MR-02/MR-03/MR-05 | Wire validated switch entry, snapshots, terminal restart and ordered station restore; preserve ordinary authenticated silent relogin without regional cleanup. REQ-003/004/006/009/012/017/019, MR-003/004/009–013/018/019, T-002/005/007/012. |
| MR-07 | After MR-06 | Complete DR auto-state intent/voice/outcome coordination on working station and request owners. REQ-020, MR-012, T-007. |
| MR-08 | After MR-07 | Complete RTD and teardown/re-register integration across all owners, including auto-state listeners. MR-017/019, T-010/012. |
| MR-09 | After MR-08; no canonical-validation prerequisite | Safe diagnostics, exact tested host guide, product compatibility and real cross-owner integration evidence. REQ-007/008/022/024/025, MR-009/020/021, AC-008/019/020, T-006/012/013. Leaves Git-derived provenance unchanged; creates/inspects no commits. |
| MR-10 | After MR-09 only; independent of MR-11 | Final package build/full unit/style compatibility gate; no product mutation. REQ-023/025; all AC-001–020 and T-001–013 accounted for. Canonical-stage and release/live results remain separate. |
| MR-11 | After MR-09; canonical-validation preflight applies only here | Canonical architecture/module specs, registry and manifest runtime/content-fingerprint provenance, conformance and independent semantic validation. REQ-002/008/022/023/024/025. No source/test or host-example edits; no Git-derived provenance changes or commit inspection. |

Every addressed matrix ID appears in task descriptions, including individual AC IDs and unnumbered source units assigned stable REQ-nnn IDs. Product nodes include their implementation and tests; no code/tests are deferred to UX or canonical validation. MR-11 contains only canonical documentation/manifest files and its consistency/flow-validation obligations. MR-09 retains the host-example files required by T-006/T-013, so MR-10 has no dependency on MR-11’s output. Shared-file writers are dependency-ordered; MR-02/MR-03 can proceed independently after MR-01, and MR-10/MR-11 may proceed independently after MR-09 because MR-11 changes no product or host-example files. File arrays enumerate every intended source/test/doc surface; MR-10’s existing package/TypeScript/Jest configurations are read-only inputs. No package/config/lockfile/migration/asset change is hidden.

MR-01–MR-10 acceptance commands are package-scoped product checks, run serially by the host after implementors exit. MR-11’s read-only documentation consistency command and required flow-owned canonical validation are reported separately. Root prerequisites cover tools/local workspace dependencies and the flow-issued library-only UX receipt before any task; independent spec integration is checked only at MR-11. Dependency installation and its Husky Git-config side effect are runner-owned preparation, and root flow build/test commands are not required acceptance. No node creates a branch, manipulates repository Git state, stages/commits, creates or inspects commits for provenance, requires a clean tree, or performs live failover. Git-derived manifest provenance remains unchanged and never gates acceptance. Flow/runtime retains delivery/admission/validation-integration duties; QA/platform owners retain AC-021. None is silently counted as a local feature pass.