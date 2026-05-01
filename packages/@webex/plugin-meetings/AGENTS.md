# plugin-meetings — Agent Guide

## Overview

`@webex/plugin-meetings` is the Cisco Webex JS SDK plugin that manages the full lifecycle of Webex meetings. It is registered as `webex.meetings` on the SDK instance and drives:

- Meeting discovery and creation
- Joining, leaving, and ending meetings
- Real-time audio/video media via WebRTC (transcoded and multistream modes)
- Locus signalling (server state synchronisation via Mercury websocket and REST)
- In-meeting controls: mute, recording, screen share, breakouts, captions, reactions, etc.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed design document.

---

## Build & Test

```bash
# Build source (run from repo root)
yarn workspace @webex/plugin-meetings build:src

# Run all unit tests
yarn workspace @webex/plugin-meetings test:unit

# Run a single spec file (path is relative to test/unit/spec/)
yarn workspace @webex/plugin-meetings test:unit --targets <relative-path>
```

**Examples:**
```bash
yarn workspace @webex/plugin-meetings test:unit --targets meeting/index.js
yarn workspace @webex/plugin-meetings test:unit --targets locus-info/controlsUtils.js
yarn workspace @webex/plugin-meetings test:unit --targets multistream/remoteMediaManager.js
```

**Common mistake:** passing `--targets controlsUtils.js` (filename only) or a full absolute path. The value must be the path starting from inside `test/unit/spec/` — not the full path, not just the filename.

### Running a focused subset

Plugin-meetings unit tests are slow. When iterating, always temporarily add `.only` to the specific test(s) you care about:

```javascript
it.only('should do something', () => {
  // test code
});
```

**Always remove `.only` before committing.** A CI run with `.only` will only execute that single test and silently skip everything else.

---

## Source Structure

| Directory | Responsibility |
|---|---|
| `src/meetings/` | `Meetings` class — the WebexPlugin registered as `webex.meetings`. Device registration, Mercury event routing, `MeetingCollection`, meeting creation/destruction. |
| `src/meeting/` | `Meeting` class — single meeting lifecycle. State machine, media setup, mute state, LocusInfo listeners, RTCWeb Offer Answer Protocol (ROAP) orchestration. The largest and most complex module. |
| `src/locus-info/` | Locus DTO parsing and delta processing. Sub-utils for controls, self, host, full-state, media shares, embedded apps. Also handles hash-tree–based updates. |
| `src/roap/` | ROAP SDP exchange and TURN server discovery. |
| `src/media/` | WebRTC media connection wrapper (`MediaProperties`, `MediaConnectionAwaiter`). |
| `src/multistream/` | Multistream-specific media: receive/send slots, `RemoteMediaManager`, `MediaRequestManager`, layouts. |
| `src/members/` / `src/member/` | Participant roster management. Updated from Locus participant deltas. |
| `src/breakouts/` | Breakout room management — session types, pre-assignments, asking for help. |
| `src/recording-controller/` | Recording start/stop/pause/resume. Permission model based on `DISPLAY_HINTS` + `SELF_POLICY`. |
| `src/reconnection-manager/` | ICE failure detection, media-only reconnect vs full rejoin, auto-rejoin. |
| `src/meeting-info/` | `MeetingInfoV2` — fetches meeting info from wbxappapi; handles password/captcha/webinar errors. |
| `src/reachability/` | Pre-join cluster reachability checks; influences TURN/media server selection. |
| `src/transcription/` | Real-time transcription via WebSocket (older path). The newer Voicea captions path is in `src/meeting/voicea-meeting.ts`. |
| `src/interpretation/` | Simultaneous interpretation (language channels). |
| `src/annotation/` | Annotation support for screen share. |
| `src/webinar/` | Webinar-specific logic (practice session, webcast). |
| `src/metrics/` | Behavioral and diagnostic metric emission via `@webex/internal-plugin-metrics`. |
| `src/interceptors/` | HTTP interceptors (via `@webex/http-core`): Locus retry, Locus route token, data-channel auth token. |
| `src/common/` | Shared infrastructure: errors, events (`EventsScope`, `TriggerProxy`), logging (`LoggerProxy`), config. |
| `src/hashTree/` | Hash-tree–based incremental Locus state synchronisation (newer Mercury path). |
| `src/controls-options-manager/` | Meeting controls options (mute-on-entry, disallow-unmute, etc.). |
| `src/reactions/` | Meeting reactions (emoji reactions): types, constants, relay handling. |
| `src/personal-meeting-room/` | Personal meeting room (PMR) info, requests, and utilities. |
| `src/aiEnableRequest/` | AI assistant enable/opt-in request flow. |
| `src/constants.ts` | All string constants, enums, `EVENT_TRIGGERS`, state machines, error dictionaries. |

