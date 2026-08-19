---
type: Feature Spec
title: Agent Desktop consult and transfer list policy
description: Centralize Agent Desktop consult and transfer destination eligibility, request shaping, ordering, and cache policy in the Contact Center SDK.
tags: [feature, specification, contact-center, consult-transfer]
---

# Agent Desktop consult and transfer list policy

This document owns the reusable consult/transfer destination-list policy. Widgets and other UI consumers supply action, pagination/search, and task media context; the SDK owns backend eligibility, projection, ordering, view flags, and cache safety.

Related context: [package architecture](../../../ARCHITECTURE.md) · [specification index](../../../SPEC_INDEX.md) · [package instructions](../../../../AGENTS.md)

## Metadata

| Field | Value |
| --- | --- |
| Feature key | `CAI-8354` |
| Owner | Webex Contact Center SDK maintainers |
| Status | Approved and implemented; diff-scoped drift validation PASS; independent validation pending |
| Work type | Defect |
| Change class | Contract |
| Source/intake | Developer-approved Agent Desktop parity review and current code/tests |
| Last verified | 2026-08-19 in a working tree based on `78d9b379db` |

## Applicability

| Condition ID | Status | Evidence or reason | Owned section |
| --- | --- | --- | --- |
| `feature.feature_nontrivial` | Applicable | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | Feasibility and risks |
| `feature.feature_interactions` | Applicable | `src/cc.ts` | Interaction and scenario matrix |
| `feature.touches_data_shapes` | Applicable | `src/types.ts` | Requested data and fields |
| `feature.backward_compat` | Applicable | `src/types.ts`, `src/index.ts` | Migration expectations |
| `feature.perf_critical` | N/A | The change adds no new request fan-out; it corrects cache eligibility for query variants. | Scale and performance |
| `feature.security_compliance` | N/A | Existing host-authenticated request ownership is unchanged and no credentials are added to list inputs. | Security and compliance |
| `feature.needs_rollout` | N/A | No SDK feature flag or staged runtime branch is introduced. | Rollout and feature controls |
| `feature.serviceability` | Applicable | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | Serviceability |
| `feature.doc_obligations` | Applicable | `ai-docs/contact-center-spec.md` | Documentation obligations |
| `feature.changes_ui` | N/A | The SDK has no user-visible screen or navigation ownership. | UI flow and design |
| `feature.changes_api` | Applicable | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | API contract delta |
| `feature.changes_events` | N/A | No event name, payload, producer, consumer, or delivery order changes. | Event contract delta |
| `feature.changes_public_api` | Applicable | `src/index.ts`, `src/types.ts` | Public API and semver impact |
| `feature.cross_package` | Applicable | `src/index.ts` | Cross-package impact |

## Problem and goal

Consult/transfer list decisions were split across the SDK and widgets. Generic SDK query types exposed low-level request choices, while widgets always restricted buddy agents to Available, filtered queues after fetching them, rebuilt pagination metadata, and could independently affect presentation order. That diverged from the Agent Desktop behavior confirmed during the parity review.

The goal is to make the SDK the single owner of the default Agent Desktop policy. Specialized methods produce the exact queue and entry-point eligibility queries, EntryPoint and AddressBook default their backend ordering to `name,ASC`, buddy-agent behavior is action-aware, CMS sort syntax is serialized correctly, and query variants that change results or response shape cannot reuse an incompatible cached page. Consumers render the response order and metadata without a second sort or filter.

## Stakeholders and open questions

| Stakeholder | Need or decision | Status |
| --- | --- | --- |
| Contact Center agents | Destination eligibility and order match Agent Desktop. | Decided |
| SDK consumers | Reusable defaults without duplicating backend query knowledge. | Decided |
| Widget maintainers | Thin calls that pass only UI/runtime context. | Decided in the paired widgets delta |
| SDK maintainers | Generic list APIs remain available for non-consult/transfer consumers. | Decided |

There are no open product decisions for this delta.

## Scope

### In scope

