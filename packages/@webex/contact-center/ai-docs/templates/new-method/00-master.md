# New Method - Master Template

> **Purpose**: Orchestrator for adding new methods or features to existing services and utils.

---

## Use Case

Use this template when:
- Adding a new method or feature to an existing service or util
- Adding a new public API method to any public object (`cc` for SDK-level operations, `task` for per-interaction operations, or future public objects)
- Extending service capabilities

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
- Method signature (name, parameters, return type)
- API endpoint (if calling backend)
- Events to emit (if any)
- Success/error scenarios

### Step 2: Implementation
**Template**: [`02-implementation.md`](02-implementation.md)

Implement:
- Method with LoggerProxy logging
- MetricsManager tracking
- Error handling pattern
- JSDoc documentation

### Step 3: Tests
**Template**: [`03-tests.md`](03-tests.md)

Create:
- Success test case
- Error test case
- Edge case tests

### Step 4: Validation
**Template**: [`04-validation.md`](04-validation.md)

Verify:
- Patterns followed
- Tests pass
- Types exported

---

## Patterns to Load

Before implementing, read:
1. [`../../patterns/typescript-patterns.md`](../../patterns/typescript-patterns.md) — Types, interfaces, constants
2. [`../../patterns/event-driven-patterns.md`](../../patterns/event-driven-patterns.md) — Event emission and handling
3. [`../../patterns/testing-patterns.md`](../../patterns/testing-patterns.md) — Unit test conventions

---

## Quick Checklist

- [ ] Method added with proper signature
- [ ] LoggerProxy used for logging
- [ ] MetricsManager tracks success/failure
- [ ] Error handling follows pattern
- [ ] JSDoc added with `@public`
- [ ] Types defined and exported
- [ ] Unit tests added
- [ ] All tests pass
