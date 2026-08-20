---
type: Feature Spec
title: Consult and transfer list policy
description: Centralize consult and transfer destination eligibility, request shaping, ordering, and cache policy in the Contact Center SDK.
tags: [feature, specification, contact-center, consult-transfer]
---

# Consult and transfer list policy

This document owns the reusable consult/transfer destination-list policy. The SDK applies default telephony eligibility, ordering, profile views, and cache safety through the existing list methods; consumers use existing parameters only when they need a different filter or sort.

Related context: [package architecture](../../../ARCHITECTURE.md) · [specification index](../../../SPEC_INDEX.md) · [package instructions](../../../../AGENTS.md)

## Metadata

| Field | Value |
| --- | --- |
| Feature key | `CAI-8354` |
| Owner | Webex Contact Center SDK maintainers |
| Status | Approved and implemented; diff-scoped drift validation PASS; independent validation pending |
| Work type | Defect |
| Change class | Contract |
| Source/intake | Developer-approved consult/transfer behavior review and current code/tests |
| Last verified | 2026-08-20 in a working tree based on `9f9c39f7a4` |

## Applicability

| Condition ID | Status | Evidence or reason | Owned section |
| --- | --- | --- | --- |
| `feature.feature_nontrivial` | Applicable | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts`, `src/services/task/Task.ts` | Feasibility and risks |
| `feature.feature_interactions` | Applicable | `src/cc.ts` | Interaction and scenario matrix |
| `feature.touches_data_shapes` | Applicable | `src/types.ts` | Requested data and fields |
| `feature.backward_compat` | Applicable | `src/types.ts`, `src/index.ts` | Migration expectations |
| `feature.perf_critical` | N/A | The change adds no new request fan-out; it corrects cache eligibility for query variants. | Scale and performance |
| `feature.security_compliance` | N/A | Existing host-authenticated request ownership is unchanged and no credentials are added to list inputs. | Security and compliance |
| `feature.needs_rollout` | N/A | No SDK feature flag or staged runtime branch is introduced. | Rollout and feature controls |
| `feature.serviceability` | Applicable | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | Serviceability |
| `feature.doc_obligations` | Applicable | `ai-docs/contact-center-spec.md` | Documentation obligations |
| `feature.changes_ui` | N/A | The SDK has no user-visible screen or navigation ownership. | UI flow and design |
| `feature.changes_api` | Applicable | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts`, `src/services/task/Task.ts` | API contract delta |
| `feature.changes_events` | N/A | No event name, payload, producer, consumer, or delivery order changes. | Event contract delta |
| `feature.changes_public_api` | Applicable | `src/index.ts`, `src/types.ts` | Public API and semver impact |
| `feature.cross_package` | Applicable | `src/index.ts` | Cross-package impact |

## Problem and goal

Consult/transfer list decisions were split across the SDK and widgets. Generic SDK query types exposed low-level request choices, while widgets always restricted buddy agents to Available, filtered queues after fetching them, rebuilt pagination metadata, and could independently affect presentation order. That produced inconsistent behavior between consumers.

The goal is to make the SDK the single owner of the default consult/transfer policy without adding parallel list methods or response signatures. Existing Queue and EntryPoint methods produce the default telephony eligibility queries and retain full-record responses, EntryPoint and AddressBook default their backend ordering to `name,ASC`, buddy-agent behavior is action-aware, CMS sort syntax is serialized correctly, and query variants that change results cannot reuse an incompatible cached page. Consumers render the response order and metadata without a second sort or filter.

## Stakeholders and open questions

| Stakeholder | Need or decision | Status |
| --- | --- | --- |
| Contact Center agents | Destination eligibility and order are consistent across consumers. | Decided |
| SDK consumers | Reusable defaults without duplicating backend query knowledge. | Decided |
| Widget maintainers | Thin calls that pass only UI/runtime context. | Decided in the paired widgets delta |
| SDK maintainers | Existing list APIs remain the only queue and entry-point public methods; existing parameters provide overrides. | Decided |

There are no open product decisions for this delta.

## Scope

### In scope

- Put consult/transfer defaults on the existing queue and entry-point list methods.
- Map Consult versus Transfer to the correct buddy-agent state behavior.
- Default omitted buddy-agent, queue, and consult/transfer entry-point media context to telephony.
- Retain the existing queue/entry-point parameter and response types, avoid field projection, and let explicit existing filter/sort/profile parameters override SDK defaults.
- Default generic EntryPoint and AddressBook requests to backend `name,ASC` ordering while allowing callers to pass another `sortBy`/`sortOrder` pair.
- Serialize CMS ordering as `sort=<field>,<ORDER>`.
- Bypass the base pagination cache for every filter/view/shape flag that changes a result.
- Keep the existing queue and entry-point method signatures and preserve explicit buddy-agent state callers.
- Compute ordered, action-specific destination availability once on each Task and expose it through `TaskUIControls`, using Desktop Profile access, media, direction, and outbound queue-transfer capability.
- Keep direct Entry Point available for eligible voice transfers and translate its public destination type to the backend EPDN value inside `Task.transfer()`.

