# AGENTS.md & ARCHITECTURE.md — Deep Verification Review

This document contains a thorough line-by-line verification of all factual claims, plus a critical assessment of style, usefulness, and completeness.

---

## Part 1: Factual Accuracy

### Source Structure (AGENTS.md) — 27/27 claims verified ✅

Every directory and file listed in the Source Structure table exists and the described responsibilities are accurate. No undocumented directories found in `src/`.

Specific sub-claims also verified:
- `src/meeting/voicea-meeting.ts` exists ✅
- `MediaConnectionAwaiter` exists in `src/media/` ✅
- `MediaProperties` exists in `src/media/` ✅
- `MeetingCollection` exists in `src/meetings/` ✅

---

### Plugin Registration (ARCHITECTURE.md §1) — All accurate ✅

- `registerPlugin('meetings', Meetings, { config, interceptors: {...} })` matches source exactly
- All three interceptors (`LocusRetryStatusInterceptor`, `LocusRouteTokenInterceptor`, `DataChannelAuthTokenInterceptor`) confirmed with `.create` factory pattern
- Interceptor descriptions verified against actual implementations:
  - LocusRetryStatusInterceptor: correctly retries on 503/429, excludes `/hashtree` and `/sync` from 5xx/429 retries
  - LocusRouteTokenInterceptor: correctly injects and captures route tokens
  - DataChannelAuthTokenInterceptor: correctly refreshes JWT, injects auth, retries on 401/403

---

### State Machine (ARCHITECTURE.md §3) — All accurate ✅

- Uses `javascript-state-machine` library ✅
- All 7 states confirmed: IDLE, RINGING, JOINED, ENDED, ERROR, ANSWERED, DECLINED
- All 8 transitions verified with correct from/to states
- `MEETING_REMOVED_REASON` — all 9 constants confirmed, no extras or missing entries

---

### Locus Signalling (ARCHITECTURE.md §4) — INACCURACIES FOUND ⚠️

| Claim | Verdict | Issue |
|-------|---------|-------|
| Classic path call chain | ⚠️ **Oversimplified** | `LocusInfo.parse()` does NOT directly call `LocusDeltaParser.parse()`. It dispatches to `onFullLocus()` or `handleLocusDelta()` which use the parser internally. The doc presents a direct linear chain that doesn't exist. |
| Hash-tree method `HashTreeParser.processHashTreeMessage()` | ❌ **WRONG** | This method does NOT exist on `HashTreeParser`. The actual flow is `LocusInfo.parse()` → `LocusInfo.handleHashTreeMessage()` which interacts with the `HashTreeParser` instance through other methods (sync, data set management). |
| LocusInfo internal events table | ⚠️ **Imprecise** | All event names exist but are split across TWO namespaces (`EVENTS` and `LOCUSINFO.EVENTS`). Some constants (`SELF_UNADMITTED_GUEST`, `SELF_ADMITTED_GUEST`, `DISCONNECT_DUE_TO_INACTIVITY`) appear in BOTH. The doc lists them as a flat table without specifying which namespace. |
| `Meeting.setUpLocusInfoListeners()` | ✅ | Method exists, delegates to individual listener setup methods |

---

### Media Layer (ARCHITECTURE.md §5) — Mostly accurate

| Claim | Verdict |
|-------|---------|
| `this.mediaProperties.webrtcMediaConnection` | ✅ Accurate |
| Transcoded→`RoapMediaConnection`, multistream→`MultistreamRoapMediaConnection` | ✅ Accurate |
| ROAP call chain `Roap.sendRoapMediaRequest()` → `RoapRequest.sendRoap()` → `LocusMediaRequest.send()` | ✅ Accurate |
| TurnDiscovery via `meeting.roap.turnDiscovery` | ✅ Accurate (minor: public API wraps it, callers use `meeting.roap.generateTurnDiscoveryRequestMessage()` not `meeting.roap.turnDiscovery.generateTurnDiscoveryRequestMessage()`) |
| ConnectionStateHandler events and emit | ✅ Accurate |
| Local stream events "on each stream" | ⚠️ **Inaccurate for ConstraintsChange** — `ConstraintsChange` is only listened on the VIDEO stream, not on all streams. The other three (`UserMuteStateChange`, `SystemMuteStateChange`, `OutputTrackChange`) are on both audio and video. |

