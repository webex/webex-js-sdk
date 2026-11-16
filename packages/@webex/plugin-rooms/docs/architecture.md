---
type: Architecture
title: '@webex/plugin-rooms architecture'
description: Package-wide boundaries, resources, interactions, dependencies, and cross-cutting architecture.
tags: [architecture]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: architecture@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T17:06:43Z
validation_status: pass-with-warnings
-->

# @webex/plugin-rooms architecture

Canonical architecture for this package. Flow behavior lives in the
[Rooms plugin specification](../src/docs/README.md). This page owns package boundaries, the plugin
registration, the contract index, and how the package meets the rest of the SDK.

Related context: [specification registry](specs/README.md) ·
[package agent instructions](../AGENTS.md)

## Applicability

| Condition ID                         | Status     | Evidence or reason | Owned section |
| ------------------------------------ | ---------- | ------------------ | ------------- |
| `repo.owns_datastore`                | N/A        | No database, file store, or migration in `src/rooms.js` | Repository data and schema |
| `repo.holds_client_state`            | N/A        | `src/rooms.js` caches no room record; the stored event envelope is described in the module specification | Client state model |
| `repo.components_interact`           | Applicable | `src/index.js` registers the conversation and Mercury plugins that `src/rooms.js` calls | Dependency and interaction topology |
| `repo.domain_data_across_components` | Applicable | Room records, read status, and room events pass from Hydra, the conversation service, and Mercury through `src/rooms.js` to callers | Object and data ownership |
| `repo.caches_data`                   | N/A        | Nothing is kept after a call settles in `src/rooms.js` | Caching catalog |
| `repo.observability_convention`      | N/A        | One error log line and debug trace lines in `src/rooms.js`; no metric or trace convention | Observability patterns |
| `repo.deploys_to_infra`              | N/A        | Library published to npm (`package.json`). No service runtime | Runtime and infrastructure |
| `repo.shared_base_libs`              | Applicable | Extends WebexPlugin and uses the legacy build and lint stack (`babel.config.js`, `.eslintrc.js`) | Shared and base libraries |
| `repo.is_monorepo`                   | N/A        | This SDD root is one package. The workspace around it is out of scope | Package map and inter-package dependencies |
| `repo.multi_platform`                | N/A        | `src/rooms.js` has no platform branch; `process` declares {browser: true} and is not imported | Platform matrix |
| `repo.published_package`             | Applicable | `package.json` name is @webex/plugin-rooms and deploy:npm publishes it | Release and versioning |
| `repo.embedded_in_host`              | N/A        | No host theme or embed API in `src/rooms.js` | Host integration and theming |
| `repo.exposes_commands_or_artifacts` | Applicable | build:src in `package.json` writes dist | Commands and generated artifacts |
| `repo.cross_repo_deps_material`      | Applicable | Behavior depends on the Webex REST API rooms resource, the conversation service, and the Mercury socket (`src/rooms.js`) | Cross-repository topology |
| `repo.security_arch_warranted`       | Applicable | `listen()` needs the spark:all and spark:kms scopes, and room titles and person ids pass through `src/rooms.js` | Security architecture |

## Design overview

`@webex/plugin-rooms` is a published JavaScript library with one module. Importing it registers the
internal `conversation` and `mercury` plugins and then `Rooms` as the public plugin `rooms`, reached as
`webex.rooms`. The `webex` and `webex-node` bundles import it to register it; no other workspace
package calls it from its source.

A room (a space) is a Webex conversation, served to applications by the `rooms` resource of the Webex
REST API, which the SDK reaches as catalog service `hydra`. The plugin answers three questions: "what
are my rooms" (create, read, list, update, delete through Hydra), "which rooms are unread" (from the
internal conversation service, converted into Hydra-style ids and dates), and "what changed" (Mercury
socket activities turned into webhook-shaped `created` and `updated` events after `listen()`).

The package serves no routes, caches nothing, and persists nothing.

## Resource inventory and responsibilities

