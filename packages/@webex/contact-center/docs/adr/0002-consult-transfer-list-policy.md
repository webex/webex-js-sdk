---
type: ADR
title: ADR-0002 - Consult and transfer list policy
description: The SDK owns the default consult and transfer destination policy (eligibility, request shaping, backend ordering, cache safety, and Task destination controls) on its existing list and transfer methods.
tags: [adr]
timestamp: 2026-08-19T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T00:00:00Z
validation_status: blocked
-->

# ADR-0002 - Consult and transfer list policy

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-08-19 |
| Deciders      | Contact Center SDK maintainers (developer-approved, 2026-08-19) |
| Supersedes    | N/A |
| Superseded by | N/A |

Related context: [package architecture](../architecture.md) · [specification registry](../specs/README.md) ·
[package agent instructions](../../AGENTS.md) · [ADR index](index.md)

## Context

This document owns the reusable consult/transfer destination-list policy. The SDK applies default telephony eligibility, ordering, profile views, and cache safety through the existing list methods; consumers use compatible existing parameters only when they need a different filter or sort.

This decision was raised as feature key `CAI-8354`, work type Defect, change class Contract, from a
developer-approved consult/transfer behavior review; the paired change in the Webex widgets repository
consumes it.

Consult/transfer list decisions were split across the SDK and widgets. Generic SDK query types exposed low-level request choices, while widgets always restricted buddy agents to Available, filtered queues after fetching them, rebuilt pagination metadata, and could independently affect presentation order. That produced inconsistent behavior between consumers.

The goal is to make the SDK the single owner of the default consult/transfer policy without adding parallel list methods or response signatures. The existing Queue method returns eligible full records, while the existing EntryPoint method maps profile-scoped dial-number rows to the established response wrapper. Queue, EntryPoint, and AddressBook request backend ordering, buddy-agent behavior is action-aware, CMS sort syntax is serialized correctly, and query variants that change results cannot reuse an incompatible cached page. Consumers render the response order and metadata without a second sort or filter.

### Defect context

- Observed versus expected behavior: widgets and SDK callers could construct different destination requests, the services serialized sort with keys the CMS list API does not consume, and cache eligibility ignored view/shape flags; expected behavior is one SDK-owned default policy and unchanged backend response order.
- Reproduction and environment: issue Consult and Transfer destination requests for the same task media and compare query parameters and results across SDK consumers.
- Regression range or last known good state: unknown; the existing APIs and older query serialization predate the corrected defaults.
- Severity, frequency, and workaround: user-visible whenever eligibility/order differs; consumers could manually duplicate flags, but that perpetuates the ownership defect.
- Diagnostic evidence: `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts`, `src/utils/PageCache.ts`.

### Stakeholders

| Stakeholder | Need or decision | Status |
| --- | --- | --- |
| Contact Center agents | Destination eligibility and order are consistent across consumers. | Decided |
| SDK consumers | Reusable defaults without duplicating backend query knowledge. | Decided |
| Widget maintainers | Thin calls that pass only UI/runtime context. | Decided in the paired widgets delta |
| SDK maintainers | Existing list APIs remain the only queue and entry-point public methods; existing parameters provide overrides. | Decided |

There are no open product decisions for this delta.

### Prior work and evidence