---

### Multistream (ARCHITECTURE.md §6) — All accurate ✅

- SendSlotManager stream→slot mappings verified (AudioMain, VideoMain, VideoSlides, AudioSlides)
- BrbState confirmed to set `'away'` source state override on VideoMain send slot

---

### Mute State Machine (ARCHITECTURE.md §7) — Mostly accurate

| Claim | Verdict |
|-------|---------|
| State model fields (`client.enabled`, `client.localMute`, `server.localMute`, `server.remoteMute`, `server.unmuteAllowed`, `syncToServerInProgress`) | ✅ All 6 fields confirmed |
| `meeting.audio` and `meeting.video` as MuteState instances | ✅ Accurate |
| `handleServerRemoteMuteUpdate` method exists | ✅ Accurate |
| "SelfUtils detects the change and emits SELF_REMOTE_MUTE_STATUS_UPDATED" | ⚠️ **Imprecise** — SelfUtils detects the change (computes the update flag), but **LocusInfo** emits the event, not SelfUtils. |

---

### Members / Roster (ARCHITECTURE.md §8) — All accurate ✅

- `Members` uses `MembersCollection`, has `locusParticipantsUpdate()`, emits `members:update`
- Member properties (`id`, `name`, `status`, `isAudioMuted`, `isVideoMuted`, `roles`, `isSelf`, `isGuest`, `isInMeeting`, `participant`) all confirmed
- Host/self update chain verified: method names and event names correct

---

### Meeting Info (ARCHITECTURE.md §9) — All accurate ✅

- All 8 `DESTINATION_TYPE` constants verified
- All 4 error classes confirmed (`MeetingInfoV2PasswordError`, `MeetingInfoV2CaptchaError`, `MeetingInfoV2JoinWebinarError`, `MeetingInfoV2PolicyError`)
- `PASSWORD_STATUS` constant with `REQUIRED` value confirmed
- `meeting.verifyPassword()` method confirmed
- `meeting.requiredCaptcha` property confirmed

---

### Reconnection Manager (ARCHITECTURE.md §10) — All accurate ✅

- Both triggers confirmed (ConnectionStateHandler ICE failure + MEDIA_INACTIVITY Locus event)
- `autoRejoin` default `true` in config.ts confirmed
- `NeedsRetryError` and `NeedsRejoinError` are indeed private (not exported), `ReconnectionNotStartedError` is exported — all correct

---

### Reachability (ARCHITECTURE.md §11) — All accurate ✅

- `Reachability.gatherReachability()` confirmed
- `ClusterReachability` per cluster confirmed
- `webex.boundedStorage` usage confirmed (7 usages in reachability code)

---

### Recording Controller (ARCHITECTURE.md §12) — All accurate ✅

- `canUserStart()`, `canUserStop()`, `canUserPause()`, `canUserResume()` all confirmed in `recording-controller/util.ts`
- Both `DISPLAY_HINTS` and `SELF_POLICY` imported and used

---

### Breakout Rooms (ARCHITECTURE.md §13) — Mostly accurate

| Claim | Verdict |
|-------|---------|
| Session types MAIN, BREAKOUT | ✅ |
| `breakouts.askForHelp()` | ⚠️ **Imprecise** — method is on `Breakout` (singular instance), not `Breakouts` (the collection manager). Doc says "participants can ask for help (`breakouts.askForHelp()`)" which implies it's on the top-level `breakouts` object. |
| `admit()` with `authorizingLocusUrl`/`mainLocusUrl` | ✅ |

---

