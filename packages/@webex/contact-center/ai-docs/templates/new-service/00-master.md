# New Service Creation - Master Template

> **Purpose**: Orchestrator for creating new services or modules within the Contact Center SDK — whether top-level (e.g., AddressBook, EntryPoint, Queue), a sub-module under an existing service (e.g., a new module under `task/`), or an internal-only utility service.

---

## Entry Paths

You can land on this template from:
- direct "create new service" requests
- "add feature" requests after feature triage determines the feature should be a standalone service/module

If coming from feature triage, include:
- feature placement rationale
- desired service/module name
- expected public API surface

---

## Prerequisites

Before starting, ensure you have:
- Clear understanding of what the service will do
- Complete API signature details (payload, response, HTTP method, endpoint)
- Event contract details when feature uses events (listener object, payload shape, emission source)
- Understanding of data structures involved

---

## Workflow Overview

```
Step 1: Requirements → Step 2: Code Generation → Step 3: Integration → Step 4: Tests → Step 5: Validation
```

---

## Step-by-Step Process

### Step 1: Gather Requirements
**Template**: [`01-pre-questions.md`](01-pre-questions.md)

Answer these questions:
- What is the service name?
- What API endpoints will it call?
- What data will it manage?
- Will it be exposed on `cc.serviceName`?

### Step 2: Generate Code
**Template**: [`02-code-generation.md`](02-code-generation.md)

Create:
- Service class file (placement determined by pre-questions — see Step 1)
- Type definitions (location depends on placement — service folder's `types.ts` or root `src/types.ts`)
- Constants if needed (service folder's `constants.ts` or shared `src/services/constants.ts`)

### Step 3: Integration
**Template**: [`03-integration.md`](03-integration.md)

Integrate:
- Initialize the service (location depends on placement — `cc.ts` for top-level, parent service for sub-modules)
- Expose via `cc.serviceName` if developer confirmed public in pre-questions Q7
- Export types from `src/types.ts` (for public services only)

### Step 4: Generate Tests
**Template**: [`04-test-generation.md`](04-test-generation.md)

Create:
- Unit test file
- Mock service methods
- Test success and error cases

### Step 5: Validation
**Template**: [`05-validation.md`](05-validation.md)

Verify:
- All patterns followed
- Tests pass
- Types exported
- Documentation updated

---

## Patterns to Load

Before generating code, read:
1. [`../../patterns/typescript-patterns.md`](../../patterns/typescript-patterns.md) - Type conventions
2. [`../../patterns/event-driven-patterns.md`](../../patterns/event-driven-patterns.md) - Event and WebSocket patterns
3. [`../../patterns/testing-patterns.md`](../../patterns/testing-patterns.md) - Test patterns

---

## Reference Implementation

Study existing service: `src/services/AddressBook.ts` or `src/services/EntryPoint.ts`

---

## Quick Checklist

- [ ] Service class created with WebexSDK injection
- [ ] LoggerProxy used for all logging
- [ ] Metrics tracked for all operations (success + failure)
- [ ] Error handling follows `getErrorDetails` pattern
- [ ] Types defined and placed correctly (folder `types.ts` or root `src/types.ts`)
- [ ] Constants placed correctly (folder `constants.ts` or shared `src/services/constants.ts`)
- [ ] Initialized and integrated (in `cc.ts` for top-level, or parent service for sub-modules)
- [ ] Unit tests created
- [ ] JSDoc added for public methods
