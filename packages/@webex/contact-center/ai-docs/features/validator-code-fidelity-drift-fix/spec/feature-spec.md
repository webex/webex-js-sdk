# Feature Spec — Validator Code-Fidelity Drift Fix

> Start here → package root [`AGENTS.md`](../../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ARCHITECTURE.md). This is a documentation-only protected-spec delta; it does not authorize runtime code changes.

## Metadata

| Field | Value |
|---|---|
| Feature / ticket key | `CC-SDD-VALIDATOR-DRIFT-20260707` |
| Title | Validator code-fidelity drift fix |
| Status | implemented — deterministic verification PASS; independent revalidation pending |
| Change class | contract-affecting documentation correction |
| created_by / approved_by / date | Codex generator / developer approved MOD-001 through MOD-011 application / 2026-07-07 |
| Generated from | `feature-spec` @ SDLC template library `0.2.1` |

## Problem & Goal (WHAT + WHY)

**What:** Correct the protected Contact Center SDD baseline so its public APIs, internal signatures, orchestration ownership, contract catalog, event/type inventories, and examples match current code.

**Why:** Independent validation found nine Blocking and twenty Important code-fidelity findings. Leaving them in place would cause agents and maintainers to call non-existent APIs, assign behavior to the wrong owner, omit real exports and dependencies, or trust incomplete orchestration flows.

## Stakeholders & Open Questions

| Stakeholder / role | Interest in this change | Sign-off needed? |
|---|---|---|
| Contact Center package maintainers | Canonical documentation must describe current implementation accurately | yes |
| SDK consumers | Public exports, events, types, and semver guidance must be trustworthy | yes |
| Independent validator runtime | Must re-check Axis A and Axis B after remediation | yes |

**Open questions:**

- **Q-1 May this reviewed delta be applied to the protected canonical targets?** — owner: developer — status: answered yes on 2026-07-07.

## Scope

**In scope:**

- Correct all nine Blocking findings from the independent validation pass.
- Correct all twenty Important API, type, event, transport, evidence, taxonomy, and completeness findings.
- Update only the protected canonical docs named in this delta after explicit approval.
- Re-run source fidelity, generated-document conformance, coverage review, and independent validation.

**Out of scope:**

- Runtime source or test changes.
- New APIs, events, fields, endpoints, flags, or behavior.
- Manifest runtime changes or automatic promotion to `Specced`.
- The fifteen Medium and three Minor findings unless a correction is mechanically necessary for an approved Blocking/Important fix.
- Pattern-library evidence annotations; those remain a separate onboarding follow-up.

**Open decisions:** None; independent revalidation remains a gate, not a product decision.

## Requirements

| Req ID | Requirement (WHAT) | Rationale (WHY) | Acceptance (how proven) | State |
|---|---|---|---|---|
| DRIFT-R-001 | Replace generic Contact Center orchestration diagrams with code-grounded register, deregister, event-routing, and reconnect/relogin flows. | `src/cc.ts` is the primary orchestration implementation; generic diagrams hide ordering and ownership. | All four flows name real collaborators and are independently validated against `src/cc.ts`. | Implemented; independent validation pending |
| DRIFT-R-002 | Make every documented export, signature, type, event, and endpoint match current source exactly. | Hallucinated names and incomplete signatures cause invalid implementation work. | Validator reports zero Blocking B1/B3 findings and zero hallucinated APIs. | Implemented; independent validation pending |
| DRIFT-R-003 | Correct constructor/register timing and responsibility boundaries. | Lifecycle errors can cause duplicate listeners, missed initialization, or incorrect cleanup. | Services/ContactCenter/Core ownership statements match the current constructors and methods. | Implemented; independent validation pending |
| DRIFT-R-004 | Complete the contract index and module Provides/Requires summaries. | Agents load `CONTRACTS.md` and module surfaces before implementation. | Every affected public export and material collaborator is indexed once with a real source path. | Implemented; independent validation pending |
| DRIFT-R-005 | Correct state-machine action/control documentation without changing the state machine. | False absence and wrong symbol names invert current behavior. | Actions, control-computation functions, exports, and Task-layer overrides match current files. | Implemented; independent validation pending |
| DRIFT-R-006 | Correct metrics, task-event, config-field, and taxonomy inventories. | Incomplete inventories hide real observable behavior and configuration. | Inventories reconcile one-for-one with their owning constants/types and explicitly identify defined-but-unmapped metrics. | Implemented; independent validation pending |
| DRIFT-R-007 | Remove unstable evidence suffixes and generic acceptance wording. | Stable evidence and testable requirements are required for deterministic review. | Evidence uses file paths only; each modified statement has concrete code/test acceptance. | Implemented; independent validation pending |
| DRIFT-R-008 | Preserve runtime behavior and public semver. | This is a documentation correction, not a product change. | Git diff contains no runtime source/test modifications and documents no new runtime contract. | Implemented; independent validation pending |

