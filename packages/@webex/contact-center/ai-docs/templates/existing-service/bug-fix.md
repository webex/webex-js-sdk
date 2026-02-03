# Bug Fix Template

> **Purpose**: Systematic workflow for fixing bugs in existing code.

---

## Pre-Fix Questions

Before starting, gather information:

1. **Bug Description**: What is the unexpected behavior?
2. **Expected Behavior**: What should happen instead?
3. **Reproduction Steps**: How to trigger the bug?
4. **Affected Layer**: Which layer has the bug?
   - [ ] Plugin (cc.ts)
   - [ ] Service (services/*)
   - [ ] Core (services/core/*)
   - [ ] Types
5. **Error Messages**: Any error messages or stack traces?
6. **TrackingId**: If available from logs

---

## Step 1: Reproduce the Bug

### Understand Current Behavior

1. Read the affected code
2. Trace the execution flow
3. Identify where behavior diverges from expected

### Check Existing Tests

```bash
# Run tests for the affected area
yarn workspace @webex/contact-center test -- --testPathPattern=<filename>
```

Are there tests that should have caught this? Do they pass incorrectly?

---

## Step 2: Identify Root Cause

### Common Bug Patterns in This SDK

#### A. Async/Promise Issues
```typescript
// ❌ Bug: Not awaiting promise
this.services.agent.stateChange({data});

// ✅ Fix: Await the promise
await this.services.agent.stateChange({data});
```

#### B. Missing Error Handling
```typescript
// ❌ Bug: Error swallowed
try {
  await operation();
} catch (e) {}

// ✅ Fix: Proper error handling
try {
  await operation();
} catch (error) {
  const {error: detailedError} = getErrorDetails(error, method, module);
  throw detailedError;
}
```

#### C. Event Listener Leaks
```typescript
// ❌ Bug: Listener not removed
this.on('event', handler);

// ✅ Fix: Store reference and remove
this.handler = (data) => { /* handle */ };
this.on('event', this.handler);
// Later in cleanup:
this.off('event', this.handler);
```

#### D. Type Mismatches
```typescript
// ❌ Bug: Accessing wrong property
const id = response.data.agentId;  // But it's response.agentId

// ✅ Fix: Check actual response structure
const id = response.agentId;
```

#### E. Missing Null Checks
```typescript
// ❌ Bug: Crashes if undefined
const name = this.agentConfig.teams[0].teamName;

// ✅ Fix: Optional chaining
const name = this.agentConfig?.teams?.[0]?.teamName;
```

---

## Step 3: Plan the Fix

### Questions to Answer

1. What is the minimal change needed?
2. Could this fix break anything else?
3. What tests need to be added/updated?

### Checklist Before Coding

- [ ] Understood the root cause
- [ ] Identified all affected files
- [ ] Planned backward-compatible fix
- [ ] Identified test cases to add

---

## Step 4: Implement the Fix

### Fix Pattern

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

## Step 5: Add Regression Test

### Test Template

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

## Step 6: Validation Checklist

### Code Changes
- [ ] Fix is minimal and focused
- [ ] No unrelated changes
- [ ] LoggerProxy used (no console.log)
- [ ] Error handling complete

### Tests
- [ ] Regression test added
- [ ] All existing tests still pass
- [ ] Test covers the specific bug scenario

### Verification
```bash
# Type check
yarn workspace @webex/contact-center typecheck

# Lint
yarn workspace @webex/contact-center lint

# All tests
yarn workspace @webex/contact-center test

# Build
yarn workspace @webex/contact-center build
```

---

## Documentation

If the bug affected documented behavior:
- [ ] Update JSDoc if behavior changed
- [ ] Update AGENTS.md if API behavior changed

---

## Complete!

Bug fix is complete when:
1. Root cause identified and fixed
2. Regression test added
3. All tests pass
4. Build succeeds
