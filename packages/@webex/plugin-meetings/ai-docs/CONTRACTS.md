<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: contracts@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-21T11:57:19Z
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

### Current emitted-event inventory

This table is generated from current public emission call sites. The local mechanical gate resolves constants, conditional expressions, local assignments, `TriggerProxy`, inline literals, and thin forwarding wrappers. It distinguishes the emitted literal, its defining expression, and the file that emits or forwards it; the four private plumbing signals excluded from the public-event count remain documented only in their owning module flows.

| Event literal | Constant / expression | Emission evidence |
|---|---|---|
| `ASK_FOR_HELP` | `BREAKOUTS.EVENTS.ASK_FOR_HELP` | `src/breakouts/index.ts` |
| `ASK_RETURN_TO_MAIN` | `BREAKOUTS.EVENTS.ASK_RETURN_TO_MAIN` | `src/breakouts/index.ts` |
| `BREAKOUTS_CLOSING` | `BREAKOUTS.EVENTS.BREAKOUTS_CLOSING` | `src/breakouts/index.ts` |
| `HANDOFF_REQUESTS_ARRIVED` | `INTERPRETATION.EVENTS.HANDOFF_REQUESTS_ARRIVED` | `src/interpretation/index.ts` |
| `LEAVE_BREAKOUT` | `BREAKOUTS.EVENTS.LEAVE_BREAKOUT` | `src/breakouts/index.ts` |
| `annotation:command` | `EVENT_TRIGGERS.ANNOTATION_COMMAND` | `src/annotation/index.ts` |
| `annotation:strokeData` | `EVENT_TRIGGERS.ANNOTATION_STROKE_DATA` | `src/annotation/index.ts` |
| `media:activeSpeakerChanged` | `EVENT_TRIGGERS.ACTIVE_SPEAKER_CHANGED` | `src/meeting/index.ts` |
| `media:codec:loaded` | `EVENT_TRIGGERS.MEDIA_CODEC_LOADED` | `src/meetings/util.ts` |
| `media:codec:missing` | `EVENT_TRIGGERS.MEDIA_CODEC_MISSING` | `src/meetings/util.ts` |
| `media:inboundAudio:issueDetected` | `EVENT_TRIGGERS.MEDIA_INBOUND_AUDIO_ISSUE_DETECTED` | `src/meeting/index.ts` |
| `media:negotiated` | `EVENT_TRIGGERS.MEDIA_NEGOTIATED` | `src/meeting/index.ts` |
| `media:ready` | `EVENT_TRIGGERS.MEDIA_READY` | `src/meeting/index.ts` |
| `media:remoteAudio:created` | `EVENT_TRIGGERS.REMOTE_MEDIA_AUDIO_CREATED` | `src/meeting/index.ts` |
| `media:remoteInterpretationAudio:created` | `EVENT_TRIGGERS.REMOTE_MEDIA_INTERPRETATION_AUDIO_CREATED` | `src/meeting/index.ts` |
| `media:remoteScreenShareAudio:created` | `EVENT_TRIGGERS.REMOTE_MEDIA_SCREEN_SHARE_AUDIO_CREATED` | `src/meeting/index.ts` |
| `media:remoteVideo:layoutChanged` | `EVENT_TRIGGERS.REMOTE_MEDIA_VIDEO_LAYOUT_CHANGED` | `src/meeting/index.ts` |
| `media:remoteAudioSourceCountChanged` | `EVENT_TRIGGERS.REMOTE_AUDIO_SOURCE_COUNT_CHANGED` | `src/meeting/index.ts` |
| `media:remoteVideoSourceCountChanged` | `EVENT_TRIGGERS.REMOTE_VIDEO_SOURCE_COUNT_CHANGED` | `src/meeting/index.ts` |
| `media:stopped` | `EVENT_TRIGGERS.MEDIA_STOPPED` | `src/meeting/index.ts` |
| `meeting:actionsUpdate` | `EVENT_TRIGGERS.MEETING_ACTIONS_UPDATE` | `src/meeting/index.ts` |
| `meeting:added` | `EVENT_TRIGGERS.MEETING_ADDED` | `src/meetings/index.ts` |
| `meeting:breakouts:askForHelp` | `EVENT_TRIGGERS.MEETING_BREAKOUTS_ASK_FOR_HELP` | `src/meeting/index.ts` |
| `meeting:breakouts:askReturnToMain` | `EVENT_TRIGGERS.MEETING_BREAKOUTS_ASK_RETURN_TO_MAIN` | `src/meeting/index.ts` |
| `meeting:breakouts:closing` | `EVENT_TRIGGERS.MEETING_BREAKOUTS_CLOSING` | `src/meeting/index.ts` |
| `meeting:breakouts:leave` | `EVENT_TRIGGERS.MEETING_BREAKOUTS_LEAVE` | `src/meeting/index.ts` |
| `meeting:breakouts:message` | `EVENT_TRIGGERS.MEETING_BREAKOUTS_MESSAGE` | `src/meeting/index.ts` |
| `meeting:breakouts:preAssignmentsUpdate` | `EVENT_TRIGGERS.MEETING_BREAKOUTS_PRE_ASSIGNMENTS_UPDATE` | `src/meeting/index.ts` |
| `meeting:breakouts:update` | `EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE` | `src/meeting/index.ts` |
| `meeting:caption-received` | `EVENT_TRIGGERS.MEETING_CAPTION_RECEIVED` | `src/meeting/index.ts` |
| `meeting:controls:ai-summary-notification:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_AI_SUMMARY_NOTIFICATION_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:annotation:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_ANNOTATION_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:auto-end-meeting-warning:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_AUTO_END_MEETING_WARNING_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:disallow-unmute:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_DISALLOW_UNMUTE_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:meeting-full:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_MEETING_FULL_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:mute-on-entry:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_MUTE_ON_ENTRY_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:polling-qa:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_POLLING_QA_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:practice-session-status:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_PRACTICE_SESSION_STATUS_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:raise-hand:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_RAISE_HAND_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:reactions:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_REACTIONS_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:remote-desktop-control:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_REMOTE_DESKTOP_CONTROL_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:share-control:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_SHARE_CONTROL_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:stage-view:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_STAGE_VIEW_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:video:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_VIDEO_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:view-the-participants-list:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_VIEW_THE_PARTICIPANTS_LIST_UPDATED` | `src/meeting/index.ts` |
| `meeting:controls:webcast:updated` | `EVENT_TRIGGERS.MEETING_CONTROLS_WEBCAST_UPDATED` | `src/meeting/index.ts` |
| `meeting:embeddedApps:update` | `EVENT_TRIGGERS.MEETING_EMBEDDED_APPS_UPDATE` | `src/meeting/index.ts` |
| `meeting:entryExitTone:update` | `EVENT_TRIGGERS.MEETING_ENTRY_EXIT_TONE_UPDATE` | `src/meeting/index.ts` |
| `meeting:interpretation:handoffRequestsArrived` | `EVENT_TRIGGERS.MEETING_INTERPRETATION_HANDOFF_REQUESTS_ARRIVED` | `src/meeting/index.ts` |
| `meeting:interpretation:supportLanguagesUpdate` | `EVENT_TRIGGERS.MEETING_INTERPRETATION_SUPPORT_LANGUAGES_UPDATE` | `src/meeting/index.ts` |
| `meeting:interpretation:update` | `EVENT_TRIGGERS.MEETING_INTERPRETATION_UPDATE` | `src/meeting/index.ts`, `src/meeting/util.ts` |
| `meeting:layout:update` | `EVENT_TRIGGERS.MEETING_CONTROLS_LAYOUT_UPDATE` | `src/meeting/index.ts` |
| `meeting:locked` | `EVENT_TRIGGERS.MEETING_LOCKED` | `src/meeting/index.ts` |
| `meeting:locus:locusUrl:update` | `EVENT_TRIGGERS.MEETING_LOCUS_URL_UPDATE` | `src/meeting/index.ts` |
| `meeting:logUpload:failure` | `EVENT_TRIGGERS.MEETING_LOG_UPLOAD_FAILURE` | `src/meetings/index.ts` |
| `meeting:logUpload:success` | `EVENT_TRIGGERS.MEETING_LOG_UPLOAD_SUCCESS` | `src/meetings/index.ts` |
| `meeting:manualCaptionControl:updated` | `EVENT_TRIGGERS.MEETING_MANUAL_CAPTION_UPDATED` | `src/meeting/index.ts` |
| `meeting:media:local:start` | `EVENT_TRIGGERS.MEETING_MEDIA_LOCAL_STARTED` | `src/meeting/index.ts` |
| `meeting:media:remote:start` | `EVENT_TRIGGERS.MEETING_MEDIA_REMOTE_STARTED` | `src/meeting/index.ts` |
| `meeting:meetingContainer:update` | `EVENT_TRIGGERS.MEETING_MEETING_CONTAINER_UPDATE` | `src/meeting/index.ts` |
| `meeting:meetingInfoAvailable` | `EVENT_TRIGGERS.MEETING_INFO_AVAILABLE` | `src/meeting/index.ts` |
| `meeting:meetingInfoUpdated` | `EVENT_TRIGGERS.MEETING_INFO_UPDATED` | `src/meeting/index.ts` |
| `meeting:participant-reason-changed` | `EVENT_TRIGGERS.MEETING_PARTICIPANT_REASON_CHANGED` | `src/meeting/index.ts` |
| `meeting:receiveReactions` | `EVENT_TRIGGERS.MEETING_RECEIVE_REACTIONS` | `src/meeting/index.ts` |
| `meeting:receiveTranscription:started` | `EVENT_TRIGGERS.MEETING_STARTED_RECEIVING_TRANSCRIPTION` | `src/meeting/index.ts` |
| `meeting:receiveTranscription:stopped` | `EVENT_TRIGGERS.MEETING_STOPPED_RECEIVING_TRANSCRIPTION` | `src/meeting/index.ts` |
| `meeting:recording:paused` | `EVENT_TRIGGERS.MEETING_PAUSED_RECORDING` | `src/meeting/index.ts` |
| `meeting:recording:resumed` | `EVENT_TRIGGERS.MEETING_RESUMED_RECORDING` | `src/meeting/index.ts` |
| `meeting:recording:started` | `EVENT_TRIGGERS.MEETING_STARTED_RECORDING` | `src/meeting/index.ts` |
| `meeting:recording:stopped` | `EVENT_TRIGGERS.MEETING_STOPPED_RECORDING` | `src/meeting/index.ts` |
| `meeting:removed` | `EVENT_TRIGGERS.MEETING_REMOVED` | `src/meetings/index.ts` |
| `meeting:resourceLinks:update` | `EVENT_TRIGGERS.MEETING_RESOURCE_LINKS_UPDATE` | `src/meeting/index.ts` |
| `meeting:ringing` | `EVENT_TRIGGERS.MEETING_RINGING` | `src/meeting/state.ts` |
| `meeting:ringingStop` | `EVENT_TRIGGERS.MEETING_RINGING_STOP` | `src/meeting/state.ts` |
| `meeting:self:brbUpdate` | `EVENT_TRIGGERS.MEETING_SELF_BRB_UPDATE` | `src/meeting/index.ts` |
| `meeting:self:cannotViewParticipantList` | `EVENT_TRIGGERS.MEETING_SELF_CANNOT_VIEW_PARTICIPANT_LIST` | `src/meeting/index.ts` |
| `meeting:self:guestAdmitted` | `EVENT_TRIGGERS.MEETING_SELF_GUEST_ADMITTED` | `src/meeting/index.ts` |
| `meeting:self:isSharingBlocked` | `EVENT_TRIGGERS.MEETING_SELF_IS_SHARING_BLOCKED` | `src/meeting/index.ts` |
| `meeting:self:left` | `EVENT_TRIGGERS.MEETING_SELF_LEFT` | `src/meeting/index.ts` |
| `meeting:self:lobbyWaiting` | `EVENT_TRIGGERS.MEETING_SELF_LOBBY_WAITING` | `src/meeting/index.ts` |
| `meeting:self:mutedByOthers` | `EVENT_TRIGGERS.MEETING_SELF_MUTED_BY_OTHERS` | `src/meeting/index.ts` |
| `meeting:self:phoneAudioUpdate` | `EVENT_TRIGGERS.MEETING_SELF_PHONE_AUDIO_UPDATE` | `src/meeting/index.ts` |
| `meeting:self:requestedToUnmute` | `EVENT_TRIGGERS.MEETING_SELF_REQUESTED_TO_UNMUTE` | `src/meeting/index.ts` |
| `meeting:self:rolesChanged` | `EVENT_TRIGGERS.MEETING_SELF_ROLES_CHANGED` | `src/meeting/index.ts` |
| `meeting:self:unmutedByOthers` | `EVENT_TRIGGERS.MEETING_SELF_UNMUTED_BY_OTHERS` | `src/meeting/index.ts` |
| `meeting:self:videoMutedByOthers` | `EVENT_TRIGGERS.MEETING_SELF_VIDEO_MUTED_BY_OTHERS` | `src/meeting/index.ts` |
| `meeting:self:videoUnmutedByOthers` | `EVENT_TRIGGERS.MEETING_SELF_VIDEO_UNMUTED_BY_OTHERS` | `src/meeting/index.ts` |
| `meeting:srtpCipher:updated` | `EVENT_TRIGGERS.MEETING_SRTP_CIPHER_UPDATED` | `src/meeting/index.ts` |
| `meeting:startedSharingLocal` | `EVENT_TRIGGERS.MEETING_STARTED_SHARING_LOCAL` | `src/meeting/index.ts` |
| `meeting:startedSharingRemote` | `EVENT_TRIGGERS.MEETING_STARTED_SHARING_REMOTE` | `src/meeting/index.ts` |
| `meeting:startedSharingWhiteboard` | `EVENT_TRIGGERS.MEETING_STARTED_SHARING_WHITEBOARD` | `src/meeting/index.ts` |
| `meeting:stateChange` | `EVENT_TRIGGERS.MEETING_STATE_CHANGE` | `src/meeting/index.ts` |
| `meeting:reconnectionFailure` | `EVENT_TRIGGERS.MEETING_RECONNECTION_FAILURE` | `src/reconnection-manager/index.ts` |
| `meeting:reconnectionStarting` | `EVENT_TRIGGERS.MEETING_RECONNECTION_STARTING` | `src/reconnection-manager/index.ts` |
| `meeting:reconnectionSuccess` | `EVENT_TRIGGERS.MEETING_RECONNECTION_SUCCESS` | `src/reconnection-manager/index.ts` |
| `meeting:stoppedSharingLocal` | `EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL` | `src/meeting/index.ts`, `src/reconnection-manager/index.ts` |
| `meeting:stoppedSharingRemote` | `EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE` | `src/meeting/index.ts` |
| `meeting:stoppedSharingWhiteboard` | `EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD` | `src/meeting/index.ts` |
| `meeting:streamPublishStateChanged` | `EVENT_TRIGGERS.MEETING_STREAM_PUBLISH_STATE_CHANGED` | `src/meeting/index.ts` |
| `meeting:transcription:connected` | `EVENT_TRIGGERS.MEETING_TRANSCRIPTION_CONNECTED` | `src/meeting/index.ts` |
| `meeting:transcription:spokenLanguageUpdate` | `EVENT_TRIGGERS.MEETING_TRANSCRIPTION_SPOKEN_LANGUAGE_UPDATED` | `src/meeting/index.ts` |
| `meeting:unlocked` | `EVENT_TRIGGERS.MEETING_UNLOCKED` | `src/meeting/index.ts` |
| `meeting:updateAnnotationInfo` | `EVENT_TRIGGERS.MEETING_UPDATE_ANNOTATION_INFO` | `src/meeting/index.ts` |
| `meetings:ready` | `EVENT_TRIGGERS.MEETINGS_READY` | `src/meetings/index.ts` |
| `meetings:registered` | `EVENT_TRIGGERS.MEETINGS_REGISTERED` | `src/meetings/index.ts` |
| `meetings:unregistered` | `EVENT_TRIGGERS.MEETINGS_UNREGISTERED` | `src/meetings/index.ts` |
| `MEMBERS_UPDATE` | `BREAKOUTS.EVENTS.MEMBERS_UPDATE` | `src/breakouts/index.ts` |
| `members:clear` | `EVENT_TRIGGERS.MEMBERS_CLEAR` | `src/members/index.ts` |
| `members:content:update` | `EVENT_TRIGGERS.MEMBERS_CONTENT_UPDATE` | `src/members/index.ts` |
| `members:host:update` | `EVENT_TRIGGERS.MEMBERS_HOST_UPDATE` | `src/members/index.ts` |
| `members:self:update` | `EVENT_TRIGGERS.MEMBERS_SELF_UPDATE` | `src/members/index.ts` |
| `members:update` | `EVENT_TRIGGERS.MEMBERS_UPDATE` | `src/members/index.ts` |
| `MESSAGE` | `BREAKOUTS.EVENTS.MESSAGE` | `src/breakouts/index.ts` |
| `network:connected` | `EVENT_TRIGGERS.MEETINGS_NETWORK_CONNECTED` | `src/meeting/index.ts` |
| `network:disconnected` | `EVENT_TRIGGERS.MEETINGS_NETWORK_DISCONNECTED` | `src/meeting/index.ts`, `src/meetings/index.ts` |
| `network:quality` | `EVENT_TRIGGERS.NETWORK_QUALITY` | `src/meeting/index.ts` |
| `PRE_ASSIGNMENTS_UPDATE` | `BREAKOUTS.EVENTS.PRE_ASSIGNMENTS_UPDATE` | `src/breakouts/index.ts` |
| `reachability:done` | inline literal | `src/reachability/index.ts` |
| `reachability:firstResultAvailable` | inline literal | `src/reachability/index.ts` |
| `reachability:stopped` | inline literal | `src/reachability/index.ts` |
| `SUPPORT_LANGUAGES_UPDATE` | `INTERPRETATION.EVENTS.SUPPORT_LANGUAGES_UPDATE` | `src/interpretation/index.ts` |

### Declared but not emitted

These root constants are consumer-visible declarations in `src/constants.ts`, but current package source has no reachable public emission call for them. They are not part of the emitted-event count and must not be presented as live notifications.

| Declared literal | Constant | Current classification |
|---|---|---|
| `media:quality` | `EVENT_TRIGGERS.MEDIA_QUALITY` | declared but not emitted |
| `media:update` | `EVENT_TRIGGERS.MEDIA_UPDATE` | declared but not emitted |
| `meeting:aiEnableRequest` | `EVENT_TRIGGERS.MEETING_AI_ENABLE_REQUEST` | declared but not emitted |

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
