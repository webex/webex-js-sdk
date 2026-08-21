---
type: Feature Spec
title: Consult and transfer list policy
description: Centralize consult and transfer destination eligibility, request shaping, ordering, and cache policy in the Contact Center SDK.
tags: [feature, specification, contact-center, consult-transfer]
---

# Consult and transfer list policy

This document owns the reusable consult/transfer destination-list policy. The SDK applies default telephony eligibility, ordering, profile views, and cache safety through the existing list methods; consumers use compatible existing parameters only when they need a different filter or sort.

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
| Last verified | 2026-08-21 in the approved SDK/widgets worktrees |

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

The goal is to make the SDK the single owner of the default consult/transfer policy without adding parallel list methods or response signatures. The existing Queue method returns eligible full records, while the existing EntryPoint method maps profile-scoped dial-number rows to the established response wrapper. Queue, EntryPoint, and AddressBook request backend ordering, buddy-agent behavior is action-aware, CMS sort syntax is serialized correctly, and query variants that change results cannot reuse an incompatible cached page. Consumers render the response order and metadata without a second sort or filter.

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
- Default omitted buddy-agent and queue media context to telephony.
- Retain the existing queue/entry-point parameter and response wrappers; keep full Queue records, map EntryPoint dial-number rows to truthful `EntryPointRecord` fields, and retain compatible filter/sort overrides without exposing the fixed entry-point profile-scoping flag.
- Default EntryPoint requests to backend `entryPointName,ASC` and AddressBook requests to `name,ASC` while allowing callers to pass another `sortBy`/`sortOrder` pair.
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
| `src/types.ts`, `src/index.ts` | Existing queue/entry-point request and response types remain the public list contracts; entry-point rows expose the mapped dialled number as optional `number`. | Used |
| `src/services/Queue.ts` | The existing Queue path owns default query serialization and view flags. | Used |
| `src/services/EntryPoint.ts` | The existing EntryPoint path owns the desktop-profile dial-number query, safe search serialization, field mapping, and backend ordering. | Used |
| `src/services/core/WebexRequest.ts` | The shared request wrapper forwards optional per-request headers needed by the dial-number endpoint while leaving other requests unchanged. | Used |
| `src/services/AddressBook.ts` | AddressBook owns its backend ordering default and caller override. | Used |
| `src/utils/PageCache.ts` | Cache eligibility must include every result- or shape-changing query option. | Used |
| `test/unit/spec/cc.ts` | Action mapping and thin delegation through the existing list methods are asserted. | Used |
| `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Default policy, existing-parameter overrides, CMS sort serialization, view flags, and cache behavior are asserted. | Used |
| `src/services/task/state-machine/uiControlsComputer.ts`, `src/services/task/types.ts` | Task UI controls are the existing SDK-owned decision surface and can carry ordered destination availability. | Used |
| `test/unit/spec/services/task/state-machine/uiControlsComputer.ts`, `test/unit/spec/services/task/TaskFactory.ts` | Profile/media/direction gating, outbound flag path, ordering, and factory propagation are asserted. | Used |
| `src/services/task/Task.ts`, `src/services/task/constants.ts`, `test/unit/spec/services/task/Task.ts` | Direct entry-point transfer routing is translated to the backend EPDN value and sent through the vteam transfer path. | Used |
| `docs/samples/contact-center/app.js` | The sample renders buddy-agent state labels and mapped entry-point numbers while using the existing list methods and Task destination controls. | Used |

## Requirements

| ID | WHAT | WHY | Source evidence | Test or example evidence | Assumptions or gaps | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `SDK-LIST-R-001` | Existing `getQueues` must retain `ContactServiceQueueSearchParams` and `ContactServiceQueuesResponse`, default to inbound active telephony queues ordered by backend name ascending with desktop-profile/agent/first-level views, avoid field projection, and honor defined caller-supplied existing parameters as overrides. Optional properties explicitly set to `undefined` retain defaults; explicit `false` flags and an explicit empty filter remain overrides. | Queue eligibility and ordering are consistent for ordinary calls without a new method or misleading projected/full-record type mismatch, while other consumers retain an explicit override path. Defined-only merging prevents a normally constructed optional-parameter object from accidentally disabling safe defaults. | `src/cc.ts`, `src/services/Queue.ts`, `src/types.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts` | Backend honors the documented CMS query flags. | Present |
| `SDK-LIST-R-002` | Existing `getEntryPoints` must retain `EntryPointSearchParams` and `EntryPointListResponse`, query `/v3/dial-number` with organization/internal-data headers, fixed desktop-profile filtering, entry-point names, required mapping attributes, and backend `entryPointName,ASC`, then map each row to the existing `EntryPointRecord` as `id=entryPointId`, `name=entryPointName`, and optional `number=dialledNumber` without reordering. Caller-supplied compatible search, filter, attributes, and sort parameters remain available. | The visible entry-point number belongs to the dial-number mapping rather than the configuration record; owning its complete request contract and mapping in the existing SDK method keeps consumers thin and preserves the established method/response wrapper without exposing an implementation policy flag. | `src/cc.ts`, `src/services/EntryPoint.ts`, `src/services/config/constants.ts`, `src/services/core/WebexRequest.ts`, `src/types.ts` | `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/core/WebexRequest.ts` | The v3 response includes entry-point identifiers/names when `includeEntryPointName=true`. | Present |
| `SDK-LIST-R-003` | Buddy-agent requests using `Transfer` must add state `Available`; requests using `Consult` must omit the state filter; omitted action-based media defaults to telephony; both `BuddyAgents` branches reuse one private supported-media union. | Transfer and Consult have different eligible populations, and one media allowlist prevents action-based callers from issuing unsupported buddy requests without adding another public type. | `src/cc.ts`, `src/types.ts` | `test/unit/spec/cc.ts` | The backend determines the Consult-eligible states when state is omitted. | Present |
| `SDK-LIST-R-004` | Explicit buddy-agent state requests and existing queue/entry-point/address-book parameters must remain supported; caller-supplied filters and sort values override service defaults. | Existing SDK consumers need specialized behavior without a second list API. | `src/cc.ts`, `src/types.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Existing callers that pass explicit `state` continue to use that branch. | Present |
| `SDK-LIST-R-005` | Queue, EntryPoint, and AddressBook services must serialize ordering as CMS `sort=<field>,<ORDER>`, not separate `sortBy`/`sortOrder` query keys. Queue and AddressBook default to `name,ASC`; EntryPoint maps the public default `name` field to backend `entryPointName,ASC`; a Queue `sortOrder` without `sortBy` uses `name`. | Correct wire syntax and SDK-owned defaults make backend ordering consistent and prevent a caller's explicit direction from being silently ignored. | `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | None. | Present |
| `SDK-LIST-R-006` | PageCache must reject cache use when search, filter, attributes, a non-default/effective sort, or an enabled desktop-profile/provisioning/single-object flag is present. This includes a Queue `sortOrder` supplied without `sortBy`. Default Queue calls bypass simple-page caching because their eligibility filter and enabled views change the result set; profile-scoped EntryPoint requests are made directly without PageCache; AddressBook retains cache eligibility for its invariant default order. | The cache key does not encode result variants, so default policy requests and explicit query variants cannot safely share a page. | `src/utils/PageCache.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Service-level behavior covers default and override cases. | Present |
| `SDK-LIST-R-007` | The SDK must not JavaScript-sort or reorder list response arrays. EntryPoint may rename/map fields row-for-row while preserving response order and pagination metadata. | Backend-requested order is authoritative and must remain stable for every consumer. | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/EntryPoint.ts` | The backend is the source of final row order. | Present |
| `SDK-LIST-R-008` | The existing `BuddyAgents` input and `TaskUIControls.consultTransferDestinations` field must carry action/media and ordered destination typing without exporting one-off aliases; queue and entry-point consumers continue to use the established request/response wrappers. `EntryPointRecord` must strongly type optional mapped `number`, while configuration-only fields absent from the mapped list are optional. | Public consumers need a truthful compile-time contract without extra public aliases, destination abstractions, response wrappers, or casts for the displayed entry-point number. | `src/types.ts`, `src/services/task/types.ts`, `src/index.ts`, `src/cc.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts`, `package.json` | None. | Present |
| `SDK-LIST-R-009` | Buddy-agent, queue, and entry-point failures must preserve their existing measured/logged rejection semantics and must not return a synthetic successful list. | Callers need to distinguish a real empty result from a transport or backend failure. | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` | Consumer UI fallback behavior remains outside the SDK. | Present |
| `SDK-LIST-R-010` | AddressBook must request backend `name,ASC` ordering by default and must accept caller-supplied `sortBy`/`sortOrder` overrides without a consult-specific façade method. | Widgets and other ordinary consumers receive backend-ordered dial numbers out of the box, while consumers with another requirement retain control. | `src/services/AddressBook.ts` | `test/unit/spec/services/AddressBook.ts` | Backend honors the documented CMS sort value. | Present |
| `SDK-LIST-R-011` | Non-default queue media eligibility must be supplied through the existing RSQL `filter` parameter; the SDK never interpolates an unvalidated media string into a filter. EntryPoint search text must be escaped before it is embedded in the v3 CMS multi-field search expression. | Reusing the established filter contract avoids a second media-bearing signature, while escaping SDK-built search syntax prevents user text from changing the query. | `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/types.ts` | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` | Consumers that construct explicit RSQL filters remain responsible for supplying valid backend syntax. | Present |
| `SDK-LIST-R-012` | Every Task must expose `uiControls.consultTransferDestinations` with ordered `consult` and `transfer` arrays. Order is Agent, Queue, Dial Number, Entry Point after gating: profile `NONE` removes agent/queue/entry point; voice Consult queue requires `allowConsultToQueue`; voice Transfer queue requires inbound direction or outbound plus `interaction.callProcessingDetails.outdialTransferToQueueEnabled === true`; unknown voice direction does not allow queue Transfer; digital exposes only allowed agent/queue categories. | All consumers need the same destination decision out of the box, without reading raw profile flags, interpreting task payload paths, or calling another policy API. | `src/cc.ts`, `src/services/task/TaskFactory.ts`, `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts` | `test/unit/spec/cc.ts`, `test/unit/spec/services/task/TaskFactory.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts` | Consumers may hide an SDK-allowed category for host UX, but cannot enable one the SDK omitted. | Present |
| `SDK-LIST-R-013` | A direct `Task.transfer()` to the public `entryPoint` destination must remain available for eligible voice tasks, translate internally to backend destination type `entrypointDialNumber`, and use `vteamTransfer`; callers continue to pass the selected entry-point identifier and do not perform backend translation. | Entry-point transfer is a supported vteam operation, while sending the public value unchanged through `blindTransfer` selects the wrong backend operation and makes SDK-owned controls advertise a failing action. | `src/services/task/Task.ts`, `src/services/task/constants.ts`, `src/services/task/types.ts` | `test/unit/spec/services/task/Task.ts` | The existing entry-point identifier remains a valid fallback when no analyzer identifier is exposed, matching the established transfer policy. | Present |
| `SDK-LIST-R-014` | The Contact Center sample must treat a present empty Task destination array as an explicit “no destinations” decision by clearing and disabling the selector; only a missing/undefined control uses backward-compatible sample defaults. | An empty SDK policy result must not be replaced with categories the Task explicitly disallowed, while the sample still needs to run against older SDK builds that do not expose the field. | `docs/samples/contact-center/app.js` | Manual sample flow | The sample has no dedicated DOM unit suite. | Present |

