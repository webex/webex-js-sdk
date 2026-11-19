# Requirement: Contact Center SDK multi-region recovery requirements

## Branch

cc-multi-region

## Description

| Metadata | Value |
| --- | --- |
| Repository | `/Users/rsarika/dev/Cypher/webex-js-sdk` |
| Target package | `@webex/contact-center`, `packages/@webex/contact-center` |
| Base branch | `cc-multi-region` — inspected target checkout; this document does not select a release branch |
| Source baseline | SDK HEAD `d90e192166646e74dd39e95277607ac0b7e8d25a`; current routing/pattern checks refer to this working tree; November 18 evidence is identified separately in the validation document |
| Status | Draft for engineering review; proposed behavior, not an implemented-feature or live-validation claim |
| Owner / DRI | Contact Center SDK maintainers; requester owns acceptance of the feature proposal |
| Updated | 2026-11-19, Asia/Kolkata |

Read with [implementation-plan.md](implementation-plan.md) and [validation-and-evidence.md](validation-and-evidence.md). These three feature documents supplement the manifest-routed module specifications in [docs/specs/README.md](packages/@webex/contact-center/docs/specs/README.md) and the contract index in [docs/architecture.md](packages/@webex/contact-center/docs/architecture.md). They do not replace the as-built module specifications or promote SDD coverage.

These three proposal documents live at the checkout root. Bare SDK paths (`src/`, `test/`, `docs/`, `AGENTS.md` and `.sdd/manifest.json`) refer to `packages/@webex/contact-center/` unless explicitly marked as workspace-root; Markdown links resolve from this document. Run package commands from the workspace root.

### Problem

An agent using an embedded SDK client needs a controlled way to recover when the platform moves an organization or region. Reopening a WebSocket is insufficient: the agent session, regional task state, realtime subscriptions and host UI must agree on readiness. Ordinary network reconnection must continue without regional cleanup.

The current package has authenticated service discovery, fresh notification subscription, ordinary reconnect, silent relogin, a separate RTD socket, browser-voice state, and typed task state/UI controls. It has no explicit `SYSTEM_REGION_SWITCH` / region-mismatch recovery contract. The relevant current code is in this `contact-center` checkout; findings from the older `/Users/rsarika/dev/CCSDK/webex-js-sdk/packages/@webex/plugin-cc` checkout are not its implementation baseline.

### Goals and outcomes

- Recover eligible agent sessions after regional or organization failover and failback.
- Let host applications distinguish recovering, usable, manual-login-required, page-restart-required and unavailable states.
- Preserve authentication, existing voice-state semantics, task-control ownership and ordinary reconnect behavior.
- Make cancellation, retries and cleanup observable and testable without a live regional drill.

### Stakeholders and responsibilities

| Stakeholder | Responsibility |
| --- | --- |
| SDK maintainers | Transport, session orchestration, task/resource cleanup, public contracts and automated proof |
| Host application developers | Recovery presentation, whole-page navigation, manual station login and their own resources |
| Platform/configuration owners | Deliver org entitlement and compatible discovery, admission and session APIs |
| QA / recovery operators | Provide an entitled test org and run coordinated failover/failback drills |
| Agents | Observe an accurate recovery state and resume supported work after session restoration |

### Current scope

This contract covers the existing Contact Center agent package: registration, notification transport, agent/station restoration, SDK-owned task state and media resources, and the RTD features the package already subscribes to. Recovery integrates the existing browser-voice and XState contracts. The SDK must not represent recovered signaling as proof that an ongoing call or its audio migrated uninterrupted.

### Dependencies and assumptions

1. The authoritative MR source is a separate authenticated `GET organization/{orgId}/organization-setting` through `wcc-api-gateway`, following Desktop's live read. Add a narrow internal MR reader using the existing Config/WebexRequest patterns. The existing desktop-login aggregate remains the source for normal Profile aggregation; neither its cached settings nor an omitted MR projection establishes non-entitlement.
2. U2C supplies the logical `wcc-api-gateway` service. Notification admission supplies the actual WebSocket URL. Their hostnames are not required to identify the same region.
3. The platform produces the event and mismatch reasons defined below. The client does not trigger platform failover or provision entitlement.
4. Supported station modes retain their existing backend and calling prerequisites, including `disableWebRTCRegistration` and Webex App integration.
5. An entitled org, agent credentials/team/DN, deployed version identifiers and a coordinated operator window are required for live acceptance. The validation document records that evidence separately from local tests.
6. An implementation runner must support an SDK/library change without synthesizing a host UI, visual harness or live operator actions. Before admission it must check access to the target checkout and package dependencies, Node 22.14 and Yarn 3.4.1, the documented build/test commands, and an authorized independent validation integration for canonical spec changes. An unmet prerequisite stops that stage with an explicit environment/gate result; it is not a feature-test pass. Tool and flow prerequisites belong to the runner, not new SDK runtime configuration.