### AI Features (ARCHITECTURE.md §14) — Mostly accurate

| Claim | Verdict |
|-------|---------|
| `meeting.startTranscription({ spokenLanguage })` | ✅ |
| `meeting.transcription` properties | ✅ (also has undocumented `status` property) |
| Reactions relay `processRelayEvent` checks for 'react' | ✅ |
| `receiveReactions` in config.ts | ❌ **WRONG** — `receiveReactions` is NOT a default property in `src/config.ts`. The config has `receiveTranscription: false` but no `receiveReactions`. It exists only as a runtime join option. The doc states "either `config.receiveReactions` (SDK config) or `options.receiveReactions` (join-time option)" — the first half is incorrect. |

---

### External Dependencies (ARCHITECTURE.md §16) — All accurate ✅

All 7 third-party dependencies verified in package.json:
- `javascript-state-machine` ^3.1.0 ✅
- `lodash` ^4.17.21 ✅
- `jwt-decode` 3.1.2 ✅
- `jose` ^5.8.0 ✅
- `xxh3-ts` ^2.0.1 ✅
- `uuid` ^3.3.2 ✅
- `webrtc-adapter` ^8.1.2 ✅

All 9 `@webex/*` internal dependencies verified ✅

**Note:** ~13 other runtime dependencies exist in package.json that are NOT listed (e.g., `@webex/common`, `ampersand-collection`, `bowser`, `btoa`, `ip-anonymize`). The doc's list is selective/curated, not exhaustive. This is fine for a "key" dependencies table but could be noted.

---

### Event Conventions (AGENTS.md & ARCHITECTURE.md §15) — All accurate ✅

- `Trigger` and `TriggerProxy` confirmed as same default export, imported under different aliases
- `EventsScope` confirmed to extend `EventEmitter` (imported as `ChildEmitter`), overrides `emit()` with scope + logging
- `LocusDeltaParser` alias confirmed (class is `Parser`, imported as `LocusDeltaParser`)
- `createMuteState()` factory confirmed
- `LocusMediaRequest` serialization (queue with `isRequestInProgress` + `queuedRequests`) confirmed
- `EVENT_TRIGGERS` confirmed with all spot-checked event strings matching

---

### Join Flow (ARCHITECTURE.md §3) — Accurate ✅

- `MeetingRequest.joinMeeting()` exists ✅
- `Meeting.setLocus()` exists, calls `LocusInfo.initialSetup()` ✅
- FSM path `IDLE → ring(_JOIN_) → RINGING → join() → JOINED` confirmed

---

### Testing Conventions (AGENTS.md) — Mostly accurate with caveats

| Claim | Verdict | Issue |
|-------|---------|-------|
| "Use assert from @webex/test-helper-chai" | ⚠️ | Dominant pattern, but `expect` from same package is also used in 6+ test files. Some files (hashTree, interceptors) use ONLY `expect`. |
| "Use sinon for mocks/stubs" | ✅ | |
| "Most test files use .js, newer tests (especially in multistream/) use .ts" | ⚠️ **Misleading** | `.ts` is widespread: 44 `.ts` test files total across breakouts, interpretation, reachability, hashTree, interceptors, webinar, annotation, and meeting. Not just multistream. |
| `--targets` resolves from `test/unit/spec/` | ✅ | Confirmed via legacy-tools source |
| "Do not use Jest's expect" | ✅ | No Jest expect found. But Chai's `expect` IS used alongside `assert`. |
| Test helpers in `test/utils/` | ✅ | Directory exists with 6 helper files |

---

### Other Convention Claims (AGENTS.md)