- Add specialized queue and entry-point list methods for Agent Desktop consult/transfer flows.
- Map Consult versus Transfer to the correct buddy-agent state behavior.
- Default omitted buddy-agent, queue, and consult/transfer entry-point media context to telephony.
- Expose one minimal queue/entry-point options type and keep filters, channel selection, projections, profile/agent view flags, ordering, and cache decisions internal to the specialized SDK paths.
- Default generic EntryPoint and AddressBook requests to backend `name,ASC` ordering while allowing callers to pass another `sortBy`/`sortOrder` pair.
- Serialize CMS ordering as `sort=<field>,<ORDER>`.
- Bypass the base pagination cache for every filter/view/shape flag that changes a result.
- Keep generic queue and entry-point methods available and preserve explicit buddy-agent state callers.
- Compute ordered, action-specific destination availability once on each Task and expose it through `TaskUIControls`, using Desktop Profile access, media, direction, and outbound queue-transfer capability.

### Out of scope

- Client-side sorting of agents, queues, or entry points.
- Changing backend order after a response is received.
- Replacing the generic queue/entry-point APIs.
- Changing generic queue ordering, address-book projection, events, authentication, retries, or metrics taxonomy.
- Adding a feature flag, data migration, commit, publication, or push.
- Adding a separate destination-policy fetch method that Task consumers must call before rendering.

## Prior work and evidence