| Source | What it establishes | Decision or disposition |
| --- | --- | --- |
| `src/cc.ts` | The public façade keeps the established list method names/signatures and owns buddy-agent action policy. | Used |
| `src/types.ts`, `src/index.ts` | Existing queue/entry-point request and response types remain the public list contracts; entry-point rows expose the mapped dialled number as optional `number`. | Used |
| `src/services/Queue.ts` | The existing Queue path owns default query serialization and view flags. | Used |
| `src/services/EntryPoint.ts` | The existing EntryPoint path owns the desktop-profile dial-number query, field mapping, and backend ordering. | Used |
| `src/services/core/WebexRequest.ts` | The shared request wrapper forwards optional per-request headers needed by the dial-number endpoint while leaving other requests unchanged. | Used |
| `src/services/AddressBook.ts` | AddressBook owns its backend ordering default and caller override. | Used |
| `src/utils/PageCache.ts` | Cache eligibility must include every result- or shape-changing query option. | Used |
| `test/unit/spec/cc.ts` | Action mapping and thin delegation through the existing list methods are asserted. | Used |
| `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` | Default policy, existing-parameter overrides, CMS sort serialization, view flags, and cache behavior are asserted. | Used |
| `src/services/task/state-machine/uiControlsComputer.ts`, `src/services/task/types.ts` | Task UI controls are the existing SDK-owned decision surface and can carry ordered destination availability. | Used |
| `test/unit/spec/services/task/state-machine/uiControlsComputer.ts`, `test/unit/spec/services/task/TaskFactory.ts` | Profile/media/direction gating, outbound flag path, ordering, and factory propagation are asserted. | Used |
| `src/services/task/Task.ts`, `src/services/task/constants.ts`, `test/unit/spec/services/task/Task.ts` | Direct entry-point transfer routing is translated to the backend EPDN value and sent through the vteam transfer path. | Used |
| The workspace sample docs/samples/contact-center/app.js (outside this package) | The sample renders buddy-agent state labels and mapped entry-point numbers while using the existing list methods and Task destination controls. | Used |

## Decision

The SDK is the single owner of the default consult/transfer destination policy, applied through the
existing `getBuddyAgents`, `getQueues`, `getEntryPoints`, AddressBook, and `Task.transfer()` surfaces
and through `TaskUIControls.consultTransferDestinations`.

**In scope:**

- Put consult/transfer defaults on the existing queue and entry-point list methods.
- Map Consult versus Transfer to the correct buddy-agent state behavior.
- Default omitted buddy-agent and queue media context to telephony.
- Retain the existing queue/entry-point parameter and response wrappers; keep full Queue records, map EntryPoint dial-number rows to truthful `EntryPointRecord` fields, and retain compatible filter/sort overrides without exposing the fixed entry-point profile-scoping flag.
- Default EntryPoint requests to backend `entryPointName,ASC` and AddressBook requests to `name,ASC` while allowing callers to pass another `sortBy`/`sortOrder` pair.
- Serialize CMS ordering as `sort=FIELD,ORDER` (for example `sort=name,ASC`).
- Bypass the base pagination cache for every filter/view/shape flag that changes a result.
- Keep the existing queue and entry-point method signatures and preserve explicit buddy-agent state callers.
- Compute ordered, action-specific destination availability once on each Task and expose it through `TaskUIControls`, using Desktop Profile access, media, direction, and outbound queue-transfer capability.
- Keep direct Entry Point available for eligible voice transfers and translate its public destination type to the backend EPDN value inside `Task.transfer()`.

**Out of scope:**

- Client-side sorting of agents, queues, or entry points.
- Changing backend order after a response is received.
- Adding parallel queue/entry-point APIs or projected destination response types.
- Changing generic queue ordering, address-book projection, events, authentication, retries, or metrics taxonomy.
- Adding a feature flag, data migration, commit, publication, or push.
- Adding a separate destination-policy fetch method that Task consumers must call before rendering.

### Decision rules and owning requirements

Each decision rule keeps its `SDK-LIST-R-*` identifier; the behavior is specified by the module
requirement it links, which is authoritative.

