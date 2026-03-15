# New Method - Master Template

> **Purpose**: Orchestrator for adding new methods or features to existing modules in the `@webex/calling` package.

---

## Use Case

Use this template when:
- Adding a new method to an existing module (CallingClient, Call, Line, CallHistory, etc.)
- Adding a new public API method
- Extending module capabilities with new functionality

---

## Workflow Overview

```
Step 1: Requirements → Step 2: Implementation → Step 3: Tests → Step 4: Validation
```

---

## Step-by-Step Process

### Step 1: Gather Requirements
**Template**: [`01-requirements.md`](01-requirements.md)

Define:
- Method identity (name, module, visibility)
- Method signature (parameters, return type)
- API endpoint (if calling Mobius/backend)
- Events to emit (if any)
- Metrics to track
- Success/error scenarios

### Step 2: Implementation
**Template**: [`02-implementation.md`](02-implementation.md)

Implement:
- Method with Logger logging (file/method context)
- MetricManager tracking (success + failure)
- Error handling (CallError/LineError/CallingClientError hierarchy)
- JSDoc documentation

### Step 3: Tests
**Template**: [`03-tests.md`](03-tests.md)

Create:
- Success test case
- Error test case
- Edge case tests
- Event emission tests (if applicable)

### Step 4: Validation
**Template**: [`04-validation.md`](04-validation.md)

Verify:
- Coding patterns followed
- Tests pass
- Types exported
- Documentation updated

---

## Patterns to Load

Before implementing, read:
1. [`../../patterns/typescript-patterns.md`](../../patterns/typescript-patterns.md) - Types, interfaces, factory patterns
2. [`../../patterns/event-driven-patterns.md`](../../patterns/event-driven-patterns.md) - Event emission and handling
3. [`../../patterns/testing-patterns.md`](../../patterns/testing-patterns.md) - Jest test conventions
4. [`../../RULES.md`](../../RULES.md) - Coding standards

---

## Quick Checklist

- [ ] Method added with proper signature and return type
- [ ] Logger used with `{ file, method }` context
- [ ] MetricManager tracks success/failure
- [ ] Error handling follows ExtendedError hierarchy
- [ ] JSDoc added with `@param`, `@returns`, `@example`
- [ ] Types defined in `types.ts` and exported if public
- [ ] Event constants used (not string literals) if emitting events
- [ ] Unit tests added (success, error, edge cases)
- [ ] All tests pass
