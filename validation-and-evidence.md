# Contact Center SDK multi-region recovery validation and evidence

**Date:** revised 2026-11-19, Asia/Kolkata; November 18 review history is retained below. **Status:** evidence register and test/runbook draft. No live SDK multi-region drill or feature implementation was performed to produce these documents.

Requirements: [requirement.md](requirement.md). Engineering design/tasks: [implementation-plan.md](implementation-plan.md).

These three proposal documents live at the checkout root. Bare SDK paths (`src/`, `test/`, `docs/`, `AGENTS.md` and `.sdd/manifest.json`) refer to `packages/@webex/contact-center/` unless explicitly marked as workspace-root; Markdown links resolve from this document. Run package commands from the workspace root.

## 1. Readiness statement

There is enough source and reference behavior to implement the described client-side recovery and construct deterministic tests. That does not establish successful live SDK recovery, active-call continuity or production readiness. MR authority is now the proven separate live organization-setting read, not an assumed desktop-login aggregate projection. Those claims require their own evidence.

The missing agent credentials and platform drill process are live-acceptance prerequisites. They are not needed to write this design or exercise its client behavior with contract fixtures. A positive entitled-org organization-setting response and independent-reader failure-isolation evidence are required to verify the config integration before release.

Local engineering completion is AC-001–AC-020 / T-001–T-013 plus package checks and applicable independent spec validation. AC-021 remains mandatory human/operator-executed release acceptance; record it as not executed until QA/platform owners supply the assigned org, credentials, window and results. Do not synthesize those human actions into automatic DAG/build/test commands. A local pass cannot authorize release. Automation admission also requires a runner that supports SDK/library scope; the inspected prog-mini-js parser has an unresolved capability mismatch described in section 13.

## 2. Evidence provenance