### Out of scope

- Client-side sorting of agents, queues, or entry points.
- Changing backend order after a response is received.
- Adding parallel queue/entry-point APIs or projected destination response types.
- Changing generic queue ordering, address-book projection, events, authentication, retries, or metrics taxonomy.
- Adding a feature flag, data migration, commit, publication, or push.
- Adding a separate destination-policy fetch method that Task consumers must call before rendering.

## Prior work and evidence

| Source | What it establishes | Decision or disposition |
| --- | --- | --- |
| `src/cc.ts` | The public façade keeps the established list method names/signatures and owns buddy-agent action policy. | Used |
| `src/types.ts`, `src/index.ts` | Existing queue/entry-point request and full-record response types remain the public list contracts. | Used |
| `src/services/Queue.ts` | The existing Queue path owns default query serialization and view flags. | Used |
| `src/services/EntryPoint.ts` | The existing EntryPoint path owns default query serialization, ordering, and agent view. | Used |
| `src/services/AddressBook.ts` | AddressBook owns its backend ordering default and caller override. | Used |
| `src/utils/PageCache.ts` | Cache eligibility must include every result- or shape-changing query option. | Used |
| `test/unit/spec/cc.ts` | Action mapping and thin delegation through the existing list methods are asserted. | Used |
| `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Default policy, existing-parameter overrides, CMS sort serialization, view flags, and cache behavior are asserted. | Used |
| `src/services/task/state-machine/uiControlsComputer.ts`, `src/services/task/types.ts` | Task UI controls are the existing SDK-owned decision surface and can carry ordered destination availability. | Used |
| `test/unit/spec/services/task/state-machine/uiControlsComputer.ts`, `test/unit/spec/services/task/TaskFactory.ts` | Profile/media/direction gating, outbound flag path, ordering, and factory propagation are asserted. | Used |
| `src/services/task/Task.ts`, `src/services/task/constants.ts`, `test/unit/spec/services/task/Task.ts` | Direct entry-point transfer routing is translated to the backend EPDN value and sent through the vteam transfer path. | Used |

## Requirements

| ID | WHAT | WHY | Source evidence | Test or example evidence | Assumptions or gaps | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `SDK-LIST-R-001` | Existing `getQueues` must retain `ContactServiceQueueSearchParams` and `ContactServiceQueuesResponse`, default to inbound active telephony queues ordered by backend name ascending with desktop-profile/agent/first-level views, avoid field projection, and honor caller-supplied existing parameters as overrides. | Queue eligibility and ordering are consistent for ordinary calls without a new method or misleading projected/full-record type mismatch, while other consumers retain an explicit override path. | `src/cc.ts`, `src/services/Queue.ts`, `src/types.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts` | Backend honors the documented CMS query flags. | Present |
| `SDK-LIST-R-002` | Existing `getEntryPoints` must retain `EntryPointSearchParams` and `EntryPointListResponse`, default to inbound active telephony entry points ordered by backend name ascending with desktop-profile and agent views, avoid field projection, and honor caller-supplied existing parameters as overrides. | Entry-point eligibility and ordering are consistent for ordinary calls without a parallel API or response type, while other consumers retain an explicit override path. | `src/cc.ts`, `src/services/EntryPoint.ts`, `src/types.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/EntryPoint.ts` | Backend honors the documented CMS query flags. | Present |
| `SDK-LIST-R-003` | Buddy-agent requests using `Transfer` must add state `Available`; requests using `Consult` must omit the state filter; omitted action-based media defaults to telephony; both `BuddyAgents` branches reuse one private supported-media union. | Transfer and Consult have different eligible populations, and one media allowlist prevents action-based callers from issuing unsupported buddy requests without adding another public type. | `src/cc.ts`, `src/types.ts` | `test/unit/spec/cc.ts` | The backend determines the Consult-eligible states when state is omitted. | Present |
| `SDK-LIST-R-004` | Explicit buddy-agent state requests and existing queue/entry-point/address-book parameters must remain supported; caller-supplied filters and sort values override service defaults. | Existing SDK consumers need specialized behavior without a second list API. | `src/cc.ts`, `src/types.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Existing callers that pass explicit `state` continue to use that branch. | Present |
| `SDK-LIST-R-005` | Queue, EntryPoint, and AddressBook services must serialize ordering as CMS `sort=<field>,<ORDER>`, not separate `sortBy`/`sortOrder` query keys; all three use `sort=name,ASC` when callers omit sorting, and a Queue `sortOrder` without `sortBy` uses `name`. | Correct wire syntax and SDK-owned defaults make backend ordering consistent and prevent a caller's explicit Queue direction from being silently ignored. | `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | None. | Present |
| `SDK-LIST-R-006` | PageCache must reject cache use when search, filter, attributes, a non-default/effective sort, or an enabled desktop-profile/provisioning/single-object flag is present. This includes a Queue `sortOrder` supplied without `sortBy`. Default Queue and EntryPoint calls bypass simple-page caching because their eligibility filters and enabled profile views change the result set; AddressBook retains cache eligibility for its invariant default order. | The cache key does not encode result variants, so default policy requests and explicit query variants cannot safely share a page. | `src/utils/PageCache.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Service-level behavior covers default and override cases. | Present |
| `SDK-LIST-R-007` | The SDK must return service response arrays and pagination metadata without JavaScript-side sorting or reordering. | Backend-requested order is authoritative and must remain stable for every consumer. | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` | `test/unit/spec/cc.ts` | The backend is the source of final row order. | Present |
| `SDK-LIST-R-008` | The existing `BuddyAgents` input and `TaskUIControls.consultTransferDestinations` field must carry action/media and ordered destination typing without exporting one-off aliases; queue and entry-point consumers continue to use the established request and full-record response types unchanged. | Public consumers need truthful compile-time contracts without extra public aliases, record fields, destination abstractions, or projected responses. | `src/types.ts`, `src/services/task/types.ts`, `src/index.ts`, `src/cc.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts`, `package.json` | Existing test-only casts are outside the public contract. | Present |
| `SDK-LIST-R-009` | Buddy-agent, queue, and entry-point failures must preserve their existing measured/logged rejection semantics and must not return a synthetic successful list. | Callers need to distinguish a real empty result from a transport or backend failure. | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` | Consumer UI fallback behavior remains outside the SDK. | Present |
| `SDK-LIST-R-010` | AddressBook must request backend `name,ASC` ordering by default and must accept caller-supplied `sortBy`/`sortOrder` overrides without a consult-specific façade method. | Widgets and other ordinary consumers receive backend-ordered dial numbers out of the box, while consumers with another requirement retain control. | `src/services/AddressBook.ts` | `test/unit/spec/services/AddressBook.ts` | Backend honors the documented CMS sort value. | Present |
| `SDK-LIST-R-011` | Non-default media eligibility must be supplied through the existing RSQL `filter` parameter; the SDK never interpolates an unvalidated media string into a filter. | Reusing the established filter contract avoids a second media-bearing signature and removes the prior filter-injection path. | `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/types.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` | Consumers that construct RSQL filters remain responsible for supplying valid backend syntax. | Present |
| `SDK-LIST-R-012` | Every Task must expose `uiControls.consultTransferDestinations` with ordered `consult` and `transfer` arrays. Order is Agent, Queue, Dial Number, Entry Point after gating: profile `NONE` removes agent/queue/entry point; voice Consult queue requires `allowConsultToQueue`; voice Transfer queue requires inbound direction or outbound plus `interaction.callProcessingDetails.outdialTransferToQueueEnabled === true`; unknown voice direction does not allow queue Transfer; digital exposes only allowed agent/queue categories. | All consumers need the same destination decision out of the box, without reading raw profile flags, interpreting task payload paths, or calling another policy API. | `src/cc.ts`, `src/services/task/TaskFactory.ts`, `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/task/TaskFactory.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts` | Consumers may hide an SDK-allowed category for host UX, but cannot enable one the SDK omitted. | Present |
| `SDK-LIST-R-013` | A direct `Task.transfer()` to the public `entryPoint` destination must remain available for eligible voice tasks, translate internally to backend destination type `entrypointDialNumber`, and use `vteamTransfer`; callers continue to pass the selected entry-point identifier and do not perform backend translation. | Entry-point transfer is a supported vteam operation, while sending the public value unchanged through `blindTransfer` selects the wrong backend operation and makes SDK-owned controls advertise a failing action. | `src/services/task/Task.ts`, `src/services/task/constants.ts`, `src/services/task/types.ts` | `test/unit/spec/services/task/Task.ts` | The existing entry-point identifier remains a valid fallback when no analyzer identifier is exposed, matching the established transfer policy. | Present |

## Defect context (when applicable)

- Observed versus expected behavior: widgets and SDK callers could construct different destination requests, the services serialized sort with keys the CMS list API does not consume, and cache eligibility ignored view/shape flags; expected behavior is one SDK-owned default policy and unchanged backend response order.
- Reproduction and environment: issue Consult and Transfer destination requests for the same task media and compare query parameters and results across SDK consumers.
- Regression range or last known good state: unknown; the existing APIs and older query serialization predate the corrected defaults.
- Severity, frequency, and workaround: user-visible whenever eligibility/order differs; consumers could manually duplicate flags, but that perpetuates the ownership defect.
- Diagnostic evidence: `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/utils/PageCache.ts`.

## MODIFIED Requirements

### MOD-001 — Contact Center façade policy (`CONTACT_CENTER-R-003`)

- **WHAT**: Retain the existing `getQueues`, `getEntryPoints`, and `getBuddyAgents` method names. Buddy-agent behavior is action-aware; Queue and EntryPoint keep their existing parameter, record, and full-response signatures and own the default telephony filter, profile views, backend ordering, and cache policy.
- **WHY**: A stable public owner prevents every UI consumer from reconstructing eligibility and query details.
- **Evidence:** `src/cc.ts`, `src/types.ts`, `src/index.ts`, `test/unit/spec/cc.ts`.
- **Acceptance:** Façade tests cover Consult, Transfer, and unchanged existing-method delegation; service tests cover default policy, explicit existing-filter overrides, and exact responses.

### MOD-002 — Direct REST list services (`SERVICES-R-002`, `SERVICES-R-007`)

- **WHAT**: Queue, EntryPoint, and AddressBook must serialize CMS sorting as a combined `sort` value; their existing methods default to `name,ASC` and honor explicit caller overrides; Queue and EntryPoint apply required profile/agent views by default while retaining direct HTTP completion/error semantics and full-record responses.
- **WHY**: SDK defaults are effective only when service wire parameters match the backend contract.
- **Evidence:** `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts`.
- **Acceptance:** Service tests assert default `sort=name,ASC`, custom descending overrides, and all requested view flags.

### MOD-003 — Buddy-agent request contract (`AGENT-R-003`)

- **WHAT**: Preserve the correlated buddy-agent request/response contract while allowing the façade to derive optional state from `Consult` or `Transfer`.
- **WHY**: Eligibility changes must not alter AQM settlement or invent UI-side filtering.
- **Evidence:** `src/cc.ts`, `src/services/agent/index.ts`, `test/unit/spec/cc.ts`, `test/unit/spec/services/agent/index.ts`.
- **Acceptance:** Transfer sends `Available`; Consult sends no state; explicit state callers remain typed and supported.

### MOD-004 — Query-aware cache eligibility (`UTILS-R-001`, `UTILS-R-006`)

- **WHAT**: Treat enabled profile/response-shape flags and non-default sorts as cache-disqualifying inputs. Existing Queue and EntryPoint default-policy requests bypass cache through their fixed filters/views. Keep default `name,ASC` AddressBook pages cache-eligible because that ordering is invariant for its base cache key.
- **WHY**: A page keyed only by scope/page/pageSize cannot safely represent query variants, but it can safely represent one invariant default order.
- **Evidence:** `src/utils/PageCache.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`.
- **Acceptance:** Two identical view-filtered or custom-sort calls make two backend requests; repeated default-sorted pagination remains cache-eligible.

### MOD-005 — Direct entry-point transfer routing (`TASK-R-003`, `TASK-R-008`)

- **WHAT**: Keep Entry Point in eligible voice Transfer destination controls. When `Task.transfer()` receives the public `entryPoint` destination, translate it internally to `entrypointDialNumber` and invoke `contact.vteamTransfer`; Queue remains on `vteamTransfer`, while Agent and Dial Number remain on `blindTransfer`.
- **WHY**: Consumers must be able to follow Task controls directly without knowing backend routing values, and supported entry-point transfers must use the same vteam operation as the established transfer policy.
- **Evidence:** `src/services/task/Task.ts`, `src/services/task/constants.ts`, `src/services/task/types.ts`, `test/unit/spec/services/task/Task.ts`.
- **Acceptance:** Task tests assert the exact EPDN vteam payload, no blind-transfer call, and unchanged Queue/Agent dispatch.

## Acceptance criteria

- [x] Transfer buddy lookup sends state `Available`; Consult omits state; action-based media defaults to telephony (`MOD-003`, `SDK-LIST-R-003`).
- [x] Existing `getQueues` sends the default inbound/active/telephony filter, backend name ascending order, desktop-profile, agent, and first-level views without a field projection (`MOD-001`, `MOD-002`, `SDK-LIST-R-001`).
- [x] Existing `getEntryPoints` sends the default inbound/active/telephony filter, desktop-profile and agent views, and backend name ascending order without a field projection (`MOD-001`, `MOD-002`, `SDK-LIST-R-002`).
- [x] Caller-supplied existing filters override the telephony default for non-telephony or other specialized consumers (`SDK-LIST-R-001`, `SDK-LIST-R-002`, `SDK-LIST-R-011`).
- [x] AddressBook sends backend name ascending order by default and honors a caller-supplied descending override (`MOD-002`, `SDK-LIST-R-004`, `SDK-LIST-R-010`).
- [x] Queue, EntryPoint, and AddressBook serialize CMS ordering as the combined `sort` query value (`MOD-002`, `SDK-LIST-R-005`).
- [x] Queue `sortOrder` without `sortBy` serializes as `sort=name,<ORDER>` and bypasses the simple-page cache (`SDK-LIST-R-005`, `SDK-LIST-R-006`).
- [x] Default Queue/EntryPoint policy and other view/filter/shape/custom-sort requests bypass PageCache, while default-sorted AddressBook pages remain cacheable (`MOD-004`, `SDK-LIST-R-006`).
- [x] No SDK façade or service sorts returned arrays in JavaScript (`SDK-LIST-R-007`).
- [x] Existing queue and entry-point methods retain their record and full-response types and request no partial field projection (`SDK-LIST-R-008`).
- [x] Direct entry-point transfer remains SDK-advertised for eligible voice tasks and is sent through `vteamTransfer` as `entrypointDialNumber`, with no widgets-side translation (`MOD-005`, `SDK-LIST-R-013`).
- [x] The package builds and the complete Contact Center unit and style suites pass (`SDK-LIST-R-008`).

## Scenarios and applicable change views

| Scenario | Actor | Preconditions | Expected behavior | Failure or boundary behavior | Requirements |
| --- | --- | --- | --- | --- | --- |
| Consult buddy agents | SDK consumer | `action=Consult` | Telephony defaults when absent; state is omitted; backend order is preserved. | Request rejection is measured/logged and rethrown. | `SDK-LIST-R-003`, `SDK-LIST-R-007` |
| Transfer buddy agents | SDK consumer | `action=Transfer` | State `Available` is sent for the selected media. | Explicit state and action cannot be combined by the public type. | `SDK-LIST-R-003`, `SDK-LIST-R-008` |
| Queue list | SDK consumer | Existing method called with page/search and optional filter override | SDK applies the default telephony policy and returns full records unchanged; an explicit existing filter overrides eligibility. | HTTP failure is propagated without a synthetic page. | `SDK-LIST-R-001`, `SDK-LIST-R-007`, `SDK-LIST-R-011` |
| Entry-point list | SDK consumer | Existing method called with page/search and optional filter override | SDK applies the default telephony policy and returns full records unchanged; an explicit existing filter overrides eligibility. | HTTP failure is propagated without a synthetic page. | `SDK-LIST-R-002`, `SDK-LIST-R-009`, `SDK-LIST-R-011` |
| Dial-number list | SDK consumer | AddressBook page/search supplied | AddressBook applies backend `name,ASC` by default and returns the response unchanged. | A custom sort overrides the default and bypasses the default-order cache. | `SDK-LIST-R-010` |
| Specialized list consumer | SDK consumer | Uses an existing list method with explicit parameters | Explicit filter/sort/profile inputs override defaults. | No parallel consult/transfer method or projected response type is required. | `SDK-LIST-R-004`, `SDK-LIST-R-005` |
| Direct entry-point transfer | SDK consumer | Voice Task exposes Entry Point in the Transfer destination array | `Task.transfer({to, destinationType: 'entryPoint'})` sends `{to, destinationType: 'entrypointDialNumber'}` through `vteamTransfer`. | Vteam rejection is measured and rethrown; `blindTransfer` is not invoked. | `SDK-LIST-R-012`, `SDK-LIST-R-013` |

### Interaction and scenario matrix

| Context or interacting state | Trigger | Expected result | Invalid or conflicting result | Requirements |
| --- | --- | --- | --- | --- |
| Consult + agent | Action request | No state filter | Applying Transfer-only `Available` | `SDK-LIST-R-003` |
| Transfer + agent | Action request | `state=Available` | Returning idle agents through an omitted state filter | `SDK-LIST-R-003` |
| Queue + social media | Existing list request with filter override | Caller supplies `channelType==SOCIAL_CHANNEL` through `filter` | Adding a second media-bearing method signature | `SDK-LIST-R-001`, `SDK-LIST-R-011` |
| View-filtered queue/entry point | Repeated page request | Backend called for each request | Simple-page cache hit | `SDK-LIST-R-006` |
| Existing Queue, EntryPoint, or AddressBook | Sort omitted | Backend receives `sort=name,ASC` | Consumer must provide the default itself | `SDK-LIST-R-005`, `SDK-LIST-R-010` |
| Existing Queue, EntryPoint, or AddressBook | Custom sort supplied | Backend receives the requested field/order | SDK overwrites the caller's explicit behavior | `SDK-LIST-R-004`, `SDK-LIST-R-010` |
| Backend result | Response received | Array and metadata returned in backend order | JavaScript `.sort()` or consumer-specific reorder | `SDK-LIST-R-007` |
| Voice Transfer + entry point | Destination selected | SDK maps `entryPoint` to backend `entrypointDialNumber` and calls `vteamTransfer` | Sending `entryPoint` through `blindTransfer` or hiding the supported category | `SDK-LIST-R-013` |

### API contract delta

| API or operation | Change | Consumer impact | Compatibility expectation | Canonical definition |
| --- | --- | --- | --- | --- |
| Buddy-agent input | Add discriminated `action` branch; retain explicit state branch. | Consumers may pass Consult/Transfer instead of choosing state. | Additive public type; explicit-state callers remain supported. | `src/types.ts` |
| Existing queue list | Apply the telephony filter, profile views, and `name,ASC` by default. | Thin clients call `getQueues`; other consumers use existing parameters for overrides. | Intentional default correction; method and response signature unchanged. | `src/cc.ts`, `src/services/Queue.ts` |
| Existing entry-point list | Apply the telephony filter, profile views, and `name,ASC` by default. | Thin clients call `getEntryPoints`; other consumers use existing parameters for overrides. | Intentional default correction; method and response signature unchanged. | `src/cc.ts`, `src/services/EntryPoint.ts` |
| Task destination controls | Add ordered `consultTransferDestinations.consult` and `.transfer` arrays to `TaskUIControls`. | Task consumers render availability directly; no separate policy call or raw profile injection is needed. | Additive public field using the existing destination values; no new standalone public alias. | `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts`, `src/index.ts` |
| Existing `Task.transfer` entry-point input | Correct internal transport and backend destination translation. | Consumers keep passing `{to, destinationType: 'entryPoint'}` from the Task control array. | Behavioral bug fix; no method or public payload signature change. | `src/services/task/Task.ts`, `src/services/task/constants.ts` |

### Public API and semver impact

| Export or entry point | Change | Affected consumers | Required version change | Deprecation or migration |
| --- | --- | --- | --- | --- |
| Existing `getQueues` / `getEntryPoints` | Default request behavior changes; signatures do not | Widgets and other SDK consumers | Behavioral semver review | Pass explicit existing filters/sorts/profile flags when different behavior is required. |
| `BuddyAgents` | Add action-based alternative while retaining explicit state | Existing and new consumers | Minor | Existing explicit-state calls remain valid. |
| `TaskUIControls` | Add inline ordered, action-specific destination availability using existing destination values | Task UI consumers | Minor | Read the matching action array; first item is the default category. |
| `Task.transfer` | Route the existing public `entryPoint` value through vteam transfer as backend `entrypointDialNumber` | Existing voice-task consumers | Patch/behavioral correction | No caller migration; backend translation is SDK-owned. |

### Cross-package impact

| Package | Change | Dependency direction | Release sequencing | Owner |
| --- | --- | --- | --- | --- |
| `@webex/contact-center` | Owns action/default/filter/order/cache policy and Task destination visibility/order decisions. | SDK → consumers | Build/release first. | SDK maintainers |
| `@webex/cc-store` | Delegates to existing methods and uses the existing `filter` parameter only for a non-telephony active task. | store → SDK | Consume a compatible SDK release. | Widgets maintainers |
| `@webex/cc-task` and `@webex/cc-components` | Supply action and render results. | UI → store → SDK | Release after compatible store/SDK. | Widgets maintainers |

## Contracts delta

**Provides — MODIFIED:** The package keeps the existing queue, entry-point, buddy-agent, and Task transfer methods. Queue and EntryPoint retain established request, record, and full-response signatures while gaining consult/transfer telephony defaults; buddy agents accept action-aware input through `BuddyAgents`; `TaskUIControls` exposes inline ordered action-specific destination availability; direct entry-point transfer uses SDK-owned EPDN/vteam translation without changing the public payload.

**Requires — MODIFIED:** Queue, EntryPoint, and AddressBook services require CMS list endpoints to honor the combined sort value; Queue and EntryPoint additionally require the applicable profile/agent view flags. Direct entry-point transfer requires the WCC vteam transfer operation to accept the established `entrypointDialNumber` destination and selected entry-point identifier. The SDK continues to rely on host-authenticated Webex requests and backend response ordering.

No event contract changes.

## Success and guardrail metrics

| Metric | Baseline | Target | Measurement source |
| --- | --- | --- | --- |
| Consumers that must recreate the default queue/entry-point policy | Widgets did | 0 for ordinary existing-method calls | `src/services/Queue.ts`, `src/services/EntryPoint.ts` |
| JavaScript-side destination sorts in the changed SDK path | 0 | 0 | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` |
| Cache hits for view/filter/shape query variants | Possible | 0 | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Contact Center unit failures | Unknown before change | 0 | `test/unit/spec` |
| Contact Center build/style errors | Unknown before change | 0 | Package build and style commands |