## Acceptance Criteria

- The nine Blocking findings BLK-1 through BLK-9 are absent in the second independent validation pass (DRIFT-R-001 through DRIFT-R-005).
- The twenty Important findings IMP-1 through IMP-20 are corrected or explicitly dispositioned with code evidence and validator acceptance (DRIFT-R-002 through DRIFT-R-007).
- `routingAgent` is indexed from `src/index.ts`; no contract catalog entry invents a non-exported surface (DRIFT-R-002, DRIFT-R-004).
- `initWebSocket` documents both `body` and `resource`; AQM examples use a `WebSocketManager` constructor dependency and config-factory binds (DRIFT-R-002).
- Contact Center lifecycle diagrams distinguish READY-time construction, `register()`, `deregister()`, message routing, and `handleConnectionLost()` → `silentRelogin()` (DRIFT-R-001, DRIFT-R-003).
- Config aggregation includes `getAIFeatureFlags`, `Profile.aiFeature`, the `ai-feature` endpoint, and the real response/field names (DRIFT-R-002, DRIFT-R-006).
- The task-state-machine spec names the four real actions and the real UI-control computation functions, and explains the Task-provided `syncTaskDataFromEvent` implementation (DRIFT-R-005).
- All changed canonical docs pass template conformance, stable-evidence checks, local-link checks, and source-fidelity checks before revalidation (DRIFT-R-007).
- No non-documentation runtime file under `src/` and no file under `test/` changes as part of applying this delta (DRIFT-R-008).

## Success & Guardrail Metrics

| Metric | Type | Baseline | Target / bound | How measured |
|---|---|---:|---:|---|
| Blocking validator findings | success | 9 | 0 | Independent `spec-validator` report |
| Hallucinated/non-existent API names | success | 8 plus one inverted absence | 0 | Independent B1/B2 review |
| Contract-index mismatches | success | 6 | 0 | Independent B3 review |
| Important findings | success | 20 | 0 unresolved | Independent validation matrix |
| Runtime behavior changes | guardrail | 0 intended | 0 | Git diff for non-Markdown files under `src/` and all files under `test/` |
| No-override violations | guardrail | 0 | 0 | Reconcile/conformance checks |

## Prior-Work Register

| Existing artifact | How it relates | Reuse / extend / supersede |
|---|---|---|
| `.sdd/manifest.json` | Defines protected targets, source policy, module routing, and validator runtimes | reuse |
| Canonical module specs listed below | Contain the drift identified by independent review | modify only through this reviewed delta |
| `ai-docs/CONTRACTS.md` | Root public-surface index missing or overstating affected contracts | modify only through this reviewed delta |
| Current `src/` and `test/` trees | Behavioral source of truth for every correction | reuse; never modify in this drift fix |

## Contracts Delta

**Provides:** MODIFIED documentation only — align `routingAgent`, Contact Center methods, Task/state-control exports, agent/config response types, events, and internal module surfaces with current exports and implementations.

**Requires:** MODIFIED documentation only — align WebSocket initialization, AQM configuration, READY-time collaborators, `ApiAIAssistant`, both WebSocket managers, WebexRequest ownership, Task overrides, and metrics/config dependencies with current code.

No runtime contract is added, removed, renamed, or changed by this delta.

## Impacted Modules / Repos