| Source | What it establishes | Decision or disposition |
| --- | --- | --- |
| `src/cc.ts` | The public façade owns buddy-agent action policy and delegates minimal list options unchanged to data services. | Used |
| `src/types.ts`, `src/index.ts` | The action, one minimal specialized options type, exact response, and media types are public, typed, and additive. | Used |
| `src/constants.ts` | Shared consult/transfer list constants validate and map supported media before filter construction. | Used |
| `src/services/Queue.ts` | The dedicated Queue path owns consult/transfer query serialization and view flags. | Used |
| `src/services/EntryPoint.ts` | The dedicated EntryPoint path owns consult/transfer query serialization, ordering, and agent view. | Used |
| `src/services/AddressBook.ts` | AddressBook owns its backend ordering default and caller override. | Used |
| `src/utils/PageCache.ts` | Cache eligibility must include every result- or shape-changing query option. | Used |
| `test/unit/spec/cc.ts` | Action mapping and thin delegation of minimal list options are asserted. | Used |
| `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Media validation, fixed policy, CMS sort serialization, view flags, and cache behavior are asserted. | Used |
| `src/services/task/state-machine/uiControlsComputer.ts`, `src/services/task/types.ts` | Task UI controls are the existing SDK-owned decision surface and can carry ordered destination availability. | Used |
| `test/unit/spec/services/task/state-machine/uiControlsComputer.ts`, `test/unit/spec/services/task/TaskFactory.ts` | Profile/media/direction gating, outbound flag path, ordering, and factory propagation are asserted. | Used |

## Requirements

| ID | WHAT | WHY | Source evidence | Test or example evidence | Assumptions or gaps | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `SDK-LIST-R-001` | The public specialized queue method accepts only `ConsultTransferListOptions`; the Queue service must apply inbound, active, media-channel eligibility, request `id,name,dbId`, request backend name ascending order, enable desktop-profile/agent/first-level views, and return `ConsultTransferListResponse`. | Queue eligibility and ordering must match Agent Desktop without exposing backend policy controls to consumers, while the declared type must match the projected wire shape. | `src/cc.ts`, `src/constants.ts`, `src/services/Queue.ts`, `src/types.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts` | Backend honors the documented CMS query flags. | Present |
| `SDK-LIST-R-002` | The public specialized entry-point method accepts only `ConsultTransferListOptions`; the EntryPoint service must apply inbound, active, media-channel eligibility, request `id,name,dbId`, request backend name ascending order, enable desktop-profile and agent views, and return `ConsultTransferListResponse`. Omitted media defaults to telephony. | Entry-point eligibility and ordering must match Agent Desktop without requiring widgets to supply sorting or backend policy controls, while the declared type must match the projected wire shape. | `src/cc.ts`, `src/constants.ts`, `src/services/EntryPoint.ts`, `src/types.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/EntryPoint.ts` | Backend honors the documented CMS query flags. | Present |
| `SDK-LIST-R-003` | Buddy-agent requests using `Transfer` must add state `Available`; requests using `Consult` must omit the state filter; omitted action-based media defaults to telephony; both BuddyAgents branches reuse `ConsultTransferMediaType`. | Transfer and Consult have different eligible populations, and one media allowlist prevents action-based callers from issuing unsupported buddy requests. | `src/cc.ts`, `src/types.ts` | `test/unit/spec/cc.ts` | The backend determines the Consult-eligible states when state is omitted. | Present |
| `SDK-LIST-R-004` | Explicit buddy-agent state requests and generic queue/entry-point/address-book methods must remain supported; caller-supplied sort values must override service defaults. | Existing SDK consumers need low-level behavior without forcing widgets to supply SDK-owned defaults. | `src/cc.ts`, `src/types.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Existing callers that pass explicit `state` continue to use that branch. | Present |
| `SDK-LIST-R-005` | Queue, EntryPoint, and AddressBook services must serialize ordering as CMS `sort=<field>,<ORDER>`, not separate `sortBy`/`sortOrder` query keys; EntryPoint and AddressBook must use `sort=name,ASC` when callers omit sorting, and a Queue `sortOrder` without `sortBy` must use `name`. | Correct wire syntax and SDK-owned defaults make backend ordering consistent and prevent a caller's explicit Queue direction from being silently ignored. | `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | None. | Present |
| `SDK-LIST-R-006` | PageCache must reject cache use when search, filter, attributes, a non-default/effective sort, or an enabled desktop-profile/provisioning/single-object flag is present; explicit `false` flags remain cache-compatible. This includes a Queue `sortOrder` supplied without `sortBy`. Specialized consult/transfer paths always bypass the simple-page cache through their fixed filter/projection. Default `name,ASC` EntryPoint and AddressBook pages remain eligible for their existing scope/page/pageSize cache. | The cache key does not encode result/shape variants, disabled boolean flags do not create variants, and every cache-eligible EntryPoint and AddressBook request has the same default ordering. | `src/utils/PageCache.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Service-level behavior covers default, explicit-false, and override cases. | Present |
| `SDK-LIST-R-007` | The SDK must return service response arrays and pagination metadata without JavaScript-side sorting or reordering. | Backend-requested order is authoritative and must remain stable for every consumer. | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` | `test/unit/spec/cc.ts` | The backend is the source of final row order. | Present |
| `SDK-LIST-R-008` | New action/list types and methods must be strongly typed and exported without `any`; queue and entry-point methods share one `ConsultTransferListOptions` containing only page, page size, search, and media. | Public consumers need a small compile-time contract and must not recreate policy through untyped or backend-oriented query bags. | `src/types.ts`, `src/index.ts`, `src/cc.ts` | `test/unit/spec/cc.ts`, `package.json` | Existing test-only casts are outside the public contract. | Present |
| `SDK-LIST-R-009` | Buddy-agent, queue, and entry-point failures must preserve their existing measured/logged rejection semantics and must not return a synthetic successful list. | Callers need to distinguish a real empty result from a transport or backend failure. | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` | Consumer UI fallback behavior remains outside the SDK. | Present |
| `SDK-LIST-R-010` | AddressBook must request backend `name,ASC` ordering by default and must accept caller-supplied `sortBy`/`sortOrder` overrides without a consult-specific façade method. | Widgets and other ordinary consumers receive Agent Desktop-compatible dial-number ordering out of the box, while consumers with another requirement retain control. | `src/services/AddressBook.ts` | `test/unit/spec/services/AddressBook.ts` | Backend honors the documented CMS sort value. | Present |
| `SDK-LIST-R-011` | Consult/transfer media inputs must be limited to `telephony`, `chat`, `social`, or `email`; runtime callers that bypass TypeScript and supply another value must be rejected by the specialized service path before an RSQL filter is constructed or a request is sent. | Allowlisting prevents filter injection and makes typos/null inputs fail locally instead of changing backend query semantics. | `src/constants.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/types.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` | Case-insensitive runtime forms of supported values normalize to the canonical channel token. | Present |
| `SDK-LIST-R-012` | Every Task must expose `uiControls.consultTransferDestinations` with ordered `consult` and `transfer` arrays. Order is Agent, Queue, Dial Number, Entry Point after gating: profile `NONE` removes agent/queue/entry point; voice Consult queue requires `allowConsultToQueue`; voice Transfer queue requires inbound direction or outbound plus `interaction.callProcessingDetails.outdialTransferToQueueEnabled === true`; unknown voice direction does not allow queue Transfer; digital exposes only allowed agent/queue categories. | All consumers need the same Agent Desktop decision out of the box, without reading raw profile flags, interpreting task payload paths, or calling another policy API. | `src/cc.ts`, `src/services/task/TaskFactory.ts`, `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/task/TaskFactory.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts` | Consumers may hide an SDK-allowed category for host UX, but cannot enable one the SDK omitted. | Present |

## Defect context (when applicable)

- Observed versus expected behavior: widgets and SDK callers could construct different destination requests, the services serialized sort with keys the CMS list API does not consume, and cache eligibility ignored view/shape flags; expected behavior is one SDK-owned Agent Desktop policy and unchanged backend response order.
- Reproduction and environment: issue Consult and Transfer destination requests for the same task media and compare query parameters and results with Agent Desktop.
- Regression range or last known good state: unknown; the generic APIs and older query serialization predate the specialized policy.
- Severity, frequency, and workaround: user-visible whenever eligibility/order differs; consumers could manually duplicate flags, but that perpetuates the ownership defect.
- Diagnostic evidence: `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/utils/PageCache.ts`.

## MODIFIED Requirements

### MOD-001 — Contact Center façade policy (`CONTACT_CENTER-R-003`)

- **WHAT**: Extend façade delegation with action-aware buddy-agent behavior and additive specialized queue and entry-point methods. Both list methods accept one minimal `ConsultTransferListOptions` and expose a typed `id`/`name`/optional-`dbId` response; Queue and EntryPoint validate the shared media allowlist and own all backend policy while generic methods remain available.
- **WHY**: A stable public owner prevents every UI consumer from reconstructing eligibility and query details.
- **Evidence:** `src/cc.ts`, `src/types.ts`, `src/index.ts`, `test/unit/spec/cc.ts`.
- **Acceptance:** Façade tests cover Consult, Transfer, and unchanged minimal-option delegation; service tests cover default media, channel mapping, exact queue/entry-point policy, and exact responses.

### MOD-002 — Direct REST list services (`SERVICES-R-002`, `SERVICES-R-007`)

- **WHAT**: Queue, EntryPoint, and AddressBook must serialize CMS sorting as a combined `sort` value; EntryPoint and AddressBook must default to `name,ASC` and honor explicit caller overrides; dedicated Queue and EntryPoint consult/transfer paths must apply the required internal view flags while retaining direct HTTP completion/error semantics. Generic list parameter types do not expose those policy flags.
- **WHY**: SDK defaults are effective only when service wire parameters match the backend contract.
- **Evidence:** `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts`.
- **Acceptance:** Service tests assert default `sort=name,ASC`, custom descending overrides, and all requested view flags.

### MOD-003 — Buddy-agent request contract (`AGENT-R-003`)

- **WHAT**: Preserve the correlated buddy-agent request/response contract while allowing the façade to derive optional state from `Consult` or `Transfer`.
- **WHY**: Eligibility changes must not alter AQM settlement or invent UI-side filtering.
- **Evidence:** `src/cc.ts`, `src/services/agent/index.ts`, `test/unit/spec/cc.ts`, `test/unit/spec/services/agent/index.ts`.
- **Acceptance:** Transfer sends `Available`; Consult sends no state; explicit state callers remain typed and supported.

### MOD-004 — Query-aware cache eligibility (`UTILS-R-001`, `UTILS-R-006`)

- **WHAT**: Treat enabled profile/response-shape flags and non-default sorts as cache-disqualifying inputs; treat explicit `false` flags like omission. Specialized consult/transfer filter/projection queries bypass cache. Keep default `name,ASC` EntryPoint and AddressBook pages cache-eligible because that ordering is invariant for their base cache key.
- **WHY**: A page keyed only by scope/page/pageSize cannot safely represent query variants, but it can safely represent one invariant default order.
- **Evidence:** `src/utils/PageCache.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`.
- **Acceptance:** Two identical view-filtered or custom-sort calls make two backend requests; repeated default-sorted pagination remains cache-eligible.

## Acceptance criteria

- [x] Transfer buddy lookup sends state `Available`; Consult omits state; action-based media defaults to telephony (`MOD-003`, `SDK-LIST-R-003`).
- [x] Queue policy sends inbound/active/channel filter, `id,name,dbId`, backend name ascending order, desktop-profile, agent, and first-level views (`MOD-001`, `MOD-002`, `SDK-LIST-R-001`).
- [x] Supported media values map to fixed backend channel tokens (`social` to `SOCIAL_CHANNEL`); unsupported, null, typo, and filter-injection values reject before delegation (`SDK-LIST-R-001`, `SDK-LIST-R-011`).
- [x] Entry-point policy sends inbound/active filter, `id,name,dbId`, desktop-profile, and agent views; EntryPoint supplies default backend name ascending order (`MOD-001`, `MOD-002`, `SDK-LIST-R-002`).
- [x] Entry-point policy includes the task channel and defaults omitted media to telephony (`SDK-LIST-R-002`).
- [x] AddressBook sends backend name ascending order by default and honors a caller-supplied descending override (`MOD-002`, `SDK-LIST-R-004`, `SDK-LIST-R-010`).
- [x] Queue, EntryPoint, and AddressBook serialize CMS ordering as the combined `sort` query value (`MOD-002`, `SDK-LIST-R-005`).
- [x] Queue `sortOrder` without `sortBy` serializes as `sort=name,<ORDER>` and bypasses the simple-page cache (`SDK-LIST-R-005`, `SDK-LIST-R-006`).
- [x] View/filter/shape/custom-sort requests bypass PageCache, while repeated default-sorted EntryPoint and AddressBook pages remain cacheable (`MOD-004`, `SDK-LIST-R-006`).
- [x] No SDK façade or service sorts returned arrays in JavaScript (`SDK-LIST-R-007`).
- [x] Specialized queue and entry-point responses expose only the projected destination fields and include typed optional `dbId` (`SDK-LIST-R-008`).
- [x] The package builds and the complete Contact Center unit and style suites pass (`SDK-LIST-R-008`).

## Scenarios and applicable change views

| Scenario | Actor | Preconditions | Expected behavior | Failure or boundary behavior | Requirements |
| --- | --- | --- | --- | --- | --- |
| Consult buddy agents | SDK consumer | `action=Consult` | Telephony defaults when absent; state is omitted; backend order is preserved. | Request rejection is measured/logged and rethrown. | `SDK-LIST-R-003`, `SDK-LIST-R-007` |
| Transfer buddy agents | SDK consumer | `action=Transfer` | State `Available` is sent for the selected media. | Explicit state and action cannot be combined by the public type. | `SDK-LIST-R-003`, `SDK-LIST-R-008` |
| Queue list | SDK consumer | Page/search and task media supplied | SDK applies complete Agent Desktop queue query and returns response unchanged. | Social maps to `SOCIAL_CHANNEL`; omitted media defaults to telephony. | `SDK-LIST-R-001`, `SDK-LIST-R-007` |
| Entry-point list | SDK consumer | Page/search and optional task media supplied | SDK applies complete Agent Desktop entry-point query and returns response unchanged; omitted media defaults to telephony. | Unsupported media rejects locally; HTTP failure is propagated without a synthetic page. | `SDK-LIST-R-002`, `SDK-LIST-R-009`, `SDK-LIST-R-011` |
| Dial-number list | SDK consumer | AddressBook page/search supplied | AddressBook applies backend `name,ASC` by default and returns the response unchanged. | A custom sort overrides the default and bypasses the default-order cache. | `SDK-LIST-R-010` |
| Generic list consumer | SDK consumer | Uses an existing generic method | EntryPoint and AddressBook apply `name,ASC`; an explicit sort pair overrides it. | Queue defaults and all other generic query options remain unchanged. | `SDK-LIST-R-004`, `SDK-LIST-R-005` |

### Interaction and scenario matrix

| Context or interacting state | Trigger | Expected result | Invalid or conflicting result | Requirements |
| --- | --- | --- | --- | --- |
| Consult + agent | Action request | No state filter | Applying Transfer-only `Available` | `SDK-LIST-R-003` |
| Transfer + agent | Action request | `state=Available` | Returning idle agents through an omitted state filter | `SDK-LIST-R-003` |
| Queue + social media | List request | `channelType==SOCIAL_CHANNEL` | Generic `SOCIAL` channel token | `SDK-LIST-R-001` |
| View-filtered queue/entry point | Repeated page request | Backend called for each request | Simple-page cache hit | `SDK-LIST-R-006` |
| Generic EntryPoint or AddressBook | Sort omitted | Backend receives `sort=name,ASC` | Consumer must provide the default itself | `SDK-LIST-R-005`, `SDK-LIST-R-010` |
| Generic EntryPoint or AddressBook | Custom sort supplied | Backend receives the requested field/order | SDK overwrites the caller's explicit behavior | `SDK-LIST-R-004`, `SDK-LIST-R-010` |
| Backend result | Response received | Array and metadata returned in backend order | JavaScript `.sort()` or consumer-specific reorder | `SDK-LIST-R-007` |

### API contract delta

| API or operation | Change | Consumer impact | Compatibility expectation | Canonical definition |
| --- | --- | --- | --- | --- |
| Buddy-agent input | Add discriminated `action` branch; retain explicit state branch. | Consumers may pass Consult/Transfer instead of choosing state. | Additive public type; explicit-state callers remain supported. | `src/types.ts` |
| Specialized queue list | Add public Agent Desktop consult/transfer method. | Thin clients pass pagination/search/media only. | Additive public method. | `src/cc.ts` |
| Specialized entry-point list | Add public Agent Desktop consult/transfer method. | Thin clients pass pagination/search/media only. | Additive public method. | `src/cc.ts` |
| EntryPoint/AddressBook ordering | Default omitted sort to `name,ASC`; honor explicit overrides. | Widgets pass no sort; other consumers pass a sort pair only when they need different behavior. | Intentional generic default correction. | `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` |
| Queue/EntryPoint specialized options | Add one minimal page/page-size/search/media type; keep view/filter/projection policy internal. | Generic callers retain ordinary APIs; specialized callers cannot alter Agent Desktop policy. | Additive specialized type and corrected/defaulted wire behavior. | `src/types.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` |
| Task destination controls | Add ordered `consultTransferDestinations.consult` and `.transfer` arrays to `TaskUIControls`. | Task consumers render availability directly; no separate policy call or raw profile injection is needed. | Additive public field and exported destination control/type aliases. | `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts`, `src/index.ts` |

### Public API and semver impact

| Export or entry point | Change | Affected consumers | Required version change | Deprecation or migration |
| --- | --- | --- | --- | --- |
| `ConsultTransferAction` | New exported type | UI/store consumers | Minor | None. |
| `ConsultTransferMediaType` | New exported supported-media union | Consult/transfer consumers | Minor | Replace arbitrary strings with one of the supported values. |
| `ConsultTransferDestination` / `ConsultTransferListResponse` | New exported projected response types | Queue/entry-point list consumers | Minor | Use these instead of treating projected rows as full CMS records. |
| `ConsultTransferListOptions` | New exported shared minimal options type | Queue/entry-point list consumers | Minor | Pass only page, page size, search, and optional media; the SDK owns all other request policy. |
| Specialized queue/entry-point façade methods | New public methods | Widgets and future Agent Desktop-compatible clients | Minor | Generic methods remain supported. |
| `BuddyAgents` | Add action-based alternative while retaining explicit state | Existing and new consumers | Minor | Existing explicit-state calls remain valid. |
| `TaskUIControls`, `ConsultTransferDestinationControls`, `ConsultTransferDestinationType` | Add ordered, action-specific destination availability | Task UI consumers | Minor | Read the matching action array; first item is the default category. |

### Cross-package impact

| Package | Change | Dependency direction | Release sequencing | Owner |
| --- | --- | --- | --- | --- |
| `@webex/contact-center` | Owns action/default/filter/order/cache policy and Task destination visibility/order decisions. | SDK → consumers | Build/release first. | SDK maintainers |
| `@webex/cc-store` | Delegates to new specialized methods. | store → SDK | Consume a compatible SDK release. | Widgets maintainers |
| `@webex/cc-task` and `@webex/cc-components` | Supply action and render results. | UI → store → SDK | Release after compatible store/SDK. | Widgets maintainers |

## Contracts delta

**Provides — MODIFIED:** The package façade adds typed, specialized Agent Desktop consult/transfer queue and entry-point methods, one shared minimal options type, a projected destination response with optional `dbId`, a shared supported-media union, an action-aware buddy-agent input, and ordered action-specific destination availability on `TaskUIControls`. Generic methods and explicit state inputs remain available without consult/transfer-specific view controls.

**Requires — MODIFIED:** Queue, EntryPoint, and AddressBook services require CMS list endpoints to honor the combined sort value; Queue and EntryPoint additionally require the applicable profile/agent view flags. The SDK continues to rely on host-authenticated Webex requests and backend response ordering.

No event contract changes.

## Success and guardrail metrics

| Metric | Baseline | Target | Measurement source |
| --- | --- | --- | --- |
| Consumers that must recreate Agent Desktop queue/entry-point policy | Widgets did | 0 for specialized method consumers | `src/cc.ts` |
| JavaScript-side destination sorts in the changed SDK path | 0 | 0 | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` |
| Cache hits for view/filter/shape query variants | Possible | 0 | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Contact Center unit failures | Unknown before change | 0 | `test/unit/spec` |
| Contact Center build/style errors | Unknown before change | 0 | Package build and style commands |