| ID | Source | What was inspected / limit |
| --- | --- | --- |
| E-SDK | `/Users/rsarika/dev/Cypher/webex-js-sdk`, package `packages/@webex/contact-center` | November 19 pattern/routing check: HEAD d90e192166646e74dd39e95277607ac0b7e8d25a, branch cc-multi-region. Current canonical routing is docs/specs/README.md, module docs/README.md and docs/architecture.md. Statements describe the inspected working tree, not a clean-worktree or remote-main assertion. |
| E-SDK-18 | Same package, historical November 18 review | Original proposal evidence used HEAD ba83a90e4c78610707568228eac8b465522c40fd, branch chore/spec-validator-local-forage and the previous ai-docs layout. Historical check counts and review outcomes below are not current routing/runtime configuration. |
| E-DESKTOP | `/Users/rsarika/dev/CCSDK/wxcc-desktop` | Local reference HEAD ce3ad94c14e86e9eb72d755175318c02f9b2b9dd confirmed November 19. Desktop station gating and immediate-RTD-pause/later-wipe ordering were rechecked. No remote deployment/main claim. |
| E-USER | This request and rollout clarification | Implement in `contact-center` under the Cypher checkout. The original November 18 location was the package root; on November 20 the requester moved all three proposal files to the checkout root. Honour backend org settings, omit Split/CDN/SDK opt-in. On November 18 the requester selected Desktop-parity conditional auto-Available, required-browser-voice deferral and failure reporting. |
| E-QA | [Kickstart QA ManualTest – MultiGeo DR](webexteams://im?space=3ac67520-aa7b-11f1-9f0d-e7b867de2044) | Native Webex discussion read during this chat. Test-org access was offered privately, not obtained for an SDK drill. |
| E-MANUAL | [Manual Validation: Multi-Region](https://confluence-eng-gpk2.cisco.com/conf/pages/viewpage.action?pageId=918405267) | October Desktop/platform observations; not a current SDK certification. |
| E-NOV16 | [November 16 org-failover validation](https://confluence-eng-gpk2.cisco.com/conf/pages/viewpage.action?pageId=929226579) | DN reconnection/prior-state and new inbound/outdial checks marked pass; entry-point flow mapping recorded a 404. |
| E-QS | [Quicksilver implementation/operator guide](https://confluence-eng-gpk2.cisco.com/conf/pages/viewpage.action?pageId=912993972) | Operator-confirmed platform prerequisites, small-load procedure and owner-triggered switches. November 17 update explicitly distinguishes local implementation tests from live acceptance. |
| E-DESIGN | [Desktop initial DR design](https://confluence-eng-gpk2.cisco.com/conf/pages/viewpage.action?pageId=869896720) and supplied multi-region architecture deck | Design context from the request; current behavior in this pack is anchored to inspected code. No additional assertion is derived from inaccessible deck sections. |

Do not use old `plugin-cc` paths, event inventories or defect claims as current `contact-center` evidence. In particular, the correct package already rejects untrusted socket URLs and propagates subscription errors.

## 3. Current SDK evidence and required adaptation

| Source | Verified current behavior | Proposed change / test implication |
| --- | --- | --- |
| [config/index.ts](packages/@webex/contact-center/src/services/config/index.ts), `getOrgDesktopLoginConfig` / `getAgentConfig` | Organization desktop-login aggregate is the normal complete-Profile route | Preserve normal aggregation. Add a narrow separate authenticated organization-setting reader for authoritative live MR hydration; its failure does not fail an otherwise-valid registration. |
| [config/types.ts](packages/@webex/contact-center/src/services/config/types.ts), `OrgSettings` / `OrgDesktopLoginResponse` | MR fields are not declared in the aggregate organizationSetting type; omission does not prove non-entitlement | Add a separate internal live MR settings type and explicit unknown semantics. Do not make the aggregate projection the gate authority. |
| [config/Util.ts](packages/@webex/contact-center/src/services/config/Util.ts), `parseAgentConfigs` | Builds the existing complete Profile | Preserve this aggregation; project any additive MR metadata only from the independent live-reader result. |
| [WebSocketManager.ts](packages/@webex/contact-center/src/services/core/websocket/WebSocketManager.ts), `register` / `initWebSocket` | Logical gateway, INT org header, wss/hostname checks and rethrown errors already exist; close-before-Welcome can leave the promise pending and WELCOME_TIMEOUT is unused | Retain security/propagation; add actual close rejection, lifecycle deadlines, stale-attempt rejection and structured mismatch extraction. |
| [connection-service.ts](packages/@webex/contact-center/src/services/core/websocket/connection-service.ts) | Async 5-second reconnect can overlap/reject uncaught; every message rearms timers; effective default is 50 seconds because setConnectionProp has no production caller | Add serialization/caught failures and generation guards; preserve cadence/default; suspend the ordinary watchdog in DR rather than claim tenant-configured timing already works. |
| [cc.ts](packages/@webex/contact-center/src/cc.ts), `handleConnectionLost` / `silentRelogin` | Public CC transport publication remains incomplete; richer session updates exist; no public stationReLogin method | Use existing public stationLogin, add the proposed region event and explicit new normalization/retry/fallback, preserving session side effects. |
| [types.ts](packages/@webex/contact-center/src/types.ts), `VoiceConnectionState`; [config/types.ts](packages/@webex/contact-center/src/services/config/types.ts), `VOICE_CONNECTION_EVENTS` | Existing public line/Mobius state and `voice:connectionStateChange` | Keep region readiness and browser-voice status separate. |
| [WebCallingService.ts](packages/@webex/contact-center/src/services/WebCallingService.ts), `cleanupWebCallingRegistration` / `registerWebCallingLine` | Registration replacement deregisters an existing line; generation guards exist | A dedicated DR preserve/ensure path is necessary to retain a healthy line. Do not describe this as an already fixed no-op. |
| [WebCallingService.ts](packages/@webex/contact-center/src/services/WebCallingService.ts), `cleanUpCall` | Removes call handlers/references without `call.end()` | Reuse only those non-ending semantics for task cleanup. |
| [Task.ts](packages/@webex/contact-center/src/services/task/Task.ts), [TaskManager.ts](packages/@webex/contact-center/src/services/task/TaskManager.ts), [state machine](packages/@webex/contact-center/src/services/task/state-machine/types.ts) | Typed task lifecycle, hydration and computed UI controls already exist | Add explicit invalidation through these owners; preserve task/control/event shapes. |
| [WebRTC.ts](packages/@webex/contact-center/src/services/task/voice/WebRTC.ts) | SDK acquires microphone media for task accept | Test owned-track release and late-acquisition cancellation on DR invalidation. |
| [Services](packages/@webex/contact-center/src/services/index.ts), primary/RTD setup in [cc.ts](packages/@webex/contact-center/src/cc.ts) | Two WebSocket managers and feature-conditional RTD registration | Add pause/resubscribe and stale-delivery suppression for currently supported RTD features. |
| [package.json](packages/@webex/contact-center/package.json), [AGENTS.md](packages/@webex/contact-center/AGENTS.md) | Package commands, Node 22.14 development, typed events, canonical spec ownership | Use current package names/paths and the package's source/test workflow. |

## 4. Desktop reference and deliberate SDK adaptations

| Reference source | Desktop behavior | SDK decision |
| --- | --- | --- |
| [Live MR read:3997](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/utils/Utils.ts:3997), [endpoint:1206](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/cms/cms-service.ts:1206) | Five live organization-setting attempts, 1/2/3/4-second waits, no cached MR fallback | Add a narrow separate MR reader through SDK Config/WebexRequest; keep Profile aggregation and its failure contract independent. |
| [Org settings manager:232](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/org-settings/org-settings-manager.ts:232) | Entitlement + Split flag + CDN build | User explicitly selects org-only gating in SDK. Neither Desktop-only gate is copied. |
| [Worker handler:364](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/aqm/aqm-service-connection-for-worker.ts:364) | Org/tracking validation, duplicate suppression, unknown skip, disabled close | Preserve these distinctions in a single session-scoped SDK coordinator. |
| [WebSocket factory:419](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/aqm/aqm-service-notifs-websocket-factory.ts:419) | Fresh admission at retained gateway, connect to returned socket | Same routing principle, while preserving SDK URL security checks. |
| [Worker retry policy:556](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/aqm/aqm-service-connection-for-worker.ts:556) | Confirmed DR uses 100/60/30/15-second waits; worker jitter arrays are randomized once at module load | Keep DR base waits, explicitly choose per-attempt SDK jitter, preserve ordinary 5-second cadence/effective 50-second default, and add serialization. |
| [Region reload guard:17](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/aqm/region-failover-reload.ts:17) | Desktop guards one reload per 120 seconds with a per-tab timestamp | SDK emits restart-required; host navigation guard adds org scoping as an intentional SDK choice. |
| [Session recovery:44](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/aqm/reconnect-relogin/reconnect-relogin-service.ts:44) | Retries only timeout/TimeoutEvent, 1037/INTERNAL_ERROR and HTTP 429/502/503; other non-transient failures go to station fallback | Specify the allowlist and add numeric/reason normalization explicitly; preserve terminal-auth/cancellation guards and SDK automation controls. |
| [App restore:2246](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/App.ts:2246) | Snapshot, wipe regional state, restore after socket recovery | Invalidate SDK-owned tasks/requests through Task/XState; preserve static configuration/authentication. |
| [App RTD restore:2321](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/App.ts:2321) | Resume RTD and Desktop metrics subscriptions | Restore current SDK RTD features; do not invent supervisor-grid/queue subscriptions the package does not own. |
| [Desktop station gate:2370](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/App.ts:2370), [SDK automation gate:1125](packages/@webex/contact-center/src/cc.ts#L1125) and [Agent policy](packages/@webex/contact-center/src/services/agent/docs/README.md#data-flow-and-sequence-coverage) | Desktop skips relogin and resumes RTD without a prior station; SDK gates the whole silentRelogin/reload pipeline with allowAutomatedRelogin | Evaluate no-prior-station before automation-disabled before missing/failed automatic restore. The reason strings are the SDK contract, not literal Desktop events. |
| [Desktop event entry:2405](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/App.ts:2405), [later wipe:2157](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/App.ts:2157), [SDK request timeout:41](packages/@webex/contact-center/src/services/core/constants.ts#L41) | Desktop pauses RTD/marks recovery at event entry and wipes application stores after reconnect; SDK pending requests default to 20 seconds | Add immediate SDK AQM interruption and continuation guards before the first 100-second DR wait; keep full Task/store/media disposal at post-Welcome/manual-replacement cleanup. Immediate SDK cancellation is new work, not an existing Desktop cancellation API. |
| [Region parsing:11](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/aqm/data-center.ts:11) and [banner gate:26](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/utils/serving-region-banner.ts:26) | Thirteen fixed lowercase labels; banner requires enabled MR and trimmed/lowercased home/current comparison | Specify the same label registry, normalization and eligibility precondition; keep URL authorization separate. |

Additional distinctions verified in the reviewed source:

- Desktop's aggregate adapter [projects MR fields](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/conf/desktop-login/desktop-login-profile-adapter.ts:241), but the [cache rule](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/conf/desktop-login/README.md:660) excludes cached aggregate MR as gate authority. This is not proof that a fresh aggregate can never contain the fields.
- Desktop remembers only the last handled tracking ID. The SDK's 128-ID FIFO is a deliberate bounded extension, not identical parity. Validate the platform's tracking-ID reuse expectations during API/contract review.
- Desktop uses a 10-second subscribe deadline and 10-second Welcome timer after socket-open. The proposed SDK 20-second subscribe and 30-second combined socket/Welcome limits are explicit new choices, not already active deadlines; SDK WELCOME_TIMEOUT=30000 is currently unused.
- Desktop's non-boolean MR setting is coerced by `=== true`; the SDK's malformed-value-to-unknown rule is deliberately stricter.
- Desktop rebuilds station payload from current store values before wipe. Its [default-aux resolver](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/services/conf/conf-service.ts:243) can return cache, so re-resolution does not guarantee fresh HTTP. SDK snapshot reconciliation must track current accepted state and retain its existing fallback default-aux behavior.
- Desktop's manual-login recovery outcome [keeps transport available](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/App.ts:2033); only fatal/unmanaged failure reaches socket close. Manual-login-required with an open socket is not inherently a Desktop deviation.
- Desktop also handles DR in the [non-worker path](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx-services/src/core/aqm-notifs.ts:216), whose watchdog behavior differs from the modern worker. The legacy worker rollback path and non-worker watchdog can impose a 120-second stop; do not describe all Desktop paths as unbounded.
- SDK allowAutomatedRelogin=false and disableWebRTCRegistration behavior are SDK compatibility requirements, not Desktop rollout flags. Failover and failback share the same recovery pipeline.
- SDK has no SYSTEM_SHUTDOWN replacement-socket swap. Desktop's swap-specific replacement guard has no corresponding active SDK swap state; the MR proposal does not add shutdown swapping.

Desktop also retries first connection up to five attempts and has separate legacy retry/feature-gated relogin variants. This proposal deliberately preserves one-attempt SDK registration and current ordinary recovery; it does not copy every Desktop flag, UI timer or deployment mechanism.

## 5. Automated validation matrix

Use the real package collaborators and fake timers. Mock platform HTTP/WebSocket/calling boundaries, not a second implementation of the coordinator. Existing suites below are targets for adding assertions; no MR-specific test is claimed implemented or run here.

| Test ID | Requirements acceptance | Existing suite / seam | Required assertions |
| --- | --- | --- | --- |
| T-001 | AC-001, AC-002 | `test/unit/spec/services/config/index.ts`, config parser tests | First-item-only array/extra/empty/malformed handling; authoritative true/false/legacy values; one cycle per register() with 1/2/3/4 waits, no reconnect/restore reread; new registration invalidates eligibility; terminal reader auth failure stops only MR attempts and preserves valid Profile/register/connections |
| T-002 | AC-003 | `test/unit/spec/cc.ts` and new pure event-helper tests | Session-org guard, nonblank IDs, A/B/A suppression, 128-ID eviction/teardown; hydration-window ignored event without replay and conditional ordinary/409 fallback; disabled behavior and distinct switch supersession |
| T-003 | AC-004, AC-005 | `test/unit/spec/services/core/websocket/WebSocketManager.ts` | Fresh subscribe URL; retained wss/allowlist/INT header; error propagation; timed settlement; no stale socket installation |
| T-004 | AC-006 | `test/unit/spec/services/core/websocket/connection-service.ts` | DR waits/jitter/repetition; no ordinary-watchdog expiry at 50s; serialized slow attempts; unchanged ordinary cadence |
| T-005 | AC-007 | WebSocket manager + coordinator tests | Four exact case-sensitive 409 values after trimming; case-insensitive header name; first nonblank header/body reason wins even unknown; unknown-header + valid-body and wrong-case tests; unrelated conflict exclusion; reject/emit once |
| T-006 | AC-008 | Host-example contract/fixture | Org/tab-scoped guard survives restart; repeat <120s does not reload; unavailable storage fails closed to a manual action |
| T-007 | AC-009–AC-012 | `test/unit/spec/cc.ts`, agent/config service tests | Latest accepted team/device/DN snapshot reconciliation; default-aux/failed-login preservation; exact reload retry/fallback normalization and 1035; ordered no-prior-station/automation-disabled/missing-config combinations below; current team/timestamps/wellness/Webex App effects; conditional auto-Available cases |
| T-008 | AC-013 | `test/unit/spec/services/core/aqm-reqs.ts`, TaskManager/Task and cc lifecycle suites | Hold replacement Welcome beyond 100 seconds: old pending requests reject at accepted DR entry with RECOVERY_INTERRUPTED, their 20-second timers/binds clear and no second settlement occurs. New conflicting commands stay RECOVERY_IN_PROGRESS through the wait/manual-login outcome. Later wipe makes retained Tasks STALE_TASK with disabled controls; no synthetic end/wrap-up; manual station login/getters/logout/deregister retain their specified availability |
| T-009 | AC-014, AC-015 | `test/unit/spec/services/WebCallingService.ts`, WebRTC task suites | Old media acquisition finishing during the pre-Welcome DR wait stops its new tracks without answering; post-Welcome/manual-replacement cleanup releases existing SDK-owned tracks/listeners. Host resources remain; no contact/call end; healthy line retained; absent/disabled line handled; voice events remain truthful |
| T-010 | AC-016 | `test/unit/spec/services/task/TaskManager.ts`, RTD setup in cc tests | Paused old socket, supported-feature resubscribe, stale data dropped, optional RTD failure isolated |
| T-011 | AC-017 | cc/event/region-parser tests | Enabled/disabled/unknown eligibility; all 13 labels; normalized away/home/unknown metadata; no early ready, no region host rewrites or media-continuity claim |
| T-012 | AC-018, AC-019 | Full cc + connection lifecycle tests | Logout/deregister/multi-login/re-register cancellation, including synchronous logout/deregister from a recovering-event observer; late Welcome/reload/getUserMedia; auth/429/5xx; throwing observer/metric containment |
| T-013 | AC-020 | Export/type tests plus logger/metrics assertions | Additive public types/constants/errors; existing registration/voice/UI compatibility; secret/query redaction |

### Ordered station-policy cases within T-007 / AC-011

| Prior confirmed active station | allowAutomatedRelogin | Saved configuration | Required result |
| --- | --- | --- | --- |
| No | false or true | Absent or present | region-switch; preserve Profile, no station wipe/reload/login, resume applicable RTD |
| Yes | false | Absent or present | automatic-relogin-disabled; no automatic reload/fallback login; missing configuration cannot select a different reason |
| Yes | true | Missing required data | session-restore-failed without an automatic session request |
| Yes | true | Usable | Enter post-Welcome cleanup and automatic restore; ready on success or session-restore-failed on unsuccessful restoration |

Include a session restored during register() as a prior active station, and test public stationLogin after each manual outcome. Existing interrupted requests and late-media continuations are guarded at event entry in every row. A request already settled before event acceptance is not rejected again.

### Auto-Available cases within T-007 / AC-012

These are required implementation tests, not executed results. Use the real ContactCenter/agent/AQM wiring with controlled reload, voice and state-response seams.

| Case | Required assertions |
| --- | --- |
| Exact trigger | Only the successful automatic reload result's exact agent-wss-disconnect reason permits Available. Wrong-case/other/absent reasons, fallback/manual login and automation disabled send no automatic request. A long outage alone is insufficient. |
| Voice ready or not required | Browser-ready and DN/extension/no-required-browser-voice paths dispatch once, publish requesting then succeeded on acknowledgment, and update state/aux/timestamps only from confirmed backend results. |
| Voice deferred | Line REGISTERED/RECONNECTED plus Mobius DISCONNECTED remains waitingForVoice while region ready is emitted. Connecting required voice sends once; duplicate callbacks and subscribe/check races cannot duplicate it. A local pre-send BROWSER_VOICE_NOT_READY race re-arms only the same pending action. |
| Failure | Local non-voice rejection, backend failure and timeout publish failed without silently retrying or caching Available. The station remains ready if otherwise usable; existing backend agent-state events are not fabricated. A later authoritative backend result after timeout is reconciled without settling a newer promise. |
| Cancellation and intent ordering | Each explicit state intent, logout/deregister, identity/session replacement, multi-login, superseding recovery and invalidating backend state detaches pending listeners and prevents future automatic dispatch. Explicit intent before reload finishes prevents later arming; intent during the voice wait cancels even if its request fails. Already-sent automatic work is not claimed undone; the explicit request follows settlement and has distinct correlation. Late/duplicate automatic responses cannot complete it or overwrite newer accepted state; no old outcome reaches a replacement session. The automatic acknowledgment itself does not cancel its own success. Success/failure leaves no pending listener; cancelled remains observable if the session continues. |
| Snapshot contract | Omit autoAvailable when inapplicable; otherwise publish each waitingForVoice/requesting/succeeded/failed/cancelled change with complete current metadata. Preserve existing voice and backend agent-state event contracts; a ready snapshot does not assert Available or working audio. |

### Package commands

Before a future implementation run is admitted, check from the real workspace root:

```bash
node --version
yarn --version
```

Require Node 22.14.x and Yarn 3.4.1, check the target checkout/package dependency access and use the selected runner's supported tool/version prerequisite checks. Classify missing/mismatched tools or inaccessible dependencies as environment prerequisite failures before build/test work. This document does not configure a runner or claim those execution-environment checks have run. Tooling metadata is inconsistent: root package.json says Node 18.x, .nvmrc says lts/jod and the published package engine floor is >=20.x; follow the explicit [package development instructions](packages/@webex/contact-center/AGENTS.md) and [getting started](packages/@webex/contact-center/docs/getting-started.md).

Follow the current package check order. On a fresh/outdated dependency build, first use the documented compile command rather than inventing an install/build shortcut.

```bash
yarn workspace @webex/contact-center build:src
yarn workspace @webex/contact-center test:unit
yarn workspace @webex/contact-center test:style
```

Focused examples use the path relative to `test/unit/spec/`:

```bash
yarn workspace @webex/contact-center test:unit --targets services/core/websocket/WebSocketManager.ts
yarn workspace @webex/contact-center test:unit --targets services/core/websocket/connection-service.ts
yarn workspace @webex/contact-center test:unit --targets cc.ts
```

The current package uses Jest and an 85% global coverage threshold. Follow the existing suite style and real configured runner. A package build/lint pass is compatibility evidence, not proof of each requirement. Existing toolchain failures must be recorded separately from feature failures. No new browser suite is necessary for unit-observable timers, guards, cleanup or event contracts.

Before canonical spec writes/validation, resolve current [manifest routing](packages/@webex/contact-center/docs/specs/README.md), generator/validator provenance and the required different-runtime independence, plus the authorized validator integration and its repository access. The current manifest records claude-code as the migration generator and an opaque historical validator invocation ID. Neither value is a runnable validator command or proof that a new validation has run. Do not substitute same-runtime self-review for that gate or infer tool availability from a CLI name.

## 6. Human/operator SDK release-acceptance runbook — AC-021

### Prerequisites

Obtain from QA/platform owners: an available entitled validation org, private test credentials, station team/DN, supported primary/secondary pair, the SDK and platform deployment identifiers, and an agreed drill window/operator. Verify a positive response from the separate authenticated organization-setting reader before interpreting the MR gate. Record independent-reader failure isolation; do not infer disabled eligibility from missing desktop-login aggregate fields.

Reference environment discussed in E-QA:

- Desktop comparison UI: <https://wxcc-desktop-nonprod-cdn.ciscoccservice.com/>.
- Integration Control Hub: <https://admin-int.webex.com/>.
- Existing manual LOAD org mentioned in the discussion: `e1e70101-f98e-47ca-91f6-484423ab384b`.
- Org access/setup contacts in that discussion: Dakshayani Govindappa and Pushpalatha Srinivas. The shared QA org is not automatically reserved/authorized for a new concurrent drill; obtain an assigned validation org/window.
- Desktop's CDN deployment requirement does not apply to the SDK test host. Use a supported secure/localhost host and the correct authenticated environment discovery.

No usable password was obtained from the reviewed material. Org identification is not agent access. Quicksilver's task checkbox does not provision backend entitlement or perform the regional switch. Platform owners trigger the actual org/regional failover and failback; this document does not execute or assume current authentication for historical RC curl examples.

### Procedure

1. **Capture baseline.** Record sanitized org/home-region settings, SDK/platform versions, UTC window, initial subscription socket origin, station mode and enabled RTD features. Register and station-login with one dedicated inbound agent and one dedicated outbound agent. Confirm baseline new calls and voice state.
2. **Trigger org failover through the operator.** Keep the SDK host open. Record the event's org/tracking/scope/operation, recovery event sequence, retry waits, fresh subscription origin and station-restore outcome. Confirm no parallel sockets or ordinary-watchdog failure during the DR wait.
3. **Verify usable work.** After session-ready, inspect the backend-restored agent state and autoAvailable outcomes before expecting work to route. For an actual agent-wss-disconnect reload result, verify the single conditional Available request and acknowledgment; when required browser voice is unavailable, verify waitingForVoice with session-ready, then one request when voice recovers. Other/absent reasons must preserve restored state. Record failed state requests and the host's explicit recovery action. Make new inbound/outdial calls once the respective prerequisites are satisfied. Inspect independent voice state, microphone ownership and incoming-call behavior, and exercise supported RTD features. Do not mark active-call audio continuity passed from these observations alone.
4. **Login a second cohort during failover.** New sessions must use discovery/admission correctly without needing an event that occurred before login. Record known away-from-home/limited-service state.
5. **Trigger failback through the operator.** Repeat observation for existing and late-login agents. Known home placement must clear limited-service state through new metadata, not by guessing from operation name.
6. **Exercise placement mismatch.** Coordinate a supported stale-placement case or contract replay. Verify one guarded host restart, fresh initialization and no infinite reload; record every HTTP409 reason.
7. **Ordinary network control.** Briefly interrupt only the assigned client's network. Confirm ordinary retry timing and no confirmed-DR wipe. Restore network and verify existing supported session/hydration behavior.
8. **Lifecycle controls.** Logout or deregister one recovering client and verify it never reconnects. With auto-Available deferred, make an explicit agent-state choice and verify later voice readiness does not replace that choice. Verify cancellation on another recovery/session replacement using an assigned test client. Keep another unaffected org/client as a control when operators approve the shared test setup.
9. **Record modality-specific outcomes.** Run DN, extension and browser cases separately. Save positive/negative outcomes and tracking IDs, not only an aggregate pass label.
10. **Close the drill.** Confirm failback/desired final placement with the operator, stop only assigned test work, and retain bounded sanitized evidence. Do not manipulate other teams' load tasks.

Capture HAR/logs privately first and sanitize credentials, cookies, bearer tokens, personal data, DN snapshots and signed WebSocket/catalog queries before sharing. Prefer origins, operation stages and correlation IDs over complete URLs/payloads.

## 7. Evidence ledger

| Check | Current status | Evidence needed for completion |
| --- | --- | --- |
| Correct package/architecture inspection | Reviewed | Source links in sections 2–4 |
| Live MR reader integration and failure isolation | Not SDK-live-verified | Sanitized positive organization-setting response, correct HTTP response normalization, and proof that MR-read failure preserves otherwise-valid registration |
| Proposed MR source implementation | Not performed | Source/type changes and reviewed diff |
| MR automated scenarios T-001–T-013 | Not implemented/executed by this documentation change | Named assertions and runner outputs |
| Current package unit/style/build commands | Not run for this documentation-only change | Run outputs when feature code is implemented |
| Requirements structure and local-link checks | Historical November 18 checks remain in sections 9–12; current correction checks are recorded in section 13 | Structural evidence only; it does not prove feature behavior or live integration |
| Independent document peer review | Historical Codex reviews are recorded in sections 9–12; current correction review belongs in section 13 | Document peer review does not establish manifest-policy independent SDD validation |
| Applicable independent SDD validation | Not executed/claimed for this proposal revision | Resolve the new invocation's generator/validator identities, different-runtime policy, runnable integration and repository access from current AGENTS/manifest; historical invocation metadata is not a validator command |
| Automated-flow admission | prog-mini-js capability mismatch remains open | Its inspected parser activates frontend obligations for legitimate SDK UI-control terms; choose a supported library-only execution path before admission, without changing SDK scope |
| SDK live DN / extension / browser MR | Not executed | Separate run records, versions, timestamps, outcomes and sanitized trace evidence |
| Uninterrupted ongoing-call/media migration | Not established | Explicit platform/calling acceptance evidence; never infer it from socket/session recovery |

## 8. Document acceptance checklist

- All three proposal files are directly in the Cypher checkout root, target `packages/@webex/contact-center`, and have working cross-links.
- Every MR requirement has an acceptance ID and a mapped test/evidence owner.
- Proposed APIs are labelled as proposals; current source behavior and intentional SDK adaptations remain separate.
- No plugin-cc command, nonexistent public stationReLogin API, Split/CDN requirement or stale swallowed-error claim is presented as current SDK implementation. The new narrow live MR reader is explicitly proposed work, while existing Profile aggregation remains unchanged.
- No successful test, deployment, independent-runtime validation or live drill is claimed without its actual result.
- Existing as-built canonical specs/manifests are not silently rewritten by this proposal pack; the implementation task includes their required updates.

## 9. Authoring review closure

The reviewer was a separate Codex agent reading the three draft documents and current target source. It did not implement or run the feature.

| Review ID | Finding | Disposition and requirement/acceptance mapping |
| --- | --- | --- |
| DOC-R1 | Deduplication promise exceeded last-ID storage | Corrected: bounded 128-ID accepted-event FIFO/set, explicit eviction and A/B/A test; REQ-MR-003 / AC-003 |
| DOC-R2 | A broad command guard could block manual login or teardown | Corrected: guard conflicting task/call-control operations only; manual station login after transport recovery, getters and lifecycle termination remain callable; REQ-MR-012, REQ-MR-013, REQ-MR-019 / AC-011, AC-013, AC-018 |
| DOC-R3 | Unknown eligibility could be confused with a partial Profile | Superseded by the confirmed settings-source correction: a separate live MR reader leaves unknown on failure without rejecting valid Profile/register; normal Profile failure behavior stays unchanged; REQ-MR-002 / AC-002 |

The initial review confirmed normal aggregate architecture, registration replacement, media ownership, Task/XState and unexecuted-live-test distinctions, but missed the MR authority and nonexistent public API errors. Section 10 records the confirmed corrections. Live SDK integration/acceptance remains unverified; this is an engineering review draft, not release approval.

## 10. Confirmed-review corrections

Earlier validation feedback was checked against the actual source before the November 18 corrections. Its separate historical review file is not part of this three-document pack; the finding dispositions are retained below. Accepted corrections do not adopt its inaccurate worker-only, always-close-after-relogin, or always-fresh-default-aux-HTTP claims.

| Finding | Confirmed correction in this document pack |
| --- | --- |
| Settings authority | Separate fresh organization-setting reader, independent retries/failure isolation, no aggregate-missing-field disabled inference |
| Public API | Existing manual action is stationLogin only; removed callable stationReLogin references |
| Current reconnect baseline | Effective 50-second default, overlapping uncaught interval attempts, every-message timer reset and unsettled Welcome path are named current gaps; serialization/deadlines remain proposed work |
| Browser calling registration | handleDeviceType(BROWSER) is the explicit DR branch point for avoiding registration replacement; ordinary reconnect policy is not silently changed |
| Desktop differences | Bounded deduplication, per-attempt jitter, timeout budgets, malformed-value handling and org-scoped restart guard are labelled SDK choices |
| Protocol precision | Exact case-sensitive trimmed 409 values, nonblank-header precedence, reload transient allowlist and new numeric/reason normalization |
| State/readiness | Latest accepted station-state reconciliation; never-station-logged-in produces a nonfailure manual-login outcome; limitedService requires enabled eligibility and normalized known regions |
| Cleanup evidence | Explicit bound-listener mismatch, singleton object lifetime, stored AQM timeout/reject handles, typed task invalidation, owned media disposal and independent RTD driver |
| Errors/tooling | Round 2 selects the compatible plain-Error/data.reason pattern and stable code catalog, replacing the earlier subclass proposal; Node development/engine metadata distinction remains recorded |

Confirmed-correction validation: deterministic requirements lint PASS (100%; 16/16 basic checks; 21/21 requirement-to-acceptance mappings), 51 local links resolved with none missing, Markdown headings/fences checked, and no callable stationReLogin reference remains in requirements or implementation. The correction patch also passed a separate Codex peer review for this docs-only scope, with no blocking/major correction finding. These are document checks, not configured different-runtime SDD validation; no feature source/unit/build/live test was run for this correction.

### Selected policies and remaining platform confirmation

Round 2 resolves the ineligible-org and error-shape choices: stop/close primary and RTD transport without reconnect, leave the existing browser line registered until normal host teardown, and use plain Error plus data.reason codes rather than an exported subclass. The requester has also resolved N1 with Desktop-parity conditional auto-Available and required-voice deferral, recorded in section 12. Platform tracking-ID reuse remains unconfirmed, so this draft does not declare implementation readiness. No SYSTEM_SHUTDOWN socket-swap support is added.

## 11. Round-2 review: verified clarifications and routing decision

The local validation review's round-2 N2–N5 findings are confirmed and incorporated:

| Finding | Correction / test evidence |
| --- | --- |
| N2 response shape | Normalize the response body to OrganizationSettings[]; use [0] only, ignore extras, and keep unknown for empty/non-array/invalid-first data; AC-002 / T-001 |
| N3 hydration trigger | One bounded cycle per register() generation; no ordinary/DR reconnect reread, polling or public refresh API; a new registration invalidates prior eligibility; AC-002 / T-001 |
| N4 hydration window | Unknown events in the retry/request window are ignored without replay; ordinary reconnect or recognized-409 restart are conditional fallbacks, not guaranteed recovery or automatic DR mode; AC-003 / T-002 |
| N5 reader auth failure | Terminal auth failure stops the MR-reader retry cycle only, leaves eligibility unknown, and does not independently fail otherwise-valid registration or tear down transport; AC-002 / T-001 |

N1 identifies a genuine state-policy gap and a concrete cached-state inconsistency. Current [silentRelogin](packages/@webex/contact-center/src/cc.ts#L2433) attempts Available only when the backend reload reason is agent-wss-disconnect. A 100-second DR wait does not prove that reason will be returned. The function awaits browser line registration first, but line registration does not guarantee independent Mobius readiness. A local BROWSER_VOICE_NOT_READY rejection is therefore possible. The current catch logs it and still stores the preselected Available aux value; backend state has not changed. Existing voice events/metrics do provide diagnostics, so this is not absence of every host-visible signal, but there is no deferred auto-Available retry or dedicated outcome for the swallowed internal failure.

The safe invariant remains explicit: apply backend-restored state/aux and never mark cached Available until a successful state-change acknowledgment. The requester has now selected Desktop-style conditional auto-Available with required-voice deferral and failure reporting. REQ-MR-012, AC-012 and T-007 now specify that policy; section 12 closes the decision. Socket-open/session-ready alone still does not establish Available.

The supplied round-2 recommendations are recorded as selected SDK design policies, not current source facts: for ineligible orgs stop/close primary and RTD without reconnect but retain the existing browser line until normal host teardown; use augmented plain Error with data.reason codes instead of a new exported subclass. Tracking-ID reuse remains a platform contract question; no platform confirmation or outbound request is claimed.

Round-2 document checks: deterministic requirements lint PASS (16/16 basic checks and 21/21 requirement mappings); 52 local links resolve; stale subclass/later-refresh contract checks pass. A separate Codex peer review found no blocking/major correction conflict in this partially resolved draft. These checks are not feature tests, configured different-runtime SDD validation, implementation readiness or live acceptance.

## 12. N1 policy closure: conditional auto-Available

**Disposition: Covered by requester decision, REQ-MR-012 / AC-012 / T-007.** The selected behavior is Desktop parity: auto-Available only for a successful automatic reload result with the exact agent-wss-disconnect reason, defer while required browser voice is unavailable, and report outcomes. No duration-based assumption is used. DN/extension and modes without the SDK browser-voice requirement have no voice wait. Manual/fallback station login does not inherit a stale reload reason.

Desktop's [reload result handler](/Users/rsarika/dev/CCSDK/wxcc-desktop/packages/agentx/src/app/App.ts:2058) is the parity reference for the conditional rule and pending auto-state behavior; the SDK adaptation uses its own voice policy and per-ContactCenter lifecycle. Current SDK [setAgentState](packages/@webex/contact-center/src/cc.ts#L1444) has the local voice gate, and [WebCallingService readiness](packages/@webex/contact-center/src/services/WebCallingService.ts#L149) considers independent voice state. Existing [agent state-event types](packages/@webex/contact-center/src/services/agent/types.ts#L436) and [event forwarding](packages/@webex/contact-center/src/cc.ts#L1722) do not provide a dedicated outcome for a locally swallowed automatic failure. The proposed optional autoAvailable status in region:stateChange fills that gap without fabricating backend events or declaring a usable session unavailable.

The action has one pending listener and generation/session/state-intent guards. Explicit state intent and every listed lifecycle/precondition change cancel deferred work. Already-sent work cannot be rolled back locally; explicit requests must be ordered after settlement with distinct correlation. The current [agent state request](packages/@webex/contact-center/src/services/agent/index.ts#L107) and [AQM binding](packages/@webex/contact-center/src/services/core/aqm-reqs.ts#L59) match by event/subtype, so isolating stale automatic replies is new implementation work, not an existing guarantee. A local timeout establishes no proof of backend rejection. Successful acknowledgments and subsequent authoritative backend events govern cached state/aux/timestamps.

The chosen policy, proposed outcome type, cancellation rules, implementation tasks, host example and required tests are specified consistently across the three documents. Tracking-ID uniqueness/reuse still needs platform confirmation; no outbound request or confirmation is claimed. This remains a documentation proposal; feature tests and live acceptance remain unexecuted.

N1 document checks: deterministic requirements lint PASS (16/16 basic checks, 21/21 requirement mappings), 59 local links resolve, and Markdown headings/fences and obsolete-decision checks pass. A separate Codex peer review approved this documentation correction with no blocking/major finding. These results are document checks, not feature-test results, configured different-runtime SDD validation or live acceptance.

## 13. November 19 prompt review and confirmed corrections

The supplied req_review_prompt.md was used to check contradictions, ambiguity, execution-resource boundaries and actual UX parsing. The first review was read-only. At the requester's direction, the exact November 18 three-file copies were restored; this revision then applies the confirmed documentation corrections. It does not modify product code, canonical module specs, the manifest or an automation flow.

| Review ID | Disposition | Evidence and acceptance |
| --- | --- | --- |
| MR-REV-001: interruption timing | Corrected | Immediate AQM interruption, timer/bind cleanup and old-continuation/late-media guards precede closing/scheduling; full Task/store/media cleanup remains post-Welcome or manual replacement. REQ-MR-011/013/015, AC-010/013/014 and T-008/009. Desktop's two-stage ordering is retained; immediate SDK cancellation is explicitly new work. |
| MR-REV-002: manual reason precedence | Corrected | Ordered no-prior-station, automation-disabled, missing-config, automatic-restore branches gate the whole reload/fallback pipeline. Registration-restored sessions count as active. REQ-MR-011/012, AC-010/011 and T-007 combined cases. |
| MR-REV-003: human resources in automatic completion | Corrected | AC-001–020 / T-001–013 are local engineering checks. AC-021 remains a mandatory human/operator release gate with explicit not-executed evidence until real access/window/results exist; IMPL-07 cannot turn it into an autonomous drill or local test dependency. No release gate is weakened. |
| MR-REV-004: routing/validator/toolchain | Corrected | Current manifest-routed docs paths replace the migrated layout; generator and validator roles/provenance are distinguished. A future runner must verify Node/Yarn/dependency and independent-validation prerequisites before the applicable stage. This is documentation/runner ownership, not a new SDK feature flag or a claim those checks ran. |
| MR-REV-005: UX parser boundary | External flow capability remains unresolved | No supplied visual UX authority is missing. The actual installed prog-mini-js parser registers an automatic description and activates frontend gates from SDK UI-control words. No requirement-text opt-out is supported; documenting this limitation does not fix that parser or certify flow admission. See the bounded evidence below. |
| MR-REV-006: missing historical report link | Corrected | Removed the dangling dependency on a separate historical review file while preserving its finding summaries in sections 9–12. The three proposal files contain the current review dispositions. |

### Bounded UX/parser evidence and execution boundary

No supplied prototype, Figma design, image, wireframe, SVG/PDF UX authority or host application implementation was identified in the three November 18 documents. Mermaid diagrams are architecture, SDK UI-control names are contracts, and the host snippet illustrates event consumption. No UX source or frontend deliverable is invented to satisfy an example input format.

The available editable matrixbuilder 0.1.0 installation under /Users/rsarika/dev/Cypher/Artifiser/artificer/.venv resolves to that checkout's source. A bounded call through wrappers._ux_input_manifest used the original SDK root/requirement-directory resolution, actual Figma preprocessing, generic source registration/binding and JSON schema checks, with scratch confined to a temporary directory. Each November 18 document passed source-schema registration with no Figma/local visual references, but ux_required was true and the automatic ux-requirement-description source had capture_required:false. That is registration evidence, not flow execution or frontend readiness.

The inspected prog-mini-js and prog-mini-js-v2 parsers match UI/UX words even in SDK contracts such as task:ui-controls-updated. Downstream gates require a rendered harness descriptor, current visual-comparison receipt and browser/component/accessibility evidence. A reference source's capture_required:false does not waive implementation evidence. No supported requirement-text declaration disables those gates, so adding an invented UX opt-out or removing real SDK event names would be incorrect.

The installed prog-mini-polyglot parser has a documented non-UI metadata value and different strict requirement/profile contracts. It is a verified alternative capability, not a selected or configured run for this SDK. The current three SDK documents remain flow-neutral. Before automatic admission, the run owner must select a supported library-only execution path and supply its required checked profile/tools; no active flow is started, migrated or reconfigured by this correction. The known prog-mini-js limitation and platform tracking-ID reuse confirmation remain explicit limits on declaring overall automation readiness.

The November 19 requirements.md revision, before the November 20 relocation, was also parsed afresh through the same actual pipeline with its then-current SDK root/directory semantics and isolated scratch. Manifest/source schema errors were zero; Figma mode was none, no Figma JSON/local visual inputs were registered, and the single automatic description still produced ux_required:true with capture_required:false. This current check covers the canonical requirement, not a claim that the companion evidence report is a standalone flow input. It confirms the known capability mismatch rather than resolving it.

Correction checks: requirements lint PASS (16/16 basic checks, 21/21 requirement mappings), all 69 local links resolve, and Markdown headings/fences plus stale-routing/API checks pass. Separate Codex peer reviews approved the contract/timing and execution-boundary corrections without blocking/major correction findings. These are document and source-registration checks, not SDK feature tests, independent SDD validation, automation admission or live release acceptance. Only the three proposal documents are changed.

Relocation on November 20: the three proposal documents moved to the checkout root and package-file links were rebased. Cross-document links remain adjacent. Source-registration evidence above predates this relocation; relocation checks pass requirements structure (16/16 basic checks, 21/21 mappings) and all 69 local links without starting a flow or claiming a new parser run.

Intake-format correction on November 20: the active root requirement.md now uses the required Requirement title, Branch, Description and list-based Acceptance Criteria envelope. The actual pure _parse_requirement_contract validator called by prepare_branch reproduced all four reported errors on the previous file and returned zero errors on the corrected text; the preceding UX source-mode parse also passed. All 21 normative requirements and all 21 acceptance outcomes were retained. The four-field input check, poison-language gate and material-decision lint pass. This verifies document intake format without running prepare_branch, changing a branch, rewriting versioned snapshots or restarting a flow; it does not resolve the separate downstream UX capability limitation. Earlier UX source-registration checks were a different validation layer and did not prove envelope validity.
