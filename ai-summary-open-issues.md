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
| 16 | SDK API | Required callers to pass SDK-owned fields — **fixed** | ~~High~~ |