## Requested data and fields

| Entity or payload | Requested field or shape | Purpose | Ownership | Privacy, retention, or compatibility constraint |
| --- | --- | --- | --- | --- |
| Buddy-agent input | `action` plus optional `mediaType`, mutually exclusive with explicit `state` | Derive Consult/Transfer eligibility. | SDK public type | No credential or persistent data. |
| Queue search input | Existing page, page size, search, filter, sort, and profile parameters | Consumer-controlled pagination plus optional default overrides. | Existing SDK public type | No second media-bearing request type. |
| Queue backend query | Default inbound/active/telephony filter, name ascending, desktop-profile/agent/first-level views, no field projection | Full queue result using the default list policy. | Queue service | Fixed filter/views bypass simple-page caching. |
| Entry-point backend query | Default inbound/active/telephony filter, name ascending, desktop-profile/agent views, no field projection | Full entry-point result using the default list policy. | EntryPoint service | Fixed filter/views bypass simple-page caching. |
| Direct entry-point transfer payload | Caller-selected `to`; public `entryPoint` translated internally to `entrypointDialNumber` | Invoke the supported vteam transfer operation without consumer-side backend knowledge. | Task service | Translation is transport-only; metrics retain the caller-facing destination type and no new public field is required. |
| AddressBook backend query | Existing caller-selected fields plus name ascending by default | Backend-ordered dial numbers without a specialized façade. | AddressBook service | A non-default sort bypasses the default-order cache. |

