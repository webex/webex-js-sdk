<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: contracts@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-21T06:10:05Z
validation_status: not-run
-->
# CONTRACTS — @webex/plugin-meetings

> Root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md). This is the compact package boundary; owning module specs contain operation and failure detail.

### Exported API & Types

`src/index.ts` is the package export authority. It registers the default `Meetings` plugin and exports `Meeting`, selected meeting-info/error helpers, constants, reactions, annotation/interpretation types, `RemoteMedia`, `TriggerProxy`, AI approver selection, and media-helper stream factories/types. A symbol existing below `src/` is not public unless it is reachable through this entry point or a documented public object such as `webex.meetings`/`Meeting`.

| Contract ID | Surface | Purpose | Compatibility |
|---|---|---|---|
| `package.default` | default `Meetings` | plugin constructor registered as `webex.meetings` | semver-sensitive |
| `package.meeting` | `Meeting` | per-meeting lifecycle/control object | semver-sensitive methods/events |
| `package.streams` | media-helper stream classes/factories/types | acquire and represent local/remote media | follows package re-export contract |
| `package.constants` | `CONSTANTS`, `REACTIONS`, selected enums/types | stable consumer values and payload typing | never silently change wire values |
| `package.errors` | join, captcha, password, permission, reclaim-host, SDP timeout errors | actionable consumer failure branches | preserve class identity and relevant fields |
| `package.utilities` | `MeetingInfoUtil`, `TriggerProxy`, `getAIEnablementApprover` | selected advanced integration helpers | semver-sensitive |
| `meetings.site-preferences` | `Meetings.fetchSitePreferencesMeViaSite(options?)` | fetch the selected preference sections from a site's `/wbxappapi/v1/users/me/preference` resource, using an explicit site or the preferred site established during registration | semver-sensitive method, option, and response shape |

The retained `README.md` contains extensive usage examples for registration, creating/finding meetings, joining, media, PMR, members, and events. Those examples are migration source material; validate them against current source before copying into new consumer code.

### Events

Events are emitted in process through package event scopes, with some inputs originating from Mercury, Locus, media, or data channels. Event constants in `src/constants.ts` and feature event files are authoritative.

| Family | Owner | Examples / role | Compatibility rule |
|---|---|---|---|
| meetings | `src/meetings/` | added/removed, incoming, registration and sync lifecycle | preserve name, payload shape, and timing |
| meeting | `src/meeting/` | state, media ready/stopped, mute, sharing, transcription, controls | preserve scope and cleanup; document payload changes |
| members | `src/members/` | roster added/updated/removed and host/member changes | participant PII restrictions apply |
| breakouts | `src/breakouts/events.ts` | session, roster, broadcast, help, return-to-main changes | stale README implementation notes do not override code |
| interpretation / AI / webinar / annotation | owning modules | approval, handoff, role/status, relay/data-channel changes | capability-gated, meeting-scoped |

Event caveat retained from consumer guidance: do not assume every event is globally emitted or ordered independently of meeting/Locus state. Subscribe through the documented object/scope, tolerate async updates, and remove listeners during teardown.

### Migrated meetings-event catalog

| Event name | Observable meaning retained from consumer guidance |
|---|---|
| `meetings:ready` | plugin initialization completed; no payload |
| `meeting:added` | a joinable incoming/outgoing meeting entered the collection; payload identifies meeting and type |
| `meeting:removed` | a meeting left the collection and cannot be rejoined through that object; payload includes id/response |
| `media:codec:loaded` | browser H.264 codec became available; no payload |
| `media:codec:missing` | browser H.264 codec appears unavailable; no payload |

### Migrated meeting-event catalog

| Event name | Observable meaning / payload category |
|---|---|
| `meetings:registered` / `meetings:unregistered` | device and websocket registration lifecycle; no payload |
| `media:ready` | local or remote media became available; payload contains media `type` and `stream` |
| `media:stopped` | local or remote media was torn down; payload identifies media `type` |
| `meeting:media:local:start` / `meeting:media:remote:start` | local bytes began sending or remote bytes began arriving |
| `meeting:ringing` / `meeting:ringingStop` | ringing starts/stops; payload identifies meeting/type and remote answer/decline state |
| `meeting:startedSharingLocal` / `meeting:stoppedSharingLocal` | local share lifecycle; no payload |
| `meeting:startedSharingRemote` / `meeting:stoppedSharingRemote` | remote share lifecycle |
| `meeting:self:lobbyWaiting` / `meeting:self:guestAdmitted` | self lobby/admission transition; payload carries the self projection |
| `meeting:self:mutedByOthers` | self was remotely muted; payload carries the self projection |
| `meeting:reconnectionStarting` | reconnection began; no payload |
| `meeting:reconnectionSuccess` / `meeting:reconnectionFailure` | recovery completed with media result or error |
| `meeting:unlocked` / `meeting:locked` | host lock state changed; payload carries lock info |
| `meeting:actionsUpdate` | available actions changed, including invite/admit/lock/host/recording/hand controls |
| `meeting:logUpload:success` / `meeting:logUpload:failure` | diagnostic log upload outcome |
| `meeting:recording:started` / `stopped` / `paused` / `resumed` | recording state changed; payload includes state, modifier, and modification time |
| `meeting:receiveTranscription:started` / `stopped` | transcript reception lifecycle |
| `meeting:meetingContainer:update` | meeting-container URL changed |