| Resource | Kind | Responsibility | Owner | Source | Detailed specification |
| -------- | ---- | -------------- | ----- | ------ | ---------------------- |
| Rooms plugin | package (one module) | Registration; room records; read status; room events | @webex/web-client, @webex/web-sdk | src | [`src/docs/README.md`](../src/docs/README.md) |

## Interaction and execution flows

Representative end-to-end flow: an application lists its rooms with read status at startup and then
listens for room changes.

```mermaid
flowchart LR
  App[application] -->|create, get, list, update, remove| Plugin[webex.rooms]
  App -->|listWithReadStatus, getWithReadStatus| Plugin
  App -->|listen, on created and updated| Plugin
  Plugin -->|rooms requests| Hydra[Webex REST API rooms]
  Plugin -->|waitForCatalog postauth| Services[webex-core services]
  Plugin -->|list, get conversations| Convo[conversation plugin]
  Convo --> ConvoSvc[conversation service]
  Plugin -->|createEventEnvelope| Common[common]
  Common -->|people get me| People[webex.people]
  Plugin -->|connect, event:conversation.activity| Mercury[mercury plugin]
```

| From | To | Interaction or transport | Purpose | Failure or compatibility behavior |
| ---- | -- | ------------------------ | ------- | --------------------------------- |
| Application | `webex.rooms` | In-process calls; `on` for events | Room records, read status, events | Rejections propagate |
| `Rooms` | Webex REST API | HTTPS through `webex.request`, service `hydra` | Room records | No retry here |
| `Rooms` | `webex.internal.conversation` | In-process calls after the `postauth` catalog | Read status | Rejections propagate |
| `Rooms` | `webex.internal.mercury` | `connect()` and `listenTo` | Room events | A connect failure rejects `listen()` |
| `Rooms` | `@webex/common` | Import | Ids, room type, envelope, event vocabulary | A failed identity lookup leaves the envelope `undefined` |

## Dependency topology

| Dependency | Type | Used by | Purpose | Version, failure, or fallback policy |
| ---------- | ---- | ------- | ------- | ------------------------------------ |
| `@webex/webex-core` | Internal | `src/index.js`, `src/rooms.js` | Registration, plugin base, `Page`, `webex.request`, services | `workspace:*` in `package.json` |
| `@webex/common` | Internal | `src/rooms.js` | Hydra ids, room type, event envelope, `SDK_EVENT` | `workspace:*` |
| `@webex/internal-plugin-conversation` | Internal | `src/index.js` (import), `src/rooms.js` (calls) | Read status | `workspace:*` |
| `@webex/internal-plugin-mercury` | Internal | `src/index.js` (import), `src/rooms.js` (calls) | Room events | `workspace:*` |
| `@webex/plugin-people`, `@webex/plugin-logger` | Internal peer | Reached at run time through `webex.people` and `webex.logger` | Current user for the envelope; error logging | Peer dependencies; not imported by `src/` |
| `lodash`, `debug` | External library | `src/rooms.js` | `cloneDeep`; trace lines | `^4.17.21`, `^4.3.4` |
| Webex REST API rooms resource, conversation service | External service | `src/rooms.js` | Room records and conversations | Resolved through the service catalog |

No import cycle exists: none of the internal dependencies imports this package. `@webex/common` reads
`webex.people` at run time without importing it.

## Public and consumer surfaces

| Surface | Type | Owner | Consumers | Compatibility policy | Source |
| ------- | ---- | ----- | --------- | -------------------- | ------ |
| `rooms-public-sdk` — package @webex/plugin-rooms, `webex.rooms` with its eight methods and the `created` and `updated` events | SDK, published to npm, public | Rooms plugin | `webex`, `webex-node` (registration); applications and the workspace samples (calls) | No versioning or deprecation rule is declared in the package | `package.json`, `src/index.js`, `src/rooms.js` |