## Impacted domains

| Repository or module | Impact | Owner |
| --- | --- | --- |
| `src` | Public façade and exports | SDK maintainers |
| `src/services` | Queue/EntryPoint/AddressBook wire query construction | SDK maintainers |
| `src/services/agent` | Existing correlated buddy-agent operation receives façade-derived state | SDK maintainers |
| `src/services/task` | Direct entry-point transfer dispatch and backend destination translation | SDK maintainers |
| `src/utils` | Cache eligibility for query variants | SDK maintainers |
| Webex widgets repository | Thin consumer of the new defaults | Widgets maintainers |

## Feasibility and risks

| Risk or assumption | Evidence | Mitigation or decision owner |
| --- | --- | --- |
| CMS ignores ordering when encoded as legacy separate keys. | `src/services/Queue.ts`, `src/services/EntryPoint.ts` | Use and test combined `sort=<field>,<ORDER>` serialization. |
| Simple cache returns a page created under a different view. | `src/utils/PageCache.ts` | Make every result/shape flag cache-disqualifying and retain repeated-call tests. |
| New EntryPoint/AddressBook ordering defaults affect generic callers. | `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | Make the correction explicit, retain caller overrides, and test both default and custom order. |
| A consumer re-sorts backend results. | `test/unit/spec/cc.ts` | Return the delegated response unchanged and document backend order as authoritative. |
| Direct entry-point transfer is sent to the blind-transfer operation or with the public destination literal. | `src/services/task/Task.ts`, established transfer-policy behavior | Route through `vteamTransfer`, translate to `entrypointDialNumber`, and assert the exact payload. |

## Error Matrix

| Failure | SDK behavior | Consumer-visible result | Evidence |
| --- | --- | --- | --- |
| Buddy-agent AQM rejection | Record failure context and rethrow. | Promise rejects; no synthetic agent list. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Queue HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/Queue.ts`, `test/unit/spec/services/Queue.ts` |
| Entry-point HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/EntryPoint.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Missing action-based media | Default to telephony. | Valid request with predictable channel. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Non-default media eligibility | Consumer supplies a complete allowlisted RSQL value through the existing `filter` field; the SDK performs no media-string interpolation. | Existing method returns matching full records or propagates the backend error. | `src/services/Queue.ts`, `src/services/EntryPoint.ts`, service tests |
| Direct entry-point vteam transfer rejection | Preserve existing Task transfer error normalization, failure metrics, and rethrow semantics. | `Task.transfer()` rejects; no fallback blind-transfer request is made. | `src/services/task/Task.ts`, `test/unit/spec/services/task/Task.ts` |