## Defect context (when applicable)

- Observed versus expected behavior: widgets and SDK callers could construct different destination requests, the services serialized sort with keys the CMS list API does not consume, and cache eligibility ignored view/shape flags; expected behavior is one SDK-owned default policy and unchanged backend response order.
- Reproduction and environment: issue Consult and Transfer destination requests for the same task media and compare query parameters and results across SDK consumers.
- Regression range or last known good state: unknown; the existing APIs and older query serialization predate the corrected defaults.
- Severity, frequency, and workaround: user-visible whenever eligibility/order differs; consumers could manually duplicate flags, but that perpetuates the ownership defect.
- Diagnostic evidence: `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/utils/PageCache.ts`.

## MODIFIED Requirements

### MOD-001 — Contact Center façade policy (`CONTACT_CENTER-R-003`)

- **WHAT**: Retain the existing `getQueues`, `getEntryPoints`, and `getBuddyAgents` method names. Buddy-agent behavior is action-aware; Queue retains its parameter/full-record response and owns telephony eligibility/views/order, while EntryPoint retains its parameter/response wrapper and owns the profile-scoped dial-number query, row mapping, order, and cache policy.
- **WHY**: A stable public owner prevents every UI consumer from reconstructing eligibility and query details.
- **Evidence:** `src/cc.ts`, `src/types.ts`, `src/index.ts`, `test/unit/spec/cc.ts`.
- **Acceptance:** Façade tests cover Consult, Transfer, and unchanged existing-method delegation; service tests cover default policy, explicit existing-filter overrides, and exact responses.

