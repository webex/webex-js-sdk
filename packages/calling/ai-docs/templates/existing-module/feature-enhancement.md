# Existing Module - Feature Enhancement

> **Purpose**: Structured workflow for adding features to existing modules or modifying existing method behavior in the calling SDK.

---

## Use Cases

Use this template when:
- **Adding a feature** to an existing module (e.g., add BNR support to Call, add pagination to CallHistory)
- **Enhancing existing behavior** (e.g., improve hold/resume to support music-on-hold, add retry logic)
- **Modifying an existing method** (e.g., change parameters, change return type, change behavior)

Do NOT use this template for:
- **Creating an entirely new module** → Use [`../new-module/00-master.md`](../new-module/00-master.md)
- **Adding a brand new method** that doesn't modify existing ones → Use [`../new-method/00-master.md`](../new-method/00-master.md)
- **Fixing a bug** → Use [`bug-fix.md`](bug-fix.md)

---

## STOP — Ask These Questions First

**You MUST present the following questions to the developer and wait for their answers before proceeding.** Do not infer answers or start reading code.

---

## Step 0: Placement Triage (MANDATORY)

Before gathering detailed requirements, determine if this is truly an enhancement to an existing module or if it needs a new module:

Ask the developer:

1. **"Does this feature fit within an existing module, or does it need its own module?"**
   - If it extends existing API methods, modifies existing behavior, or adds capabilities to an existing class → **Continue with this template**
   - If it introduces a new domain concept, new backend endpoints unrelated to existing modules, or a new public interface → **Reroute to [`../new-module/00-master.md`](../new-module/00-master.md)**

2. **"Which existing module does this feature belong to?"**
   - e.g., CallingClient, Call, Line, Registration, CallHistory, CallSettings, Contacts, Voicemail

---

## Section A: Pre-Enhancement Questions (MANDATORY)

### 1. Feature Identity

3. **"What does this feature do? Describe the enhancement in one or two sentences."**

4. **"Which file(s) will be modified?"**
   - e.g., `src/CallingClient/calling/call.ts`, `src/CallHistory/CallHistory.ts`

5. **"Does this modify an existing method's signature, behavior, or return type?"**
   - If YES: "What changes?" (new parameter, different return type, behavior change)
   - If NO: "Is this adding internal capabilities that consumers don't directly call?"

### 2. API Changes (MANDATORY if backend API changes, otherwise skip)

6. **"Does this feature require changes to backend API calls?"**
   - New endpoint?
   - Changed request payload?
   - Changed response structure?
   - If YES, provide full API contract for each change (HTTP method, endpoint, request, response, errors)

### 3. Event Changes (MANDATORY if events change, otherwise skip)

7. **"Does this feature add, modify, or remove any events?"**
   - New event keys to add to `src/Events/types.ts`?
   - Changed event payloads?
   - New Mercury WebSocket events to listen to?

### 4. State Machine Changes (MANDATORY if state machine affected, otherwise skip)

8. **"Does this affect the call state machine or ROAP media state machine?"**
   - New states to add?
   - New transitions?
   - Changed transition behavior?
   - If YES, describe the state/transition changes

### 5. Breaking Changes

9. **"Does this change the public API surface in any way?"**
   - Changed method signature (new required parameter)?
   - Changed return type?
   - Changed event payload shape?
   - Removed method or event?
   - If YES: "Is this a breaking change, or backward-compatible?"

### 6. Metrics

10. **"Do existing metrics need to change, or do new metrics need to be added?"**
   - If YES, also ask:
     - Which metric event/action names are impacted?
     - Is this success-only, failure-only, or does it include progress/state-transition metrics?
     - Are `src/Metrics/types.ts` enum/interface updates required?
     - Which code path submits each metric (method/action handler/state transition)?

### 7. Behavior

11. **"What is the expected behavior after enhancement?"**
    - Describe the happy path
    - Describe error paths
    - Describe edge cases

---

## Section B: Completion Gate

**Before proceeding, verify:**

- [ ] Placement confirmed (enhancement to existing module, not new module)
- [ ] Target module and file(s) identified
- [ ] Feature purpose described
- [ ] API changes captured (or confirmed no API changes)
- [ ] Event changes captured (or confirmed no event changes)
- [ ] State machine changes captured (or confirmed no state machine changes)
- [ ] Breaking change assessment done
- [ ] Metrics changes identified
- [ ] Expected behavior (happy path + error + edge cases) described

**If any MANDATORY field is missing, ask a targeted follow-up question.**

---

## Section C: Spec Summary

Present this summary to the developer for approval:

```
## Spec Summary — Feature Enhancement

**Feature**: [from Q3]
**Target module**: [from Q2]
**Target file(s)**: [from Q4]
**Breaking change**: [Yes/No]

### What changes:
- [Bullet 1: specific change]
- [Bullet 2: specific change]

### API Changes:
[table or "No API changes"]

### Event Changes:
[table or "No event changes"]

### State Machine Changes:
[description or "No state machine changes"]

### Metrics Changes:
[description or "No metric changes"]

### Behavior:
- Happy path: [description]
- Error path: [description]
- Edge cases: [description]

### Files to modify:
1. [file path] — [what changes]
2. [file path] — [what changes]

---
Does this match your intent? (Yes / No / Adjust)
```

