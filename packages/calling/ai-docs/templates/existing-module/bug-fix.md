# Existing Module - Bug Fix

> **Purpose**: Structured workflow for investigating and fixing bugs in existing calling SDK code.

---

## STOP — Ask These Questions First

**You MUST present the following questions to the developer and wait for their answers before investigating.** Do not start reading code or making assumptions about the root cause.

---

## Section A: Questions for the Developer (MANDATORY)

### 1. Bug Identity

1. **"Which module is affected?"**
   - e.g., CallingClient, Call, Line, Registration, CallHistory, Voicemail, CallSettings, Contacts
   - If unsure, describe the user-facing behavior and we'll identify the module.

2. **"What is the expected behavior?"**
   - What _should_ happen when things work correctly?

3. **"What is the actual behavior?"**
   - What _does_ happen? Include error messages, unexpected states, or missing events.

4. **"Can you provide steps to reproduce?"**
   - Sequence of API calls, user actions, or conditions that trigger the bug.

### 2. Context

5. **"When did this start happening?"**
   - After a specific commit, PR, or version change?
   - Was it always broken, or did it regress?

6. **"Is this environment-specific?"**
   - Browser (Chrome, Firefox, Safari)?
   - Calling backend (WXC, UCM, BroadWorks)?
   - Network conditions (behind firewall, VPN)?

7. **"Are there any error logs, stack traces, or console output?"**
   - Logger output (look for `CALLING_SDK:` prefix)
   - Browser console errors
   - Network request/response data (Mobius API responses)

### 3. Severity

8. **"How severe is this?"**
   - **Critical**: Calls drop, registration fails, no audio
   - **Major**: Feature doesn't work (hold, transfer, mute)
   - **Minor**: Cosmetic issue, wrong event data, missing log

---

## Section B: Investigation Workflow

After gathering answers, follow this investigation flow:

### Step 1: Load Module Context

Use the [Module Routing Table](../../../AGENTS.md#module-routing-table) to identify the affected module, then:

1. Read the module's `ai-docs/AGENTS.md` (if exists) — understand the public API and expected behavior
2. Read the module's `ai-docs/ARCHITECTURE.md` (if exists) — understand internal flows, state machines, event pipelines
3. Read the module's `types.ts` — understand interfaces and type contracts
4. Read the module's test file — understand existing test coverage

### Step 2: Reproduce & Trace

Based on the developer's reproduction steps:

1. **Identify the entry point** — Which public method is called? (e.g., `call.dial()`, `line.register()`)
2. **Trace the code path** — Follow the execution from entry to the point of failure:
   - Read the method implementation
   - Follow any delegation (e.g., `CallingClient` → `Line` → `Registration`)
   - Check state machine transitions (if applicable — see `calling/call.ts`)
   - Check WebSocket event handling (if applicable — see `calling/callManager.ts`)
3. **Check error handling** — Is the error being caught? Is it being swallowed? Is the right error type used?
4. **Check event emission** — Is the right event being emitted with the right payload?

### Step 3: Root Cause Analysis

Document the root cause before writing any fix:

```
## Root Cause Analysis

**Bug**: [One-sentence description]
**Module**: [module name]
**File(s)**: [file path(s)]
**Root cause**: [Technical explanation of why the bug occurs]
**Impact**: [What breaks and for whom]

### Evidence
- [Line X in file.ts: incorrect condition / missing check / wrong type]
- [Expected: ... / Actual: ...]

### Fix approach
- [What needs to change and why]
```

**Present this to the developer for confirmation before implementing the fix.**

---

## Section C: Fix Implementation

### Step 1: Write the Fix

Follow these guidelines:

- **Minimal change** — Only fix the bug. Do not refactor surrounding code, add features, or "improve" unrelated areas.
- **Match existing patterns** — Use the same Logger, Metrics, Error, and Event patterns as the surrounding code.
- **Preserve the public API** — Do not change method signatures, return types, or event payloads unless the bug IS the wrong signature.

### Step 2: Add/Update Tests

**Every bug fix MUST include a regression test:**

```typescript
describe('methodName - bug fix: [brief description]', () => {
  it('should [correct behavior] when [condition that triggered the bug]', async () => {
    // Arrange — recreate the conditions that caused the bug
    // Act — call the method
    // Assert — verify the correct behavior
  });
});
```

Add the test to the existing co-located test file:
- `src/CallingClient/CallingClient.test.ts`
- `src/CallingClient/calling/call.test.ts`
- `src/CallingClient/line/line.test.ts`
- etc.

### Step 3: Verify No Regressions

```bash
# Run all tests — ensure nothing else broke
yarn test:unit

# Run lint
yarn test:style

# Build
yarn build
```

---

## Section D: Validation Checklist

### Fix Quality
- [ ] Root cause identified and documented
- [ ] Fix addresses the root cause (not just symptoms)
- [ ] Fix is minimal — no unrelated changes
- [ ] No public API changes (unless the bug IS the wrong API)
- [ ] Logger used if new code paths are added
- [ ] Error handling preserved or improved
- [ ] No `console.log` introduced

### Testing
- [ ] Regression test added for the specific bug scenario
- [ ] Existing tests still pass
- [ ] Edge cases considered (what if the fix introduces new edge cases?)

### Verification
- [ ] `yarn test:unit` passes
- [ ] `yarn test:style` passes
- [ ] `yarn build` succeeds
- [ ] Developer confirmed the fix resolves the reported behavior

### Documentation (if applicable)
- [ ] Updated ai-docs if the fix changes behavior documented in AGENTS.md
- [ ] Updated ai-docs if the fix changes architecture documented in ARCHITECTURE.md

---

## Common Bug Patterns in Calling SDK

| Pattern | Where to Look | Common Cause |
|---|---|---|
| Registration fails silently | `registration/register.ts` | Error swallowed in catch, wrong URI, missing auth header |
| Call state stuck | `calling/call.ts` state machine | Missing state transition, timeout not firing, wrong event type |
| No incoming calls | `calling/callManager.ts` | Mercury listener not registered, event key mismatch |
| Hold/resume fails | `calling/call.ts` `doHoldResume` | Call not in correct state, supplementary service endpoint wrong |
| Events not received | `Events/impl/index.ts`, caller code | Wrong event key, listener not attached before emit, `off()` called too early |
| Keepalive failure | `registration/register.ts` | Web worker issue, timer cleared prematurely, 404 not handled |
| Metric not submitted | `Metrics/index.ts` | Wrong METRIC_EVENT, MetricManager not initialized |
| Caller ID missing | `calling/CallerId/index.ts` | SIP header format changed, SCIM query failed silently |
| Network reconnect issue | `CallingClient.ts` | Mercury online/offline race condition, active calls blocking re-register |

---

## Complete!

Bug fix is complete when all validation checkboxes pass and the developer confirms the fix.