| Module / repo | Impact | Manifest coverage state |
|---|---|---|
| Contact Center (`src`) | Replace generic orchestration and correct ownership/evidence | Partial |
| Metrics (`src/metrics`) | Complete metric catalog/taxonomy and disabled timing behavior | Partial |
| Services (`src/services`) | Correct READY-time composition and collaborator graph | Partial |
| Agent (`src/services/agent`) | Remove non-owned operations and correct event/type ownership | Partial |
| Config (`src/services/config`) | Complete AI-feature aggregation and correct types/fields/URL | Partial |
| Core (`src/services/core`) | Correct WebSocket/AQM signatures, timeouts, ownership, and evidence | Partial |
| Task (`src/services/task`) | Correct signatures, event inventory, factory/dialer ownership | Partial |
| Task state machine (`src/services/task/state-machine`) | Correct actions, control functions, exports, and overrides | Partial |
| Utils (`src/utils`) | Correct source/type ownership and public re-export claims | Partial |
| Root contracts | Index real exports and remove overstatements | Partial baseline |

## MODIFIED Requirements

### MOD-001 — Contact Center canonical orchestration

- **Canonical target:** `ai-docs/contact-center-spec.md`
- **WHAT:** Replace the generic Data Flow, Sequence Diagram(s), Class / Component Relationships, and State Machine material with code-grounded views for:
  - Webex READY callback construction of WebexRequest, Services, WebCallingService, ApiAIAssistant, MetricsManager, TaskManager, EntryPoint, AddressBook, and Queue;
  - `register()` listener setup, WebSocket connection, profile return, metrics, error log upload, and rejection;
  - `deregister()` listener removal, Mercury/device teardown when applicable, WebSocket/RTD shutdown, agent-config clearing, and success/failure metrics;
  - WebSocket message/event routing and connection-loss handling where ContactCenter receives `connectionLost` and conditionally invokes its private `silentRelogin()`.
- **WHY:** These flows define the package's actual orchestration boundary and cannot be represented by generic caller/collaborator templates.
- **Evidence:** `src/cc.ts`, `src/services/index.ts`, `src/services/task/TaskManager.ts`.
- **Acceptance:** DRIFT-R-001 through DRIFT-R-003 cite `src/cc.ts`; stale README residue is removed; the validator reports no A13 blocker.

### MOD-002 — Root contract catalog

- **Canonical target:** `ai-docs/CONTRACTS.md`
- **WHAT:** Add `routingAgent` as a real public export from `src/index.ts`, document its `routingAgent(routing: AqmReqs)` factory shape, and reconcile all other touched catalog rows with actual root exports. Clarify that `getDefaultUIControls` is exported by package root directly from `uiControlsComputer.ts`, not through `state-machine/index.ts`.
- **WHY:** The root contract index must enumerate real package consumption surfaces without inventing intermediate re-exports.
- **Evidence:** `src/index.ts`, `src/services/agent/index.ts`, `src/services/task/state-machine/uiControlsComputer.ts`, `src/services/task/state-machine/index.ts`.
- **Acceptance:** Independent B3 review reports zero missing/overstated rows for the corrected surfaces.

### MOD-003 — Core WebSocket, AQM, ownership, and transport

- **Canonical target:** `src/services/core/ai-docs/core-spec.md`
- **WHAT:**
  - Document `WebSocketManager.initWebSocket({body, resource})` with both required properties.
  - Attribute `silentRelogin()` to `ContactCenter`; describe ConnectionService as emitting `connectionLost` and handling reconnect initiation only.
  - Replace the invalid no-argument `AqmReqs` example with construction using `WebSocketManager` and `req(configFactory)`/`reqEmpty(configFactory)` whose returned request config contains `notifSuccess.bind` and optional `notifFail.bind`.
  - State that the HTTP acknowledgement does not resolve an AQM operation; a matched WebSocket notification does.
  - Use `CLOSE_SOCKET_TIMEOUT = 16000` consistently; identify `TIMEOUT_REQ = 20000` as the default AQM timeout; do not describe `WEBSOCKET_EVENT_TIMEOUT` as the active AQM timeout.
  - Distinguish the authenticated WebexRequest wrapper used by AQM from direct host `webex.request()` calls used by WebSocket subscription code.
  - Remove line-number/range suffixes and correct path casing/listener-name prose where touched.