### MOD-002 — Direct REST list services (`SERVICES-R-002`, `SERVICES-R-007`)

- **WHAT**: Queue, EntryPoint, and AddressBook must serialize CMS sorting as a combined `sort` value and honor explicit compatible caller overrides. Queue must apply its defaults when optional properties are absent or `undefined`, while retaining explicit `false` and empty-filter overrides. Queue and AddressBook default to `name,ASC`; EntryPoint requests profile-scoped `/v3/dial-number` rows with `entryPointName,ASC` and maps them into the established response wrapper while retaining direct HTTP completion/error semantics.
- **WHY**: SDK defaults are effective only when service wire parameters match the backend contract.
- **Evidence:** `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/services/AddressBook.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts`.
- **Acceptance:** Service tests assert Queue/AddressBook `sort=name,ASC`, EntryPoint `sort=entryPointName,ASC`, Queue defaults with undefined optional fields, explicit Queue overrides, required views/mapping fields, and row-for-row EntryPoint mapping.

### MOD-003 — Buddy-agent request contract (`AGENT-R-003`)

- **WHAT**: Preserve the existing `BuddyAgents` options object and correlated request/response contract while allowing its optional `action` field to derive state from `Consult` or `Transfer`. `mediaType` defaults to telephony, and an explicit `state` takes precedence over the action default.
- **WHY**: Eligibility changes must not alter AQM settlement or invent UI-side filtering.
- **Evidence:** `src/cc.ts`, `src/services/agent/index.ts`, `test/unit/spec/cc.ts`, `test/unit/spec/services/agent/index.ts`.
- **Acceptance:** Transfer sends `Available`; Consult sends no state; explicit state callers remain typed and supported.

