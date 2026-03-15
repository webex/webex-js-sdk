# New Module - Master Template

> **Purpose**: Orchestrator for creating new modules within the `@webex/calling` package — whether top-level (e.g., a new service like CallHistory, Contacts) or a sub-module within an existing module.

---

## Entry Paths

You can land on this template from:
- Direct "create new module" requests
- "Add feature" requests where triage determines a new module is needed
- Requests to add a new backend connector or service

---

## Prerequisites

Before starting, ensure you have:
- Clear understanding of what the module will do
- API endpoint details (payload, response, HTTP method, endpoint) if the module calls a backend
- Event contract details (event keys, payload shape, emission source) if the module uses events
- Understanding of which calling backend(s) it supports (WXC, UCM, BroadWorks, or all)

---

## Workflow Overview

```
Step 1: Pre-Questions → Step 2: Code Generation → Step 3: Test Generation → Step 4: Validation
```

---

## Step-by-Step Process

### Step 1: Gather Requirements
**Template**: [`01-pre-questions.md`](01-pre-questions.md)

Answer these questions:
- What is the module name and purpose?
- What API endpoints will it call?
- What events will it emit or listen to?
- Will it need backend connectors (WXC, UCM, BroadWorks)?
- Is it exposed via a factory function in `src/api.ts`?

### Step 2: Generate Code
**Template**: [`02-code-generation.md`](02-code-generation.md)

Create:
- Module directory with standard file structure
- Main class file implementing the module interface
- Type definitions (`types.ts`)
- Constants (`constants.ts`)
- Factory function for public instantiation

### Step 3: Generate Tests
**Template**: [`03-test-generation.md`](03-test-generation.md)

Create:
- Unit test file (co-located with source)
- Test fixtures file
- Tests for all public methods (success + error)
- Event emission tests

### Step 4: Validation
**Template**: [`04-validation.md`](04-validation.md)

Verify:
- All patterns followed (Logger, Metrics, Errors, Events)
- Tests pass
- Types exported from `src/api.ts`
- ai-docs created for the new module

---

## Patterns to Load

Before generating code, read:
1. [`../../patterns/typescript-patterns.md`](../../patterns/typescript-patterns.md) - Type conventions, factory pattern, singleton pattern
2. [`../../patterns/event-driven-patterns.md`](../../patterns/event-driven-patterns.md) - Event and WebSocket patterns
3. [`../../patterns/testing-patterns.md`](../../patterns/testing-patterns.md) - Test patterns
4. [`../../RULES.md`](../../RULES.md) - Coding standards

---

## Reference Implementations

Study existing modules for patterns:
- **Simple module**: `src/CallHistory/CallHistory.ts` - Single class, factory function, event handling
- **Multi-backend module**: `src/Voicemail/Voicemail.ts` - WXC, UCM, and BroadWorks backend connectors
- **Complex module**: `src/CallingClient/CallingClient.ts` - Sub-modules, state machines, WebSocket events

---

## Quick Checklist

- [ ] Module directory created with standard structure (`types.ts`, `constants.ts`, main class)
- [ ] Interface defined with `I` prefix (`IModuleName`)
- [ ] Class extends `Eventing<T>` if it emits events
- [ ] Factory function exported (`createModuleNameClient`)
- [ ] Logger used with `{ file, method }` context in all methods
- [ ] Metrics tracked for all operations (success + failure)
- [ ] Error handling follows ExtendedError hierarchy
- [ ] Types defined in `types.ts` and exported from `src/api.ts`
- [ ] Constants defined in `constants.ts`
- [ ] Unit tests created and co-located
- [ ] JSDoc added for all public methods
- [ ] ai-docs created (`AGENTS.md` + `ARCHITECTURE.md`) if module is non-trivial
