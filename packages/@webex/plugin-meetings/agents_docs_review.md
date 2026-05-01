# AGENTS.md & ARCHITECTURE.md — Verification Review

This document summarizes a thorough verification of all claims made in `AGENTS.md` and `ARCHITECTURE.md` for `@webex/plugin-meetings`, checked against the actual source code.

---

## Executive Summary

Both documents are **largely accurate and well-structured**. Out of 60+ specific claims verified, only a handful contain factual errors. The documents provide genuine value for an AI coding agent working on this plugin. However, there are some inaccuracies, omissions, and structural/style issues worth addressing.

**Key stats:**
- Factual errors found: 5
- Misleading/imprecise claims: 6
- Omissions: 8
- Style/structure issues: 4

---

## Factual Errors

### 1. State Machine Diagram (ARCHITECTURE.md §3) — INCORRECT

The ASCII diagram shows:
```
decline() → DECLINED
```

**Actual code:** The `decline` transition goes from `[RINGING, ERROR]` to **ENDED**, not DECLINED. The DECLINED state is only reachable via the `remote` transition (when the remote party declines).

Additionally, the diagram visually implies `remote()` fires only from ERROR. In reality, it fires from **both JOINED and ERROR**.

### 2. Reconnection Strategy: "leave() + join()" (ARCHITECTURE.md §10) — INCORRECT

The doc claims:
> on NeedsRejoinError: call meeting.leave({ reason: 'reconnect' }) → call meeting.join() again

**Actual code:** The reconnection manager only calls `this.meeting.join({rejoin: true})`. There is **no explicit `leave()` call** in the reconnection flow.

### 3. State Machine Transitions Oversimplified (ARCHITECTURE.md §3)

The doc says `ring` only comes from IDLE. **Actual:** `ring` can fire from `[IDLE, ERROR, JOINED]`.
The doc says `join` comes from IDLE/RINGING. **Actual:** `join` can fire from `[JOINED, IDLE, RINGING, ERROR]`.

### 4. Test Example File Extension (AGENTS.md) — INCORRECT

The example claims:
```
yarn workspace @webex/plugin-meetings test:unit --targets multistream/remoteMediaManager.js
```

**Actual file:** `test/unit/spec/multistream/remoteMediaManager.ts` (TypeScript, not `.js`). This example would fail.

### 5. `MEETING_REMOVED_REASON` List Incomplete (ARCHITECTURE.md §3)

The doc lists 7 reasons. The actual constant has **9 values** — missing:
- `USER_ENDED_SHARE_STREAMS`
- `NO_MEETINGS_TO_SYNC`

---

## Misleading or Imprecise Claims

### 6. "Reachability stores results in localStorage" (ARCHITECTURE.md §11)

**More accurate:** Reachability uses `webex.boundedStorage`, which is an SDK abstraction layer. In browser environments it defaults to localStorage, but calling it "localStorage" directly is an oversimplification. The constant is even named `REACHABILITY.localStorageResult`, which adds to the confusion.

### 7. LocusDeltaParser class name (ARCHITECTURE.md §2, §4)

The document references `LocusDeltaParser` as a class. **Actual:** The class is declared as `class Parser` in `src/locus-info/parser.ts` and imported with the alias `LocusDeltaParser`. Functionally correct but technically misleading — there is no class literally named `LocusDeltaParser`.

### 8. LocusRetryStatusInterceptor hashtree/sync exclusion (ARCHITECTURE.md §1)

The doc says it "excludes `/hashtree` and `/sync` endpoints" from retry on 503/429. **More accurate:** The exclusion applies to ALL 5xx status codes (`statusCode >= 500`), not just 503. It also excludes 429 for these endpoints. The doc is correct but understates the breadth of the exclusion.

### 9. LocusRouteTokenInterceptor description incomplete (ARCHITECTURE.md §1)

The doc says "Injects the current Locus route token into request headers." **Missing:** It also **captures/stores** route tokens from responses (`onResponse` extracts `X-Cisco-Part-Route-Token` from response headers). The storage side is not mentioned.

### 10. `remote` transition diagram ambiguity (ARCHITECTURE.md §3)

The table correctly states `remote` fires "from JOINED or ERROR states," but the ASCII art above visually contradicts this by placing `remote()` only in the ERROR column. A reader scanning the diagram (more likely than reading the table) would get the wrong impression.

### 11. Events fired with EVENTS.* not just EVENT_TRIGGERS.* (AGENTS.md)

AGENTS.md says: "Never bypass TriggerProxy" and "always use EVENT_TRIGGERS.*". However, some call sites use `EVENTS.*` constants with `Trigger.trigger()` (e.g., `EVENTS.REQUEST_UPLOAD_LOGS` in `meeting/index.ts` line 4744). The guidance is aspirational but not currently universally followed in the codebase itself.

---

## Omissions

### 12. Source structure missing entries

`src/index.ts` and `src/config.ts` are not listed in the AGENTS.md source structure table. While these are boilerplate, `src/config.ts` documents all plugin configuration options and is frequently referenced.

### 13. External dependencies incomplete (ARCHITECTURE.md §16)

12 additional production dependencies are not mentioned:
- `@webex/common`
- `@webex/internal-plugin-conversation`
- `@webex/internal-plugin-support`
- `@webex/internal-plugin-user`
- `@webex/plugin-people`
- `@webex/plugin-rooms`
- `ampersand-collection`
- `bowser`
- `btoa`
- `ip-anonymize`
- `global`
- `dotenv`