### MOD-004 — Query-aware cache eligibility (`UTILS-R-001`, `UTILS-R-006`)

- **WHAT**: Treat enabled profile/response-shape flags and non-default sorts as cache-disqualifying inputs. Existing Queue requests bypass cache through their fixed filters/views, EntryPoint makes its profile-scoped requests directly without PageCache, and default `name,ASC` AddressBook pages remain cache-eligible because that ordering is invariant for its base cache key.
- **WHY**: A page keyed only by scope/page/pageSize cannot safely represent query variants, but it can safely represent one invariant default order.
- **Evidence:** `src/utils/PageCache.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`.
- **Acceptance:** Two identical Queue view-filtered or custom-sort calls make two backend requests; EntryPoint always makes the requested backend call; repeated default-sorted AddressBook pagination remains cache-eligible.

### MOD-005 — Direct entry-point transfer routing (`TASK-R-003`, `TASK-R-008`)

- **WHAT**: Keep Entry Point in eligible voice Transfer destination controls. When `Task.transfer()` receives the public `entryPoint` destination, translate it internally to `entrypointDialNumber` and invoke `contact.vteamTransfer`; Queue remains on `vteamTransfer`, while Agent and Dial Number remain on `blindTransfer`.
- **WHY**: Consumers must be able to follow Task controls directly without knowing backend routing values, and supported entry-point transfers must use the same vteam operation as the established transfer policy.
- **Evidence:** `src/services/task/Task.ts`, `src/services/task/constants.ts`, `src/services/task/types.ts`, `test/unit/spec/services/task/Task.ts`.
- **Acceptance:** Task tests assert the exact EPDN vteam payload, no blind-transfer call, and unchanged Queue/Agent dispatch.

## Acceptance criteria

