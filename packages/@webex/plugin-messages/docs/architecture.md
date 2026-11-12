---
type: Architecture
title: '@webex/plugin-messages architecture'
description: Package-wide boundaries, resources, interactions, dependencies, and cross-cutting architecture.
tags: [architecture]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: architecture@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T17:30:10Z
validation_status: pass-with-warnings
-->

# @webex/plugin-messages architecture

Canonical architecture for this package. Flow behavior lives in the
[Messages plugin specification](../src/docs/README.md). This page owns package boundaries, the plugin
registration, the contract index, and how the package meets the rest of the SDK.

Related context: [specification registry](specs/README.md) ·
[package agent instructions](../AGENTS.md)

## Applicability

| Condition ID                         | Status     | Evidence or reason | Owned section |
| ------------------------------------ | ---------- | ------------------ | ------------- |
| `repo.owns_datastore`                | N/A        | No database, file store, or migration in `src/messages.js` | Repository data and schema |
| `repo.holds_client_state`            | N/A        | `src/messages.js` caches no message record; the stored event envelope is described in the module specification | Client state model |
| `repo.components_interact`           | Applicable | `src/index.js` registers the conversation and Mercury plugins that `src/messages.js` relies on | Dependency and interaction topology |
| `repo.domain_data_across_components` | Applicable | Message records and message events pass from Hydra and Mercury through `src/messages.js` to callers | Object and data ownership |
| `repo.caches_data`                   | N/A        | Nothing is kept after a call settles in `src/messages.js` | Caching catalog |
| `repo.observability_convention`      | N/A        | One warning and one error log line in `src/messages.js`; no metric or trace convention | Observability patterns |
| `repo.deploys_to_infra`              | N/A        | Library published to npm (`package.json`). No service runtime | Runtime and infrastructure |
| `repo.shared_base_libs`              | Applicable | Extends WebexPlugin and uses the legacy build and lint stack (`babel.config.js`, `.eslintrc.js`) | Shared and base libraries |
| `repo.is_monorepo`                   | N/A        | This SDD root is one package. The workspace around it is out of scope | Package map and inter-package dependencies |
| `repo.multi_platform`                | N/A        | `src/messages.js` has no platform branch; `process` declares {browser: true} and is not imported | Platform matrix |
| `repo.published_package`             | Applicable | `package.json` name is @webex/plugin-messages and deploy:npm publishes it | Release and versioning |
| `repo.embedded_in_host`              | N/A        | No host theme or embed API in `src/messages.js` | Host integration and theming |
| `repo.exposes_commands_or_artifacts` | Applicable | build:src in `package.json` writes dist | Commands and generated artifacts |
| `repo.cross_repo_deps_material`      | Applicable | Behavior depends on the Webex REST API messages resource and the Mercury socket (`src/messages.js`) | Cross-repository topology |
| `repo.security_arch_warranted`       | Applicable | `listen()` needs the spark:all and spark:kms scopes, and message text, files, and email addresses pass through `src/messages.js` | Security architecture |

## Design overview

`@webex/plugin-messages` is a published JavaScript library with one module. Importing it registers the
internal `conversation` and `mercury` plugins and then `Messages` as the public plugin `messages`,
reached as `webex.messages`. The `webex` and `webex-node` bundles import it to register it, and
`@webex/test-webex-node` calls it to post a message.

A message is a block of content in a Webex room, served to applications by the `messages` resource of
the Webex REST API, which the SDK reaches as catalog service `hydra`. The plugin answers two questions:
"what was said" (post, edit, read, list, delete through Hydra, with file attachments sent as a
multipart upload) and "what changed" (Mercury socket activities turned into webhook-shaped `created`
and `deleted` events after `listen()`).

The package serves no routes, caches nothing, and persists nothing.

## Resource inventory and responsibilities

| Resource | Kind | Responsibility | Owner | Source | Detailed specification |
| -------- | ---- | -------------- | ----- | ------ | ---------------------- |
| Messages plugin | package (one module) | Registration; message records; message events | @webex/web-sdk | src | [`src/docs/README.md`](../src/docs/README.md) |