- **WHY:** Incorrect signatures, timeout values, and ownership would produce broken connection and correlation changes.
- **Evidence:** `src/services/core/websocket/WebSocketManager.ts`, `src/services/core/websocket/connection-service.ts`, `src/services/core/aqm-reqs.ts`, `src/services/core/constants.ts`, `src/services/core/WebexRequest.ts`, `src/cc.ts`.
- **Acceptance:** B1/B2/B6/B8 pass for Core and no unstable evidence suffix remains.

### MOD-004 — Services and READY-time composition

- **Canonical target:** `src/services/ai-docs/services-spec.md`
- **WHAT:**
  - Distinguish Services construction from ContactCenter READY-time collaborator construction and from `register()`.
  - Services owns agent/config/contact/dialer, the primary WebSocket manager, RTD WebSocket manager, and ConnectionService.
  - ContactCenter's READY callback owns WebCallingService, ApiAIAssistant, MetricsManager, TaskManager, EntryPoint, AddressBook, and Queue construction.
  - Show TaskManager receiving ApiAIAssistant, contact routing, WebCallingService, primary WebSocket manager, and RTD WebSocket manager.
  - Add ApiAIAssistant and the RTD WebSocket manager to the complete capability/dependency graph without falsely claiming ApiAIAssistant is a Services field.
- **WHY:** Constructor/register confusion changes lifecycle ordering and hides two real realtime/AI collaborators.
- **Evidence:** `src/cc.ts`, `src/services/index.ts`, `src/services/ApiAiAssistant.ts`, `src/services/task/TaskManager.ts`.
- **Acceptance:** B2/B3 pass for composition, timing, and Requires.

### MOD-005 — Agent ownership, event names, and response types

- **Canonical target:** `src/services/agent/ai-docs/agent-spec.md`
- **WHAT:**
  - Remove `deviceUpdate` and `silentRelogin` from the routingAgent factory surface and operation list.
  - Route device/profile updates to `ContactCenter.updateAgentProfile()` and relogin recovery to ContactCenter's private `silentRelogin()`.
  - Use real `CC_EVENTS.AGENT_*` WebSocket event constants, including `CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS`, instead of invented nested labels.
  - Attribute public StationLogin/Logout/Buddy/SetState/UpdateDevice response aliases to `src/types.ts`; retain routing payload/event types in `src/services/agent/types.ts`.
- **WHY:** The agent spec currently assigns ContactCenter operations and public type ownership to the wrong module.
- **Evidence:** `src/services/agent/index.ts`, `src/services/agent/types.ts`, `src/types.ts`, `src/cc.ts`, `src/index.ts`.
- **Acceptance:** Agent B1/B3/B4/B5 findings are zero.

### MOD-006 — Config aggregation and real field names

- **Canonical target:** `src/services/config/ai-docs/config-spec.md`
- **WHAT:**
  - Add `getAIFeatureFlags(orgId)`, endpoint `organization/{orgId}/v2/ai-feature?page=0&pageSize=100`, aggregation input `aiFeatureFlags`, and output `Profile.aiFeature` to all relevant flow, sequence, Provides, and profile tables.
  - Reconcile the Promise aggregation counts after adding the AI-feature request.
  - Replace `MultimediaProfile` with `MultimediaProfileResponse`.
  - Replace `sensitiveDataMaskingEnabled` with `maskSensitiveData`.
  - Remove the non-existent `TeamList.channelMap` claim.
  - Document `desktopProfileFilter=true` in the list-aux-codes URL.
- **WHY:** These are current configuration contracts; omissions and wrong names make profile handling unsafe.
- **Evidence:** `src/services/config/index.ts`, `src/services/config/Util.ts`, `src/services/config/constants.ts`, `src/services/config/types.ts`.
- **Acceptance:** Config B2/B3/B4 findings are zero and diagrams/tables agree on request counts.

### MOD-007 — Task state machine actions, controls, and exports

