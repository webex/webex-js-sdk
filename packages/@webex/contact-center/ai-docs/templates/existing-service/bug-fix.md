# Bug Fix Template

> **Purpose**: Systematic workflow for fixing bugs in existing code.

---

## Section A: Questions for the Developer (MANDATORY — Ask First)

**STOP. Present the following questions to the developer and wait for their answers.** Do not read code, run tests, or start investigating until the developer has answered these questions. Do not infer or assume answers.

If the developer cannot provide reproduction steps, ask for logs, error messages, or a description of expected vs actual behavior.

### Questions to Ask:

1. **"What is the unexpected behavior you are seeing?"**
   - Get a clear description of what is going wrong.

2. **"What should happen instead? What is the expected behavior?"**

3. **"How do you reproduce this bug? What are the steps?"**
   - If the developer cannot reproduce it, ask:
     - "Do you have any error messages or stack traces?"
     - "Do you have a trackingId from the logs?"
     - "When did this start happening? Was there a recent code change?"

4. **"Which layer do you think is affected?"**
   - [ ] Plugin (`cc.ts`)
   - [ ] Service (`services/*`)
   - [ ] Core (`services/core/*`)
   - [ ] Types
   - [ ] Not sure (this is fine — you will investigate)

### Completion Gate for Section A

**Before proceeding to investigation, verify:**

- [ ] Unexpected behavior described by developer
- [ ] Expected behavior described by developer
- [ ] Reproduction steps provided (or logs/error messages if steps are unknown)
- [ ] Affected layer identified (or "not sure" — which is acceptable)

**If the description is too vague to start investigating (e.g., "it's broken"), ask targeted follow-up questions. Do not proceed until you have enough context to know where to look.**

---

## Section B: Agent Investigation Steps (After Developer Answers)

Only proceed here after Section A questions are answered.

### Step 1: Reproduce the Bug

#### Understand Current Behavior

1. Read the affected code — trace the execution flow
2. Identify where behavior diverges from the developer's expected behavior
3. Check the call chain: plugin -> service -> core

#### Check Existing Tests

```bash
# Run tests for the affected area
yarn workspace @webex/contact-center test:unit -- <path_to_specific_file>
```

Are there tests that should have caught this? Do they pass incorrectly?

---

### Step 2: Identify Root Cause

#### Common Bug Patterns in This SDK

**A. Async/Promise Issues**
```typescript
// Bug: Not awaiting promise
this.services.agent.stateChange({data});

// Fix: Await the promise
await this.services.agent.stateChange({data});
```

**B. Missing Error Handling**
```typescript
// Bug: Error swallowed
try {
  await operation();
} catch (e) {}

// Fix: Proper error handling
try {
  await operation();
} catch (error) {
  const {error: detailedError} = getErrorDetails(error, method, module);
  throw detailedError;
}
```

**C. Event Listener Leaks**
```typescript
// Bug: Listener not removed
this.on('event', handler);

// Fix: Store reference and remove
this.handler = (data) => { /* handle */ };
this.on('event', this.handler);
// Later in cleanup:
this.off('event', this.handler);
```

**D. Type Mismatches**
```typescript
// Bug: Accessing wrong property
const id = response.data.agentId;  // But it's response.agentId

// Fix: Check actual response structure
const id = response.agentId;
```

**E. Missing Null Checks**
```typescript
// Bug: Crashes if undefined
const name = this.agentConfig.teams[0].teamName;

// Fix: Optional chaining
const name = this.agentConfig?.teams?.[0]?.teamName;
```

---

### Step 3: Present Root Cause and Proposed Fix to Developer

**STOP. Before writing any fix, present your findings to the developer:**

```
## Bug Analysis Summary

**Bug**: [one-sentence description]
**Root cause**: [what is actually wrong in the code]
**Affected file(s)**: [file paths and line numbers]
**Root cause category**: [A/B/C/D/E from patterns above, or other]

### Proposed Fix:
- [What will change in which file]
- [What the code will look like after the fix]

### Risk Assessment:
- Could this fix break anything else? [Yes/No — if yes, what]
- Backward compatible? [Yes/No]

### Tests to Add:
- [Regression test description]

---
Does this analysis look correct? Should I proceed with this fix? (Yes / No / Adjust)
```

**Wait for developer confirmation before implementing the fix.**

---

### Step 4: Implement the Fix

After developer approval:

```typescript
// 1. Make the minimal fix
// 2. Add/update logging if it helps debugging
LoggerProxy.log('Processing data', {
  module: MODULE,
  method: METHOD,
  data: { relevantField: value },  // Add context
});

// 3. Ensure error handling is complete
try {
  // fixed code
} catch (error) {
  LoggerProxy.error(`Operation failed: ${error}`, {
    module: MODULE,
    method: METHOD,
  });
  // ... proper error handling
}
```

---

### Step 5: Add Regression Test

```typescript
describe('methodName - Bug Fix', () => {
  it('should handle [specific scenario that was buggy]', async () => {
    // Arrange: Setup the conditions that triggered the bug
    const bugTriggerInput = { /* ... */ };

    // Act: Execute the fixed code
    const result = await service.methodName(bugTriggerInput);

    // Assert: Verify correct behavior
    expect(result).toEqual(expectedResult);
  });

  it('should not throw error when [edge case]', async () => {
    // Test the specific edge case that was failing
  });
});
```

---

### Step 6: Validation Checklist

#### Code Changes
- [ ] Fix is minimal and focused
- [ ] No unrelated changes
- [ ] LoggerProxy used (no console.log)
- [ ] Error handling complete

#### Tests
- [ ] Regression test added
- [ ] All existing tests still pass
- [ ] Test covers the specific bug scenario

#### Verification
```bash
# Lint
yarn workspace @webex/contact-center test:style

# All tests
yarn workspace @webex/contact-center test:unit

# Build
yarn workspace @webex/contact-center build:src
```

---

## Documentation

If the bug affected documented behavior:
- [ ] Update JSDoc if behavior changed
- [ ] Update the affected service's `AGENTS.md` if API behavior changed (find via root [`AGENTS.md` Service Routing Table](../../../AGENTS.md#service-routing-table))
- [ ] Update the affected service's `ARCHITECTURE.md` if data flow changed

---

## Complete!

Bug fix is complete when:
1. Root cause identified and confirmed with developer
2. Fix implemented after developer approval
3. Regression test added — a test that reproduces the original bug (fails before the fix, passes after) to prevent the same issue from recurring
4. All tests pass
5. Build succeeds