### Data contracts and public interfaces

#### Organization configuration

Add an internal MR settings record with optional `multiRegionEnabled?: boolean` and `homeRegion?: string`, decoded from the separate organization-setting response. Start registration-scoped MR hydration after notification Welcome and complete Profile availability, independently of normal Profile aggregation. Do not delay the existing registration completion boundary for MR hydration, return a partial Profile, or turn an MR-read failure into an otherwise-successful register() rejection. Never reuse another org's result or retain an old positive eligibility decision across a new registration generation. The MR reader's normalized response is an array of organization-settings records, matching Desktop's OrganizationSettingsResponse. Use only element [0] when nonempty; ignore additional elements rather than merging/scanning for a true flag. An empty/non-array response or malformed first element leaves eligibility unknown. The HTTP adapter must unwrap the actual backend envelope to this typed array and verify its wire shape with a sanitized fixture. Run one bounded hydration cycle per register() generation, with no polling, DR/ordinary-reconnect reread or separate public refresh API; a new register() invalidates the old decision and starts fresh. Any additive public MR metadata comes from this live result, not a missing aggregate field.

| Input | Effective eligibility / metadata |
| --- | --- |
| Nonempty authoritative organization-setting response record with literal `true` | Enabled |
| Nonempty authoritative record with `false` or no MR field | Disabled; this legacy-record rule does not apply to omitted aggregate fields |
| Non-boolean MR value, failed live request, empty/malformed live response | Unknown |
| Missing/invalid `homeRegion` | Home region unknown; enabled entitlement remains enabled |

#### Backend switch event

```ts
type SystemRegionSwitch = {
  type: 'SYSTEM_REGION_SWITCH';
  orgId: string;
  trackingId: string;
  data?: {
    operation?: 'FAILOVER' | 'FAILBACK';
    scope?: 'REGION' | 'ORG';
  };
};
```

The required IDs must be nonblank strings and the organization must match the authenticated active session. Optional operation/scope values are copied only when recognized; unknown values do not establish a target region. The envelope carries no client-authoritative replacement URL.

#### Proposed additive SDK event

Implement and export `REGION_RECOVERY_EVENTS.STATE_CHANGE = 'region:stateChange'` and `RegionRecoveryState`. This is a new proposed API, not an existing export. Publish through `ContactCenter.trigger()` using the established plugin event ownership.