## Interaction and execution flows

Representative end-to-end flow: an application posts a message with a file and listens for new and
deleted messages.

```mermaid
flowchart LR
  App[application] -->|create, update, get, list, remove| Plugin[webex.messages]
  App -->|listen, on created and deleted| Plugin
  Plugin -->|messages requests, JSON or multipart| Hydra[Webex REST API messages]
  Plugin -->|createEventEnvelope| Common[common]
  Common -->|people get me| People[webex.people]
  Plugin -->|connect, event:conversation.activity| Mercury[mercury plugin]
  Convo[conversation plugin] -->|decrypts inbound activities| Mercury
  Plugin -->|GET message per created event| Hydra
```

| From | To | Interaction or transport | Purpose | Failure or compatibility behavior |
| ---- | -- | ------------------------ | ------- | --------------------------------- |
| Application | `webex.messages` | In-process calls; `on` for events | Message records, events | Rejections propagate; `update` without a `roomId` returns `null` |
| `Messages` | Webex REST API | HTTPS through `webex.request`, service `hydra` | Message records | No retry here |
| `Messages` | `webex.internal.mercury` | `connect()` and `listenTo` | Message events | A connect failure rejects `listen()` |
| `webex.internal.conversation` | Mercury activities | Payload transformer registered at import | Decrypted activities | Not called by this package |
| `Messages` | `@webex/common` | Import | Ids, envelope, event vocabulary | A failed identity lookup leaves the envelope `undefined` |

## Dependency topology

| Dependency | Type | Used by | Purpose | Version, failure, or fallback policy |
| ---------- | ---- | ------- | ------- | ------------------------------------ |
| `@webex/webex-core` | Internal | `src/index.js`, `src/messages.js` | Registration, plugin base, `Page`, `webex.request`, services | `workspace:*` in `package.json` |
| `@webex/common` | Internal | `src/messages.js` | Hydra ids, cluster string, event envelope, `SDK_EVENT` | `workspace:*` |
| `@webex/internal-plugin-conversation` | Internal | `src/index.js` (import only) | Decrypts socket activities | `workspace:*` |
| `@webex/internal-plugin-mercury` | Internal | `src/index.js` (import), `src/messages.js` (calls) | Message events | `workspace:*` |
| `@webex/internal-plugin-device` | Internal | Not imported by `src/`; the integration spec imports it | Device registration, which Mercury performs on connect | `workspace:*` |
| `@webex/plugin-people`, `@webex/plugin-logger`, `@webex/plugin-rooms` | Internal peer | Reached at run time through `webex.people` and `webex.logger`; rooms only in JSDoc examples and the integration spec | Current user for the envelope; logging; test rooms | Peer dependencies; not imported by `src/` |
| `lodash` | External library | `src/messages.js` | `cloneDeep`, `isArray` | `^4.17.21` |
| `debug` | External library | Declared; not imported by `src/` | The integration spec's trace lines | `^4.3.4` |
| Webex REST API messages resource | External service | `src/messages.js` | Message records | Resolved through the service catalog |

No import cycle exists: none of the internal dependencies imports this package. `@webex/common` reads
`webex.people` at run time without importing it.

## Public and consumer surfaces

| Surface | Type | Owner | Consumers | Compatibility policy | Source |
| ------- | ---- | ----- | --------- | -------------------- | ------ |
| `messages-public-sdk` — package @webex/plugin-messages, `webex.messages` with its six methods and the `created` and `deleted` events | SDK, published to npm, public | Messages plugin | `webex`, `webex-node` (registration); applications, `@webex/test-webex-node`, and the workspace samples (calls) | No versioning or deprecation rule is declared in the package | `package.json`, `src/index.js`, `src/messages.js` |

