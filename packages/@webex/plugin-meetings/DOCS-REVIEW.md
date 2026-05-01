# Documentation Review: AGENTS.md & ARCHITECTURE.md

## Executive Summary

Both documents are **factually accurate in the majority of their claims** (approx. 85-90% fully correct). They form a strong onboarding resource. However, there are several factual errors, misleading simplifications, and notable omissions that should be addressed.

---

## Table of Contents

1. [Factual Errors (Must Fix)](#1-factual-errors-must-fix)
2. [Misleading / Imprecise Claims](#2-misleading--imprecise-claims)
3. [Omissions (Important Missing Information)](#3-omissions-important-missing-information)
4. [Style & Usefulness Assessment](#4-style--usefulness-assessment)
5. [Redundancies](#5-redundancies)
6. [Recommendations](#6-recommendations)

---

## 1. Factual Errors (Must Fix)

### ARCHITECTURE.md §3 — State Machine Transitions

**Claim:** Transitions are `ring`, `join`, `remote`, `leave`, `error`

**Reality:** The actual transitions defined in `src/meeting/state.ts` are: `ring`, `join`, `remote`, `leave`, `end`, `decline`, `fail`, `reset`. There is **no** transition named `error`. The doc omits `end`, `decline`, `fail`, and `reset`.

Additionally, the `remote` transition is claimed to operate from `RINGING` state, but it actually transitions from `[JOINED, ERROR]` states.

---

### ARCHITECTURE.md §3 — Join State Transition

**Claim:** "State transitions from IDLE → JOINED"

**Reality:** The actual path is: `IDLE → ring(_JOIN_) → RINGING → join() → JOINED`. It goes through RINGING first, not directly IDLE → JOINED.

---

### ARCHITECTURE.md §4 — Mercury Event Handler Name

**Claim:** `webex.internal.mercury` emits `'event:locus'` → `Meetings.onLocusEvent()`

**Reality:** There is **no method** named `onLocusEvent()` in the codebase. The actual method chain is: `Meetings.handleLocusMercury(envelope)` → `Meetings.handleLocusEvent(...)`.

---

### ARCHITECTURE.md §5 — ROAP Method Name and HTTP Verb

**Claim:** "Roap.sendRoapOffer() → POST to Locus /media with OFFER message"

**Reality:** The method is `roap.sendRoapMediaRequest()` (not `sendRoapOffer`). The HTTP verb is **PUT** (not POST) to `{selfUrl}/media`.

---

### ARCHITECTURE.md §7 — Mute Sync Endpoint

**Claim:** "When local mute state changes, sends a Locus `/controls` PATCH request"

**Reality:** Local mute sync sends a `LocalMute` type request via `MeetingUtil.remoteUpdateAudioVideo()` → `locusMediaRequest.send()`, which uses **HTTP PUT to `{selfUrl}/media`** — not PATCH to `/controls`.

---

### ARCHITECTURE.md §7 — Remote Mute Field Name

**Claim:** "Locus sends delta to `locus.self.localAudioMuted = true`"

**Reality:** The actual field is `self.controls.audio.muted`. There is no `localAudioMuted` property in the Locus DTO.

---

### ARCHITECTURE.md §15 — EventsScope Description

**Claim:** "EventsScope is a typed EventEmitter wrapper...provides scoped `on()`, `off()`, and `emit()` with logging context"

**Reality:**
- **Not typed** — all parameters are `any`
- Only `emit()` is overridden with scope/logging context
- `on()` and `off()` are inherited unchanged from Node.js `EventEmitter` — they have no scoping or logging
- `ChildEmitter` is just Node.js `EventEmitter` imported under an alias

---

### ARCHITECTURE.md §14 — Reaction Relay Type Value

**Claim:** `relayType: 'reaction'`

**Reality:** The relay type string is `'react'`, not `'reaction'`. See `src/reactions/constants.ts`: `REACTION_RELAY_TYPES = { REACTION: 'react' }`.

---

## 2. Misleading / Imprecise Claims

### ARCHITECTURE.md §1 — LocusRetryStatusInterceptor Description

**Claim:** "Retries Locus requests on transient 5xx errors"

**More accurate:** Retries on **503 and 429** (rate-limit) specifically. It explicitly *excludes* `/hashtree` and `/sync` endpoints from retries. "Generic 5xx" is misleading.

---

### ARCHITECTURE.md §1 — DataChannelAuthTokenInterceptor Description

**Claim:** "Injects the data-channel auth token for LLM/data-channel requests"

**More accurate:** Also **refreshes expired JWT tokens** before requests and **retries on 401/403** responses. The description omits the retry/refresh behavior which is arguably its main purpose.

---

### ARCHITECTURE.md §10 — Reconnection Trigger: Mercury Reconnect

**Claim:** Reconnection is triggered by "Mercury websocket reconnect triggering a sync"

**Reality:** The `mercuryOnlineHandler` only logs a metric. It does **NOT** trigger reconnection. Mercury reconnect is not a reconnection trigger.

---

### ARCHITECTURE.md §10 — autoRejoin=false Behavior

**Claim:** "When `false`, the app receives `meeting:self:left` and must handle reconnection itself"

**Reality:** When autoRejoin is false, the `NeedsRejoinError` is re-thrown → `ReconnectionError` → `meeting:reconnection:failure` is emitted — not `meeting:self:left`.

---

### ARCHITECTURE.md §11 — Reachability Discovery Endpoint

**Claim:** "Fetches cluster list from Locus discovery endpoint"

**Reality:** Uses `API.CALLIOPEDISCOVERY` = `'calliopeDiscovery'` (the Calliope/Orpheus discovery service), which is a **separate media cluster discovery service**, not a Locus endpoint.

---

### ARCHITECTURE.md §8 — Member Status Values

**Claim:** Member status values are "JOINED, IN_LOBBY, LEFT…"

**Reality:** The actual `status` values are `_IN_MEETING_`, `_IN_LOBBY_`, `_NOT_IN_MEETING_`. When participant state is `LEFT`, Member status becomes `_NOT_IN_MEETING_`, not "LEFT".

---

### AGENTS.md — Logging Convention

**Claim:** "Log format convention: `ClassName:filename#methodName --> message`"

**Reality:** This convention exists and is followed in many files, but is **inconsistently applied**. Examples of violations: `Breakouts#broadcast -->` (missing `:filename`), `multistream:sendRequests -->` (different separator), `data channel token refresh exceeded max retry(...)` (no prefix at all). Should be caveated as "convention, not strictly enforced."

---

### ARCHITECTURE.md §6 — MediaRequestManager API

**Claim:** "batches and de-duplicates `requestMedia()` calls"

**Reality:** No method called `requestMedia()` exists. The actual API is `addRequest()` + `commit()` on `MediaRequestManager`.

---

### ARCHITECTURE.md §6 — RemoteMediaManagerConfiguration Name

**Claim:** "App configures layouts via `RemoteMediaManagerConfiguration`"

**Reality:** The interface is named `Configuration` (not `RemoteMediaManagerConfiguration`), exported from `remoteMediaManager.ts`.

---

### ARCHITECTURE.md §13 — Breakouts Closing Event Payload

**Claim:** "emit `meeting:breakouts:closing` (with countdown)"

**Reality:** The event is triggered **without** countdown payload. The `delayCloseTime` property exists on the Breakouts object as a separate property, but the event itself carries no countdown data.

---

### ARCHITECTURE.md §15 — "All public events use TriggerProxy"

**Claim:** All public events are emitted using `TriggerProxy` / `Trigger.trigger()`

**Reality:** Two exceptions bypass TriggerProxy logging (voicea/caption events call `this.trigger(EVENT_TRIGGERS.*, payload)` directly).

---

### AGENTS.md — "Axios interceptors"

**Claim:** `src/interceptors/` contains "Axios interceptors"

**Reality:** The base class is `Interceptor` from `@webex/http-core` (which uses a request library, not necessarily raw Axios). Minor terminology issue.

---

### ARCHITECTURE.md §12 — RecordingUtil Name

**Claim:** "`RecordingUtil` provides check functions"

**Reality:** The module is imported as `Util` in the codebase, not `RecordingUtil`. It's at `recording-controller/util.ts`.

---

## 3. Omissions (Important Missing Information)

### Missing Source Directories

Three `src/` directories exist but are **not documented** in either file:
- `src/reactions/` — Meeting reactions (emoji reactions): `reactions.ts`, `reactions.type.ts`, `constants.ts`
- `src/personal-meeting-room/` — Personal meeting room logic: `index.ts`, `request.ts`, `util.ts`
- `src/aiEnableRequest/` — AI enable request feature: `index.ts`, `utils.ts`

---

### Missing Dependencies

Several dependencies in `package.json` are undocumented in ARCHITECTURE.md §16:
- **`jose`** (^5.8.0) — JWT verification in interceptors
- **`@webex/ts-sdp`** (^1.8.1) — SDP parsing library for multistream signalling
- **`xxh3-ts`** (^2.0.1) — Hash function critical for hash-tree verification
- **`uuid`** (^3.3.2) — UUID generation
- **`ampersand-collection`** (^2.0.2) — Collection base class
- **`bowser`** (^2.11.0) — Browser detection

---

### Missing Destination Types

ARCHITECTURE.md §9 lists 6 destination types but the actual code has 8: also `ONE_ON_ONE_CALL` and `MEETING_UUID`.

---

### Missing Error Classes

ARCHITECTURE.md §9 lists 4 meeting info error classes, but the code also has: `MeetingInfoV2AdhocMeetingError`, `MeetingInfoV2JoinForbiddenError`, `MeetingInfoV2StaticLinkDoesNotExistError`, `MeetingInfoV2MeetingIsInProgressError`, `MeetingInfoV2StaticMeetingLinkAlreadyExists`.

---

### Missing Topics (Neither Document Covers)

1. **Error handling patterns** — Neither doc explains how errors propagate or the error class hierarchy
2. **Metrics/telemetry model** — How/when Call Analyzer events are emitted, the behavioral metrics contract
3. **Configuration schema** — `src/config.ts` structure, how to override defaults, what's configurable
4. **Property name discrepancy** — The FSM instance property is `meeting.meetingFiniteStateMachine`, but docs refer to it as `MeetingStateMachine` (the class name). Can confuse code searchers.
5. **The `voicea-meeting.ts` location** — The Voicea helper lives in `src/meeting/voicea-meeting.ts`, not in `src/transcription/`. The AGENTS.md claim about "AI captions via Voicea (newer path)" being in `src/transcription/` is slightly misleading.

---

## 4. Style & Usefulness Assessment

### Strengths

| Aspect | Assessment |
|--------|-----------|
| **Onboarding value** | Excellent. A new developer can build a mental model of the system within 10-15 minutes. |
| **Structure** | Both documents are well-organized with clear headers and logical flow. ARCHITECTURE.md has a Table of Contents with anchor links. |
| **Complementary roles** | AGENTS.md = "how to work on it" (build, test, contribute). ARCHITECTURE.md = "how it works" (design, components, flows). Together they cover both needs. |
| **Source structure table** | The directory/responsibility table in AGENTS.md is an extremely useful quick reference. |
| **Component map** | The ASCII component tree in ARCHITECTURE.md §2 is highly effective. |
| **Common Mistakes** | AGENTS.md's "Common Mistakes to Avoid" section is practical and actionable. |
| **Code snippets** | Used sparingly and effectively to illustrate patterns. |

### Weaknesses

| Aspect | Assessment |
|--------|-----------|
| **Maintenance burden** | The public events table in ARCHITECTURE.md §15 will become stale as events are added. A note saying "see EVENT_TRIGGERS for the full list" would be more sustainable. |
| **Method/field name accuracy** | Several specific method names are wrong (e.g., `onLocusEvent`, `sendRoapOffer`, `requestMedia`). These will mislead developers searching the code. |
| **Missing "How to debug" section** | Neither doc covers debugging workflows, common failure modes, or how to read Locus DTOs from Mercury traces. |
| **No cross-reference** | ARCHITECTURE.md doesn't point readers to AGENTS.md for build/test commands (or vice versa). |

---

## 5. Redundancies

| Topic | AGENTS.md | ARCHITECTURE.md | Verdict |
|-------|-----------|-----------------|---------|
| Hash-tree vs. classic Locus | "Locus updates" section | §4 detail | Acceptable — different depth |
| `--targets` test pattern | Full detail + examples | Not covered | Fine (operational vs. design) |
| LoggerProxy usage | "Logging" section | §15 brief mention | Acceptable |
| Constants pattern | "Constants" section | §15 EVENT_TRIGGERS detail | Acceptable |
| Source structure | Table | Component map | Complementary, not redundant |

No problematic redundancies found.

---

## 6. Recommendations

### Priority 1 — Fix Factual Errors

1. Fix state machine transitions (add `end`, `decline`, `fail`, `reset`; remove `error`; fix `remote` source states)
2. Fix method name `onLocusEvent` → `handleLocusMercury` / `handleLocusEvent`
3. Fix `sendRoapOffer` → `sendRoapMediaRequest` and POST → PUT
4. Fix mute sync endpoint description (PUT to `/media`, not PATCH to `/controls`)
5. Fix `locus.self.localAudioMuted` → `self.controls.audio.muted`
6. Fix EventsScope description (only `emit()` is scoped, not `on()`/`off()`)
7. Fix `relayType: 'reaction'` → `'react'`
8. Fix join state transition to show IDLE → RINGING → JOINED

### Priority 2 — Clarify Misleading Claims

1. Caveat the logging convention as "aspirational, not strictly enforced"
2. Correct the LocusRetryStatusInterceptor description (503/429 only, endpoint exclusions)
3. Fix Member status values (IN_MEETING/IN_LOBBY/NOT_IN_MEETING, not JOINED/LEFT)
4. Correct reconnection triggers (remove Mercury reconnect as trigger)
5. Fix reachability endpoint (Calliope Discovery, not Locus)
6. Fix `autoRejoin=false` outcome event

### Priority 3 — Add Missing Information

1. Document `src/reactions/`, `src/personal-meeting-room/`, `src/aiEnableRequest/` directories
2. Document `jose`, `@webex/ts-sdp`, `xxh3-ts` dependencies
3. Add a brief "Configuration" section explaining `src/config.ts`
4. Note the FSM property name: `meeting.meetingFiniteStateMachine`
5. Add cross-references between the two documents

### Priority 4 — Maintainability

1. Add a note to the events table: "See `EVENT_TRIGGERS` in constants.ts for the canonical full list"
2. Consider adding last-verified dates to sections so staleness is visible