---

## Key Patterns & Conventions

### Constants
- All public event name strings live in `EVENT_TRIGGERS` in `src/constants.ts`. Never hard-code event strings; always import from there.
- Uppercase constants like `_LEFT_`, `_JOINED_`, `_MOVED_` represent Locus participant/meeting state values. When searching for logic that handles a particular state, search for **both** the named constant (e.g. `_LEFT_`) **and** its raw string value (e.g. `'LEFT'`, `"LEFT"`) — the codebase is inconsistent.
- Keep `constants.ts` sections alphabetised.

### Logging
- Always log through `LoggerProxy` (`import LoggerProxy from '../common/logs/logger-proxy'`). Never use `console.*`.
- Log format convention (aspirational, not strictly enforced): `ClassName:filename#methodName --> message`.

### Events
- **Public events** (emitted to app consumers) are fired through `TriggerProxy` / `Trigger.trigger(this, {file, function}, EVENT_TRIGGERS.SOME_EVENT, payload)`. Note: `Trigger` and `TriggerProxy` are the same default export from `src/common/events/trigger-proxy.ts` — different files import it under different aliases.
- **Internal cross-component events** use `EVENTS.*` constants and are emitted on specific objects (e.g. `locusInfo.on(EVENTS.LOCUS_INFO_UPDATE_SELF, ...)`).
- Never bypass `TriggerProxy`; it provides scoped debug logging via `LoggerProxy` before emitting.

### Meeting class size
`src/meeting/index.ts` is very large. When adding new functionality, extract it to a focused helper file in `src/meeting/` (e.g. `muteState.ts`, `connectionStateHandler.ts`, `brbState.ts`) rather than growing the index file further.

### Locus updates
Locus state arrives via two paths:
1. **Classic sequence-based DTOs** — delivered as `loci` Mercury events; processed by `LocusDeltaParser`.
2. **Hash-tree–based updates** — delivered as `HASH_TREE_DATA_UPDATED` Low Latency Mercury (LLM) events; processed by `HashTreeParser`. The `htMeta` field on a Locus DTO indicates hash-tree mode is active.

Both paths feed into the same `LocusInfo` event bus that `Meeting` listens to.

### Display hints vs. policies
- **Display hints** (`DISPLAY_HINTS.*`) — per-meeting per-participant capability flags set by Locus in the `self` object. They determine what UI controls are visible/enabled.
- **Self policies** (`SELF_POLICY.*`) — org-level capability flags decoded from the JWT permission token. They gate feature access independent of meeting state.
- Most meeting action checks (recording, sharing, captioning, etc.) require _both_ a display hint AND a self policy. See `src/controls-options-manager/util.ts` and `src/recording-controller/util.ts`.

---

## Testing Conventions

- Use **sinon** for stubs, spies, and mocks.
- Use **`assert`** from `@webex/test-helper-chai` for assertions. Do not use Jest's `expect`.
- Use `assert.calledOnceWithExactly` instead of `assert.calledOnce()` + `assert.calledWith()` separately.
- Use `sinon.useFakeTimers()` for any logic involving timeouts or intervals.
- Parameterise tests when there are more than 3 similar cases — use `forEach` or a helper approach matching the style of the surrounding test file.
- Avoid duplicating test setup. Reuse existing helper functions or extract new ones to `test/utils/`.
- Match the coding style (formatting, helper patterns, describe/it structure) of the existing test file you are modifying.

---

## Common Mistakes to Avoid

- **`--targets` path** must be relative to `test/unit/spec/`, e.g. `meeting/index.js`, not `index.js` or the full path.
- **Forgetting to remove `.only`** before committing — this silently skips the rest of the test suite in CI.
- **Searching only for constant names** when tracing Locus state logic. Always also search raw string literals (`'LEFT'`, `"JOINED"`, etc.) — many call sites use inline strings.
- **Adding `console.*` calls** — use `LoggerProxy` instead.
- **Emitting events with hard-coded strings** — always use `EVENT_TRIGGERS.*`.
- **Not checking both display hints and self policies** when implementing a new meeting control.
- **Calling `new MuteState()` directly** — always use `createMuteState()` instead.

---

## PR Guidelines

- Run the tests for the specific area changed: `yarn workspace @webex/plugin-meetings test:unit --targets <path>`.
- Run the full suite before opening a PR: `yarn workspace @webex/plugin-meetings test:unit`.
- Add or update unit tests for every code change, even if not explicitly requested.
- New constants belong in `src/constants.ts`, kept alphabetised within their section.
- Do not add `@ts-ignore` unless you have confirmed there is no cleaner fix; add a comment explaining why.