## Resilience

- Existing methods make one delegated list request and add no retry or request fan-out.
- Queue, EntryPoint, and AddressBook callers use explicit existing parameters when they require non-default behavior.
- View/filter/shape queries bypass cache rather than risk stale or cross-policy results.
- Errors remain caller-visible; the SDK does not manufacture an empty success response.

## Observability

- Existing buddy-agent success/failure metrics retain media and derived state context plus count, without logging agent identities.
- Existing Queue and EntryPoint request/success/failure metrics continue to cover the default and overridden calls.
- Existing Task transfer success/failure metrics continue to report the caller-facing entry-point destination while transport uses the backend EPDN value.
- No new metric taxonomy, PII-bearing log, credential log, trace, or alert is introduced.

## Operations

- Build and run the complete Contact Center unit suite and style check before publishing.
- Release the SDK before or with widgets that require the corrected existing-method defaults and Task controls.
- Rollback is a coordinated package-version/code rollback; no persisted state, schema, or cache migration is required.

## Migration expectations

- Compatibility: list method names/signatures remain unchanged; explicit buddy-agent state remains supported. Queue, EntryPoint, and AddressBook calls now request `name,ASC`, and Queue/EntryPoint apply telephony/profile defaults unless callers override existing parameters.
- Data or consumer transition: thin consumers continue using `getQueues` and `getEntryPoints`; consumers needing different behavior pass existing query overrides.
- Coexistence period: no parallel list surface exists.
- Completion and rollback outcome: consumers no longer own the default consult/transfer policy; rollback restores prior calls without data cleanup.