## Requested data and fields

| Entity or payload | Requested field or shape | Purpose | Ownership | Privacy, retention, or compatibility constraint |
| --- | --- | --- | --- | --- |
| Buddy-agent input | `action` plus optional `mediaType`, mutually exclusive with explicit `state` | Derive Consult/Transfer eligibility. | SDK public type | No credential or persistent data. |
| Queue search input | Page, page size, search, optional media | Consumer-controlled runtime input. | SDK public type | Policy flags are not caller-controlled on the specialized method. |
| Queue backend query | Inbound/active/channel filter, `id,name,dbId`, name ascending, desktop-profile/agent/first-level views | Agent Desktop-compatible queue result. | Queue service | Fixed filter/projection bypasses simple-page caching. |
| Entry-point backend query | Inbound/active/channel filter, `id,name,dbId`, name ascending, desktop-profile/agent views | Agent Desktop-compatible entry-point result. | EntryPoint service | Fixed filter/projection bypasses simple-page caching. |
| AddressBook backend query | Existing caller-selected fields plus name ascending by default | Agent Desktop-compatible dial-number order without a specialized façade. | AddressBook service | A non-default sort bypasses the default-order cache. |

## Impacted domains

| Repository or module | Impact | Owner |
| --- | --- | --- |
| `src` | Public façade and exports | SDK maintainers |
| `src/services` | Queue/EntryPoint/AddressBook wire query construction | SDK maintainers |
| `src/services/agent` | Existing correlated buddy-agent operation receives façade-derived state | SDK maintainers |
| `src/utils` | Cache eligibility for query variants | SDK maintainers |
| Webex widgets repository | Thin consumer of the new defaults | Widgets maintainers |