**Wait for developer approval before implementing.**

---

## Section D: Implementation Workflow

### Step 1: Load Context

1. Read the target module's `ai-docs/AGENTS.md` (if exists) — understand current API
2. Read the target module's `ai-docs/ARCHITECTURE.md` (if exists) — understand current flows
3. Read the specific file(s) being modified — understand current implementation
4. Read the test file(s) — understand existing test coverage
5. Load patterns: [`../../patterns/typescript-patterns.md`](../../patterns/typescript-patterns.md), [`../../patterns/event-driven-patterns.md`](../../patterns/event-driven-patterns.md), [`../../patterns/error-handling-patterns.md`](../../patterns/error-handling-patterns.md)

### Step 2: Implement the Enhancement

Follow these guidelines:

- **Match existing patterns** — Use the same Logger, Metrics, Error, and Event patterns as the surrounding code
- **Extend, don't rewrite** — Add to the existing code rather than rewriting large blocks
- **Maintain backward compatibility** — Unless the developer explicitly confirmed a breaking change
- **Add new constants** to the appropriate file (see constants hierarchy in [`../new-module/02-code-generation.md`](../new-module/02-code-generation.md))
- **Add new types** to the module's `types.ts`
- **Add new event keys** to `src/Events/types.ts` (if applicable)

### Step 3: For Modified Methods — Template

If modifying an existing method's signature:

```typescript
// BEFORE (existing method)
public async existingMethod(param1: string): Promise<ResultType> { ... }

// AFTER (enhanced — new optional parameter, backward compatible)
public async existingMethod(param1: string, newParam?: NewParamType): Promise<ResultType> {
  // ... existing logic preserved

  // New enhancement logic
  if (newParam) {
    // Handle new feature
  }

  // ... rest of existing logic
}
```

If adding a new parameter:
- Make it **optional** to preserve backward compatibility
- Add it to the interface in `types.ts`
- Add JSDoc for the new parameter

### Step 4: Update Tests

**Every enhancement MUST update tests:**

1. **Update existing tests** if method signature or behavior changed:
   ```typescript
   // Ensure existing tests still pass with the old call pattern
   it('should still work without new parameter (backward compat)', async () => {
     const result = await module.existingMethod(param1); // no newParam
     expect(result).toBeDefined();
   });
   ```

2. **Add new tests** for the enhancement:
   ```typescript
   describe('existingMethod - [feature name] enhancement', () => {
     it('should [new behavior] when [new parameter provided]', async () => {
       const result = await module.existingMethod(param1, newParam);
       expect(result).toEqual(expectedEnhancedResult);
     });

     it('should handle error in new feature path', async () => {
       // Test error handling for the new feature
     });
   });
   ```

### Step 5: Build & Verify

```bash
yarn test:unit      # All tests pass (existing + new)
yarn test:style     # Lint passes
yarn build          # Build succeeds
```

---

## Section E: Validation Checklist

### Enhancement Quality
- [ ] Feature implemented as described in spec summary
- [ ] Existing behavior preserved (no regressions)
- [ ] Backward compatible (or breaking change acknowledged by developer)
- [ ] Logger used with `{ file, method }` context
- [ ] Metrics tracked (existing + new if applicable)
- [ ] Error handling follows error class hierarchy
- [ ] Events use enum constants (not string literals)
- [ ] No `console.log` introduced
- [ ] No `any` types introduced

### Types & Constants
- [ ] New types added to module's `types.ts`
- [ ] Interface updated in `types.ts` (if public method signature changed)
- [ ] New constants added at correct hierarchy level
- [ ] New event keys added to `src/Events/types.ts` (if applicable)
- [ ] New metric events added to `src/Metrics/types.ts` (if applicable)
- [ ] Public types exported from `src/api.ts` (if applicable)

### State Machine (if applicable)
- [ ] New states/transitions match the spec
- [ ] State diagram in ARCHITECTURE.md updated
- [ ] Timeouts set appropriately for new states

### Testing
- [ ] Existing tests still pass (no regressions)
- [ ] New tests added for the enhancement
- [ ] Error paths tested
- [ ] Edge cases tested
- [ ] Backward compatibility tested (old call patterns still work)

### Build
- [ ] `yarn test:unit` passes
- [ ] `yarn test:style` passes
- [ ] `yarn build` succeeds

### Documentation
- [ ] Module's `ai-docs/AGENTS.md` updated if API surface changed
- [ ] Module's `ai-docs/ARCHITECTURE.md` updated if flows or state machines changed
- [ ] Root `AGENTS.md` updated if public API surface changed

---

## Complete!

Feature enhancement is complete when all validation checkboxes pass and the developer confirms the enhancement.