## Serviceability

| Signal or support surface | Required change | Consumer or operator | Acceptance evidence |
| --- | --- | --- | --- |
| Buddy-agent operational metrics | Report derived action state and media without identities. | SDK maintainers | `test/unit/spec/cc.ts` |
| Queue request metrics/logs | Preserve existing request success/failure coverage for default and overridden calls. | SDK maintainers | `test/unit/spec/services/Queue.ts` |
| Entry-point request metrics/logs | Preserve existing request success/failure coverage for default and overridden calls. | SDK maintainers | `test/unit/spec/services/EntryPoint.ts` |

## Documentation obligations

- This approved delta modifies `CONTACT_CENTER-R-003`, `SERVICES-R-002`, `SERVICES-R-007`, `AGENT-R-003`, `UTILS-R-001`, and `UTILS-R-006` without overwriting protected canonical specs.
- Direct entry-point routing additionally modifies `TASK-R-003` and `TASK-R-008` through this approved MODIFIED delta; the protected Task canonical spec remains unchanged until a future reconciliation/promotion.
- The paired widgets feature spec must reference this SDK delta as the owner of default telephony eligibility, ordering, profile views, and cache policy; widgets may pass an existing filter for the active task's non-telephony channel.
- A future canonical-spec promotion must fold this delta into the routed module specs and reconcile the delta path rather than duplicate the requirements.