## Feasibility and risks

| Risk or assumption | Evidence | Mitigation or decision owner |
| --- | --- | --- |
| CMS ignores ordering when encoded as legacy separate keys. | `src/services/Queue.ts`, `src/services/EntryPoint.ts` | Use and test combined `sort=<field>,<ORDER>` serialization. |
| Simple cache returns a page created under a different view. | `src/utils/PageCache.ts` | Make every result/shape flag cache-disqualifying and retain repeated-call tests. |
| New EntryPoint/AddressBook ordering defaults affect generic callers. | `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | Make the correction explicit, retain caller overrides, and test both default and custom order. |
| A consumer re-sorts backend results. | `test/unit/spec/cc.ts` | Return the delegated response unchanged and document backend order as authoritative. |

## Error Matrix

| Failure | SDK behavior | Consumer-visible result | Evidence |
| --- | --- | --- | --- |
| Buddy-agent AQM rejection | Record failure context and rethrow. | Promise rejects; no synthetic agent list. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Queue HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/Queue.ts`, `test/unit/spec/services/Queue.ts` |
| Entry-point HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/EntryPoint.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Missing action-based media | Default to telephony. | Valid request with predictable channel. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Unsupported, null, or injected media value | Reject with `TypeError` in the specialized service before constructing an RSQL filter or sending a request. | Promise rejects locally; no backend request is sent. | `src/constants.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` |