The messages requests and the event shape are a protocol this package speaks, described under
*Protocol and wire format* in the
[module specification](../src/docs/README.md#protocol-and-wire-format). The other contracts this
package requires are registered in `.sdd/manifest.json` `contract_catalog`.

## Cross-cutting architecture

### Security

- Trust boundaries, scopes, and identity flow: see [Security architecture](#security-architecture).
- Sensitive surfaces and data classes: message text, markdown, file content and URLs, adaptive-card
  attachments, person email addresses, and message, room, person, and organization ids.

### Observability and operations

- Logging and correlation: `create` and `update` log a fixed `webex.logger.warn` line when the
  deprecated `file` property is used, and `update` logs a fixed `webex.logger.error` line when no
  `roomId` is given; neither includes message content. Request tracking comes from the webex-core
  interceptors. A failed fetch for a `created` event is not logged by this package.
- Metrics, traces, and audit signals: none.
- Ownership and operational entry points: `.github/CODEOWNERS` at the workspace root has no line for
  `packages/@webex/plugin-messages`, so its default rule assigns the package to `@webex/web-sdk`. No
  dashboards or runbooks are recorded in this package.

### Quality attributes

- Compatibility: callers rely on the registered name `messages`, the Hydra message object,
  `list().items` through `Page`, the `formData` upload for blobs and buffers, and the event names
  `created` and `deleted`.
- Latency: each `created` event costs one Hydra request before it is triggered.
- Test confidence: the package has no unit tests, and the integration spec is skipped in full. No
  coverage threshold is enforced.

## Dependency and interaction topology

```mermaid
flowchart LR
  Index[src/index.js] -->|import| Convo[internal-plugin-conversation]
  Index -->|import| Mercury[internal-plugin-mercury]
  Index -->|registerPlugin messages| Core[webex-core]
  Index --> Messages[src/messages.js]
  Messages -->|WebexPlugin, Page, request| Core
  Messages -->|ids, envelope, SDK_EVENT| Common[common]
  Messages -->|webex.internal.mercury| Mercury
```

| From | To | Kind | Purpose | Ordering or failure boundary |
| ---- | -- | ---- | ------- | ---------------------------- |
| `src/index.js` | conversation and Mercury plugins | Import at load | Register `webex.internal.conversation` and `webex.internal.mercury` | Before `messages` is registered |
| `src/index.js` | webex-core | Call at import | Register `messages` | First registration wins |
| `src/messages.js` | common | Import | Ids, envelope, vocabulary | Conversion errors reach Mercury's `_emit`, which logs them |

## Object and data ownership

| Object or state | System of record | May write | May read | Movement or lifecycle |
| --------------- | ---------------- | --------- | -------- | --------------------- |
| Message record (`id`, `roomId`, `personId`, `personEmail`, `text`, `markdown`, `files`, `created`, and more) | Webex REST API | Callers, through `create`, `update`, `remove` | Callers, through `get` and `list`, and `created` listeners | Fetched per call; never kept here |
| File attachment | Webex REST API | Callers, through the multipart upload or a URL in `files` | Callers, through the `files` URLs | Sent per call; never kept here |
| Event envelope | This plugin instance, built by `@webex/common` | `listen()` | `getMessageEvent` | Replaced by each `listen()` |

## Shared and base libraries

| Library | Inherited responsibility | Consumers | Version floor | Compatibility rule |
| ------- | ------------------------ | --------- | ------------- | ------------------ |
| `@webex/webex-core` `WebexPlugin` | `webex`, `request`, `logger`, and the event methods | `Messages` | `workspace:*` | Keep the registered name `messages` |
| `@webex/babel-config-legacy`, `@webex/eslint-config-legacy`, `@webex/jest-config-legacy`, `@webex/legacy-tools` | Build, lint, and test stack through one-line config files | Package tooling | `workspace:*` | Do not fork the config locally |

## Release and versioning

| Artifact | Publish target | Versioning rule | Deprecation window | Changelog or migration obligation |
| -------- | -------------- | --------------- | ------------------ | --------------------------------- |
| @webex/plugin-messages | npm through `deploy:npm` | None declared in the package | None declared; the single `file` property is deprecated by a run-time warning only | None declared in the package; the workspace owns changelog generation |

## Commands and generated artifacts

| Command or artifact | Owner | Inputs | Output or side effect | Compatibility boundary |
| ------------------- | ----- | ------ | --------------------- | ---------------------- |
| `yarn build:src` | Package scripts | `src` | Writes `dist/` (JavaScript and source maps) through `webex-legacy-tools` | `dist/` is generated and never edited by hand |
| `yarn build` | Package scripts | `src` | Runs `build:src` | Same output |
| `yarn test:style` | Package scripts | `src` | ESLint run | The shared config ignores `docs/**` and `*.md` |

## Cross-repository topology

| Repository or external system | Relationship | Exchanged contract or artifact | Owner | Sequencing constraint |
| ----------------------------- | ------------- | ------------------------------ | ----- | --------------------- |
| `@webex/webex-core` (workspace sibling; module spec consulted) | Consumes | `registerPlugin`, `WebexPlugin`, `Page`, `request`, services | @webex/web-client, @webex/web-sdk | Registered before the first instance |
| `@webex/http-core` (workspace sibling, through webex-core; module spec consulted) | Consumes | Multipart encoding of `formData` | @webex/web-client, @webex/web-sdk | None |
| `@webex/common` (workspace sibling; module spec consulted) | Consumes | Hydra ids, `createEventEnvelope`, `SDK_EVENT` | @webex/web-client, @webex/web-sdk | None |
| `@webex/internal-plugin-conversation` (workspace sibling; no spec, code consulted) | Consumes | Decryption of inbound activities | @webex/web-client, @webex/web-sdk | Registered before Mercury events arrive |
| `@webex/internal-plugin-mercury` (workspace sibling; module spec consulted) | Consumes | `connect`, `event:conversation.activity` | @webex/web-client, @webex/web-sdk | Connected before events flow |
| `webex`, `webex-node`, `@webex/test-webex-node` (workspace siblings) | Consumed by | The plugin registration; `create` | @webex/web-sdk | None |
| Webex REST API messages resource | Consumes | Message records and uploads | Not recorded in this repository | None |

## Security architecture

```mermaid
flowchart LR
  Caller[caller] -->|message bodies, files, ids, options| Plugin[webex.messages]
  Plugin -->|SDK token| Hydra[Webex REST API]
  Mercury[Mercury socket, spark:all and spark:kms] -->|decrypted activities| Plugin
  Plugin -->|message records, events| Caller
```

- This package holds no credential and no key. Every request carries the SDK authorization added by
  webex-core; the README and the `listen()` JSDoc state that message requests work with the
  `spark:messages_read` and `spark:messages_write` scopes, and that `listen()` needs `spark:all` and
  `spark:kms`.
- Socket activities are encrypted; the conversation plugin, registered by this package's import,
  decrypts them before this package reads them. Message content is fetched from Hydra in clear over
  HTTPS.
- Message ids go into request paths and options into query strings. The package logs none of them,
  and no message content, through `webex.logger`; its logging is described under
  [Observability and operations](#observability-and-operations).
- What a caller may see or delete is decided by Hydra for the authorized user (the `remove` JSDoc: own
  messages, except moderators and org administrators); the package passes records through and keeps no
  copy.

## Domain language

| Term | Repository-specific meaning | Authoritative source |
| ---- | --------------------------- | -------------------- |
| Message | A block of content in a room: text or markdown, files, and card attachments | `src/messages.js` |
| Hydra | The Webex REST API, reached as catalog service `hydra` | `src/messages.js` |
| Hydra message id | base64url of `ciscospark://<cluster>/MESSAGE/<uuid>` | `src/messages.js` |
| `altMessage` | The second argument of `update`, the payload sent in place of the message | `src/messages.js` |
| Multipart upload | A `formData` request, used when `files` holds a blob or buffer | `src/messages.js` |
| Activity verb | The `post`, `share`, or `delete` value that picks the event | `src/messages.js` |
| Event envelope | Webhook-shaped wrapper built once by `listen()` and cloned per event | `src/messages.js` |

## References and maintenance

- Decisions: [adr/](adr/index.md)
- Instantiated specifications and routing: [specs/README.md](specs/README.md)
- Repository rules and patterns: [package agent instructions](../AGENTS.md)
- Update this document in the same change that alters package boundaries, resource ownership,
  cross-resource interaction, or cross-cutting architecture.