While most are utility packages, `@webex/internal-plugin-conversation` is architecturally significant for space-meeting creation.

### 14. `meeting.transcription` properties incomplete (ARCHITECTURE.md §14)

Three additional properties exist but are not documented:
- `showCaptionBox`
- `transcribingRequestStatus`
- `speakerProxy`

### 15. Reactions `options.receiveReactions` alternative (ARCHITECTURE.md §14)

The doc says reactions require `config.receiveReactions`. The actual condition is `(this.config.receiveReactions || options.receiveReactions)` — the join-time option is an alternative path not mentioned.

### 16. `MeetingInfoV2` vs `MeetingInfo` conditional (ARCHITECTURE.md §9)

The Meetings class conditionally instantiates either `MeetingInfoV2` or `MeetingInfo` depending on a `changeState` flag. The doc only mentions `MeetingInfoV2` without noting this conditionality.

### 17. No mention of `locusMediaRequest` (ARCHITECTURE.md §5)

The ROAP section describes `Roap.sendRoapMediaRequest()` as directly doing a PUT to `{selfUrl}/media`. In reality, the call is indirect: `Roap` → `RoapRequest.sendRoap()` → `LocusMediaRequest.send()` → HTTP PUT. `LocusMediaRequest` is a significant intermediate component (handles queuing, serialization of concurrent requests) that isn't described.

### 18. No mention of `LocusMediaRequest` queuing behavior

`LocusMediaRequest` serializes concurrent media update requests. This is architecturally important — without it, race conditions between mute changes, media negotiations, etc. would occur. Neither doc mentions this component.

### 19. `autoRejoin` default value not stated (ARCHITECTURE.md §10)

The doc describes the `autoRejoin` flag but doesn't mention its default is `true` (from `src/config.ts`). This is important for understanding default behavior.

---

## Style & Structure Issues

### 20. ARCHITECTURE.md length and audience

At ~750 lines, the architecture doc is comprehensive but very long. For an AI agent, this is fine (it's consumed programmatically). However, the "omitted lines" comments (e.g., `/* Lines 34-35 omitted */`) are confusing — they appear to be artifacts of summarization and should either show the full content or be removed entirely.

### 21. Redundancy between AGENTS.md and ARCHITECTURE.md

Several topics are covered in both files:
- State machine (AGENTS.md "Locus updates" section + ARCHITECTURE.md §3-4)
- Event system (AGENTS.md "Events" section + ARCHITECTURE.md §15)
- Display hints vs. policies (AGENTS.md + ARCHITECTURE.md §12)

This creates a maintenance burden — if one is updated and the other isn't, they'll drift apart. Consider making AGENTS.md purely operational (build/test/guidelines) and ARCHITECTURE.md purely descriptive (design/structure).

### 22. AGENTS.md "Common Mistakes" section is valuable but could be stronger

The "Common Mistakes to Avoid" section is one of the most useful parts for an AI agent. Consider adding:
- The fact that `remoteMediaManager` tests use `.ts` extension while most others use `.js`
- That `LocusMediaRequest` handles request serialization (agents shouldn't add their own queuing)
- That the `Meetings` class conditionally uses `MeetingInfo` vs `MeetingInfoV2`

### 23. ARCHITECTURE.md component diagram accuracy

The component tree is excellent and verified accurate. However, one improvement: `LocusDeltaParser` should be noted as an import alias (actual class is `Parser`), since an agent searching for `class LocusDeltaParser` will find nothing.

---

## What's Done Well

### Strengths of AGENTS.md:
- **Build/test commands are accurate and immediately usable**
- **`--targets` path resolution is clearly explained** with the common mistake callout
- **Testing conventions section** correctly identifies the exact tools (sinon, chai assert, mocha) and patterns
- **Constants guidance** about searching both named constants AND raw strings is genuinely helpful
- **`createMuteState()` factory requirement** is correct and prevents a real footgun
- **The `.only` warning** is practical and important

### Strengths of ARCHITECTURE.md:
- **Component Map** is comprehensive and verified accurate
- **Locus signalling dual-path explanation** is correct and well-structured
- **Mute state machine** description is precise and matches the code exactly
- **Recording controller** permission model explanation is accurate
- **External dependencies table** is 100% accurate (just incomplete)
- **Event system** documentation with the trigger signature is correct

---

## Recommendations

1. **Fix the state machine diagram** — correct `decline` → ENDED and show `remote` fires from both JOINED and ERROR
2. **Fix the reconnection strategy** — remove the incorrect `leave()` claim; it's just `join({rejoin: true})`
3. **Fix the test example** — change `remoteMediaManager.js` to `remoteMediaManager.ts`
4. **Remove `/* Lines X-Y omitted */` comments** — these are confusing artifacts
5. **Add `LocusMediaRequest`** to the architecture as a key component for request serialization
6. **Reduce redundancy** between the two files — pick one canonical location for each topic
7. **Add `src/config.ts`** to the source structure table with a note about configuration options
8. **Note the `.ts` vs `.js` test file extension** inconsistency in the testing section
9. **Clarify `boundedStorage`** vs raw localStorage in reachability section
10. **Add `autoRejoin` default value** (`true`) to the reconnection section
