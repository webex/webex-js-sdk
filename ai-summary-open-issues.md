# AI Summary — Open Issues (Requirement Gaps)

These issues were identified during review of the staged changes in
`docs/samples/contact-center/` against the AI summary spec (`ai-summary.md` §17)
and by comparing the sample app against the agent desktop (`wxcc-desktop`).

---

## Issue 2 — `wrapUpCode` field: display label vs. code UUID

**File:** `docs/samples/contact-center/app.js` · **Line:** ~3612

**What happens:**
The `wrapUpCode` field in `sendPostCallSummaryResponse` is set to `wrapupReason`
(the dropdown's `.text` — e.g. `"After Call Work"`), not `auxCodeId`
(the dropdown's `.value` — the UUID).

**Why this is ambiguous:**
The spec's `wrapupCall` pseudocode (§17.2) explicitly uses `wrapUpCode: wrapupReason`
where `wrapupReason = options[...].text`. The wire example in §6.2 also shows
`"wrapUpCode": "Sale"` — a human-readable label, not a UUID.
The implementation follows the spec exactly.

**Decision needed:**
Does the `api-ai-assistant` backend expect the wrapup code **name/label** or the
**UUID**? Needs confirmation from the backend contract or agent-desktop source.
If UUID is required, both the spec pseudocode and the implementation need updating.

---

## Issue 12 — Always in edit mode; no read-only → edit transition

**File:** `docs/samples/contact-center/app.js` · `renderSummarySection`

**Desktop behaviour:**
The summary is initially rendered in read-only mode using the `adaptiveCard` schema (TextBlock
labels). The agent clicks an explicit Edit button to switch into edit mode, at which point the
`editAdaptiveCard` schema (Input.Text fields) is rendered.

**Sample app:**
`renderSummarySection` always calls `extractEditFields` and renders textareas immediately. There is
no read-only phase, no edit button, and the read-only `adaptiveCard` is never used. The agent sees
editable fields from the moment the summary arrives.

**Impact:** Minor UX gap; no impact on payload correctness since edits are already tracked via
`isSummaryEdited`. Low priority for a sample app.

---

## Issue 13 — Full section values sent on submit vs. changed-only delta

**File:** `docs/samples/contact-center/app.js` · `buildSummaryPayload`

**Desktop behaviour:**
On submit, `getModifiedSections(originalSections, currentSections)` computes only the sections that
differ from the original and sends them as the payload. Unchanged sections are omitted.

**Sample app:**
`buildSummaryPayload` collects all current textarea values and returns them in full. When the agent
edits, all sections (including unmodified ones) are sent.

**Impact:** The backend may treat any non-empty section object as an edit. Low priority unless
the backend uses the delta to determine `numberOfTimesEdited` independently.

---

## Issue 14 — Suggested wrapup codes not implemented

**File:** `docs/samples/contact-center/` (no implementation)

**Desktop behaviour:**
The post-call summary event may include a `suggestedWrapUpCodes` array. The desktop maps these
against the agent's wrapup reason list and pre-selects or highlights the matching code in the
wrapup dropdown. Controlled by the org-level feature flag `isSuggestedWrapupReasonsEnabled`.

**Sample app:**
`suggestedWrapUpCodes` is never read. The wrapup dropdown is always manually selected by the agent.

**Decision needed:** Whether this feature is in scope for the SDK sample app.

---

## Issue 15 — No session-storage persistence; summary lost on page refresh

**File:** `docs/samples/contact-center/app.js` · module-level state

**Desktop behaviour:**
`AISummaryStore` serialises `midCallSummaryMap`, `postCallSummaryMap`, and feature flags to
`sessionStorage` on every mutation and restores them on initialisation. If the agent refreshes
during wrapup, the post-call summary payload is recovered and the response can still be sent.

**Sample app:**
All summary state lives in module-level variables (`midCallSummary`, `postCallSummary`,
`postCallSummaryPending`, `summaryFeatureMap`). A page refresh during an active call or wrapup
resets everything. The post-call response would never be sent after a refresh.

**Decision needed:** Whether session-storage resilience is in scope for a sample app.

---

## Issue 16 — SDK requires callers to pass fields it already owns (SDK miss — fixed)

**Files:** `packages/@webex/contact-center/src/services/task/Task.ts` · `types.ts` · `TaskManager.ts` · `TaskFactory.ts` · `cc.ts`

**What happened:**
`sendMidCallSummaryResponse` required callers to pass `conversationId`, `interactionId`, and `agentName` in the payload — all of which the SDK already has internally:

- `conversationId` and `interactionId` — derived from `getAISummaryCorrelation(this.data)` inside the SDK. The caller-provided values were silently ignored by the transport layer. They were never in the TypeScript type definitions either; the sample app was passing dead fields.
- `agentName` — available in `agentConfig.agentName` at registration time. The SDK had `agentId` threaded through to the Task but not `agentName`, forcing every consumer to supply it.

`sendPostCallSummaryResponse` had the same issue for `conversationId` and `interactionId`.

**Classification:** SDK miss — the API required callers to echo back data the SDK already owned or could derive.

**Fix applied:**
- `agentName` made optional in `MidCallReceivedResponse` and `MidCallUnavailableResponse` types
- `agentName` threaded from `agentConfig` → `TaskManager.setAgentName` → `TaskFactory.createTask` → `Task` constructor
- `buildMidCallSummaryResponseTransportPayload` falls back to `this.agentName` when the caller omits it
- `validateMidCallSummaryResponsePayload` no longer requires `agentName` from the caller
- Sample app (`app.js`) — all `sendMidCallSummaryResponse`/`sendPostCallSummaryResponse` calls stripped of `conversationId`, `interactionId`, and `agentName`

---

## Summary

| # | Area | Gap | Priority |
|---|---|---|---|
| 2 | Post-call — payload | `wrapUpCode` label vs. UUID — needs backend confirmation | Medium |
| 12 | Mid-call — UX | Always edit mode; no read-only → edit transition | Low |
| 13 | Mid-call — payload | Full sections sent vs. changed-only delta | Low |
| 14 | Post-call — feature | Suggested wrapup codes not implemented | Medium |
| 15 | General | No session-storage persistence; state lost on refresh | Medium |
| 16 | SDK API | Required callers to pass SDK-owned fields — **fixed** | ~~High~~ |