### Migrated members-event catalog

| Event name | Observable meaning / payload category |
|---|---|
| `members:update` | roster delta (`updated`, `added`) plus full collection |
| `members:content:update` | active/ended content-sharing member ids |
| `members:host:update` | active/ended host member ids |
| `members:self:update` | active/ended self member ids |

Remote-share caveat: register `media:ready` before join, request `receiveShare` during media setup, and use the `remoteShare` stream plus current `meeting.shareStatus`. A host may start sharing before the participant can attach `meeting:startedSharingRemote`, so the current projection is required in addition to edge-triggered events. Evidence: `README.md`, `src/meeting/index.ts`.

### Migrated consumer operation map

| Consumer goal | Canonical operation family | Owning spec |
|---|---|---|
| register/unregister the device and realtime connection | `Meetings.register()` / `unregister()` lifecycle | `src/meetings/ai-docs/meetings-spec.md` |
| create/get/list a meeting from room, person, conversation, SIP, Locus, or active-call data | meeting discovery and collection lookup | `src/meetings/ai-docs/meetings-spec.md` |
| join basic, group, incoming, or PMR meetings | staged create → join → optional media | `src/meeting/ai-docs/meeting-spec.md` |
| acquire microphone/camera/display streams and attach/update/stop media | media-helper factories plus Meeting media operations | `src/media/ai-docs/media-spec.md` and `src/meeting/ai-docs/meeting-spec.md` |
| receive realtime transcripts/captions | enable receiving and consume meeting transcript events | `src/meeting/ai-docs/meeting-spec.md` |
| mute/unmute, share/unshare, lock/unlock, transfer host, recording, and available-action checks | Meeting/controller mutations gated by Locus capabilities | owning meeting/control specs |
| use a paired Webex device, move a meeting, wireless share, or reconnect media | Meeting device/media lifecycle | `src/meeting/ai-docs/meeting-spec.md` |
| inspect/mutate members and subscribe to roster events | Members collection/request/event surface | `src/members/ai-docs/members-spec.md` |

## Requires — what this repo depends on

The package exposes no server endpoint or CLI of its own. It calls Webex services through `@webex/webex-core` request/service abstractions; exact route construction remains in request classes rather than this catalog.

| Dependency | What is consumed | Schema / detail link | Availability assumption | Fallback on failure | Version floor |
|---|---|---|---|---|---|
| Webex SDK host | credentialed request, device, Mercury, discovery, logging, metrics | `src/index.ts`, `src/meetings/index.ts` | host initialized before meeting work | staged error/rejection; cleanup listeners | workspace version |
| Webex Locus and meeting services | state, discovery, lifecycle, controls | owning request classes/specs | network service may fail or reject | preserve current projection; bounded retry only where implemented | service-discovered contract |
| browser media and media libraries | WebRTC, streams, media-core negotiation | `src/media/`, `src/roap/`, `src/multistream/` | browser capability/permission dependent | media error and bounded recovery/rejoin | `@webex/internal-media-core` 2.28.2 |
| workspace feature packages | identity, people/rooms, support, Voicea/LLM and helpers | `package.json` | resolved by Yarn workspace | caller-visible capability absence/error | `workspace:*` |

## Compatibility & Deprecation Policy

- Treat `src/index.ts` exports, `webex.meetings`, public `Meetings`/`Meeting` methods, event names/payloads, typed errors, and documented constants as consumer contracts.
- Prefer additive changes. A removal, rename, changed default, wire-value change, or altered event/error timing requires explicit approval, migration guidance, and the repository release process.
- Retain the privacy behavior documented since version `0.109.0`: participant email is not a roster convenience field; consumers resolve identity details through the appropriate People API.
- Spec and implementation changes land together; canonical specs must be reconciled before overwriting.

## Detailed Interface Docs

- Package registration/exports: `src/index.ts`
- Collection and lifecycle APIs: `src/meetings/index.ts`, `src/meeting/index.ts`
- Requests: `src/meetings/request.ts`, `src/meeting/request.ts`, and owning feature request files
- Constants/events: `src/constants.ts`, `src/common/events/`, feature constants/events files
- Consumer examples and upgrade mapping: retained `README.md` and `UPGRADING.md`
- Operation-level contracts: source-local module specs listed in `SPEC_INDEX.md`

## Maintenance

Update this index when a public export, event family, request family, command, or dependency boundary changes. Put detailed payload/operation behavior in the owning module spec and cite current source/test paths only.