| Decision rule | Rule | Owning module requirement | Test evidence |
| --- | --- | --- | --- |
| `SDK-LIST-R-001` | `getQueues` defaults to inbound, active, telephony queues in backend `name,ASC` order with the desktop-profile, agent, and first-level views; optional fields set to `undefined` keep the defaults, while explicit `false` and an explicit empty filter override them | [SERVICES-R-007](../../src/services/docs/README.md) | `test/unit/spec/services/Queue.ts`, `test/unit/spec/cc.ts` |
| `SDK-LIST-R-002` | `getEntryPoints` maps profile-scoped `/v3/dial-number` rows to `{id, name, number?}` in backend `entryPointName,ASC` order | [SERVICES-R-007](../../src/services/docs/README.md) | `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/core/WebexRequest.ts` |
| `SDK-LIST-R-003` | Buddy agents: Transfer adds `Available`, Consult sends no state, media defaults to telephony, an explicit `state` wins | [AGENT-R-009](../../src/services/agent/docs/README.md) | `test/unit/spec/cc.ts` |
| `SDK-LIST-R-004` | Existing parameters (buddy-agent `state`, queue, entry-point, and address-book filters and sorts) override the defaults | [SERVICES-R-007](../../src/services/docs/README.md), [SERVICES-R-016](../../src/services/docs/README.md), [AGENT-R-009](../../src/services/agent/docs/README.md) | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts` |
| `SDK-LIST-R-005` | Ordering is sent as one combined CMS `sort` value, never as separate `sortBy`/`sortOrder` keys | [SERVICES-R-007](../../src/services/docs/README.md), [SERVICES-R-016](../../src/services/docs/README.md) | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/AddressBook.ts` |
| `SDK-LIST-R-006` | Only simple pagination may use the page cache | [UTILS-R-001](../../src/utils/docs/README.md) | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/AddressBook.ts` |
| `SDK-LIST-R-007` | No JavaScript sort or reorder of list responses | This ADR, Constraint on future changes | `test/unit/spec/services/EntryPoint.ts` |
| `SDK-LIST-R-008` | Typing stays on `BuddyAgents`, `TaskUIControls`, and `EntryPointRecord` (optional `number`) with no one-off aliases | [CONTACT_CENTER-R-003](../../src/docs/README.md), [TASK_STATE_MACHINE-R-004](../../src/services/task/state-machine/docs/README.md) | `test/unit/spec/services/task/state-machine/uiControlsComputer.ts` |
| `SDK-LIST-R-009` | Failures reject with the existing measured and logged errors; no synthetic list | This ADR, Failure behavior | `test/unit/spec/cc.ts` |
| `SDK-LIST-R-010` | AddressBook defaults to `name,ASC` and accepts caller sorts | [SERVICES-R-016](../../src/services/docs/README.md) | `test/unit/spec/services/AddressBook.ts` |
| `SDK-LIST-R-011` | Non-default queue media goes through the existing `filter` parameter; the SDK never interpolates a media string | [SERVICES-R-007](../../src/services/docs/README.md) | `test/unit/spec/services/Queue.ts` |
| `SDK-LIST-R-012` | Every Task exposes ordered `consult` and `transfer` destination arrays | [TASK-R-009](../../src/services/task/docs/README.md), [TASK_STATE_MACHINE-R-004](../../src/services/task/state-machine/docs/README.md) | `test/unit/spec/services/task/TaskFactory.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts` |
| `SDK-LIST-R-013` | `Task.transfer()` sends a public `entryPoint` destination as `entrypointDialNumber` through `vteamTransfer` | [Task spec](../../src/services/task/docs/README.md) `transfer` | `test/unit/spec/services/task/Task.ts` |
| `SDK-LIST-R-014` | The Contact Center sample treats a present empty destination array as no destinations | This ADR (the sample is outside the package) | Manual sample flow |

### Contract changes

| API or operation | Change | Consumer impact | Compatibility expectation | Canonical definition |
| --- | --- | --- | --- | --- |
| Buddy-agent input | Add optional `action` to the existing options object and make `mediaType` optional with a telephony default. | Consumers may pass Consult/Transfer instead of choosing state. | Additive public option; explicit-state callers remain supported and take precedence. | `src/types.ts` |
| Existing queue list | Apply the telephony filter, profile views, and `name,ASC` by default. | Thin clients call `getQueues`; other consumers use existing parameters for overrides. | Intentional default correction; method and response signature unchanged. | `src/cc.ts`, `src/services/Queue.ts` |
| Existing entry-point list | Fetch desktop-profile `/v3/dial-number` mappings with the required organization/internal-data headers, request entry-point names, map fields row-for-row, and use `entryPointName,ASC` by default. | Thin clients call `getEntryPoints` and receive the displayed number without joining another endpoint. | Intentional default correction; method and response wrapper unchanged. | `src/cc.ts`, `src/services/EntryPoint.ts`, `src/services/config/constants.ts`, `src/services/core/WebexRequest.ts` |
| `EntryPointRecord` | Add optional mapped `number`; make configuration-only `type`, `isActive`, and `orgId` optional for truthful mapped-list typing. | Consumers can render the dialled number without a cast and cannot assume absent configuration fields. | Additive field with a type-correctness adjustment; no new response wrapper. | `src/types.ts` |
| Task destination controls | Add ordered `consultTransferDestinations.consult` and `.transfer` arrays to `TaskUIControls`. | Task consumers render availability directly; no separate policy call or raw profile injection is needed. | Additive public field using the existing destination values; no new standalone public alias. | `src/services/task/types.ts`, `src/services/task/state-machine/uiControlsComputer.ts`, `src/index.ts` |
| Existing `Task.transfer` entry-point input | Correct internal transport and backend destination translation. | Consumers keep passing `{to, destinationType: 'entryPoint'}` from the Task control array. | Behavioral bug fix; no method or public payload signature change. | `src/services/task/Task.ts`, `src/services/task/constants.ts` |

**Provides — MODIFIED:** The package keeps the existing queue, entry-point, buddy-agent, and Task transfer methods. Queue retains its established request/full-response signature and telephony defaults; EntryPoint retains its request/response wrapper while mapping desktop-profile dial-number rows to typed `{id, name, number?}` records in backend order; buddy agents accept action-aware input through `BuddyAgents`; `TaskUIControls` exposes inline ordered action-specific destination availability; direct entry-point transfer uses SDK-owned EPDN/vteam translation without changing the public payload.

**Requires — MODIFIED:** Queue, EntryPoint, and AddressBook services require CMS list endpoints to honor the combined sort value. Queue requires its profile/agent/first-level views; EntryPoint requires `/v3/dial-number` to honor the organization/internal-data headers, desktop-profile filtering, `includeEntryPointName`, and mapping attributes. Direct entry-point transfer requires the WCC vteam transfer operation to accept the established `entrypointDialNumber` destination and selected entry-point identifier. The SDK continues to rely on host-authenticated Webex requests and backend response ordering.

No event contract changes.

| Entity or payload | Requested field or shape | Purpose | Ownership | Privacy, retention, or compatibility constraint |
| --- | --- | --- | --- | --- |
| Buddy-agent input | Existing options object with optional `action`, `mediaType`, and explicit `state`; explicit state takes precedence | Derive Consult/Transfer eligibility without a parallel public input type. | SDK public type | No credential or persistent data. |
| Queue search input | Existing page, page size, search, filter, sort, and profile parameters | Consumer-controlled pagination plus optional default overrides. | Existing SDK public type | No second media-bearing request type. |
| Queue backend query | Default inbound/active/telephony filter, name ascending, desktop-profile/agent/first-level views, and no field projection | Full queue result using the default list policy. | Queue service | Fixed filter/views bypass simple-page caching. |
| Entry-point backend query | `/v3/dial-number`, `X-ORGANIZATION-ID`, `x-ignore-internal-data=false`, `desktopProfileFilter=true`, `includeEntryPointName=true`, required mapping attributes, and `entryPointName,ASC` | Return profile-scoped EP-DN rows with the visible dialled number. | EntryPoint service and shared WebexRequest wrapper | The service does not use PageCache for these profile-scoped requests. |
| Entry-point response row | `id=entryPointId`, `name=entryPointName`, optional `number=dialledNumber` | Let consumers route by entry-point ID and display the mapped dialled number without a cast or second request. | `EntryPointRecord` public type | Mapping preserves response order and pagination metadata. |
| Direct entry-point transfer payload | Caller-selected `to`; public `entryPoint` translated internally to `entrypointDialNumber` | Invoke the supported vteam transfer operation without consumer-side backend knowledge. | Task service | Translation is transport-only; metrics retain the caller-facing destination type and no new public field is required. |
| AddressBook backend query | Existing caller-selected fields plus name ascending by default | Backend-ordered dial numbers without a specialized façade. | AddressBook service | A non-default sort bypasses the default-order cache. |

### Scenarios and interactions

| Scenario | Actor | Preconditions | Expected behavior | Failure or boundary behavior | Requirements |
| --- | --- | --- | --- | --- | --- |
| Consult buddy agents | SDK consumer | `action=Consult` | Telephony defaults when absent; state is omitted; backend order is preserved. | Request rejection is measured/logged and rethrown; applying the Transfer-only `Available` filter is invalid. | `SDK-LIST-R-003`, `SDK-LIST-R-007` |
| Transfer buddy agents | SDK consumer | `action=Transfer` | State `Available` is sent for the selected media. | An explicit `state` takes precedence over `action` when both are supplied; an omitted state filter would return idle agents. | `SDK-LIST-R-003`, `SDK-LIST-R-008` |
| Queue list | SDK consumer | Existing method called with page/search and optional filter override | SDK applies the default telephony policy and returns full records unchanged; an explicit existing filter overrides eligibility, for example `channelType==SOCIAL_CHANNEL`. | HTTP failure is propagated without a synthetic page; repeated view-filtered calls reach the backend, never a simple-page cache hit; no second media-bearing method signature. | `SDK-LIST-R-001`, `SDK-LIST-R-006`, `SDK-LIST-R-007`, `SDK-LIST-R-011` |
| Entry-point list | SDK consumer | Existing method called with page/search and optional compatible overrides | SDK fetches desktop-profile dial-number mappings with backend `sort=entryPointName,ASC`, preserves backend order/meta, and returns `{id, name, number?}` rows through `EntryPointListResponse`. | HTTP failure is propagated without a synthetic page; the widget neither sorts nor requests the mapping itself. | `SDK-LIST-R-002`, `SDK-LIST-R-007`, `SDK-LIST-R-008`, `SDK-LIST-R-009` |
| Dial-number list | SDK consumer | AddressBook page/search supplied | AddressBook applies backend `name,ASC` by default and returns the response unchanged. | A custom sort overrides the default and bypasses the default-order cache; the consumer never has to supply the default itself. | `SDK-LIST-R-010` |
| Specialized list consumer | SDK consumer | Uses an existing list method with explicit parameters | Explicit filter/sort/profile inputs override defaults; the backend receives the requested field/order and returns arrays and metadata in backend order. | No parallel consult/transfer method or projected response type is required; the SDK never overwrites the caller's explicit behavior or applies a JavaScript `.sort()`. | `SDK-LIST-R-004`, `SDK-LIST-R-005`, `SDK-LIST-R-007` |
| Direct entry-point transfer | SDK consumer | Voice Task exposes Entry Point in the Transfer destination array | `Task.transfer({to, destinationType: 'entryPoint'})` sends `{to, destinationType: 'entrypointDialNumber'}` through `vteamTransfer`. | Vteam rejection is measured and rethrown; `blindTransfer` is not invoked and the category is not hidden. | `SDK-LIST-R-012`, `SDK-LIST-R-013` |
| Sample receives an empty destination array | Sample user | Task exposes the requested action with `[]` | Destination selector is cleared and disabled. | Missing/undefined destination controls use the sample's compatibility defaults; legacy defaults never replace an explicit empty array. | `SDK-LIST-R-014` |

### Failure behavior

| Failure | SDK behavior | Consumer-visible result | Evidence |
| --- | --- | --- | --- |
| Buddy-agent AQM rejection | Record failure context and rethrow. | Promise rejects; no synthetic agent list. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Queue HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/Queue.ts`, `test/unit/spec/services/Queue.ts` |
| Entry-point HTTP rejection | Service metrics/logging remain active and the error propagates. | Promise rejects; no synthetic paginated result. | `src/services/EntryPoint.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Missing action-based media | Default to telephony. | Valid request with predictable channel. | `src/cc.ts`, `test/unit/spec/cc.ts` |
| Non-default queue media eligibility | Consumer supplies a complete allowlisted RSQL value through the existing `filter` field; the SDK performs no media-string interpolation. | Existing queue method returns matching records or propagates the backend error. | `src/services/Queue.ts`, service tests |
| Direct entry-point vteam transfer rejection | Preserve existing Task transfer error normalization, failure metrics, and rethrow semantics. | `Task.transfer()` rejects; no fallback blind-transfer request is made. | `src/services/task/Task.ts`, `test/unit/spec/services/task/Task.ts` |

- Existing methods make one delegated list request and add no retry or request fan-out.
- Queue, EntryPoint, and AddressBook callers use compatible explicit existing parameters when they require non-default behavior.
- View/filter/shape queries bypass cache rather than risk stale or cross-policy results.
- Errors remain caller-visible; the SDK does not manufacture an empty success response.

## Why

Backend-requested order and one SDK-owned eligibility decision reach every consumer unchanged, while
consumers with another need keep an explicit override through the parameters the methods already
accept. The decision log records the rationale for each step of the decision:

| Date | Decision or change | Rationale | Owner |
| --- | --- | --- | --- |
| 2026-08-21 | Replaced provisional `dbId` with typed `EntryPointRecord.number` populated from the backend `/v3/dial-number` mapping, and kept the existing `getEntryPoints` method/response wrapper. | Runtime testing showed no `dbId`; the dialled number belongs to the EP-DN mapping, and consumers should not join or reinterpret backend data. | Developer + Codex |
| 2026-08-21 | Made Queue defaults resilient to optional properties explicitly set to `undefined`, retained explicit false/empty overrides, and made the sample honor a present empty destination array. | Common object-building patterns must not silently disable safe SDK defaults, and an explicit Task policy decision must not be replaced by sample fallback categories. | Developer + Codex |
| 2026-08-20 | Kept Entry Point available for eligible voice transfers and corrected `Task.transfer()` to use vteam routing with internal `entrypointDialNumber` translation. | The backend transfer policy supports direct entry-point transfer; hiding it would remove valid functionality, while consumers should not know the backend EPDN literal. | Developer + Codex |
| 2026-08-19 | Kept action/media typing inside `BuddyAgents`, inlined the destination arrays on `TaskUIControls`, removed the new root aliases, and removed `dbId` additions from queue/entry-point records. | The established methods and types already express the required behavior; consumers do not need standalone aliases or an unused record field. | Developer + Codex |
| 2026-08-19 | Assigned all reusable eligibility, query, ordering, and cache decisions to the SDK. | Keep widgets thin and prevent cross-consumer behavior drift. | Developer + Codex |
| 2026-08-19 | Made backend response order authoritative and prohibited SDK-side JavaScript sorting. | One backend ordering decision must reach every consumer unchanged. | Developer + Codex |
| 2026-08-19 | Moved EntryPoint and AddressBook `name,ASC` ordering to service defaults and removed the specialized dial-number façade. | Widgets must work without supplying SDK-owned decisions; other consumers can pass explicit sort overrides. | Developer + Codex |
| 2026-08-19 | Removed the specialized queue/entry-point methods and destination response/options types and kept default policy on existing `getQueues`/`getEntryPoints` with existing overrides. | Consumers should keep established method signatures; a parallel list abstraction adds needless public surface and projection complexity. The later EP-DN correction retained the response wrapper while mapping truthful fields. | Developer + Codex |
| 2026-08-19 | Put ordered Consult/Transfer destination availability directly on every Task's `uiControls` instead of adding `getConsultTransferDestinationPolicy`. | The Task already owns UI decisions and live interaction data, so consumers should not make a second request or reproduce profile/media/direction rules. | Developer + Codex |

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Keep consult/transfer filtering, pagination rebuilding, and ordering in the widgets | It is the defect being fixed; see the 2026-08-19 log row that assigns the decisions to the SDK |
| Add specialized queue and entry-point methods with projected destination types | See the 2026-08-19 log row that removed them |
| Sort agents, queues, or entry points in JavaScript | See the 2026-08-19 log row that made backend order authoritative |
| Add `getConsultTransferDestinationPolicy` | See the 2026-08-19 log row that put the destinations on `uiControls` |
| Expose a provisional `EntryPointRecord.dbId` | See the 2026-08-21 log row that introduced `number` |
| Hide Entry Point from voice Transfer controls | See the 2026-08-20 log row on entry-point transfer |

## Consequences

**Positive:**

- Consumers call the existing list methods and read `uiControls.consultTransferDestinations` without
  reproducing profile, media, direction, eligibility, or ordering rules.
- Query variants can no longer reuse a cached page created under a different view.
- Direct entry-point transfer works from the Task control array without consumer-side backend values.

**Negative / tradeoffs:**

- The default request behavior of `getQueues`, `getEntryPoints`, and the AddressBook list changed
  without a signature change, so generic callers needing the old behavior must pass explicit overrides.
- Default Queue calls always bypass the simple-page cache, and profile-scoped EntryPoint requests are
  never cached, so repeated calls reach the backend.

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

| Repository or module | Impact | Owner |
| --- | --- | --- |
| `src` | Public façade and exports | SDK maintainers |
| `src/services` | Queue/EntryPoint/AddressBook wire query construction | SDK maintainers |
| `src/services/agent` | Existing correlated buddy-agent operation receives façade-derived state | SDK maintainers |
| `src/services/task` | Direct entry-point transfer dispatch and backend destination translation | SDK maintainers |
| `src/utils` | Cache eligibility for query variants | SDK maintainers |
| Webex widgets repository | Thin consumer of the new defaults | Widgets maintainers |

The current behavior is specified in the owning module specifications: the façade policy in the
[Contact Center plugin spec](../../src/docs/README.md), the Queue, EntryPoint, and AddressBook wire
queries in the [Services spec](../../src/services/docs/README.md), the buddy-agent request in the
[Agent spec](../../src/services/agent/docs/README.md), cache eligibility in the
[Utils spec](../../src/utils/docs/README.md), direct entry-point transfer in the
[Task spec](../../src/services/task/docs/README.md), and the destination controls in the
[Task state machine spec](../../src/services/task/state-machine/docs/README.md).

### Risks and mitigations

| Risk or assumption | Evidence | Mitigation or decision owner |
| --- | --- | --- |
| CMS ignores ordering when encoded as legacy separate keys. | `src/services/Queue.ts`, `src/services/EntryPoint.ts` | Use and test combined `sort=FIELD,ORDER` (for example `sort=name,ASC`) serialization. |
| Simple cache returns a page created under a different view. | `src/utils/PageCache.ts` | Make every result/shape flag cache-disqualifying and retain repeated-call tests. |
| New EntryPoint/AddressBook ordering defaults affect generic callers. | `src/services/EntryPoint.ts`, `src/services/AddressBook.ts` | Make the correction explicit, retain caller overrides, and test both default and custom order. |
| A consumer re-sorts backend results. | `test/unit/spec/cc.ts` | Return the delegated response unchanged and document backend order as authoritative. |
| Direct entry-point transfer is sent to the blind-transfer operation or with the public destination literal. | `src/services/task/Task.ts`, established transfer-policy behavior | Route through `vteamTransfer`, translate to `entrypointDialNumber`, and assert the exact payload. |
| Entry-point configuration records do not contain the visible dialled number, and widget runtime returned no provisional `dbId`. | The backend /v3/dial-number contract returns dialledNumber, entryPointId, and entryPointName. | Move the EP-DN request/mapping into existing `getEntryPoints`, type `number`, and keep widget rendering declarative. |

### Observability, operations, and migration

- Existing buddy-agent success/failure metrics retain media and derived state context plus count, without logging agent identities.
- Existing Queue and EntryPoint request/success/failure metrics continue to cover the default and overridden calls.
- Existing Task transfer success/failure metrics continue to report the caller-facing entry-point destination while transport uses the backend EPDN value.
- No new metric taxonomy, PII-bearing log, credential log, trace, or alert is introduced.

- Build and run the complete Contact Center unit suite and style check before publishing.
- Release the SDK before or with widgets that require the corrected existing-method defaults and Task controls.
- Rollback is a coordinated package-version/code rollback; no persisted state, schema, or cache migration is required.

- Compatibility: list method names and response wrappers remain unchanged; explicit buddy-agent state remains supported; optional `EntryPointRecord.number` is additive and configuration-only entry-point fields are now optional. Queue/AddressBook request `name,ASC`; EntryPoint requests mapped, profile-scoped `entryPointName,ASC` rows while retaining compatible filter/sort overrides.
- Data or consumer transition: thin consumers continue using `getQueues` and `getEntryPoints`; consumers needing different behavior pass existing query overrides.
- Coexistence period: no parallel list surface exists.
- Completion and rollback outcome: consumers no longer own the default consult/transfer policy; rollback restores prior calls without data cleanup.

| Signal or support surface | Required change | Consumer or operator | Acceptance evidence |
| --- | --- | --- | --- |
| Buddy-agent operational metrics | Report derived action state and media without identities. | SDK maintainers | `test/unit/spec/cc.ts` |
| Queue request metrics/logs | Preserve existing request success/failure coverage for default and overridden calls. | SDK maintainers | `test/unit/spec/services/Queue.ts` |
| Entry-point request metrics/logs | Preserve existing request success/failure coverage for default and overridden calls. | SDK maintainers | `test/unit/spec/services/EntryPoint.ts` |

### Acceptance evidence

The test evidence for each decision rule is in the decision-rule table under Decision. The success
and guardrail metrics are:

| Metric | Baseline | Target | Measurement source |
| --- | --- | --- | --- |
| Consumers that must recreate the default queue/entry-point policy | Widgets did | 0 for ordinary existing-method calls | `src/services/Queue.ts`, `src/services/EntryPoint.ts` |
| JavaScript-side destination sorts in the changed SDK path | 0 | 0 | `src/cc.ts`, `src/services/Queue.ts`, `src/services/EntryPoint.ts` |
| Cache hits for view/filter/shape query variants | Possible | 0 | `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts` |
| Contact Center unit failures | Unknown before change | 0 | All suites under test/unit/spec |
| Contact Center build/style errors | Unknown before change | 0 | Package build and style commands |

## Constraint on future changes

While this decision is active, keep the policy on the existing methods: do not add parallel
consult/transfer list methods or projected response types, do not sort or reorder list responses in
JavaScript, keep every result- or shape-changing query option cache-disqualifying in `PageCache`, keep
desktop-profile scoping of entry points SDK-owned, keep the `entryPoint` to `entrypointDialNumber`
translation inside `Task.transfer()`, and keep `consultTransferDestinations` ordered Agent, Queue, Dial
Number, Entry Point with the first item as the consumer default.

## Follow-up

- The paired widgets feature spec must reference this SDK delta as the owner of queue eligibility/order/profile views and entry-point dial-number mapping/order; widgets delegate entry points without media filtering and may pass a queue filter for an active non-telephony task.

## Revisit when

- The CMS list APIs or `/v3/dial-number` change how they honor the combined `sort` value, the
  desktop-profile views, or `includeEntryPointName`.
- The WCC vteam transfer operation stops accepting `entrypointDialNumber`.
- A consumer needs a destination category or order that the Task controls cannot express.

## References

- `src/cc.ts`
- `src/types.ts`
- `src/services/Queue.ts`
- `src/services/EntryPoint.ts`
- `src/services/AddressBook.ts`
- `src/utils/PageCache.ts`
- `src/services/task/Task.ts`
- `src/services/task/state-machine/uiControlsComputer.ts`
- `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`,
  `test/unit/spec/services/AddressBook.ts`, `test/unit/spec/cc.ts`,
  `test/unit/spec/services/task/Task.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts`
- The workspace sample docs/samples/contact-center/app.js (outside this package)