- [x] Transfer buddy lookup sends state `Available`; Consult omits state; action-based media defaults to telephony (`MOD-003`, `SDK-LIST-R-003`).
- [x] Existing `getQueues` sends the default inbound/active/telephony filter, backend name ascending order, desktop-profile, agent, and first-level views without a field projection (`MOD-001`, `MOD-002`, `SDK-LIST-R-001`).
- [x] Queue optional fields set to `undefined` retain safe defaults, while explicit `false` and an explicit empty filter remain overrides (`MOD-002`, `SDK-LIST-R-001`).
- [x] Existing `getEntryPoints` requests desktop-profile-filtered `/v3/dial-number` mappings with required headers, entry-point names, and backend `entryPointName,ASC`, then exposes each dialled number as `EntryPointRecord.number` without changing row order (`SDK-LIST-R-002`, `SDK-LIST-R-007`).
- [x] Caller-supplied existing queue filters override its telephony default; compatible EntryPoint filters/sorts override its v3 mapping defaults while profile scoping remains fixed, and SDK-built entry-point search escapes CMS syntax characters (`SDK-LIST-R-001`, `SDK-LIST-R-002`, `SDK-LIST-R-011`).
- [x] AddressBook sends backend name ascending order by default and honors a caller-supplied descending override (`MOD-002`, `SDK-LIST-R-004`, `SDK-LIST-R-010`).
- [x] Queue, EntryPoint, and AddressBook serialize CMS ordering as the combined `sort` query value (`MOD-002`, `SDK-LIST-R-005`).
- [x] Queue `sortOrder` without `sortBy` serializes as `sort=name,<ORDER>` and bypasses the simple-page cache (`SDK-LIST-R-005`, `SDK-LIST-R-006`).
- [x] Default Queue policy and other view/filter/shape/custom-sort requests bypass PageCache, EntryPoint makes its profile-scoped requests directly, and default-sorted AddressBook pages remain cacheable (`MOD-004`, `SDK-LIST-R-006`).
- [x] No SDK façade or service sorts returned arrays in JavaScript (`SDK-LIST-R-007`).
- [x] Existing queue and entry-point methods retain their response wrappers; `EntryPointRecord` additively types mapped `number` and marks configuration-only fields optional because the v3 mapping response does not provide them (`SDK-LIST-R-008`).
- [x] The Contact Center sample uses the existing Task/list surfaces, labels buddy-agent availability, and displays `EntryPointRecord.number` when present (`SDK-LIST-R-002`, `SDK-LIST-R-008`).
- [x] The Contact Center sample clears and disables its destination selector for a present empty Task destination array, while missing controls retain backward compatibility (`SDK-LIST-R-014`).
- [x] Direct entry-point transfer remains SDK-advertised for eligible voice tasks and is sent through `vteamTransfer` as `entrypointDialNumber`, with no widgets-side translation (`MOD-005`, `SDK-LIST-R-013`).
- [x] The package builds and the complete Contact Center unit and style suites pass (`SDK-LIST-R-008`).

## Scenarios and applicable change views

| Scenario | Actor | Preconditions | Expected behavior | Failure or boundary behavior | Requirements |
| --- | --- | --- | --- | --- | --- |
| Consult buddy agents | SDK consumer | `action=Consult` | Telephony defaults when absent; state is omitted; backend order is preserved. | Request rejection is measured/logged and rethrown. | `SDK-LIST-R-003`, `SDK-LIST-R-007` |
| Transfer buddy agents | SDK consumer | `action=Transfer` | State `Available` is sent for the selected media. | Explicit state and action cannot be combined by the public type. | `SDK-LIST-R-003`, `SDK-LIST-R-008` |
| Queue list | SDK consumer | Existing method called with page/search and optional filter override | SDK applies the default telephony policy and returns full records unchanged; an explicit existing filter overrides eligibility. | HTTP failure is propagated without a synthetic page. | `SDK-LIST-R-001`, `SDK-LIST-R-007`, `SDK-LIST-R-011` |
| Entry-point list | SDK consumer | Existing method called with page/search and optional compatible overrides | SDK fetches desktop-profile dial-number mappings, preserves backend order/meta, and returns `{id, name, number?}` rows through `EntryPointListResponse`. | HTTP failure is propagated without a synthetic page; search characters are escaped before CMS expression construction. | `SDK-LIST-R-002`, `SDK-LIST-R-007`, `SDK-LIST-R-008`, `SDK-LIST-R-009`, `SDK-LIST-R-011` |
| Dial-number list | SDK consumer | AddressBook page/search supplied | AddressBook applies backend `name,ASC` by default and returns the response unchanged. | A custom sort overrides the default and bypasses the default-order cache. | `SDK-LIST-R-010` |
| Specialized list consumer | SDK consumer | Uses an existing list method with explicit parameters | Explicit filter/sort/profile inputs override defaults. | No parallel consult/transfer method or projected response type is required. | `SDK-LIST-R-004`, `SDK-LIST-R-005` |
| Direct entry-point transfer | SDK consumer | Voice Task exposes Entry Point in the Transfer destination array | `Task.transfer({to, destinationType: 'entryPoint'})` sends `{to, destinationType: 'entrypointDialNumber'}` through `vteamTransfer`. | Vteam rejection is measured and rethrown; `blindTransfer` is not invoked. | `SDK-LIST-R-012`, `SDK-LIST-R-013` |
| Sample receives an empty destination array | Sample user | Task exposes the requested action with `[]` | Destination selector is cleared and disabled. | Missing/undefined destination controls use the sample's compatibility defaults. | `SDK-LIST-R-014` |

### Interaction and scenario matrix