| Claim | Verdict | Issue |
|-------|---------|-------|
| "Keep constants.ts sections alphabetised" | ❌ **Not followed** | Sections have `// Please alphabetize` comments showing intent, but are demonstrably NOT alphabetized (e.g., `_ANSWER_` before `_ACTIVE_`, `_MEETING_` after `_ON_HOLD_LOBBY_`). |
| Log format "ClassName:filename#methodName --> message" | ⚠️ **Inconsistent** | Two patterns coexist: direct strings use `-->` while the `getScopeLog` helper produces `->` (single arrow). Both are in active use. |
| "Never use console.*" | ✅ | No console.* in source (only in logger-proxy's own fallback). |

---

## Part 2: Style, Usefulness, and Quality Assessment

### Audience & Purpose Clarity — POOR

Neither file has a 1-sentence statement of who it's for or how to use it. "Agent Guide" is ambiguous (AI agent? Support agent?). ARCHITECTURE.md never states whether it's for internal contributors, external SDK users, or AI tools.

### Redundancy — HIGH

AGENTS.md and ARCHITECTURE.md have ~30% content overlap:
- Source Structure table (AGENTS.md) ≈ Component Map (ARCHITECTURE.md §2)
- Locus update paths described in both
- Display hints vs. policies described in both
- Event system conventions in both
- Testing/build sections nearly identical to root AGENTS.md

**Recommendation:** AGENTS.md should be a lean operational playbook that references ARCHITECTURE.md for context, not a mini-architecture-doc itself.

### Organization & Structure

**AGENTS.md:**
- Good logical order (Build → Structure → Patterns → Testing → Mistakes → PR)
- Source Structure table is bloated at 25 rows — most entries are self-explanatory from directory names (e.g., `src/annotation/` → "Annotation support for screen share")
- No Table of Contents needed at this length

**ARCHITECTURE.md:**
- Table of Contents present and accurate ✅
- **Section depth is wildly inconsistent**: §3 (Meeting Lifecycle) is ~120 lines; §11 (Reachability) is ~15 lines; §13 (Breakout Rooms) is ~35 lines. Some sections feel like thoroughly written reference material; others feel like stubs.
- No cross-references between related sections (§12 mentions display hints but doesn't link to where they're introduced)
- No internal sub-anchors — finding specific subtopics requires scrolling

### Actionability of AGENTS.md

**Strong:**
- `--targets` path explanation with examples — directly prevents real mistakes
- `.only` warning — operationally critical
- `createMuteState()` vs `new MuteState()` — actionable
- `LocusMediaRequest` serialization warning — prevents over-engineering
- `LocusDeltaParser` class name gotcha — saves real time

**Weak:**
- Locus updates section (classic vs hash-tree) — informational, not actionable for a bug fix
- Display hints vs. policies — conceptual; would be more useful as "look at this file for the pattern"
- Logging format convention described as "aspirational, not strictly enforced" — if it's not enforced, why document it as a rule?
- Source Structure table — 70% of entries are obvious from directory names

### Common Mistakes Section — EXCELLENT

This is the single best section in AGENTS.md. Every item is:
- Specific and concrete (not vague)
- Based on real gotchas (not theoretical)
- Immediately actionable

Minor issue: mixes test-running mistakes (`--targets`, `.only`) with code-writing mistakes (`console.*`, `createMuteState()`).

### ASCII Diagrams

- Component map (§2): Clear and scannable ✅
- Meeting FSM diagram (§3): Confusing — the `remote()` transition arrows `↙ ↘` are ambiguous, and the note below ("decline goes to ENDED, not DECLINED") reveals the diagram itself is misleading
- Locus flow chains (§4): Clear and useful ✅
- Reconnection flow (§10): Clear ✅

### Freshness Risk

**Low risk (AGENTS.md):** References directory paths and file names, not line numbers. Good.

**Moderate risk (ARCHITECTURE.md):**
- Embedded `registerPlugin()` code snippet (§1) will silently diverge if interceptors change
- TypeScript video layout config literal (§6) will rot if the interface changes
- Event tables (§4, §15) will silently become incomplete as events are added
- No mechanism exists to detect staleness

### ARCHITECTURE.md Length

At ~700 lines it's acceptable. The problem isn't length — it's findability within sections. Cross-references and sub-anchors would help more than splitting.

---

## Part 3: Summary of Errors Found

### Factual Errors (Must Fix)

1. **§4 Hash-tree path:** `HashTreeParser.processHashTreeMessage()` does not exist. Actual method chain is `LocusInfo.handleHashTreeMessage()` which uses `HashTreeParser` instance methods.

2. **§14 Reactions config:** `receiveReactions` is NOT a default property in `src/config.ts`. The claim "either `config.receiveReactions` (SDK config) or `options.receiveReactions` (join-time option)" is wrong for the first half — it only exists as a runtime option.

3. **AGENTS.md "Keep constants.ts sections alphabetised":** The sections are demonstrably NOT alphabetized despite comments requesting it. This should be noted as an aspiration, not a current reality (the doc already says "aspirational" for logging but not for alphabetization).

### Imprecisions (Should Fix)

4. **§4 Classic path:** The doc claims a direct chain `LocusInfo.parse()` → `LocusDeltaParser.parse()` — in reality there are intermediate dispatch methods (`onFullLocus()`, `handleLocusDelta()`) between them.

5. **§4 Events table namespace:** Events are split across `EVENTS` and `LOCUSINFO.EVENTS` namespaces; the flat table obscures this important distinction.

6. **§5 ConstraintsChange "on each stream":** Only listened on video stream, not audio.

7. **§7 "SelfUtils emits SELF_REMOTE_MUTE_STATUS_UPDATED":** SelfUtils detects the change; LocusInfo emits the event.

8. **§13 `breakouts.askForHelp()`:** Method is on `Breakout` (singular session instance), not `Breakouts` (the manager).

9. **AGENTS.md test extensions claim:** ".ts especially in multistream/" is misleading — .ts is widespread (44 files across 8+ subdirectories).

10. **AGENTS.md assertion claim:** Should acknowledge that `expect` from `@webex/test-helper-chai` is also acceptable (used in 6+ files).

### Missing Coverage (Should Add)

11. **ARCHITECTURE.md** is missing sections on:
    - `src/metrics/` — how CA events and behavioral metrics work
    - `MeetingRequest` class (`src/meeting/request.ts`) — the HTTP request layer
    - `in-meeting-actions.ts` — manages `canDoX` flags from display hints
    - `syncMeetings()` — state recovery after Mercury reconnect
    - Interceptor retry logic details
    - `config.ts` defaults explanation
    - TypeScript migration status (mixed .ts/.js codebase)

12. **AGENTS.md** is missing:
    - Debugging guidance for failing tests
    - Error handling/propagation patterns
    - Note that test runner is Mocha (not Jest)

---

## Part 4: Top Recommendations

1. **Strip AGENTS.md to operational essentials only:** Remove the 25-row Source Structure table (replace with a pointer to ARCHITECTURE.md §2). Remove Locus update explanation and display-hints-vs-policies conceptual section. Keep: build/test, common mistakes, testing conventions, PR guidelines, and terse coding rules.

2. **Fix the two factual errors:** `HashTreeParser.processHashTreeMessage()` (doesn't exist) and `receiveReactions` in config (doesn't exist there).

3. **Add audience statements:** One sentence at the top of each file.

4. **Even out ARCHITECTURE.md section depth:** Either flesh out §11 (Reachability), §13 (Breakouts), §14 (AI Features) to match quality of §3-§7, or mark them as stubs.

5. **Add cross-references within ARCHITECTURE.md:** §12 → display hints introduction; §4 → §5 for media implications; event tables should note they're non-exhaustive.

6. **Reduce redundancy:** AGENTS.md should not repeat what ARCHITECTURE.md covers in depth. Use references instead.

7. **Fix the misleading FSM diagram** or remove it in favor of the transition table (which is clearer).

8. **Clarify testing guidance:** Note Mocha runner, acknowledge `expect` as acceptable alongside `assert`, update .ts distribution claim.