## Resilience

- Specialized methods make one delegated list request and add no retry or request fan-out.
- Generic methods remain available; EntryPoint and AddressBook callers pass an explicit sort pair when they require a non-default order.
- View/filter/shape queries bypass cache rather than risk stale or cross-policy results.
- Errors remain caller-visible; the SDK does not manufacture an empty success response.

## Observability

- Existing buddy-agent success/failure metrics retain media and derived state context plus count, without logging agent identities.
- Existing Queue and EntryPoint request/success/failure metrics continue to cover the specialized calls.
- No new metric taxonomy, PII-bearing log, credential log, trace, or alert is introduced.

## Operations

- Build and run the complete Contact Center unit suite and style check before publishing.
- Release the SDK before or with widgets that require the specialized methods and types.
- Rollback is a coordinated package-version/code rollback; no persisted state, schema, or cache migration is required.

## Migration expectations

- Compatibility: new façade methods/types are additive; explicit buddy-agent state and generic list APIs remain supported. Generic EntryPoint and AddressBook calls now request `name,ASC` unless callers override it.
- Data or consumer transition: thin consumers migrate from manual query/filter policy to the specialized methods.
- Coexistence period: generic and specialized methods coexist indefinitely unless a separate deprecation delta is approved.
- Completion and rollback outcome: consumers no longer own Agent Desktop policy; rollback restores prior calls without data cleanup.