The rooms requests and the event shape are a protocol this package speaks, described under
*Protocol and wire format* in the
[module specification](../src/docs/README.md#protocol-and-wire-format). The other contracts this
package requires are registered in `.sdd/manifest.json` `contract_catalog`.

## Cross-cutting architecture

### Security

- Trust boundaries, scopes, and identity flow: see [Security architecture](#security-architecture).
- Sensitive surfaces and data classes: room titles, room, person, and organization ids, and
  last-activity dates.

### Observability and operations

- Logging and correlation: `getRoomEvent` logs one `webex.logger.error` line when an activity cannot be
  converted; `debug('rooms')` trace lines print event payloads when `DEBUG` enables `rooms`. Request
  tracking comes from the webex-core interceptors.
- Metrics, traces, and audit signals: none.
- Ownership and operational entry points: `.github/CODEOWNERS` at the workspace root assigns
  `packages/@webex/plugin-rooms` to `@webex/web-client` and `@webex/web-sdk`. No dashboards or
  runbooks are recorded in this package.

### Quality attributes

- Compatibility: callers rely on the registered name `rooms`, the Hydra room object, `list().items`
  through `Page`, the read-status fields, and the event names `created` and `updated`.
- Latency: `listWithReadStatus()` with no argument can return up to 1000 spaces in one call and, per its
  JSDoc, can take some time; `maxRecent` limits it.
- Test confidence: the package has no unit tests, and the integration spec is not run by any script.
  No coverage threshold is enforced.

## Dependency and interaction topology

```mermaid
flowchart LR
  Index[src/index.js] -->|import| Convo[internal-plugin-conversation]
  Index -->|import| Mercury[internal-plugin-mercury]
  Index -->|registerPlugin rooms| Core[webex-core]
  Index --> Rooms[src/rooms.js]
  Rooms -->|WebexPlugin, Page, request| Core
  Rooms -->|ids, envelope, SDK_EVENT| Common[common]
  Rooms -->|webex.internal.conversation| Convo
  Rooms -->|webex.internal.mercury| Mercury
```

| From | To | Kind | Purpose | Ordering or failure boundary |
| ---- | -- | ---- | ------- | ---------------------------- |
| `src/index.js` | conversation and Mercury plugins | Import at load | Register `webex.internal.conversation` and `webex.internal.mercury` | Before `rooms` is registered |
| `src/index.js` | webex-core | Call at import | Register `rooms` | First registration wins |
| `src/rooms.js` | common | Import | Ids, envelope, vocabulary | Conversion errors are caught in `getRoomEvent` |

## Object and data ownership

| Object or state | System of record | May write | May read | Movement or lifecycle |
| --------------- | ---------------- | --------- | -------- | --------------------- |
| Room record (`id`, `title`, `type`, `teamId`, `created`, and more) | Webex REST API | Callers, through `create`, `update`, `remove` | Callers, through `get` and `list` | Fetched per call; never kept here |
| Read status (`id`, `type`, `title`, `lastActivityDate`, `lastSeenActivityDate`) | Conversation service | Not this package | Callers | Built per call from conversations |
| Event envelope | This plugin instance, built by `@webex/common` | `listen()` | `getRoomEvent` | Replaced by each `listen()` |

## Shared and base libraries

| Library | Inherited responsibility | Consumers | Version floor | Compatibility rule |
| ------- | ------------------------ | --------- | ------------- | ------------------ |
| `@webex/webex-core` `WebexPlugin` | `webex`, `request`, `logger`, and the event methods | `Rooms` | `workspace:*` | Keep the registered name `rooms` |
| `@webex/babel-config-legacy`, `@webex/eslint-config-legacy`, `@webex/jest-config-legacy`, `@webex/legacy-tools` | Build, lint, and test stack through one-line config files | Package tooling | `workspace:*` | Do not fork the config locally |

## Release and versioning

| Artifact | Publish target | Versioning rule | Deprecation window | Changelog or migration obligation |
| -------- | -------------- | --------------- | ------------------ | --------------------------------- |
| @webex/plugin-rooms | npm through `deploy:npm` | None declared in the package | None declared | None declared in the package; the workspace owns changelog generation |

## Commands and generated artifacts

| Command or artifact | Owner | Inputs | Output or side effect | Compatibility boundary |
| ------------------- | ----- | ------ | --------------------- | ---------------------- |
| `yarn build:src` | Package scripts | `src` | Writes `dist/` (JavaScript and source maps) through `webex-legacy-tools` | `dist/` is generated and never edited by hand |
| `yarn build` | Package scripts | `src` | Runs `build:src` | Same output |
| `yarn test:style` | Package scripts | `src` | ESLint run | The shared config ignores `docs/**` and `*.md` |

## Cross-repository topology

| Repository or external system | Relationship | Exchanged contract or artifact | Owner | Sequencing constraint |
| ----------------------------- | ------------- | ------------------------------ | ----- | --------------------- |
| `@webex/webex-core` (workspace sibling; module spec consulted) | Consumes | `registerPlugin`, `WebexPlugin`, `Page`, `request`, services | @webex/web-sdk | Registered before the first instance |
| `@webex/common` (workspace sibling; module spec consulted) | Consumes | Hydra ids, `createEventEnvelope`, `SDK_EVENT` | @webex/web-sdk | None |
| `@webex/internal-plugin-conversation` (workspace sibling; no spec, code consulted) | Consumes | `list`, `get` of conversations | Not recorded in this package | `postauth` catalog ready |
| `@webex/internal-plugin-mercury` (workspace sibling; module spec consulted) | Consumes | `connect`, `event:conversation.activity` | Not recorded in this package | Connected before events flow |
| `webex`, `webex-node` (workspace siblings) | Consumed by | The plugin registration | @webex/web-sdk | None |
| Webex REST API rooms resource; conversation service | Consumes | Room records; conversations | Not recorded in this repository | None |

## Security architecture

```mermaid
flowchart LR
  Caller[caller] -->|room bodies, ids, options| Plugin[webex.rooms]
  Plugin -->|SDK token| Hydra[Webex REST API]
  Plugin -->|SDK token| Convo[conversation service]
  Mercury[Mercury socket, spark:all and spark:kms] -->|activities| Plugin
  Plugin -->|room records, read status, events| Caller
```

- This package holds no credential and no key. Every request carries the SDK authorization added by
  webex-core; the README and the `listen()` JSDoc state that room requests work with the
  `spark:rooms_read` and `spark:rooms_write` scopes, and that `listen()` needs `spark:all` and
  `spark:kms`.
- Room ids go into request paths and options into query strings. The package logs none of them
  through `webex.logger`; its logging is described under
  [Observability and operations](#observability-and-operations).
- What a caller may see is decided by the services for the authorized user; the package passes records
  through and keeps no copy.

## Domain language

| Term | Repository-specific meaning | Authoritative source |
| ---- | --------------------------- | -------------------- |
| Room, space | A Webex conversation as the public API names it | `src/rooms.js` |
| Hydra | The Webex REST API, reached as catalog service `hydra` | `src/rooms.js` |
| Hydra room id | base64url of `ciscospark://<cluster>/ROOM/<uuid>` | `src/rooms.js` |
| Read status | `lastActivityDate` against `lastSeenActivityDate`; a room is unread when the first is later | `src/rooms.js` |
| `maxRecent` | Limit for `listWithReadStatus` to spaces active in the last 14 days | `src/rooms.js` |
| Activity verb | The `create`, `update`, `lock`, or `unlock` value that picks the event | `src/rooms.js` |
| Event envelope | Webhook-shaped wrapper built once by `listen()` and cloned per event | `src/rooms.js` |

## References and maintenance

- Decisions: [adr/](adr/index.md)
- Instantiated specifications and routing: [specs/README.md](specs/README.md)
- Repository rules and patterns: [package agent instructions](../AGENTS.md)
- Update this document in the same change that alters package boundaries, resource ownership,
  cross-resource interaction, or cross-cutting architecture.