| Context or interacting state | Trigger | Expected result | Invalid or conflicting result | Requirements |
| --- | --- | --- | --- | --- |
| Consult + agent | Action request | No state filter | Applying Transfer-only `Available` | `SDK-LIST-R-003` |
| Transfer + agent | Action request | `state=Available` | Returning idle agents through an omitted state filter | `SDK-LIST-R-003` |
| Queue + social media | Existing list request with filter override | Caller supplies `channelType==SOCIAL_CHANNEL` through `filter` | Adding a second media-bearing method signature | `SDK-LIST-R-001`, `SDK-LIST-R-011` |
| View-filtered Queue or profile-scoped EntryPoint | Repeated page request | Backend called for each request | Simple-page cache hit | `SDK-LIST-R-006` |
| Existing Queue or AddressBook | Sort omitted | Backend receives `sort=name,ASC` | Consumer must provide the default itself | `SDK-LIST-R-005`, `SDK-LIST-R-010` |
| Existing EntryPoint | Sort omitted | Backend receives `sort=entryPointName,ASC` and mapped rows remain in that order | Widget sorts or requests the mapping itself | `SDK-LIST-R-002`, `SDK-LIST-R-005`, `SDK-LIST-R-007` |
| Existing Queue, EntryPoint, or AddressBook | Custom sort supplied | Backend receives the requested field/order | SDK overwrites the caller's explicit behavior | `SDK-LIST-R-004`, `SDK-LIST-R-010` |
| Backend result | Response received | Array and metadata returned in backend order | JavaScript `.sort()` or consumer-specific reorder | `SDK-LIST-R-007` |
| Voice Transfer + entry point | Destination selected | SDK maps `entryPoint` to backend `entrypointDialNumber` and calls `vteamTransfer` | Sending `entryPoint` through `blindTransfer` or hiding the supported category | `SDK-LIST-R-013` |
| Sample + present empty controls | Task selection changes | Selector has no options and is disabled | Sample substitutes legacy defaults for an explicit empty array | `SDK-LIST-R-014` |

### API contract delta

| API or operation | Change | Consumer impact | Compatibility expectation | Canonical definition |
| --- | --- | --- | --- | --- |
| Buddy-agent input | Add optional `action` to the existing options object and make `mediaType` optional with a telephony default. | Consumers may pass Consult/Transfer instead of choosing state. | Additive public option; explicit-state callers remain supported and take precedence. | `src/types.ts` |
| Existing queue list | Apply the telephony filter, profile views, and `name,ASC` by default. | Thin clients call `getQueues`; other consumers use existing parameters for overrides. | Intentional default correction; method and response signature unchanged. | `src/cc.ts`, `src/services/Queue.ts` |
| Existing entry-point list | Fetch desktop-profile `/v3/dial-number` mappings with the required organization/internal-data headers, request entry-point names, map fields row-for-row, and use `entryPointName,ASC` by default. | Thin clients call `getEntryPoints` and receive the displayed number without joining another endpoint. | Intentional default correction; method and response wrapper unchanged. | `src/cc.ts`, `src/services/EntryPoint.ts`, `src/services/config/constants.ts`, `src/services/core/WebexRequest.ts` |
| `EntryPointRecord` | Add optional mapped `number`; make configuration-only `type`, `isActive`, and `orgId` optional for truthful mapped-list typing. | Consumers can render the dialled number without a cast and cannot assume absent configuration fields. | Additive field with a type-correctness adjustment; no new response wrapper. | `src/types.ts` |
| Task destination controls | Add ordered `consultTransferDestinations.consult` and `.transfer` arrays to `TaskUIControls`. | Task consumers render availability directly; no separate policy call or raw profile injection is needed. | Additive public field using the existing destination values; no new standalone public alias. | `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts`, `src/index.ts` |
| Existing `Task.transfer` entry-point input | Correct internal transport and backend destination translation. | Consumers keep passing `{to, destinationType: 'entryPoint'}` from the Task control array. | Behavioral bug fix; no method or public payload signature change. | `src/services/task/Task.ts`, `src/services/task/constants.ts` |

### Public API and semver impact

| Export or entry point | Change | Affected consumers | Required version change | Deprecation or migration |
| --- | --- | --- | --- | --- |
| Existing `getQueues` / `getEntryPoints` | Default request behavior changes; signatures do not | Widgets and other SDK consumers | Behavioral semver review | Pass compatible existing filters/sorts when different behavior is required; entry-point profile scoping remains SDK-owned. |
| `BuddyAgents` | Add optional action-based defaults to the existing options object while retaining explicit state | Existing and new consumers | Minor | Existing explicit-state calls remain valid and override action defaults. |
| `TaskUIControls` | Add inline ordered, action-specific destination availability using existing destination values | Task UI consumers | Minor | Read the matching action array; first item is the default category. |
| `Task.transfer` | Route the existing public `entryPoint` value through vteam transfer as backend `entrypointDialNumber` | Existing voice-task consumers | Patch/behavioral correction | No caller migration; backend translation is SDK-owned. |
| `EntryPointRecord` | Add optional mapped `number`; configuration-only fields become optional | Entry-point list consumers | Behavioral/type-contract review | Render `number` when present and handle configuration-only fields as optional. |

