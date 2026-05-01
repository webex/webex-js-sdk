# plugin-meetings — Architecture

## Table of Contents

1. [Plugin Registration](#1-plugin-registration)
2. [Component Map](#2-component-map)
3. [Meeting Lifecycle & State Machine](#3-meeting-lifecycle--state-machine)
4. [Locus Signalling](#4-locus-signalling)
5. [Media Layer](#5-media-layer)
6. [Multistream Subsystem](#6-multistream-subsystem)
7. [Mute State Machine](#7-mute-state-machine)
8. [Members / Roster](#8-members--roster)
9. [Meeting Info Resolution](#9-meeting-info-resolution)
10. [Reconnection Manager](#10-reconnection-manager)
11. [Reachability](#11-reachability)
12. [Recording Controller](#12-recording-controller)
13. [Breakout Rooms](#13-breakout-rooms)
14. [AI Features — Captions, Transcription & Reactions](#14-ai-features--captions-transcription--reactions)
15. [Event System](#15-event-system)
16. [Key External Dependencies](#16-key-external-dependencies)

---

## 1. Plugin Registration

`plugin-meetings` is registered with the Webex SDK core at module load time:

```typescript
// src/index.ts
registerPlugin('meetings', Meetings, {
  config,
  interceptors: {
    LocusRetryStatusInterceptor: LocusRetryStatusInterceptor.create,
    LocusRouteTokenInterceptor: LocusRouteTokenInterceptor.create,
    DataChannelAuthTokenInterceptor: DataChannelAuthTokenInterceptor.create,
  },
});
```

This makes the plugin available as `webex.meetings` (an instance of `Meetings`).

**Interceptors installed globally on every HTTP request made through the SDK:**

| Interceptor | Purpose |
|---|---|
| `LocusRetryStatusInterceptor` | Retries Locus requests on 503 and 429 (rate-limit) errors; excludes `/hashtree` and `/sync` endpoints |
| `LocusRouteTokenInterceptor` | Injects the current Locus route token into request headers |
| `DataChannelAuthTokenInterceptor` | Refreshes expired JWT tokens before LLM/data-channel requests, injects auth token, and retries on 401/403 |

---

## 2. Component Map

```
webex.meetings  (Meetings — WebexPlugin)
│
├── MeetingCollection           — map of meeting.id → Meeting
├── Reachability                — pre-join TURN/media cluster checks
├── PersonalMeetingRoom         — PMR info & management
├── MeetingInfoV2               — meeting info fetch (wbxappapi)
│
└── Meeting  (per active/incoming meeting)
    │
    ├── LocusInfo               — Locus DTO state machine & event bus
    │   ├── LocusDeltaParser    — classic sequence-based delta processing
    │   ├── HashTreeParser      — hash-tree incremental sync (newer path)
    │   ├── ControlsUtils       — parses locus.controls (recording, mute, captions…)
    │   ├── SelfUtils           — parses locus.self (roles, mute status, lobby…)
    │   ├── HostUtils           — parses locus.host
    │   ├── FullState           — parses locus.fullState (meeting state, type)
    │   ├── InfoUtils           — parses locus.info (sipUri, owner, webinar…)
    │   ├── MediaSharesUtils    — parses locus.mediaShares (content/whiteboard floor)
    │   └── EmbeddedAppsUtils   — parses locus.embeddedApps
    │
    ├── Members                 — participant roster, built from Locus participants
    │   └── MembersCollection   — id → Member map
    │
    ├── MeetingStateMachine     — FSM: IDLE → RINGING → JOINED → ENDED/ERROR
    │
    ├── Media / MediaProperties — WebRTC connection wrapper & stream references
    │
    ├── Roap                    — ROAP SDP exchange, TURN discovery
    │
    ├── MuteState (audio)       — local+remote mute coordination (audio)
    ├── MuteState (video)       — local+remote mute coordination (video)
    │
    ├── ReconnectionManager     — ICE failure detection, media reconnect / rejoin
    │
    ├── RecordingController     — recording start/stop/pause/resume via Locus API
    ├── ControlsOptionsManager  — mute-on-entry, disallow-unmute, etc.
    │
    ├── Breakouts               — breakout room lifecycle & collection
    ├── SimultaneousInterpretation — language channel management
    ├── Annotation              — screen-share annotation
    ├── Webinar                 — webinar/practice-session specifics
    ├── AIEnableRequest         — AI assistant opt-in flow
    │
    ├── RemoteMediaManager      — multistream receive slot layout (multistream only)
    ├── ReceiveSlotManager      — multistream receive slots
    ├── SendSlotManager         — multistream send slots
    └── MediaRequestManager ×4  — audio/video/screenshare audio/screenshare video
```

**External services:**

```
Mercury (WebSocket)  ──→  Meetings (loci events, LLM events)
Locus REST API       ←──  Meeting (join, leave, media, controls)
wbxappapi            ←──  MeetingInfoV2 (meeting info fetch)
TURN servers         ←──  Roap (TURN discovery, media relay)
Voicea / LLM         ←──  Meeting (captions, reactions)
```

---

## 3. Meeting Lifecycle & State Machine

### Meeting creation

A `Meeting` object is created when:
- The user calls `webex.meetings.create(destination)` (outgoing)
- A `loci` Mercury event arrives for an incoming call

`Meetings` parses the Locus event, creates a `Meeting` instance in `MeetingCollection`, and emits `meeting:added`.

### State machine (`src/meeting/state.ts`)

The `MeetingStateMachine` (instance property: `meeting.meetingFiniteStateMachine`) uses `javascript-state-machine`:

```
IDLE ──ring()──→ RINGING ──join()──→ JOINED ──leave()──→ ENDED
                    │                   │
                 decline()           fail()──→ ERROR
                    ↓                   │
                DECLINED             remote()
                                   ↙        ↘
                              ANSWERED     DECLINED
```

| Transition | Trigger |
|---|---|
| `ring` | Incoming 1:1 call Locus event; or outgoing call placed |
| `join` | Successful Locus `/join` response |
| `remote` | Remote party answered or declined (from JOINED or ERROR states) |
| `leave` | User calls `meeting.leave()`, or Locus DESTROY event |
| `end` | Meeting ended by server |
| `decline` | Call declined (from RINGING) |
| `fail` | Error during meeting (from JOINED) |
| `reset` | Reset state back to IDLE |

### Typical join flow (multi-party meeting)

```
app calls webex.meetings.create(destination)
  → Meetings creates Meeting (state: IDLE)

app calls meeting.fetchMeetingInfo()          [optional but recommended]
  → MeetingInfoV2 fetches from wbxappapi
  → stores permissionToken, sipUri, meetingNumber…

app calls meeting.join({ enableMultistream })
  → (optionally) Roap.generateTurnDiscoveryRequestMessage
  → MeetingRequest.joinMeeting (Locus PUT /join)
  → receives join response: locusUrl, mediaId, selfId, dataSets…
  → Meeting.setLocus()  → LocusInfo.initialSetup()
  → StateMachine: IDLE → ring(_JOIN_) → RINGING → join() → JOINED
  → emit meeting:added (if not already emitted)

app calls meeting.addMedia({ localStreams, … })
  → TURN server confirmed from join response (or new discovery)
  → Media.createMediaConnection (transcoded or multistream WebRTC)
  → Roap SDP offer/answer exchange with Locus
  → ICE candidates exchanged → connection established
  → emit media:ready events for remote streams
```

### Typical `joinWithMedia()` flow (convenience method)

`joinWithMedia()` combines `join()` + `addMedia()` into one call with built-in retry logic:

```
joinWithMedia({ joinOptions, mediaOptions: { allowMediaInLobby: true } })
  1. TURN discovery Roap message generated
  2. join() called with Roap message embedded
  3. TURN server extracted from join response
  4. addMediaInternal() called with TURN server info
  5. On failure: if 1st attempt → retry once; if retry also fails → leave() + throw
```

### Meeting destruction

A meeting is destroyed when:
- `DESTROY_MEETING` internal event fires (from Locus INACTIVE/TERMINATING state)
- The `shouldLeave` flag is false (already left) → `MeetingUtil.cleanUp()` then `DESTROY_MEETING` event to app
- The `shouldLeave` flag is true → `meeting.leave()` first, then destruction on next Locus event

`MEETING_REMOVED_REASON` constants document the different reasons:

| Reason | Meaning |
|---|---|
| `SELF_REMOVED` | Host or server removed you |
| `MEETING_INACTIVE_TERMINATING` | Meeting ended (everyone left, or host ended) |
| `CLIENT_LEAVE_REQUEST` | User called `leave()` |
| `CLIENT_LEAVE_REQUEST_TAB_CLOSED` | Browser tab closed |
| `MEETING_CONNECTION_FAILED` | ICE failure, unreachable |
| `LOCUS_DTO_SYNC_FAILED` | Could not fetch a Locus DTO after reconnect |
| `MISSING_MEETING_INFO` | Meeting info failed to be fetched |

---

## 4. Locus Signalling

### What is Locus?

Locus is the Webex server-side meeting state service. It maintains the authoritative state of every active meeting: participants, host, controls (recording, muting, captions), media sharing, etc.

### Two delivery paths

**Path 1 — Classic sequence-based (Mercury `loci` event)**

```
Mercury WebSocket
  → webex.internal.mercury emits 'event:locus'
    → Meetings.handleLocusMercury()
      → Meetings.handleLocusEvent()
        → finds or creates Meeting
          → Meeting.locusInfo.parse(locus)
            → LocusDeltaParser.parse() compares new vs. previous DTO sequences
              → fires EVENTS.* on LocusInfo for each changed section
                → Meeting's registered listeners update state & fire public EVENT_TRIGGERS
```

**Path 2 — Hash-tree incremental sync (LLM `HASH_TREE_DATA_UPDATED` event)**

Available when the Locus DTO contains `htMeta`. This reduces bandwidth by only sending changed tree leaves:

```
webex.internal.llm LLM data channel
  → Meeting.processLocusLLMEvent()
    → LocusInfo.parse(event.data)
      → HashTreeParser.processHashTreeMessage()
        → fetches changed data sets from visibleDataSetsUrl
        → merges leaf data into local LocusDTO snapshot
        → fires LocusInfoUpdate callbacks (OBJECTS_UPDATED or MEETING_ENDED)
          → same EVENTS.* pipeline as classic path
```

### LocusInfo event bus

`LocusInfo` extends `EventsScope` and is used purely as an internal event bus between `LocusInfo` and `Meeting`. Key internal events:

| Internal event (`EVENTS.*` / `LOCUSINFO.EVENTS.*`) | What changed |
|---|---|
| `LOCUS_INFO_UPDATE_PARTICIPANTS` | Participant list delta |
| `LOCUS_INFO_UPDATE_SELF` | Self participant state (mute, lobby, roles) |
| `LOCUS_INFO_UPDATE_HOST` | Host changed |
| `LOCUS_INFO_UPDATE_MEDIA_SHARES` | Screen share / whiteboard floor |
| `CONTROLS_RECORDING_UPDATED` | Recording state change |
| `CONTROLS_MUTE_ON_ENTRY_CHANGED` | Mute-on-entry setting |
| `CONTROLS_MEETING_BREAKOUT_UPDATED` | Breakout room state |
| `SELF_REMOTE_MUTE_STATUS_UPDATED` | Remote-muted by host |
| `LOCAL_UNMUTE_REQUIRED` | Host unmuted you |
| `SELF_UNADMITTED_GUEST` | You entered the lobby |
| `SELF_ADMITTED_GUEST` | You were admitted from lobby |
| `DESTROY_MEETING` | Meeting ended / you were removed |
| `DISCONNECT_DUE_TO_INACTIVITY` | Media inactivity timeout |

`Meeting.setUpLocusInfoListeners()` registers handlers for all of these and translates them into public `EVENT_TRIGGERS.*` emitted to app consumers.

---

## 5. Media Layer

### Two modes

| Mode | Description | Indicated by |
|---|---|---|
| **Transcoded** | Server mixes all streams into a single composite stream per participant | `meeting.isMultistream === false` |
| **Multistream** | Each participant's streams are sent separately; client receives and renders individually | `meeting.isMultistream === true` |

The mode is determined at join time (`join({ enableMultistream: true })`).

### WebRTC connection (`@webex/internal-media-core`)

The actual WebRTC peer connection is created and managed by `@webex/internal-media-core`. This library is accessed via:

```typescript
this.mediaProperties.webrtcMediaConnection
```

For transcoded mode it creates a `RoapMediaConnection`. For multistream mode it creates a `MultistreamRoapMediaConnection`.

### ROAP (SDP exchange)

ROAP (RTCWeb Offer Answer Protocol) is Webex's mechanism for SDP offer/answer exchange. It wraps SDP in JSON and sends it through Locus HTTP instead of a direct signalling channel.

Flow:
```
1. WebRTC creates SDP offer (via internal-media-core)
2. Roap.sendRoapMediaRequest() → PUT to {selfUrl}/media with OFFER message
3. Locus returns SDP answer in response or via Mercury
4. WebRTC processes SDP answer
5. ICE candidates gathered → connection established
```

### TURN discovery

Before joining or after an ICE failure, `TurnDiscovery.generateTurnDiscoveryRequestMessage()` (accessed via `meeting.roap.turnDiscovery`) initiates TURN discovery:

```
1. Client sends TURN_DISCOVERY_REQUEST in the ROAP Offer (or standalone)
2. Locus responds with TURN_DISCOVERY_RESPONSE containing TURN server credentials
3. Roap.handleTurnDiscoveryHttpResponse() extracts TurnServerInfo
4. WebRTC uses TURN server as relay candidate if direct ICE fails
```

TURN discovery can be skipped if reachability tests show direct connectivity is sufficient (`meeting.turnDiscoverySkippedReason` documents why).

### Connection state monitoring

`ConnectionStateHandler` (`src/meeting/connectionStateHandler.ts`) monitors the WebRTC peer connection and ICE connection state:

```typescript
webrtcMediaConnection.on(PEER_CONNECTION_STATE_CHANGED, handler)
webrtcMediaConnection.on(ICE_CONNECTION_STATE_CHANGED, handler)
```

When the overall `ConnectionState` changes it emits `connectionState:changed`, which `ReconnectionManager` uses to detect failures.

### Local stream management

Local streams (`LocalMicrophoneStream`, `LocalCameraStream`, `LocalDisplayStream`, `LocalSystemAudioStream`) are managed by `@webex/media-helpers`. The `Meeting` class:

- Holds references in `MediaProperties`
- Listens for `UserMuteStateChange`, `SystemMuteStateChange`, `OutputTrackChange`, `ConstraintsChange` events on each stream
- Calls `publishStream()` / `unpublishStream()` to connect/disconnect tracks from the WebRTC connection
- Emits `meeting:streamPublishStateChanged` when publish state changes

---

## 6. Multistream Subsystem

Multistream meetings receive separate video/audio streams per participant via WCME (Webex Cloud Media Engine).

### Receive side

```
ReceiveSlotManager
  └── ReceiveSlot  (one per MediaType × participant)
        - maps to a WebRTC ReceiveSlot in internal-media-core
        - identified by CSI (Content Stream Identifier)

RemoteMediaManager
  ├── manages VideoLayout (which panes are active, their size/priority)
  ├── RemoteMediaGroup  (group of RemoteMedia objects with shared policy)
  └── RemoteMedia       (wraps a ReceiveSlot, exposes remote stream to app)

MediaRequestManager  (one per: audio, video, screenShareAudio, screenShareVideo)
  └── batches and de-duplicates addRequest()/commit() calls to the WebRTC connection
```

### Video layouts

The app configures layouts via the `Configuration` interface (from `remoteMediaManager.ts`):

```typescript
{
  video: {
    initialLayoutId: 'AllEqual',
    layouts: {
      AllEqual: {
        activeSpeakerVideoPaneGroups: [{ id: 'main', numPanes: 9, size: 'large', priority: 255 }]
      },
      OneMain: {
        activeSpeakerVideoPaneGroups: [{ id: 'main', numPanes: 1, size: 'large', priority: 255 }],
        memberVideoPanes: [{ id: 'pip', size: 'small', csi: undefined }]
      }
    }
  }
}
```

`RemoteMediaManager.setLayout()` activates a named layout and updates `MediaRequestManager` with the corresponding media requests.

### Send side

`SendSlotManager` manages the outbound streams for multistream:
- `LocalMicrophoneStream` → `AudioMain` send slot
- `LocalCameraStream` → `VideoMain` send slot
- `LocalDisplayStream` → `VideoSlides` send slot
- `LocalSystemAudioStream` → `AudioSlides` send slot

For the "Be Right Back" feature, `BrbState` sets a source state override (`'away'`) on the `VideoMain` send slot, signalling the server that the user is away while keeping the local stream active.

---

## 7. Mute State Machine

Audio and video mute each have their own `MuteState` instance (`meeting.audio`, `meeting.video`). The class (`src/meeting/muteState.ts`) coordinates:

- **Local mute** — whether the local stream track is sending media
- **Remote mute** — server-side mute applied by a host or meeting policy
- **Unmute allowed** — whether the user is permitted to unmute themselves

### State model

```typescript
{
  client: {
    enabled: boolean,    // whether the device has audio/video at all
    localMute: boolean,  // whether user has muted themselves
  },
  server: {
    localMute: boolean,     // server's view of local mute (synced from client)
    remoteMute: boolean,    // muted by host
    unmuteAllowed: boolean, // host allows self-unmute
  },
  syncToServerInProgress: boolean,
}
```

### Sync guarantee

Whenever local mute state changes, `MuteState` sends a `LocalMute` request via `MeetingUtil.remoteUpdateAudioVideo()` → `locusMediaRequest.send()` (HTTP PUT to `{selfUrl}/media`). If a new change arrives while a sync is in progress, the latest desired state is queued and applied after the in-flight request completes. This prevents race conditions where rapid user actions would leave the server in an inconsistent state.

### Remote mute by host

When the host mutes a participant:
1. Locus sends a delta update to `self.controls.audio.muted = true`
2. `SelfUtils` detects the change and emits `SELF_REMOTE_MUTE_STATUS_UPDATED`
3. `Meeting` calls `audio.handleServerRemoteMuteUpdate(meeting, muted, unmuteAllowed)`
4. `MuteState` stops/starts the local audio track as appropriate
5. Public event `meeting:self:mutedByOthers` or `meeting:self:unmutedByOthers` is emitted

---

## 8. Members / Roster

`Members` (`src/members/index.ts`) maintains the participant collection for a meeting.

### Update flow

```
Locus participant delta
  → LocusInfo.EVENTS.LOCUS_INFO_UPDATE_PARTICIPANTS
    → Members.locusParticipantsUpdate(payload)
      → MembersCollection.set(memberId, Member)
        → Trigger: members:update { delta: { added, updated }, full }
```

Each `Member` object represents a Locus participant and exposes:
- `id`, `name`, `status` (`IN_MEETING`, `IN_LOBBY`, `NOT_IN_MEETING`)
- `isAudioMuted`, `isVideoMuted`
- `roles` (host, moderator, cohost, presenter…)
- `isSelf`, `isGuest`, `isInMeeting`
- `participant` — raw Locus participant object

For multistream meetings, `Members` also tracks CSI-to-participant mappings so that `ReceiveSlotManager` can resolve which member owns which video stream.

### Host / self updates

Separate events track host changes and self participant changes:
- `LOCUS_INFO_UPDATE_HOST` → `Members.locusHostUpdate()` → `members:host:update`
- `LOCUS_INFO_UPDATE_SELF` → `Members.locusSelfUpdate()` → `members:self:update`

---

## 9. Meeting Info Resolution

Before joining (and sometimes during), meeting info must be fetched from `wbxappapi` to obtain the SIP URI, permission token, meeting number, etc.

### Destination types (`DESTINATION_TYPE`)

| Type | Example destination value | Notes |
|---|---|---|
| `MEETING_LINK` | `https://company.webex.com/meet/alice` | Standard meeting join URL |
| `MEETING_ID` | `123456789` | 9-digit meeting number |
| `MEETING_UUID` | `<uuid>` | Meeting UUID identifier |
| `LOCUS_ID` | `<locus UUID>` | Internal identifier, e.g. for incoming calls |
| `CONVERSATION_URL` | `https://conv.webex.com/…` | Instant meeting from a Webex space |
| `SIP_URI` | `alice@company.webex.com` | SIP address |
| `PERSONAL_ROOM` | `alice@company.webex.com` | PMR address |
| `ONE_ON_ONE_CALL` | — | Direct 1:1 call |

`MeetingInfoV2` selects the correct wbxappapi endpoint based on destination type.

### Password / captcha / webinar flows

`fetchMeetingInfo()` may fail with errors requiring further user interaction:

```
MeetingInfoV2PasswordError  → meeting.passwordStatus = PASSWORD_STATUS.REQUIRED
                              → app calls meeting.verifyPassword(pwd)
                                → internally calls fetchMeetingInfo({ password })
                                → if correct: passwordStatus = VERIFIED; meeting info stored
                                → if wrong: throws PasswordError again

MeetingInfoV2CaptchaError   → meeting.requiredCaptcha populated (id, imageURL, audioURL)
                              → app presents captcha to user
                              → app calls meeting.fetchMeetingInfo({ captchaCode })

MeetingInfoV2JoinWebinarError → meetingInfoFailureReason = WEBINAR_REGISTRATION or NEED_JOIN_WITH_WEBCAST
                                → app calls meeting.verifyRegistrationId(regId)

MeetingInfoV2PolicyError    → meetingInfoFailureReason = POLICY
                              → throws PermissionError (meeting blocked by org policy)
```

### Permission token

The `permissionToken` field returned in meeting info is a short-lived JWT that must be presented at join time. It encodes user policies (`selfUserPolicies`). The SDK automatically refreshes it before expiry via `refreshPermissionToken()`.

---

## 10. Reconnection Manager

`ReconnectionManager` (`src/reconnection-manager/index.ts`) handles media failures.

### Failure detection

Triggered by:
- `ConnectionStateHandler` reporting ICE failure (ConnectionState.Failed or Disconnected)
- `MEDIA_INACTIVITY` Locus event (media inactive for too long)

### Reconnect strategy

```
ICE failure detected
  → ReconnectionManager.reconnect()
    → try: media-only reconnect (new ICE candidates, new SDP)
      → success → emit meeting:reconnectionSuccess
      → fail → NeedsRejoinError thrown
    → on NeedsRejoinError:
      → call meeting.leave({ reason: 'reconnect' })
      → call meeting.join() again
        → success → emit meeting:reconnectionSuccess
        → fail → emit meeting:reconnectionFailure
```

The `autoRejoin` config flag controls whether the SDK automatically attempts a full rejoin when media-only reconnect fails with `NeedsRejoinError`. When `false`, the `NeedsRejoinError` is re-thrown, resulting in `meeting:reconnectionFailure` being emitted — the app must handle reconnection itself.

### Key error classes

| Class | Meaning |
|---|---|
| `NeedsRetryError` | Reconnect should be retried (transient failure) — private class, not exported |
| `NeedsRejoinError` | Media reconnect insufficient; full Locus rejoin required — private class, not exported |
| `ReconnectionNotStartedError` | Reconnect already in progress; new attempt ignored |

---

## 11. Reachability

Before joining (and periodically), the SDK tests connectivity to Webex media clusters to select the best TURN server and media server.

### Flow

```
Reachability.gatherReachability()
  → fetches cluster list from Calliope Discovery service (calliopeDiscovery)
  → creates ClusterReachability per cluster
    → creates RTCPeerConnection per subnet
    → gathers ICE candidates with STUN/TURN
    → records reachable/unreachable + latency
  → stores results in localStorage (reused across short-lived meetings)
  → results used by Roap to select / skip TURN server
```

`meeting.turnDiscoverySkippedReason` explains why TURN was not used (e.g. `reachability_passed` — direct UDP connectivity confirmed).

---

## 12. Recording Controller

`RecordingController` (`src/recording-controller/`) manages the network-based recording lifecycle.

### Permission model

Two sources gate recording permissions:

1. **Display hints** (`DISPLAY_HINTS.RECORDING_CONTROL_*`) — per-meeting per-user hints from Locus
2. **Self policies** (`SELF_POLICY.SUPPORT_NETWORK_BASED_RECORD`, `SUPPORT_PREMISE_RECORD`) — org-level JWT policies

Both must be present for a recording action to be allowed. The recording `util.ts` module provides the check functions: `canUserStart()`, `canUserStop()`, `canUserPause()`, `canUserResume()`.

### Recording state

```
IDLE ──start()──→ RECORDING ──pause()──→ PAUSED ──resume()──→ RECORDING
                     │                                              │
                   stop()                                        stop()
                     ↓                                              ↓
                   IDLE                                           IDLE
```

State changes arrive via Locus `controls.record` delta → `CONTROLS_RECORDING_UPDATED` → Meeting emits public recording events:
- `meeting:recording:started`
- `meeting:recording:stopped`
- `meeting:recording:paused`
- `meeting:recording:resumed`

Note: The `RESUMED` state is transient — after emitting `meeting:recording:resumed`, `meeting.recording.state` is immediately normalised back to `RECORDING`.

---

## 13. Breakout Rooms

`Breakouts` (`src/breakouts/`) manages breakout room sessions.

### Session types

| `sessionType` | Meaning |
|---|---|
| `MAIN` | User is in the main meeting |
| `BREAKOUT` | User is in a breakout room |

### Lifecycle

```
Host enables breakouts → locus.controls.breakout populated
  → ControlsUtils detects change → CONTROLS_MEETING_BREAKOUT_UPDATED
    → Meeting.breakouts.updateBreakout(breakout)
      → emit meeting:breakouts:update

Host starts breakouts → participants receive SELF_MEETING_BREAKOUTS_CHANGED
  → Breakouts.updateBreakoutSessions(payload)
    → emit meeting:breakouts:update

Participant joins breakout → Locus URL changes to breakout session URL
  → Meeting.locusUrl updated → breakouts.locusUrlUpdate()
  → breakouts.sessionType = 'BREAKOUT'

Breakouts closing → emit meeting:breakouts:closing
  (countdown info available via breakouts.delayCloseTime property)
```

### Key interactions across roles

- **Host/cohost** can create, start, stop, and manage breakout groups via `breakouts.*` methods.
- **Participants** can ask for help (`breakouts.askForHelp()`), which sends a request to the host.
- **Host in breakout** admitting lobby participants: must pass `authorizingLocusUrl` (breakout session URL) and `mainLocusUrl` to `meeting.admit()`.

---

## 14. AI Features — Captions, Transcription & Reactions

### Captions / Transcription via Voicea

Real-time captions are delivered through `@webex/internal-plugin-voicea`, which connects to a Voicea LLM subchannel over the data channel.

```
meeting.startTranscription({ spokenLanguage })
  → webex.internal.voicea.turnOnCaptions(spokenLanguage)
    → subscribes to transcription subchannel via LLM data channel
      → NEW_CAPTION events arrive → processNewCaptions()
        → meeting.transcription.captions updated
          → emit meeting:caption-received { captions, interimCaptions }
```

The `meeting.transcription` object tracks:
- `captions` — array of finalised captions
- `interimCaptions` — in-progress captions (keyed by speaker CSI)
- `languageOptions` — spoken/caption language settings
- `isCaptioning`, `isListening`, `commandText`

### Reactions

Reactions are delivered via the LLM relay channel (not Locus):

```
LLM relay event (relayType: 'react')
  → Meeting.processRelayEvent()
    → looks up sender in MembersCollection
    → emit meeting:receiveReactions { reaction, sender }
```

Reactions require both `controls.reactions.enabled` (Locus control) and `config.receiveReactions` (SDK config).

---

## 15. Event System

### Public events (app-facing)

All public events are emitted using `TriggerProxy` / `Trigger.trigger()`:

```typescript
Trigger.trigger(
  this,                           // emitter (Meeting or Meetings instance)
  { file: 'meeting/index', function: 'methodName' },  // log context
  EVENT_TRIGGERS.MEETING_LOCKED,  // event name string
  payload                         // optional payload
);
```

The `EVENT_TRIGGERS` constant object in `src/constants.ts` is the single source of truth for all public event name strings. Never hard-code event name strings.

**Selected important public events:**

| Event | When |
|---|---|
| `meetings:registered` | `webex.meetings.register()` complete |
| `meeting:added` | New meeting created in collection |
| `meeting:removed` | Meeting removed from collection |
| `meeting:stateChange` | Meeting FSM state changed |
| `media:ready` | Remote stream available |
| `media:stopped` | Remote stream ended |
| `meeting:self:lobbyWaiting` | Entered the lobby |
| `meeting:self:guestAdmitted` | Admitted from lobby |
| `meeting:self:mutedByOthers` | Remote-muted by host |
| `meeting:self:unmutedByOthers` | Remote-unmuted by host |
| `meeting:self:requestedToUnmute` | Host requested you unmute |
| `meeting:self:rolesChanged` | Your roles changed (host, cohost, presenter…) |
| `meeting:recording:started/stopped/paused/resumed` | Recording state changed |
| `meeting:startedSharingLocal/Remote` | Screen share started |
| `meeting:stoppedSharingLocal/Remote` | Screen share stopped |
| `meeting:breakouts:update` | Breakout session state changed |
| `meeting:reconnectionStarting/Success/Failure` | Media reconnection lifecycle |
| `meeting:actionsUpdate` | Available in-meeting actions (display hints) changed |
| `meeting:receiveTranscription:started/stopped` | Captions toggled |
| `members:update` | Roster changed |
| `network:quality` | Uplink quality metric |

### Internal events

`EVENTS.*` and `LOCUSINFO.EVENTS.*` constants are used for internal communication between `LocusInfo` and `Meeting`. These are never exposed to app consumers.

### EventsScope base class

`EventsScope` (`src/common/events/events-scope.ts`) extends Node.js `EventEmitter` (imported as `ChildEmitter`) and is used by `LocusInfo` and other internal components. It overrides `emit()` to inject a scope parameter and log event names via `LoggerProxy`. The `on()` and `off()` methods are inherited unchanged from `EventEmitter`.

See `EVENT_TRIGGERS` in `src/constants.ts` for the canonical full list of public events.

---

## 16. Key External Dependencies

| Package | Used for |
|---|---|
| `@webex/webex-core` | `WebexPlugin` / `StatelessWebexPlugin` base classes, plugin registration, HTTP client |
| `@webex/internal-media-core` | WebRTC peer connection (`RoapMediaConnection`, `MultistreamRoapMediaConnection`), stats, codec handling |
| `@webex/media-helpers` | Local stream types (`LocalMicrophoneStream`, `LocalCameraStream`, `LocalDisplayStream`, `LocalSystemAudioStream`), stream creation helpers |
| `@webex/internal-plugin-mercury` | WebSocket (Mercury) connection; delivers Locus `loci` events |
| `@webex/internal-plugin-metrics` | Call Analyzer (CA) events, behavioral metrics |
| `@webex/internal-plugin-voicea` | AI captions / Voicea transcription |
| `@webex/internal-plugin-llm` | LLM data channel (hash-tree Locus events, reactions relay, data-channel auth tokens) |
| `@webex/internal-plugin-device` | Device registration, device URL |
| `@webex/web-capabilities` | Runtime capability checks (e.g. `supportsRTCPeerConnection`) |
| `@webex/ts-sdp` | SDP parsing for multistream signalling |
| `javascript-state-machine` | Meeting FSM implementation |
| `lodash` | Utility functions (deep clone, merge, isEqual, etc.) |
| `jwt-decode` | Decodes the permission token JWT |
| `jose` | JWT verification in interceptors (token expiry checks) |
| `xxh3-ts` | Hash function for hash-tree Locus state verification |
| `uuid` | UUID generation |
| `webrtc-adapter` | WebRTC cross-browser shim |