## Serviceability

| Signal or support surface | Required change | Consumer or operator | Acceptance evidence |
| --- | --- | --- | --- |
| Buddy-agent operational metrics | Report derived action state and media without identities. | SDK maintainers | `test/unit/spec/cc.ts` |
| Queue request metrics/logs | Preserve existing request success/failure coverage for specialized calls. | SDK maintainers | `test/unit/spec/services/Queue.ts` |
| Entry-point request metrics/logs | Preserve existing request success/failure coverage for specialized calls. | SDK maintainers | `test/unit/spec/services/EntryPoint.ts` |

## Documentation obligations

- This approved delta modifies `CONTACT_CENTER-R-003`, `SERVICES-R-002`, `SERVICES-R-007`, `AGENT-R-003`, `UTILS-R-001`, and `UTILS-R-006` without overwriting protected canonical specs.
- The paired widgets feature spec must reference this SDK delta as the owner of default eligibility, ordering, request flags, media mapping, and cache policy.
- A future canonical-spec promotion must fold this delta into the routed module specs and reconcile the delta path rather than duplicate the requirements.

## Decision and change log

| Date | Decision or change | Rationale | Owner |
| --- | --- | --- | --- |
| 2026-08-19 | Approved this exact MODIFIED delta path. | Preserve protected canonical specs while maintaining spec-currency with the implementation. | Developer |
| 2026-08-19 | Assigned all reusable eligibility, query, ordering, and cache decisions to the SDK. | Keep widgets thin and prevent Agent Desktop parity drift. | Developer + Codex |
| 2026-08-19 | Made backend response order authoritative and prohibited SDK-side JavaScript sorting. | One backend ordering decision must reach every consumer unchanged. | Developer + Codex |
| 2026-08-19 | Moved EntryPoint and AddressBook `name,ASC` ordering to service defaults and removed the specialized dial-number façade. | Widgets must work without supplying SDK-owned decisions; other consumers can pass explicit sort overrides. | Developer + Codex |
| 2026-08-19 | Collapsed queue and entry-point list inputs into one minimal `ConsultTransferListOptions` and moved media validation plus filter/projection/view/order construction into dedicated service paths. | Public consumers should request a list, not control Agent Desktop backend policy; generic list APIs should retain their established full-record contracts. | Developer + Codex |
| 2026-08-19 | Put ordered Consult/Transfer destination availability directly on every Task's `uiControls` instead of adding `getConsultTransferDestinationPolicy`. | The Task already owns UI decisions and live interaction data, so consumers should not make a second request or reproduce profile/media/direction rules. | Developer + Codex |