### Cross-package impact

| Package | Change | Dependency direction | Release sequencing | Owner |
| --- | --- | --- | --- | --- |
| `@webex/contact-center` | Owns action/default/filter/order/cache policy and Task destination visibility/order decisions. | SDK → consumers | Build/release first. | SDK maintainers |
| `@webex/cc-store` | Delegates entry points directly to the existing SDK method; uses the existing queue `filter` parameter only for a non-telephony active task. | store → SDK | Consume a compatible SDK release. | Widgets maintainers |
| `@webex/cc-task` and `@webex/cc-components` | Supply action and render results. | UI → store → SDK | Release after compatible store/SDK. | Widgets maintainers |

## Contracts delta

**Provides — MODIFIED:** The package keeps the existing queue, entry-point, buddy-agent, and Task transfer methods. Queue retains its established request/full-response signature and telephony defaults; EntryPoint retains its request/response wrapper while mapping desktop-profile dial-number rows to typed `{id, name, number?}` records in backend order; buddy agents accept action-aware input through `BuddyAgents`; `TaskUIControls` exposes inline ordered action-specific destination availability; direct entry-point transfer uses SDK-owned EPDN/vteam translation without changing the public payload.

**Requires — MODIFIED:** Queue, EntryPoint, and AddressBook services require CMS list endpoints to honor the combined sort value. Queue requires its profile/agent/first-level views; EntryPoint requires `/v3/dial-number` to honor the organization/internal-data headers, desktop-profile filtering, `includeEntryPointName`, and mapping attributes. Direct entry-point transfer requires the WCC vteam transfer operation to accept the established `entrypointDialNumber` destination and selected entry-point identifier. The SDK continues to rely on host-authenticated Webex requests and backend response ordering.

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
| Buddy-agent input | Existing options object with optional `action`, `mediaType`, and explicit `state`; explicit state takes precedence | Derive Consult/Transfer eligibility without a parallel public input type. | SDK public type | No credential or persistent data. |
| Queue search input | Existing page, page size, search, filter, sort, and profile parameters | Consumer-controlled pagination plus optional default overrides. | Existing SDK public type | No second media-bearing request type. |
| Queue backend query | Default inbound/active/telephony filter, name ascending, desktop-profile/agent/first-level views, no field projection | Full queue result using the default list policy. | Queue service | Fixed filter/views bypass simple-page caching. |
| Entry-point backend query | `/v3/dial-number`, `X-ORGANIZATION-ID`, `x-ignore-internal-data=false`, `desktopProfileFilter=true`, `includeEntryPointName=true`, required mapping attributes, and `entryPointName,ASC` | Return profile-scoped EP-DN rows with the visible dialled number. | EntryPoint service and shared WebexRequest wrapper | The service does not use PageCache for these profile-scoped requests; caller search is escaped before CMS expression construction. |
| Entry-point response row | `id=entryPointId`, `name=entryPointName`, optional `number=dialledNumber` | Let consumers route by entry-point ID and display the mapped dialled number without a cast or second request. | `EntryPointRecord` public type | Mapping is row-for-row and preserves metadata/order; no new retained data. |
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
| Entry-point configuration records do not contain the visible dialled number, and widget runtime returned no provisional `dbId`. | The backend `/v3/dial-number` contract returns `dialledNumber`, `entryPointId`, and `entryPointName`. | Move the EP-DN request/mapping into existing `getEntryPoints`, type `number`, and keep widget rendering declarative. |
| User search text changes the server-side CMS expression. | `src/services/EntryPoint.ts` builds a multi-field search filter. | Escape backslash, quote, and semicolon and assert the decoded query value in service tests. |

## Error Matrix