- **Canonical target:** `src/services/task/state-machine/ai-docs/task-state-machine-spec.md`
- **WHAT:**
  - Delete the false assertion that `forceConsultInitiator`, `handleConferenceFailed`, `handleSwitchToMainCall`, and `handleSwitchToConsult` are absent.
  - Document all four from `actions.ts`; mark `forceConsultInitiator` as defined but not wired in the current graph, and document the other actions where the graph invokes them.
  - Replace `computeVoiceUIControls`/`computeDigitalUIControls` with the private real functions `computeVoiceInteractionUIControls` and `computeDigitalInteractionUIControls`.
  - Clarify that `getDefaultUIControls` is exported from `uiControlsComputer.ts` and re-exported from package root, but not from `state-machine/index.ts`.
  - Document `syncTaskDataFromEvent` as an implementation supplied through Task's machine options rather than a default action in `actions.ts`.
  - Mark `didInitiateConsult` as defined but currently unwired unless source wiring changes before application.
- **WHY:** The current spec inverts real action availability and invents control function names.
- **Evidence:** `src/services/task/state-machine/actions.ts`, `src/services/task/state-machine/TaskStateMachine.ts`, `src/services/task/state-machine/guards.ts`, `src/services/task/state-machine/uiControlsComputer.ts`, `src/services/task/state-machine/index.ts`, `src/services/task/Task.ts`, `src/index.ts`.
- **Acceptance:** BLK-9 and IMP-9 through IMP-11 pass without a source-code change.

### MOD-008 — Task signatures, event inventory, and factory ownership

- **Canonical target:** `src/services/task/ai-docs/task-spec.md`
- **WHAT:**
  - Document concrete Task/Voice `hold()` and `resume()` implementations as parameterless while preserving the broader optional `mediaResourceId` shape only where `ITask` declares it.
  - Move the `contact` constructor dependency from dialer prose to Task/TaskFactory ownership; do not claim `dialer.ts` has that constructor.
  - Complete the `TASK_EVENTS` inventory from `src/services/task/types.ts`, including campaign, hydration, recording, conference, switching, cleanup, and failure events.
  - State that TaskFactory creates only supported implemented media classes and throws `Unknown media type` for unsupported values such as SMS/Facebook/WhatsApp.
  - Clarify base-versus-Voice optionality for `endConsult` where documented.
- **WHY:** Method and factory drift can cause invalid calls and incorrect media assumptions.
- **Evidence:** `src/services/task/Task.ts`, `src/services/task/voice/Voice.ts`, `src/services/task/types.ts`, `src/services/task/TaskFactory.ts`, `src/services/task/dialer.ts`.
- **Acceptance:** IMP-12 through IMP-14 and touched Medium signature/factory findings pass.

### MOD-009 — Metrics catalog, taxonomy, and disabled behavior

- **Canonical target:** `src/metrics/ai-docs/metrics-spec.md`
- **WHAT:**
  - Reconcile the complete `METRIC_EVENT_NAMES` constant, including all AI Assistant transcript/suggestion events and other missing names.
  - Explicitly distinguish defined metric names from names present in `eventTaxonomyMap`; record the six AI Assistant names as currently defined but lacking behavioral taxonomy entries.
  - Document that `timeEvent()` returns immediately when metrics are disabled, matching all tracking methods.
- **WHY:** Operators and implementers need to know which telemetry names exist, which have taxonomy, and how the disable switch behaves.
- **Evidence:** `src/metrics/constants.ts`, `src/metrics/behavioral-events.ts`, `src/metrics/MetricsManager.ts`.
- **Acceptance:** IMP-15 through IMP-17 pass and catalog/taxonomy counts match code.

### MOD-010 — Utils ownership and re-export boundaries

- **Canonical target:** `src/utils/ai-docs/utils-spec.md`
- **WHAT:**
  - Treat `src/utils/PageCache.ts` as the authoritative Utils implementation and pagination/cache contract source.
  - Treat `src/types.ts` as a package-wide public type owner consumed by Utils and services, not a Utils implementation file.
  - Treat AddressBook, EntryPoint, and Queue as Services-layer consumers of PageCache, not authoritative Utils implementations.
  - Enumerate only actual PageCache exports and only package-root re-exports that exist in `src/index.ts`.
  - Use `orgId` consistently in cache-key examples.