```ts
type RegionRecoveryStatus =
  | 'recovering'
  | 'ready'
  | 'reloadRequired'
  | 'stationLoginRequired'
  | 'unavailable';

type RegionRecoveryReason =
  | 'initial-login'
  | 'region-switch'
  | 'region-mismatch'
  | 'not-eligible'
  | 'session-restore-failed'
  | 'automatic-relogin-disabled'
  | 'authentication-failed'
  | 'recovery-failed';

type RegionAutoAvailableStatus =
  | 'waitingForVoice'
  | 'requesting'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

type RegionRecoveryState = {
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

Each payload is a complete recovery snapshot. Omitted metadata means unknown, not false; consumers must not merge an old serving region into a new unknown snapshot. `retryAfterMs`, when present, is the scheduled nonnegative wait before the next attempt. Emit on snapshot change, not for each keepalive. Events do not contain raw URLs, tokens or station-login data.

`ready` requires a restored/logged-in station session. First successful station login can emit `ready` with `initial-login`; a recovered session uses its initiating recovery reason. `register(): Promise<Profile>` retains its existing completion boundary and does not wait for a human station login. Operation promises report their own completion/failure; the event reports shared recovery state, so consuming it does not also complete an operation promise.

`autoAvailable` reports the conditional DR state-change action separately from session readiness. Omit it when no such action applies. `waitingForVoice` means required browser voice is unavailable, `requesting` means the automatic state request is in flight, `succeeded` requires backend acknowledgment, and `failed` means that request failed without a confirmed state change. `cancelled` means no further automatic action will be dispatched for that intent; it does not undo a request already sent. Emit each changed outcome in the complete snapshot, preserving the initiating recovery reason/tracking metadata. A usable session can remain `ready` with any of these outcomes; `ready` does not assert Available or voice readiness. Retain the latest outcome until the next recovery/session generation. Existing voice and backend agent-state events retain their current payloads; do not fabricate a backend failure event for a local rejection.

Use the existing augmented plain-Error pattern for public recovery failures; add no exported Error subclass or instanceof-based contract. Export `REGION_RECOVERY_ERROR_CODES` as a const catalog with values RECOVERY_INTERRUPTED, RECOVERY_IN_PROGRESS, STALE_TASK and REGION_RELOAD_REQUIRED and derive its string-union type. Put the lifecycle reason in `err.data.reason`, retaining compatible non-sensitive existing `.data` diagnostic fields. Internal Err.Message/Err.Details and unrelated backend error semantics remain unchanged. Promise rejection reports its operation, while the lifecycle event reports shared recovery state.

### Functional requirements

#### REQ-MR-001 — Backend entitlement is the gate

The SDK MUST enable MR recovery automatically only for the active org's confirmed entitlement. It MUST NOT require Split evaluation, `IS_CDN_BUILD`, a Cisco frontend hostname or a new SDK opt-in. It MUST honour existing station/voice configuration independently of entitlement.

Why: SDK consumers host their own applications, and the requested enablement authority is backend-delivered org configuration.

#### REQ-MR-002 — Hydrate eligibility without stale fallback

The SDK MUST hydrate MR eligibility from the separate live organization-setting read after Welcome and complete Profile availability. It MUST retry transient/invalid MR reads up to five attempts with 1/2/3/4-second waits, applied only to that narrow reader, and retain unknown after exhaustion. Its asynchronous failures MUST be caught and MUST NOT reject an otherwise-successful register(), retry the whole Profile aggregation, or return a partial Profile. Each new register() generation MUST invalidate the previous eligibility decision and run exactly one bounded MR hydration cycle. Ordinary reconnect and DR restore MUST NOT initiate another MR hydration cycle. A failed cycle MUST preserve an otherwise-valid complete Profile with unknown eligibility. Normal Profile-fetch failures MUST retain their existing registration error behavior. The MR reader MUST use existing host authentication handling; a terminal 401/403 after that handling MUST stop only its own retry cycle, retain unknown eligibility and leave otherwise-valid register()/Profile and primary/RTD connections unaffected. It MUST NOT initiate logout or an unavailable session event solely because the MR read failed. Independent host-wide auth/session handling retains its existing authority. A successful nonempty authoritative legacy record MUST resolve to disabled; missing MR fields in the desktop-login aggregate MUST NOT certify disabled eligibility.

Why: Unavailable settings must not silently authorize recovery or turn an entitled org into confirmed disabled.

#### REQ-MR-003 — Validate and deduplicate events

The SDK MUST apply the envelope guards above before any socket action. It MUST retain at most the 128 most recently accepted tracking IDs in registration/org-scoped FIFO history, ignore a duplicate within that history, and permit a distinct valid event to supersede the active recovery generation. At capacity it MUST evict the oldest ID; an evicted ID is no longer guaranteed duplicate suppression. Unknown-eligibility events MUST NOT enter the accepted history. Session teardown MUST clear the history.

Why: Duplicate, unrelated and late notifications must not start competing recovery operations.

#### REQ-MR-004 — Define unknown and disabled event behavior

With eligibility unknown, a valid switch event MUST be logged and ignored without closing the socket or queueing replay. This explicitly includes the window between Welcome/profile availability and hydration completion: the retry waits alone can total 10 seconds, plus request time. Ordinary reconnect and recognized placement-409 restart remain fallback paths; ignoring the event does not guarantee later recovery or activate the long DR retry policy. With eligibility disabled, it MUST stop primary and RTD reconnect drivers, cancel pending transport installation, close both sockets without reconnection and emit unavailable/not-eligible. It MUST leave any existing browser calling line registered, without creating a line or ending a contact. The host MUST use its normal deregister() teardown when it signs out. This handler MUST NOT revoke global Webex credentials.

Why: This preserves the Desktop distinction between unknown and confirmed ineligible while keeping authentication ownership with the host.

#### REQ-MR-005 — Fresh admission owns socket placement

Every initial/recovery connection attempt MUST subscribe afresh using the logical gateway service and connect only to that attempt's validated returned URL. It MUST preserve `wss:` and RoutingNotifs host checks, propagate subscription failures and reject invalid URLs. It MUST NOT rewrite region labels or require a U2C fetch on every retry.

Why: Admission, rather than client string manipulation, selects the current notification service.

#### REQ-MR-006 — Serialize and bound individual attempts

There MUST be at most one live primary recovery attempt for the active generation. A subscribe phase MUST settle within 20 seconds; the subsequent socket/Welcome phase MUST settle within 30 seconds. Timeout/supersession MUST settle callers and prevent late results from installing sockets or state.

Why: Slow dependencies must not create parallel subscriptions, hanging initialization or session resurrection.

#### REQ-MR-007 — Separate ordinary and DR retry policy

Confirmed eligible event recovery MUST use 100/60/30/15-second waits with 0–50% positive jitter and repeat the final delay until recovery, cancellation or a terminal result. DR entry MUST cancel ordinary reconnect work and the ordinary restore watchdog. Ordinary network recovery MUST retain the existing 5-second cadence and current effective default 50-second recovery timeout without DR state cleanup; serialization is new work. The parsed Profile timeout is currently unwired, so applying tenant-configured timeouts is not implied by this requirement. Initial registration MUST retain one admission attempt; callers can retry failed registration.

Why: Regional promotion needs different waits, and the ordinary watchdog would otherwise expire before the first DR attempt.

#### REQ-MR-008 — Classify subscription mismatches precisely

Only subscription HTTP 409 with `REGION_MISMATCH_REGION_FAILOVER`, `REGION_MISMATCH_ORG_OVERRIDE`, `REGION_MISMATCH_ORG_OVERRIDE_SUPERSEDED` or `REGION_MISMATCH_NO_OVERRIDE` MUST stop retrying and request a controlled host restart. Read the header name `x-wxcc-region-reason` case-insensitively; trim reason values and match their values exactly and case-sensitively. Select the first nonblank source in header → body `reason` → body `error.reason` order. A nonblank unrecognized header MUST NOT fall through to a recognized body reason. Other 409s, including `REGION_MISMATCH_ORG_NOT_ELIGIBLE`, MUST retain ordinary error classification.

Why: A placement restart is distinct from transient failure and cannot be inferred from every conflict response.

#### REQ-MR-009 — Host owns page restart

A recognized mismatch MUST invalidate old work, reject interrupted registration with `REGION_RELOAD_REQUIRED`, and emit `reloadRequired/region-mismatch` once per generation. The SDK MUST NOT call `window.location.reload()`. The documented host integration MUST permit at most one restart per active org/browser tab within 120 seconds and surface repeated mismatch instead of looping.

Why: Embedded clients own navigation, unsaved UI and restart persistence across page loads.

#### REQ-MR-010 — Preserve a successful station snapshot

The SDK MUST retain in memory the last successful effective station-login payload, update it after successful station login and valid reload results, and reconcile it with the latest accepted team/device/DN/extension state before a DR wipe. Failed attempts MUST NOT overwrite accepted state. Fallback station login MUST preserve the current SDK default-aux behavior rather than replay a stale auxiliary code; restored current state/aux MUST come from successful backend responses. Explicit logout, deregistration or identity replacement MUST clear the snapshot.

Why: Recovery needs actual accepted station configuration rather than preferences, failed input or another session's data.

#### REQ-MR-011 — Restore the session, not merely the socket

At acceptance of an eligible switch, the SDK MUST perform the immediate request/continuation protections in REQ-MR-013 before closing the old primary socket or scheduling the first DR wait. It MUST preserve accepted station configuration before any regional wipe. Only after a valid replacement Welcome, and only for a prior backend-confirmed active station with automatic relogin enabled and usable saved configuration under the ordered REQ-MR-012 policy, MUST it invalidate regional Task/store state and attempt reload-agent restoration. This post-Welcome wipe MUST NOT delay the immediate protections. After cancellation/terminal-auth guards, only AQM Timeout/TimeoutEvent, 1037/INTERNAL_ERROR and HTTP 429/502/503 MUST receive four total reload attempts with 2/4/8-second waits. Codes 1038/1041 or AGENT_NOT_FOUND/AGENT_DN_NOT_REGISTERED MUST go directly to saved station login; other non-transient reload failures MUST also go directly to that fallback, without retrying reload. Exhausted transient retries MUST attempt saved station login when automation is allowed. Add the required numeric/reason normalization explicitly; current SDK relogin only special-cases AGENT_NOT_FOUND. Login 1035/AGENT_SESSION_ALREADY_EXISTS MUST permit one reload-agent retry; a second failure MUST request manual login. Socket loss MUST abort the current session-restoration attempt.

Why: The new transport can exist before the backend session is usable.

#### REQ-MR-012 — Respect manual-login policy and existing session effects

After valid replacement Welcome, the SDK MUST evaluate the following policy in the listed order; the first matching row controls the outcome. A prior active station means a backend-confirmed station session before the switch, including one restored during register(), and does not require a public stationLogin() call in the current tab. The immediate protections in REQ-MR-013 apply to every eligible switch independently of these branches.

| Order | Condition | Required action / public outcome |
| --- | --- | --- |
| 1 | No prior backend-confirmed active station | Preserve complete Profile, skip station-session wipe/reload/login, resume supported RTD after transport restoration, and emit stationLoginRequired/region-switch, regardless of allowAutomatedRelogin or absent saved configuration. |
| 2 | Prior active station and allowAutomatedRelogin is false | Preserve station configuration, skip automatic reload and fallback station-login requests, and emit stationLoginRequired/automatic-relogin-disabled. An absent snapshot does not change this reason; it is not an attempted restore failure. |
| 3 | Prior active station, automation enabled, but required saved configuration is absent | Skip automatic session requests and emit stationLoginRequired/session-restore-failed. |
| 4 | Prior active station, automation enabled and saved configuration usable | Perform post-Welcome regional cleanup and REQ-MR-011 restoration. If automatic restoration fails, emit stationLoginRequired/session-restore-failed; on success, apply the restored session and publish ready. |

Public stationLogin() remains available in every stationLoginRequired outcome after transport restoration and performs the required station/task cleanup through the existing owners before accepting replacement-session data. No branch treats a missing prior station as an error or runs reload when automation is disabled. Successful session restoration MUST apply backend-restored team, state/auxiliary code, timestamps, wellness-session identity, and applicable Webex App post-login effects.

For automatic DR reload-agent restoration, the SDK MUST retain Desktop's auto-Available rule only when the successful backend result has `lastStateChangeReason === 'agent-wss-disconnect'`. It MUST NOT infer that reason from outage duration or a stale pre-recovery cache, or auto-Available after fallback/manual station login without that successful reload result. If required browser voice is unavailable according to the existing voice policy, it MUST preserve backend-restored state/aux, report `autoAvailable:waitingForVoice` and keep exactly one generation/session-scoped pending action. It MUST attempt Available once voice becomes ready and the generation, station session and state-intent preconditions still match. DN/extension and configurations that do not require SDK browser voice MUST NOT wait on browser voice.

The SDK MUST publish `requesting`, `succeeded`, `failed` and `cancelled` outcomes as specified above. A local `BROWSER_VOICE_NOT_READY` race before dispatch MUST return the action to `waitingForVoice`; other rejection/timeout MUST report `failed`, retain the last backend-confirmed state/aux and require an explicit host/agent state action rather than silently retrying Available. Subsequent authoritative backend state events remain authoritative; failure is not proof the server rejected a timed-out request. Cached state/aux/timestamps MUST change to Available only on backend acknowledgment. Waiting for required browser voice or an unsuccessful Available request MUST NOT turn an otherwise-usable station session into a restore failure or hold its `ready` event indefinitely.

Explicit host/agent state-change intent, logout/deregistration, identity or station-session replacement, multi-login termination, a superseding recovery, or a newer backend state that invalidates the disconnect-state precondition MUST cancel pending auto-Available and detach its listener. Capture the state-intent revision when confirmed DR begins; an explicit intent after that point MUST prevent later arming, even if it arrives before reload completes. Before dispatch and after each await, the SDK MUST check generation/session and state-intent guards. It MUST consume pending work and detach its voice listener before dispatch; a duplicate voice-ready callback MUST NOT send a duplicate request. An explicit state request MUST cancel pending work immediately and be serialized after an already-dispatched automatic request settles; cancellation cannot roll back that request. Distinct request correlation and intent guards MUST prevent an old automatic reply from completing the explicit operation or overwriting a newer accepted state. Report cancellation while the original context is active and clear pending work/listeners; retain that outcome if the session continues, and emit no old-generation outcome into a replacement session. The automatic action's own correlated acknowledgment is a result, not an independent cancellation trigger.

Why: New recovery must preserve existing consumer choices and integration state.

#### REQ-MR-013 — Cancel stale requests and prevent stale task use

Immediately on acceptance of an eligible switch, before closing the old primary transport or scheduling the DR wait, the SDK MUST advance the recovery generation, reject still-pending old-generation AQM operations with `RECOVERY_INTERRUPTED`, clear their timeout/bind ownership, guard old asynchronous and media-acquisition continuations, block new conflicting task/call-control commands and pause RTD. Install these protections before publishing recovering; after application callbacks, recheck the generation before closing/scheduling so a synchronously reentrant logout/deregister cannot resurrect recovery or affect a replacement session. These actions MUST NOT wait for replacement Welcome. An operation already settled before event acceptance MUST NOT be settled a second time. Non-idempotent call-control requests MUST NOT be replayed automatically.

During the wait and while awaiting manual station login, new conflicting task/call-control commands MUST reject with `RECOVERY_IN_PROGRESS` before backend/media work. A late old-generation HTTP/WebSocket/media completion MUST NOT answer a call, install state or settle a replacement operation. Full Task/store invalidation occurs at the post-Welcome cleanup boundary in REQ-MR-011, or before accepting a manual replacement station session; retained objects invalidated there MUST reject with `STALE_TASK`. Read-only getters MUST retain their normal behavior; logout/deregistration MUST remain allowed. Public stationLogin MUST remain allowed in stationLoginRequired after transport restoration, while conflicting automatic restore work is cancelled. This immediate interruption/guard layer is new SDK work; preserving Desktop's later application-state wipe does not provide it automatically.

Why: Clearing a map alone does not prevent a host's retained object or old completion from acting against the wrong session.

#### REQ-MR-014 — Integrate Task/XState and UI controls

Task invalidation, listener cleanup and rehydration MUST pass through the owning Task/TaskManager/state-machine interfaces. Existing `TaskUIControls` shape and `task:ui-controls-updated` delivery MUST be preserved; invalidated task actions MUST become disabled. Cleanup MUST NOT synthesize backend `ContactEnded`, successful wrap-up or `task:end`. Restored backend tasks MUST use existing hydration mapping.

Why: A parallel host-side task policy would diverge from the SDK's typed lifecycle and misrepresent backend outcomes.

#### REQ-MR-015 — Release owned media without ending contacts

Post-Welcome regional Task cleanup, or cleanup before a manual replacement station session, MUST stop microphone tracks acquired by SDK WebRTC tasks and remove task-specific listeners/references. The generation guard MUST already be active at event acceptance: any old-generation media acquisition completing during the DR wait or after cleanup MUST stop its newly acquired tracks without answering the call. Host-owned tracks MUST remain host-owned. Cleanup MUST NOT invoke contact-ending APIs, `call.end()` or deregistration of a healthy calling line.

Why: Regional cleanup must free local resources without falsely terminating backend work or unrelated media.

#### REQ-MR-016 — Keep calling state separate

DR restoration MUST reuse a healthy browser line through a dedicated preserve/ensure path, register only when no usable line exists, and honour `disableWebRTCRegistration`. Existing `getVoiceConnectionState()` and `voice:connectionStateChange` line/Mobius semantics MUST remain intact. Available-state checks MUST retain their current browser-voice prerequisites.

Why: Current `registerWebCallingLine()` replaces registration; blindly invoking it for DR would deregister an existing line and conflate signaling recovery with voice readiness.

#### REQ-MR-017 — Restore owned realtime subscriptions

Confirmed DR MUST pause/close the old RTD connection, suppress stale RTD delivery, and re-subscribe features enabled by the current profile after primary/session recovery. RTD failure MUST remain contained from a usable core agent session and be observable through existing diagnostics. Task-owned summary/enablement/transcript state MUST be cleared or rehydrated through its existing owners, not delivered to invalidated tasks.

Why: A new primary socket does not move the SDK's independent realtime connection or caches.

#### REQ-MR-018 — Publish honest readiness and region metadata

The SDK MUST follow the public event contract above. It MUST parse serving-region metadata from lowercased hostname labels against one named internal constant containing exactly the reference labels intgus1, qaus1, loadus1, loadus2, produs1, produs2, prodanz1, prodca1, prodeu1, prodeu2, prodin1, prodjp1 and prodsg1, without inspecting/logging signed query data. This registry is metadata parsing, not URL authorization. Compare nonblank home/serving regions after trimming and lowercasing. Only with confirmed enabled MR eligibility MUST it emit `limitedService:true` for known unequal regions or `false` for known equal regions; otherwise omit the field. Successful station restoration MUST NOT claim uninterrupted active-call media or restoration of services the SDK does not own.

Why: Hosts need accurate recovery and limited-service presentation rather than hostname guesses or transport-only success.

#### REQ-MR-019 — Cancel on lifecycle termination

Explicit logout, deregistration, identity replacement and multi-login termination MUST invalidate recovery attempts, cancel timers, detach listeners using the registered references, and prevent late results from changing the new session. A distinct valid switch during recovery MUST supersede the old generation without concurrent installation.

Why: Recovery must not bring back a deliberately closed session or mix organization state.

#### REQ-MR-020 — Contain auth, dependency and observer failures

The SDK MUST preserve structured status/reason/tracking metadata for classification, use existing host auth refresh, and surface terminal auth/permission failures without an endless DR loop. Transient offline, 429 and 5xx failures MUST remain paced and serialized. Logging, metrics, RTD failure or a throwing application observer MUST NOT turn successful session recovery into failure or stop cleanup.

Why: Dependency failures and consumer callbacks must not corrupt the recovery state machine.

### Quality requirements

#### REQ-MR-021 — Safe observability and compatibility

LoggerProxy and MetricsManager MUST record stage, outcome, attempt count and elapsed time without raw events, credentials, DN snapshots, media content, bearer tokens or signed URLs. Logging of existing affected socket-connect paths MUST redact query strings. Existing public methods, voice snapshots, TaskUIControls and registration promise boundaries MUST remain compatible; new region types/events/errors MUST be additive exports.

Why: Diagnosis requires useful signals without secret disclosure or breaking current SDK consumers.

### Rollout and release acceptance

Delivery is automatic for backend-entitled organizations using a compatible SDK release. The next register() generation observes backend entitlement changes; no mid-session entitlement reread is introduced. Backend entitlement false disables that freshly hydrated registration; this proposal adds no Split evaluator, polling loop, runtime SDK toggle or browser-hosting requirement. Existing auth, voice and integration configuration remains authoritative for its own behavior. A dependency failure does not change stored backend entitlement.

Local engineering completion requires AC-001–AC-020 / T-001–T-013, the documented package checks and any applicable manifest-routed independent spec validation, with environment prerequisites checked before execution. Resolve the intended generator and independent validator identity/integration from current AGENTS/manifest policy and the new invocation's provenance; an opaque historical validator run ID is not an executable command. Do not infer validator selection from the previous document baseline or replace independent review with same-runtime self-review.

Release acceptance additionally requires a positive authoritative organization-setting fixture, independent-reader failure-isolation evidence, compatibility review, and actual AC-021 live evidence collected by QA/platform owners. The validation report must retain failed, partial and unexecuted results explicitly. A local implementation pass never substitutes for the human release gate. This draft is not a declaration that those gates have passed.

## Acceptance Criteria

Local automated engineering checks are AC-001–AC-020, using controlled platform/calling boundaries; the validation document maps them to T-001–T-013. AC-021 is mandatory human/operator-executed release acceptance. It MUST NOT be converted into an autonomous failover command or a local build/test dependency. Local engineering completion can be reported with AC-021 explicitly not executed; release acceptance remains incomplete until its actual live evidence passes. None of these rows claims an existing passing test.

- AC-001 — REQ-MR-001: Given an entitled authenticated org, recovery runs without Split/CDN/SDK opt-in; given disabled or legacy settings, it does not enter eligible DR.
- AC-002 — REQ-MR-002: Given live MR settings arrays, the first item alone controls eligibility; extra items are ignored, and empty/non-array/malformed-first results remain unknown. One hydration cycle runs per register() with 1/2/3/4-second retry waits; reconnect/DR restore does not reread and re-register starts a fresh generation. Terminal MR-read auth failure stops only that cycle; all MR-only failures preserve valid Profile/register and connections. Missing aggregate fields cannot certify disabled MR.
- AC-003 — REQ-MR-003, REQ-MR-004: Given malformed, wrong-org, unknown-eligibility or disabled events, handlers ignore or close without DR as specified. Given confirmed disabled eligibility, both primary/RTD sockets and retry drivers stop, the existing browser line remains registered, and a late subscription cannot reconnect. A switch during initial hydration is ignored without replay; tests exercise subsequent ordinary reconnect and recognized-409 fallback without promising DR recovery from the missed event. Given A/B/A inside the 128-ID window, the final A is ignored; insertion 129 evicts only the oldest ID.
- AC-004 — REQ-MR-005: Given fresh subscribe responses with different trusted sockets, each attempt opens only its own returned URL; rejected URLs/errors never open an old socket or rewrite a hostname.
- AC-005 — REQ-MR-006: Given slow subscribe/Welcome and late callbacks, deadlines reject once and no more than one primary attempt installs a socket.
- AC-006 — REQ-MR-007: Given a confirmed switch, fake-clock DR waits follow the stated sequence/jitter and survive the ordinary 50-second watchdog; ordinary recovery retains its existing timing and no DR wipe.
- AC-007 — REQ-MR-008, REQ-MR-009: Given every listed mismatch header/body variant, only exact recognized subscription 409 reasons emit restart-required and settle registration. An unknown nonblank header defeats a valid body reason, wrong-case values do not match, and other conflicts do not trigger a restart.
- AC-008 — REQ-MR-009: Given repeated mismatch across host reloads, the host example allows one org/tab restart per 120 seconds and emits/displays failure rather than looping.
- AC-009 — REQ-MR-010: Given successful station login, profile/team/device updates and reload results followed by a failed attempt, the snapshot reflects the latest accepted state, preserves SDK default-aux behavior and clears on teardown.
- AC-010 — REQ-MR-011, REQ-MR-012: Given an eligible automatic-restore branch, each allowlisted transient reload failure, missing-session/DN failure, other non-transient failure, 1035 and socket loss follows the precise retry/fallback/abort rules, normalizes new error cases and never emits ready early. No automatic reload/login is sent for an earlier manual-policy branch.
- AC-011 — REQ-MR-012: Given no prior active station, automation false and no snapshot, preserve Profile/resume RTD and emit stationLoginRequired/region-switch without station wipe/reload/login. Given a prior active station, automation false and no snapshot, emit automatic-relogin-disabled with no automatic reload/login. Given a prior active station, automation enabled and missing required snapshot, emit session-restore-failed. A session restored during register() counts as prior active. Every manual outcome permits public stationLogin after transport recovery; required cleanup precedes replacement-session data and success emits ready.
- AC-012 — REQ-MR-012: Given successful restoration, team/state/aux/timestamps/wellness identity and Webex App integration reflect backend results. Only an exact backend agent-wss-disconnect reload result permits auto-Available; other reasons, absent reason and fallback/manual login do not send it. Required voice unavailable defers one action while session-ready is reported; ready voice or a mode without that requirement sends once. Duplicate callbacks, local voice-readiness races, failed/timeout requests, explicit state intent and every listed cancellation are covered. Outcomes are observable; no cached Available precedes acknowledgment, no hidden retry follows other failure, and stale replies cannot complete an explicit operation or overwrite newer accepted state.
- AC-013 — REQ-MR-013, REQ-MR-014: Given pending old AQM operations at accepted DR entry and no replacement Welcome for more than 100 seconds, requests reject immediately with RECOVERY_INTERRUPTED, timers/binds clear and no normal 20-second timeout or old completion settles them again. Conflicting commands throughout the wait reject with RECOVERY_IN_PROGRESS. Post-Welcome/manual-replacement invalidation makes retained Tasks STALE_TASK and disables controls without synthetic task-end success. Getters/logout/deregister remain allowed; lifecycle errors are plain Error objects with data.reason from the exported catalog.
- AC-014 — REQ-MR-015: Given old-generation microphone acquisition completing during the DR wait or after invalidation, its tracks stop without answering/ending a stale call. Given existing SDK-owned tracks, the defined post-Welcome/manual-replacement cleanup stops them and removes listeners; host-owned resources remain untouched.
- AC-015 — REQ-MR-016: Given a healthy, absent or intentionally disabled browser line, recovery respectively preserves, establishes or skips registration while preserving voice-state/Available checks.
- AC-016 — REQ-MR-017: Given RTD enabled and old-generation messages, recovery subscribes again for supported features, drops stale delivery, and contains RTD failure from the usable primary session.
- AC-017 — REQ-MR-018: Given confirmed enabled eligibility and normalized home/away/unknown placement, snapshots respectively contain false/true/no limitedService; disabled/unknown eligibility omits it. All 13 labels and whitespace/case handling are tested; ready requires station success and makes no media-continuity assertion.
- AC-018 — REQ-MR-019: Given logout, deregistration, multi-login, identity change or a superseding switch, old timers/results cannot reconnect or mutate the replacement session; this includes logout/deregister called synchronously by a recovering-event observer.
- AC-019 — REQ-MR-020: Given offline/429/5xx/auth failure or throwing observers/metrics, retries and terminal outcomes retain classification and cleanup continues.
- AC-020 — REQ-MR-021: Given signed URLs and sensitive fixtures, affected logs/metrics/events omit secrets; type/API regression checks preserve existing consumers.
- AC-021 — REQ-MR-001, REQ-MR-005, REQ-MR-011, REQ-MR-016, REQ-MR-017, REQ-MR-018: Human/operator release gate: given an assigned entitled live org, authorized credentials and coordinated failover/failback window, QA/platform owners record the authoritative live org-settings payload, admission placement, station result, new-call results and supported RTD/voice evidence separately for DN/extension/browser. Missing access/window remains not executed; local mocks cannot pass this gate.