| Failure | SDK behavior | Consumer-visible result | Evidence |
| --- | --- | --- | --- |
| Buddy-agent AQM rejection | Record failure context and rethrow. | Promise rejects; no synthetic agent list. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Queue HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/Queue.ts`, `test/unit/spec/services/Queue.ts` |
| Entry-point HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/EntryPoint.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Missing action-based media | Default to telephony. | Valid request with predictable channel. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Non-default queue media eligibility | Consumer supplies a complete allowlisted RSQL value through the existing `filter` field; the SDK performs no media-string interpolation. | Existing queue method returns matching records or propagates the backend error. | `src/services/Queue.ts`, service tests |
| Entry-point search contains CMS syntax characters | Escape the text before embedding it in the multi-field search expression. | Search remains data rather than changing the filter structure. | `src/services/EntryPoint.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Direct entry-point vteam transfer rejection | Preserve existing Task transfer error normalization, failure metrics, and rethrow semantics. | `Task.transfer()` rejects; no fallback blind-transfer request is made. | `src/services/task/Task.ts`, `test/unit/spec/services/task/Task.ts` |

## Resilience

- Existing methods make one delegated list request and add no retry or request fan-out.
- Queue, EntryPoint, and AddressBook callers use compatible explicit existing parameters when they require non-default behavior.
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

- Compatibility: list method names and response wrappers remain unchanged; explicit buddy-agent state remains supported; optional `EntryPointRecord.number` is additive and configuration-only entry-point fields are now optional. Queue/AddressBook request `name,ASC`; EntryPoint requests mapped, profile-scoped `entryPointName,ASC` rows while retaining compatible filter/sort overrides.
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
- The paired widgets feature spec must reference this SDK delta as the owner of queue eligibility/order/profile views and entry-point dial-number mapping/order; widgets delegate entry points without media filtering and may pass a queue filter for an active non-telephony task.
- A future canonical-spec promotion must fold this delta into the routed module specs and reconcile the delta path rather than duplicate the requirements.

## Decision and change log

| Date | Decision or change | Rationale | Owner |
| --- | --- | --- | --- |
| 2026-08-21 | Replaced provisional `dbId` with typed `EntryPointRecord.number` populated from the backend `/v3/dial-number` mapping, and kept the existing `getEntryPoints` method/response wrapper. | Runtime testing showed no `dbId`; the dialled number belongs to the EP-DN mapping, and consumers should not join or reinterpret backend data. | Developer + Codex |
| 2026-08-21 | Made Queue defaults resilient to optional properties explicitly set to `undefined`, retained explicit false/empty overrides, and made the sample honor a present empty destination array. | Common object-building patterns must not silently disable safe SDK defaults, and an explicit Task policy decision must not be replaced by sample fallback categories. | Developer + Codex |
| 2026-08-21 | Superseded the provisional optional `EntryPointRecord.dbId` experiment. | Runtime validation established that the displayed field is `dialledNumber` from the EP-DN mapping, now exposed as `number`. | Developer + Codex |
| 2026-08-20 | Kept Entry Point available for eligible voice transfers and corrected `Task.transfer()` to use vteam routing with internal `entrypointDialNumber` translation. | The backend transfer policy supports direct entry-point transfer; hiding it would remove valid functionality, while consumers should not know the backend EPDN literal. | Developer + Codex |
| 2026-08-19 | Kept action/media typing inside `BuddyAgents`, inlined the destination arrays on `TaskUIControls`, removed the new root aliases, and removed `dbId` additions from queue/entry-point records. | The established methods and types already express the required behavior; consumers do not need standalone aliases or an unused record field. | Developer + Codex |
| 2026-08-19 | Approved this exact MODIFIED delta path. | Preserve protected canonical specs while maintaining spec-currency with the implementation. | Developer |
| 2026-08-19 | Assigned all reusable eligibility, query, ordering, and cache decisions to the SDK. | Keep widgets thin and prevent cross-consumer behavior drift. | Developer + Codex |
| 2026-08-19 | Made backend response order authoritative and prohibited SDK-side JavaScript sorting. | One backend ordering decision must reach every consumer unchanged. | Developer + Codex |
| 2026-08-19 | Moved EntryPoint and AddressBook `name,ASC` ordering to service defaults and removed the specialized dial-number façade. | Widgets must work without supplying SDK-owned decisions; other consumers can pass explicit sort overrides. | Developer + Codex |
| 2026-08-19 | Removed the specialized queue/entry-point methods and destination response/options types and kept default policy on existing `getQueues`/`getEntryPoints` with existing overrides. | Consumers should keep established method signatures; a parallel list abstraction adds needless public surface and projection complexity. The later EP-DN correction retained the response wrapper while mapping truthful fields. | Developer + Codex |
| 2026-08-19 | Put ordered Consult/Transfer destination availability directly on every Task's `uiControls` instead of adding `getConsultTransferDestinationPolicy`. | The Task already owns UI decisions and live interaction data, so consumers should not make a second request or reproduce profile/media/direction rules. | Developer + Codex |