## Decision and change log

| Date | Decision or change | Rationale | Owner |
| --- | --- | --- | --- |
| 2026-08-20 | Kept Entry Point available for eligible voice transfers and corrected `Task.transfer()` to use vteam routing with internal `entrypointDialNumber` translation. | Agent Desktop and the backend transfer policy support direct entry-point transfer; hiding it would remove valid functionality, while consumers should not know the backend EPDN literal. | Developer + Codex |
| 2026-08-19 | Kept action/media typing inside `BuddyAgents`, inlined the destination arrays on `TaskUIControls`, removed the new root aliases, and removed `dbId` additions from queue/entry-point records. | The established methods and types already express the required behavior; consumers do not need standalone aliases or an unused record field. | Developer + Codex |
| 2026-08-19 | Approved this exact MODIFIED delta path. | Preserve protected canonical specs while maintaining spec-currency with the implementation. | Developer |
| 2026-08-19 | Assigned all reusable eligibility, query, ordering, and cache decisions to the SDK. | Keep widgets thin and prevent cross-consumer behavior drift. | Developer + Codex |
| 2026-08-19 | Made backend response order authoritative and prohibited SDK-side JavaScript sorting. | One backend ordering decision must reach every consumer unchanged. | Developer + Codex |
| 2026-08-19 | Moved EntryPoint and AddressBook `name,ASC` ordering to service defaults and removed the specialized dial-number façade. | Widgets must work without supplying SDK-owned decisions; other consumers can pass explicit sort overrides. | Developer + Codex |
| 2026-08-19 | Removed the specialized queue/entry-point methods and destination response/options types; moved the telephony filter, views, and order defaults onto existing `getQueues`/`getEntryPoints` while retaining full records and existing overrides. | Consumers should keep established method signatures; a parallel list abstraction adds needless public surface and projection complexity. | Developer + Codex |
| 2026-08-19 | Put ordered Consult/Transfer destination availability directly on every Task's `uiControls` instead of adding `getConsultTransferDestinationPolicy`. | The Task already owns UI decisions and live interaction data, so consumers should not make a second request or reproduce profile/media/direction rules. | Developer + Codex |