- **WHY:** Overstated ownership and re-exports cause changes in the wrong module and unsupported imports.
- **Evidence:** `src/utils/PageCache.ts`, `src/types.ts`, `src/index.ts`, `src/services/AddressBook.ts`, `src/services/EntryPoint.ts`, `src/services/Queue.ts`.
- **Acceptance:** IMP-18 and touched Medium ownership/example findings pass.

### MOD-011 — Cross-cutting requirement quality and evidence

- **Canonical targets:** all nine module specs touched above.
- **WHAT:** Replace boilerplate “preserve behavior because consumers depend on it” entries with module-specific WHAT, WHY, acceptance, and test/source evidence. Use stable file paths only. Remove redundant generic diagrams when a code-grounded diagram covers the same operation group.
- **WHY:** Requirements and evidence must guide implementation and validation rather than merely asserting preservation.
- **Evidence:** Owning source and test paths listed by MOD-001 through MOD-010.
- **Acceptance:** A1/A7/A12/A13/A14 pass on revalidation, with no generic-only primary flow and no line/range evidence suffix.

## Feasibility & Risks

- **Feasibility:** High. Every correction is documentation-only and has current local source evidence.
- **Spikes needed:** None.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Correcting one claim introduces a new overstatement | medium | high | Reconcile each changed statement directly against current source and use independent revalidation |
| Protected-spec edits bypass review | low | high | Do not change canonical targets until this delta is explicitly approved |
| Source-fidelity inventory no longer matches generated canonical text | medium | high | Update correction dispositions/excerpts and rerun all inventories after application |
| Large event/metric tables remain incomplete | medium | medium | Generate inventories mechanically from owning enum/const objects, then review names against source |
| Documentation-only work accidentally changes runtime code | low | high | Enforce zero `src/` and `test/` diff guardrail |

## Interaction / Scenario Matrix

| Scenario / condition combination | Expected behavior | Covered by |
|---|---|---|
| READY callback before `register()` | Collaborators are documented as constructed at READY time; register only connects/subscribes | DRIFT-R-001 / MOD-001 / MOD-004 |
| ConnectionService emits `connectionLost` | ContactCenter owns policy and conditionally performs silent relogin | DRIFT-R-003 / MOD-001 / MOD-003 |
| AQM HTTP acknowledgement before WebSocket notification | Operation remains pending until matching notification or timeout/failure | DRIFT-R-002 / MOD-003 |
| Metrics disabled | Timing and tracking calls return without recording/submitting | DRIFT-R-006 / MOD-009 |
| State-machine action supplied by Task options | Spec distinguishes injected implementation from default action map | DRIFT-R-005 / MOD-007 |
| Unsupported task media type | Factory behavior is documented as throwing rather than claiming support | DRIFT-R-002 / MOD-008 |

## Documentation Obligations

- Apply the approved MOD-001 through MOD-011 corrections to the protected canonical targets.
- Update source-fidelity correction dispositions where migrated source text changes.
- Refresh generated-document conformance and coverage metadata.
- Request a second independent Claude `spec-validator` pass; do not self-validate on Codex.

## Spec State

| Section | State |
|---|---|
| Problem & Goal | complete |
| Stakeholders & Open Questions | complete |
| Scope | complete |
| Requirements | complete |
| Acceptance Criteria | complete |
| Success & Guardrail Metrics | complete |
| Prior-Work Register | complete |
| Contracts Delta | complete |
| Impacted Modules | complete |
| Conditional sections | complete for documentation-only drift correction |

## Change Log

| Date | Change | By | Why |
|---|---|---|---|
| 2026-07-07 | Initial protected-spec MODIFIED drift-fix delta drafted from independent validation and current source | Codex | Route validator findings through no-override review before canonical edits |
| 2026-07-07 | Developer approved and Codex applied MOD-001 through MOD-011 to canonical documentation | user + Codex | Resolve validator code-fidelity findings without runtime changes |

## References

- Package architecture: [`ARCHITECTURE.md`](../../../ARCHITECTURE.md)
- Module router: [`SPEC_INDEX.md`](../../../SPEC_INDEX.md)
- Contract catalog: [`CONTRACTS.md`](../../../CONTRACTS.md)
- Protected-target policy: `.sdd/manifest.json`
- Runtime evidence: `src/` and `test/`
